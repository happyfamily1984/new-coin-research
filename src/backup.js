// 백업/복원 — 파일 대신 "백업 코드"(압축 텍스트)로 복사·붙여넣기 (안드로이드 앱에서도 확실히 동작)
import * as store from './store.js';

const SETTING_KEYS = ['geminiKeys', 'geminiModel', 'geminiFallback', 'aiAuto', 'coingeckoKey', 'sortMode'];
const PREFIX = 'CV1:';

const toB64 = (bytes) => {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};
const fromB64 = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

async function gzip(text) {
  if (typeof CompressionStream === 'undefined') return null;
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
async function gunzip(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return await new Response(stream).text();
}

/** 다시 받아올 수 있는 큰 데이터는 줄여서 백업 크기 축소 */
function slim(p) {
  const c = JSON.parse(JSON.stringify(p));
  if (c.exchanges?.list) c.exchanges.list = c.exchanges.list.slice(0, 25);
  if (c.onchain?.tvl?.series) delete c.onchain.tvl.series;
  delete c.errors;
  return c;
}

export async function makeBackupCode({ withKeys = true } = {}) {
  const s = store.getSettings();
  const settings = withKeys ? Object.fromEntries(SETTING_KEYS.map((k) => [k, s[k]])) : { sortMode: s.sortMode };
  const json = JSON.stringify({ app: 'coin-verifier', v: 2, at: Date.now(), settings, projects: store.listProjects().map(slim) });
  const gz = await gzip(json);
  return gz ? PREFIX + toB64(gz) : json;
}

/** 백업 코드 또는 예전 JSON 파일 내용을 받아 복원. 반환: {projects, keys} */
export async function restoreBackup(text) {
  const t = String(text || '').trim();
  let data;
  if (t.startsWith(PREFIX)) data = JSON.parse(await gunzip(fromB64(t.slice(PREFIX.length).replace(/\s+/g, ''))));
  else data = JSON.parse(t);
  if (data.app !== 'coin-verifier' || !Array.isArray(data.projects)) throw new Error('코인 검증기 백업이 아닙니다');
  const map = new Map(store.listProjects().map((p) => [p.id, p]));
  for (const p of data.projects) map.set(p.id, p);
  store.replaceAll([...map.values()]);
  let keys = 0;
  if (data.settings) {
    const patch = {};
    for (const k of SETTING_KEYS) if (data.settings[k] !== undefined && data.settings[k] !== '') patch[k] = data.settings[k];
    store.saveSettings(patch);
    keys = String(patch.geminiKeys || '').split(',').filter((x) => x.trim()).length;
  }
  return { projects: data.projects.length, keys };
}
