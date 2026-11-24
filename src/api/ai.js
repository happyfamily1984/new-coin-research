// Gemini API + Google 검색 그라운딩 기반 심층 분석 (설정에서 API 키 입력 시)
// 키는 쉼표로 여러 개 입력 가능 — 한도 초과/오류 시 다음 키, 모델 오류 시 다음 모델로 자동 전환
import { getSettings, saveSettings } from '../store.js';
import { PROJECT_TYPES, EARN_METHODS } from '../engine/taxonomy.js';

const SYSTEM = `당신은 신규 암호화폐 프로젝트를 검증하는 리서치 애널리스트입니다.
웹 검색으로 최신 정보를 조사하고 한국어로 답합니다. 확인되지 않은 내용은 추측하지 말고 "미확인"이라고 쓰세요.
일반 개인 투자자가 참여해 수익을 낼 수 있는 현실적인 방법을 제시하되, 위험을 숨기지 마세요.
참여 전략은 코인을 처음 하는 사람도 따라 할 수 있게 쉬운 말과 친절한 존댓말(~해요)로, 전문 용어는 괄호로 풀어서 쓰세요.
투자 권유가 아닌 정보 제공 목적입니다.`;

function buildPrompt(query, known) {
  return `프로젝트: "${query}"
이미 수집된 공개 데이터(참고용, 틀릴 수 있음):
${JSON.stringify(known).slice(0, 6000)}

웹 검색으로 다음을 조사하세요: 공식 사이트/문서, 투자 라운드와 투자사, 팀, 토크노믹스와 언락 일정, 로드맵, 최근 3개월 뉴스,
테스트넷·포인트·에어드랍·노드 판매·NFT·런치패드·SNS(야핑/앰배서더) 등 참여 프로그램, 거래소 상장 현황 및 상장 예정, 보안 사고·논란.

반드시 아래 JSON 하나만 \`\`\`json 코드블록으로 출력하세요(다른 설명 금지).
{
 "summary": "3~4문장 핵심 요약",
 "overview": "프로젝트가 무엇을 하는지 상세 설명(5~8문장)",
 "stage": "pre-tge | new | listed",
 "types": ["${Object.keys(PROJECT_TYPES).join('|')} 중 해당 항목 1~3개, 가장 중요한 것 먼저"],
 "earnMethods": [{"key": "${Object.keys(EARN_METHODS).join('|')}", "fit": "high|mid|low", "why": "근거 한 줄"}],
 "team": [{"name": "", "role": ""}],
 "investors": [{"round": "Seed/Series A 등", "date": "YYYY-MM", "amount": 숫자(백만달러, 모르면 null), "lead": ["리드 투자사"], "others": ["참여 투자사"]}],
 "tokenomics": {"totalSupply": "", "tge": "TGE 날짜/예정", "allocation": [{"label": "", "pct": 숫자}], "unlocks": [{"date": "YYYY-MM-DD", "desc": ""}]},
 "roadmap": [{"when": "", "item": "", "done": true}],
 "listings": {"current": ["거래소"], "expected": ["상장 예정/루머(출처 명시)"]},
 "airdrop": {"status": "진행중|종료|예정|없음|미확인", "detail": "조건·기간"},
 "news": [{"date": "YYYY-MM-DD", "title": "", "url": ""}],
 "strategies": [{"title": "쉬운 제목", "method": "earnMethods key", "difficulty": "쉬움|보통|어려움", "capital": "예: 소액부터(1만 원~)", "period": "", "risk": "낮음|중간|높음", "summary": "이게 뭔지 초보자도 알게 1~2문장", "howEarn": "어떻게 돈을 버는지 1~2문장", "need": ["준비물"], "steps": ["초보자가 그대로 따라 할 수 있는 구체적 단계(어느 사이트·메뉴·버튼인지 포함)"], "example": "숫자로 된 쉬운 예시", "cautions": [""]}],
 "risks": [{"level": "high|mid|low", "text": ""}],
 "trust": {"adjust": -15~15 정수(공개데이터 대비 신뢰도 보정), "note": "근거"},
 "potential": {"adjust": -15~15 정수, "note": "근거"},
 "sources": [{"title": "", "url": ""}]
}`;
}

function extractJson(text) {
  const fence = text.match(/```json\s*([\s\S]*?)```/);
  const body = fence ? fence[1] : text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
  return JSON.parse(body);
}

export const GEMINI_MODELS = [
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-3.1-flash-lite-preview',
  'gemini-3-flash-preview',
  'gemini-flash-lite-latest',
];

/** 쉼표·줄바꿈·공백으로 구분된 키 목록 */
export function parseKeys(raw = '') {
  return [...new Set(String(raw).split(/[\s,]+/).map((k) => k.trim()).filter(Boolean))];
}

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

async function callGemini(model, key, body, timeout = 180000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(`${ENDPOINT}/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    let data = null;
    try {
      data = await res.json();
    } catch {
      /* 본문 없음 */
    }
    return { status: res.status, data };
  } catch (e) {
    return { status: 0, data: null, error: e.name === 'AbortError' ? '시간 초과' : e.message };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Gemini 오류 해석.
 * 무료 한도는 "구글 프로젝트 × 모델" 단위로 따로 걸립니다(키 단위 아님).
 * → 한 모델에서 한도가 차도 같은 키로 다른 모델은 쓸 수 있습니다.
 */
function parseError(res) {
  const err = res.data?.error || {};
  const raw = JSON.stringify(err);
  const msg = err.message || res.error || `HTTP ${res.status}`;
  const details = err.details || [];
  const violations = details.flatMap((d) => d.violations || []);
  const quotaIds = violations.map((v) => `${v.quotaId || ''} ${v.quotaMetric || ''}`).join(' ');
  const retry = details.find((d) => /RetryInfo/.test(d['@type'] || ''))?.retryDelay;
  const retrySec = retry ? parseFloat(retry) : null;
  if (/API_KEY_INVALID|API key not valid|API key expired/i.test(raw)) return { kind: 'invalid', msg: '잘못되었거나 만료된 키' };
  if (res.status === 429 || /RESOURCE_EXHAUSTED/i.test(raw)) {
    const q = `${quotaIds} ${msg}`;
    const search = /search|grounding/i.test(q);
    const daily = /PerDay|per day|daily/i.test(q);
    const minute = /PerMinute|per minute/i.test(q);
    const tokens = /token/i.test(q);
    const zero = /limit: 0\b|quotaValue":"0"/i.test(raw) || violations.some((v) => String(v.quotaValue) === '0');
    let label = search ? '검색 기능 한도' : daily ? '일일 요청 한도' : minute ? (tokens ? '분당 토큰 한도' : '분당 요청 한도') : '사용 한도';
    if (zero) label = search ? '무료 등급에서 검색 기능 미제공' : '무료 등급에서 이 모델 미제공';
    return { kind: 'quota', search, daily: daily || zero, minute: minute && !daily && !zero, retrySec, label, msg };
  }
  if (res.status === 403 || /PERMISSION_DENIED/i.test(raw)) return { kind: 'denied', msg: '권한 없음(이 키에서 API 미사용 또는 지역 제한)' };
  if (res.status === 404 || /not found|is not supported for generateContent/i.test(raw)) return { kind: 'model', msg: '모델 없음' };
  if (res.status === 400 && /tool|google_search|grounding/i.test(raw)) return { kind: 'nosearch', msg: '이 모델은 검색 기능 미지원' };
  if (res.status === 0) return { kind: 'net', msg: res.error || '네트워크 오류' };
  if (res.status >= 500) return { kind: 'busy', msg: '구글 서버 과부하(잠시 후 다시)' };
  return { kind: 'model', msg: msg.slice(0, 80) };
}

// 일일 한도 소진 기록 — 구글 무료 한도는 미국 태평양 시간 자정에 초기화
const ptDay = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(new Date());
const keyTag = (k) => k.slice(-8);
function exhaustedMap() {
  const e = getSettings().geminiExhausted || {};
  return e.day === ptDay() ? e : { day: ptDay(), items: {} };
}
function markExhausted(model, key, search) {
  const e = exhaustedMap();
  e.items[`${model}|${keyTag(key)}|${search ? 's' : 'n'}`] = 1;
  saveSettings({ geminiExhausted: e });
}
const isExhausted = (e, model, key, search) => !!e.items[`${model}|${keyTag(key)}|${search ? 's' : 'n'}`];

/**
 * @param {string} query
 * @param {object} known 이미 수집한 요약 데이터
 * @param {(msg:string)=>void} onProgress
 */
export async function aiDeepResearch(query, known, onProgress = () => {}) {
  const s = getSettings();
  const keys = parseKeys(s.geminiKeys);
  if (!keys.length) return null;
  const first = GEMINI_MODELS.includes(s.geminiModel) ? s.geminiModel : GEMINI_MODELS[0];
  const models = s.geminiFallback === false ? [first] : [first, ...GEMINI_MODELS.filter((m) => m !== first)];
  const prompt = buildPrompt(query, known);
  const makeBody = (search) => ({
    systemInstruction: { parts: [{ text: SYSTEM + (search ? '' : '\n(웹 검색을 쓸 수 없는 상태입니다. 제공된 데이터와 알고 있는 지식으로만 작성하고, 최신 정보가 필요한 항목은 "미확인"으로 표시하세요.)') }] },
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    ...(search ? { tools: [{ google_search: {} }] } : {}),
    generationConfig: { temperature: 0.4, maxOutputTokens: 16384 },
  });

  const invalid = new Set(); // 무효 키(모든 모델 공통)
  const stats = { daily: 0, minute: 0, search: 0, invalid: 0, other: 0, skipped: 0 };
  const lastMsgs = [];
  const waits = []; // 분당 한도로 막힌 조합 — 마지막에 한 번 더 시도
  let tries = 0;
  const cursor = (s.geminiKeyCursor || 0) % keys.length;
  const order = keys.map((_, i) => (cursor + i) % keys.length);

  // 1차: 검색 사용 → 2차: 검색 없이 (검색 한도/미지원 대비)
  for (const search of [true, false]) {
    for (const model of models) {
      let modelBroken = false;
      for (const ki of order) {
        if (modelBroken) break;
        const key = keys[ki];
        if (invalid.has(ki)) continue;
        const ex = exhaustedMap();
        if (isExhausted(ex, model, key, search)) { stats.skipped++; continue; }
        tries++;
        onProgress(`${model}${search ? ' · 웹 검색' : ''} · 키 ${ki + 1}/${keys.length} 시도 중… (${tries}번째)`);
        const res = await callGemini(model, key, makeBody(search));
        const out = handleSuccess(res, model, ki, search, keys.length);
        if (out === 'empty') { stats.other++; lastMsgs.push(`${model}: 빈 응답`); modelBroken = true; continue; }
        if (out === 'badjson') { stats.other++; lastMsgs.push(`${model}: 응답 형식 오류`); modelBroken = true; continue; }
        if (out) return out;

        const e = parseError(res);
        lastMsgs.push(`${model} 키${ki + 1}: ${e.label || e.msg}`);
        if (e.kind === 'invalid' || e.kind === 'denied') { invalid.add(ki); stats.invalid++; continue; }
        if (e.kind === 'quota') {
          if (e.search) { stats.search++; if (search) { modelBroken = true; continue; } }
          if (e.daily) {
            stats.daily++;
            markExhausted(model, key, search);
            if (!e.search) markExhausted(model, key, !search); // 요청 한도는 검색 여부와 무관하게 공유
            continue;
          }
          stats.minute++;
          waits.push({ model, ki, search, sec: e.retrySec || 20 });
          continue;
        }
        if (e.kind === 'nosearch' && search) { modelBroken = true; continue; }
        stats.other++;
        modelBroken = true; // 모델 없음/서버 오류 → 다음 모델
      }
    }
  }

  // 3차: 분당 한도로 막혔던 조합을 잠시 기다렸다 다시 (최대 1회)
  const w = waits.sort((a, b) => a.sec - b.sec)[0];
  if (w && w.sec <= 65) {
    for (let t = Math.ceil(w.sec); t > 0; t--) {
      onProgress(`분당 한도 — ${t}초 후 다시 시도합니다…`);
      await new Promise((r) => setTimeout(r, 1000));
    }
    const res = await callGemini(w.model, keys[w.ki], makeBody(w.search));
    const out = handleSuccess(res, w.model, w.ki, w.search, keys.length);
    if (out && typeof out === 'object') return out;
  }

  const parts = [];
  if (stats.daily) parts.push(`일일 한도 ${stats.daily}건`);
  if (stats.minute) parts.push(`분당 한도 ${stats.minute}건`);
  if (stats.search) parts.push(`검색 기능 한도 ${stats.search}건`);
  if (stats.invalid) parts.push(`무효 키 ${invalid.size}개`);
  if (stats.skipped) parts.push(`오늘 이미 소진된 조합 ${stats.skipped}건 건너뜀`);
  const hint = stats.daily || stats.skipped
    ? ' · 같은 구글 프로젝트에서 만든 키는 한도를 함께 씁니다. 키를 서로 다른 프로젝트(또는 계정)에서 만들어 주세요. 일일 한도는 한국 시간 오후 4~5시에 초기화됩니다.'
    : stats.minute ? ' · 1분 정도 뒤에 다시 시도해 주세요.' : '';
  throw new Error(`AI 분석 실패: ${parts.join(', ') || lastMsgs.slice(-2).join(' / ') || '알 수 없는 오류'}${hint}`);
}

/** 성공 응답 처리. 성공이면 결과 객체, 실패면 null/'empty'/'badjson' */
function handleSuccess(res, model, ki, search, nKeys) {
  if (res.status !== 200) return null;
  const cand = res.data?.candidates?.[0];
  const text = (cand?.content?.parts || []).map((p) => p.text || '').join('\n');
  if (!text) return 'empty';
  const json = parseAnswer(text);
  if (!json) return 'badjson';
  saveSettings({ geminiKeyCursor: (ki + 1) % nKeys });
  const g = cand.groundingMetadata || {};
  const webSources = (g.groundingChunks || []).map((c) => c.web).filter((w) => w?.uri).map((w) => ({ title: w.title || w.uri, url: w.uri }));
  json.sources = [...(json.sources || []), ...webSources].filter((x, i, a) => x?.url && a.findIndex((y) => y.url === x.url) === i).slice(0, 20);
  json._meta = { model, keyIndex: ki + 1, searches: (g.webSearchQueries || []).length, web: search, at: Date.now() };
  return json;
}

function parseAnswer(text) {
  try {
    return extractJson(text);
  } catch {
    return null;
  }
}

/** 등록한 키를 하나씩 확인: 기본 호출 + 웹 검색 호출 */
export async function testKeys(raw, model) {
  const keys = parseKeys(raw);
  const m = model || GEMINI_MODELS[0];
  const ping = (search) => ({ contents: [{ parts: [{ text: 'OK라고만 답해' }] }], ...(search ? { tools: [{ google_search: {} }] } : {}), generationConfig: { maxOutputTokens: 64 } });
  const out = [];
  for (const [i, key] of keys.entries()) {
    const masked = `${key.slice(0, 6)}…${key.slice(-4)}`;
    const r1 = await callGemini(m, key, ping(false), 30000);
    if (r1.status !== 200) {
      const e = parseError(r1);
      out.push({ i: i + 1, masked, ok: false, text: e.kind === 'quota' ? `${m}: ${e.label}` : e.msg });
      continue;
    }
    const r2 = await callGemini(m, key, ping(true), 30000);
    if (r2.status === 200) out.push({ i: i + 1, masked, ok: true, text: '정상 (웹 검색 가능)' });
    else out.push({ i: i + 1, masked, ok: true, text: `정상 · 웹 검색 불가(${parseError(r2).label || parseError(r2).msg}) → 검색 없이 분석` });
  }
  return out;
}

/** 오늘 소진 기록 초기화 */
export function resetExhausted() {
  saveSettings({ geminiExhausted: { day: ptDay(), items: {} } });
}
