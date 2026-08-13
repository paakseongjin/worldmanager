/**
 * 왼쪽 모듈 목록 — 카드 + 추가·고치기·지우기 + 접기/펼치기
 * 정렬은 store.js 의 번호순(00_, 01_)을 그대로 씀
 */
(function (BF) {
  "use strict";

  /** 브라우저에 접힘 상태만 따로 기억 (세계관 데이터와 무관) */
  BF.RAIL_KEY = "worldmanager-rail-collapsed";

  // 접기(‹)·펼치기(›) 아이콘 — 화면용, 의미는 aria-label로 전달
  var RAIL_ICON = { open: "‹", closed: "›" };
  var RAIL_LABEL = {
    open: "모듈 목록 접기",
    closed: "모듈 목록 펼치기",
  };

  /** 토글 버튼 아이콘·안내 문구만 맞춤 (접힘 상태와 동일하게 유지) */
  function syncRailToggleUi(btn, collapsed) {
    if (!btn) return;
    var on = !!collapsed;
    var label = on ? RAIL_LABEL.closed : RAIL_LABEL.open;
    btn.textContent = on ? RAIL_ICON.closed : RAIL_ICON.open;
    btn.setAttribute("aria-expanded", on ? "false" : "true");
    btn.setAttribute("aria-label", label);
    btn.setAttribute("title", label);
  }

  /** 모듈 레일 접기/펼치기 — board-body 클래스 + 아이콘 버튼 동기화 */
  BF.applyRailCollapsed = function applyRailCollapsed(collapsed) {
    var on = !!collapsed;
    var body = document.querySelector(".board-body");
    var rail = BF.$("moduleRail");
    if (body) body.classList.toggle("is-rail-collapsed", on);
    if (rail) {
      rail.classList.toggle("is-collapsed", on);
      rail.setAttribute("aria-label", on ? "모듈 목록 (접힘)" : "모듈 목록");
    }
    syncRailToggleUi(BF.$("btnToggleRail"), on);
    BF.writeStore(BF.RAIL_KEY, on ? "1" : "0");
    // 접힘/펼침 뒤 위치 선 다시 맞춤
    requestAnimationFrame(syncRailScroll);
  };

  /** 지금 접혀 있으면 펼치고, 펼쳐 있으면 접음 */
  BF.toggleRail = function toggleRail() {
    var body = document.querySelector(".board-body");
    var nowCollapsed = !(body && body.classList.contains("is-rail-collapsed"));
    BF.applyRailCollapsed(nowCollapsed);
  };

  /** 저장된 접힘 상태를 시작 시 복원 */
  BF.bootRail = function bootRail() {
    BF.applyRailCollapsed(BF.readStore(BF.RAIL_KEY) === "1");
    bootRailScroll();
  };

  /** 모듈 목록 스크롤 → 우측 위치 선 갱신 */
  function syncRailScroll() {
    var list = BF.$("moduleList");
    var bar = BF.$("moduleRailScroll");
    if (!list || !bar) return;
    var view = list.clientHeight;
    var full = list.scrollHeight;
    var max = full - view;
    if (max <= 1 || view <= 0) {
      bar.classList.remove("is-on");
      return;
    }
    var thumb = Math.max(12, (view / full) * 100);
    var room = 100 - thumb;
    var top = room <= 0 ? 0 : (list.scrollTop / max) * room;
    bar.style.setProperty("--rail-thumb-h", thumb.toFixed(2) + "%");
    bar.style.setProperty("--rail-thumb-top", top.toFixed(2) + "%");
    bar.classList.add("is-on");
  }

  function bootRailScroll() {
    var list = BF.$("moduleList");
    if (!list || list.dataset.scrollBound === "1") {
      syncRailScroll();
      return;
    }
    list.dataset.scrollBound = "1";
    list.addEventListener("scroll", syncRailScroll, { passive: true });
    if (typeof ResizeObserver !== "undefined") {
      new ResizeObserver(syncRailScroll).observe(list);
    }
    window.addEventListener("resize", syncRailScroll);
    syncRailScroll();
  }

  function tints() {
    return BF.BOARD_TINTS || ["gray"];
  }

  function tintFor(node) {
    const list = tints();
    const k = BF.moduleSortKey(node);
    const i = k === 1e9 ? list.length - 1 : k;
    return list[i % list.length];
  }

  function hintOf(node) {
    var axis = BF.CREATIVE_AXES && BF.CREATIVE_AXES[node.id];
    var base =
      (BF.MAJOR_HINTS && BF.MAJOR_HINTS[node.id]) ||
      node.description ||
      node.synopsis ||
      "";
    if (axis && axis.label) {
      return "[" + axis.label + "] " + base;
    }
    return base;
  }

  function cardHtml(m, active) {
    const n = BF.childrenOf(m.id).length;
    const on = m.id === active ? " is-active" : "";
    const tint = tintFor(m);
    const hint = String(hintOf(m)).slice(0, 72);
    const id = BF.escapeHtml(m.id);
    const name = BF.escapeHtml(BF.displayName(m) || "이름 없음");
    return (
      '<article class="nt-mod-card' +
      on +
      '" data-module="' +
      id +
      '" role="listitem">' +
      '<button type="button" class="nt-mod-main" data-action="select-module" data-module="' +
      id +
      '" tabindex="0" aria-current="' +
      (m.id === active ? "page" : "false") +
      '" aria-label="' +
      name +
      ' 모듈 열기">' +
      '<span class="nt-mod-head">' +
      '<span class="nt-mod-id">' +
      '<span class="nt-mod-num" aria-hidden="true">' +
      BF.escapeHtml(BF.moduleNumberLabel(m)) +
      "</span>" +
      '<span class="nt-dot nt-tint-' +
      tint +
      '" aria-hidden="true"></span>' +
      '<span class="nt-mod-name">' +
      name +
      "</span>" +
      "</span>" +
      '<span class="nt-count" title="하위 항목 수">' +
      n +
      "</span>" +
      "</span>" +
      '<span class="nt-mod-hint">' +
      (hint ? BF.escapeHtml(hint) : "\u00a0") +
      "</span>" +
      "</button>" +
      '<div class="nt-mod-tools">' +
      '<button type="button" class="btn btn-outline-primary btn-xs nt-mod-btn" data-action="edit-module" data-module="' +
      id +
      '" tabindex="0" aria-label="' +
      name +
      ' 고치기">고치기</button>' +
      '<button type="button" class="btn btn-outline-danger btn-xs nt-mod-btn" data-action="delete-module" data-module="' +
      id +
      '" tabindex="0" aria-label="' +
      name +
      ' 지우기">지우기</button>' +
      "</div></article>"
    );
  }

  /** 모듈 목록을 카드로 다시 그림 */
  BF.renderModules = function renderModules() {
    const list = BF.$("moduleList");
    if (!list) return;
    const active = BF.activeModuleId();
    const q = (BF.state.query || "").trim().toLowerCase();
    const rows = BF.majorModules().filter((m) => {
      if (!q) return true;
      return (m.name + " " + (m.nameKo || "") + " " + m.id).toLowerCase().indexOf(q) >= 0;
    });
    list.innerHTML = rows.length
      ? rows.map((m) => cardHtml(m, active)).join("")
      : '<p class="nt-empty nt-mod-empty">모듈이 없습니다. «모듈 추가»로 시작하세요.</p>';
    bindModuleList(list);
    syncRailScroll();
  };

  function bindModuleList(list) {
    if (list.dataset.bound === "1") return;
    list.dataset.bound = "1";
    list.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-action]");
      if (!btn || !list.contains(btn)) return;
      const id = btn.getAttribute("data-module");
      const action = btn.getAttribute("data-action");
      if (action === "select-module") {
        BF.state.trashOpen = false;
        BF.state.mapOpen = false;
        BF.setBoardModule(id);
      }
      else if (action === "edit-module") BF.boardEditModule(id);
      else if (action === "delete-module") BF.boardDeleteModule(id);
    });
  }

  /** 빈 모듈을 만들고 바로 고치기 화면으로 */
  BF.boardAddModule = function boardAddModule() {
    const node = BF.blankNode({
      id: BF.nextModuleId("NEW_MODULE"),
      parentId: null,
      level: "major",
      name: "",
      nameKo: "새 모듈",
      description: "",
      canonStatus: "provisional",
    });
    node.name = node.id;
    BF.state.nodes.push(node);
    BF.state.boardModuleId = node.id;
    BF.state.draftParentId = node.id;
    BF.state.selectedId = node.id;
    BF.persist();
    BF.renderBoard();
    if (BF.openIdentityDialog) BF.openIdentityDialog(node);
    BF.setStatus("모듈을 만들었습니다. 이름과 설명을 적어 주세요.");
  };

  /** 모듈 속성(이름·설명) 고치기 */
  BF.boardEditModule = function boardEditModule(id) {
    const node = BF.findNode(id || BF.state.pageId || BF.activeModuleId());
    if (!node) {
      alert("고칠 모듈을 먼저 고르세요.");
      return;
    }
    if (node.level === "major" || !node.parentId) {
      BF.state.pageId = null;
      BF.state.boardModuleId = node.id;
      BF.state.draftParentId = node.id;
    }
    BF.state.selectedId = node.id;
    BF.state.trashOpen = false;
    BF.state.mapOpen = false;
    BF.persist();
    BF.renderBoard();
    if (BF.openIdentityDialog) BF.openIdentityDialog(node);
  };

  /** 모듈과 아래 페이지를 함께 지움 */
  BF.boardDeleteModule = function boardDeleteModule(id) {
    const node = BF.findNode(id || BF.state.pageId || BF.activeModuleId());
    if (!node) {
      alert("지울 모듈을 먼저 고르세요.");
      return;
    }
    const parentId = node.parentId;
    if (!BF.deleteNodeCascade(node.id)) return;
    if (BF.state.boardModuleId === node.id) {
      if (parentId && BF.findNode(parentId)) BF.state.boardModuleId = parentId;
      else {
        const next = BF.majorModules()[0];
        BF.state.boardModuleId = next ? next.id : null;
      }
    }
    BF.persist();
    if (BF.renderBoard) BF.renderBoard();
    BF.setStatus("지웠습니다.");
  };
})(window.WorldManager = window.WorldManager || {});
