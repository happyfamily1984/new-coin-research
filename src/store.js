// 로컬 저장소: 분석한 프로젝트 목록 + 설정
const KEY_PROJECTS = 'ncr.projects.v1';
const KEY_SETTINGS = 'ncr.settings.v1';

const DEFAULT_SETTINGS = {
  claudeKey: '',
  claudeModel: 'claude-opus-5-5',
  aiEffort: 'medium',
  aiAuto: true, // 키가 있으면 분석 시 AI 심층 분석 자동 실행
  coingeckoKey: '',
  sortMode: 'manual', // manual | priority | trust | potential | updated
};

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
function write(key, v) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch (e) {
    console.warn('저장 실패', e);
  }
}

export function getSettings() {
  return { ...DEFAULT_SETTINGS, ...read(KEY_SETTINGS, {}) };
}
export function saveSettings(patch) {
  const s = { ...getSettings(), ...patch };
  write(KEY_SETTINGS, s);
  return s;
}

export function listProjects() {
  return read(KEY_PROJECTS, []);
}
function saveAll(list) {
  write(KEY_PROJECTS, list);
}
export function getProject(id) {
  return listProjects().find((p) => p.id === id) || null;
}

/** 새 분석 결과 저장(있으면 갱신 + 히스토리/변경사항 기록) */
export function upsertProject(report) {
  const list = listProjects();
  const idx = list.findIndex((p) => p.id === report.id);
  const snap = snapshot(report);
  if (idx >= 0) {
    const prev = list[idx];
    const merged = {
      ...report,
      priority: prev.priority,
      order: prev.order,
      memo: prev.memo,
      createdAt: prev.createdAt,
      history: [...(prev.history || []), snap].slice(-30),
      changes: diff(prev, report),
    };
    list[idx] = merged;
    saveAll(list);
    return merged;
  }
  const minOrder = list.reduce((m, p) => Math.min(m, p.order ?? 0), 0);
  const created = {
    ...report,
    priority: report.priority ?? 3,
    order: minOrder - 1, // 새로 분석한 프로젝트는 맨 위
    memo: '',
    createdAt: Date.now(),
    history: [snap],
    changes: [],
  };
  list.push(created);
  saveAll(list);
  return created;
}

export function patchProject(id, patch) {
  const list = listProjects();
  const idx = list.findIndex((p) => p.id === id);
  if (idx < 0) return null;
  list[idx] = { ...list[idx], ...patch };
  saveAll(list);
  return list[idx];
}

export function deleteProjects(ids) {
  const set = new Set(ids);
  saveAll(listProjects().filter((p) => !set.has(p.id)));
}

/** 수동 순서 저장: ids 순서대로 order 재부여 */
export function reorder(ids) {
  const list = listProjects();
  const pos = new Map(ids.map((id, i) => [id, i]));
  list.forEach((p) => {
    if (pos.has(p.id)) p.order = pos.get(p.id);
  });
  saveAll(list);
}

export function sortedProjects(mode = getSettings().sortMode) {
  const list = listProjects();
  const by = {
    manual: (a, b) => (a.order ?? 0) - (b.order ?? 0),
    priority: (a, b) => (b.priority ?? 0) - (a.priority ?? 0) || (a.order ?? 0) - (b.order ?? 0),
    trust: (a, b) => (b.scores?.trust?.score ?? 0) - (a.scores?.trust?.score ?? 0),
    potential: (a, b) => (b.scores?.potential?.score ?? 0) - (a.scores?.potential?.score ?? 0),
    updated: (a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0),
  };
  return list.sort(by[mode] || by.manual);
}

function snapshot(r) {
  return {
    at: r.updatedAt,
    price: r.market?.price ?? null,
    mcap: r.market?.mcap ?? null,
    trust: r.scores?.trust?.score ?? null,
    potential: r.scores?.potential?.score ?? null,
    cex: r.exchanges?.cexCount ?? null,
    holders: r.onchain?.holders?.count ?? null,
  };
}

/** 이전 분석 대비 변경사항 */
function diff(prev, next) {
  const out = [];
  const num = (a, b, label, fmt = (v) => v, pct = false) => {
    if (a == null || b == null || a === b) return;
    const d = pct ? ((b - a) / Math.abs(a || 1)) * 100 : b - a;
    if (pct && Math.abs(d) < 1) return;
    out.push({ label, from: fmt(a), to: fmt(b), up: b > a, delta: pct ? `${d > 0 ? '+' : ''}${d.toFixed(1)}%` : `${d > 0 ? '+' : ''}${Math.round(d)}` });
  };
  num(prev.scores?.trust?.score, next.scores?.trust?.score, '신뢰도');
  num(prev.scores?.potential?.score, next.scores?.potential?.score, '가능성');
  num(prev.market?.price, next.market?.price, '가격', (v) => '$' + (+v).toPrecision(4), true);
  num(prev.market?.mcap, next.market?.mcap, '시가총액', (v) => '$' + Math.round(v / 1e6) + 'M', true);
  num(prev.onchain?.holders?.count, next.onchain?.holders?.count, '홀더 수', (v) => v.toLocaleString(), true);
  num(prev.exchanges?.cexCount, next.exchanges?.cexCount, '상장 거래소 수');
  const prevEx = new Set((prev.exchanges?.list || []).map((e) => e.name));
  const added = (next.exchanges?.list || []).filter((e) => !prevEx.has(e.name)).map((e) => e.name);
  if (prevEx.size && added.length) out.push({ label: '신규 상장', to: added.slice(0, 5).join(', '), up: true, delta: `+${added.length}` });
  const k = (r) => [r.exchanges?.korea?.upbit?.listed, r.exchanges?.korea?.bithumb?.listed];
  const [pu, pb] = k(prev);
  const [nu, nb] = k(next);
  if (!pu && nu) out.push({ label: '업비트', to: '신규 상장 확인', up: true, delta: 'NEW' });
  if (!pb && nb) out.push({ label: '빗썸', to: '신규 상장 확인', up: true, delta: 'NEW' });
  return out;
}
