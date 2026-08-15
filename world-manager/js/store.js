/**
 * 세계관 데이터 보관소
 * — 화면 상태, 노트 찾기, 브라우저에 저장/불러오기
 */
(function (BF) {
  "use strict";

  /** 앱 전역 상태 (한 곳에서만 바꿈) */
  BF.state = {
    meta: {},
    canonStatuses: [],
    nodes: [],
    selectedId: null,
    draftParentId: null,
    /** 새로 만드는 종류: major | middle | null(일반 설정) */
    creatingLevel: null,
    /** 고치는 중인 관계 번호 (없으면 null) */
    editingRelIndex: null,
    /** 관계 폼: idle | compose | edit */
    relFormMode: "idle",
    step: 1,
    expanded: new Set(),
    query: "",
    /** 보드에 연 모듈(큰 갈래) id */
    boardModuleId: null,
    /** 그룹 접힘 상태 { [groupId]: true|false } — 다시 그려도 유지 */
    groupFold: {},
    /** 휴지통 화면을 보고 있는지 */
    trashOpen: false,
    /** 세계관 지도 화면을 보고 있는지 */
    mapOpen: false,
    /** 접속 화면에서 세계관 휴지통을 보고 있는지 */
    pickerTrashOpen: false,
    /** 지금 연 모듈(카드) id — 있으면 블럭 작성 화면 */
    pageId: null,
    /** 모듈 페이지에서 고치는 카드 { type: "block"|"rel", id } */
    editingCard: null,
    /** 대분류 보드에서 신뢰도 필터 (null|"all"|영문 키) */
    canonFilter: "all",
    /** 한번 쓴 속성·관계 분류 (다시 고르기) */
    taxonomies: { attributes: [], relations: [] },
    /** 모듈 지도·관계 지도 (저장할 때마다 다시 맞춤) */
    maps: { modules: [], groups: [], relations: [], mermaid: "" },
    /** 지금 연 세계관 폴더 이름 */
    worldSlug: "",
  };

  /** id로 DOM 요소 찾기 */
  BF.$ = function $(id) {
    return document.getElementById(id);
  };

  BF.uid = function uid(prefix) {
    prefix = prefix || "note";
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  };

  BF.findNode = function findNode(id) {
    return BF.state.nodes.find((n) => n.id === id) || null;
  };

  /** 휴지통에 있는지 */
  BF.isDeleted = function isDeleted(n) {
    return !!(n && n.deletedAt);
  };

  /**
   * 바로 아래 자식. 기본은 살아있는 것만.
   * opts.all 이면 휴지통도 포함 (되돌리기·완전삭제용)
   */
  BF.childrenOf = function childrenOf(id, opts) {
    const all = opts && opts.all;
    return BF.state.nodes
      .filter((n) => n.parentId === id && (all || !n.deletedAt))
      .sort((a, b) => BF.displayName(a).localeCompare(BF.displayName(b), "ko"));
  };

  /** id 아래 모든 손자 (휴지통 포함) */
  BF.descendantsOf = function descendantsOf(id) {
    const out = [];
    const walk = (nid) => {
      BF.childrenOf(nid, { all: true }).forEach((c) => {
        out.push(c);
        walk(c.id);
      });
    };
    walk(id);
    return out;
  };

  /** 휴지통에 있는 설정 */
  BF.trashedNodes = function trashedNodes() {
    return BF.state.nodes.filter((n) => n.deletedAt);
  };

  BF.ancestorsOf = function ancestorsOf(id) {
    const path = [];
    let cur = BF.findNode(id);
    while (cur) {
      path.unshift(cur);
      cur = cur.parentId ? BF.findNode(cur.parentId) : null;
    }
    return path;
  };

  BF.displayName = function displayName(node) {
    if (!node) return "";
    return node.nameKo?.trim() || node.name || node.id;
  };

  /** id/이름 앞의 숫자(00_, 01_) — 없으면 맨 뒤(1e9) */
  BF.moduleSortKey = function moduleSortKey(node) {
    const src = (node && (node.id || node.name)) || "";
    const m = String(src).match(/^(\d+)/);
    return m ? Number(m[1]) : 1e9;
  };

  /** 화면에 보여줄 두 자리 번호. 번호 없으면 — */
  BF.moduleNumberLabel = function moduleNumberLabel(node) {
    const k = BF.moduleSortKey(node);
    return k === 1e9 ? "—" : String(k).padStart(2, "0");
  };

  /** 모듈 목록 정렬: 번호 → 한글 이름 */
  BF.compareByModuleNumber = function compareByModuleNumber(a, b) {
    const d = BF.moduleSortKey(a) - BF.moduleSortKey(b);
    if (d) return d;
    return BF.displayName(a).localeCompare(BF.displayName(b), "ko");
  };

  /** 큰 갈래(모듈)만 번호순으로 */
  BF.majorModules = function majorModules() {
    return BF.state.nodes
      .filter((n) => (n.level === "major" || n.parentId == null) && !n.deletedAt)
      .sort(BF.compareByModuleNumber);
  };

  /** 새 모듈 id = 다음 번호_이름 (예: 16_NEW_MODULE) */
  BF.nextModuleId = function nextModuleId(name) {
    let max = -1;
    BF.majorModules().forEach((n) => {
      const k = BF.moduleSortKey(n);
      if (k < 1e9 && k > max) max = k;
    });
    const slug =
      String(name || "NEW_MODULE")
        .trim()
        .replace(/[^A-Za-z0-9가-힣]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .toUpperCase() || "NEW_MODULE";
    let n = max + 1;
    let id = String(n).padStart(2, "0") + "_" + slug;
    while (BF.findNode(id)) {
      n += 1;
      id = String(n).padStart(2, "0") + "_" + slug;
    }
    return id;
  };

  /** 번호순이 깨지면 바로 실패 — 목록 정렬 가드 */
  BF.__moduleOrderCheck = function moduleOrderCheck() {
    const list = [{ id: "nope" }, { id: "02_X" }, { id: "00_A" }].sort(
      BF.compareByModuleNumber
    );
    const ok = list[0].id === "00_A" && list[1].id === "02_X" && list[2].id === "nope";
    return { ok, reason: ok ? "" : "번호순 정렬 실패" };
  };

  /** "00_CANON" → { num: "00", slug: "CANON" } */
  BF.splitModuleId = function splitModuleId(id) {
    const s = String(id || "").trim();
    const m = s.match(/^(\d+)[_-](.+)$/);
    if (m) return { num: m[1], slug: m[2] };
    const onlyNum = s.match(/^(\d+)$/);
    if (onlyNum) return { num: onlyNum[1], slug: "" };
    return { num: "", slug: s };
  };

  /** 번호+슬러그 → "00_CANON" (저장·폴더용 id) */
  BF.composeModuleId = function composeModuleId(num, slug) {
    const n = String(num || "").replace(/\D/g, "");
    const padded = n ? n.padStart(2, "0") : "";
    const sl =
      String(slug || "")
        .trim()
        .replace(/[^A-Za-z0-9가-힣_-]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .toUpperCase() || "MODULE";
    return padded ? padded + "_" + sl : sl;
  };

  /**
   * 노트 id를 바꾸고 자식·관계·선택 상태를 같이 고침
   * @returns {boolean}
   */
  BF.renameNodeId = function renameNodeId(oldId, newId) {
    if (!oldId || !newId || oldId === newId) return true;
    if (BF.findNode(newId)) {
      alert("같은 모듈 ID가 이미 있습니다: " + newId);
      return false;
    }
    const node = BF.findNode(oldId);
    if (!node) return false;
    node.id = newId;
    BF.state.nodes.forEach((n) => {
      if (n.parentId === oldId) n.parentId = newId;
      (n.relationships || []).forEach((r) => {
        if (r.targetId === oldId) r.targetId = newId;
      });
    });
    if (BF.state.selectedId === oldId) BF.state.selectedId = newId;
    if (BF.state.draftParentId === oldId) BF.state.draftParentId = newId;
    if (BF.state.boardModuleId === oldId) BF.state.boardModuleId = newId;
    if (BF.state.pageId === oldId) BF.state.pageId = newId;
    if (BF.state.expanded && BF.state.expanded.has(oldId)) {
      BF.state.expanded.delete(oldId);
      BF.state.expanded.add(newId);
    }
    return true;
  };

  /** 지금 보고 있는 화면 이름 (하단 왼쪽 기본값) */
  BF.placeLabel = function placeLabel() {
    if (!BF.state.worldSlug) return "세계관 목록";
    if (BF.state.mapOpen) return "세계관 지도";
    if (BF.state.trashOpen) return "휴지통";
    if (BF.state.pageId) {
      var page = BF.findNode(BF.state.pageId);
      if (page) return BF.displayName(page);
    }
    if (BF.state.boardModuleId) {
      var mod = BF.findNode(BF.state.boardModuleId);
      if (mod) return BF.displayName(mod);
    }
    return "보드";
  };

  /** 알림이 있으면 잠깐 보여 주고, 없으면 지금 위치로 되돌림 */
  BF.setStatus = function setStatus(msg) {
    const el = BF.$("statusText");
    const notice = msg && String(msg).trim();
    if (!notice) {
      if (BF._statusHoldUntil && Date.now() < BF._statusHoldUntil) {
        BF.updateStats();
        return;
      }
      BF._statusHoldUntil = 0;
      if (el) {
        el.textContent = BF.placeLabel();
        el.classList.remove("is-fresh");
      }
      BF.updateStats();
      return;
    }
    if (el) {
      el.textContent = notice;
      el.classList.remove("is-fresh");
      void el.offsetWidth;
      el.classList.add("is-fresh");
    }
    BF._statusHoldUntil = Date.now() + 2500;
    if (BF._statusTimer) clearTimeout(BF._statusTimer);
    BF._statusTimer = setTimeout(function () {
      BF._statusHoldUntil = 0;
      BF.setStatus();
    }, 2500);
    BF.updateStats();
  };

  /** 살아 있는 데이터의 큰 카테고리 개수 (하단 표시용) */
  BF.statCounts = function statCounts() {
    const trash = BF.trashedNodes().length;
    const live = BF.state.nodes.filter(function (n) {
      return !BF.isDeleted(n);
    });
    var majors = 0;
    var groups = 0;
    var modules = 0;
    var attrs = 0;
    var rels = 0;
    live.forEach(function (n) {
      if (n.level === "major" || !n.parentId) majors += 1;
      else if (n.level === "middle") groups += 1;
      else modules += 1;
      attrs += (n.blocks || []).length;
      rels += (n.relationships || []).filter(function (r) {
        return r.targetId && !BF.isDeleted(BF.findNode(r.targetId));
      }).length;
    });
    return { majors: majors, groups: groups, modules: modules, attrs: attrs, rels: rels, trash: trash };
  };

  BF.updateStats = function updateStats() {
    const c = BF.statCounts();
    const line =
      "갈래 " +
      c.majors +
      " · 그룹 " +
      c.groups +
      " · 모듈 " +
      c.modules +
      " · 속성 " +
      c.attrs +
      " · 관계 " +
      c.rels +
      " · 휴지통 " +
      c.trash;
    const el = BF.$("statsText");
    if (el) {
      el.textContent = line;
      el.setAttribute("aria-label", line);
    }
    const btn = BF.$("btnTrash");
    if (btn) {
      // 아이콘 버튼 — 글자를 덮어쓰지 않고 안내만 갱신
      btn.setAttribute("aria-label", c.trash ? "휴지통 " + c.trash + "개" : "휴지통");
      btn.setAttribute("data-tip", c.trash ? "휴지통 (" + c.trash + ")" : "휴지통");
    }
  };

  /** file://·사생활 보호 모드에서 localStorage가 막혀도 앱이 멈추지 않게 */
  BF.readStore = function readStore(key) {
    try {
      return localStorage.getItem(key);
    } catch (err) {
      console.warn("저장소 읽기 실패", err);
      return null;
    }
  };

  BF.writeStore = function writeStore(key, value) {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (err) {
      console.warn("저장소 쓰기 실패", err);
      return false;
    }
  };

  /** HTML에 넣을 때 특수문자 이스케이프 (XSS·깨진 마크업 방지) */
  BF.escapeHtml = function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  };

  /** 폴더·백업용 본문 (화면 위치는 빼기) */
  BF.biblePayload = function biblePayload() {
    if (!BF.state.meta) BF.state.meta = {};
    if (BF.state.worldSlug) BF.state.meta.worldSlug = BF.state.worldSlug;
    return {
      meta: BF.state.meta,
      canonStatuses: BF.state.canonStatuses,
      nodes: BF.state.nodes,
      taxonomies: BF.state.taxonomies,
      maps: BF.state.maps,
    };
  };

  BF.persist = function persist() {
    // 세계관 여는 도중에 빈 상태로 폴더를 덮지 않음
    if (BF._openingWorld) return;
    if (!BF.state.meta) BF.state.meta = {};
    BF.state.meta.updatedAt = new Date().toISOString();
    BF.state.nodes.forEach(BF.normalizeNode);
    BF.pruneTaxonomies();
    BF.rebuildMaps();
    const ok = BF.writeStore(
      BF.worldStorageKey ? BF.worldStorageKey() : BF.STORAGE_KEY,
      JSON.stringify({
        meta: BF.state.meta,
        canonStatuses: BF.state.canonStatuses,
        nodes: BF.state.nodes,
        taxonomies: BF.state.taxonomies,
        maps: BF.state.maps,
        selectedId: BF.state.selectedId,
        draftParentId: BF.state.draftParentId,
        boardModuleId: BF.state.boardModuleId,
        pageId: BF.state.pageId,
        step: BF.state.step,
        trashOpen: !!BF.state.trashOpen,
        mapOpen: !!BF.state.mapOpen,
        canonFilter: BF.state.canonFilter || "all",
        expanded: [...BF.state.expanded],
      })
    );
    // 화면 위치만 따로 — 폴더 JSON에는 안 넣음(새로고침 복원용)
    if (BF.state.worldSlug && BF.viewStateKey) {
      BF.writeStore(
        BF.viewStateKey(BF.state.worldSlug),
        JSON.stringify({
          selectedId: BF.state.selectedId,
          draftParentId: BF.state.draftParentId,
          boardModuleId: BF.state.boardModuleId,
          pageId: BF.state.pageId,
          trashOpen: !!BF.state.trashOpen,
          mapOpen: !!BF.state.mapOpen,
          canonFilter: BF.state.canonFilter || "all",
        })
      );
    }
    // 용량 초과·사생활 모드 등: 화면은 바뀌어도 디스크에 안 남을 수 있음
    if (!ok) {
      BF.setStatus("브라우저에 저장하지 못했습니다. JSON 백업을 받아 두세요.");
    }
    BF.updateStats();
    if (BF.worldPushSoon) BF.worldPushSoon();
  };

  /** 새로고침 뒤에도 보던 카드·갈래로 돌아가게 */
  BF.readViewState = function readViewState(slug) {
    slug = String(slug || BF.state.worldSlug || "").trim();
    if (!slug || !BF.viewStateKey) return null;
    try {
      var raw = BF.readStore(BF.viewStateKey(slug));
      if (!raw) {
        // 예전 키에 섞여 있던 UI 상태도 읽어둠
        raw = BF.readStore(BF.STORAGE_KEY + ":" + slug);
      }
      if (!raw) return null;
      var o = JSON.parse(raw);
      if (!o || typeof o !== "object") return null;
      return {
        selectedId: o.selectedId || null,
        draftParentId: o.draftParentId || null,
        boardModuleId: o.boardModuleId || null,
        pageId: o.pageId || null,
        trashOpen: !!o.trashOpen,
        mapOpen: !!o.mapOpen,
        canonFilter: o.canonFilter || "all",
      };
    } catch (e) {
      return null;
    }
  };

  BF.restoreViewState = function restoreViewState(ui) {
    if (!ui) return;
    function alive(id) {
      var n = id && BF.findNode(id);
      return n && !BF.isDeleted(n) ? n : null;
    }
    var board = alive(ui.boardModuleId);
    if (board) {
      if (board.level === "major" || !board.parentId) {
        BF.state.boardModuleId = board.id;
      } else {
        var maj = BF.majorOf(board);
        BF.state.boardModuleId = maj ? maj.id : BF.state.boardModuleId;
      }
    }
    var page = alive(ui.pageId);
    BF.state.pageId = page ? page.id : null;
    var sel = alive(ui.selectedId);
    if (sel) BF.state.selectedId = sel.id;
    if (ui.draftParentId && alive(ui.draftParentId)) {
      BF.state.draftParentId = ui.draftParentId;
    }
    // 지도·휴지통은 동시에 열지 않음
    BF.state.trashOpen = !!ui.trashOpen && !ui.mapOpen;
    BF.state.mapOpen = !!ui.mapOpen && !ui.trashOpen;
    BF.state.canonFilter = ui.canonFilter || "all";
  };

  var worldPushTimer = null;
  // ponytail: 짧은 연속 저장은 폴더에 한 번만 씀
  BF.worldPushSoon = function worldPushSoon() {
    var slug = BF.state.worldSlug;
    if (!slug || location.protocol === "file:") return;
    clearTimeout(worldPushTimer);
    worldPushTimer = setTimeout(function () {
      var aliveNow = (BF.state.nodes || []).filter(function (n) {
        return n && !BF.isDeleted(n);
      }).length;
      var loaded = BF._loadedAliveCount || 0;
      // 방금 폴더에서 읽은 양보다 화면 데이터가 확 줄었으면 덮어쓰지 않음
      if (loaded >= 40 && aliveNow < Math.max(16, Math.floor(loaded / 2))) {
        BF.setStatus(
          "화면 데이터가 폴더보다 많이 비어 있습니다. 새로고침(F5)으로 다시 불러오세요."
        );
        return;
      }
      var headers = { "Content-Type": "application/json" };
      if (BF._folderEtag) headers["If-Match"] = BF._folderEtag;
      var body = JSON.stringify(BF.biblePayload());
      fetch("/worlds/" + encodeURIComponent(slug), {
        method: "PUT",
        headers: headers,
        body: body,
      })
        .then(function (res) {
          var et = res.headers.get("ETag");
          // 폴더가 화면보다 최신 — 폴더 본문을 다시 받음 (백업 폴더는 안 봄)
          if (res.status === 412) {
            return res.json().then(function (data) {
              if (BF.state.worldSlug !== slug) return;
              if (et) BF._folderEtag = et;
              if (BF.applyFolderData) BF.applyFolderData(data, "폴더에 있는 최신 본문으로 맞췄습니다.");
            });
          }
          // 서버가 「내용이 갑자기 너무 줄었다」고 거절한 경우 — 화면 데이터가 낡은 것
          if (res.status === 409) {
            BF.setStatus(
              "폴더에 있는 세계관이 더 많습니다. 새로고침(F5)으로 폴더 본문을 다시 불러오세요."
            );
          } else if (!res.ok) {
            BF.setStatus("폴더에 저장하지 못했습니다. 열어보기.bat 서버가 켜져 있는지 확인하세요.");
          } else {
            if (et) BF._folderEtag = et;
            BF._loadedAliveCount = aliveNow;
          }
        })
        .catch(function () {
          BF.setStatus("폴더에 저장하지 못했습니다. 열어보기.bat 서버가 켜져 있는지 확인하세요.");
        });
    }, 400);
  };

  BF.applyData = function applyData(data) {
    BF.state.meta = data.meta || {};
    BF.state.canonStatuses = data.canonStatuses?.length
      ? data.canonStatuses
      : [...BF.DEFAULT_CANON_STATUSES];
    // 예전 바이블에 보류(deferred)가 없으면 목록에 끼워 넣음
    if (BF.state.canonStatuses.indexOf("deferred") === -1) {
      var pi = BF.state.canonStatuses.indexOf("provisional");
      BF.state.canonStatuses.splice(pi >= 0 ? pi + 1 : 1, 0, "deferred");
    }
    BF.state.nodes = Array.isArray(data.nodes) ? data.nodes : [];
    BF.state.taxonomies = data.taxonomies || { attributes: [], relations: [] };
    if (!Array.isArray(BF.state.taxonomies.attributes)) BF.state.taxonomies.attributes = [];
    if (!Array.isArray(BF.state.taxonomies.relations)) BF.state.taxonomies.relations = [];
    // 관계 5종이 없으면 앞에 끼워 넣음 (기존 값은 유지)
    (BF.DEFAULT_RELATION_TYPES || []).forEach(function (t) {
      if (BF.state.taxonomies.relations.indexOf(t) === -1) {
        BF.state.taxonomies.relations.unshift(t);
      }
    });
    if (typeof BF.state.meta.coreLine !== "string") BF.state.meta.coreLine = "";
    // 예전 품질점검 필드는 쓰지 않음
    if (BF.state.meta.qualityChecklist) delete BF.state.meta.qualityChecklist;
    BF.pruneTaxonomies();
    BF.state.maps = data.maps || { modules: [], groups: [], relations: [], mermaid: "" };
    BF.state.nodes.forEach(BF.normalizeNode);
    // 폴더에서 읽은 살아 있는 카드 수 — 이후 저장이 갑자기 줄어들면 막음
    BF._loadedAliveCount = BF.state.nodes.filter(function (n) {
      return n && !BF.isDeleted(n);
    }).length;
    BF.state.selectedId = data.selectedId || BF.state.nodes.find((n) => n.level === "major")?.id || null;
    BF.state.draftParentId =
      data.draftParentId ||
      BF.findNode(BF.state.selectedId)?.parentId ||
      null;
    BF.state.boardModuleId =
      data.boardModuleId ||
      BF.findNode(BF.state.draftParentId)?.parentId ||
      BF.state.nodes.find((n) => n.level === "major")?.id ||
      null;
    if (BF.isDeleted(BF.findNode(BF.state.selectedId))) {
      BF.state.selectedId = (BF.majorModules()[0] && BF.majorModules()[0].id) || null;
    }
    if (BF.isDeleted(BF.findNode(BF.state.boardModuleId))) {
      BF.state.boardModuleId = (BF.majorModules()[0] && BF.majorModules()[0].id) || null;
    }
    var boardNode = BF.findNode(BF.state.boardModuleId);
    BF.state.pageId = data.pageId || null;
    // boardModuleId가 카드 id로 잘못 저장된 경우만 큰 갈래로 끌어올림 (pageId는 data에 있으면 유지)
    if (boardNode && boardNode.level !== "major" && boardNode.parentId) {
      if (!BF.state.pageId && boardNode.level !== "middle") BF.state.pageId = boardNode.id;
      var maj = BF.majorOf(boardNode);
      if (maj) BF.state.boardModuleId = maj.id;
    }
    if (BF.isDeleted(BF.findNode(BF.state.pageId))) BF.state.pageId = null;
    // 평소에는 전부 접힌 상태 (화살표로만 펼침)
    BF.state.expanded = new Set();
    if (!BF._skipFolderPush) BF.persist();
  };

  /** 시드: 내장 스크립트(file://) → fetch(http) 순 */
  BF.loadSeed = async function loadSeed() {
    if (window.WORLD_SEED && Array.isArray(window.WORLD_SEED.nodes)) {
      return window.WORLD_SEED;
    }
    const res = await fetch(BF.SEED_URL);
    if (!res.ok) throw new Error("기본 세계관 파일을 불러오지 못했습니다");
    return res.json();
  };

  /** 폴더에 있는 세계관 본문. 서버가 우선, 브라우저 저장은 보조. backups/ 는 안 읽음 */
  BF.loadWorldData = async function loadWorldData(slug) {
    slug = String(slug || "").trim();
    if (!slug) throw new Error("세계관을 고르세요.");
    var res = await fetch("/worlds/" + encodeURIComponent(slug), {
      cache: "no-store",
    });
    if (!res.ok) throw new Error("세계관 파일을 열지 못했습니다.");
    var et = res.headers.get("ETag");
    if (et) BF._folderEtag = et;
    return res.json();
  };

  BF.applyFolderData = function applyFolderData(data, status) {
    if (!data || !Array.isArray(data.nodes)) return;
    var ui = BF.readViewState ? BF.readViewState(BF.state.worldSlug) : null;
    BF._openingWorld = true;
    BF._skipFolderPush = true;
    BF.applyData(data);
    BF._skipFolderPush = false;
    BF._openingWorld = false;
    if (ui && BF.restoreViewState) BF.restoreViewState(ui);
    if (BF.refreshAll) BF.refreshAll();
    else if (BF.renderBoard) BF.renderBoard();
    if (status) BF.setStatus(status);
  };

  function folderPullBlocked() {
    var a = document.activeElement;
    if (a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA" || a.isContentEditable)) {
      return true;
    }
    if (BF.state.editingCard) return true;
    if (BF.state.relFormMode && BF.state.relFormMode !== "idle") return true;
    return false;
  }

  BF.pullFolderIfChanged = async function pullFolderIfChanged() {
    var slug = BF.state.worldSlug;
    if (!slug || location.protocol === "file:") return;
    if (BF._openingWorld || BF._pullingFolder || folderPullBlocked()) return;
    BF._pullingFolder = true;
    try {
      var headers = {};
      if (BF._folderEtag) headers["If-None-Match"] = BF._folderEtag;
      var res = await fetch("/worlds/" + encodeURIComponent(slug), {
        headers: headers,
        cache: "no-store",
      });
      if (res.status === 304) return;
      if (!res.ok) return;
      var et = res.headers.get("ETag");
      if (et) BF._folderEtag = et;
      var data = await res.json();
      BF.applyFolderData(data);
    } catch (e) {
      /* 폴링 실패는 화면을 막지 않음 */
    } finally {
      BF._pullingFolder = false;
    }
  };

  // ponytail: 2초 폴링. 탭이 많아지면 SSE로 바꾸면 됨
  BF.startFolderWatch = function startFolderWatch() {
    BF.stopFolderWatch();
    if (location.protocol === "file:") return;
    BF._folderWatch = setInterval(function () {
      if (BF.pullFolderIfChanged) BF.pullFolderIfChanged();
    }, 2000);
    if (!BF._folderWatchFocus) {
      BF._folderWatchFocus = function () {
        if (document.visibilityState === "visible" && BF.pullFolderIfChanged) {
          BF.pullFolderIfChanged();
        }
      };
      document.addEventListener("visibilitychange", BF._folderWatchFocus);
    }
  };

  BF.stopFolderWatch = function stopFolderWatch() {
    if (BF._folderWatch) {
      clearInterval(BF._folderWatch);
      BF._folderWatch = null;
    }
  };

})(window.WorldManager = window.WorldManager || {});
