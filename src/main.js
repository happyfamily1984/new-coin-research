import * as store from './store.js';
import { searchCoins } from './api/sources.js';
import { analyzeProject, reapplyAi, STEPS } from './engine/analyze.js';
import { PROJECT_TYPES, EARN_METHODS } from './engine/taxonomy.js';
import { cautionKo } from './engine/strategy.js';
import { esc, usd, krw, num, pct, cls, ago, ring, sparkline, icon, short } from './util.js';

const $app = document.getElementById('app');
const Cap = window.Capacitor;
const AppPlugin = Cap?.Plugins?.App;

const state = {
  stack: [{ view: 'home' }],
  overlay: null, // {type, ...}
  select: false,
  selected: new Set(),
  edit: false,
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

// ═════════ 뒤로가기 ═════════
function handleBack() {
  if (state.overlay) {
    if (state.overlay.locked) return;
    closeOverlay();
    return;
  }
  if (state.select || state.edit) {
    state.select = false;
    state.edit = false;
    state.selected.clear();
    render();
    return;
  }
  const t = top();
  if (t.view === 'analyzing') return; // 분석 중에는 무시
  if (t.view === 'report' && t.tab && t.tab !== 'summary') {
    t.tab = 'summary';
    render();
    return;
  }
  if (state.stack.length > 1) {
    pop();
    return;
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

// ═════════ 렌더 ═════════
function render() {
  const t = top();
  const html = { home: viewHome, analyzing: viewAnalyzing, report: viewReport, settings: viewSettings, compare: viewCompare }[t.view](t);
  $app.innerHTML = html;
  if (t.view === 'home') bindDrag();
  renderOverlay();
}

const typeTag = (k) => {
  const t = PROJECT_TYPES[k];
  return t ? `<span class="tag type" style="--c:${t.color}">${t.icon} ${esc(t.short || t.label)}</span>` : '';
};
const stageTag = (s) => ({ 'pre-tge': '<span class="tag stage-pre-tge">TGE 전</span>', new: '<span class="tag stage-new">신규 상장</span>', listed: '<span class="tag">상장</span>' })[s] || '';
const avatar = (p) => `<div class="avatar">${p.logo ? `<img src="${esc(p.logo)}" alt="" onerror="this.remove()">` : ''}${esc((p.symbol || p.name || '?').slice(0, 2).toUpperCase())}</div>`;
const stars = (n) => '★'.repeat(n || 0) + '☆'.repeat(5 - (n || 0));

// ───────── 홈 ─────────
function viewHome() {
  const s = store.getSettings();
  const mode = state.edit ? 'manual' : s.sortMode;
  let list = store.sortedProjects(mode);
  const all = list;
  if (state.filterType) list = list.filter((p) => p.classification?.types?.some((t) => t.key === state.filterType));
  if (state.filterMethod) list = list.filter((p) => p.earnMethods?.some((m) => m.key === state.filterMethod));

  const typesPresent = [...new Set(all.flatMap((p) => (p.classification?.types || []).slice(0, 2).map((t) => t.key)))];
  const methodsPresent = [...new Set(all.flatMap((p) => (p.earnMethods || []).map((m) => m.key)))];
  const avgTrust = all.length ? Math.round(all.reduce((a, p) => a + (p.scores?.trust?.score || 0), 0) / all.length) : '-';
  const preTge = all.filter((p) => p.stage === 'pre-tge').length;

  return `<div class="screen">
  <div class="topbar">
    ${state.select ? `<button class="ibtn" data-act="exitSelect">${icon.back}</button><h1>${state.selected.size}개 선택</h1>
      <button class="btn sm ghost" data-act="selectAll">전체</button>` : state.edit ? `<button class="ibtn" data-act="exitSelect">${icon.back}</button><h1>순서 편집<small>손잡이를 끌거나 화살표로 이동</small></h1><button class="btn sm" data-act="exitSelect">완료</button>` : `<div class="logo-mark">V</div><h1>코인 검증기<small>신규 코인 프로젝트 분석</small></h1>
      ${all.length ? `<button class="ibtn" data-act="refreshAll" aria-label="전체 업데이트">${icon.refresh}</button>` : ''}
      <button class="ibtn" data-act="settings" aria-label="설정">${icon.gear}</button>`}
  </div>
  ${state.select || state.edit ? '' : `<form class="search" data-form="search">
    <div class="box">${icon.search}<input name="q" placeholder="프로젝트 이름 또는 심볼 (예: Berachain)" autocomplete="off" enterkeyhint="search"></div>
    <button class="btn" type="submit">분석</button>
  </form>
  ${all.length ? `<div class="stats">
    <div class="stat"><b>${all.length}</b><span>분석한 프로젝트</span></div>
    <div class="stat"><b>${avgTrust}</b><span>평균 신뢰도</span></div>
    <div class="stat"><b>${preTge}</b><span>TGE 전(에어드랍)</span></div>
  </div>` : ''}
  ${typesPresent.length > 1 ? `<div class="chips"><button class="chip ${!state.filterType ? 'on' : ''}" data-act="ftype" data-k="">전체 유형</button>${typesPresent.map((k) => `<button class="chip ${state.filterType === k ? 'on' : ''}" data-act="ftype" data-k="${k}">${PROJECT_TYPES[k].icon} ${esc(PROJECT_TYPES[k].short || PROJECT_TYPES[k].label)}</button>`).join('')}</div>` : ''}
  ${methodsPresent.length > 1 ? `<div class="chips"><button class="chip ${!state.filterMethod ? 'on' : ''}" data-act="fmethod" data-k="">전체 참여방식</button>${methodsPresent.map((k) => `<button class="chip ${state.filterMethod === k ? 'on' : ''}" data-act="fmethod" data-k="${k}">${EARN_METHODS[k].icon} ${esc(EARN_METHODS[k].label)}</button>`).join('')}</div>` : ''}
  `}
  ${all.length ? `<div class="label-row"><h3>내 프로젝트 <span class="muted">${list.length}</span></h3>
    ${state.select || state.edit ? '' : `<div style="display:flex;gap:6px">
      <select class="sel" data-change="sort">
        ${[['manual', '내 순서'], ['priority', '우선순위'], ['trust', '신뢰도'], ['potential', '가능성'], ['updated', '최근 업데이트']].map(([v, l]) => `<option value="${v}" ${s.sortMode === v ? 'selected' : ''}>${l}</option>`).join('')}
      </select>
      <button class="ibtn" style="width:34px;height:34px" data-act="edit" aria-label="순서 편집">${icon.sort}</button>
      <button class="ibtn" style="width:34px;height:34px" data-act="select" aria-label="선택">${icon.check}</button>
    </div>`}
  </div>` : ''}
  <div class="list" id="plist">
    ${list.map((p) => cardHtml(p)).join('') || (all.length ? '<div class="empty">조건에 맞는 프로젝트가 없습니다.</div>' : emptyHome())}
  </div>
  ${state.select ? `<div class="actionbar">
    <button class="btn ghost" data-act="compare" ${state.selected.size < 2 || state.selected.size > 3 ? 'disabled' : ''}>${icon.compare} 비교(2~3개)</button>
    <button class="btn danger" data-act="deleteSel" ${!state.selected.size ? 'disabled' : ''}>${icon.trash} 삭제</button>
  </div>` : ''}
</div>`;
}

function emptyHome() {
  return `<div class="empty"><div class="big">🔍</div><b>검증할 코인 프로젝트를 입력하세요</b>
  개요·투자자·온체인·거래소 상장·신뢰도·가능성·참여 전략까지<br>한 번에 분석해 목록에 저장합니다.
  <div class="chips" style="justify-content:center;margin-top:16px;flex-wrap:wrap">
    ${['Berachain', 'Monad', 'Hyperliquid', 'Pudgy Penguins', 'Aethir'].map((q) => `<button class="chip" data-act="quick" data-q="${q}">${q}</button>`).join('')}
  </div></div>`;
}

function cardHtml(p) {
  const sel = state.selected.has(p.id);
  const t = p.scores?.trust?.score;
  const m = p.market || {};
  return `<div class="pcard ${sel ? 'selected' : ''}" data-act="${state.select ? 'toggleSel' : state.edit ? '' : 'open'}" data-id="${esc(p.id)}">
    ${state.select ? `<div class="check">${icon.check}</div>` : ''}
    ${state.edit ? `<div class="handle" data-handle>${icon.grip}</div>` : ''}
    ${avatar(p)}
    <div class="pbody">
      <div class="pname">${esc(p.name)} <span class="sym">${esc((p.symbol || '').toUpperCase())}</span></div>
      <div class="pmeta">${typeTag(p.classification?.primary)}${stageTag(p.stage)}${p.exchanges?.korea?.upbit?.listed ? '<span class="tag good">업비트</span>' : ''}${p.onchain?.security?.honeypot ? '<span class="tag bad">허니팟</span>' : ''}</div>
      <div class="pmeta" style="margin-top:6px"><span class="prio">${stars(p.priority)}</span>
        <span class="muted" style="font-size:12px">${m.price ? `${usd(m.price)} <span class="${cls(m.change24h)}">${pct(m.change24h)}</span> · ` : ''}${ago(p.updatedAt)}</span></div>
    </div>
    ${state.edit ? `<div class="updown"><button data-act="mv" data-d="-1" data-id="${esc(p.id)}">▲</button><button data-act="mv" data-d="1" data-id="${esc(p.id)}">▼</button></div>` : `<div class="pscore">${ring(t)}<small>신뢰도</small></div>`}
  </div>`;
}

// 드래그로 순서 변경
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

// ───────── 분석 진행 ─────────
function viewAnalyzing(t) {
  const st = t.steps || {};
  return `<div class="screen"><div class="progress-wrap">
    <div class="orb"></div>
    <h2>${esc(t.name)} 분석 중</h2>
    <p>${t.isUpdate ? '최신 데이터로 업데이트하고 있어요' : '여러 데이터 소스를 교차 검증하고 있어요'}</p>
    ${STEPS.map((s, i) => {
      const v = st[s.key] || {};
      const mark = { done: '✓', skip: '–', fail: '!', run: '' }[v.state] ?? i + 1;
      return `<div class="step ${v.state || ''}"><div class="dot">${mark || i + 1}</div><div class="grow"><div>${s.label}</div>${v.note ? `<div class="s">${esc(v.note)}</div>` : ''}</div></div>`;
    }).join('')}
  </div></div>`;
}

async function runAnalysis({ query, pick, isUpdate = false, forceAi = false }) {
  if (state.busy) return;
  state.busy = true;
  const frame = { view: 'analyzing', name: pick?.name || query, steps: {}, isUpdate };
  if (isUpdate) state.stack.push(frame);
  else state.stack = [state.stack[0], frame];
  render();
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
  ['summary', '요약'],
  ['earn', '수익방식·전략'],
  ['invest', '투자자'],
  ['onchain', '온체인'],
  ['exchange', '거래소'],
  ['risk', '리스크'],
  ['timeline', '일정·뉴스'],
  ['memo', '메모'],
];

function viewReport(t) {
  const p = store.getProject(t.id);
  if (!p) return '<div class="screen"><div class="empty">프로젝트를 찾을 수 없습니다.</div></div>';
  const m = p.market || {};
  const tr = p.scores?.trust || {};
  const po = p.scores?.potential || {};
  const tab = t.tab || 'summary';
  const s = store.getSettings();
  return `<div class="screen">
  <div class="topbar">
    <button class="ibtn" data-act="back">${icon.back}</button>
    <h1 style="font-size:17px">${esc(p.name)}</h1>
    <button class="ibtn" data-act="share" aria-label="공유">${icon.share}</button>
    <button class="ibtn" data-act="update" aria-label="업데이트">${icon.refresh}</button>
  </div>
  <div class="hero">
    <div class="hero-top">${avatar(p)}<div style="flex:1;min-width:0"><h2>${esc(p.name)}<span>${esc((p.symbol || '').toUpperCase())}</span></h2>
      <div class="pmeta">${(p.classification?.types || []).slice(0, 3).map((x) => typeTag(x.key)).join('')}${stageTag(p.stage)}${m.rank ? `<span class="tag">#${m.rank}</span>` : ''}</div></div></div>
    ${m.price ? `<div class="price"><b>${usd(m.price)}</b><span class="${cls(m.change24h)}">${pct(m.change24h)} 24h</span>${m.priceKrw ? `<span class="muted" style="font-size:13px">${krw(m.priceKrw)}</span>` : ''}</div>` : `<div class="price"><b style="font-size:18px">${p.stage === 'pre-tge' ? '토큰 미발행 (TGE 전)' : '시세 정보 없음'}</b></div>`}
    <div class="gauges">
      <div class="gauge">${ring(tr.score)}<div><h4>신뢰도</h4><p>${tr.g || '-'} · ${esc(tr.label || '')}</p></div></div>
      <div class="gauge">${ring(po.score)}<div><h4>가능성</h4><p>${po.g || '-'} · ${esc(po.label || '')}</p></div></div>
    </div>
    <div class="hero-actions">
      <span class="muted" style="font-size:13px">우선순위</span>
      <div class="stars">${[1, 2, 3, 4, 5].map((i) => `<button class="${i <= (p.priority || 0) ? 'on' : ''}" data-act="prio" data-v="${i}">★</button>`).join('')}</div>
      <button class="btn sm" style="margin-left:auto" data-act="update">${icon.refresh} 업데이트</button>
    </div>
    <div class="updated">마지막 분석 ${ago(p.updatedAt)} · 출처 ${p.sources?.length || 0}곳${p.ai ? ' · <span class="pill-ai">AI 웹조사</span>' : ''}</div>
  </div>
  ${p.changes?.length ? `<div class="changes"><b>지난 분석 대비 변경</b><br>${p.changes.map((c) => `${esc(c.label)} ${c.from ? `${esc(c.from)} → ` : ''}${esc(c.to)} <span class="${c.up ? 'up' : 'down'}">(${esc(c.delta)})</span>`).join(' · ')}</div>` : ''}
  ${!p.ai ? `<div class="ai-banner">${icon.sparkle}<div class="grow"><b>AI 웹 심층 조사</b><br><span class="muted">${s.claudeKey ? '최신 뉴스·토크노믹스·에어드랍 조건을 웹에서 조사해 보강합니다.' : '설정에서 Claude API 키를 등록하면 TGE 전 프로젝트도 웹 검색으로 조사합니다.'}</span></div><button class="btn sm" data-act="${s.claudeKey ? 'aiRun' : 'settings'}">${s.claudeKey ? '실행' : '설정'}</button></div>` : ''}
  <div class="tabs">${TABS.map(([k, l]) => `<button class="tab ${tab === k ? 'on' : ''}" data-act="tab" data-k="${k}">${l}</button>`).join('')}</div>
  ${{ summary: tabSummary, earn: tabEarn, invest: tabInvest, onchain: tabOnchain, exchange: tabExchange, risk: tabRisk, timeline: tabTimeline, memo: tabMemo }[tab](p)}
  <div class="disclaimer">본 분석은 공개 데이터와 자동 규칙으로 생성된 참고 정보이며 투자 권유가 아닙니다.<br>투자 판단과 책임은 본인에게 있습니다.</div>
</div>`;
}

const factorList = (fs = []) =>
  fs.map((f) => `<div class="factor"><span class="d ${f.delta > 0 ? 'up' : f.delta < 0 ? 'down' : ''}">${f.delta > 0 ? '+' : ''}${Math.round(f.delta)}</span><div class="grow"><b>${esc(f.label)}</b>${f.note ? ` <span class="muted">${esc(f.note)}</span>` : ''}</div></div>`).join('');

function tabSummary(p) {
  const o = p.overview || {};
  const m = p.market || {};
  const desc = p.ai?.overview || o.descriptionAi || o.description || '';
  const links = [
    ['website', '🌐 웹사이트'], ['whitepaper', '📄 백서'], ['twitter', '𝕏 트위터'], ['discord', '💬 디스코드'], ['telegram', '✈️ 텔레그램'], ['github', '🧑‍💻 깃허브'],
  ].filter(([k]) => o[k]);
  const hist = p.history || [];
  return `
  ${p.thin ? `<div class="sec" style="border-color:#f6c45366"><h3>⚠️ 데이터 부족</h3><p>공개 데이터베이스에서 이 프로젝트를 찾지 못했습니다. 아주 초기 프로젝트이거나 이름이 다를 수 있어요. 설정에서 Claude API 키를 등록하고 [AI 웹 심층 조사]를 실행하면 웹 검색으로 정보를 모읍니다.</p></div>` : ''}
  ${p.ai?.summary ? `<div class="sec"><h3>${icon.sparkle} 핵심 요약 <span class="pill-ai">AI</span></h3><p>${esc(p.ai.summary)}</p></div>` : ''}
  <div class="sec"><h3>프로젝트 개요</h3>
    ${desc ? `<p style="white-space:pre-line">${esc(desc.slice(0, 1400))}${desc.length > 1400 ? '…' : ''}</p>` : '<p class="muted">설명 정보가 없습니다.</p>'}
    ${(o.categories || []).length ? `<div class="pmeta" style="margin:6px 0 10px">${[...new Set(o.categories)].slice(0, 8).map((c) => `<span class="tag">${esc(c)}</span>`).join('')}</div>` : ''}
    ${links.length ? `<div class="links">${links.map(([k, l]) => `<a href="${esc(o[k])}" target="_blank" rel="noopener">${l}</a>`).join('')}</div>` : ''}
  </div>
  <div class="sec"><h3>프로젝트 분류</h3><div class="typegrid">
    ${(p.classification?.types || []).map((t, i) => { const T = PROJECT_TYPES[t.key]; return `<div class="typeitem" style="--c:${T.color}"><span class="ic">${T.icon}</span><div class="grow"><b>${esc(T.label)}</b>${i === 0 ? ' <span class="tag">주 유형</span>' : ''}${t.ai ? ' <span class="pill-ai">AI</span>' : ''}<div class="s">${esc(t.reasons.join(' · '))}</div></div></div>`; }).join('')}
  </div></div>
  <div class="sec"><h3>참여 수익 방식 <span class="muted">적합도</span></h3><div class="typegrid">
    ${(p.earnMethods || []).map((mm) => `<div class="typeitem" style="--c:var(--acc)"><span class="ic">${EARN_METHODS[mm.key].icon}</span><div class="grow"><b>${esc(mm.label)}</b>${mm.ai ? ' <span class="pill-ai">AI</span>' : ''}<div class="s">${esc(mm.why)}</div></div><span class="fit ${mm.fit}">${{ high: '추천', mid: '가능', low: '제한적' }[mm.fit]}</span></div>`).join('')}
  </div><button class="btn sm ghost block" style="margin-top:10px" data-act="tab" data-k="earn">참여 전략 자세히 보기 →</button></div>
  ${m.price || m.mcap ? `<div class="sec"><h3>시장 데이터</h3><div class="kv">
    <div><span>시가총액</span><b>${usd(m.mcap)}</b></div><div><span>완전희석가치(FDV)</span><b>${usd(m.fdv)}</b></div>
    <div><span>24h 거래량</span><b>${usd(m.volume24h)}</b></div><div><span>7일 / 30일</span><b><span class="${cls(m.change7d)}">${pct(m.change7d)}</span> / <span class="${cls(m.change30d)}">${pct(m.change30d)}</span></b></div>
    <div><span>유통량</span><b>${num(m.circ)}</b></div><div><span>총 / 최대 공급</span><b>${num(m.total)} / ${num(m.max)}</b></div>
    <div><span>사상최고가(ATH)</span><b>${usd(m.ath)}</b></div><div><span>ATH 대비</span><b class="${cls(m.athChange)}">${pct(m.athChange, 0)}</b></div>
  </div>${m.fdv && m.mcap ? `<div style="margin-top:12px"><div class="muted" style="font-size:12.5px;margin-bottom:6px">유통 비율 ${((m.mcap / m.fdv) * 100).toFixed(0)}% (나머지는 향후 언락 물량)</div><div class="bar"><i style="width:${Math.min(100, (m.mcap / m.fdv) * 100)}%"></i></div></div>` : ''}</div>` : ''}
  <div class="sec"><h3>신뢰도 근거 <span class="muted">${p.scores.trust.score}점</span></h3>${factorList(p.scores.trust.factors)}</div>
  <div class="sec"><h3>가능성 근거 <span class="muted">${p.scores.potential.score}점</span></h3>${factorList(p.scores.potential.factors)}</div>
  <div class="sec"><h3>분석 이력 <span class="muted">${hist.length}회</span></h3>
    <div class="muted" style="font-size:12.5px">신뢰도 추이</div>${sparkline(hist.map((h) => h.trust), { color: 'var(--good)' })}
    ${hist.some((h) => h.price) ? `<div class="muted" style="font-size:12.5px;margin-top:8px">가격 추이</div>${sparkline(hist.map((h) => h.price))}` : ''}
  </div>
  ${p.team?.length ? `<div class="sec"><h3>팀</h3>${p.team.slice(0, 8).map((x) => `<div class="row"><div class="avatar" style="width:34px;height:34px;font-size:12px">${esc((x.name || '?')[0])}</div><div class="grow"><div class="t">${esc(x.name)}</div><div class="s">${esc(x.role || '')}</div></div></div>`).join('')}</div>` : ''}
  <div class="sec"><h3>데이터 출처</h3><div class="links">${(p.sources || []).slice(0, 14).map((x) => `<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc((x.title || '').slice(0, 28))}</a>`).join('')}</div></div>`;
}

function tabEarn(p) {
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
  <div class="sec"><h3>${icon.calc} 수익 계산기</h3>
    <p class="muted" style="font-size:13.5px">노드 회수 기간, 목표가 수익, 에어드랍 기대값을 계산해 보세요.</p>
    <button class="btn sm block" data-act="calc">계산기 열기</button>
  </div>`;
}

function tabInvest(p) {
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

function tabOnchain(p) {
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

function tabExchange(p) {
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

const SCAM_CHECKS = [
  '원금 보장 또는 확정 수익(일/월 %)을 약속한다',
  '지인 추천·모집 인원에 따라 수당이 커진다',
  '공식 사이트·백서·팀 정보가 불분명하다',
  '텔레그램/DM으로 먼저 연락해 투자를 권유했다',
  '"오늘만", "선착순" 등 결정을 재촉한다',
  '출금이 지연되거나 출금 수수료를 추가로 요구한다',
  '컨트랙트 주소를 공식 채널이 아닌 곳에서 받았다',
  '지갑 시드구문(복구문구) 입력을 요구한다',
];

function tabRisk(p) {
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

function tabTimeline(p) {
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

function tabMemo(p) {
  return `<div class="sec"><h3>내 메모</h3>
    <textarea class="memo" data-change="memo" placeholder="참여 지갑 주소, 퀘스트 진행, 매수가 등 자유롭게 기록하세요">${esc(p.memo || '')}</textarea>
    <p class="muted" style="font-size:12px;margin-top:6px">자동 저장됩니다. 시드구문·개인키는 절대 적지 마세요.</p>
  </div>
  <div class="sec"><h3>관리</h3><button class="btn danger block" data-act="deleteOne">${icon.trash} 이 프로젝트 삭제</button></div>`;
}

// ───────── 비교 ─────────
function viewCompare(t) {
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
function viewSettings() {
  const s = store.getSettings();
  return `<div class="screen">
  <div class="topbar"><button class="ibtn" data-act="back">${icon.back}</button><h1>설정</h1></div>
  <form data-form="settings">
  <div class="sec"><h3>${icon.sparkle} AI 웹 심층 조사</h3>
    <p class="muted" style="font-size:13.5px">Claude API 키를 등록하면 웹 검색으로 최신 뉴스·토크노믹스·언락·에어드랍 조건·상장 루머까지 조사합니다. 키는 이 기기에만 저장됩니다.</p>
    <div class="field"><label>Claude API 키</label><input name="claudeKey" type="password" value="${esc(s.claudeKey)}" placeholder="sk-ant-..." autocomplete="off"><div class="hint">console.anthropic.com 에서 발급 · 사용량만큼 과금</div></div>
    <div class="field"><label>모델</label><select name="claudeModel">
      ${[['claude-opus-5-5', 'Claude Opus 5.5 (권장·정확)'], ['claude-sonnet-5-5', 'Claude Sonnet 5.5 (빠름·저렴)'], ['claude-haiku-5-5', 'Claude Haiku 5.5 (가장 저렴)']].map(([v, l]) => `<option value="${v}" ${s.claudeModel === v ? 'selected' : ''}>${l}</option>`).join('')}
    </select></div>
    <div class="field"><label>조사 깊이</label><select name="aiEffort">
      ${[['low', '빠르게'], ['medium', '보통 (권장)'], ['high', '깊게']].map(([v, l]) => `<option value="${v}" ${s.aiEffort === v ? 'selected' : ''}>${l}</option>`).join('')}
    </select></div>
    <div class="switch"><div><b>분석 시 AI 조사 자동 실행</b><div class="muted" style="font-size:12.5px">끄면 리포트에서 수동 실행</div></div><button type="button" class="toggle ${s.aiAuto ? 'on' : ''}" data-act="toggleAi"></button></div>
  </div>
  <div class="sec"><h3>데이터 소스</h3>
    <div class="field"><label>CoinGecko Demo API 키 (선택)</label><input name="coingeckoKey" value="${esc(s.coingeckoKey)}" placeholder="CG-..." autocomplete="off"><div class="hint">무료 키를 넣으면 요청 한도 초과(429) 오류가 줄어듭니다.</div></div>
    <p class="muted" style="font-size:12.5px">사용 소스: CoinGecko · CoinPaprika · DefiLlama · DexScreener · GoPlus · 업비트 · 빗썸 · 바이낸스 · OKX · 바이비트 · 코인베이스 · Gate</p>
  </div>
  <button class="btn block" style="margin:0 16px;width:calc(100% - 32px)" type="submit">저장</button>
  </form>
  <div class="sec" style="margin-top:12px"><h3>백업 / 복원</h3>
    <p class="muted" style="font-size:13px">분석 목록·메모·체크리스트를 파일로 내보내거나 가져옵니다.</p>
    <div style="display:flex;gap:8px"><button class="btn sm ghost" style="flex:1" data-act="export">내보내기</button><button class="btn sm ghost" style="flex:1" data-act="import">가져오기</button></div>
    <input type="file" id="importFile" accept="application/json" hidden>
  </div>
  <div class="sec"><h3>정보</h3><p class="muted" style="font-size:13px">코인 검증기 v1.0.0<br>본 앱의 분석은 투자 권유가 아닙니다.</p></div>
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
  if (o.type === 'exit') {
    html = `<div class="scrim center" data-act="scrim"><div class="dialog"><h3>앱 종료</h3><p>앱을 종료하겠습니까?</p><div class="acts"><button class="btn ghost" data-act="close">아니오</button><button class="btn" data-act="exitApp">예</button></div></div></div>`;
  } else if (o.type === 'confirm') {
    html = `<div class="scrim center" data-act="scrim"><div class="dialog"><h3>${esc(o.title)}</h3><p>${esc(o.msg)}</p><div class="acts"><button class="btn ghost" data-act="close">취소</button><button class="btn ${o.danger ? 'danger' : ''}" data-act="confirmOk">${esc(o.ok || '확인')}</button></div></div></div>`;
  } else if (o.type === 'results') {
    html = `<div class="scrim" data-act="scrim"><div class="sheet"><div class="grab"></div><h3>"${esc(o.query)}" 검색 결과</h3>
      ${o.loading ? '<div class="empty"><div class="orb" style="width:50px;height:50px;margin:10px auto"></div>검색 중…</div>' : `
      ${o.results.map((r, i) => `<button class="result" data-act="pick" data-i="${i}">${avatar(r)}<div class="grow" style="flex:1;min-width:0"><div class="t" style="font-weight:700">${esc(r.name)} <span class="muted">${esc((r.symbol || '').toUpperCase())}</span></div><div class="muted" style="font-size:12.5px">${r.rank ? `시총 #${r.rank}` : '순위 없음 · 초기 프로젝트일 수 있음'}</div></div></button>`).join('')}
      <button class="result" data-act="pickRaw" style="border-style:dashed">${`<div class="avatar">✨</div>`}<div style="flex:1"><div style="font-weight:700">목록에 없어요 — "${esc(o.query)}" 그대로 조사</div><div class="muted" style="font-size:12.5px">TGE 전 신규 프로젝트 · AI 웹 조사 권장</div></div></button>`}
    </div></div>`;
  } else if (o.type === 'calc') {
    const c = o.v || { mode: 'node' };
    html = `<div class="scrim" data-act="scrim"><div class="sheet"><div class="grab"></div><h3>${icon.calc} 수익 계산기</h3>
      <div class="chips" style="padding:0 0 12px">${[['node', '노드 회수기간'], ['target', '목표가 수익'], ['airdrop', '에어드랍 기대값']].map(([k, l]) => `<button class="chip ${c.mode === k ? 'on' : ''}" data-act="calcMode" data-k="${k}">${l}</button>`).join('')}</div>
      <form data-form="calc">${calcForm(c)}</form><div id="calcOut">${calcOut(c)}</div></div></div>`;
  }
  el.innerHTML = html;
  document.body.appendChild(el);
}

function calcForm(c) {
  const f = (name, label, ph, val) => `<div class="field"><label>${label}</label><input name="${name}" inputmode="decimal" placeholder="${ph}" value="${esc(val ?? '')}"></div>`;
  if (c.mode === 'node') return f('cost', '노드 구매 비용 ($)', '1000', c.cost) + f('daily', '하루 보상 토큰 수', '50', c.daily) + f('price', '토큰 예상 가격 ($)', '0.05', c.price ?? state.calcPrice) + f('opex', '월 운영비 ($)', '0', c.opex);
  if (c.mode === 'target') return f('amount', '투자 금액 ($)', '500', c.amount) + f('buy', '매수가 ($)', '0.10', c.buy ?? state.calcPrice) + f('target', '목표가 ($)', '0.25', c.target);
  return f('alloc', '예상 에어드랍 토큰 수', '2000', c.alloc) + f('price', '예상 상장가 ($)', '0.30', c.price ?? state.calcPrice) + f('prob', '수령 확률 (%)', '40', c.prob) + f('cost', '참여 비용(가스비 등, $)', '20', c.cost);
}
function calcOut(c) {
  const n = (k) => parseFloat(c[k]) || 0;
  if (c.mode === 'node') {
    const monthly = n('daily') * 30 * n('price') - n('opex');
    if (!n('cost') || !n('daily')) return '';
    return `<div class="calc-out">월 순수익 <b>$${monthly.toFixed(2)}</b><br>원금 회수 기간 <b>${monthly > 0 ? `${(n('cost') / monthly).toFixed(1)}개월` : '회수 불가'}</b><br><span class="muted" style="font-size:12.5px">연 수익률 ${monthly > 0 ? ((monthly * 12 / n('cost')) * 100).toFixed(0) : 0}% · 토큰 가격이 절반이 되면 회수 기간은 2배 이상</span></div>`;
  }
  if (c.mode === 'target') {
    if (!n('amount') || !n('buy') || !n('target')) return '';
    const qty = n('amount') / n('buy');
    const profit = qty * n('target') - n('amount');
    return `<div class="calc-out">보유 수량 <b>${num(qty)}</b><br>목표가 도달 시 수익 <b>$${profit.toFixed(2)}</b> (${((n('target') / n('buy') - 1) * 100).toFixed(0)}%)<br><span class="muted" style="font-size:12.5px">-30% 손절 시 손실 $${(n('amount') * 0.3).toFixed(2)}</span></div>`;
  }
  if (!n('alloc') || !n('price')) return '';
  const ev = n('alloc') * n('price') * (n('prob') || 100) / 100 - n('cost');
  return `<div class="calc-out">기대값 <b>$${ev.toFixed(2)}</b><br><span class="muted" style="font-size:12.5px">수령 시 총액 $${(n('alloc') * n('price')).toFixed(2)} · 확률 ${n('prob') || 100}% · 비용 $${n('cost')}</span></div>`;
}

// ═════════ 이벤트 ═════════
const actions = {
  back: pop,
  settings: () => push('settings'),
  close: closeOverlay,
  scrim: (el, e) => { if (e.target === el && !state.overlay?.locked) closeOverlay(); },
  exitApp: () => { closeOverlay(); AppPlugin ? AppPlugin.exitApp() : toast('브라우저에서는 종료할 수 없습니다'); },
  confirmOk: () => { const fn = state.overlay?.onOk; closeOverlay(); fn?.(); },
  quick: (el) => doSearch(el.dataset.q),
  open: (el) => push('report', { id: el.dataset.id, tab: 'summary' }),
  ftype: (el) => { state.filterType = el.dataset.k || null; render(); },
  fmethod: (el) => { state.filterMethod = el.dataset.k || null; render(); },
  select: () => { state.select = true; state.edit = false; render(); },
  edit: () => { state.edit = true; state.select = false; render(); },
  exitSelect: () => { state.select = false; state.edit = false; state.selected.clear(); render(); },
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
  tab: (el) => { top().tab = el.dataset.k; render(); document.querySelector('.tabs')?.scrollIntoView({ block: 'start' }); },
  prio: (el) => { store.patchProject(top().id, { priority: +el.dataset.v }); render(); },
  update: () => { const p = store.getProject(top().id); runAnalysis({ query: p.query, pick: p.pick, isUpdate: true }); },
  aiRun: () => { const p = store.getProject(top().id); runAnalysis({ query: p.query, pick: p.pick, isUpdate: true, forceAi: true }); },
  step: (el) => { const p = store.getProject(top().id); const prog = { ...(p.progress || {}) }; prog[el.dataset.k] = !prog[el.dataset.k]; store.patchProject(p.id, { progress: prog }); render(); },
  copy: async (el) => { try { await navigator.clipboard.writeText(el.dataset.v); toast('주소를 복사했습니다'); } catch { toast(el.dataset.v); } },
  share: async () => {
    const p = store.getProject(top().id);
    const text = shareText(p);
    try {
      if (navigator.share) await navigator.share({ title: `${p.name} 분석`, text });
      else { await navigator.clipboard.writeText(text); toast('요약을 복사했습니다'); }
    } catch { /* 취소 */ }
  },
  calc: () => { const p = store.getProject(top().id); state.calcPrice = p?.market?.price ? +p.market.price.toPrecision(4) : undefined; openOverlay({ type: 'calc', v: { mode: p?.earnMethods?.some((m) => m.key === 'node') ? 'node' : p?.stage === 'pre-tge' ? 'airdrop' : 'target' } }); },
  calcMode: (el) => { state.overlay.v = { mode: el.dataset.k }; renderOverlay(); },
  pick: (el) => { const o = state.overlay; const r = o.results[+el.dataset.i]; closeOverlay(); runAnalysis({ query: o.query, pick: r }); },
  pickRaw: () => { const q = state.overlay.query; closeOverlay(); runAnalysis({ query: q, pick: null, forceAi: true }); },
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
    '※ 투자 권유 아님',
  ].filter(Boolean).join('\n');
}

async function refreshAll() {
  if (state.busy) return;
  state.busy = true;
  const list = store.sortedProjects('manual');
  let n = 0;
  for (const p of list) {
    toast(`업데이트 중 ${++n}/${list.length} · ${p.name}`);
    try {
      const r = await analyzeProject({ query: p.query, pick: p.pick, skipAi: true });
      reapplyAi(r, p.ai); // 기존 AI 조사 유지
      store.upsertProject(r);
    } catch (e) {
      console.warn(e);
    }
    if (top().view === 'home') render();
  }
  state.busy = false;
  toast(`전체 업데이트 완료 (${list.length}개)`);
  render();
}

async function doSearch(q) {
  q = (q || '').trim();
  if (!q) return toast('프로젝트 이름을 입력하세요');
  openOverlay({ type: 'results', query: q, loading: true, results: [] });
  try {
    const results = await searchCoins(q);
    if (state.overlay?.type !== 'results') return;
    state.overlay = { type: 'results', query: q, results };
  } catch (e) {
    state.overlay = { type: 'results', query: q, results: [] };
    toast('검색 서버 응답이 없어 직접 조사로 진행할 수 있어요');
  }
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
    state.overlay.v[el.name] = el.value;
    document.getElementById('calcOut').innerHTML = calcOut(state.overlay.v);
  } else if (el.dataset.change === 'memo') {
    clearTimeout(el._t);
    el._t = setTimeout(() => store.patchProject(top().id, { memo: el.value }), 400);
  }
});
document.addEventListener('change', async (e) => {
  const el = e.target;
  if (el.dataset.change === 'sort') { store.saveSettings({ sortMode: el.value }); render(); }
  else if (el.dataset.change === 'scam') {
    const p = store.getProject(top().id);
    store.patchProject(p.id, { scamCheck: { ...(p.scamCheck || {}), [el.dataset.i]: el.checked } });
    render();
  } else if (el.id === 'importFile' && el.files[0]) {
    try {
      const data = JSON.parse(await el.files[0].text());
      const incoming = data.projects || [];
      const cur = store.listProjects();
      const map = new Map(cur.map((p) => [p.id, p]));
      for (const p of incoming) map.set(p.id, p);
      localStorage.setItem('ncr.projects.v1', JSON.stringify([...map.values()]));
      toast(`${incoming.length}개 프로젝트를 가져왔습니다`);
    } catch { toast('백업 파일을 읽을 수 없습니다'); }
  }
});

render();

// 미리보기/디버그용 훅 (#debug 일 때만)
if (location.hash.includes('debug')) window.__app = { state, push, render, openOverlay, store };
