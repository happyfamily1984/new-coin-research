// Claude API + 웹 검색 기반 심층 분석 (선택 기능: 설정에서 API 키 입력 시)
import Anthropic from '@anthropic-ai/sdk';
import { getSettings } from '../store.js';
import { PROJECT_TYPES, EARN_METHODS } from '../engine/taxonomy.js';

const SYSTEM = `당신은 신규 암호화폐 프로젝트를 검증하는 리서치 애널리스트입니다.
웹 검색으로 최신 정보를 조사하고 한국어로 답합니다. 확인되지 않은 내용은 추측하지 말고 "미확인"이라고 쓰세요.
일반 개인 투자자가 참여해 수익을 낼 수 있는 현실적인 방법을 제시하되, 위험을 숨기지 마세요.
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
 "strategies": [{"title": "", "method": "earnMethods key", "difficulty": "쉬움|보통|어려움", "capital": "", "period": "", "risk": "낮음|중간|높음", "expected": "기대 수익 시나리오", "steps": ["구체적 단계"], "cautions": [""]}],
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

/**
 * @param {string} query
 * @param {object} known 이미 수집한 요약 데이터
 * @param {(msg:string)=>void} onProgress
 */
export async function aiDeepResearch(query, known, onProgress = () => {}) {
  const s = getSettings();
  if (!s.claudeKey) return null;
  const client = new Anthropic({
    apiKey: s.claudeKey,
    dangerouslyAllowBrowser: true, // 사용자가 직접 입력한 본인 키를 기기 안에서만 사용
    // Capacitor 네이티브 HTTP 패치는 스트리밍을 지원하지 않으므로 원본 WebView fetch 사용
    fetch: (globalThis.CapacitorWebFetch || globalThis.fetch).bind(globalThis),
    maxRetries: 2,
    timeout: 10 * 60 * 1000,
  });

  const messages = [{ role: 'user', content: buildPrompt(query, known) }];
  let final;
  let searches = 0;
  for (let turn = 0; turn < 4; turn++) {
    const stream = client.beta.messages.stream({
      model: s.claudeModel || 'claude-opus-5-5',
      max_tokens: 32000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: SYSTEM,
      output_config: { effort: s.aiEffort || 'medium' },
      tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 10 }],
      messages,
    });
    stream.on('streamEvent', (ev) => {
      if (ev.type === 'content_block_start' && ev.content_block?.type === 'server_tool_use') {
        searches++;
        onProgress(`웹 검색 중… (${searches}회)`);
      } else if (ev.type === 'content_block_start' && ev.content_block?.type === 'text') {
        onProgress('AI가 리포트를 작성하는 중…');
      }
    });
    final = await stream.finalMessage();
    if (final.stop_reason === 'pause_turn') {
      messages.push({ role: 'assistant', content: final.content });
      continue;
    }
    break;
  }
  if (final.stop_reason === 'refusal') throw new Error('AI가 이 요청을 처리하지 못했습니다.');
  const text = final.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n');
  try {
    const json = extractJson(text);
    json._meta = { model: final.model, searches, at: Date.now() };
    return json;
  } catch {
    throw new Error('AI 응답을 해석하지 못했습니다. 다시 시도해 주세요.');
  }
}
