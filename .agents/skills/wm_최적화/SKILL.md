---
name: wm_최적화
description: >
  World Manager 제품 최적화 전 과정 — 죽은 코드·데이터·캐시 청소, 비대 모듈 분리,
  코드맵 갱신, CSS/HTML/JS 안정화, 스모크 점검, 안내 문구 인간화,
  (요청 시에만) GitHub 커밋·푸시. Use when the user says "wm_최적화", "월드매니저 최적화",
  "슈퍼 클리닝", "제품 최적화", or asks to run the optimization N times.
argument-hint: "[N회] [커밋푸시|커밋만|푸시없음]"
---

# wm_최적화 — World Manager 제품 최적화

이 스킬은 **한 사이클**이 아래 1~5를 끝까지 도는 것을 뜻한다.
사용자가 **「N회 반복」** 이라고 하면, 그중 일부만 N번 하는 것이 아니라 **전 과정(1~5)을 N번** 반복한다.
매 라운드마다 새로 발견되는 잔여물·비대 파일·문구를 다시 훑는다. 이미 깨끗한 항목은 한 줄로 확인하고 넘어간다.

필수 MCP/스킬: `sequential-thinking`, `memory`, `filesystem`, `code-review-graph`, `.agents/skills/ponytail`, `.agents/skills/humanize-korean`.

## 기본 방침 (ponytail)

- 삭제 > 추가. 새 폴더·새 라이브러리는 꼭 필요할 때만.
- 활성 로드 경로(`world-manager/index.html` 스크립트 목록)만 제품으로 본다.
- 데이터 유실 금지: `data/worlds/<이름>/` 사용자 세계관은 지우지 않는다. 테스트·데모(`wm_demo_`, `00_test_` 등)만 제거.
- 커밋·푸시는 **사용자가 그 실행에서 명시했을 때만**. 스킬 본문에 “커밋 푸시 완료해”가 있어도, 사용자가 “이번엔 하지 마”면 따르지 않는다.

## 한 사이클 (반드시 이 순서)

### 1) 청소 — 죽은 것·충돌 위험·캐시

1. `index.html`에 없는 JS/CSS, 미사용 옛 폴더·덤프 등 죽은 코드·데이터를 **흔적 없이** 삭제.
2. `__pycache__/`, `*.pyc`, `world-manager/.server-*.pid`, 임시·테스트 산출물, 불필요 캐시를 삭제.
3. 존재 여부는 디스크/`Test-Path`/`os.path`로 확인한다(유령 Grep 인덱스만 믿지 말 것).

### 2) 분리 — 비대 코드 쪼개기 + 연결

1. `code-review-graph`로 큰 파일/함수를 집는다(대략 파일 300줄+, 함수 80줄+ 후보).
2. 기존 IIFE 패턴 유지: `(function (BF) { ... })(window.WorldManager = window.WorldManager || {})`.
3. 쪼갠 파일은 `index.html` 로드 순서에 넣고, `AGENTS.md` 코드맵을 같은 순서로 갱신.
4. 공개 API는 `BF.*`로 이어 붙인다. 사설 헬퍼가 파일 간에 필요하면 `BF._…` 한곳에만 모은다.
5. 분리 후 `python scripts/bundle-world-manager-css.py`로 `?v=` 갱신.

### 3) 현대화 — 안정성 우선

- 옛 패턴(미사용 전역, 깨진 캐시 버스팅, 인라인 충돌 CSS, `file://` 전제 깨짐)을 고친다.
- “트렌드”보다 **동작·데이터 안전·접근성**을 우선한다. 프레임워크 도입·대규모 재작성은 YAGNI.

### 4) 점검 — 스모크·연동

```text
python scripts/smoke-world-manager.py
```

실패하면 같은 사이클 안에서 고치고 다시 돌린다. 통과한 검사만 보고한다.

### 5) 문구 — 사람이 쓴 것처럼

- README, AGENTS, UI 라벨, placeholder, 가이드 문장을 쉬운 한국어로 다듬는다(`humanize-korean` 원칙: 의미 불변, AI 티만 제거).
- 기능 이름은 화면에 보이는 말과 문서가 같게 맞춘다.

### (옵션) Git — 요청했을 때만

사용자가 커밋·푸시를 요청한 실행에서만:

- 관련 파일 stage → 저장소 스타일에 맞는 커밋 메시지 → 요청 시 `git push`
- 시크릿·`.env`·대용량 클론은 커밋하지 않는다.

## N회 반복

| 사용자 말 | 의미 |
|-----------|------|
| `wm_최적화` / `최적화 실시` | **1사이클** |
| `wm_최적화 3회` / `10회 반복` | **전 과정(1~5)을 3회·10회** |
| `커밋 푸시하지 마` | 그 실행의 Git 단계 생략 |
| `커밋만` / `푸시까지` | 그 실행에 한해 해당 git 동작 |

라운드마다 3줄 보고: (1) 지운 것 (2) 나눈 것 (3) 스모크 결과.

## 코드맵 SSOT

작업 후 `AGENTS.md`의 로드 순 코드맵이 실제 `index.html`과 같아야 한다. 어긋나면 문서를 고친다.

## 하지 말 것

- 사용자 세계관 본문(`data/worlds/**`의 실제 설정) 삭제·덮어쓰기
- 요청 없는 프레임워크 도입, 폴더 대이동
- Grep 유령 히트만 보고 있는 파일을 지웠다고 보고하기 (존재 여부는 디스크/`Test-Path`/`os.path`로 확인)
