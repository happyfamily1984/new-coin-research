// 일반 투자자 참여 전략 & 리스크 생성
import { EARN_METHODS } from './taxonomy.js';

const fmtUsd = (v) => (v >= 1e9 ? `$${(v / 1e9).toFixed(2)}B` : v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : `$${Math.round(v).toLocaleString()}`);

/** 수익 방식별 전략 템플릿 */
function templates(r) {
  const name = r.name;
  const sym = r.symbol?.toUpperCase() || '';
  const ex = r.exchanges || {};
  const listedK = ex.korea?.upbit?.listed || ex.korea?.bithumb?.listed;
  const where = listedK ? '업비트/빗썸' : ex.global?.binance?.listed ? '바이낸스' : ex.cexCount ? (ex.list?.[0]?.name || '해외 거래소') : 'DEX';
  const fdvRatio = r.market?.fdv && r.market?.mcap ? r.market.fdv / r.market.mcap : null;
  const site = r.overview?.website || '공식 웹사이트';

  return {
    token: {
      title: `${sym || name} 분할 매수 & 목표가 분할 매도`,
      difficulty: '쉬움', capital: '소액~중액', period: '수주~수개월', risk: r.scores?.trust?.score < 50 ? '높음' : '중간',
      steps: [
        `${where}에서 ${sym} 거래 가능 여부·유동성을 먼저 확인`,
        '투자금을 3~5회로 나눠 하락 시 분할 매수(한 번에 몰빵 금지)',
        fdvRatio > 2.5 ? `미유통 물량이 많음(FDV/시총 ${fdvRatio.toFixed(1)}배) → 토큰 언락 일정 직전엔 매수 보류` : '언락 일정·대형 이벤트(상장/메인넷) 일정 체크',
        '목표 수익률(예: +30%, +60%, +100%)마다 1/3씩 익절, 손절선(-25~30%) 미리 정하기',
      ],
      cautions: ['신규 상장 직후 급등락 구간 추격매수 주의', 'DEX 매수 시 컨트랙트 주소는 반드시 공식 채널에서 복사'],
    },
    node: {
      title: '노드 라이선스 구매·운영',
      difficulty: '보통', capital: '중액~고액', period: '6개월~수년', risk: '높음',
      steps: [
        `${site}에서 노드 판매(티어별 가격·총 수량·보상 비율) 공식 문서 확인`,
        '노드 1개당 보상(토큰/일) × 예상 토큰 가격으로 회수 기간(원금 회수) 계산',
        '노드 라이선스 양도 가능 여부·락업·보상 베스팅 조건 확인',
        '클라우드/VPS 위임 운영 가능 여부 확인(직접 운영 시 서버 비용 계산)',
      ],
      cautions: ['노드 판매 대금이 프로젝트 주 수익원이면 폰지형 구조 의심', '토큰 가격 하락 시 회수 기간이 기하급수로 늘어남', '추천인 할인/수당이 크면 다단계 주의'],
    },
    nft: {
      title: 'NFT 민팅·보유 혜택 활용',
      difficulty: '보통', capital: '소액~중액', period: '수주~수개월', risk: '높음',
      steps: ['공식 X/디스코드에서 민팅 일정·화이트리스트(WL) 조건 확인', 'WL 확보 후 민팅가로 참여(퍼블릭 프리미엄 추격 지양)', 'NFT 보유자 대상 에어드랍·스테이킹·포인트 부스트 혜택 확인', '바닥가(Floor)·거래량 추이를 보고 일부 매도로 원금 회수'],
      cautions: ['가짜 민팅 사이트·DM 링크 피싱 주의', '유동성이 낮아 원하는 가격에 못 팔 수 있음'],
    },
    activity: {
      title: '테스트넷·포인트 파밍으로 에어드랍 받기',
      difficulty: '쉬움', capital: '무자본~소액(가스비)', period: '1~6개월', risk: '낮음',
      steps: [
        '전용 지갑(메인 자산과 분리) 생성 후 공식 앱/테스트넷 연결',
        'Faucet으로 테스트 토큰 받기 → 스왑·브릿지·스테이킹 등 핵심 기능 골고루 사용',
        '포인트 대시보드·시즌 공지 확인, 주 2~3회 꾸준히 활동(일회성보다 지속성이 유리)',
        'Galxe/Zealy/Layer3 등 퀘스트 완료, 디스코드 역할(OG, Contributor) 획득',
        'TGE 시 에어드랍 수령 → 상장 초기 일부 매도로 수익 확정',
      ],
      cautions: ['시빌(다계정) 판정 시 전부 제외될 수 있음', '지갑 연결 승인(Approve) 범위 확인, 정기적으로 권한 해제(revoke)'],
    },
    sns: {
      title: 'SNS 참여·홍보(야핑·앰배서더)로 보상 받기',
      difficulty: '보통', capital: '무자본', period: '1~6개월', risk: '낮음',
      steps: ['공식 X 팔로우·알림 설정, 디스코드/텔레그램 가입', '프로젝트 분석 스레드·한국어 요약 콘텐츠 꾸준히 작성(Kaito 등 마인드쉐어 지표 반영)', '앰배서더/크리에이터 프로그램 지원(포트폴리오: 작성한 콘텐츠 링크)', '커뮤니티 이벤트(AMA, 밈 콘테스트) 참여로 역할·WL 확보'],
      cautions: ['과장·허위 홍보는 법적 문제 소지', '보상 조건이 모집 인원 기반이면 다단계형 주의'],
    },
    staking: {
      title: '스테이킹·예치로 이자 + 포인트 이중 수익',
      difficulty: '쉬움', capital: '소액~고액', period: '1개월~', risk: '중간',
      steps: [
        r.onchain?.tvl?.current ? `현재 TVL ${fmtUsd(r.onchain.tvl.current)} — 예치 상품 APR과 출처(실수익 vs 토큰 인플레이션) 확인` : '예치 상품 APR이 실수익(수수료)인지 신규 토큰 발행인지 확인',
        '언스테이킹 대기 기간(락업)·조기 해지 페널티 확인',
        '감사(Audit) 보고서·보험 여부 확인 후 소액부터 예치',
        '포인트 부스트 기간(초기 예치 보너스) 활용',
      ],
      cautions: ['스마트컨트랙트 해킹 위험', '고APR은 토큰 가격 하락으로 상쇄될 수 있음'],
    },
    lp: {
      title: 'DEX 유동성 공급(LP)으로 수수료 수익',
      difficulty: '어려움', capital: '중액', period: '수주~수개월', risk: '높음',
      steps: ['거래량/유동성 비율이 높은 풀 선택(수수료 수익↑)', '비영구적 손실(IL) 계산기로 가격 변동 시 손실 시뮬레이션', '인센티브(파밍 보상) 기간과 보상 토큰 매도압력 확인', '집중 유동성(v3) 사용 시 가격 범위 주기적 재설정'],
      cautions: ['한쪽 토큰 급락 시 큰 비영구적 손실', '러그풀(유동성 제거) 위험 — LP 락 여부 확인'],
    },
    launchpad: {
      title: '런치패드·런치풀·청약 참여',
      difficulty: '쉬움', capital: '소액~중액', period: '1~2주', risk: '중간',
      steps: ['바이낸스 런치풀/메가드랍, OKX 점프스타트, 바이비트 런치패드 공지 확인', '요구 예치 자산(BNB, USDT 등) 미리 준비', '청약 물량 배분 후 상장 직후 시장 상황 보고 분할 매도', '공식 IDO는 KYC·화이트리스트 마감일 체크'],
      cautions: ['비공식 "프리세일" 사칭 사이트 다수', '상장가가 청약가보다 낮게 시작할 수도 있음'],
    },
    referral: {
      title: '레퍼럴 프로그램(주의 필요)',
      difficulty: '쉬움', capital: '무자본', period: '-', risk: '매우 높음',
      steps: ['추천 보상이 "거래 수수료 분배" 등 실수익 기반인지 확인', '하위 모집 인원 수에 따라 수익이 커지는 구조면 참여 금지', '본인 원금이 필요하면 원금 손실 각오 가능한 금액만'],
      cautions: ['확정 수익·원금 보장·모집 수당 = 유사수신/다단계 신호', '지인 권유로 인한 법적·관계 리스크'],
    },
    play: {
      title: '게임 플레이로 토큰 획득(P2E)',
      difficulty: '보통', capital: '무자본~중액', period: '1~3개월', risk: '중간',
      steps: ['무료 플레이 가능 여부·초기 비용(캐릭터/NFT) 확인', '보상 토큰의 일일 발행량과 소각(사용처) 구조 확인', '시즌 초반에 참여해 랭킹/에어드랍 보상 확보', '획득 토큰은 주기적으로 일부 현금화'],
      cautions: ['게임 내 토큰은 인플레이션으로 가치가 빠르게 하락하는 경우 많음'],
    },
    hardware: {
      title: 'DePIN 장비 설치·채굴',
      difficulty: '보통', capital: '중액', period: '6개월~', risk: '중간',
      steps: ['장비 가격·배송·설치 조건(지역 커버리지) 확인', '지역별 보상 맵으로 예상 채굴량 계산', '전기료·인터넷 비용 포함한 회수 기간 계산', '중고 장비 재판매 가능성 확인'],
      cautions: ['보상 감소(반감기)·토큰 가격 하락 시 회수 불가', '비공식 리셀러 사기 주의'],
    },
    other: {
      title: '공식 채널 모니터링 후 진입 시점 대기',
      difficulty: '쉬움', capital: '-', period: '-', risk: '낮음',
      steps: ['공식 X·디스코드·블로그 알림 설정', 'AI 심층 분석(설정에서 키 등록)으로 최신 참여 기회 조사', '테스트넷/포인트/청약 공지가 나오면 이 앱에서 [업데이트]'],
      cautions: ['정보가 부족한 프로젝트는 투자 보류가 최선일 수 있음'],
    },
  };
}

export function buildStrategies(r) {
  const tpl = templates(r);
  const methods = r.earnMethods || [];
  const list = methods.map((m, i) => ({
    method: m.key,
    methodLabel: EARN_METHODS[m.key].label,
    fit: m.fit,
    why: m.why,
    ...tpl[m.key],
    rank: i + 1,
  }));
  // AI 제안 전략을 앞에 병합
  const ai = (r.ai?.strategies || []).map((s) => ({ ...s, fromAi: true, method: s.method in EARN_METHODS ? s.method : 'other', methodLabel: EARN_METHODS[s.method]?.label || '기타' }));
  return [...ai, ...list];
}

export function buildRisks(r) {
  const out = [];
  const push = (level, text) => out.push({ level, text });
  const sec = r.onchain?.security;
  if (sec?.honeypot) push('high', '허니팟 의심: 매수 후 매도가 막힐 수 있습니다.');
  if (sec?.mintable) push('mid', '소유자가 토큰을 추가 발행할 수 있습니다.');
  if (sec?.ownerChangeBalance) push('high', '소유자가 지갑 잔고를 변경할 수 있는 권한이 있습니다.');
  if ((sec?.sellTax ?? 0) > 5) push('mid', `매도세 ${sec.sellTax}% — 실제 수익이 줄어듭니다.`);
  const top10 = r.onchain?.holders?.top10Pct;
  if (top10 > 60) push(top10 > 80 ? 'high' : 'mid', `상위 10개 지갑이 ${top10.toFixed(1)}% 보유 — 대량 매도(덤핑) 위험.`);
  const m = r.market || {};
  if (m.fdv && m.mcap && m.fdv / m.mcap > 2.5) push('mid', `미유통 물량이 시총의 ${(m.fdv / m.mcap).toFixed(1)}배 — 토큰 언락 시 매도 압력.`);
  if (r.exchanges?.korea?.upbit?.warning) push('high', '업비트 투자유의 종목으로 지정되어 있습니다.');
  if (r.exchanges?.korea?.upbit?.caution?.length) push('mid', `업비트 주의 신호: ${r.exchanges.korea.upbit.caution.map(cautionKo).join(', ')}`);
  if (r.classification?.types?.some((t) => t.key === 'referral')) push('high', '추천/확정수익 구조 문구 감지 — 다단계·유사수신 여부를 반드시 확인하세요.');
  if (r.classification?.primary === 'meme') push('mid', '밈코인은 펀더멘털 없이 커뮤니티 심리로 움직여 변동성이 극단적입니다.');
  if (r.llama?.hacks?.length) push('high', `과거 해킹 이력 ${r.llama.hacks.length}건이 있습니다.`);
  if (!r.overview?.website) push('mid', '공식 웹사이트를 확인하지 못했습니다.');
  if (r.stage === 'pre-tge') push('low', '토큰 미발행(TGE 전) — 에어드랍 조건은 언제든 바뀔 수 있습니다.');
  for (const t of r.ai?.risks || []) push(t.level || 'mid', t.text || String(t));
  if (!out.length) push('low', '자동 점검에서 큰 위험 신호는 발견되지 않았습니다. 그래도 소액·분산 원칙을 지키세요.');
  return out;
}

export function cautionKo(k) {
  return (
    {
      PRICE_FLUCTUATIONS: '가격 급등락',
      TRADING_VOLUME_SOARING: '거래량 급등',
      DEPOSIT_AMOUNT_SOARING: '입금량 급등',
      GLOBAL_PRICE_DIFFERENCES: '해외 가격 괴리',
      CONCENTRATION_OF_SMALL_ACCOUNTS: '소수 계정 집중',
    }[k] || k
  );
}
