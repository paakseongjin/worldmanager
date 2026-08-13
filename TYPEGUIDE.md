# TYPEGUIDE — World Manager UI

SSOT: `docs/design/`(디자인 규칙) + `world-manager/styles/tokens.css`.

## 배율

- `--wm-type-scale` (기본 `1.2` = 120%): 모든 서체 크기·글자 인접 컨트롤/카드/레일 높이에 곱함.
- 글자만 되돌리려면 이 값만 `1`로 바꾸면 된다.

## 폰트

- UI: `Toss Product Sans` → `Pretendard` 폴백
- 역할 토큰: `--typo-page-title-size` · `--typo-section-size` · `--typo-body-size` · `--typo-caption-size` 등 (`tokens.css`)
- 기준 px(배율 적용 전): 본문 15 / 캡션 13 / 섹션 17 / 페이지 제목 22 / 로고 18
- 한글·영문·룬 혼용 시 행간 유지, 말줄임은 한 줄 엘리프시스

## 간격·그리드

| 토큰 | 값 |
|------|-----|
| xs~xxl | 4 / 8 / 12 / 16 / 24 / 32 (`--space-*`) |
| 페이지 가로 패딩 | `--page-pad-x` (= space-5) |
| 레일 폭 | `--rail-width` (type-scale 연동) |
| 컨트롤·버튼 높이 | `--control-h` · `--btn-h` (type-scale 연동) |

모든 여백·크기는 **8의 배수**를 우선한다(배율 calc 결과는 소수 허용).

## 컨트롤 높이 (통일, 배율 적용 전 기준)

| 이름 | 높이 | 용도 |
|------|------|------|
| btn-sm | 28px | 보조 버튼 |
| btn | 32px | 기본 버튼 |
| control/row | 36px | 입력·행 |
| header | 56px | 상단바 |

입력·버튼 높이는 `--wm-type-scale`과 같이 커진다.

## 레이아웃 골격

```
┌ header (--header-min-h) ──────────────┐
│ rail (--rail-width) │ main            │
├ status (--status-h) ──────────────────┤
```

- 플랫 레이어만 사용 (그림자 토큰 없음 — tokens.css)
- 상태 색만으로 구분하지 않음 (텍스트·선택 테두리 병행)
