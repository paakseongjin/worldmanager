/**
 * 화면·저장에 쓰는 고정 값만 모음
 * (파이어폭스 file://에서도 동작하도록 일반 스크립트)
 */
(function (BF) {
  "use strict";

  BF.STORAGE_KEY = "worldmanager-bible-v2";
  BF.LEGACY_STORAGE_KEY = "worldmanager-bible-v2";
  BF.ACTIVE_WORLD_KEY = "worldmanager-active-world";
  BF.VIEW_STATE_KEY = "worldmanager-view-state";
  BF.SEED_URL = "../data/world-bible.json";

  /** 지금 연 세계관 폴더 기준으로 브라우저 키 */
  BF.worldStorageKey = function worldStorageKey() {
    return BF.STORAGE_KEY + ":" + (BF.state.worldSlug || "_none");
  };

  /** 세계관별 화면 위치(카드·필터) — 본문 JSON과 따로 둠 */
  BF.viewStateKey = function viewStateKey(slug) {
    return BF.VIEW_STATE_KEY + ":" + (slug || BF.state.worldSlug || "_none");
  };

  /** 단계별 자리 이름 (화면용 한글) */
  BF.LEVELS = {
    major: "큰 갈래",
    middle: "그룹",
    minor: "설정",
    detail: "세부 메모",
  };

  /** 부모 레벨 → 새로 만들 자식 레벨 */
  BF.NEXT_LEVEL = {
    major: "middle",
    middle: "minor",
    minor: "detail",
    detail: "detail",
  };

  /** 신뢰도 화면 이름 — 짧은 한 단어만 (가운뎃줄·부연 설명 금지) */
  BF.CANON_LABELS = {
    confirmed: "확정",
    provisional: "잠정",
    deferred: "보류",
    speculation: "추측",
    unknown: "미정",
    forgotten: "망각",
    false: "와전",
    forbidden: "금기",
    future_reveal: "비밀",
  };

  /** 카드·필터용 — 라벨과 동일하게 짧게 */
  BF.CANON_SHORT = {
    confirmed: "확정",
    provisional: "잠정",
    deferred: "보류",
    speculation: "추측",
    unknown: "미정",
    forgotten: "망각",
    false: "와전",
    forbidden: "금기",
    future_reveal: "비밀",
  };

  /** 보드·모듈 카드 점 색 (번호 나머지에 고정) */
  BF.BOARD_TINTS = ["peach", "rose", "mint", "lavender", "sky", "yellow", "cream", "gray"];

  /** 큰 갈래 한글 이름 — 새 세계관 폴더에 자동으로 깔림 */
  BF.MAJOR_KO = {
    "00_CANON": "절대 기준",
    "01_COSMOLOGY": "우주론",
    "02_MYTHOLOGY": "신화",
    "03_MAGIC": "마법",
    "04_WORLD": "세계",
    "05_RACES": "종족",
    "06_FACTIONS": "세력",
    "07_CHARACTERS": "인물",
    "08_ITEMS": "물건",
    "09_LANGUAGE": "언어",
    "10_HISTORY": "역사",
    "11_RELIGION": "신앙",
    "12_TERMINOLOGY": "용어",
    "13_TIMELINE": "연표",
    "14_STORY": "이야기",
    "15_RELATIONSHIPS": "관계",
  };

  /** 큰 갈래 안내 — 판타지 세계관 작성 힌트 */
  BF.MAJOR_HINTS = {
    "00_CANON": "흔들면 안 되는 확정 규칙과 금기",
    "01_COSMOLOGY": "차원, 사후세계, 세계를 움직이는 힘",
    "02_MYTHOLOGY": "신과 창세, 예언. 누가 믿고 누가 부정하는지도",
    "03_MAGIC": "힘보다 규칙·대가·한계를 먼저",
    "04_WORLD": "지리와 기후가 문화와 무역을 만드는 방식",
    "05_RACES": "종족과 생물. 인간 복사판이 아닌 이유",
    "06_FACTIONS": "왕국·교단·길드. 권력과 갈등의 뿌리",
    "07_CHARACTERS": "인물. 겉모습, 속마음, 이야기 순으로",
    "08_ITEMS": "누가 만들었고, 대가는 무엇인지",
    "09_LANGUAGE": "이름과 말의 규칙. 누가 어떤 말을 쓰는지",
    "10_HISTORY": "과거가 오늘을 흔드는 사건. 두세 세대 깊이",
    "11_RELIGION": "일상 의식과 금기, 신앙이 권력에 미치는 영향",
    "12_TERMINOLOGY": "작위·용어·속어. 한 줄 정의",
    "13_TIMELINE": "언제, 무엇이, 왜. 시간 순 인과",
    "14_STORY": "소설 사건. 세계관 설정과 칸을 나눔",
    "15_RELATIONSHIPS": "설정끼리 왜 이어지는지. 협력, 갈등, 비밀",
  };

  BF.DEFAULT_CANON_STATUSES = [
    "confirmed",
    "provisional",
    "deferred",
    "speculation",
    "unknown",
    "forgotten",
    "false",
    "forbidden",
    "future_reveal",
  ];

  /** 관계 기본 5종 — 지도·선택 목록 우선 */
  BF.DEFAULT_RELATION_TYPES = ["소속", "대립", "원인", "파생", "제약"];

  /** 창작 축(안내) — 큰 갈래를 바꾸지 않고 무엇을 채울지만 알려 줌 */
  BF.CREATIVE_AXES = {
    "00_CANON": { axis: "CORE", label: "전제", order: 0 },
    "01_COSMOLOGY": { axis: "SYSTEM", label: "규칙", order: 1 },
    "02_MYTHOLOGY": { axis: "CULTURE", label: "신념", order: 4 },
    "03_MAGIC": { axis: "SYSTEM", label: "규칙", order: 1 },
    "04_WORLD": { axis: "GEO", label: "지리", order: 2 },
    "05_RACES": { axis: "GEO", label: "생태", order: 2 },
    "06_FACTIONS": { axis: "FACTION", label: "세력", order: 4 },
    "07_CHARACTERS": { axis: "CHARACTER", label: "인물", order: 6 },
    "08_ITEMS": { axis: "SYSTEM", label: "물건", order: 1 },
    "09_LANGUAGE": { axis: "CULTURE", label: "문화", order: 4 },
    "10_HISTORY": { axis: "HISTORY", label: "역사", order: 3 },
    "11_RELIGION": { axis: "CULTURE", label: "신앙", order: 4 },
    "12_TERMINOLOGY": { axis: "CULTURE", label: "용어", order: 4 },
    "13_TIMELINE": { axis: "HISTORY", label: "연표", order: 3 },
    "14_STORY": { axis: "CONFLICT", label: "갈등", order: 5 },
    "15_RELATIONSHIPS": { axis: "CONFLICT", label: "관계", order: 5 },
  };

  /** 빈 카드에 권하는 속성 블럭(기존 분류명만) */
  BF.EMPTY_BLOCK_PRESETS = {
    "01_COSMOLOGY": ["규칙", "한계"],
    "03_MAGIC": ["규칙", "대가", "한계"],
    "04_WORLD": ["지리", "개요"],
    "05_RACES": ["외형", "사회", "배경"],
    "06_FACTIONS": ["개요", "사회", "배경"],
    "07_CHARACTERS": ["외형", "성격", "배경"],
    "08_ITEMS": ["개요", "규칙", "한계"],
    "10_HISTORY": ["사건", "배경"],
    "11_RELIGION": ["신앙", "규칙", "사회"],
    "13_TIMELINE": ["사건", "역사"],
    "14_STORY": ["서사", "사건"],
  };

  /** Lucide 아이콘 (stroke 통일) — https://lucide.dev/icons/ */
  function lucideSvg(inner) {
    return (
      '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      inner +
      "</svg>"
    );
  }
  BF.ICON = {
    earth: lucideSvg(
      '<path d="M21.54 15H17a2 2 0 0 0-2 2v4.54"/><path d="M7 3.34V5a3 3 0 0 0 3 3a2 2 0 0 1 2 2c0 1.1.9 2 2 2a2 2 0 0 0 2-2c0-1.1.9-2 2-2h3.17"/><path d="M11 21.95V18a2 2 0 0 0-2-2 2 2 0 0 1-2-2v-1a2 2 0 0 0-2-2H2.05"/><circle cx="12" cy="12" r="10"/>'
    ),
    map: lucideSvg(
      '<path d="M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z"/><path d="M15 5.764v15"/><path d="M9 3.236v15"/>'
    ),
    trash: lucideSvg(
      '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/>'
    ),
    menu: lucideSvg('<path d="M4 5h16"/><path d="M4 12h16"/><path d="M4 19h16"/>'),
    x: lucideSvg('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>'),
  };
})(window.WorldManager = window.WorldManager || {});
