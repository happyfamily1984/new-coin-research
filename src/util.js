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
  if (a < 0.001) {
    // 0.000003412 → $0.0₅3412 (소수점 뒤 0 개수를 아래첨자로)
    const zeros = Math.floor(-Math.log10(a));
    const sig = String(Math.round(a * 10 ** (zeros + 3)));
    const sub = String(zeros).split('').map((d) => '₀₁₂₃₄₅₆₇₈₉'[+d]).join('');
    return `${v < 0 ? '-' : ''}$0.0${sub}${sig}`;
  }
  return `$${v.toPrecision(a < 0.01 ? 3 : 4)}`;
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

/** 270도 원호 게이지 */
export function arc(v, { big = false, label = '' } = {}) {
  const val = v == null ? 0 : Math.max(0, Math.min(100, v));
  const r = 42, C = 2 * Math.PI * r, track = C * 0.75, fill = (track * val) / 100;
  const g = v >= 65 ? ['#34e0a1', '#38d6e8'] : v >= 45 ? ['#fbbf3c', '#fb923c'] : ['#ff6b81', '#f43f5e'];
  const id = `g${g[0].slice(1)}`;
  return `<div class="arc ${big ? 'big' : ''}"><svg viewBox="0 0 100 100"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${g[0]}"/><stop offset="1" stop-color="${g[1]}"/></linearGradient></defs>
    <circle cx="50" cy="50" r="${r}" fill="none" stroke="#ffffff14" stroke-width="${big ? 8 : 9}" stroke-linecap="round" stroke-dasharray="${track} ${C}"/>
    <circle cx="50" cy="50" r="${r}" fill="none" stroke="url(#${id})" stroke-width="${big ? 8 : 9}" stroke-linecap="round" stroke-dasharray="${fill} ${C}"/></svg>
    <div class="val"><div>${v ?? '-'}${label ? `<small>${label}</small>` : ''}</div></div></div>`;
}

/** 면적 채움 스파크라인 */
export function areaSpark(values, { w = 300, h = 56, up = true } = {}) {
  const v = (values || []).filter((x) => x != null && isFinite(x));
  if (v.length < 2) return '';
  const min = Math.min(...v), max = Math.max(...v);
  const pts = v.map((y, i) => [(i / (v.length - 1)) * w, h - 4 - ((y - min) / (max - min || 1)) * (h - 10)]);
  const line = pts.map((p) => p.join(',')).join(' ');
  const col = up ? '#34e0a1' : '#ff6b81';
  const id = up ? 'sparkUp' : 'sparkDn';
  const [lx, ly] = pts[pts.length - 1];
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${col}" stop-opacity=".35"/><stop offset="1" stop-color="${col}" stop-opacity="0"/></linearGradient></defs>
    <polygon points="0,${h} ${line} ${w},${h}" fill="url(#${id})"/><polyline points="${line}" fill="none" stroke="${col}" stroke-width="2.2" stroke-linejoin="round" vector-effect="non-scaling-stroke"/><circle cx="${lx}" cy="${ly}" r="3.5" fill="${col}"/></svg>`;
}

Object.assign(icon, {
  bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/></svg>',
  home: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M11.3 3.3a1 1 0 0 1 1.4 0l8 7.4a1 1 0 0 1-.7 1.7H19v7.1a1.5 1.5 0 0 1-1.5 1.5H15v-5.5h-6V21H6.5A1.5 1.5 0 0 1 5 19.5v-7.1H4a1 1 0 0 1-.7-1.7z"/></svg>',
  bars: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="12" width="4.5" height="9" rx="1.2"/><rect x="9.75" y="7" width="4.5" height="14" rx="1.2"/><rect x="16.5" y="3" width="4.5" height="18" rx="1.2"/></svg>',
  dots: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>',
  filter: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/></svg>',
  doc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/></svg>',
  cube: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 2 3 7v10l9 5 9-5V7z"/><path d="m3 7 9 5 9-5M12 12v10"/></svg>',
  users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5"/><circle cx="17" cy="9" r="2.5"/><path d="M17 14.5c2.4 0 4 1.6 4.5 4"/></svg>',
  coins: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="9" cy="7" rx="6" ry="3"/><path d="M3 7v5c0 1.7 2.7 3 6 3s6-1.3 6-3V7"/><path d="M9 15v3c0 1.7 2.7 3 6 3s6-1.3 6-3v-5c0-1.7-2.7-3-6-3"/></svg>',
  exch: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h14l-3-3M20 16H6l3 3"/></svg>',
  alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17h0"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  note: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 4h16v12l-4 4H4z"/><path d="M8 9h8M8 13h5"/></svg>',
  star: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="m12 2.5 2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z"/></svg>',
  fire: '<svg viewBox="0 0 24 24" fill="none"><path d="M12 2c1 4 5 5.5 5 11a5 5 0 0 1-10 0c0-2.5 1.2-4 2.5-5 0 2 1 3 2 3-1-3 0-6 .5-9z" fill="#fb923c"/><path d="M12 13c.6 1.6 2.5 2 2.5 4.2a2.5 2.5 0 0 1-5 0c0-1.3.9-2.2 1.6-2.7.1 1 .5 1.5 1 1.5-.3-1.2-.3-2 0-3z" fill="#fde047"/></svg>',
  shieldFill: '<svg viewBox="0 0 24 24"><defs><linearGradient id="qsh" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#60a5fa"/><stop offset="1" stop-color="#8b5cf6"/></linearGradient></defs><path d="M12 2 4 5v6.5c0 5 3.4 8.8 8 10.5 4.6-1.7 8-5.5 8-10.5V5z" fill="url(#qsh)"/><path d="m8.5 12 2.5 2.5 4.5-5" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  barsFill: '<svg viewBox="0 0 24 24"><defs><linearGradient id="qbr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#818cf8"/><stop offset="1" stop-color="#3b82f6"/></linearGradient></defs><rect x="3" y="12" width="4.5" height="9" rx="1.2" fill="url(#qbr)"/><rect x="9.75" y="7" width="4.5" height="14" rx="1.2" fill="url(#qbr)"/><rect x="16.5" y="3" width="4.5" height="18" rx="1.2" fill="url(#qbr)"/></svg>',
  starFill: '<svg viewBox="0 0 24 24"><path d="m12 2.5 2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z" fill="#fbbf24"/></svg>',
  chev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg>',
});
