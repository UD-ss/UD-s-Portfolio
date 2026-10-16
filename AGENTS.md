# AGENTS.md — UD Portfolio (AI 에이전트 참고용)

모든 AI 코딩 에이전트(Claude Code, Cursor, opencode 등) 및 개발자가 이 프로젝트를 다룰 때 참고하는 지침 파일입니다.

---

## 1. 프로젝트 소개

**두 개의 Vercel 프로젝트입니다.**

| 프로젝트 | 저장소 | 도메인 | 공개 여부 |
|---|---|---|---|
| 공개 사이트 | `UD-ss/UD-s-Portfolio` (이 리포) | `portfolio.ud-ss.me` | public |
| 관리자 | `UD-ss/UD-s-Portfolio-Admin` (별도) | `admin.ud-ss.me` | **private** |

공개 사이트는 정적 원페이지 포트폴리오입니다. 빌드 도구 없이 CDN 기반 순수 HTML/CSS/JS로 구성되어 있고,
**콘텐츠의 원본은 두 곳**입니다. 리포의 `data/*.json`이 기본값이고, 관리 프로젝트가 Vercel Blob에 저장한
값이 있으면 그것을 우선합니다. 기본값이 남아 있으므로 blob이 죽어도 사이트는 정상 동작합니다.

**관리 UI는 `/admin` 하위 경로로 접근합니다 (현재 비활성).** 공개 프로젝트의 `vercel.json`이
`/admin`과 `/admin/:path*`를 `admin.ud-ss.me`로 rewrite(프록시)하도록 구성되어 있으나, 지금은
`redirects`가 `/admin`을 `/`로 돌려 **기능이 꺼져 있습니다.** 활성화하려면 `redirects`를
`/admin` → `/admin/` 한 줄로 바꾸면 됩니다.
관리 코드는 이 리포에 **없고** private 리포에만 있습니다 (이 리포는 public이므로 코드를 커밋하면 그대로 노출됩니다).

**관리 페이지의 인증은 코드가 아니라 Vercel WAF가 담당합니다.** WAF 커스텀 규칙이 **허용된 IP**만
`/admin`에 통과시킵니다. 관리 프로젝트에도 같은 IP 규칙을 걸어 직접 접근(`admin.ud-ss.me`,
`*.vercel.app`)을 막습니다. 따라서 어느 리포에도 TOTP·세션 토큰·레이트리밋 코드가 없습니다.
(Deployment Protection은 프로젝트 전체를 막아 프록시 홉을 차단하므로 쓰지 않습니다.)

### 공개 리포 파일 구성
- `index.html` — 전체 마크업 (Tailwind CDN + 인라인 tailwind.config + 동적 렌더링)
- `style.css` — 커스텀 스타일, 테마 CSS 변수, 커스텀 애니메이션
- `script.js` — GSAP + Lenis + 섹션 잠금 컨트롤러
- `tailwind.config.js` — Tailwind Play CDN 설정 (CDN 스크립트 다음에 로드)
- `theme-init.js` — 첫 페인트 전 테마 적용 (FOUC 방지, body 첫머리에 로드)
- `content.js` — 콘텐츠 로드 + 렌더링 + 새니타이저
- `data/site.json` — 사이트 설정 **기본값**
- `data/projects.json` — 프로젝트 **기본값**
- `api/content.js` — 읽기 전용. blob 설정을 반환하고 없으면 `data/*.json`으로 폴백
- `api/og.js` — 동적 OG 이미지 (opentype.js + sharp)
- `api/counter.js` — Vercel Blob 기반 방문자 카운터
- `vercel.json` — 보안 헤더 + CSP + `/admin` redirect/rewrite(프록시)
- `test-site.js` / `test-counter.js` — 검증
- `dev/editor.html` — 로컬 전용 콘텐츠 에디터 (`.gitignore` 처리)
- `admin/` — 관리 프로젝트 스태이징 폴더 (`.gitignore` 처리, **이 리포에 커밋 금지**)
- `images/` — 쇼케이스 이미지 (jsDelivr 서빙)
- `robots.txt`, `CNAME`, `LICENSE`

### 이력
- 2026-10: 관리자 기능을 별도 private 프로젝트로 분리 (`manage.html`, `api/auth.js`, `api/config.js`,
  `api/projects.js`, `api/upload.js`, `api/log.js`, `otpauth` 의존성, 테스트 6종, 인라인 스크립트 4개 제거)
- 2026-10-16: 관리 UI를 `/admin` 하위 경로로 서빙하도록 변경. 코드를 이 리포에 통합하는 안을 검토했으나
  public 리포 노출 때문에 취소하고, **공개 프로젝트가 `/admin`을 `admin.ud-ss.me`로 rewrite(프록시)**하는
  방식으로 확정. 인증은 Vercel Authentication 대신 WAF IP 허용목록으로 전환

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

### 콘텐츠 파이프라인
1. `content.js`가 `GET /api/content`를 요청한다
2. 실패하면 `GET /data/site.json`, `GET /data/projects.json`으로 폴백
3. `applySiteConfig(cfg)`가 테마 CSS 변수를 `#dynamic-theme`에, `renderProjects()`가 프로젝트를 렌더링
4. **토큰이 없다.** 콘텐츠는 신뢰할 수 없는 입력으로 취급하고 렌더 직전에 검증한다

### 테마 시스템 (라이트/다크)
- `data/site.json`의 `theme.light` / `theme.dark`가 18개 CSS 변수 값을 가진다
- `content.js`의 `applySiteConfig()`가 `--kebab-case`로 변환해 `#dynamic-theme`에 `textContent`로 주입
- 라이트 베이지 `#ece7dd` / 다크 그레이 `#1c1e20`, 포인트 라이트 `#0055ff` / 다크 `#3b82f6`
- `localStorage.getItem('ud-theme')`으로 저장, 시스템 선호도 감지

### 렌더 측 안전장치 (`content.js`)
- **`sanitizeRichText()`**: `DOMParser`로 파싱한 뒤 허용 태그/속성만 남긴다. 정규식 기반 필터는
  `<span/onmouseover=...>` 형태로 우회되므로 **사용하지 않는다**
  - `about.html` 허용 태그: span b i em strong br p a code mark small sub sup u s del ins abbr q cite dfn time data var kbd samp ruby rt rp wbr div
  - `a`는 `href`만, `span/div/code/mark`는 `class`만 허용. 클래스는 `highlight-phrase`, `highlight-text`, `highlight-line`만
- **`safeHref()`**: `http(s)`, `mailto:`, `#`, `/`, `./`만 허용. 제어문자 제거 후 검사하므로 `java\nscript:` 우회가 막힌다
- **`imageUrl()`**: `http(s)` 또는 안전한 확장자를 가진 파일명만. jsDelivr 경로로 변환
- **`escHtml()` / `escAttr()`**: 프로젝트 텍스트 렌더링
- 테마 값은 `^[#a-zA-Z0-9(),.%s_-]{1,80}$` + `;` `{}` 불가로 admin API에서 이미 걸러진다

### 이미지
- `images/`의 파일은 jsDelivr으로 서빙: `cdn.jsdelivr.net/gh/UD-ss/UD-s-Portfolio@main/images/<file>`
- 프로젝트 `image`에 파일명만 넣으면 jsDelivr 경로가 되고, `https://`면 그대로 사용
- 업로드는 관리 프로젝트에서만 가능하며 blob에 저장된다

### OG 이미지 (`api/og.js`)
- opentype.js(텍스트→SVG path) + sharp(SVG→PNG)
- **반드시 정적(static) WOFF 폰트** — 가변 폰트나 WOFF2는 opentype.js에서 호환성 문제
- `sharp >= 0.35.5` 유지 — 미만은 librsvg CVE-2026-96889(외부 리소스 페치 기반 SSRF)에 취약. 다운그레이드 금지
- 설정은 blob의 `config.json`을 우선 쓰고 없으면 `require('../../data/site.json')` 폴백. 정적 require로 빌드 시점에 번들되므로
  배포된 OG 이미지는 배포 시점 설정을 사용한다
- 색상은 `COLOR_RE` hex만 허용 → SVG 속성 인젝션 차단
- 쿼리 파라미터: `desc`, `theme`(light/dark). 캐시 `public, max-age=3600`

### 방문자 카운터 (`api/counter.js`)
- Vercel Blob(`counter.json`, `ratelimit.json`) 사용
- GET: `{ total, today }`, 날짜 변경 시 today 리셋, `Cache-Control: no-store`
- POST: total + 1, today + 1. 인메모리 IP당 분당 5회(429) + blob 영속 IP당 일 20회(초과 시 `X-Counted: 0`)
- IP는 SHA-256 해시로만 저장, 클라이언트는 `sessionStorage`(`vc-counted`)로 세션당 1회 POST
- CORS 헤더 없음(동일 출처 전용)

### 보안 posture
- 서버 측 사용자 입력이 있는 엔드포인트가 공개 프로젝트에 없다. `api/og.js`의 쿼리 파라미터는 폰트 그리프로
  변환되어 마크업으로 해석되지 않고, 색상은 hex만 통과한다
- 관리 코드·인증·업로드 API는 public 리포에 없다. 런타임 시크릿은 `BLOB_READ_WRITE_TOKEN` 하나뿐
- `/admin` 보호는 **Vercel WAF 커스텀 규칙(IP 허용목록)**이 담당한다. 코드가 아니다 → `admin/README.md` 참고
  - 공개 프로젝트: `/admin` 경로를 IP 허용목록으로 제한 (실제 클라이언트 IP를 본다)
  - 관리 프로젝트: 모든 경로를 IP 허용목록으로 제한 (직접 접근 차단). 프록시 홉에서도 실제 IP가 보이는지 배포 후 확인
- 관리 프로젝트의 `api/_shared.js` Origin 검사는 **Origin 헤더가 없으면 통과**시키므로 브라우저 밖 도구는
  막지 못한다. `portfolio.ud-ss.me`를 허용 origin에 추가해 프록시 경유 요청을 통과시킨다 → IP 허용목록이 실질 방어선
- `vercel.json`이 전체 경로에 `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`를 설정
- 공개 프로젝트 CSP는 HTML/CSS/JS 경로에 적용되며 **`script-src`에 `'unsafe-inline'`이 없다.** 인라인
  `<script>`를 추가하면 해당 기능이 죽는다 → 외부 파일로 옮길 것
  - CSP: `default-src 'self'`, `frame-ancestors 'none'`, `base-uri 'none'`, `form-action 'none'`, `object-src 'none'`
  - CDN 스크립트(`cdn.tailwindcss.com` 등)는 호스트가 명시되어 있어 `'unsafe-inline'` 없이 동작한다
  - Tailwind Play CDN은 `eval`/`new Function`을 쓰지 않으므로 `'unsafe-eval'`이 필요 없다 (재확인 필요 시 배포 후 확인)
- `test-site.js`가 아키텍처 불변식을 강제한다: 인라인 스크립트 금지, 금지 엔드포인트 참조 금지, `api/`는
  `content.js`·`counter.js`·`og.js`만, `manage.html` 부재, `/admin` 프록시 rewrite 존재, 의존성 3개 고정,
  `script-src`에 `unsafe-inline` 금지

---

## 3. 주요 기능 상세

### 섹션 자동 고정 (원페이지 잠금)
- `script.js`의 `#14 ONE-PAGE SECTION LOCKING CONTROLLER`
- 휠 리스너는 캡처 단계(`capture: true`) + `e.lenisStopPropagation`으로 Lenis 중복 처리 방지
- 휠 한 번 = 섹션 한 칸. 버퍼는 지수 감쇠(`BUFFER_DECAY_MS = 260ms`, `WHEEL_STEP_THRESHOLD = 170`),
  큰 델타는 `WHEEL_NOTCH_DELTA = 75`로 우회
- 키보드: 화살표, PageUp/PageDown, Space. 터치: 스와이프 40px

### 히어로 이름 모프
- `#hero-name`: Pretendard Variable, `font-weight: 900 → 300` transition으로 연속 모프
- `hero.names` 배열 순환, `hero.nameCyclingInterval` ms 간격. `window.applyHeroConfig()`로 런타임 변경

### 스킬 카드 팝업
- 마우스 위치 추적 글로우, 클릭 시 전체 화면 팝업으로 확장(GSAP 타임라인)
- DOM 분리/복원 패턴 사용 → 팝업 열린 상태에서 다른 작업 시 주의

### 수평 프로젝트 캐러셀
- `#projects`는 `h-screen` 단일 잠금 섹션, ScrollTrigger 핀/scrub 없음
- 첫 스크롤 진입 시 0→1→2→0 자동 재생(1.1초, `power3.inOut`), 포인터 드래그 + 휠 스와이프

### 반딧불이 배경 효과
- `#hero` 6개, `#about`/`#skills`/`#contact` 각 3개. 라이트는 따뜻한 어스톤, 다크는 쿨 블루/퍼플

### 커스텀 커서/노이즈 오버레이/프리로더
- `style.css` + `script.js`. 커서는 점 + 링, `mix-blend-mode: difference`

---

## 4. 컨벤션

- **주석 없음**: 모든 소스 파일에 주석 제거
- HTML/CSS/JS 모두 한글 UI 텍스트 포함 가능
- **모듈 없음**: `script.js`·`content.js`에 ES import/export 없음
- Tailwind 유틸리티 클래스 + 커스텀 CSS 혼용
- 텍스트 전체는 `user-select: none`
- **콘텐츠 추가 규칙**: `data/*.json`만 수정한다. 프로젝트 이미지 `image`는 파일명 또는 `https://` URL만.
  색상은 hex 또는 `rgba()`. `about.html`은 `sanitizeRichText` 허용 태그만
- **새 스크립트를 HTML에 추가할 때**: 반드시 `src`를 쓰고 `vercel.json`의 CSP 경로 패턴에 추가한다

---

## 5. 콘텐츠 수정 절차

### A. 로컬에서 (권장, 이 리포만 건드림)
1. `dev/editor.html`을 브라우저에서 열어 `data/site.json` 또는 `data/projects.json` 선택 (또는 드래그&드롭)
2. 편집 후 **검증** → **저장** (파일 핸들이 있으면 원본에 직접 기록, 없으면 내려받기)
3. 이미지 추가: `images 폴더 연결` 후 프로젝트의 `image` 필드에서 파일 선택
4. `npm test` 통과 확인
5. `git add data/ images/ && git commit && git push` → Vercel 자동 배포

브라우저를 쓰지 않고 JSON을 직접 편집해도 동일하게 `npm test`만 돌리면 된다.

### B. 관리 페이지에서 (배포된 상태 즉시 반영)
1. `portfolio.ud-ss.me/admin` 접속 (허용된 IP에서만 열린다)
2. 사이트 설정/프로젝트 탭에서 편집 후 저장
3. `api/content`가 60초 캐시하므로 최대 1분 뒤 반영된다
4. `data/*.json`은 여전히 기본값으로 남아 있다. 이 리포에 커밋하고 싶으면 관리 페이지의
   내보내기(JSON 다운로드) 결과를 `data/`에 반영하면 된다

---

## 6. 배포

### 공개 사이트 (이 리포)
- Vercel, GitHub 연결, push 시 자동 배포. 커스텀 도메인 `portfolio.ud-ss.me` (CNAME)
- 런타임 Node.js 20. 의존성 `@vercel/blob`, `sharp`, `opentype.js`
- 환경변수: `BLOB_READ_WRITE_TOKEN`
- `vercel.json`의 `redirects`/`rewrites`가 `/admin` → `admin.ud-ss.me` 프록시를 구성한다.
  **현재는 `redirects`가 `/admin`을 `/`로 돌려 기능이 꺼져 있다.** 활성화하려면 `redirects`를
  `/admin` → `/admin/` 한 줄로 바꾼다 (상대 경로 해석 때문에 필요)
- `/admin` 보호는 **Vercel 대시보드 → Firewall → Custom Rules**에서 설정한다 (코드 아님).
  규칙과 절차는 `admin/README.md` 참고. **이 규칙이 없으면 관리 페이지가 PUBLIC으로 열린다.** 반드시 확인할 것

### 관리 프로젝트
- private 리포, Vercel 별도 프로젝트, 커스텀 도메인 `admin.ud-ss.me`
- **Firewall → Custom Rules**에서 모든 경로를 IP 허용목록으로 제한한다 (직접 접근 차단).
  배포 후 프록시 경유 요청에서 실제 클라이언트 IP가 보이는지 반드시 확인한다 (안 보이면 IP 규칙이 프록시를 막는다)
- 환경변수: `BLOB_READ_WRITE_TOKEN` (**공개 사이트와 동일한 값** — 같은 스토어 공유)
- 셋업 절차와 API 상세는 `admin/README.md` 참고

---

## 7. 주의사항

- `data/site.json`은 `api/og.js`가 `require`로 번들한다. OG 이미지를 로컬에서 미리 볼 수 없다
- 테마 색상을 바꾸면 세 곳이 함께 바뀐다: `data/site.json` → `content.js`의 `#dynamic-theme` → `api/og.js`.
  `style.css`는 정적 기본값이라 JSON이 항상 이긴다
- 인라인 `<script>`를 추가하면 CSP에 막혀 죽는다. 반드시 외부 파일로 만들 것
- 섹션 잠금 컨트롤러의 좌표는 `computeSnapTargets()`로 계산. 섹션 추가/제거 시 재계산
- 스킬 카드 팝업은 DOM을 실제로 분리/복원하므로 열린 상태에서 다른 작업 시 주의
- `data/*.json`을 fetch로 로드하므로 동일 출처 정적 서빙이 전제다. `file://`로 열면 콘텐츠가 비어 보인다
- Gemini 스킬 아이콘은 `data:image/svg+xml` 인라인 데이터 URL이다. 가능하면
  `https://cdn.simpleicons.org/gemini/...`로 교체하는 편이 낫다
- 새 API를 추가한다면 `/api/admin/*`는 관리 프로젝트에 둔다. 공개 프로젝트에는 읽기 전용 API만 둔다
- 관리 UI에 인라인 `<script>`를 추가하지 않는다. `admin/admin.js`로 옮길 것 (관리 프로젝트도 CSP를 건다)
- `vercel.json`의 rewrite 대상은 `admin.ud-ss.me`다. 관리 프로젝트 도메인을 바꾸면 여기도 함께 바꾼다