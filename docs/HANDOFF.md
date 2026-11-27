# 코인 검증기 — 작업 인수인계

새 세션에서 이 앱을 이어서 작업할 때 먼저 읽는 문서입니다. 비밀번호·서명 키·API 키는 이 문서와 저장소에 **없습니다**.

## 현재 상태 (2026-11-27)

| 항목 | 값 |
|---|---|
| 작업 브랜치 | `ccr-d8c2674c-4u94mc` (기본 브랜치에는 아직 병합 안 함) |
| 최신 앱 버전 | 1.5 (versionCode 6) — 백업 코드 복사/복원 추가 |
| 출시 파일 | `play-release/` = v1.4 (versionCode 5) AAB + 등록정보 + 스토어 이미지 |
| 다음 업데이트 | versionCode **7** 부터 사용 (6은 이미 테스트 APK로 배포함) |
| 패키지명 | `com.happyfamily.coinverifier` |
| 디자인 | 확정됨 → 이후 수정은 디자인 확인 없이 바로 테스트 APK 빌드 |

### 남은 일
- `play-release/privacy.html`을 웹에 올려 개인정보처리방침 URL 만들기 (GitHub Pages 등)
- Play Console 업로드 (v1.4 AAB). 백업 기능까지 넣어 올리려면 v1.5로 AAB 다시 빌드 후 `play-release/` 갱신
- 작업 브랜치를 기본 브랜치에 병합 (사용자 요청 시 PR)

## 서명 키

- 업로드 키 `upload.jks`(별칭 `upload`)와 비밀번호는 **사용자가 따로 보관**합니다. git에 절대 넣지 않습니다(.gitignore 처리됨).
- 인증서 SHA-256: `24:3D:57:B2:4A:47:F5:16:C1:6F:92:DD:1B:83:B6:79:0E:C8:6F:13:68:D5:4F:DB:0D:9C:19:EF:84:DE:B4:74`
- 빌드하려면 사용자에게 두 파일을 받아 `android/keystore.properties`를 만듭니다:
  ```
  storeFile=/절대경로/upload.jks
  storePassword=(비밀번호)
  keyAlias=upload
  keyPassword=(비밀번호)
  ```
- 이 파일이 있으면 **테스트 APK(debug)도 업로드 키로 서명**됩니다 → 세션이 바뀌어도 폰에 덮어 설치 가능.
- 업로드 키를 잃어버린 경우: Play App Signing을 쓰면 Play Console에서 "업로드 키 재설정"을 요청할 수 있습니다.

## 빌드 환경 다시 만들기 (클라우드 컨테이너)

```bash
# Android SDK
mkdir -p /opt/android-sdk && cd /opt/android-sdk
curl -sL -o clt.zip https://dl.google.com/android/repository/commandlinetools-linux-9862592_latest.zip
unzip -q clt.zip && mkdir -p cmdline-tools/latest && mv cmdline-tools/{bin,lib,NOTICE.txt,source.properties} cmdline-tools/latest/ && rm clt.zip
yes | cmdline-tools/latest/bin/sdkmanager --sdk_root=/opt/android-sdk "platform-tools" "platforms;android-36" "build-tools;36.0.0"

# 프로젝트
cd <저장소>
npm install
echo "sdk.dir=/opt/android-sdk" > android/local.properties
npm run build && npx cap sync android
cd android && ./gradlew assembleDebug      # 테스트 APK → app/build/outputs/apk/debug/
cd android && ./gradlew bundleRelease      # 출시 AAB → app/build/outputs/bundle/release/
```

버전은 `android/app/build.gradle`의 `versionCode`/`versionName`과 `src/main.js`의 "코인 검증기 vX.Y.0" 문구를 함께 올립니다.

## 구조

| 경로 | 역할 |
|---|---|
| `src/main.js` | 화면(홈/분석/알림/더보기, 리포트, 계산기, 설정), 뒤로가기 처리 |
| `src/ui/tabs.js` | 리포트 탭(수익·전략, 투자자, 온체인, 거래소, 리스크, 일정, 메모), 비교 화면 |
| `src/engine/analyze.js` | 분석 파이프라인, `localize()` 한국어 변환, `finalize()` 분류·점수·전략 |
| `src/engine/taxonomy.js` | 프로젝트 유형 17종, 참여 수익 방식 12종 분류 규칙 |
| `src/engine/score.js` | 신뢰도·가능성 점수 |
| `src/engine/strategy.js` | 초보자용 참여 전략 템플릿(이게 뭔가요/돈 버는 법/준비물/단계/예시/주의), 리스크 |
| `src/engine/ko-terms.js` | 코인 용어 한국어 사전(기계번역 오역 방지) |
| `src/api/sources.js` | CoinGecko, CoinPaprika, DefiLlama, DexScreener, GoPlus, 거래소 API |
| `src/api/ai.js` | Gemini API: 다중 키, 모델별 한도 처리, 검색 그라운딩 |
| `src/api/translate.js` | 무료 번역(Google gtx → WebView fetch → MyMemory) |
| `src/backup.js` | 백업 코드(gzip+base64, `CV1:` 접두사) 생성·복원 |
| `www/` | 정적 자산, `npm run build`로 `www/app.js` 생성 |

## 사용자가 정한 사항
- AI는 **Gemini API**만 사용(Claude API 아님). 키는 쉼표로 여러 개.
- 모델 순서: gemini-3.6-flash, gemini-3.5-flash, gemini-3.5-flash-lite, gemini-3.1-flash-lite, gemini-3.1-flash-lite-preview, gemini-3-flash-preview, gemini-flash-lite-latest
- 무료 한도는 "구글 프로젝트 × 모델" 단위 → 한 모델 한도 초과 시 같은 키로 다른 모델 시도, 검색 한도 시 검색 없이 재시도.
- AI 없이도 화면은 한국어로(용어 사전 + 무료 번역).
- 참여 전략은 초보자도 따라 할 수 있게 쉬운 존댓말로.
- 앱 아이콘: `assets/icon-source.png` (DeFi·Node·Airdrop).
