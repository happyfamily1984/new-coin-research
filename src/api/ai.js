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

/** 오류 종류 → 다음 키로 넘길지(key) / 다음 모델로 넘길지(model) */
function classify({ status, data }) {
  const reason = JSON.stringify(data?.error || '');
  if (status === 429 || /RESOURCE_EXHAUSTED|quota/i.test(reason)) return 'key';
  if (/API_KEY_INVALID|API key not valid|PERMISSION_DENIED|API_KEY/i.test(reason) || status === 401 || status === 403) return 'key';
  if (status === 404 || /not found|is not supported/i.test(reason)) return 'model';
  if (status === 0 || status >= 500) return 'model';
  if (status === 400) return 'model';
  return 'model';
}

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

  const body = {
    systemInstruction: { parts: [{ text: SYSTEM }] },
    contents: [{ role: 'user', parts: [{ text: buildPrompt(query, known) }] }],
    tools: [{ google_search: {} }],
    generationConfig: { temperature: 0.4, maxOutputTokens: 16384 },
  };

  const deadKeys = new Set(); // 이번 요청에서 무효/한도초과 판정된 키
  const errors = [];
  let start = (s.geminiKeyCursor || 0) % keys.length; // 키를 돌아가며 사용해 부하 분산
  for (const model of models) {
    for (let n = 0; n < keys.length; n++) {
      const ki = (start + n) % keys.length;
      if (deadKeys.has(ki)) continue;
      onProgress(`${model} · 키 ${ki + 1}/${keys.length}로 웹 검색·분석 중…`);
      const res = await callGemini(model, keys[ki], body);
      const cand = res.data?.candidates?.[0];
      const text = (cand?.content?.parts || []).map((p) => p.text || '').join('\n');
      if (res.status === 200 && text) {
        saveSettings({ geminiKeyCursor: (ki + 1) % keys.length });
        const json = parseAnswer(text);
        if (!json) {
          errors.push(`${model}: 응답 형식 오류`);
          break; // 같은 모델 다른 키로 반복해도 같으므로 다음 모델
        }
        const g = cand.groundingMetadata || {};
        const webSources = (g.groundingChunks || []).map((c) => c.web).filter((w) => w?.uri).map((w) => ({ title: w.title || w.uri, url: w.uri }));
        json.sources = [...(json.sources || []), ...webSources].filter((x, i, a) => x?.url && a.findIndex((y) => y.url === x.url) === i).slice(0, 20);
        json._meta = { model, keyIndex: ki + 1, searches: (g.webSearchQueries || []).length, at: Date.now() };
        return json;
      }
      if (res.status === 200) {
        errors.push(`${model}: 빈 응답(${cand?.finishReason || '사유 없음'})`);
        break;
      }
      const kind = classify(res);
      const msg = res.data?.error?.message || res.error || `HTTP ${res.status}`;
      errors.push(`${model} 키${ki + 1}: ${msg.slice(0, 80)}`);
      if (kind === 'key') {
        deadKeys.add(ki);
        continue;
      }
      break; // 모델 문제 → 다음 모델
    }
    if (deadKeys.size >= keys.length) break;
    start = 0;
  }
  const allKeysDead = deadKeys.size >= keys.length;
  throw new Error(allKeysDead ? `등록한 키 ${keys.length}개 모두 한도 초과 또는 무효입니다` : `AI 분석 실패 (${errors.slice(-2).join(' / ')})`);
}

function parseAnswer(text) {
  try {
    return extractJson(text);
  } catch {
    return null;
  }
}

/** 등록한 키를 하나씩 짧게 호출해 상태 확인 */
export async function testKeys(raw, model) {
  const keys = parseKeys(raw);
  const out = [];
  for (const [i, key] of keys.entries()) {
    const res = await callGemini(model || GEMINI_MODELS[0], key, { contents: [{ parts: [{ text: 'OK라고만 답해' }] }], generationConfig: { maxOutputTokens: 16 } }, 30000);
    const msg = res.data?.error?.message || res.error || '';
    let state;
    if (res.status === 200) state = { ok: true, text: '정상' };
    else if (res.status === 429 || /RESOURCE_EXHAUSTED|quota/i.test(msg)) state = { ok: false, text: '무료 한도 초과(잠시 후 재사용 가능)' };
    else if (/API key not valid|API_KEY_INVALID/i.test(JSON.stringify(res.data || ''))) state = { ok: false, text: '잘못된 키' };
    else if (res.status === 403) state = { ok: false, text: '권한 없음(API 미사용 설정 또는 지역 제한)' };
    else if (res.status === 404) state = { ok: false, text: `모델 ${model} 사용 불가` };
    else state = { ok: false, text: msg ? msg.slice(0, 60) : `연결 실패(${res.status})` };
    out.push({ i: i + 1, masked: `${key.slice(0, 6)}…${key.slice(-4)}`, ...state });
  }
  return out;
}
