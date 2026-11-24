// 공통 HTTP 유틸: 타임아웃, 재시도, 짧은 메모리 캐시
import { getSettings } from '../store.js';

const memCache = new Map();

export async function fetchJson(url, { timeout = 15000, retries = 1, headers = {}, cacheMs = 60000, allow404 = false } = {}) {
  const key = url;
  const hit = memCache.get(key);
  if (hit && Date.now() - hit.t < cacheMs) return hit.v;

  let lastErr;
  for (let i = 0; i <= retries; i++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeout);
    try {
      const res = await fetch(url, { headers: { accept: 'application/json', ...headers }, signal: ctrl.signal });
      clearTimeout(timer);
      if (res.status === 404 && allow404) return null;
      if (res.status === 429) {
        lastErr = new Error('요청 한도 초과(429)');
        await sleep(1500 * (i + 1));
        continue;
      }
      if (!res.ok) {
        if (allow404 && res.status >= 400 && res.status < 500) return null;
        throw new Error(`HTTP ${res.status}`);
      }
      const v = await res.json();
      memCache.set(key, { t: Date.now(), v });
      return v;
    } catch (e) {
      clearTimeout(timer);
      lastErr = e.name === 'AbortError' ? new Error('시간 초과') : e;
      if (i < retries) await sleep(800 * (i + 1));
    }
  }
  throw lastErr;
}

/** 실패해도 null 을 돌려주는 안전 호출 */
export async function safe(promise, label, errors) {
  try {
    return await promise;
  } catch (e) {
    if (errors) errors.push(`${label}: ${e.message}`);
    return null;
  }
}

export function cgHeaders() {
  const k = getSettings().coingeckoKey;
  return k ? { 'x-cg-demo-api-key': k } : {};
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
