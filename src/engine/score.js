// 신뢰도 / 가능성 점수 계산 (규칙 기반, 0~100)

export const TIER1_VCS = [
  'a16z', 'andreessen horowitz', 'paradigm', 'sequoia', 'coinbase ventures', 'binance labs', 'yzi labs', 'polychain',
  'pantera', 'multicoin', 'dragonfly', 'jump crypto', 'framework ventures', 'electric capital', 'galaxy', 'hashed',
  'animoca', 'okx ventures', 'delphi', 'spartan', 'placeholder', 'union square', 'usv', 'lightspeed', 'tiger global',
  'fenbushi', 'hack vc', 'variant', 'haun ventures', '1kx', 'robot ventures', 'founders fund', 'circle ventures',
  'blockchain capital', 'standard crypto', 'bain capital crypto', 'arrington', 'digital currency group', 'dcg',
  'wintermute', 'gsr', 'amber group', 'mechanism capital', 'nascent', 'ribbit', 'kakao', 'samsung next',
];

export function isTier1(name) {
  const n = (name || '').toLowerCase();
  return TIER1_VCS.some((v) => n.includes(v));
}

const clamp = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));

export function grade(score) {
  if (score >= 80) return { g: 'A', label: '매우 높음' };
  if (score >= 65) return { g: 'B', label: '양호' };
  if (score >= 50) return { g: 'C', label: '보통' };
  if (score >= 35) return { g: 'D', label: '주의' };
  return { g: 'F', label: '위험' };
}

/** 신뢰도 점수 */
export function trustScore(r) {
  const f = [];
  let s = 40;
  const add = (delta, label, note) => {
    s += delta;
    f.push({ delta, label, note });
  };
  const o = r.overview || {};
  // 1) 정보 투명성
  const links = ['website', 'whitepaper', 'github', 'twitter'].filter((k) => o[k]);
  add(links.length * 3, '정보 공개', `공식 링크 ${links.length}/4 (웹사이트·백서·깃허브·X)`);
  if (r.team?.length) add(Math.min(8, r.team.length * 2), '팀 공개', `공개된 팀원 ${r.team.length}명`);
  else add(-4, '팀 정보 없음', '팀 공개 여부 확인 필요');

  // 2) 투자자
  const inv = r.investors || {};
  if (inv.tier1?.length) add(Math.min(14, 6 + inv.tier1.length * 2), '티어1 투자사', inv.tier1.slice(0, 4).join(', '));
  else if (inv.all?.length) add(5, '투자 유치', `투자사 ${inv.all.length}곳`);
  else add(-3, '투자 이력 미확인', '공개된 투자 라운드 없음');

  // 3) 온체인 보안
  const sec = r.onchain?.security;
  if (sec) {
    if (sec.honeypot) add(-45, '허니팟 의심', '매도 불가 가능성 — 매우 위험');
    if (sec.mintable) add(-6, '추가 발행 가능', '소유자가 토큰을 더 찍어낼 수 있음');
    if (sec.ownerChangeBalance) add(-15, '잔고 조작 권한', '소유자가 잔고를 변경할 수 있음');
    if (sec.hiddenOwner) add(-10, '숨겨진 소유자', '');
    if (sec.blacklist) add(-4, '블랙리스트 기능', '특정 주소 거래 차단 가능');
    if (sec.pausable) add(-4, '거래 정지 기능', '');
    if ((sec.sellTax ?? 0) > 10 || (sec.buyTax ?? 0) > 10) add(-12, '높은 거래세', `매수 ${sec.buyTax}% / 매도 ${sec.sellTax}%`);
    if (sec.openSource === false) add(-8, '소스 비공개', '컨트랙트 미검증');
    if (sec.openSource && !sec.honeypot && !sec.ownerChangeBalance) add(6, '컨트랙트 검증', '오픈소스·주요 위험 플래그 없음');
    if (sec.trustList) add(5, 'GoPlus 신뢰 목록', '');
  }
  const top10 = r.onchain?.holders?.top10Pct;
  if (top10 != null) {
    if (top10 > 80) add(-10, '홀더 극단 집중', `상위 10개 지갑 ${top10.toFixed(1)}%`);
    else if (top10 > 60) add(-5, '홀더 집중', `상위 10개 지갑 ${top10.toFixed(1)}%`);
    else add(3, '홀더 분산', `상위 10개 지갑 ${top10.toFixed(1)}%`);
  }

  // 4) 시장/상장
  const ex = r.exchanges || {};
  const majors = ['binance', 'coinbase', 'okx', 'bybit', 'upbit'].filter((k) => ex.global?.[k]?.listed || ex.korea?.[k]?.listed);
  if (majors.length) add(Math.min(12, majors.length * 3), '메이저 거래소 상장', majors.join(', '));
  else if (ex.cexCount > 0) add(2, '중소 거래소 상장', `${ex.cexCount}곳`);
  if (ex.korea?.upbit?.warning) add(-10, '업비트 유의 종목', '투자 유의 지정');

  // 5) 개발·커뮤니티
  const dev = r.dev;
  if (dev?.commits4w > 20) add(5, '활발한 개발', `최근 4주 커밋 ${dev.commits4w}`);
  else if (dev?.commits4w === 0) add(-3, '개발 정체', '최근 4주 커밋 없음');
  if (r.market?.ageDays != null && r.market.ageDays > 365) add(4, '운영 기간', `${Math.round(r.market.ageDays / 30)}개월`);
  if (r.llama?.hacks?.length) add(-10, '해킹 이력', `${r.llama.hacks.length}건`);

  // 6) 분류 위험
  if (r.classification?.types?.some((t) => t.key === 'referral')) add(-20, '다단계 의심 구조', '추천·확정수익 문구 감지');

  // AI 보정
  if (r.ai?.trust?.adjust) add(clamp(r.ai.trust.adjust, -15, 15), 'AI 웹 조사 보정', r.ai.trust.note || '');

  const score = Math.round(clamp(s));
  return { score, ...grade(score), factors: f };
}

/** 가능성(성장 잠재력) 점수 */
export function potentialScore(r) {
  const f = [];
  let s = 45;
  const add = (delta, label, note) => {
    s += delta;
    f.push({ delta, label, note });
  };
  const m = r.market || {};
  const hot = { ai: 8, depin: 7, rwa: 7, infra: 4, defi: 3, socialfi: 4, gamefi: 1, meme: 2, node: 4, airdrop: 3 };
  const pt = r.classification?.primary;
  if (hot[pt]) add(hot[pt], '내러티브', `${r.classification.types[0].label} 섹터`);

  if (m.mcap) {
    if (m.mcap < 50e6) add(10, '소형 시총', '상승 여력 크지만 변동성 높음');
    else if (m.mcap < 300e6) add(6, '중소형 시총', '');
    else if (m.mcap > 5e9) add(-6, '대형 시총', '배수 상승 여력 제한');
  } else if (r.stage === 'pre-tge') add(8, 'TGE 전', '초기 참여 기회(에어드랍·포인트)');

  if (m.fdv && m.mcap) {
    const ratio = m.fdv / m.mcap;
    if (ratio > 5) add(-10, '대규모 미유통 물량', `FDV/시총 ${ratio.toFixed(1)}배 — 언락 매도압력`);
    else if (ratio > 2.5) add(-5, '미유통 물량', `FDV/시총 ${ratio.toFixed(1)}배`);
    else add(4, '유통 비율 양호', `FDV/시총 ${ratio.toFixed(1)}배`);
  }
  const inv = r.investors || {};
  if (inv.totalRaised > 50) add(8, '대규모 투자 유치', `$${inv.totalRaised.toFixed(0)}M`);
  else if (inv.totalRaised > 10) add(5, '투자 유치', `$${inv.totalRaised.toFixed(1)}M`);
  if (inv.tier1?.length) add(5, '티어1 백업', '상장·마케팅 지원 기대');

  const ex = r.exchanges || {};
  const big = ['binance', 'coinbase', 'upbit'];
  const notYet = big.filter((k) => (ex.global?.[k] || ex.korea?.[k])?.listed === false);
  if (notYet.length && (ex.cexCount || 0) > 0) add(Math.min(9, notYet.length * 3), '추가 상장 여지', `미상장: ${notYet.join(', ')}`);

  const vol = m.volume24h && m.mcap ? m.volume24h / m.mcap : null;
  if (vol != null) {
    if (vol > 0.3) add(4, '높은 거래 활동', `거래량/시총 ${(vol * 100).toFixed(0)}%`);
    else if (vol < 0.01) add(-5, '거래 침체', `거래량/시총 ${(vol * 100).toFixed(1)}%`);
  }
  if (m.athChange != null && m.athChange < -85) add(-6, 'ATH 대비 급락', `${m.athChange.toFixed(0)}%`);
  if (r.onchain?.tvl?.change30d > 20) add(5, 'TVL 성장', `30일 +${r.onchain.tvl.change30d.toFixed(0)}%`);
  if (r.onchain?.tvl?.change30d < -30) add(-5, 'TVL 이탈', `30일 ${r.onchain.tvl.change30d.toFixed(0)}%`);
  if ((r.scoresTrustRaw ?? 50) < 35) add(-10, '낮은 신뢰도', '신뢰도가 낮으면 잠재력도 할인');

  if (r.ai?.potential?.adjust) add(clamp(r.ai.potential.adjust, -15, 15), 'AI 웹 조사 보정', r.ai.potential.note || '');
  const score = Math.round(clamp(s));
  return { score, ...grade(score), factors: f };
}
