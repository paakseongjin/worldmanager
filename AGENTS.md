# World Manager — Prime Agent 안내

이 폴더는 **로컬에서만** 쓰는 세계관 설계 도구입니다.
웹사이트 배포·외부 위키 연동은 하지 않습니다.

## 이 프로젝트에서 할 일

- 화면·동작: `world-manager/` (HTML, CSS, JS)
- 세계관 데이터: `data/worlds/<이름>/world-bible.json` (모듈별 md는 같은 폴더의 `markdown/`)
- 로컬 서버: `world-manager/열어보기.bat` → http://127.0.0.1:8777/world-manager/
- 동작 점검: `python scripts/smoke-world-manager.py`
- CSS 묶음: `python scripts/bundle-world-manager-css.py`

## 코드맵 (화면 로드 순)

```
index.html
  seed-data → constants → theme
  store → store-maps → store-query
  templates/shell
  views: module-rail → board → board-identity → module-page → world-map → write → world-picker
  actions: nodes → backup
  main
```

전역 이름은 `window.WorldManager` (스크립트 안에서는 `BF` 별칭).
스타일은 `styles/*.css` → `styles.css` 합본.
세계관 저장 시 JSON과 함께 `data/worlds/<이름>/markdown/` 에 모듈별 `.md` 기록이 자동으로 맞춰진다.
(앱 화면에서 마크다운을 직접 치는 방식이 아니다.)

## 지키면 되는 규칙

- 이미 있는 코드를 재사용하고, 새 폴더·새 라이브러리는 꼭 필요할 때만.
- 에이전트 스킬은 `.agents/skills/` 의 `wm_최적화` · `ponytail` 계열 · `humanize-korean` 만 둔다.
- 한글 윤문(`/humanize-korean`)은 이 폴더에 설치됨. 스킬: `.claude/skills/humanize-korean`(Cursor는 `.cursor/skills/`에도 동일 복사). 점수·게이트 스크립트: `scripts/prepare_monolith_input.py`, `scripts/verify_gates.py`. 원본 저장소 클론은 `tools/im-not-ai/`(git 제외).
- 커밋·푸시는 사용자가 요청할 때만.
- 지도 테스트 데이터(`wm_demo_` 등)는 남기지 않는다. 제품 데이터만 둔다.
- 답변은 한국어, 쉬운 말로. 작업이 끝나면 3줄 이내로 요약.
