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
  const letters = s.replace(/[^A-Za-z가-힣]/g, '');
  if (!letters) return true;
  return (s.match(/[가-힣]/g) || []).length / letters.length > 0.3;
};

async function viaGoogle(texts) {
  const body = new URLSearchParams();
  texts.forEach((t) => body.append('q', t));
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch('https://translate.googleapis.com/translate_a/t?client=gtx&sl=auto&tl=ko&format=text', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: body.toString(),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    // 응답 형태: 한 개면 [["번역","en"]] 또는 ["번역","en"], 여러 개면 [["번역","en"], ...]
    const arr = texts.length === 1 && typeof data[0] === 'string' ? [data] : data;
    return arr.map((x) => (Array.isArray(x) ? x[0] : x));
  } finally {
    clearTimeout(timer);
  }
}

async function viaMyMemory(text) {
  const parts = text.match(/[^.!?\n]{1,450}[.!?\n]?/g) || [text];
  const out = [];
  for (const p of parts) {
    const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(p)}&langpair=en|ko`);
    const d = await res.json();
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
      } catch {
        tr = null;
      }
      if (!tr || tr.length !== b.length) {
        tr = [];
        for (const t of b) {
          try {
            tr.push(t.length < 1500 ? await viaMyMemory(t) : t);
          } catch {
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
