import * as store from './store.js';
import { searchCoins, cgTrending } from './api/sources.js';
import { analyzeProject, reapplyAi, STEPS } from './engine/analyze.js';
import { PROJECT_TYPES, EARN_METHODS } from './engine/taxonomy.js';
import { esc, usd, krw, num, pct, cls, ago, sparkline, areaSpark, arc, icon } from './util.js';
import { typeTag, stageTag, stars, tabEarn, tabInvest, tabOnchain, tabExchange, tabRisk, tabTimeline, tabMemo, viewCompare } from './ui/tabs.js';

const $app = document.getElementById('app');
const AppPlugin = window.Capacitor?.Plugins?.App;
const ROOTS = ['home', 'insights', 'alerts', 'more'];

const state = {
  stack: [{ view: 'home' }],
  overlay: null,
  select: false,
  selected: new Set(),
  edit: false,
  seg: 'all', // all | new | fav | good | risk
  filterType: null,
  filterMethod: null,
  busy: false,
};
const top = () => state.stack[state.stack.length - 1];

function push(view, params = {}) {
  state.stack.push({ view, ...params });
  render();
  window.scrollTo(0, 0);
}
function pop() {
  if (state.stack.length > 1) state.stack.pop();
  render();
}
function goRoot(view) {
  state.stack = [{ view }];
  state.select = state.edit = false;
  state.selected.clear();
  render();
  window.scrollTo(0, 0);
}

// ═════════ 뒤로가기 ═════════
function handleBack() {
  if (state.overlay) {
    if (!state.overlay.locked) closeOverlay();
    return;
  }
  if (state.select || state.edit) {
    state.select = state.edit = false;
    state.selected.clear();
    render();
    return;
  }
  const t = top();
  if (t.view === 'analyzing') return;
  if (t.view === 'report' && t.tab && t.tab !== 'summary') {
    t.tab = 'summary';
    render();
    window.scrollTo(0, 0);
    return;
  }
  if (state.stack.length > 1) return pop();
  if (t.view !== 'home') return goRoot('home');
  if (state.seg !== 'all' || state.filterType || state.filterMethod) {
    state.seg = 'all';
    state.filterType = state.filterMethod = null;
    return render();
  }
  openOverlay({ type: 'exit' });
}
if (AppPlugin) AppPlugin.addListener('backButton', handleBack);
window.addEventListener('keydown', (e) => e.key === 'Escape' && handleBack());

function openOverlay(o) {
  state.overlay = o;
  renderOverlay();
}
function closeOverlay() {
  state.overlay = null;
  renderOverlay();
}

let toastTimer;
function toast(msg) {
  document.querySelector('.toast')?.remove();
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.appendChild(el);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.remove(), 2200);
}

// ═════════ 공통 조각 ═════════
const avatar = (p) => `<div class="avatar">${esc((p.symbol || p.name || '?').slice(0, 2).toUpperCase())}${p.logo ? `<img src="${esc(p.logo)}" alt="" onerror="this.remove()">` : ''}</div>`;
const gradeBadge = (p) => {
  const t = p.scores?.trust;
  if (!t) return '';
  const lbl = { A: '✓ 신뢰 높음', B: '✓ 양호', C: '보통', D: '주의', F: '위험' }[t.g];
  return `<span class="gbadge ${t.g}">${lbl}</span>`;
};
function tagline(p) {
  if (p.ai?.summary) return p.ai.summary.split(/[.。]\s/)[0].slice(0, 40);
  const T = PROJECT_TYPES[p.classification?.primary];
  const cat = (p.overview?.categories || []).find((c) => !/ecosystem|portfolio|token|chain/i.test(c));
  return [T?.label, cat].filter(Boolean).join(' · ');
}
function unseenAlerts() {
  const seen = store.getSettings().alertsSeenAt || 0;
  return buildAlerts().filter((a) => a.at > seen).length;
}
const navbar = (cur) => {
  const n = unseenAlerts();
  const items = [['home', '홈', icon.home], ['insights', '분석', icon.bars], ['alerts', '알림', icon.bell], ['more', '더보기', icon.dots]];
  return `<nav class="navbar">${items.map(([k, l, ic]) => `<button class="${cur === k ? 'on' : ''}" data-act="nav" data-k="${k}">${ic}${l}${k === 'alerts' && n ? '<span class="dot"></span>' : ''}</button>`).join('')}</nav>`;
};

// ═════════ 렌더 ═════════
function render() {
  const t = top();
  const views = { home: viewHome, insights: viewInsights, alerts: viewAlerts, more: viewMore, analyzing: viewAnalyzing, report: viewReport, settings: viewSettings, compare: viewCompare, calc: viewCalc, guide: viewGuide };
  let html = views[t.view](t);
  if (ROOTS.includes(t.view) && !state.select && !state.edit) html += navbar(t.view);
  $app.innerHTML = html;
  if (t.view === 'home') bindDrag();
  renderOverlay();
}

// ───────── 홈 ─────────
const SEGS = [['all', '전체'], ['new', '신규·TGE전'], ['fav', '관심'], ['good', '고신뢰'], ['risk', '주의']];
function filtered(list) {
  const seg = {
    all: () => true,
    new: (p) => p.stage !== 'listed',
    fav: (p) => (p.priority || 0) >= 4,
    good: (p) => (p.scores?.trust?.score || 0) >= 65,
    risk: (p) => (p.scores?.trust?.score || 0) < 50 || (p.risks || []).some((r) => r.level === 'high'),
  }[state.seg];
  return list
    .filter(seg)
    .filter((p) => !state.filterType || p.classification?.types?.some((t) => t.key === state.filterType))
    .filter((p) => !state.filterMethod || p.earnMethods?.some((m) => m.key === state.filterMethod));
}

function viewHome() {
  const s = store.getSettings();
  const all = store.sortedProjects(state.edit ? 'manual' : s.sortMode);
  const list = state.edit ? all : filtered(all);
  const n = unseenAlerts();
  const filterOn = state.filterType || state.filterMethod;

  if (state.select || state.edit) {
    return `<div class="screen">
    <div class="topbar"><button class="ibtn" data-act="exitSelect">${icon.back}</button>
      ${state.select ? `<h1>${state.selected.size}개 선택<small>비교는 2~3개</small></h1><button class="btn sm ghost" data-act="selectAll">전체</button>` : `<h1>순서 편집<small>손잡이를 끌거나 ▲▼로 이동</small></h1><button class="btn sm" data-act="exitSelect">완료</button>`}
    </div>
    <div class="list" id="plist">${list.map(cardHtml).join('')}</div>
    ${state.select ? `<div class="actionbar"><button class="btn ghost" data-act="compare" ${state.selected.size < 2 || state.selected.size > 3 ? 'disabled' : ''}>${icon.compare} 비교</button><button class="btn danger" data-act="deleteSel" ${!state.selected.size ? 'disabled' : ''}>${icon.trash} 삭제</button></div>` : ''}
    </div>`;
  }

  return `<div class="screen with-nav">
  <div class="topbar">
    <img class="app-logo" src="img/logo.png" alt="">
    <h1>코인 검증기<small>신규 코인 프로젝트 분석</small></h1>
    <button class="ibtn" data-act="nav" data-k="alerts" aria-label="알림">${icon.bell}${n ? `<span class="badge">${n > 9 ? '9+' : n}</span>` : ''}</button>
    <button class="ibtn" data-act="settings" aria-label="설정">${icon.gear}</button>
  </div>
  <form class="search" data-form="search">
    <div class="box">${icon.search}<input id="q" name="q" placeholder="코인 프로젝트를 검색해보세요 (예: Berachain)" autocomplete="off" enterkeyhint="search"></div>
  </form>
  <div class="quick">
    <button class="qtile" data-act="focusSearch"><span class="qi">${icon.shieldFill}</span>프로젝트<br>검증</button>
    <button class="qtile" data-act="nav" data-k="insights"><span class="qi">${icon.barsFill}</span>분석<br>리포트</button>
    <button class="qtile" data-act="trending"><span class="qi">${icon.fire}</span>인기<br>프로젝트</button>
    <button class="qtile" data-act="seg" data-k="fav"><span class="qi">${icon.starFill}</span>관심<br>코인</button>
  </div>
  ${all.length ? `
  <div class="chips">${SEGS.map(([k, l]) => `<button class="chip ${state.seg === k ? 'on' : ''}" data-act="seg" data-k="${k}">${l}</button>`).join('')}
    <button class="ibtn mini" style="${filterOn ? 'border-color:var(--acc);color:#c9bcff' : ''}" data-act="filterSheet" aria-label="필터">${icon.filter}</button></div>
  ${filterOn ? `<div class="chips">${state.filterType ? `<button class="chip soft on" data-act="ftype" data-k="">${PROJECT_TYPES[state.filterType].icon} ${esc(PROJECT_TYPES[state.filterType].short || PROJECT_TYPES[state.filterType].label)} ✕</button>` : ''}${state.filterMethod ? `<button class="chip soft on" data-act="fmethod" data-k="">${EARN_METHODS[state.filterMethod].icon} ${esc(EARN_METHODS[state.filterMethod].label)} ✕</button>` : ''}</div>` : ''}
  <div class="label-row"><h3>내 프로젝트 <span class="muted">${list.length}</span></h3>
    <div style="display:flex;gap:6px">
      <select class="sel" data-change="sort" aria-label="정렬">${[['manual', '내 순서'], ['priority', '우선순위'], ['trust', '신뢰도'], ['potential', '가능성'], ['updated', '최근 업데이트']].map(([v, l]) => `<option value="${v}" ${s.sortMode === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
      <button class="ibtn mini" data-act="edit" aria-label="순서 편집">${icon.sort}</button>
      <button class="ibtn mini" data-act="select" aria-label="선택">${icon.check}</button>
    </div></div>` : ''}
  <div class="list" id="plist">
    ${list.map(cardHtml).join('') || (all.length ? '<div class="empty">조건에 맞는 프로젝트가 없습니다.</div>' : emptyHome())}
  </div>
</div>`;
}

function emptyHome() {
  return `<div class="empty"><div class="big">🔍</div><b>검증할 코인 프로젝트를 검색하세요</b>
  개요·투자자·온체인·거래소 상장·신뢰도·가능성·참여 전략까지<br>한 번에 분석해 목록에 저장합니다.
  <div class="chips" style="justify-content:center;margin-top:16px;flex-wrap:wrap">
    ${['Berachain', 'Monad', 'Hyperliquid', 'Pudgy Penguins', 'Aethir'].map((q) => `<button class="chip" data-act="quick" data-q="${q}">${q}</button>`).join('')}
  </div></div>`;
}

function cardHtml(p) {
  const sel = state.selected.has(p.id);
  const m = p.market || {};
  return `<div class="pcard ${sel ? 'selected' : ''}" data-act="${state.select ? 'toggleSel' : state.edit ? '' : 'open'}" data-id="${esc(p.id)}">
    ${state.select ? `<div class="check">${icon.check}</div>` : ''}
    ${state.edit ? `<div class="handle" data-handle>${icon.grip}</div>` : ''}
    ${avatar(p)}
    <div class="pbody">
      <div class="pname">${esc(p.name)} <span class="sym">${esc((p.symbol || '').toUpperCase())}</span> ${gradeBadge(p)}</div>
      <div class="psub">${esc(tagline(p))}</div>
      <div class="pline"><span class="prio">${stars(p.priority)}</span>${m.mcap ? ` · 시총 ${usd(m.mcap)}` : m.price ? ` · ${usd(m.price)}` : ` · ${p.stage === 'pre-tge' ? 'TGE 전' : '시세 없음'}`}${m.change24h != null ? ` · <span class="${cls(m.change24h)}">${m.change24h > 0 ? '▲' : '▼'}${Math.abs(m.change24h).toFixed(1)}%</span>` : ''}</div>
    </div>
    ${state.edit ? `<div class="updown"><button data-act="mv" data-d="-1" data-id="${esc(p.id)}">▲</button><button data-act="mv" data-d="1" data-id="${esc(p.id)}">▼</button></div>` : `<div class="pscore">${arc(p.scores?.trust?.score)}<small>신뢰도</small></div>`}
  </div>`;
}

function bindDrag() {
  if (!state.edit) return;
  const listEl = document.getElementById('plist');
  listEl?.querySelectorAll('[data-handle]').forEach((h) => {
    h.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      const card = h.closest('.pcard');
      card.classList.add('dragging');
      h.setPointerCapture(e.pointerId);
      const move = (ev) => {
        const cards = [...listEl.querySelectorAll('.pcard:not(.dragging)')];
        const after = cards.find((c) => {
          const r = c.getBoundingClientRect();
          return ev.clientY < r.top + r.height / 2;
        });
        if (after) listEl.insertBefore(card, after);
        else listEl.appendChild(card);
      };
      const up = () => {
        card.classList.remove('dragging');
        h.removeEventListener('pointermove', move);
        h.removeEventListener('pointerup', up);
        h.removeEventListener('pointercancel', up);
        store.reorder([...listEl.querySelectorAll('.pcard')].map((c) => c.dataset.id));
      };
      h.addEventListener('pointermove', move);
      h.addEventListener('pointerup', up);
      h.addEventListener('pointercancel', up);
    });
  });
}

// ───────── 분석(인사이트) 탭 ─────────
function viewInsights() {
  const all = store.listProjects();
  const head = `<div class="topbar"><h1>분석 리포트<small>내가 분석한 프로젝트 한눈에 보기</small></h1></div>`;
  if (!all.length) return `<div class="screen with-nav">${head}<div class="empty"><div class="big">📊</div><b>아직 분석한 프로젝트가 없어요</b>홈에서 프로젝트를 검색해 분석하면 순위와 분포가 여기에 표시됩니다.</div></div>`;
  const avg = (f) => Math.round(all.reduce((a, p) => a + (f(p) || 0), 0) / all.length);
  const rank = (f, title, sub) => {
    const r = [...all].sort((a, b) => f(b) - f(a)).slice(0, 5);
    return `<div class="sec"><h3>${title} <span class="muted">${sub}</span></h3>${r.map((p, i) => `<div class="rank" data-act="open" data-id="${esc(p.id)}"><span class="n">${i + 1}</span>${avatar(p)}<div class="grow"><b>${esc(p.name)}</b><div class="bar"><i style="width:${f(p)}%"></i></div></div><span class="v">${f(p)}</span></div>`).join('')}</div>`;
  };
  const dist = (pairs, meta) => {
    const max = Math.max(...pairs.map((x) => x[1]), 1);
    return pairs.sort((a, b) => b[1] - a[1]).map(([k, c]) => `<div class="dist"><span class="l">${meta[k].icon} ${esc(meta[k].short || meta[k].label)}</span><div class="bar"><i style="width:${(c / max) * 100}%"></i></div><span class="c">${c}</span></div>`).join('');
  };
  const count = (keys) => Object.entries(keys.reduce((m, k) => ((m[k] = (m[k] || 0) + 1), m), {}));
  const types = count(all.map((p) => p.classification?.primary).filter(Boolean));
  const methods = count(all.flatMap((p) => (p.earnMethods || []).filter((m) => m.fit !== 'low').map((m) => m.key)));
  const tge = all.filter((p) => p.stage === 'pre-tge');
  return `<div class="screen with-nav">${head}
  <div class="stats">
    <div class="stat"><b>${all.length}</b><span>분석 프로젝트</span></div>
    <div class="stat"><b>${avg((p) => p.scores?.trust?.score)}</b><span>평균 신뢰도</span></div>
    <div class="stat"><b>${avg((p) => p.scores?.potential?.score)}</b><span>평균 가능성</span></div>
  </div>
  ${rank((p) => p.scores?.trust?.score || 0, '🛡️ 신뢰도 TOP', '높을수록 안전')}
  ${rank((p) => p.scores?.potential?.score || 0, '🚀 가능성 TOP', '성장 잠재력')}
  <div class="sec"><h3>프로젝트 유형 분포</h3>${dist(types, PROJECT_TYPES)}</div>
  <div class="sec"><h3>참여 가능한 수익 방식</h3>${dist(methods, EARN_METHODS)}</div>
  <div class="sec"><h3>🪂 TGE 전·에어드랍 기회 <span class="muted">${tge.length}</span></h3>${tge.map((p) => `<div class="row" data-act="open" data-id="${esc(p.id)}">${avatar(p)}<div class="grow"><div class="t">${esc(p.name)}</div><div class="s">${(p.earnMethods || []).slice(0, 3).map((m) => m.label).join(' · ')}</div></div><span class="chev">${icon.chev}</span></div>`).join('') || '<p class="muted" style="font-size:13.5px">토큰 발행 전 프로젝트가 없습니다. 테스트넷·포인트 프로그램 중인 프로젝트를 검색해 보세요.</p>'}</div>
</div>`;
}

// ───────── 알림 탭 ─────────
function buildAlerts() {
  const out = [];
  for (const p of store.listProjects()) {
    for (const c of p.changes || []) {
      const ic = c.label.includes('상장') || c.label === '업비트' || c.label === '빗썸' ? '🚀' : c.label === '가격' ? '💹' : c.label === '신뢰도' || c.label === '가능성' ? '🛡️' : '🔔';
      out.push({ at: p.updatedAt, id: p.id, ic, t: `${p.name} · ${c.label} ${c.delta || ''}`, s: `${c.from ? `${c.from} → ` : ''}${c.to}` });
    }
    for (const r of (p.risks || []).filter((x) => x.level === 'high')) out.push({ at: p.updatedAt - 1, id: p.id, ic: '⚠️', t: `${p.name} · 위험 신호`, s: r.text });
    const soon = Date.now() + 60 * 864e5;
    for (const u of p.ai?.tokenomics?.unlocks || []) {
      const d = Date.parse(u.date);
      if (d && d > Date.now() && d < soon) out.push({ at: p.updatedAt - 2, id: p.id, ic: '🔓', t: `${p.name} · 토큰 언락 ${u.date}`, s: u.desc });
    }
    if (p.ai?.airdrop?.status === '진행중') out.push({ at: p.updatedAt - 3, id: p.id, ic: '🪂', t: `${p.name} · 에어드랍 진행중`, s: p.ai.airdrop.detail || '' });
  }
  return out.sort((a, b) => b.at - a.at).slice(0, 80);
}
function viewAlerts() {
  const seen = store.getSettings().alertsSeenAt || 0;
  const list = buildAlerts();
  setTimeout(() => store.saveSettings({ alertsSeenAt: Date.now() }), 0);
  return `<div class="screen with-nav">
  <div class="topbar"><h1>알림<small>업데이트로 감지한 변화와 위험 신호</small></h1>${store.listProjects().length ? `<button class="btn sm ghost" data-act="refreshAll">${icon.refresh} 전체 업데이트</button>` : ''}</div>
  <div class="sec">${list.map((a) => `<div class="alert ${a.at > seen ? 'new' : ''}" data-act="open" data-id="${esc(a.id)}"><div class="ai">${a.ic}</div><div class="grow"><div class="t">${esc(a.t)}</div><div class="s">${esc(a.s)}</div><div class="time">${ago(a.at)}</div></div></div>`).join('') || '<div class="empty" style="padding:20px"><div class="big">🔔</div><b>새 알림이 없어요</b>프로젝트를 [업데이트]하면 신규 상장, 점수 변화, 위험 신호, 다가오는 언락 일정이 여기에 모입니다.</div>'}</div>
</div>`;
}

// ───────── 더보기 탭 ─────────
function viewMore() {
  const item = (act, ic, t, s) => `<div class="row" data-act="${act}"><div class="mi">${ic}</div><div class="grow"><div class="t">${t}</div><div class="s">${s}</div></div><span class="chev">${icon.chev}</span></div>`;
  return `<div class="screen with-nav">
  <div class="topbar"><img class="app-logo" src="img/logo.png" alt=""><h1>더보기<small>코인 검증기 v1.0.0</small></h1></div>
  <div class="sec menu"><h3>도구</h3>
    ${item('select', '⚖️', '프로젝트 비교', '2~3개를 골라 점수·투자·상장 나란히 비교')}
    ${item('calcPage', '🧮', '수익 계산기', '토큰 수익률 · 노드 회수기간 · 에어드랍 기대값')}
    ${item('trending', '🔥', '인기 프로젝트', '지금 많이 검색되는 코인')}
    ${item('refreshAll', '🔄', '전체 업데이트', '저장한 프로젝트를 모두 최신 데이터로')}
  </div>
  <div class="sec menu"><h3>안전 가이드</h3>
    ${item('guide', '🚨', '코인 사기 예방 가이드', '다단계·러그풀·피싱 구별법')}
  </div>
  <div class="sec menu"><h3>설정</h3>
    ${item('settings', '⚙️', '설정', 'AI 웹 조사 키 · 데이터 소스 · 백업/복원')}
  </div>
  <div class="disclaimer">본 앱의 분석은 투자 권유가 아닙니다. 투자 판단과 책임은 본인에게 있습니다.</div>
</div>`;
}

function viewGuide() {
  const items = [
    ['🔁', '다단계·폰지형', '확정 수익(일 1%, 월 30%), 원금 보장, 추천 수당이 핵심이면 사기 가능성이 매우 높습니다. 수익이 신규 투자자 돈에서 나옵니다.'],
    ['🧲', '러그풀', '개발자가 유동성을 빼고 잠적하는 수법. 유동성 잠금(LP Lock), 홀더 집중도, 팀 공개 여부를 확인하세요. 앱의 [온체인] 탭에서 점검할 수 있습니다.'],
    ['🍯', '허니팟 토큰', '살 수는 있지만 팔 수 없게 만든 토큰. 매수 전 보안 점검에서 "허니팟", "매도세"를 반드시 확인하세요.'],
    ['🎣', '피싱·가짜 사이트', '공식 X(트위터)·디스코드에 있는 링크만 사용하세요. DM으로 온 에어드랍 링크, 지갑 "검증" 요청은 사기입니다.'],
    ['🔑', '시드구문 요구', '어떤 프로젝트도 시드구문(복구 문구)이나 개인키를 묻지 않습니다. 입력하는 순간 지갑이 털립니다.'],
    ['🪪', '사칭 토큰', '같은 이름·심볼의 가짜 토큰이 많습니다. 컨트랙트 주소를 공식 데이터와 대조하세요(앱에서 복사 가능).'],
    ['🧾', '노드·NFT 선판매', '노드 판매 대금이 주 수익원이고 보상이 자체 토큰뿐이면 회수 불가 위험이 큽니다. 계산기로 회수 기간을 확인하세요.'],
  ];
  return `<div class="screen">
  <div class="topbar"><button class="ibtn" data-act="back">${icon.back}</button><h1>사기 예방 가이드</h1></div>
  ${items.map(([ic, t, d]) => `<div class="sec"><h3>${ic} ${t}</h3><p>${d}</p></div>`).join('')}
  <div class="sec"><h3>📞 피해 상담</h3><p>금융감독원 1332 · 경찰청 사이버수사국 182<br>피해가 의심되면 즉시 거래소에 출금 정지를 요청하세요.</p></div>
</div>`;
}

// ───────── 분석 진행 ─────────
function viewAnalyzing(t) {
  const st = t.steps || {};
  return `<div class="screen"><div class="progress-wrap">
    <div class="orbit">${icon.sparkle}</div>
    <h2>${esc(t.name)} 분석 중</h2>
    <p>${t.isUpdate ? '최신 데이터로 업데이트하고 있어요…' : '여러 데이터 소스를 교차 검증하고 있어요…'}</p>
    <div class="steps-card">${STEPS.map((s, i) => {
      const v = st[s.key] || {};
      const mark = { done: '✓', skip: '–', fail: '!' }[v.state] || i + 1;
      return `<div class="step ${v.state || ''}"><div class="dot">${mark}</div><div class="grow"><div>${s.label}${v.state === 'run' ? ' 중…' : ''}</div>${v.note ? `<div class="s">${esc(v.note)}</div>` : ''}</div></div>`;
    }).join('')}</div>
  </div></div>`;
}

async function runAnalysis({ query, pick, isUpdate = false, forceAi = false }) {
  if (state.busy) return toast('다른 분석이 진행 중입니다');
  state.busy = true;
  const frame = { view: 'analyzing', name: pick?.name || query, steps: {}, isUpdate };
  if (isUpdate) state.stack.push(frame);
  else state.stack = [{ view: 'home' }, frame];
  render();
  window.scrollTo(0, 0);
  try {
    const r = await analyzeProject({ query, pick, forceAi }, (key, st, note) => {
      frame.steps[key] = { state: st, note };
      if (top() === frame) render();
    });
    const prev = store.getProject(r.id);
    if (prev?.ai) reapplyAi(r, prev.ai);
    const saved = store.upsertProject(r);
    state.stack.pop();
    if (isUpdate) {
      Object.assign(top(), { id: saved.id });
      render();
      toast(saved.changes?.length ? `업데이트 완료 · 변경 ${saved.changes.length}건` : '업데이트 완료 · 변경 없음');
    } else push('report', { id: saved.id, tab: 'summary' });
  } catch (e) {
    console.error(e);
    state.stack.pop();
    render();
    toast(`분석 실패: ${e.message}`);
  } finally {
    state.busy = false;
  }
}

// ───────── 리포트 ─────────
const TABS = [
  ['summary', '종합 분석', icon.bars],
  ['earn', '수익·전략', icon.coins],
  ['invest', '투자자', icon.users],
  ['onchain', '온체인', icon.cube],
  ['exchange', '거래소', icon.exch],
  ['risk', '리스크', icon.shield],
  ['timeline', '일정·뉴스', icon.clock],
  ['memo', '메모', icon.note],
];

function viewReport(t) {
  const p = store.getProject(t.id);
  if (!p) return '<div class="screen"><div class="empty">프로젝트를 찾을 수 없습니다.</div></div>';
  const m = p.market || {};
  const tr = p.scores?.trust || {};
  const po = p.scores?.potential || {};
  const tab = t.tab || 'summary';
  const s = store.getSettings();
  const ch7 = m.spark?.length > 1 ? ((m.spark[m.spark.length - 1] - m.spark[0]) / m.spark[0]) * 100 : m.change7d;
  return `<div class="screen">
  <div class="topbar">
    <button class="ibtn plain" data-act="back" aria-label="뒤로">${icon.back}</button>
    <h1 style="font-size:18px">${esc(p.name)}</h1>
    <button class="ibtn plain" data-act="share" aria-label="공유">${icon.share}</button>
    <button class="ibtn plain" data-act="update" aria-label="업데이트">${icon.refresh}</button>
  </div>
  <div class="hero">
    <div class="hero-top">${avatar(p)}
      <div style="flex:1;min-width:0"><h2>${esc(p.name)}<span class="sympill">${esc((p.symbol || '').toUpperCase())}</span></h2>
        <div class="tagline">${esc(tagline(p))}</div></div>
      <div class="score-col">${arc(tr.score, { big: true, label: '신뢰도' })}<div style="margin-top:-8px">${gradeBadge(p)}</div></div>
    </div>
    <div class="pmeta" style="margin-top:10px">${(p.classification?.types || []).slice(0, 3).map((x) => typeTag(x.key)).join('')}${stageTag(p.stage)}${m.rank ? `<span class="tag">#${m.rank}</span>` : ''}</div>
    ${m.price || m.mcap ? `<div class="metrics">
      <div><span>시가총액</span><b>${usd(m.mcap)}</b>${m.change24h != null ? `<i class="${cls(m.change24h)}">${m.change24h > 0 ? '▲' : '▼'} ${Math.abs(m.change24h).toFixed(1)}%</i>` : ''}</div>
      <div><span>24h 거래량</span><b>${usd(m.volume24h)}</b>${m.mcap && m.volume24h ? `<i class="muted">시총의 ${((m.volume24h / m.mcap) * 100).toFixed(0)}%</i>` : ''}</div>
      <div><span>현재 가격</span><b>${usd(m.price)}</b>${m.priceKrw ? `<i class="muted">${krw(m.priceKrw)}</i>` : ''}</div>
      ${m.spark?.length > 1 ? `<div class="chart"><span class="lbl ${cls(ch7)}" style="background:${ch7 >= 0 ? '#34e0a11c' : '#ff6b811c'}">7일 ${pct(ch7)}</span>${areaSpark(m.spark, { up: ch7 >= 0 })}</div>` : ''}
    </div>` : `<div class="metrics"><div style="grid-column:1/-1"><span>시세</span><b>${p.stage === 'pre-tge' ? '토큰 미발행 (TGE 전)' : '시세 정보 없음'}</b></div></div>`}
    <div class="hero-actions">
      <div class="pot">${arc(po.score)}<div><b>가능성 ${po.g || '-'}</b><span>${esc(po.label || '')}</span></div></div>
      <div class="stars" aria-label="우선순위">${[1, 2, 3, 4, 5].map((i) => `<button class="${i <= (p.priority || 0) ? 'on' : ''}" data-act="prio" data-v="${i}">★</button>`).join('')}</div>
    </div>
    <div class="updated">마지막 분석 ${ago(p.updatedAt)} · 출처 ${p.sources?.length || 0}곳${p.ai ? ' · <span class="pill-ai">AI 웹조사</span>' : ''}</div>
  </div>
  ${p.changes?.length ? `<div class="changes"><b>지난 분석 대비 변경</b><br>${p.changes.map((c) => `${esc(c.label)} ${c.from ? `${esc(c.from)} → ` : ''}${esc(c.to)} <span class="${c.up ? 'up' : 'down'}">(${esc(c.delta)})</span>`).join(' · ')}</div>` : ''}
  <div class="tabs">${TABS.map(([k, l, ic]) => `<button class="tab ${tab === k ? 'on' : ''}" data-act="tab" data-k="${k}">${ic}${l}</button>`).join('')}</div>
  ${{ summary: tabSummary, earn: tabEarn, invest: tabInvest, onchain: tabOnchain, exchange: tabExchange, risk: tabRisk, timeline: tabTimeline, memo: tabMemo }[tab](p)}
  <div class="disclaimer">본 분석은 공개 데이터와 자동 규칙으로 생성된 참고 정보이며 투자 권유가 아닙니다.</div>
  <div class="actionbar">
    ${p.ai ? `<button class="btn" data-act="update">${icon.refresh} 최신 데이터로 업데이트</button>` : `<button class="btn" data-act="${s.claudeKey ? 'aiRun' : 'aiNeedKey'}">${icon.search} 이 프로젝트 더 분석하기 (AI)</button>`}
  </div>
</div>`;
}

const factorList = (fs = []) =>
  fs.map((f) => `<div class="factor"><span class="d ${f.delta > 0 ? 'up' : f.delta < 0 ? 'down' : ''}">${f.delta > 0 ? '+' : ''}${Math.round(f.delta)}</span><div class="grow"><b>${esc(f.label)}</b>${f.note ? ` <span class="muted">${esc(f.note)}</span>` : ''}</div></div>`).join('');

function tabSummary(p) {
  const o = p.overview || {};
  const m = p.market || {};
  const desc = p.ai?.overview || o.descriptionAi || o.description || '';
  const links = [['website', '🌐 웹사이트'], ['whitepaper', '📄 백서'], ['twitter', '𝕏 트위터'], ['discord', '💬 디스코드'], ['telegram', '✈️ 텔레그램'], ['github', '🧑‍💻 깃허브']].filter(([k]) => o[k]);
  const hist = p.history || [];
  const highs = (p.risks || []).filter((r) => r.level === 'high').length;
  const mids = (p.risks || []).filter((r) => r.level === 'mid').length;
  const level = highs ? ['🚨', '높은 리스크', 'var(--bad)'] : mids >= 2 ? ['⚠️', '중간 리스크', 'var(--warn)'] : ['✅', '낮은 리스크', 'var(--good)'];
  const checks = [...(p.scores?.trust?.factors || [])].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 4);
  const circ = m.fdv && m.mcap ? (m.mcap / m.fdv) * 100 : m.circ && (m.max || m.total) ? (m.circ / (m.max || m.total)) * 100 : null;
  return `
  ${p.thin ? `<div class="sec" style="border-color:#fbbf3c66"><h3>⚠️ 데이터 부족</h3><p>공개 데이터베이스에서 이 프로젝트를 찾지 못했습니다. 아주 초기 프로젝트이거나 이름이 다를 수 있어요. 아래 [더 분석하기]로 AI 웹 조사를 실행하면 웹 검색으로 정보를 모읍니다.</p></div>` : ''}
  <div class="sec"><h3>${icon.doc} 프로젝트 개요 ${p.ai ? '<span class="pill-ai">AI</span>' : ''}</h3>
    ${p.ai?.summary ? `<p><b>${esc(p.ai.summary)}</b></p>` : ''}
    ${desc ? `<p style="white-space:pre-line">${esc(desc.slice(0, 1200))}${desc.length > 1200 ? '…' : ''}</p>` : '<p class="muted">설명 정보가 없습니다.</p>'}
    ${(o.categories || []).length ? `<div class="pmeta" style="margin:6px 0 10px">${[...new Set(o.categories)].slice(0, 8).map((c) => `<span class="tag">${esc(c)}</span>`).join('')}</div>` : ''}
    ${links.length ? `<div class="links">${links.map(([k, l]) => `<a href="${esc(o[k])}" target="_blank" rel="noopener">${l}</a>`).join('')}</div>` : ''}
  </div>
  <div class="sec"><h3>${icon.bars} 핵심 지표</h3><div class="kpis">
    <div><span>X 팔로워</span><b>${p.community?.twitter ? num(p.community.twitter) : '-'}</b></div>
    <div><span>개발 활동</span><b class="${p.dev?.commits4w > 20 ? 'grad-text' : ''}">${p.dev ? (p.dev.commits4w > 20 ? '활발함' : p.dev.commits4w > 0 ? '보통' : '정체') : '-'}</b></div>
    <div><span>보유자 수</span><b>${p.onchain?.holders?.count ? num(p.onchain.holders.count) : '-'}</b></div>
    <div><span>유통률</span><b>${circ ? circ.toFixed(0) + '%' : '-'}</b></div>
  </div></div>
  <div class="sec"><h3>${icon.shield} 리스크 분석 <span class="more" data-act="tab" data-k="risk">더보기 ›</span></h3>
    <div class="riskhead"><span class="big">${level[0]}</span><div style="flex:1"><b style="color:${level[2]}">${level[1]}</b><span class="muted" style="font-size:13px">위험 신호 높음 ${highs} · 중간 ${mids}</span></div></div>
    <div class="checks" style="margin-top:12px">${checks.map((f) => `<div><span class="${f.delta > 0 ? 'ok' : f.delta < -5 ? 'no' : 'mid'}">${f.delta > 0 ? '✔' : '✖'}</span><span>${esc(f.label)}${f.note ? ` <span class="muted">· ${esc(f.note)}</span>` : ''}</span></div>`).join('')}</div>
  </div>
  <div class="sec"><h3>프로젝트 분류</h3><div class="typegrid">
    ${(p.classification?.types || []).map((t, i) => { const T = PROJECT_TYPES[t.key]; return `<div class="typeitem" style="--c:${T.color}"><span class="ic">${T.icon}</span><div class="grow"><b>${esc(T.label)}</b>${i === 0 ? ' <span class="tag">주 유형</span>' : ''}${t.ai ? ' <span class="pill-ai">AI</span>' : ''}<div class="s">${esc(t.reasons.join(' · '))}</div></div></div>`; }).join('')}
  </div></div>
  <div class="sec"><h3>${icon.coins} 참여 수익 방식 <span class="more" data-act="tab" data-k="earn">전략 보기 ›</span></h3><div class="typegrid">
    ${(p.earnMethods || []).map((mm) => `<div class="typeitem" style="--c:var(--acc)"><span class="ic">${EARN_METHODS[mm.key].icon}</span><div class="grow"><b>${esc(mm.label)}</b>${mm.ai ? ' <span class="pill-ai">AI</span>' : ''}<div class="s">${esc(mm.why)}</div></div><span class="fit ${mm.fit}">${{ high: '추천', mid: '가능', low: '제한적' }[mm.fit]}</span></div>`).join('')}
  </div></div>
  ${m.price || m.mcap ? `<div class="sec"><h3>시장 데이터</h3><div class="kv">
    <div><span>완전희석가치(FDV)</span><b>${usd(m.fdv)}</b></div><div><span>7일 / 30일</span><b><span class="${cls(m.change7d)}">${pct(m.change7d)}</span> / <span class="${cls(m.change30d)}">${pct(m.change30d)}</span></b></div>
    <div><span>유통량</span><b>${num(m.circ)}</b></div><div><span>총 / 최대 공급</span><b>${num(m.total)} / ${num(m.max)}</b></div>
    <div><span>사상최고가(ATH)</span><b>${usd(m.ath)}</b></div><div><span>ATH 대비</span><b class="${cls(m.athChange)}">${pct(m.athChange, 0)}</b></div>
  </div>${circ ? `<div style="margin-top:12px"><div class="muted" style="font-size:12.5px;margin-bottom:6px">유통 비율 ${circ.toFixed(0)}% (나머지는 향후 언락 물량)</div><div class="bar"><i style="width:${Math.min(100, circ)}%"></i></div></div>` : ''}</div>` : ''}
  <div class="sec"><h3>신뢰도 근거 <span class="muted">${p.scores.trust.score}점</span></h3>${factorList(p.scores.trust.factors)}</div>
  <div class="sec"><h3>가능성 근거 <span class="muted">${p.scores.potential.score}점</span></h3>${factorList(p.scores.potential.factors)}</div>
  <div class="sec"><h3>분석 이력 <span class="muted">${hist.length}회</span></h3>
    <div class="muted" style="font-size:12.5px">신뢰도 추이</div>${sparkline(hist.map((h) => h.trust), { color: 'var(--good)' })}
    ${hist.filter((h) => h.price).length > 1 ? `<div class="muted" style="font-size:12.5px;margin-top:8px">가격 추이</div>${sparkline(hist.map((h) => h.price))}` : ''}
  </div>
  ${p.team?.length ? `<div class="sec"><h3>${icon.users} 팀</h3>${p.team.slice(0, 8).map((x) => `<div class="row"><div class="avatar" style="width:34px;height:34px;font-size:12px">${esc((x.name || '?')[0])}</div><div class="grow"><div class="t">${esc(x.name)}</div><div class="s">${esc(x.role || '')}</div></div></div>`).join('')}</div>` : ''}
  <div class="sec"><h3>데이터 출처</h3><div class="links">${(p.sources || []).slice(0, 14).map((x) => `<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc((x.title || '').slice(0, 28))}</a>`).join('')}</div></div>`;
}

// ───────── 계산기 ─────────
function viewCalc(t) {
  const c = t.v || (t.v = { mode: 'target' });
  const f = (name, label, ph) => `<div class="field"><label for="c-${name}">${label}</label><input id="c-${name}" name="${name}" inputmode="decimal" placeholder="${ph}" value="${esc(c[name] ?? '')}"></div>`;
  const forms = {
    target: f('amount', '투자 금액 ($)', '500') + f('buy', '토큰 매입 가격 ($)', '0.10') + f('target', '목표 가격 ($)', '0.25'),
    node: f('cost', '노드 구매 비용 ($)', '1500') + f('daily', '하루 보상 토큰 수', '40') + f('price', '토큰 예상 가격 ($)', '0.08') + f('opex', '월 운영비 ($)', '0'),
    airdrop: f('alloc', '예상 에어드랍 토큰 수', '2000') + f('price', '예상 상장가 ($)', '0.30') + f('prob', '수령 확률 (%)', '40') + f('cost', '참여 비용(가스비 등, $)', '20'),
  };
  const notes = {
    target: '보유 수량 = 투자금 ÷ 매입가. 거래 수수료·세금은 제외됩니다.',
    node: '월 순수익 = 하루 보상 × 30일 × 토큰 가격 − 운영비. 보상 감소(반감기)와 가격 하락은 반영되지 않습니다.',
    airdrop: '기대값 = 토큰 수 × 상장가 × 수령 확률 − 참여 비용. 시빌(다계정) 판정 시 0이 될 수 있습니다.',
  };
  return `<div class="screen">
  <div class="topbar"><button class="ibtn" data-act="back" aria-label="뒤로">${icon.back}</button><h1>수익 계산기</h1></div>
  <div class="calc-hero"><span class="ill">💰</span><b>투자 수익을<br>간편하게 계산해보세요!</b></div>
  <div class="seg">${[['target', '토큰 수익률'], ['node', '노드 회수'], ['airdrop', '에어드랍']].map(([k, l]) => `<button class="${c.mode === k ? 'on' : ''}" data-act="calcMode" data-k="${k}">${l}</button>`).join('')}</div>
  <form class="pad" data-form="calc">${forms[c.mode]}</form>
  <div id="calcOut">${calcOut(c)}</div>
  <div class="sec" style="margin-top:4px"><h3>💡 계산 기준 안내</h3><p class="muted" style="font-size:13.5px">${notes[c.mode]}<br>※ 결과는 참고용이며 실제 수익은 달라질 수 있습니다.</p></div>
</div>`;
}
function calcOut(c) {
  const n = (k) => parseFloat(c[k]) || 0;
  const box = (big, line, pill) => `<div class="calc-out"><span class="ill">📈</span><div class="grow"><div class="big">${big}</div><div class="line">${line}</div></div>${pill ? `<span class="pctpill">${pill}</span>` : ''}</div>`;
  if (c.mode === 'node') {
    if (!n('cost') || !n('daily')) return '';
    const monthly = n('daily') * 30 * n('price') - n('opex');
    return box(`월 $${monthly.toFixed(2)}`, `원금 회수 ${monthly > 0 ? `<b>${(n('cost') / monthly).toFixed(1)}개월</b>` : '<b class="down">불가</b>'}`, monthly > 0 ? `연 ${(((monthly * 12) / n('cost')) * 100).toFixed(0)}%` : '');
  }
  if (c.mode === 'target') {
    if (!n('amount') || !n('buy')) return '';
    const qty = n('amount') / n('buy');
    if (!n('target')) return box(`${num(qty)}개`, '보유 예정 수량', '');
    const total = qty * n('target');
    const r = (n('target') / n('buy') - 1) * 100;
    return box(`${total - n('amount') >= 0 ? '+' : '-'}$${Math.abs(total - n('amount')).toFixed(2)}`, `평가액: $${total.toFixed(2)} · 보유 ${num(qty)}개`, `${r >= 0 ? '+' : ''}${r.toFixed(1)}%`);
  }
  if (!n('alloc') || !n('price')) return '';
  const ev = (n('alloc') * n('price') * (n('prob') || 100)) / 100 - n('cost');
  return box(`$${ev.toFixed(2)}`, `수령 시 총액 $${(n('alloc') * n('price')).toFixed(2)} · 확률 ${n('prob') || 100}%`, '기대값');
}

// ───────── 설정 ─────────
function viewSettings() {
  const s = store.getSettings();
  return `<div class="screen">
  <div class="topbar"><button class="ibtn" data-act="back" aria-label="뒤로">${icon.back}</button><h1>설정</h1></div>
  <form data-form="settings">
  <div class="sec"><h3>${icon.sparkle} AI 웹 심층 조사</h3>
    <p class="muted" style="font-size:13.5px">Claude API 키를 등록하면 웹 검색으로 최신 뉴스·토크노믹스·언락·에어드랍 조건·상장 루머까지 조사합니다. 키는 이 기기에만 저장됩니다.</p>
    <div class="field"><label for="claudeKey">Claude API 키</label><input id="claudeKey" name="claudeKey" type="password" value="${esc(s.claudeKey)}" placeholder="sk-ant-..." autocomplete="off"><div class="hint">console.anthropic.com 에서 발급 · 사용량만큼 과금</div></div>
    <div class="field"><label for="claudeModel">모델</label><select id="claudeModel" name="claudeModel">
      ${[['claude-opus-5-5', 'Claude Opus 5.5 (권장·정확)'], ['claude-sonnet-5-5', 'Claude Sonnet 5.5 (빠름·저렴)'], ['claude-haiku-5-5', 'Claude Haiku 5.5 (가장 저렴)']].map(([v, l]) => `<option value="${v}" ${s.claudeModel === v ? 'selected' : ''}>${l}</option>`).join('')}
    </select></div>
    <div class="field"><label for="aiEffort">조사 깊이</label><select id="aiEffort" name="aiEffort">
      ${[['low', '빠르게'], ['medium', '보통 (권장)'], ['high', '깊게']].map(([v, l]) => `<option value="${v}" ${s.aiEffort === v ? 'selected' : ''}>${l}</option>`).join('')}
    </select></div>
    <div class="switch"><div><b>분석 시 AI 조사 자동 실행</b><div class="muted" style="font-size:12.5px">끄면 리포트 하단 버튼으로 수동 실행</div></div><button type="button" class="toggle ${s.aiAuto ? 'on' : ''}" data-act="toggleAi" aria-label="AI 자동 실행"></button></div>
  </div>
  <div class="sec"><h3>데이터 소스</h3>
    <div class="field"><label for="coingeckoKey">CoinGecko Demo API 키 (선택)</label><input id="coingeckoKey" name="coingeckoKey" value="${esc(s.coingeckoKey)}" placeholder="CG-..." autocomplete="off"><div class="hint">무료 키를 넣으면 요청 한도 초과(429) 오류가 줄어듭니다.</div></div>
    <p class="muted" style="font-size:12.5px">사용 소스: CoinGecko · CoinPaprika · DefiLlama · DexScreener · GoPlus · 업비트 · 빗썸 · 바이낸스 · OKX · 바이비트 · 코인베이스 · Gate</p>
  </div>
  <div style="padding:0 16px"><button class="btn block" type="submit">저장</button></div>
  </form>
  <div class="sec" style="margin-top:12px"><h3>백업 / 복원</h3>
    <p class="muted" style="font-size:13px">분석 목록·메모·체크리스트를 파일로 내보내거나 가져옵니다.</p>
    <div style="display:flex;gap:8px"><button class="btn sm ghost" style="flex:1" data-act="export">내보내기</button><button class="btn sm ghost" style="flex:1" data-act="import">가져오기</button></div>
    <input type="file" id="importFile" accept="application/json" hidden>
  </div>
</div>`;
}

// ───────── 오버레이 ─────────
function renderOverlay() {
  document.getElementById('overlay')?.remove();
  const o = state.overlay;
  if (!o) return;
  const el = document.createElement('div');
  el.id = 'overlay';
  let html = '';
  const resultBtn = (r, i, act) => `<button class="result" data-act="${act}" data-i="${i}">${avatar(r)}<div style="flex:1;min-width:0"><div style="font-weight:700">${esc(r.name)} <span class="muted">${esc((r.symbol || '').toUpperCase())}</span></div><div class="muted" style="font-size:12.5px">${r.rank ? `시총 #${r.rank}` : '순위 없음 · 초기 프로젝트일 수 있음'}${r.change24h != null ? ` · <span class="${cls(r.change24h)}">${pct(r.change24h)}</span>` : ''}</div></div><span class="chev">${icon.chev}</span></button>`;
  const loading = (msg) => `<div class="empty"><div class="orbit" style="width:60px;height:60px;margin:6px auto"></div>${msg}</div>`;
  if (o.type === 'exit') {
    html = `<div class="scrim center" data-act="scrim"><div class="dialog"><h3>앱 종료</h3><p>앱을 종료하겠습니까?</p><div class="acts"><button class="btn ghost" data-act="close">아니오</button><button class="btn" data-act="exitApp">예</button></div></div></div>`;
  } else if (o.type === 'confirm') {
    html = `<div class="scrim center" data-act="scrim"><div class="dialog"><h3>${esc(o.title)}</h3><p>${esc(o.msg)}</p><div class="acts"><button class="btn ghost" data-act="close">취소</button><button class="btn ${o.danger ? 'danger' : ''}" data-act="confirmOk">${esc(o.ok || '확인')}</button></div></div></div>`;
  } else if (o.type === 'results') {
    html = `<div class="scrim" data-act="scrim"><div class="sheet"><div class="grab"></div><h3>"${esc(o.query)}" 검색 결과 <span class="muted" style="font-size:14px">${o.loading ? '' : o.results.length}</span></h3>
      ${o.loading ? loading('검색 중…') : `${o.results.map((r, i) => resultBtn(r, i, 'pick')).join('')}
      <button class="result" data-act="pickRaw" style="border-style:dashed"><div class="avatar">✨</div><div style="flex:1"><div style="font-weight:700">목록에 없어요 — "${esc(o.query)}" 그대로 조사</div><div class="muted" style="font-size:12.5px">TGE 전 신규 프로젝트 · AI 웹 조사 권장</div></div></button>`}
    </div></div>`;
  } else if (o.type === 'trending') {
    html = `<div class="scrim" data-act="scrim"><div class="sheet"><div class="grab"></div><h3>${icon.fire} 인기 프로젝트 <span class="muted" style="font-size:13px">CoinGecko 실시간 검색 순위</span></h3>
      ${o.loading ? loading('불러오는 중…') : o.results.map((r, i) => resultBtn(r, i, 'pickTrend')).join('') || '<div class="empty">인기 목록을 불러오지 못했습니다.</div>'}
    </div></div>`;
  } else if (o.type === 'filter') {
    const all = store.listProjects();
    const types = [...new Set(all.flatMap((p) => (p.classification?.types || []).slice(0, 2).map((t) => t.key)))];
    const methods = [...new Set(all.flatMap((p) => (p.earnMethods || []).map((m) => m.key)))];
    html = `<div class="scrim" data-act="scrim"><div class="sheet"><div class="grab"></div><h3>${icon.filter} 필터</h3>
      <h4>프로젝트 유형</h4><div class="chips"><button class="chip soft ${!state.filterType ? 'on' : ''}" data-act="ftype" data-k="">전체</button>${types.map((k) => `<button class="chip soft ${state.filterType === k ? 'on' : ''}" data-act="ftype" data-k="${k}">${PROJECT_TYPES[k].icon} ${esc(PROJECT_TYPES[k].short || PROJECT_TYPES[k].label)}</button>`).join('')}</div>
      <h4>참여 수익 방식</h4><div class="chips"><button class="chip soft ${!state.filterMethod ? 'on' : ''}" data-act="fmethod" data-k="">전체</button>${methods.map((k) => `<button class="chip soft ${state.filterMethod === k ? 'on' : ''}" data-act="fmethod" data-k="${k}">${EARN_METHODS[k].icon} ${esc(EARN_METHODS[k].label)}</button>`).join('')}</div>
      <button class="btn block" style="margin-top:18px" data-act="close">적용</button>
    </div></div>`;
  }
  el.innerHTML = html;
  document.body.appendChild(el);
}

// ═════════ 액션 ═════════
const actions = {
  back: pop,
  nav: (el) => goRoot(el.dataset.k),
  settings: () => push('settings'),
  guide: () => push('guide'),
  calcPage: () => push('calc', { v: { mode: 'target' } }),
  close: closeOverlay,
  scrim: (el, e) => { if (e.target === el && !state.overlay?.locked) closeOverlay(); },
  exitApp: () => { closeOverlay(); AppPlugin ? AppPlugin.exitApp() : toast('브라우저에서는 종료할 수 없습니다'); },
  confirmOk: () => { const fn = state.overlay?.onOk; closeOverlay(); fn?.(); },
  quick: (el) => doSearch(el.dataset.q),
  focusSearch: () => { const i = document.getElementById('q'); i?.focus(); i?.scrollIntoView({ block: 'center' }); },
  open: (el) => push('report', { id: el.dataset.id, tab: 'summary' }),
  seg: (el) => { state.seg = el.dataset.k; if (top().view !== 'home') goRoot('home'); else render(); },
  filterSheet: () => openOverlay({ type: 'filter' }),
  ftype: (el) => { state.filterType = el.dataset.k || null; render(); },
  fmethod: (el) => { state.filterMethod = el.dataset.k || null; render(); },
  select: () => {
    if (!store.listProjects().length) return toast('먼저 프로젝트를 분석하세요');
    state.stack = [{ view: 'home' }];
    state.select = true;
    state.edit = false;
    render();
  },
  edit: () => { state.edit = true; state.select = false; render(); },
  exitSelect: () => { state.select = state.edit = false; state.selected.clear(); render(); },
  selectAll: () => { const all = store.listProjects(); if (state.selected.size === all.length) state.selected.clear(); else all.forEach((p) => state.selected.add(p.id)); render(); },
  toggleSel: (el) => { const id = el.dataset.id; state.selected.has(id) ? state.selected.delete(id) : state.selected.add(id); render(); },
  mv: (el, e) => {
    e.stopPropagation();
    const ids = store.sortedProjects('manual').map((p) => p.id);
    const i = ids.indexOf(el.dataset.id);
    const j = i + +el.dataset.d;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    store.reorder(ids);
    render();
  },
  deleteSel: () => openOverlay({ type: 'confirm', title: '삭제', msg: `선택한 ${state.selected.size}개 프로젝트를 삭제할까요?`, ok: '삭제', danger: true, onOk: () => { store.deleteProjects([...state.selected]); state.selected.clear(); state.select = false; render(); toast('삭제했습니다'); } }),
  deleteOne: () => openOverlay({ type: 'confirm', title: '삭제', msg: '이 프로젝트와 메모를 삭제할까요?', ok: '삭제', danger: true, onOk: () => { store.deleteProjects([top().id]); pop(); toast('삭제했습니다'); } }),
  compare: () => { const ids = [...state.selected]; state.select = false; state.selected.clear(); push('compare', { ids }); },
  tab: (el) => { top().tab = el.dataset.k; render(); const tabs = document.querySelector('.tabs'); if (tabs && window.scrollY > tabs.offsetTop) tabs.scrollIntoView({ block: 'start' }); },
  prio: (el) => { store.patchProject(top().id, { priority: +el.dataset.v }); render(); },
  update: () => { const p = store.getProject(top().id); runAnalysis({ query: p.query, pick: p.pick, isUpdate: true }); },
  aiRun: () => { const p = store.getProject(top().id); runAnalysis({ query: p.query, pick: p.pick, isUpdate: true, forceAi: true }); },
  aiNeedKey: () => openOverlay({ type: 'confirm', title: 'AI 웹 심층 조사', msg: '웹 검색으로 최신 뉴스·토크노믹스·에어드랍 조건까지 조사하려면 Claude API 키가 필요합니다. 설정으로 이동할까요?', ok: '설정으로', onOk: () => push('settings') }),
  step: (el) => { const p = store.getProject(top().id); const prog = { ...(p.progress || {}) }; prog[el.dataset.k] = !prog[el.dataset.k]; store.patchProject(p.id, { progress: prog }); render(); },
  copy: async (el) => { try { await navigator.clipboard.writeText(el.dataset.v); toast('주소를 복사했습니다'); } catch { toast(el.dataset.v); } },
  share: async () => {
    const p = store.getProject(top().id);
    const text = shareText(p);
    try {
      if (navigator.share) await navigator.share({ title: `${p.name} 분석`, text });
      else { await navigator.clipboard.writeText(text); toast('요약을 복사했습니다'); }
    } catch { /* 공유 취소 */ }
  },
  calc: () => {
    const p = store.getProject(top().id);
    const price = p?.market?.price ? String(+p.market.price.toPrecision(4)) : '';
    const mode = p?.earnMethods?.some((m) => m.key === 'node') ? 'node' : p?.stage === 'pre-tge' ? 'airdrop' : 'target';
    push('calc', { v: { mode, buy: price, price } });
  },
  calcMode: (el) => { const t = top(); t.v = { mode: el.dataset.k, price: t.v?.price, buy: t.v?.buy }; render(); },
  pick: (el) => { const o = state.overlay; const r = o.results[+el.dataset.i]; closeOverlay(); runAnalysis({ query: o.query, pick: r }); },
  pickTrend: (el) => { const r = state.overlay.results[+el.dataset.i]; closeOverlay(); runAnalysis({ query: r.name, pick: r }); },
  pickRaw: () => { const q = state.overlay.query; closeOverlay(); runAnalysis({ query: q, pick: null, forceAi: true }); },
  trending: async () => {
    openOverlay({ type: 'trending', loading: true, results: [] });
    let results = [];
    try { results = await cgTrending(); } catch { toast('인기 목록을 불러오지 못했습니다'); }
    if (state.overlay?.type === 'trending') { state.overlay = { type: 'trending', results }; renderOverlay(); }
  },
  toggleAi: (el) => el.classList.toggle('on'),
  refreshAll: () => openOverlay({ type: 'confirm', title: '전체 업데이트', msg: `저장된 ${store.listProjects().length}개 프로젝트를 모두 최신 데이터로 업데이트할까요? (AI 조사는 제외, 1~2분 소요)`, ok: '업데이트', onOk: refreshAll }),
  export: () => {
    const blob = new Blob([JSON.stringify({ app: 'coin-verifier', v: 1, at: Date.now(), projects: store.listProjects() }, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `coin-verifier-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    toast('백업 파일을 저장했습니다');
  },
  import: () => document.getElementById('importFile').click(),
};

function shareText(p) {
  return [
    `[${p.name} (${(p.symbol || '').toUpperCase()}) 검증 리포트]`,
    `유형: ${(p.classification?.types || []).slice(0, 2).map((t) => t.label).join(', ')}`,
    `신뢰도 ${p.scores.trust.score}점(${p.scores.trust.g}) · 가능성 ${p.scores.potential.score}점(${p.scores.potential.g})`,
    p.market?.price ? `가격 ${usd(p.market.price)} · 시총 ${usd(p.market.mcap)}` : '토큰 미발행(TGE 전)',
    `참여방식: ${(p.earnMethods || []).map((m) => m.label).join(', ')}`,
    p.investors?.tier1?.length ? `주요 투자사: ${p.investors.tier1.slice(0, 5).join(', ')}` : '',
    `주요 리스크: ${(p.risks || []).filter((r) => r.level === 'high').map((r) => r.text).slice(0, 2).join(' / ') || '큰 위험 신호 없음'}`,
    '※ 투자 권유 아님 · 코인 검증기',
  ].filter(Boolean).join('\n');
}

async function refreshAll() {
  if (state.busy) return toast('다른 분석이 진행 중입니다');
  state.busy = true;
  const list = store.sortedProjects('manual');
  let n = 0;
  for (const p of list) {
    toast(`업데이트 중 ${++n}/${list.length} · ${p.name}`);
    try {
      const r = await analyzeProject({ query: p.query, pick: p.pick, skipAi: true });
      reapplyAi(r, p.ai);
      store.upsertProject(r);
    } catch (e) {
      console.warn(e);
    }
    if (ROOTS.includes(top().view)) render();
  }
  state.busy = false;
  toast(`전체 업데이트 완료 (${list.length}개)`);
  render();
}

async function doSearch(q) {
  q = (q || '').trim();
  if (!q) return toast('프로젝트 이름을 입력하세요');
  openOverlay({ type: 'results', query: q, loading: true, results: [] });
  let results = [];
  try {
    results = await searchCoins(q);
  } catch {
    toast('검색 서버 응답이 없어 직접 조사로 진행할 수 있어요');
  }
  if (state.overlay?.type !== 'results') return;
  state.overlay = { type: 'results', query: q, results };
  renderOverlay();
}

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el || !el.dataset.act) return;
  const fn = actions[el.dataset.act];
  if (fn) fn(el, e);
});
document.addEventListener('submit', (e) => {
  const form = e.target.closest('[data-form]');
  if (!form) return;
  e.preventDefault();
  const fd = Object.fromEntries(new FormData(form));
  if (form.dataset.form === 'search') {
    form.querySelector('input')?.blur();
    doSearch(fd.q);
  } else if (form.dataset.form === 'settings') {
    store.saveSettings({ ...fd, claudeKey: fd.claudeKey.trim(), coingeckoKey: fd.coingeckoKey.trim(), aiAuto: document.querySelector('[data-act=toggleAi]').classList.contains('on') });
    toast('저장했습니다');
    pop();
  }
});
document.addEventListener('input', (e) => {
  const el = e.target;
  if (el.closest('[data-form=calc]')) {
    top().v[el.name] = el.value;
    document.getElementById('calcOut').innerHTML = calcOut(top().v);
  } else if (el.dataset.change === 'memo') {
    clearTimeout(el._t);
    el._t = setTimeout(() => store.patchProject(top().id, { memo: el.value }), 400);
  }
});
document.addEventListener('change', async (e) => {
  const el = e.target;
  if (el.dataset.change === 'sort') {
    store.saveSettings({ sortMode: el.value });
    render();
  } else if (el.dataset.change === 'scam') {
    const p = store.getProject(top().id);
    store.patchProject(p.id, { scamCheck: { ...(p.scamCheck || {}), [el.dataset.i]: el.checked } });
    render();
  } else if (el.id === 'importFile' && el.files[0]) {
    try {
      const data = JSON.parse(await el.files[0].text());
      const incoming = data.projects || [];
      const map = new Map(store.listProjects().map((p) => [p.id, p]));
      for (const p of incoming) map.set(p.id, p);
      store.replaceAll([...map.values()]);
      toast(`${incoming.length}개 프로젝트를 가져왔습니다`);
    } catch {
      toast('백업 파일을 읽을 수 없습니다');
    }
  }
});

render();

// 미리보기/디버그용 훅 (#debug 일 때만)
if (location.hash.includes('debug')) window.__app = { state, push, render, openOverlay, store, goRoot };
