// 무료 번역(영어 → 한국어). API 키 없이 동작, 실패하면 원문 유지.
const CACHE_KEY = 'ncr.tr.v1';
let cache = null;

function load() {
  if (cache) return cache;
  try {
    cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
  } catch {
    cache = {};
  }
  return cache;
}
function persist() {
  try {
    const entries = Object.entries(cache);
    if (entries.length > 1500) cache = Object.fromEntries(entries.slice(-1000)); // 오래된 항목 정리
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    /* 저장 공간 부족 시 무시 */
  }
}

/** 한글이 이미 충분하면 번역 불필요 */
export const isKorean = (s = '') => {
  // 대문자 약어(NFT, AI, BNB)·숫자·기호는 번역 대상이 아님
  const rest = String(s).replace(/\b[A-Z0-9][A-Z0-9.+\-]*\b/g, '').replace(/https?:\S+/g, '');
  const latin = (rest.match(/[A-Za-z]/g) || []).length;
  if (latin < 3) return true;
  const hangul = (rest.match(/[가-힣]/g) || []).length;
  return hangul / (hangul + latin) > 0.3;
};

const GT = 'https://translate.googleapis.com/translate_a/t?client=gtx&sl=auto&tl=ko&format=text';
// 앱(Capacitor)은 fetch를 네이티브 HTTP로 바꿔치기하므로, 원래 WebView fetch도 함께 시도
const fetchers = () => [globalThis.fetch, globalThis.CapacitorWebFetch].filter((f, i, a) => typeof f === 'function' && a.indexOf(f) === i);

async function timed(fn, ms = 15000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fn(ctrl.signal);
  } finally {
    clearTimeout(timer);
  }
}
function parseGt(data, n) {
  if (!Array.isArray(data)) throw new Error('형식 오류');
  const arr = n === 1 && typeof data[0] === 'string' ? [data] : data;
  const out = arr.map((x) => (Array.isArray(x) ? x[0] : x));
  if (out.length !== n || out.some((x) => typeof x !== 'string')) throw new Error('형식 오류');
  return out;
}

export let lastError = '';

async function viaGoogle(texts) {
  const errs = [];
  for (const f of fetchers()) {
    // 1) POST 묶음 전송
    try {
      const body = texts.map((t) => `q=${encodeURIComponent(t)}`).join('&');
      return await timed(async (signal) => {
        const res = await f.call(globalThis, GT, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' }, body, signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return parseGt(await res.json(), texts.length);
      });
    } catch (e) {
      errs.push(`POST ${e.message}`);
    }
    // 2) GET (주소 길이 제한 때문에 한 건씩)
    try {
      const out = [];
      for (const t of texts) {
        const r = await timed(async (signal) => {
          const res = await f.call(globalThis, `${GT}&q=${encodeURIComponent(t.slice(0, 1800))}`, { signal });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return parseGt(await res.json(), 1)[0];
        });
        out.push(r);
      }
      return out;
    } catch (e) {
      errs.push(`GET ${e.message}`);
    }
  }
  throw new Error(errs.join(' / '));
}

async function viaMyMemory(text) {
  const parts = text.match(/[^.!?\n]{1,450}[.!?\n]?/g) || [text];
  const out = [];
  for (const p of parts) {
    const d = await timed(async (signal) => (await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(p)}&langpair=en|ko`, { signal })).json());
    out.push(d?.responseData?.translatedText || p);
  }
  return out.join(' ');
}

/**
 * 여러 문자열을 한 번에 번역. 반환 배열은 입력과 같은 순서.
 * @param {string[]} texts
 */
export async function translateKo(texts) {
  const c = load();
  const result = texts.map((t) => (!t || isKorean(t) ? t : c[t] ?? null));
  const todo = [...new Set(texts.filter((t, i) => result[i] === null))];
  if (todo.length) {
    // 요청 크기 제한을 위해 묶음 단위로 전송
    const batches = [];
    let cur = [], size = 0;
    for (const t of todo) {
      if (cur.length && (size + t.length > 4000 || cur.length >= 40)) {
        batches.push(cur);
        cur = [];
        size = 0;
      }
      cur.push(t);
      size += t.length;
    }
    if (cur.length) batches.push(cur);
    for (const b of batches) {
      let tr = null;
      try {
        tr = await viaGoogle(b);
        lastError = '';
      } catch (e) {
        lastError = `구글 번역 실패: ${e.message}`;
        tr = null;
      }
      if (!tr || tr.length !== b.length) {
        tr = [];
        for (const t of b) {
          try {
            tr.push(await viaMyMemory(t.slice(0, 2500)));
          } catch (e) {
            lastError += ` / 보조 번역 실패: ${e.message}`;
            tr.push(t);
          }
        }
      }
      b.forEach((t, i) => {
        if (tr[i] && tr[i] !== t) c[t] = tr[i];
      });
    }
    persist();
  }
  return texts.map((t, i) => result[i] ?? c[t] ?? t);
}
