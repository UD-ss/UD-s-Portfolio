# AGENTS.md — UD Portfolio (AI 에이전트 참고용)

모든 AI 코딩 에이전트(Claude Code, Cursor, opencode 등) 및 개발자가 이 프로젝트를 다룰 때 참고하는 지침 파일입니다.

---

## 1. 프로젝트 소개

정적 원페이지 포트폴리오 사이트. 빌드 도구 없이 CDN 기반 순수 HTML/CSS/JS로 구성되어 있다.

- **파일 구성**
  - `index.html` — 전체 마크업 (Tailwind CDN 클래스 + 인라인 tailwind.config)
  - `style.css` — 커스텀 스타일, 테마 CSS 변수, 커스텀 애니메이션
  - `script.js` — GSAP + Lenis + 섹션 잠금(one-page) 컨트롤러
  - `api/log.js` — Vercel 서버리스 함수. 클라이언트 로그 수신 후 Apps Script Web App URL(`SHEETS_WEBHOOK_URL` env)로 포워딩
  - `api/counter.js` — Vercel Blob 기반 방문자 카운터 (total + today)
  - `api/og.js` — 동적 OG 이미지 생성 (opentype.js + sharp)
  - `vercel.json` — Vercel 배포 설정 (비어있음, 기본값 사용)
  - `images/` — 쇼케이스 패널 이미지(`ud-space.png`, `manga-translate.png`, `flowplan.png`)
  - `LICENSE` — Apache 2.0, `CNAME` — `portfolio.ud-ss.me`

---

## 2. 구현 환경 (변경 시 반드시 유지할 핵심)

### 빌드 도구 없음
- Tailwind CSS는 CDN(`cdn.tailwindcss.com`) + 인라인 `tailwind.config`로 로드
- JS 라이브러리 모두 CDN (unpkg, cdnjs, jsdelivr)으로 로드
- 번들러, 트랜스파일러, 프레임워크 없음. 순수 바닐라 JS

### CDN 라이브러리
| 라이브러리 | 버전 | 용도 |
|---|---|---|
| Tailwind CSS | CDN latest | 유틸리티 CSS |
| Lenis | 1.1.18 | 스무스 스크롤 |
| GSAP | 3.12.5 | 애니메이션 |
| ScrollTrigger | 3.12.5 | 스크롤 기반 애니메이션 |
| SplitType | latest | 텍스트 분리 (단어/글자 애니메이션) |
| Lucide | latest | SVG 아이콘 |
| Pretendard Variable | v1.3.9 | 가변 폰트 (히어로 이름 모프) |
| Space Grotesk | Google Fonts | 디스플레이 헤딩 |
| Inter | Google Fonts | 본문 폰트 fallback |

### 테마 시스템 (라이트/다크)
- `style.css`의 CSS 변수(`--bg`, `--fg`, `--muted` 등)가 색상 결정
- `index.html`의 `tailwind.config`와 `script.js`의 nav 배경 하드코딩도 함께 맞춰야 한다
- 라이트: 베이지(`#ece7dd`), 다크: 다크 그레이(`#1c1e20`)
- 포인트: 라이트 `#0055ff`, 다크 `#3b82f6`
- 19개 CSS 변수가 테마별로 정의됨 (`--bg`, `--fg`, `--muted`, `--card-bg`, `--card-border`, `--border`, `--point`, `--highlight-bg`, `--highlight-fg`, `--highlight-card`, `--list-hover-bg`, `--preloader-bg`, `--preloader-fg`, `--glass-bg`, `--glass-border`, `--cursor-blend`, `--logo-filter-base`, `--logo-opacity-base`)
- `localStorage.getItem('ud-theme')`으로 저장, 시스템 선호도 감지

### 로깅 파이프라인
- 클라이언트(`script.js`의 `sendLog`) → `POST /api/log` (Vercel) → Apps Script `doPost` → Google Sheets
- 방문 로그는 세션당 1회(`sessionStorage`), 테마 변경 시 `sendLog('theme')`
- 엔드포인트는 상대 경로 `"/api/log"`
- `api/log.js`는 Vercel 대시보드의 `SHEETS_WEBHOOK_URL` 환경 변수 필요

### OG 이미지 (`api/og.js`)
- opentype.js (텍스트→SVG path) + sharp (SVG→PNG) 조합
- Pretendard 정적 WOFF 폰트 사용 (jsDelivr CDN에서 런타임 fetch)
- **반드시 정적(static) WOFF 폰트를 써야 함** — 가변(variable) 폰트나 WOFF2는 opentype.js에서 호환성 문제 발생
- 쿼리 파라미터: `title`, `subtitle`, `desc`, `theme`
- 캐시: `Cache-Control: public, immutable, no-transform, max-age=31536000`
- 디자인: 메인 히어로 첫 화면 미니멀 스타일 (중앙 초대형 UD + 디바이더 라인 + 서브타이틀 + 반딧불이 6개 발광 오브 + 노이즈 텍스처)

### 방문자 카운터 (`api/counter.js`)
- Vercel Blob 저장소(`counter.json`) 사용
- GET: `{ total, today }` 반환, 날짜 변경 시 today 리셋
- POST: total + 1, today + 1
- 클라이언트: `sessionStorage`(`vc-counted`)로 세션당 1회 POST

---

## 3. 주요 기능 상세

### 섹션 자동 고정 (원페이지 잠금)
- `script.js`의 `#14 ONE-PAGE SECTION LOCKING CONTROLLER`
- 휠 리스너는 **캡처 단계(`capture: true`)** + `e.lenisStopPropagation`으로 Lenis 중복 처리 방지
- 휠 한 번 = 섹션 한 칸 이동 (`goToStep`)
- 휠 버퍼: 지수 감쇠(`BUFFER_DECAY_MS = 260ms`), 임계값 `WHEEL_STEP_THRESHOLD = 170`
- 큰 델타: `WHEEL_NOTCH_DELTA = 75`로 버퍼 우회
- 키보드: 화살표, PageUp/PageDown, Space
- 터치: 스와이프 40px 임계값

### 히어로 이름 모프
- `#hero-name`: Pretendard Variable 폰트, `font-weight: 900 → 300` transition으로 픽셀 단위 연속 모프
- 이름 순환: "UD" ↔ "ユーディー" ↔ "유디" 3.5초 간격

### 스킬 카드 팝업
- 마우스 위치 추적 글로우 효과 (radial gradient)
- 클릭 시 전체 화면 팝업으로 확장
- GSAP 타임라인: 카드 위치 → 화면 중앙 모프
- DOM 분리/복원 패턴: 팝업 열 때 items를 overlay로 이동, 닫을 때 원래 부모로 복원

### 수평 프로젝트 캐러셀
- `#projects`: `h-screen` 단일 잠금 섹션, ScrollTrigger 핀/scrub 없음
- 자동 재생: 첫 스크롤 진입 시 0→1→2→0 패널 시퀀스 (1.1초, `power3.inOut`)
- 포인터 드래그 (스냅) + 휠/트랙패드 가로 스와이프
- 패널은 세로로 화면 중앙 정렬, 좌우 100px 여백

### 반딧불이 배경 효과
- `#hero` 6개, `#about`/`#skills`/`#contact` 각 3개
- 라이트: 따뜻한 어스톤, 다크: 쿨 블루/퍼플

### 커스텀 커서/노이즈 오버레이/프리로더
- `style.css` + `script.js` 초기화
- 커서: 점 + 링, `mix-blend-mode: difference`

---

## 4. 컨벤션

- **주석 없음**: 모든 소스 파일에 주석 제거
- HTML/CSS/JS 모두 한글 UI 텍스트 포함 가능
- **모듈 없음**: script.js에 ES import/export 없음. 모든 코드가 `DOMContentLoaded` 리스너 안에 위치
- Tailwind 유틸리티 클래스 + 커스텀 CSS 혼용 구조
- 텍스트 전체는 `user-select: none` (드래그 선택 불가)
- `images/` 폴더의 파일은 jsDelivr CDN으로 서빙 (`cdn.jsdelivr.net/gh/UD-ss/UD-s-Portfolio@main/images/<file>`)

---

## 5. 배포

- **플랫폼**: Vercel (GitHub 연결, push 시 자동 배포)
- **커스텀 도메인**: `portfolio.ud-ss.me` (CNAME 파일)
- **런타임**: Node.js 20
- **vercel.json**: 비어있음 (`{}`). 정적 파일 + `/api/` 함수 자동 감지
- **의존성**: `@vercel/blob`(카운터), `sharp`(OG 이미지), `opentype.js`(OG 이미지)

### 환경 변수 (Vercel 대시보드에서 설정)
| 변수 | 용도 |
|---|---|
| `SHEETS_WEBHOOK_URL` | Google Apps Script Web App URL (로그 포워딩) |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob 저장소 토큰 (방문자 카운터) |

---

## 6. 주의사항

- 테마 색상 변경 시 `style.css` CSS 변수 + `index.html` tailwind.config + `script.js` nav 배경 + `api/og.js` 색상 4곳을 모두 맞춰야 한다
- 섹션 잠금 컨트롤러의 섹션 좌표는 `computeSnapTargets()`로 계산. 섹션 추가/제거 시 재계산 필요
- 스킬 카드 팝업은 DOM 요소를 실제로 분리/복원하므로, 팝업 열린 상태에서 다른 작업 시 주의
- `api/og.js`의 폰트는 반드시 **정적 WOFF** (가변/WOFF2 사용 금지)
- `images/`의 이미지는 jsDelivr CDN 경로로 참조. 파일 교체 시 같은 파일명으로 덮어쓰면 됨
