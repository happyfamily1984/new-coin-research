// 코인 용어 한국어 사전 — 기계번역 오역(예: Avalanche → 눈사태)을 막기 위해 먼저 적용

const CHAINS = {
  ethereum: '이더리움', 'bnb chain': 'BNB 체인', bnb: 'BNB', 'binance smart chain': 'BNB 체인', avalanche: '아발란체', solana: '솔라나',
  arbitrum: '아비트럼', 'arbitrum one': '아비트럼', base: '베이스', polygon: '폴리곤', 'polygon pos': '폴리곤', optimism: '옵티미즘', sui: '수이',
  aptos: '앱토스', ton: '톤', 'the open network': '톤', tron: '트론', cosmos: '코스모스', berachain: '베라체인', sonic: '소닉',
  hyperliquid: '하이퍼리퀴드', blast: '블라스트', linea: '리니아', zksync: 'zkSync', mantle: '맨틀', fantom: '팬텀', near: '니어',
  'near protocol': '니어', cardano: '카르다노', polkadot: '폴카닷', bitcoin: '비트코인', starknet: '스타크넷', scroll: '스크롤',
  cronos: '크로노스', kaia: '카이아', klaytn: '클레이튼', injective: '인젝티브', osmosis: '오스모시스', algorand: '알고랜드',
  hedera: '헤데라', stellar: '스텔라', xrp: 'XRP', 'xrp ledger': 'XRP 레저', bittensor: '비트텐서', monad: '모나드', abstract: '앱스트랙트',
};

const CATEGORIES = {
  meme: '밈', memes: '밈', 'meme token': '밈 토큰', cryptocurrency: '암호화폐', token: '토큰', coin: '코인',
  'layer 1 (l1)': '레이어1(L1)', 'layer 2 (l2)': '레이어2(L2)', 'layer 0 (l0)': '레이어0(L0)', 'layer 3 (l3)': '레이어3(L3)',
  'layer 1': '레이어1', 'layer 2': '레이어2', 'smart contract platform': '스마트 컨트랙트 플랫폼',
  'decentralized finance (defi)': '디파이(탈중앙 금융)', defi: '디파이', 'artificial intelligence (ai)': '인공지능(AI)',
  'artificial intelligence': '인공지능(AI)', ai: 'AI', 'ai agents': 'AI 에이전트', 'ai applications': 'AI 앱', 'ai framework': 'AI 프레임워크',
  infrastructure: '인프라', depin: '디핀(DePIN)', 'decentralized physical infrastructure network (depin)': '디핀(DePIN)',
  'gaming (gamefi)': '게임파이', gaming: '게임', gamefi: '게임파이', 'play to earn': 'P2E(플레이투언)', metaverse: '메타버스',
  'non-fungible tokens (nft)': 'NFT', nft: 'NFT', 'nft marketplace': 'NFT 마켓', collectibles: '컬렉터블',
  'real world assets (rwa)': '실물자산(RWA)', rwa: '실물자산(RWA)', 'tokenized assets': '토큰화 자산',
  'decentralized exchange (dex)': '탈중앙 거래소(DEX)', dex: 'DEX', 'automated market maker (amm)': 'AMM(자동 마켓메이커)',
  'centralized exchange (cex)': '중앙화 거래소', 'exchange-based tokens': '거래소 토큰', 'exchange-based token': '거래소 토큰',
  launchpad: '런치패드', stablecoins: '스테이블코인', stablecoin: '스테이블코인', 'liquid staking': '리퀴드 스테이킹',
  'liquid staking tokens': '리퀴드 스테이킹 토큰', restaking: '리스테이킹', 'liquid restaking tokens': '리퀴드 리스테이킹 토큰',
  perpetuals: '무기한 선물', derivatives: '파생상품', 'lending/borrowing': '대출(렌딩)', lending: '대출(렌딩)', 'yield farming': '일드 파밍',
  'yield aggregator': '수익 최적화', oracle: '오라클', interoperability: '상호운용성', 'cross-chain communication': '크로스체인',
  bridge: '브릿지', 'bridged tokens': '브릿지 토큰', 'zero knowledge (zk)': '영지식(ZK)', 'zero knowledge': '영지식(ZK)', privacy: '프라이버시',
  'privacy coins': '프라이버시 코인', governance: '거버넌스', socialfi: '소셜파이', 'social money': '소셜 머니', storage: '스토리지',
  'distributed computing': '분산 컴퓨팅', payment: '결제', payments: '결제', 'payment solutions': '결제 솔루션', wallets: '지갑', wallet: '지갑',
  data: '데이터', modular: '모듈러', 'modular blockchain': '모듈러 블록체인', rollup: '롤업', rollups: '롤업', 'proof of work (pow)': '작업증명(PoW)',
  'proof of stake (pos)': '지분증명(PoS)', 'frog-themed': '개구리 테마', 'dog-themed': '강아지 테마', 'cat-themed': '고양이 테마',
  'frog-themed coins': '개구리 테마 코인', 'dog-themed coins': '강아지 테마 코인', 'cat-themed coins': '고양이 테마 코인',
  'politifi': '정치 밈(PolitiFi)', 'celebrity-themed coins': '셀럽 테마 코인', 'fan token': '팬 토큰', 'sports': '스포츠',
  'eth 2.0 staking': '이더리움 스테이킹', 'staking pool': '스테이킹 풀', 'masternodes': '마스터노드', 'rebase tokens': '리베이스 토큰',
  'decentralized science (desci)': '탈중앙 과학(DeSci)', 'tokenized gold': '금 토큰', 'tokenized treasury bills (t-bills)': '토큰화 국채',
  'gpu': 'GPU', 'cloud computing': '클라우드 컴퓨팅', 'telegram apps': '텔레그램 앱', 'tap to earn': '탭투언(Tap-to-Earn)',
  'move to earn': '무브투언', 'analytics': '분석', 'insurance': '보험', 'lending': '대출', 'options': '옵션', 'prediction markets': '예측 시장',
};

const ROUNDS = {
  seed: '시드', 'pre-seed': '프리시드', 'pre seed': '프리시드', angel: '엔젤', strategic: '전략적 투자', private: '프라이빗',
  'private sale': '프라이빗 세일', 'private token sale': '프라이빗 토큰 세일', 'public sale': '퍼블릭 세일', 'token sale': '토큰 세일',
  undisclosed: '비공개 라운드', 'pre-series a': '프리 시리즈 A', 'pre-series b': '프리 시리즈 B', 'series a': '시리즈 A', 'series b': '시리즈 B',
  'series c': '시리즈 C', 'series d': '시리즈 D', ico: 'ICO', ido: 'IDO', ieo: 'IEO', 'grant': '보조금(그랜트)', 'acquisition': '인수',
  'extended seed': '시드 확장', 'seed+': '시드+', 'community sale': '커뮤니티 세일', 'node sale': '노드 세일',
};

const KEYWORDS = {
  node: '노드', validator: '밸리데이터', operator: '운영자', defi: '디파이', lending: '대출', borrow: '대출', dex: 'DEX', amm: 'AMM', yield: '이자 수익',
  perp: '무기한 선물', perpetual: '무기한 선물', derivative: '파생상품', 'liquid staking': '리퀴드 스테이킹', restaking: '리스테이킹', vault: '볼트',
  nft: 'NFT', collectible: '수집품', mint: '민팅', game: '게임', gaming: '게임', metaverse: '메타버스', meme: '밈', memecoin: '밈코인',
  'community-driven': '커뮤니티 주도', 'community driven': '커뮤니티 주도', influencer: '인플루언서', ambassador: '앰배서더', kol: 'KOL',
  'layer 1': '레이어1', 'layer 2': '레이어2', rollup: '롤업', zk: '영지식', bridge: '브릿지', evm: 'EVM', oracle: '오라클', ai: 'AI',
  'artificial intelligence': '인공지능', agent: 'AI 에이전트', agents: 'AI 에이전트', gpu: 'GPU', compute: '컴퓨팅', inference: 'AI 추론',
  depin: '디핀', hardware: '하드웨어', wireless: '무선망', storage: '스토리지', rwa: 'RWA', 'real estate': '부동산', stablecoin: '스테이블코인',
  payment: '결제', payments: '결제', airdrop: '에어드랍', testnet: '테스트넷', points: '포인트', quest: '퀘스트', launchpad: '런치패드',
  ido: 'IDO', presale: '프리세일', 'token sale': '토큰 세일', wallet: '지갑', exchange: '거래소',
};

const lc = (s) => String(s || '').trim().toLowerCase();
const chainKo = (name) => CHAINS[lc(name)] || name;

/** 카테고리 → 한국어 (모르면 null → 기계번역) */
export function koCategory(c) {
  const k = lc(c);
  if (CATEGORIES[k]) return CATEGORIES[k];
  if (CHAINS[k]) return CHAINS[k];
  let m = c.match(/^(.+?) Ecosystem$/i);
  if (m) return `${chainKo(m[1])} 생태계`;
  m = c.match(/^(.+?) Portfolio$/i);
  if (m) return `${m[1]} 투자 포트폴리오`;
  m = c.match(/^(.+?) Launchpad$/i);
  if (m) return `${m[1]} 런치패드`;
  if (/index$/i.test(c)) return c.replace(/index$/i, '지수').trim();
  return null;
}
export const koRound = (r) => ROUNDS[lc(r)] || null;
export const koKeyword = (w) => KEYWORDS[lc(w)] || null;

/** 번역 전 체인 이름을 한국어로 바꿔 오역 방지 (예: Avalanche → 아발란체) */
export function protectTerms(text) {
  let t = text;
  for (const [en, ko] of Object.entries(CHAINS)) {
    if (en.length < 4 || en === 'base' || en === 'near' || en === 'sonic' || en === 'scroll' || en === 'blast' || en === 'abstract') continue; // 일반 단어와 겹치는 이름 제외
    const re = new RegExp(`\\b${en.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    t = t.replace(re, ko);
  }
  return t;
}
