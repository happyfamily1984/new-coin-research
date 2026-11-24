// 분석 파이프라인: 데이터 수집 → 분류 → 점수 → 전략
import * as src from '../api/sources.js';
import { safe } from '../api/http.js';
import { aiDeepResearch, parseKeys } from '../api/ai.js';
import { translateKo, isKorean } from '../api/translate.js';
import { koCategory, koRound, koKeyword, protectTerms } from './ko-terms.js';
import { getSettings } from '../store.js';
import { classifyProject, classifyEarnMethods, PROJECT_TYPES, EARN_METHODS } from './taxonomy.js';
import { trustScore, potentialScore, isTier1 } from './score.js';
import { buildStrategies, buildRisks } from './strategy.js';

export const STEPS = [
  { key: 'basic', label: '기본 정보·시장 데이터' },
  { key: 'investors', label: '투자자·펀딩 라운드' },
  { key: 'onchain', label: '온체인 분석(보안·홀더·유동성)' },
  { key: 'exchange', label: '거래소 상장 현황' },
  { key: 'ai', label: 'AI 웹 조사(선택)' },
  { key: 'score', label: '분류·신뢰도·전략 산출' },
];

const downsample = (a, n) => (a.length <= n ? a : Array.from({ length: n }, (_, i) => a[Math.round((i * (a.length - 1)) / (n - 1))]));
const strip = (html = '') => html.replace(/<[^>]+>/g, '').replace(/\r?\n{3,}/g, '\n\n').trim();
const slug = (s = '') => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/**
 * @param {{query:string, pick?:{source,id,paprikaId,name,symbol,logo}}} input
 * @param {(stepKey:string, state:'run'|'done'|'skip'|'fail', note?:string)=>void} onStep
 */
export async function analyzeProject(input, onStep = () => {}) {
  const errors = [];
  const pick = input.pick || null;
  const r = {
    id: pick ? `${pick.source}:${pick.id}` : `q:${slug(input.query)}`,
    query: input.query,
    pick,
    name: pick?.name || input.query,
    symbol: pick?.symbol || '',
    logo: pick?.logo || '',
    ids: { cg: pick?.source === 'cg' ? pick.id : null, paprika: pick?.paprikaId || (pick?.source === 'paprika' ? pick.id : null) },
    overview: {},
    market: {},
    team: [],
    investors: { raises: [], all: [], tier1: [], totalRaised: 0 },
    onchain: { contracts: [], security: null, holders: null, dex: null, tvl: null },
    exchanges: { list: [], korea: {}, global: {}, cexCount: 0 },
    dev: null,
    sources: [],
    errors,
  };

  // ── 1. 기본 정보 ──
  onStep('basic', 'run');
  let cg = null;
  if (r.ids.cg) cg = await safe(src.cgCoin(r.ids.cg), 'CoinGecko', errors);
  if (cg) {
    const md = cg.market_data || {};
    r.name = cg.name;
    r.symbol = cg.symbol;
    r.logo = cg.image?.large || r.logo;
    r.overview = {
      description: strip(cg.description?.ko || cg.description?.en || ''),
      categories: (cg.categories || []).filter(Boolean),
      website: cg.links?.homepage?.find(Boolean) || '',
      whitepaper: cg.links?.whitepaper || '',
      twitter: cg.links?.twitter_screen_name ? `https://x.com/${cg.links.twitter_screen_name}` : '',
      telegram: cg.links?.telegram_channel_identifier ? `https://t.me/${cg.links.telegram_channel_identifier}` : '',
      discord: (cg.links?.chat_url || []).find((u) => /discord/.test(u)) || '',
      github: cg.links?.repos_url?.github?.find(Boolean) || '',
      explorers: (cg.links?.blockchain_site || []).filter(Boolean).slice(0, 3),
      genesis: cg.genesis_date,
      chain: cg.asset_platform_id || '자체 체인',
    };
    r.market = {
      price: md.current_price?.usd,
      priceKrw: md.current_price?.krw,
      change24h: md.price_change_percentage_24h,
      change7d: md.price_change_percentage_7d,
      change30d: md.price_change_percentage_30d,
      mcap: md.market_cap?.usd || null,
      fdv: md.fully_diluted_valuation?.usd || null,
      volume24h: md.total_volume?.usd,
      circ: md.circulating_supply,
      total: md.total_supply,
      max: md.max_supply,
      ath: md.ath?.usd,
      athChange: md.ath_change_percentage?.usd,
      athDate: md.ath_date?.usd,
      rank: cg.market_cap_rank,
      spark: downsample(md.sparkline_7d?.price || [], 48),
    };
    const first = cg.genesis_date;
    if (first) r.market.ageDays = (Date.now() - new Date(first).getTime()) / 864e5;
    r.community = { twitter: cg.community_data?.twitter_followers, telegram: cg.community_data?.telegram_channel_user_count, watchlist: cg.watchlist_portfolio_users, sentimentUp: cg.sentiment_votes_up_percentage };
    r.dev = cg.developer_data ? { stars: cg.developer_data.stars, commits4w: cg.developer_data.commit_count_4_weeks, contributors: cg.developer_data.pull_request_contributors } : null;
    r.onchain.contracts = Object.entries(cg.detail_platforms || cg.platforms || {})
      .map(([chain, v]) => ({ chain, address: typeof v === 'string' ? v : v?.contract_address }))
      .filter((c) => c.chain && c.address);
    r.exchanges.list = (cg.tickers || [])
      .filter((t) => !t.is_anomaly && !t.is_stale)
      .map((t) => ({ name: t.market?.name, id: t.market?.identifier, pair: `${t.base}/${t.target}`, volume: t.converted_volume?.usd, trust: t.trust_score, dex: /swap|dex|uniswap|pancake|raydium|orca|jupiter|aerodrome|curve|sushi/i.test(t.market?.name || ''), url: t.trade_url }));
    r.sources.push({ title: 'CoinGecko', url: `https://www.coingecko.com/en/coins/${cg.id}` });
  }
  // CoinPaprika: 팀/백서 보강 + CoinGecko 실패 시 대체
  if (!r.ids.paprika && r.symbol) {
    const found = await safe(src.searchCoins(r.name), 'CoinPaprika 검색', errors);
    const m = found?.find((x) => x.paprikaId && x.symbol?.toLowerCase() === r.symbol.toLowerCase());
    if (m) r.ids.paprika = m.paprikaId;
  }
  if (r.ids.paprika) {
    const [pc, pt] = await Promise.all([safe(src.paprikaCoin(r.ids.paprika), 'CoinPaprika', errors), cg ? null : safe(src.paprikaTicker(r.ids.paprika), 'CoinPaprika 시세', errors)]);
    if (pc) {
      r.team = (pc.team || []).map((t) => ({ name: t.name, role: t.position }));
      r.overview.whitepaper ||= pc.whitepaper?.link || '';
      if (!cg) {
        r.name = pc.name;
        r.symbol = pc.symbol;
        r.logo ||= pc.logo;
        const L = (type) => pc.links_extended?.find((l) => l.type === type)?.url || '';
        r.overview = { ...r.overview, description: pc.description || '', categories: (pc.tags || []).map((t) => t.name), website: pc.links?.website?.[0] || L('website'), twitter: L('twitter'), discord: L('discord'), telegram: L('telegram'), github: L('source_code'), genesis: pc.started_at?.slice(0, 10), chain: pc.type === 'token' ? '토큰' : '자체 체인' };
      }
      if (pc.first_data_at && r.market.ageDays == null) r.market.ageDays = (Date.now() - new Date(pc.first_data_at).getTime()) / 864e5;
      r.overview.tags = (pc.tags || []).map((t) => t.name);
      if (!r.onchain.contracts.length && pc.contracts?.length) {
        const PMAP = { 'eth-ethereum': 'ethereum', 'bnb-bnb': 'binance-smart-chain', 'bnb-binance-coin': 'binance-smart-chain', 'arb-arbitrum': 'arbitrum-one', 'matic-polygon': 'polygon-pos', 'pol-polygon-ecosystem-token': 'polygon-pos', 'sol-solana': 'solana', 'base-base': 'base', 'op-optimism': 'optimistic-ethereum', 'avax-avalanche': 'avalanche' };
        r.onchain.contracts = pc.contracts.map((c) => ({ chain: PMAP[c.platform] || c.platform, address: c.contract })).filter((c) => c.address);
      }
      r.sources.push({ title: 'CoinPaprika', url: `https://coinpaprika.com/coin/${r.ids.paprika}/` });
    }
    if (pt?.quotes?.USD) {
      const q = pt.quotes.USD;
      r.market = { ...r.market, price: q.price, change24h: q.percent_change_24h, change7d: q.percent_change_7d, change30d: q.percent_change_30d, mcap: q.market_cap || null, volume24h: q.volume_24h, ath: q.ath_price, athChange: q.percent_from_price_ath, athDate: q.ath_date, circ: pt.circulating_supply, total: pt.total_supply, max: pt.max_supply, rank: pt.rank };
      if (pt.total_supply && q.price) r.market.fdv = (pt.max_supply || pt.total_supply) * q.price;
    }
    if (!cg && r.ids.paprika) {
      const mk = await safe(src.paprikaMarkets(r.ids.paprika), 'CoinPaprika 마켓', errors);
      r.exchanges.list = (mk || []).filter((m) => !m.outlier && (m.category || 'Spot') === 'Spot').map((m) => ({ name: m.exchange_name, id: m.exchange_id, pair: m.pair, volume: m.quotes?.USD?.volume_24h, trust: m.trust_score === 'high' ? 'green' : m.trust_score === 'medium' ? 'yellow' : 'red', dex: /swap|dex|uniswap|pancake|raydium/i.test(m.exchange_name), url: m.market_url }));
    }
  }
  onStep('basic', cg || r.ids.paprika ? 'done' : 'skip', cg || r.ids.paprika ? '' : '등록된 시세 데이터 없음(신규/미상장 가능성)');

  // ── 2. 투자자 ──
  onStep('investors', 'run');
  const llama = await safe(src.llamaProtocol([r.ids.cg, slug(r.name), slug(input.query), r.name.toLowerCase()]), 'DefiLlama', errors);
  if (llama) {
    r.llama = { slug: llama.slug || slug(llama.name), hacks: llama.hacks || [], category: llama.category, audits: llama.audits, audit_links: llama.audit_links };
    applyRaises(r, llama.raises || []);
    const tvlSeries = llama.tvl || [];
    if (tvlSeries.length) {
      const cur = tvlSeries[tvlSeries.length - 1]?.totalLiquidityUSD;
      const past = tvlSeries[Math.max(0, tvlSeries.length - 31)]?.totalLiquidityUSD;
      r.onchain.tvl = { current: cur, change30d: past ? ((cur - past) / past) * 100 : null, chains: Object.keys(llama.currentChainTvls || {}).filter((k) => !/-|staking|pool2|borrowed/.test(k)).slice(0, 6), series: tvlSeries.slice(-90).map((p) => p.totalLiquidityUSD) };
    }
    r.overview.description ||= llama.description || '';
    if (llama.category) (r.overview.categories ||= []).push(llama.category);
    r.sources.push({ title: 'DefiLlama', url: `https://defillama.com/protocol/${r.llama.slug}` });
  }
  onStep('investors', r.investors.raises.length ? 'done' : 'skip', r.investors.raises.length ? `${r.investors.raises.length}개 라운드` : '공개 라운드 미확인');

  // ── 3. 온체인 ──
  onStep('onchain', 'run');
  const main = pickMainContract(r.onchain.contracts);
  if (main) {
    const [gp, pairs] = await Promise.all([safe(src.goplusToken(main.chain, main.address), 'GoPlus', errors), safe(src.dexPairsByToken(main.address), 'DexScreener', errors)]);
    if (gp) applyGoPlus(r, gp, main.chain);
    if (pairs?.length) applyDex(r, pairs, main.address);
    r.sources.push({ title: 'GoPlus Security', url: `https://gopluslabs.io/token-security/${src.GOPLUS_CHAINS[main.chain] || 'solana'}/${main.address}` });
  } else if (r.ids.cg) {
    // 자체 체인 코인 → 체인 TVL
    const ch = await safe(src.llamaChainByGecko(r.ids.cg), 'DefiLlama 체인', errors);
    if (ch && !r.onchain.tvl) r.onchain.tvl = { current: ch.tvl, chains: [ch.name], isChain: true };
  }
  const onchainOk = r.onchain.security || r.onchain.dex || r.onchain.tvl;
  onStep('onchain', onchainOk ? 'done' : 'skip', onchainOk ? '' : '컨트랙트 정보 없음');

  // ── 4. 거래소 ──
  onStep('exchange', 'run');
  if (r.symbol) {
    const direct = await safe(src.checkExchanges(r.symbol), '거래소 조회', errors);
    if (direct) {
      // CoinGecko 티커에 있으면 우선 신뢰(심볼 충돌 방지)
      const inList = (re) => r.exchanges.list.some((e) => re.test(e.name || ''));
      const fix = (k, re) => {
        const v = direct[k] || { listed: null };
        if (r.exchanges.list.length) v.listed = inList(re) || (v.listed && r.market.rank && r.market.rank < 800) ? true : v.listed === null ? null : false;
        return v;
      };
      r.exchanges.korea = { upbit: fix('upbit', /upbit/i), bithumb: fix('bithumb', /bithumb/i) };
      if (direct.upbit?.listed) Object.assign(r.exchanges.korea.upbit, { ...direct.upbit, listed: r.exchanges.korea.upbit.listed });
      r.exchanges.global = { binance: fix('binance', /binance/i), okx: fix('okx', /okx/i), bybit: fix('bybit', /bybit/i), coinbase: fix('coinbase', /coinbase/i), gate: fix('gate', /gate/i) };
    }
  }
  const cex = new Set(r.exchanges.list.filter((e) => !e.dex).map((e) => e.name));
  r.exchanges.cexCount = cex.size;
  r.exchanges.dexCount = new Set(r.exchanges.list.filter((e) => e.dex).map((e) => e.name)).size + (r.onchain.dex?.pairs?.length ? 1 : 0);
  onStep('exchange', 'done', `CEX ${r.exchanges.cexCount}곳`);

  // 상장 단계
  const listed = r.exchanges.cexCount > 0 || !!r.market.price;
  r.stage = !listed && !r.onchain.dex ? 'pre-tge' : r.market.ageDays != null && r.market.ageDays < 120 ? 'new' : 'listed';

  // ── 5. AI ──
  const s = getSettings();
  const hasKey = parseKeys(s.geminiKeys).length > 0;
  if (hasKey && !input.skipAi && (s.aiAuto || input.forceAi)) {
    onStep('ai', 'run', 'Gemini 웹 검색 준비 중…');
    try {
      r.ai = await aiDeepResearch(r.name, summarizeForAi(r), (msg) => onStep('ai', 'run', msg));
      applyAi(r);
      onStep('ai', 'done', `${r.ai._meta.model} · 웹 검색 ${r.ai._meta.searches}회`);
    } catch (e) {
      errors.push(`AI: ${e.message}`);
      onStep('ai', 'fail', e.message);
    }
  } else onStep('ai', 'skip', hasKey ? '자동 실행 꺼짐' : 'Gemini API 키 미설정');

  // ── 6. 분류·점수·전략 + 한국어 변환 ──
  onStep('score', 'run');
  finalize(r);
  onStep('score', 'run', '영문 정보를 한국어로 변환 중…');
  await localize(r);
  onStep('score', 'done');
  r.updatedAt = Date.now();
  if (!cg && !r.ids.paprika && !r.ai && !llama) r.thin = true; // 데이터 부족
  return r;
}

/** 영어로 수집된 설명·카테고리·팀 역할 등을 한국어로 변환 (AI 없이 무료 번역) */
export async function localize(r) {
  const o = r.overview;
  const jobs = [];
  const add = (get, set) => {
    const v = get();
    if (v && typeof v === 'string' && !isKorean(v)) jobs.push({ v, set });
  };
  if (o.description && !isKorean(o.description)) {
    o.descriptionEn = o.description;
    add(() => protectTerms(o.description.slice(0, 3000)), (t) => (o.description = t));
  }
  // 카테고리·태그: 코인 용어 사전 우선, 없으면 기계번역
  const listKo = (arr, setEn) => {
    setEn([...arr]);
    arr.forEach((c, i) => {
      const d = koCategory(c);
      if (d) arr[i] = d;
      else add(() => c, (t) => (arr[i] = t));
    });
  };
  if (o.categories?.length && !o.categoriesEn) listKo(o.categories, (v) => (o.categoriesEn = v));
  if (o.tags?.length && !o.tagsEn) listKo(o.tags, (v) => (o.tagsEn = v));
  (r.team || []).forEach((m) => add(() => m.role, (t) => (m.role = t)));
  (r.investors?.raises || []).forEach((x) => {
    const d = koRound(x.round);
    if (d) x.round = d;
    else add(() => x.round, (t) => (x.round = t));
  });
  (r.classification?.types || []).forEach((t) => (t.reasons || []).forEach((why, i) => {
    const m = why.match(/^카테고리: (.+)$/);
    if (m && !isKorean(m[1])) {
      const d = koCategory(m[1]);
      if (d) t.reasons[i] = `카테고리: ${d}`;
      else add(() => m[1], (tr) => (t.reasons[i] = `카테고리: ${tr}`));
    }
    const k = why.match(/^설명 키워드: "(.+)"$/);
    if (k && !isKorean(k[1])) t.reasons[i] = `설명에 '${koKeyword(k[1]) || k[1]}' 관련 내용`;
  }));
  if (!jobs.length) return r;
  try {
    const out = await translateKo(jobs.map((j) => j.v));
    jobs.forEach((j, i) => out[i] && j.set(out[i]));
    r.translated = true;
  } catch (e) {
    r.errors?.push(`번역: ${e.message}`);
  }
  return r;
}

/** 이전 AI 조사 결과를 새 데이터에 다시 적용 */
export function reapplyAi(r, ai) {
  if (!ai || r.ai) return r;
  r.ai = ai;
  applyAi(r);
  r.thin = false;
  return finalize(r);
}

/** 분류·점수·전략 재계산 (AI 병합 후에도 호출) */
export function finalize(r) {
  // 분류는 영문 원문 기준(키워드 규칙이 영어) — 번역 후에도 원문을 사용
  const text = `${r.overview.descriptionEn || r.overview.description || ''} ${r.ai?.overview || ''} ${(r.ai?.airdrop?.detail || '')}`;
  const cls = classifyProject({
    name: r.name,
    description: text,
    categories: r.overview.categoriesEn || r.overview.categories || [],
    tags: r.overview.tagsEn || r.overview.tags || [],
    isListed: r.stage !== 'pre-tge',
    ageDays: r.market.ageDays,
    hasRaises: r.investors.raises.length > 0,
  });
  // AI 분류 우선 반영
  const aiTypes = (r.ai?.types || []).filter((k) => PROJECT_TYPES[k]);
  if (aiTypes.length) {
    const rest = cls.types.filter((t) => !aiTypes.includes(t.key));
    cls.types = [...aiTypes.map((k, i) => ({ key: k, label: PROJECT_TYPES[k].label, score: 99 - i, reasons: ['AI 웹 조사 결과'], ai: true })), ...rest].slice(0, 5);
    cls.primary = aiTypes[0];
  }
  r.classification = cls;
  const typeKeys = cls.types.map((t) => t.key);
  let methods = classifyEarnMethods({ typeKeys, text, isListed: r.stage !== 'pre-tge' && r.exchanges.cexCount > 0, hasDex: !!r.onchain.dex, hasTvl: !!r.onchain.tvl?.current, stage: r.stage });
  const aiM = (r.ai?.earnMethods || []).filter((m) => EARN_METHODS[m.key]);
  if (aiM.length) {
    const map = new Map(methods.map((m) => [m.key, m]));
    for (const m of aiM) map.set(m.key, { key: m.key, label: EARN_METHODS[m.key].label, icon: EARN_METHODS[m.key].icon, fit: m.fit || 'mid', why: m.why || 'AI 조사', ai: true });
    const rank = { high: 0, mid: 1, low: 2 };
    methods = [...map.values()].filter((m) => m.key !== 'other' || map.size === 1).sort((a, b) => rank[a.fit] - rank[b.fit]);
  }
  r.earnMethods = methods;
  r.scores = { trust: trustScore(r) };
  r.scoresTrustRaw = r.scores.trust.score;
  r.scores.potential = potentialScore(r);
  r.strategies = buildStrategies(r);
  r.risks = buildRisks(r);
  return r;
}

function applyRaises(r, raises) {
  const rs = raises
    .map((x) => ({ date: x.date ? new Date(x.date * 1000).toISOString().slice(0, 7) : '', round: x.round || '라운드', amount: x.amount ?? null, lead: x.leadInvestors || [], others: x.otherInvestors || [], valuation: x.valuation }))
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  mergeRaises(r, rs);
}
function mergeRaises(r, rs) {
  const key = (x) => `${x.date}|${(x.round || '').toLowerCase()}`;
  const seen = new Set(r.investors.raises.map(key));
  for (const x of rs) if (!seen.has(key(x))) r.investors.raises.push(x);
  r.investors.raises.sort((a, b) => ((a.date || '') < (b.date || '') ? 1 : -1));
  const all = [...new Set(r.investors.raises.flatMap((x) => [...(x.lead || []), ...(x.others || [])]))];
  r.investors.all = all;
  r.investors.lead = [...new Set(r.investors.raises.flatMap((x) => x.lead || []))];
  r.investors.tier1 = all.filter(isTier1);
  r.investors.totalRaised = r.investors.raises.reduce((s, x) => s + (+x.amount || 0), 0);
}

function pickMainContract(list) {
  if (!list.length) return null;
  const order = ['ethereum', 'solana', 'base', 'binance-smart-chain', 'arbitrum-one', 'polygon-pos', 'optimistic-ethereum', 'avalanche'];
  return [...list].sort((a, b) => (order.indexOf(a.chain) + 1 || 99) - (order.indexOf(b.chain) + 1 || 99))[0];
}

function applyGoPlus(r, g, chain) {
  const b = (v) => v === '1' || v === 1 || v === true || v?.status === '1';
  const n = (v) => (v == null || v === '' ? null : +v);
  const pct = (v) => (v == null ? null : +v * 100);
  if (chain === 'solana') {
    r.onchain.security = {
      chain,
      mintable: b(g.mintable),
      freezable: b(g.freezable),
      ownerChangeBalance: b(g.balance_mutable_authority),
      openSource: true,
      holderCount: n(g.holder_count),
    };
  } else {
    r.onchain.security = {
      chain,
      honeypot: b(g.is_honeypot),
      mintable: b(g.is_mintable),
      ownerChangeBalance: b(g.owner_change_balance),
      hiddenOwner: b(g.hidden_owner),
      blacklist: b(g.is_blacklisted),
      pausable: b(g.transfer_pausable),
      proxy: b(g.is_proxy),
      openSource: g.is_open_source == null ? null : b(g.is_open_source),
      buyTax: g.buy_tax === '' ? 0 : +((+g.buy_tax || 0) * 100).toFixed(2),
      sellTax: g.sell_tax === '' ? 0 : +((+g.sell_tax || 0) * 100).toFixed(2),
      owner: g.owner_address || '',
      creator: g.creator_address || '',
      trustList: b(g.trust_list),
      lpLockedPct: (g.lp_holders || []).filter((h) => b(h.is_locked)).reduce((s, h) => s + (+h.percent || 0) * 100, 0),
    };
  }
  const holders = (g.holders || []).map((h) => ({ address: h.address || h.account, pct: pct(h.percent), tag: h.tag || '', contract: b(h.is_contract), locked: b(h.is_locked) }));
  r.onchain.holders = {
    count: n(g.holder_count),
    top: holders.slice(0, 10),
    top10Pct: holders.length ? holders.slice(0, 10).reduce((s, h) => s + (h.pct || 0), 0) : null,
  };
}

function applyDex(r, pairs, address) {
  const mine = pairs.filter((p) => p.baseToken?.address?.toLowerCase() === address.toLowerCase());
  const ps = (mine.length ? mine : pairs).sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0));
  const top = ps.slice(0, 6).map((p) => ({ dex: p.dexId, chain: p.chainId, pair: `${p.baseToken?.symbol}/${p.quoteToken?.symbol}`, liquidity: p.liquidity?.usd || 0, volume24h: p.volume?.h24 || 0, buys: p.txns?.h24?.buys || 0, sells: p.txns?.h24?.sells || 0, change24h: p.priceChange?.h24, createdAt: p.pairCreatedAt, url: p.url }));
  const sum = (k) => top.reduce((s, p) => s + (p[k] || 0), 0);
  r.onchain.dex = { pairs: top, totalLiquidity: sum('liquidity'), volume24h: sum('volume24h'), buys: sum('buys'), sells: sum('sells'), firstPairAt: Math.min(...ps.map((p) => p.pairCreatedAt || Infinity)) };
  if (!r.market.price && ps[0]?.priceUsd) {
    r.market.price = +ps[0].priceUsd;
    r.market.change24h = ps[0].priceChange?.h24;
    r.market.mcap = ps[0].marketCap || null;
    r.market.fdv = ps[0].fdv || null;
    r.market.volume24h = r.onchain.dex.volume24h;
  }
  if (r.market.ageDays == null && isFinite(r.onchain.dex.firstPairAt)) r.market.ageDays = (Date.now() - r.onchain.dex.firstPairAt) / 864e5;
}

function summarizeForAi(r) {
  return {
    name: r.name, symbol: r.symbol, website: r.overview.website, categories: r.overview.categories,
    description: (r.overview.description || '').slice(0, 800),
    market: { price: r.market.price, mcap: r.market.mcap, fdv: r.market.fdv, rank: r.market.rank },
    investors: r.investors.raises.slice(0, 6), exchanges: [...new Set(r.exchanges.list.map((e) => e.name))].slice(0, 15),
    korea: r.exchanges.korea, contracts: r.onchain.contracts.slice(0, 3),
  };
}

function applyAi(r) {
  const a = r.ai;
  if (!a) return;
  if (a.overview && (!r.overview.description || r.overview.description.length < 200)) r.overview.descriptionAi = a.overview;
  if (a.team?.length && !r.team.length) r.team = a.team;
  if (a.investors?.length) mergeRaises(r, a.investors.map((x) => ({ date: x.date || '', round: x.round, amount: x.amount, lead: x.lead || [], others: x.others || [], ai: true })));
  if (a.stage && ['pre-tge', 'new', 'listed'].includes(a.stage) && r.stage === 'pre-tge') r.stage = a.stage;
  for (const s of a.sources || []) if (s?.url) r.sources.push({ title: s.title || s.url, url: s.url, ai: true });
}
