export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function usd(v, { compact = true } = {}) {
  if (v == null || isNaN(v)) return '-';
  const a = Math.abs(v);
  if (compact && a >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (compact && a >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  if (compact && a >= 1e4) return `$${(v / 1e3).toFixed(1)}K`;
  if (a >= 1) return `$${v.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
  if (a === 0) return '$0';
  return `$${v.toPrecision(4)}`;
}
export const krw = (v) => (v == null ? '-' : `₩${v >= 100 ? Math.round(v).toLocaleString() : v.toPrecision(4)}`);
export const num = (v) => (v == null ? '-' : v >= 1e9 ? `${(v / 1e9).toFixed(2)}B` : v >= 1e6 ? `${(v / 1e6).toFixed(2)}M` : Math.round(v).toLocaleString());
export const pct = (v, d = 1) => (v == null || isNaN(v) ? '-' : `${v > 0 ? '+' : ''}${(+v).toFixed(d)}%`);
export const cls = (v) => (v > 0 ? 'up' : v < 0 ? 'down' : '');
export const short = (a = '') => (a.length > 14 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a);

export function ago(t) {
  if (!t) return '-';
  const s = (Date.now() - t) / 1000;
  if (s < 60) return '방금 전';
  if (s < 3600) return `${Math.floor(s / 60)}분 전`;
  if (s < 86400) return `${Math.floor(s / 3600)}시간 전`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}일 전`;
  return new Date(t).toLocaleDateString('ko-KR');
}
export const ringColor = (v) => (v >= 65 ? 'var(--good)' : v >= 45 ? 'var(--warn)' : 'var(--bad)');

export function ring(v, size = '') {
  const val = v ?? 0;
  return `<div class="ring ${size}" style="--v:${val};--col:${ringColor(val)}"><b>${v ?? '-'}</b></div>`;
}

export function sparkline(values, { w = 300, h = 60, color = 'var(--acc2)' } = {}) {
  const v = values.filter((x) => x != null && isFinite(x));
  if (v.length < 2) return '<div class="muted" style="font-size:13px">업데이트가 쌓이면 추이 그래프가 표시됩니다.</div>';
  const min = Math.min(...v), max = Math.max(...v);
  const pts = v.map((y, i) => `${(i / (v.length - 1)) * w},${h - 6 - ((y - min) / (max - min || 1)) * (h - 12)}`).join(' ');
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg>`;
}

const P = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
export const icon = {
  search: P('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
  gear: P('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
  back: P('<path d="m15 18-6-6 6-6"/>'),
  refresh: P('<path d="M21 12a9 9 0 1 1-2.6-6.4"/><path d="M21 3v6h-6"/>'),
  edit: P('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4z"/>'),
  grip: P('<circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/>'),
  check: P('<path d="M20 6 9 17l-5-5"/>'),
  trash: P('<path d="M3 6h18"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>'),
  share: P('<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/>'),
  compare: P('<path d="M8 3v18M16 3v18M3 8h5M16 16h5"/>'),
  copy: P('<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>'),
  calc: P('<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 6h8M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01M8 19h8"/>'),
  sparkle: P('<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 17l.7 1.8 1.8.7-1.8.7L19 22l-.7-1.8-1.8-.7 1.8-.7z"/>'),
  shield: P('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>'),
  sort: P('<path d="M3 6h13M3 12h9M3 18h5"/><path d="m17 15 3 3 3-3M20 18V6"/>'),
};
