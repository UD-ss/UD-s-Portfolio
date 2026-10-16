# AGENTS.md — UD Portfolio (AI 에이전트 참고용)

모든 AI 코딩 에이전트(Claude Code, Cursor, opencode 등) 및 개발자가 이 프로젝트를 다룰 때 참고하는 지침 파일입니다.

---

## 1. 프로젝트 소개

정적 원페이지 포트폴리오입니다. 빌드 도구 없이 CDN 기반 순수 HTML/CSS/JS로 구성되어 있고,
**콘텐츠는 `index.html`에 하드코딩**되어 있습니다 (JSON·API·관리 UI 없음).

서버 기능은 **방문자 카운터 하나뿐**입니다 (`api/counter.js`, Vercel Blob 사용).

### 파일 구성
- `index.html` — 전체 마크업 + 콘텐츠 (히어로·소개·스킬·프로젝트·연락처·푸터)
- `style.css` — 테마 CSS 변수(라이트/다크) + 커스텀 스타일 + 애니메이션
- `script.js` — GSAP + Lenis + 섹션 잠금 + 캐러셀 + 스킬 팝업 + 커서 + 카운터
- `theme-init.js` — 첫 페인트 전 테마 적용 (FOUC 방지, body 첫머리에 로드)
- `tailwind.config.js` — Tailwind Play CDN 설정 (CDN 스크립트 다음에 로드)
- `api/counter.js` — 방문자 카운터 (Vercel Blob)
- `test-counter.js` — 카운터 API 검증
- `images/` — 쇼케이스 이미지 (jsDelivr 서빙)
- `vercel.json` — 보안 헤더 + CSP
- `robots.txt`, `CNAME`, `LICENSE`

### 이력
- 2026-10: 관리자 기능·콘텐츠 API·동적 OG 이미지·로컬 에디터를 제거하고, 사이트를 완전 정적
  + 방문자 카운터만 남김 (제거된 코드는 git 기록에 있음)

---

## 2. 구현 환경 (변경 시 반드시 유지할 핵심)

### 빌드 도구 없음
- Tailwind CSS는 CDN(`cdn.tailwindcss.com`) + `tailwind.config.js`로 로드
- JS 라이브러리 모두 CDN. 번들러, 트랜스파일러, 프레임워크 없음

### CDN 라이브러리
| 라이브러리 | 버전 | 용도 |
|---|---|---|
| Tailwind CSS | CDN latest | 유틸리티 CSS |
| Lenis | 1.1.18 | 스무스 스크롤 |
| GSAP / ScrollTrigger | 3.12.5 | 애니메이션 |
| SplitType | latest | 텍스트 분리 |
| Lucide | latest | SVG 아이콘 |
| Pretendard Variable | v1.3.9 | 가변 폰트 (히어로 이름 모프) |
| Space Grotesk / Inter | Google Fonts | 헤딩 / 본문 |

### 테마 시스템 (라이트/다크)
- `style.css`의 `:root, [data-theme="light"]` / `[data-theme="dark"]`가 CSS 변수 값을 가진다
- `theme-init.js`가 첫 페인트 전에 `body[data-theme]`를 설정한다
- `script.js`의 `#theme-toggle`이 전환하고 `localStorage('ud-theme')`에 저장한다
- 라이트 베이지 `#ece7dd` / 다크 그레이 `#1c1e20`, 포인트 라이트 `#0055ff` / 다크 `#3b82f6`

### 방문자 카운터 (`api/counter.js`)
- Vercel Blob(`counter.json`, `ratelimit.json`) 사용
- GET: `{ total, today }`, 날짜 변경 시 today 리셋, `Cache-Control: no-store`
- POST: total + 1, today + 1. 인메모리 IP당 분당 5회(429) + blob 영속 IP당 일 20회(초과 시 `X-Counted: 0`)
- IP는 SHA-256 해시로만 저장, 클라이언트는 `sessionStorage`(`vc-counted`)로 세션당 1회 POST
- CORS 헤더 없음(동일 출처 전용)

### 이미지
- `images/`의 파일은 jsDelivr으로 서빙: `cdn.jsdelivr.net/gh/UD-ss/UD-s-Portfolio@main/images/<file>`
- `index.html`의 프로젝트 이미지는 이 절대 URL을 직접 쓴다

### 보안 posture
- 서버 측 사용자 입력이 있는 엔드포인트가 `api/counter.js`뿐이다. 런타임 시크릿은 `BLOB_READ_WRITE_TOKEN` 하나
- `vercel.json`이 전체 경로에 `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`를 설정
- CSP는 HTML/CSS/JS 경로에 적용되며 **`script-src`에 `'unsafe-inline'`이 없다.** 인라인 `<script>`를 추가하면
  해당 기능이 죽는다 → 외부 파일로 옮길 것
  - CSP: `default-src 'self'`, `frame-ancestors 'none'`, `base-uri 'none'`, `form-action 'none'`, `object-src 'none'`
  - CDN 스크립트(`cdn.tailwindcss.com` 등)는 호스트가 명시되어 있어 `'unsafe-inline'` 없이 동작한다
  - Tailwind Play CDN은 `eval`/`new Function`을 쓰지 않으므로 `'unsafe-eval'`이 필요 없다 (재확인 필요 시 배포 후 확인)

---

## 3. 주요 기능 상세

### 섹션 자동 고정 (원페이지 잠금)
- `script.js`의 섹션 잠금 컨트롤러
- 휠 리스너는 캡처 단계(`capture: true`) + `e.lenisStopPropagation`으로 Lenis 중복 처리 방지
- 휠 한 번 = 섹션 한 칸. 버퍼는 지수 감쇠(`BUFFER_DECAY_MS = 260ms`, `WHEEL_STEP_THRESHOLD = 170`),
  큰 델타는 `WHEEL_NOTCH_DELTA = 75`로 우회
- 키보드: 화살표, PageUp/PageDown, Space. 터치: 스와이프 40px
- 좌표는 `computeSnapTargets()`로 계산. 섹션 추가/제거 시 재계산된다

### 히어로 이름 모프
- `#hero-name`: Pretendard Variable, `font-weight: 900 → 300` transition으로 연속 모프
- 이름 배열(`["UD", "ユーディー", "유디"]`)을 3.5초 간격으로 순환 (`script.js`의 `initHeroAnimations`)

### 스킬 카드 팝업
- 마우스 위치 추적 글로우, 클릭 시 전체 화면 팝업으로 확장(GSAP 타임라인)
- DOM 분리/복원 패턴 사용 → 팝업 열린 상태에서 다른 작업 시 주의

### 수평 프로젝트 캐러셀
- `#projects`는 `h-screen` 단일 잠금 섹션, ScrollTrigger 핀/scrub
- 첫 스크롤 진입 시 0→1→2→0 자동 재생(1.1초, `power3.inOut`), 포인터 드래그 + 휠 스와이프

### 반딧불이 배경 효과
- `#hero` 6개, `#about`/`#skills`/`#contact` 각 3개. 라이트는 따뜻한 어스톤, 다크는 쿨 블루/퍼플

### 커스텀 커서/노이즈 오버레이/프리로더
- `style.css` + `script.js`. 커서는 점 + 링, `mix-blend-mode: difference`

---

## 4. 컨벤션

- **주석 없음**: 모든 소스 파일에 주석 제거
- HTML/CSS/JS 모두 한글 UI 텍스트 포함 가능
- **모듈 없음**: `script.js`에 ES import/export 없음
- Tailwind 유틸리티 클래스 + 커스텀 CSS 혼용
- 텍스트 전체는 `user-select: none`
- **콘텐츠 수정**: `index.html`을 직접 편집한다 (JSON·API 없음)
- **새 스크립트를 HTML에 추가할 때**: 반드시 `src`를 쓰고 `vercel.json`의 CSP 경로 패턴에 추가한다

---

## 5. 배포

- Vercel, GitHub 연결, push 시 자동 배포. 커스텀 도메인 `portfolio.ud-ss.me` (CNAME)
- 런타임 Node.js 20. 의존성 `@vercel/blob` 하나
- 환경변수: `BLOB_READ_WRITE_TOKEN` (카운터가 사용)

---

## 6. 주의사항

- 인라인 `<script>`를 추가하면 CSP에 막혀 죽는다. 반드시 외부 파일로 만들 것
- 섹션 잠금 컨트롤러의 좌표는 `computeSnapTargets()`로 계산. 섹션 추가/제거 시 재계산
- 스킬 카드 팝업은 DOM을 실제로 분리/복원하므로 열린 상태에서 다른 작업 시 주의
- 프로젝트 이미지를 바꾸려면 `images/`에 넣고 `index.html`의 jsDelivr URL을 수정한다
- 테마 색상을 바꾸려면 `style.css`의 CSS 변수만 수정하면 된다
- Gemini 스킬 아이콘은 `data:image/svg+xml` 인라인 데이터 URL이다. 가능하면
  `https://cdn.simpleicons.org/gemini/...`로 교체하는 편이 낫다
