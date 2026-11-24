// 프로젝트 유형 & 참여 수익 방식 분류 체계

export const PROJECT_TYPES = {
  node: { label: '노드형', icon: '🖥️', color: '#5EEAD4' },
  defi: { label: '디파이', icon: '🏦', color: '#60A5FA' },
  nft: { label: 'NFT', icon: '🖼️', color: '#F472B6' },
  gamefi: { label: '게임파이', icon: '🎮', color: '#A78BFA' },
  influencer: { label: '인플루언서·커뮤니티 유입형', short: '커뮤니티형', icon: '📣', color: '#FBBF24' },
  meme: { label: '밈코인', icon: '🐸', color: '#FB923C' },
  infra: { label: 'L1·L2 인프라', short: '인프라', icon: '⛓️', color: '#94A3B8' },
  ai: { label: 'AI', icon: '🤖', color: '#22D3EE' },
  depin: { label: 'DePIN', icon: '📡', color: '#34D399' },
  rwa: { label: 'RWA(실물자산)', short: 'RWA', icon: '🏢', color: '#FCD34D' },
  socialfi: { label: '소셜파이', icon: '💬', color: '#F9A8D4' },
  airdrop: { label: '포인트·에어드랍형', short: '에어드랍형', icon: '🪂', color: '#C4B5FD' },
  launchpad: { label: '런치패드·IDO형', short: '런치패드', icon: '🚀', color: '#FDA4AF' },
  exchange: { label: '거래소·지갑', icon: '💱', color: '#93C5FD' },
  stable: { label: '스테이블·결제', icon: '💵', color: '#86EFAC' },
  referral: { label: '레퍼럴·다단계 의심형', short: '다단계 의심', icon: '⚠️', color: '#F87171' },
  other: { label: '기타', icon: '🧩', color: '#9CA3AF' },
};

export const EARN_METHODS = {
  token: { label: '토큰 구매', icon: '🪙', desc: '거래소·DEX에서 토큰을 사서 시세 차익을 노림' },
  node: { label: '노드 구매·운영', icon: '🖥️', desc: '노드 라이선스 구매 또는 직접 운영해 보상 수령' },
  nft: { label: 'NFT 구매·민팅', icon: '🖼️', desc: 'NFT 민팅·구매 후 에어드랍/혜택/시세 차익' },
  activity: { label: '활동 참여형', icon: '🧪', desc: '테스트넷·앱 사용·퀘스트로 포인트/에어드랍 획득' },
  sns: { label: 'SNS 참여·홍보', icon: '📣', desc: 'X(트위터)·디스코드 활동, 야핑, 앰배서더, 콘텐츠 제작' },
  staking: { label: '스테이킹·예치', icon: '🔒', desc: '토큰/자산 예치로 이자·포인트·거버넌스 보상' },
  lp: { label: '유동성 공급(LP)', icon: '💧', desc: 'DEX 유동성 공급으로 수수료 + 인센티브' },
  launchpad: { label: '런치패드·청약', icon: '🚀', desc: 'IDO/런치풀/런치패드 청약으로 초기 물량 확보' },
  referral: { label: '레퍼럴(추천)', icon: '🔗', desc: '추천인 모집으로 보상 — 구조가 과하면 위험 신호' },
  play: { label: '게임 플레이(P2E)', icon: '🎮', desc: '게임 플레이로 토큰·아이템 획득' },
  hardware: { label: '장비·DePIN 채굴', icon: '📡', desc: '하드웨어 설치·데이터 제공으로 토큰 채굴' },
  other: { label: '기타', icon: '🧩', desc: '기타 참여 방식' },
};

// 키워드 규칙: [유형, 가중치, 정규식]
const TYPE_RULES = [
  ['node', 3, /\b(node|validator|operator|node sale|node licen[cs]e|sentry|guardian node|checker node)\b|노드/i],
  ['defi', 3, /\b(defi|decentralized finance|lending|borrow|dex|amm|yield|perp|perpetual|derivative|liquid staking|restaking|lst|lrt|vault|money market)\b|디파이|대출|탈중앙화 거래소/i],
  ['nft', 3, /\b(nft|non-fungible|collectible|pfp|mint)\b/i],
  ['gamefi', 3, /\b(game|gaming|gamefi|play-to-earn|p2e|metaverse|esports)\b|게임/i],
  ['meme', 4, /\b(meme|memecoin|dog-themed|cat-themed|frog|pump\.fun|community token)\b|밈/i],
  ['influencer', 2, /\b(kol|influencer|community-driven|community driven|ambassador|creator coin|fan token|celebrity|yap|kaito)\b|인플루언서|커뮤니티/i],
  ['infra', 3, /\b(layer[- ]?1|layer[- ]?2|l1|l2|rollup|zk|zero[- ]knowledge|modular|data availability|interoperability|bridge|blockchain protocol|smart contract platform|evm|oracle|sequencer)\b|레이어/i],
  ['ai', 3, /\b(ai|artificial intelligence|machine learning|llm|agent|agents|gpu|inference|compute)\b|인공지능/i],
  ['depin', 4, /\b(depin|physical infrastructure|wireless|hotspot|sensor|storage network|bandwidth|hardware)\b/i],
  ['rwa', 4, /\b(rwa|real[- ]world asset|tokenized (treasur|stock|asset|real estate)|treasury bills|real estate)\b|실물/i],
  ['socialfi', 3, /\b(socialfi|social[- ]fi|social network|social graph|creator economy)\b/i],
  ['airdrop', 3, /\b(points? program|points? system|airdrop|testnet|incentivi[sz]ed|season \d|quest|galxe|zealy|layer3)\b|에어드랍|테스트넷|포인트/i],
  ['launchpad', 3, /\b(launchpad|ido|ico|ieo|launchpool|presale|pre-sale|token sale)\b|청약|프리세일/i],
  ['exchange', 3, /\b(exchange token|centralized exchange|cex|wallet|exchange-based)\b|거래소/i],
  ['stable', 4, /\b(stablecoin|stable coin|payment|payments|pegged|usd-backed)\b|스테이블|결제/i],
  ['referral', 5, /\b(referral rewards? up to|multi-level|mlm|matrix|guaranteed (return|profit)|daily (return|roi|profit)|fixed (daily|monthly) (return|profit)|passive income guaranteed|ponzi)\b|다단계|원금 보장|확정 수익|일 수익/i],
];

// 코인게코 카테고리 → 유형
const CATEGORY_MAP = [
  [/meme/i, 'meme'],
  [/nft|collectible/i, 'nft'],
  [/gaming|game|metaverse|play to earn/i, 'gamefi'],
  [/decentralized finance|defi|lending|dex|derivative|yield|liquid staking|restaking|perpetual/i, 'defi'],
  [/layer 1|layer 2|layer-1|layer-2|smart contract platform|rollup|zero knowledge|modular|interoperability|oracle|infrastructure/i, 'infra'],
  [/artificial intelligence|\bai\b|ai agents/i, 'ai'],
  [/depin/i, 'depin'],
  [/real world assets|rwa|tokenized/i, 'rwa'],
  [/socialfi|social/i, 'socialfi'],
  [/launchpad/i, 'launchpad'],
  [/exchange-based|centralized exchange|wallet/i, 'exchange'],
  [/stablecoin|payment/i, 'stable'],
  [/fan token|celebrity|kol/i, 'influencer'],
  [/airdrop/i, 'airdrop'],
];

/**
 * 규칙 기반 분류.
 * @returns {{primary:string, types:{key,label,score,reasons[]}[]}}
 */
export function classifyProject({ name = '', description = '', categories = [], tags = [], hasContract, isListed, ageDays, hasRaises }) {
  const text = `${name}\n${description}`.slice(0, 6000);
  const score = {};
  const reasons = {};
  const add = (k, w, why) => {
    score[k] = (score[k] || 0) + w;
    (reasons[k] ||= []).push(why);
  };
  for (const c of [...categories, ...tags]) {
    for (const [re, k] of CATEGORY_MAP) if (re.test(c)) add(k, 5, `카테고리: ${c}`);
  }
  for (const [k, w, re] of TYPE_RULES) {
    const m = text.match(re);
    if (m) add(k, w, `설명 키워드: "${m[0]}"`);
  }
  // 상장 전 + 테스트넷/포인트 문구 → 에어드랍형 가중
  if (isListed === false) add('airdrop', 2, '미상장(TGE 전) 프로젝트');
  // 밈 + 투자 이력 없음 → 커뮤니티 유입형 가능성
  if (score.meme && !hasRaises) add('influencer', 2, '투자 유치 없이 커뮤니티로 성장하는 밈 구조');

  const types = Object.entries(score)
    .sort((a, b) => b[1] - a[1])
    .map(([key, s]) => ({ key, label: PROJECT_TYPES[key].label, score: s, reasons: [...new Set(reasons[key])].slice(0, 3) }));
  if (!types.length) types.push({ key: 'other', label: PROJECT_TYPES.other.label, score: 1, reasons: ['분류 근거 부족 — AI 분석 시 보강'] });
  return { primary: types[0].key, types: types.slice(0, 5) };
}

/**
 * 참여 수익 방식 분류. 유형·상장 상태·온체인 정보를 종합.
 * @returns {{key,label,fit:'high'|'mid'|'low',why}[]}
 */
export function classifyEarnMethods({ typeKeys = [], text = '', isListed, hasDex, hasTvl, stage }) {
  const has = (k) => typeKeys.includes(k);
  const t = text.toLowerCase();
  const out = new Map();
  const put = (key, fit, why) => {
    const cur = out.get(key);
    const rank = { high: 3, mid: 2, low: 1 };
    if (!cur || rank[fit] > rank[cur.fit]) out.set(key, { key, label: EARN_METHODS[key].label, icon: EARN_METHODS[key].icon, fit, why });
  };

  if (isListed || hasDex) put('token', stage === 'new' ? 'mid' : 'mid', isListed ? '거래소에서 매수 가능' : 'DEX에서 매수 가능');
  if (has('node') || /node sale|node licen|run a node|validator/.test(t)) put('node', 'high', '노드 판매·운영 구조 확인');
  if (has('infra') && !has('node')) put('node', 'low', '인프라 프로젝트 — 밸리데이터/노드 참여 여지');
  if (has('nft') || /\bmint\b|nft/.test(t)) put('nft', has('nft') ? 'high' : 'mid', 'NFT 발행/보유 혜택');
  if (has('airdrop') || stage === 'pre-tge' || /testnet|points|quest|season/.test(t)) put('activity', stage === 'pre-tge' ? 'high' : 'mid', stage === 'pre-tge' ? 'TGE 전 — 활동 기반 에어드랍 기대' : '포인트/퀘스트 프로그램');
  if (has('influencer') || has('meme') || has('socialfi') || /kaito|yap|ambassador|galxe|zealy/.test(t)) put('sns', has('influencer') || has('socialfi') ? 'high' : 'mid', 'SNS 활동·홍보 보상 구조');
  if (has('defi') || hasTvl || /stak/.test(t)) put('staking', has('defi') || hasTvl ? 'high' : 'mid', hasTvl ? 'TVL 존재 — 예치 상품 운영' : '스테이킹 언급');
  if ((has('defi') || hasDex) && hasDex) put('lp', has('defi') ? 'mid' : 'low', 'DEX 유동성 풀 존재');
  if (has('launchpad') || /launchpool|launchpad|ido|presale/.test(t)) put('launchpad', 'mid', '청약/런치풀 이벤트 이력');
  if (has('referral') || /referral|invite/.test(t)) put('referral', has('referral') ? 'low' : 'low', has('referral') ? '⚠ 추천 보상 의존 구조 — 다단계 주의' : '추천 보상 프로그램 존재');
  if (has('gamefi')) put('play', 'high', '게임 플레이 보상');
  if (has('depin')) put('hardware', 'high', '장비 설치/데이터 제공 보상');
  if (!out.size) put('other', 'low', '확인된 참여 경로 없음 — 공식 채널 확인 필요');
  const rank = { high: 0, mid: 1, low: 2 };
  return [...out.values()].sort((a, b) => rank[a.fit] - rank[b.fit]);
}
