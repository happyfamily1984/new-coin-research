// 외부 공개 데이터 소스 모음 (API 키 불필요)
import { fetchJson, cgHeaders } from './http.js';

const CG = 'https://api.coingecko.com/api/v3';
const PAPRIKA = 'https://api.coinpaprika.com/v1';
const LLAMA = 'https://api.llama.fi';

// ───────── 검색 ─────────
export async function searchCoins(query) {
  const q = encodeURIComponent(query.trim());
  const results = [];
  const [cg, pp] = await Promise.allSettled([
    fetchJson(`${CG}/search?query=${q}`, { headers: cgHeaders(), cacheMs: 300000 }),
    fetchJson(`${PAPRIKA}/search/?q=${q}&c=currencies&limit=10`, { cacheMs: 300000 }),
  ]);
  if (cg.status === 'fulfilled' && cg.value?.coins) {
    for (const c of cg.value.coins.slice(0, 10)) {
      results.push({ source: 'cg', id: c.id, name: c.name, symbol: c.symbol, rank: c.market_cap_rank, logo: c.large || c.thumb });
    }
  }
  if (pp.status === 'fulfilled' && pp.value?.currencies) {
    for (const c of pp.value.currencies.filter((c) => c.is_active).slice(0, 8)) {
      const dup = results.find((r) => r.symbol?.toLowerCase() === c.symbol?.toLowerCase() && r.name.toLowerCase() === c.name.toLowerCase());
      if (dup) dup.paprikaId = c.id;
      else results.push({ source: 'paprika', id: c.id, paprikaId: c.id, name: c.name, symbol: c.symbol, rank: c.rank || null, logo: `https://static.coinpaprika.com/coin/${c.id}/logo.png` });
    }
  }
  return results;
}

// ───────── CoinGecko ─────────
export function cgCoin(id) {
  return fetchJson(
    `${CG}/coins/${encodeURIComponent(id)}?localization=false&tickers=true&market_data=true&community_data=true&developer_data=true&sparkline=false`,
    { headers: cgHeaders(), retries: 3, cacheMs: 30000 }
  );
}

// ───────── CoinPaprika (팀, 백서, 거래소 마켓) ─────────
export const paprikaCoin = (id) => fetchJson(`${PAPRIKA}/coins/${id}`, { allow404: true });
export const paprikaTicker = (id) => fetchJson(`${PAPRIKA}/tickers/${id}`, { allow404: true });
export const paprikaMarkets = (id) => fetchJson(`${PAPRIKA}/coins/${id}/markets`, { allow404: true });
export const paprikaEvents = (id) => fetchJson(`${PAPRIKA}/coins/${id}/events`, { allow404: true });

// ───────── DefiLlama (투자 라운드, TVL) ─────────
export async function llamaProtocol(candidates) {
  for (const slug of candidates.filter(Boolean)) {
    const d = await fetchJson(`${LLAMA}/protocol/${encodeURIComponent(slug)}`, { allow404: true, timeout: 20000 }).catch(() => null);
    if (d && d.name && !d.statusCode) return d;
  }
  return null;
}
export async function llamaChainByGecko(geckoId) {
  const chains = await fetchJson(`${LLAMA}/v2/chains`, { cacheMs: 3600000 });
  return chains?.find((c) => c.gecko_id === geckoId || c.gasTokenGeckoId === geckoId) || null;
}

// ───────── DexScreener (DEX 유동성/거래) ─────────
export async function dexPairsByToken(address) {
  const d = await fetchJson(`https://api.dexscreener.com/latest/dex/tokens/${address}`);
  return d?.pairs || [];
}

// ───────── GoPlus (토큰 보안/홀더) ─────────
export const GOPLUS_CHAINS = {
  ethereum: '1',
  'binance-smart-chain': '56',
  'polygon-pos': '137',
  'arbitrum-one': '42161',
  base: '8453',
  'optimistic-ethereum': '10',
  avalanche: '43114',
  fantom: '250',
  linea: '59144',
  'zksync': '324',
  scroll: '534352',
  blast: '81457',
  mantle: '5000',
};
export async function goplusToken(platform, address) {
  if (platform === 'solana') {
    const d = await fetchJson(`https://api.gopluslabs.io/api/v1/solana/token_security?contract_addresses=${address}`);
    return d?.result ? Object.values(d.result)[0] : null;
  }
  const chain = GOPLUS_CHAINS[platform];
  if (!chain) return null;
  const d = await fetchJson(`https://api.gopluslabs.io/api/v1/token_security/${chain}?contract_addresses=${address}`);
  return d?.result ? d.result[address.toLowerCase()] || Object.values(d.result)[0] : null;
}

// ───────── 거래소 직접 조회 (심볼 기준) ─────────
export async function checkExchanges(symbol) {
  const S = symbol.toUpperCase();
  const tasks = {
    upbit: async () => {
      const all = await fetchJson('https://api.upbit.com/v1/market/all?is_details=true', { cacheMs: 600000 });
      const m = all.filter((x) => x.market.split('-')[1] === S);
      if (!m.length) return { listed: false };
      const caution = m.flatMap((x) => Object.entries(x.market_event?.caution || {}).filter(([, v]) => v).map(([k]) => k));
      return {
        listed: true,
        markets: m.map((x) => x.market.split('-')[0]),
        koreanName: m[0].korean_name,
        warning: m.some((x) => x.market_event?.warning || x.market_warning === 'CAUTION'),
        caution: [...new Set(caution)],
      };
    },
    bithumb: async () => {
      const d = await fetchJson('https://api.bithumb.com/public/ticker/ALL_KRW', { cacheMs: 600000 });
      return { listed: !!d?.data?.[S] };
    },
    binance: async () => {
      const d = await fetchJson(`https://api.binance.com/api/v3/exchangeInfo?symbol=${S}USDT`, { allow404: true, retries: 0 });
      return d === null ? { listed: false } : { listed: !!d?.symbols?.length };
    },
    okx: async () => {
      const d = await fetchJson(`https://www.okx.com/api/v5/public/instruments?instType=SPOT&instId=${S}-USDT`, { retries: 0 });
      return { listed: !!d?.data?.length };
    },
    bybit: async () => {
      const d = await fetchJson(`https://api.bybit.com/v5/market/instruments-info?category=spot&symbol=${S}USDT`, { retries: 0 });
      return { listed: !!d?.result?.list?.length };
    },
    coinbase: async () => {
      const d = await fetchJson(`https://api.exchange.coinbase.com/products/${S}-USD`, { allow404: true, retries: 0 });
      return { listed: !!d?.id };
    },
    gate: async () => {
      const d = await fetchJson(`https://api.gateio.ws/api/v4/spot/currency_pairs/${S}_USDT`, { allow404: true, retries: 0 });
      return { listed: !!d?.id };
    },
  };
  const out = {};
  await Promise.all(
    Object.entries(tasks).map(async ([k, fn]) => {
      try {
        out[k] = await fn();
      } catch {
        out[k] = { listed: null }; // 확인 불가(지역 차단 등)
      }
    })
  );
  return out;
}
