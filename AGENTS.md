# AGENTS.md — UD Portfolio (AI 에이전트 참고용)

모든 AI 코딩 에이전트(Claude Code, Cursor, opencode 등) 및 개발자가 이 프로젝트를 다룰 때 참고하는 지침 파일입니다.

---

## 1. 실행 계획 (첫 번째 우선순위)

다음 단계를 순서대로 수행한다.

1. 작업 요청이 들어오면 먼저 `index.html`, `style.css`, `script.js`의 현재 상태를 읽고 구조를 파악한다.
2. 기존 구현 패턴(아래 "구현 환경" 참고)을 지키며 최소 변경으로 작업한다.
3. 수정 후 로컬에서 검증한다.
   - JS: `node --check script.js`
   - 브라우저에서 실제 동작 확인(섹션 잠금 스크롤, 테마 토글, 폰트, 반응형)
4. **검증이 성공적으로 끝나면 GitHub 배포를 자동으로 진행한다.**

### 배포 절차 (성공 검증 시 자동 실행)

```powershell
git add -A
git commit -m "Update portfolio site"
git push origin main
```

- push 후 GitHub Actions가 자동 빌드/배포한다.
- 배포 URL: https://portfolio.ud-ss.me
- 소스 리포지토리: https://github.com/UD-ss/UD-s-Portfolio
- **주의**: 사용자가 "반영하지 마라"고 명시하면 commit/push를 절대 실행하지 않고 로컬 상태만 유지한다.

---

## 2. 프로젝트 소개

정적 원페이지 포트폴리오 사이트. 빌드 도구 없이 CDN 기반 순수 HTML/CSS/JS로 구성되어 있다.

- **파일 구성**
  - `index.html` — 전체 마크업 (Tailwind CDN 클래스 + 인라인 tailwind.config)
  - `style.css` — 커스텀 스타일, 테마 CSS 변수, 커스텀 애니메이션
  - `script.js` — GSAP + Lenis + 섹션 잠금(one-page) 컨트롤러
  - `LICENSE`, `CNAME` (`portfolio.ud-ss.me`)

## 3. 구현 환경 (변경 시 반드시 유지할 핵심)

- **스무스 스크롤**: Lenis 1.1.18 (CDN). 런타임 애니메이션 전용.
- **섹션 자동 고정(원페이지 잠금)**: `script.js`의 `#14 ONE-PAGE SECTION LOCKING CONTROLLER`.
  - 휠 리스너는 **캡처 단계(`capture: true`)** + `e.lenisStopPropagation`으로 Lenis의 중복 처리와 충돌하지 않게 한다.
  - 휠 한 번 = 섹션 한 칸 이동 (`goToStep`).
  - 섹션 좌표는 `computeSnapTargets()`로 한 번 계산 후 resize/ScrollTrigger refresh 시 재계산.
- **테마(라이트/다크)**: `style.css`의 CSS 변수(`--bg` 등)가 실질적인 색상을 결정. `index.html`의 tailwind.config와 `script.js`의 nav 배경 하드코딩 색도 함께 맞춰야 한다.
  - 라이트: 베이지(`#ece7dd`), 다크: 다크 그레이(`#1c1e20`)
- **폰트**: 히어로 이름(`#hero-name`)은 `SeoulNotice`(Heavy 900) 웹폰트 사용. 변함 없는 규칙.
- **우측 섹션 네비게이션**: 호버 시 다이나믹 아일랜드 방식으로 라벨이 옆으로 늘어난다. `.section-dot` / `.dot-label-wrap` / `.dot-dot` 구조.
- **커스텀 커서/노이즈 오버레이/프리로더**: `style.css` 적용, `script.js` 초기화.
- 텍스트 전체는 `user-select: none` (드래그 선택 불가).

## 4. 컨벤션

- 주석은 작성하지 않는다. (현재 모든 소스에서 주석 제거됨)
- HTML/CSS/JS 모두 한글 UI 텍스트 포함 가능.
- Tailwind 유틸리티 클래스 + 커스텀 CSS 혼용 구조 유지.