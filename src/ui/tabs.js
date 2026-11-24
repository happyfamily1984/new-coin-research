import * as store from '../store.js';
import { PROJECT_TYPES, EARN_METHODS } from '../engine/taxonomy.js';
import { cautionKo } from '../engine/strategy.js';
import { esc, usd, num, pct, cls, sparkline, icon, short } from '../util.js';

export const typeTag = (k) => {
  const t = PROJECT_TYPES[k];
  return t ? `<span class="tag type" style="--c:${t.color}">${t.icon} ${esc(t.short || t.label)}</span>` : '';
};
export const stageTag = (s) => ({ 'pre-tge': '<span class="tag stage-pre-tge">TGE 전</span>', new: '<span class="tag stage-new">신규 상장</span>', listed: '<span class="tag">상장</span>' })[s] || '';
export const stars = (n) => '★'.repeat(n || 0) + '☆'.repeat(5 - (n || 0));

export function tabEarn(p) {
  const prog = p.progress || {};
  const strats = p.strategies || [];
  return `
  <div class="sec"><h3>💡 일반인 참여 수익 방식</h3>
    <div class="chips" style="padding:0;flex-wrap:wrap">${(p.earnMethods || []).map((m) => `<span class="chip on">${EARN_METHODS[m.key].icon} ${esc(m.label)} · ${{ high: '추천', mid: '가능', low: '제한적' }[m.fit]}</span>`).join('')}</div>
    <p class="muted" style="font-size:13px;margin-top:10px">단계를 눌러 내 진행 상황을 체크할 수 있어요. 체크는 저장됩니다.</p>
  </div>
  <div class="sec"><h3>참여 전략 <span class="muted">${strats.length}개</span></h3>
  ${strats.map((s, si) => {
    const done = (s.steps || []).filter((_, i) => prog[`${s.method}-${i}`]).length;
    return `<div class="strat">
      <h4>${EARN_METHODS[s.method]?.icon || '🧩'} ${esc(s.title)} ${s.fromAi ? '<span class="pill-ai">AI</span>' : ''}</h4>
      <div class="meta"><span class="tag">${esc(s.methodLabel)}</span><span class="tag">난이도 ${esc(s.difficulty || '-')}</span><span class="tag">자본 ${esc(s.capital || '-')}</span><span class="tag">기간 ${esc(s.period || '-')}</span><span class="tag ${/높음/.test(s.risk) ? 'bad' : /중간/.test(s.risk) ? 'warn' : 'good'}">위험 ${esc(s.risk || '-')}</span></div>
      ${s.why ? `<div class="muted" style="font-size:13px;margin-bottom:6px">근거: ${esc(s.why)}</div>` : ''}
      ${s.expected ? `<div style="font-size:13.5px;margin-bottom:6px">🎯 ${esc(s.expected)}</div>` : ''}
      <ol class="steps">${(s.steps || []).map((st, i) => `<li class="${prog[`${s.method}-${i}`] ? 'done' : ''}" data-act="step" data-k="${esc(s.method)}-${i}">${esc(st)}</li>`).join('')}</ol>
      ${s.steps?.length ? `<div class="muted" style="font-size:12px;margin-top:4px">진행 ${done}/${s.steps.length}</div>` : ''}
      ${(s.cautions || []).length ? `<div class="caution">⚠ ${s.cautions.map(esc).join('<br>⚠ ')}</div>` : ''}
    </div>`;
  }).join('')}</div>
  <div class="sec"><h3>🧮 수익 계산기</h3>
    <p class="muted" style="font-size:13.5px">노드 회수 기간, 목표가 수익, 에어드랍 기대값을 계산해 보세요.</p>
    <button class="btn sm block" data-act="calc">계산기 열기</button>
  </div>`;
}

export function tabInvest(p) {
  const inv = p.investors || {};
  return `
  <div class="sec"><h3>투자 요약</h3><div class="kv">
    <div><span>총 유치 금액</span><b>${inv.totalRaised ? `$${inv.totalRaised.toFixed(1)}M` : '미확인'}</b></div>
    <div><span>라운드 수</span><b>${inv.raises?.length || 0}</b></div>
    <div><span>투자사 수</span><b>${inv.all?.length || 0}</b></div>
    <div><span>티어1 투자사</span><b>${inv.tier1?.length || 0}</b></div>
  </div>
  ${inv.tier1?.length ? `<div style="margin-top:12px"><div class="muted" style="font-size:12.5px;margin-bottom:6px">⭐ 티어1 투자사</div><div class="pmeta">${inv.tier1.map((x) => `<span class="tag good">${esc(x)}</span>`).join('')}</div></div>` : ''}
  </div>
  <div class="sec"><h3>펀딩 라운드</h3>
  ${(inv.raises || []).map((r) => `<div class="row"><div class="grow"><div class="t">${esc(r.round)} ${r.ai ? '<span class="pill-ai">AI</span>' : ''}</div>
    <div class="s">${esc(r.date || '날짜 미상')}${r.valuation ? ` · 밸류 $${r.valuation}M` : ''}</div>
    ${r.lead?.length ? `<div class="s">리드: <b style="color:var(--txt)">${r.lead.map(esc).join(', ')}</b></div>` : ''}
    ${r.others?.length ? `<div class="s">참여: ${r.others.slice(0, 12).map(esc).join(', ')}${r.others.length > 12 ? ` 외 ${r.others.length - 12}` : ''}</div>` : ''}
    </div><b>${r.amount ? `$${r.amount}M` : '-'}</b></div>`).join('') || '<p class="muted">공개된 펀딩 라운드를 찾지 못했습니다. 투자 이력이 없는 커뮤니티 주도형이거나 비공개일 수 있습니다.</p>'}
  </div>
  ${p.ai?.tokenomics ? `<div class="sec"><h3>토크노믹스 <span class="pill-ai">AI</span></h3>
    <div class="kv"><div><span>총 공급량</span><b>${esc(p.ai.tokenomics.totalSupply || '미확인')}</b></div><div><span>TGE</span><b>${esc(p.ai.tokenomics.tge || '미확인')}</b></div></div>
    ${(p.ai.tokenomics.allocation || []).map((a) => `<div style="margin-top:10px"><div style="display:flex;justify-content:space-between;font-size:13.5px"><span>${esc(a.label)}</span><b>${a.pct ?? '-'}%</b></div><div class="bar"><i style="width:${Math.min(100, +a.pct || 0)}%"></i></div></div>`).join('')}
  </div>` : ''}`;
}

export function tabOnchain(p) {
  const oc = p.onchain || {};
  const sec = oc.security;
  const flag = (bad, label, okLabel) => `<div class="row"><div class="grow t">${label}</div><span class="tag ${bad == null ? '' : bad ? 'bad' : 'good'}">${bad == null ? '확인불가' : bad ? '위험' : okLabel || '안전'}</span></div>`;
  return `
  <div class="sec"><h3>${icon.shield} 컨트랙트</h3>
    ${(oc.contracts || []).slice(0, 6).map((c) => `<div class="row"><div class="grow"><div class="t">${esc(c.chain)}</div><div class="s">${esc(short(c.address))}</div></div><button class="btn sm ghost" data-act="copy" data-v="${esc(c.address)}">${icon.copy} 복사</button></div>`).join('') || '<p class="muted">등록된 토큰 컨트랙트가 없습니다(자체 메인넷 코인이거나 토큰 미발행).</p>'}
    <p class="muted" style="font-size:12.5px;margin-top:6px">DEX 매수 시 반드시 이 주소(공식 데이터 기준)와 일치하는지 확인하세요. 같은 이름의 가짜 토큰이 많습니다.</p>
  </div>
  ${sec ? `<div class="sec"><h3>토큰 보안 점검 <span class="muted">GoPlus · ${esc(sec.chain)}</span></h3>
    ${flag(sec.honeypot, '허니팟(매도 불가)')}
    ${flag(sec.mintable, '추가 발행 권한', '없음')}
    ${flag(sec.ownerChangeBalance, '소유자 잔고 변경 권한', '없음')}
    ${sec.hiddenOwner != null ? flag(sec.hiddenOwner, '숨겨진 소유자', '없음') : ''}
    ${sec.blacklist != null ? flag(sec.blacklist, '블랙리스트 기능', '없음') : ''}
    ${sec.pausable != null ? flag(sec.pausable, '거래 정지 기능', '없음') : ''}
    ${sec.proxy != null ? flag(sec.proxy, '업그레이드 가능(프록시)', '아님') : ''}
    ${sec.openSource != null ? flag(!sec.openSource, '소스코드 검증', '검증됨') : ''}
    ${sec.buyTax != null ? `<div class="row"><div class="grow t">매수세 / 매도세</div><b>${sec.buyTax}% / ${sec.sellTax}%</b></div>` : ''}
    ${sec.lpLockedPct ? `<div class="row"><div class="grow t">LP 잠금 비율</div><b>${sec.lpLockedPct.toFixed(1)}%</b></div>` : ''}
  </div>` : ''}
  ${oc.holders ? `<div class="sec"><h3>홀더 분포</h3>
    <div class="kv"><div><span>홀더 수</span><b>${num(oc.holders.count)}</b></div><div><span>상위 10 지갑 비중</span><b class="${oc.holders.top10Pct > 60 ? 'down' : ''}">${oc.holders.top10Pct != null ? oc.holders.top10Pct.toFixed(1) + '%' : '-'}</b></div></div>
    ${(oc.holders.top || []).map((h, i) => `<div style="margin-top:9px"><div style="display:flex;justify-content:space-between;font-size:13px"><span>${i + 1}. ${esc(short(h.address))} ${h.tag ? `<span class="tag">${esc(h.tag)}</span>` : ''}${h.locked ? '<span class="tag good">잠금</span>' : ''}${h.contract ? '<span class="tag">컨트랙트</span>' : ''}</span><b>${h.pct?.toFixed(2)}%</b></div><div class="bar"><i style="width:${Math.min(100, h.pct || 0)}%"></i></div></div>`).join('')}
    <p class="muted" style="font-size:12.5px;margin-top:10px">거래소·브릿지·잠금 컨트랙트는 실제 개인 보유가 아닐 수 있습니다.</p>
  </div>` : ''}
  ${oc.dex ? `<div class="sec"><h3>DEX 유동성·거래</h3>
    <div class="kv"><div><span>총 유동성</span><b>${usd(oc.dex.totalLiquidity)}</b></div><div><span>24h DEX 거래량</span><b>${usd(oc.dex.volume24h)}</b></div>
    <div><span>24h 매수 건수</span><b class="up">${num(oc.dex.buys)}</b></div><div><span>24h 매도 건수</span><b class="down">${num(oc.dex.sells)}</b></div></div>
    ${oc.dex.buys + oc.dex.sells > 0 ? `<div style="margin-top:12px"><div class="muted" style="font-size:12.5px;margin-bottom:6px">매수 비중 ${((oc.dex.buys / (oc.dex.buys + oc.dex.sells)) * 100).toFixed(0)}%</div><div class="bar"><i style="width:${(oc.dex.buys / (oc.dex.buys + oc.dex.sells)) * 100}%;background:var(--good)"></i></div></div>` : ''}
    ${oc.dex.pairs.map((x) => `<div class="row"><div class="grow"><div class="t">${esc(x.pair)} <span class="tag">${esc(x.dex)}</span></div><div class="s">${esc(x.chain)} · 유동성 ${usd(x.liquidity)} · 거래량 ${usd(x.volume24h)}</div></div><a class="btn sm ghost" href="${esc(x.url)}" target="_blank">보기</a></div>`).join('')}
  </div>` : ''}
  ${oc.tvl ? `<div class="sec"><h3>TVL(예치 자산) <span class="muted">DefiLlama</span></h3>
    <div class="kv"><div><span>${oc.tvl.isChain ? '체인 TVL' : '현재 TVL'}</span><b>${usd(oc.tvl.current)}</b></div><div><span>30일 변화</span><b class="${cls(oc.tvl.change30d)}">${pct(oc.tvl.change30d)}</b></div></div>
    ${oc.tvl.series ? `<div style="margin-top:10px">${sparkline(oc.tvl.series, { color: 'var(--acc)' })}</div>` : ''}
    ${oc.tvl.chains?.length ? `<div class="pmeta" style="margin-top:8px">${oc.tvl.chains.map((c) => `<span class="tag">${esc(c)}</span>`).join('')}</div>` : ''}
  </div>` : ''}
  ${p.dev || p.community ? `<div class="sec"><h3>개발·커뮤니티 활동</h3><div class="kv">
    ${p.dev ? `<div><span>최근 4주 커밋</span><b>${p.dev.commits4w ?? '-'}</b></div><div><span>깃허브 스타</span><b>${num(p.dev.stars)}</b></div>` : ''}
    ${p.community ? `<div><span>X 팔로워</span><b>${num(p.community.twitter)}</b></div><div><span>관심 등록 유저</span><b>${num(p.community.watchlist)}</b></div>` : ''}
  </div></div>` : ''}
  ${!sec && !oc.holders && !oc.dex && !oc.tvl ? '<div class="sec"><p class="muted">온체인 데이터를 찾지 못했습니다. 토큰이 아직 발행되지 않았거나 지원하지 않는 체인일 수 있습니다.</p></div>' : ''}`;
}

export function tabExchange(p) {
  const ex = p.exchanges || {};
  const cell = (label, v) => `<div class="ex ${v?.listed ? 'yes' : v?.listed === false ? 'no' : ''}"><b>${label}</b><span>${v?.listed ? '상장' : v?.listed === false ? '미상장' : '확인불가'}</span></div>`;
  const up = ex.korea?.upbit;
  const byName = {};
  for (const e of ex.list || []) {
    const k = e.name;
    if (!byName[k]) byName[k] = { ...e, pairs: [e.pair], volume: e.volume || 0 };
    else { byName[k].pairs.push(e.pair); byName[k].volume += e.volume || 0; }
  }
  const rows = Object.values(byName).sort((a, b) => b.volume - a.volume);
  return `
  <div class="sec"><h3>🇰🇷 국내 거래소</h3><div class="ex-grid" style="grid-template-columns:1fr 1fr">${cell('업비트', up)}${cell('빗썸', ex.korea?.bithumb)}</div>
    ${up?.listed ? `<div class="muted" style="font-size:13px;margin-top:10px">업비트 마켓: ${(up.markets || []).join(', ')}${up.koreanName ? ` · ${esc(up.koreanName)}` : ''}</div>` : ''}
    ${up?.warning ? '<div class="caution">⚠ 업비트 투자유의 종목</div>' : ''}
    ${up?.caution?.length ? `<div class="caution">주의 신호: ${up.caution.map(cautionKo).join(', ')}</div>` : ''}
  </div>
  <div class="sec"><h3>🌍 글로벌 메이저</h3><div class="ex-grid">${cell('바이낸스', ex.global?.binance)}${cell('코인베이스', ex.global?.coinbase)}${cell('OKX', ex.global?.okx)}${cell('바이비트', ex.global?.bybit)}</div>
    <div class="ex-grid" style="margin-top:6px">${cell('Gate', ex.global?.gate)}</div>
    <p class="muted" style="font-size:12.5px;margin-top:10px">심볼 기준 조회로 동일 심볼의 다른 코인이 섞일 수 있습니다. "확인불가"는 지역 제한·네트워크 문제입니다.</p>
  </div>
  ${p.ai?.listings ? `<div class="sec"><h3>상장 예정·루머 <span class="pill-ai">AI</span></h3>${(p.ai.listings.expected || []).map((x) => `<div class="row"><div class="grow t">${esc(x)}</div></div>`).join('') || '<p class="muted">확인된 상장 예정 정보 없음</p>'}</div>` : ''}
  <div class="sec"><h3>전체 상장 마켓 <span class="muted">CEX ${ex.cexCount || 0} · DEX ${ex.dexCount || 0}</span></h3>
    ${rows.slice(0, 30).map((e) => `<div class="row"><div class="grow"><div class="t">${esc(e.name)} ${e.dex ? '<span class="tag">DEX</span>' : ''}${e.trust === 'green' ? '<span class="tag good">신뢰</span>' : e.trust === 'red' ? '<span class="tag bad">저신뢰</span>' : ''}</div><div class="s">${[...new Set(e.pairs)].slice(0, 4).map(esc).join(', ')}</div></div><b style="font-size:13.5px">${usd(e.volume)}</b></div>`).join('') || '<p class="muted">상장된 거래소가 없습니다. TGE 전이라면 에어드랍/테스트넷 참여 전략을 확인하세요.</p>'}
  </div>`;
}

export const SCAM_CHECKS = [
  '원금 보장 또는 확정 수익(일/월 %)을 약속한다',
  '지인 추천·모집 인원에 따라 수당이 커진다',
  '공식 사이트·백서·팀 정보가 불분명하다',
  '텔레그램/DM으로 먼저 연락해 투자를 권유했다',
  '"오늘만", "선착순" 등 결정을 재촉한다',
  '출금이 지연되거나 출금 수수료를 추가로 요구한다',
  '컨트랙트 주소를 공식 채널이 아닌 곳에서 받았다',
  '지갑 시드구문(복구문구) 입력을 요구한다',
];

export function tabRisk(p) {
  const sc = p.scamCheck || {};
  const hit = SCAM_CHECKS.filter((_, i) => sc[i]).length;
  return `
  <div class="sec"><h3>자동 감지 리스크 <span class="muted">${p.risks?.length || 0}건</span></h3>
    ${(p.risks || []).map((r) => `<div class="risk ${r.level}"><span class="lv">${{ high: '높음', mid: '중간', low: '낮음' }[r.level] || '중간'}</span><div>${esc(r.text)}</div></div>`).join('')}
  </div>
  <div class="sec"><h3>🚨 스캠 자가진단 <span class="muted">${hit}/${SCAM_CHECKS.length}</span></h3>
    <p class="muted" style="font-size:13px">해당하는 항목을 체크하세요. 2개 이상이면 참여를 멈추는 것이 좋습니다.</p>
    <div class="checklist">${SCAM_CHECKS.map((q, i) => `<label><input type="checkbox" data-change="scam" data-i="${i}" ${sc[i] ? 'checked' : ''}>${esc(q)}</label>`).join('')}</div>
    ${hit >= 2 ? '<div class="risk high" style="margin-top:10px"><span class="lv">경고</span><div>사기 위험 신호가 여러 개입니다. 참여를 중단하고 금융감독원(1332)에 상담하세요.</div></div>' : ''}
  </div>`;
}

export function tabTimeline(p) {
  const ai = p.ai || {};
  const ev = [
    ...(ai.tokenomics?.unlocks || []).map((u) => ({ when: u.date, item: `🔓 토큰 언락: ${u.desc}` })),
    ...(ai.roadmap || []).map((r) => ({ when: r.when, item: r.item, done: r.done })),
    ...(p.investors?.raises || []).map((r) => ({ when: r.date, item: `💰 ${r.round} 투자 유치${r.amount ? ` $${r.amount}M` : ''}`, done: true })),
  ].filter((e) => e.when).sort((a, b) => String(a.when).localeCompare(String(b.when)));
  return `
  ${ai.airdrop ? `<div class="sec"><h3>🪂 에어드랍 <span class="tag ${ai.airdrop.status === '진행중' ? 'good' : ''}">${esc(ai.airdrop.status)}</span></h3><p>${esc(ai.airdrop.detail || '')}</p></div>` : ''}
  <div class="sec"><h3>일정 타임라인</h3>
    ${ev.length ? `<div class="timeline">${ev.map((e) => `<div class="tl ${e.done ? 'done' : ''}"><div class="w">${esc(e.when)}</div><div>${esc(e.item)}</div></div>`).join('')}</div>` : `<p class="muted">일정 정보가 없습니다. ${p.ai ? '' : 'AI 웹 조사를 실행하면 로드맵·언락 일정을 모읍니다.'}</p>`}
  </div>
  <div class="sec"><h3>최근 뉴스</h3>
    ${(ai.news || []).map((n) => `<div class="row"><div class="grow"><div class="t">${n.url ? `<a href="${esc(n.url)}" target="_blank" rel="noopener" style="color:var(--txt)">${esc(n.title)}</a>` : esc(n.title)}</div><div class="s">${esc(n.date || '')}</div></div></div>`).join('') || `<p class="muted">${p.ai ? '최근 뉴스 없음' : 'AI 웹 조사 실행 시 최근 뉴스가 표시됩니다.'}</p>`}
  </div>`;
}

export function tabMemo(p) {
  return `<div class="sec"><h3>내 메모</h3>
    <textarea class="memo" data-change="memo" placeholder="참여 지갑 주소, 퀘스트 진행, 매수가 등 자유롭게 기록하세요">${esc(p.memo || '')}</textarea>
    <p class="muted" style="font-size:12px;margin-top:6px">자동 저장됩니다. 시드구문·개인키는 절대 적지 마세요.</p>
  </div>
  <div class="sec"><h3>관리</h3><button class="btn danger block" data-act="deleteOne">${icon.trash} 이 프로젝트 삭제</button></div>`;
}

// ───────── 비교 ─────────
export function viewCompare(t) {
  const ps = t.ids.map(store.getProject).filter(Boolean);
  const best = (vals, hi = true) => { const v = vals.filter((x) => x != null); return v.length ? (hi ? Math.max(...v) : Math.min(...v)) : null; };
  const rowNum = (label, get, fmt = (v) => v ?? '-', hi = true) => {
    const vals = ps.map(get);
    const b = best(vals, hi);
    return `<tr><th>${label}</th>${vals.map((v) => `<td class="${v != null && v === b && ps.length > 1 ? 'best' : ''}">${fmt(v)}</td>`).join('')}</tr>`;
  };
  const rowTxt = (label, get) => `<tr><th>${label}</th>${ps.map((p) => `<td>${get(p)}</td>`).join('')}</tr>`;
  return `<div class="screen">
  <div class="topbar"><button class="ibtn" data-act="back">${icon.back}</button><h1>프로젝트 비교</h1></div>
  <div class="cmp"><table>
    <thead><tr><th></th>${ps.map((p) => `<td>${esc(p.name)}<div class="muted" style="font-size:12px">${esc((p.symbol || '').toUpperCase())}</div></td>`).join('')}</tr></thead>
    <tbody>
      ${rowNum('신뢰도', (p) => p.scores?.trust?.score, (v) => `<b>${v ?? '-'}</b>`)}
      ${rowNum('가능성', (p) => p.scores?.potential?.score, (v) => `<b>${v ?? '-'}</b>`)}
      ${rowNum('우선순위', (p) => p.priority, (v) => `<span class="prio">${stars(v)}</span>`)}
      ${rowTxt('유형', (p) => (p.classification?.types || []).slice(0, 2).map((x) => typeTag(x.key)).join('<br>'))}
      ${rowTxt('단계', (p) => stageTag(p.stage))}
      ${rowTxt('참여방식', (p) => (p.earnMethods || []).slice(0, 3).map((m) => `${EARN_METHODS[m.key].icon} ${esc(m.label)}`).join('<br>'))}
      ${rowNum('시가총액', (p) => p.market?.mcap, usd, false)}
      ${rowNum('FDV/시총', (p) => (p.market?.fdv && p.market?.mcap ? +(p.market.fdv / p.market.mcap).toFixed(1) : null), (v) => (v ? `${v}배` : '-'), false)}
      ${rowNum('투자 유치', (p) => p.investors?.totalRaised || null, (v) => (v ? `$${v.toFixed(0)}M` : '-'))}
      ${rowNum('티어1 VC', (p) => p.investors?.tier1?.length ?? 0)}
      ${rowNum('CEX 상장', (p) => p.exchanges?.cexCount ?? 0)}
      ${rowTxt('업비트', (p) => (p.exchanges?.korea?.upbit?.listed ? '✅' : '—'))}
      ${rowNum('홀더 수', (p) => p.onchain?.holders?.count, num)}
      ${rowNum('상위10 집중', (p) => p.onchain?.holders?.top10Pct, (v) => (v != null ? v.toFixed(1) + '%' : '-'), false)}
      ${rowNum('위험 신호', (p) => (p.risks || []).filter((r) => r.level === 'high').length, (v) => v, false)}
    </tbody></table></div>
  <div class="disclaimer">초록색은 해당 항목에서 가장 유리한 값입니다.</div>
</div>`;
}

// ───────── 설정 ─────────
