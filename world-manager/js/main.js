/**
 * World Manager 진입점
 * 흐름: 세계관을 고르거나 만든 뒤, 그룹으로 모듈을 묶고 카드를 누르면 블럭·관계를 적는다
 */
(function (BF) {
  "use strict";

  function bindEvents() {
    const on = (id, event, handler) => {
      const el = BF.$(id);
      if (!el) {
        console.warn("버튼 없음:", id);
        return;
      }
      el.addEventListener(event, handler);
    };

    on("btnWorlds", "click", () => BF.leaveWorld && BF.leaveWorld());
    on("btnTheme", "click", () => BF.toggleTheme());
    on("btnToggleRail", "click", () => BF.toggleRail && BF.toggleRail());

    on("btnAddModule", "click", () => BF.boardAddModule());
    on("btnEditModule", "click", () => BF.boardEditModule());
    on("btnDeleteModule", "click", () => BF.boardDeleteModule());
    on("btnBoardBack", "click", () => BF.boardBack && BF.boardBack());
    on("btnMap", "click", () => BF.openMap && BF.openMap());
    on("btnTrash", "click", () => BF.openTrash && BF.openTrash());
    on("btnTrashEmpty", "click", () => {
      if (BF.purgeTrash && BF.purgeTrash()) {
        BF.renderBoard();
        BF.setStatus("휴지통을 비웠습니다.");
      }
    });
    on("btnBoardAddGroup", "click", () => BF.boardAddGroup());
    on("btnBoardNewItem", "click", () => {
      const moduleId = BF.activeModuleId && BF.activeModuleId();
      if (!moduleId) {
        alert("먼저 모듈을 추가하세요.");
        return;
      }
      const groups = BF.childrenOf(moduleId).filter((n) => n.level === "middle");
      if (!groups.length) {
        BF.boardAddGroup();
        const again = BF.childrenOf(moduleId).filter((n) => n.level === "middle");
        if (again[0]) BF.boardAddRow(again[0].id);
        return;
      }
      BF.boardAddRow(groups[0].id);
    });

    if (BF.bootIdentityDialog) BF.bootIdentityDialog();
    if (BF.bootMapPeek) BF.bootMapPeek();

    on("searchInput", "input", () => {
      BF.state.query = BF.$("searchInput")?.value || "";
      if (BF.renderBoard) BF.renderBoard();
    });

    on("btnExportJson", "click", () => BF.exportJson());
    on("btnImportJson", "click", () => BF.$("importFile")?.click());
    on("importFile", "change", async (e) => {
      await BF.importJson(e.target.files?.[0]);
      e.target.value = "";
      if (BF.renderBoard) BF.renderBoard();
    });
  }

  /** 고른 세계관 폴더로 보드를 연다 */
  BF.openWorldApp = async function openWorldApp(data, status, viewUi) {
    BF.mountShell();
    BF.bootTheme();
    // 본문을 먼저 넣는다 — 이 전에 persist가 돌면 빈 nodes로 덮어씀
    BF._openingWorld = true;
    BF.applyData(data);
    BF._openingWorld = false;
    if (viewUi && BF.restoreViewState) BF.restoreViewState(viewUi);
    if (BF.bootRail) BF.bootRail();
    bindEvents();
    if (BF.bootWriteTools) BF.bootWriteTools();
    if (BF.refreshAll) BF.refreshAll();
    else if (BF.renderBoard) BF.renderBoard();
    if (BF.startFolderWatch) BF.startFolderWatch();
    BF.setStatus(status || "세계관을 열었습니다.");
  };

  async function boot() {
    if (BF.mountShell) BF.mountShell();
    if (BF.bootTheme) BF.bootTheme();
    // 마지막에 열어 둔 세계관이 있으면 바로 진입
    var last = BF.readStore && BF.ACTIVE_WORLD_KEY ? BF.readStore(BF.ACTIVE_WORLD_KEY) : "";
    if (last && BF.enterWorld) {
      try {
        await BF.enterWorld(last);
        return;
      } catch (e) {
        if (BF.writeStore && BF.ACTIVE_WORLD_KEY) BF.writeStore(BF.ACTIVE_WORLD_KEY, "");
      }
    }
    if (BF.showWorldPicker) await BF.showWorldPicker();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})(window.WorldManager = window.WorldManager || {});
