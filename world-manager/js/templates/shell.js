/**
 * 화면 뼈대 — 모듈 보드만 (file://에서도 fetch 없이 동작)
 */
(function (BF) {
  "use strict";

  BF.SHELL_HTML = `
  <a class="skip-link" href="#main">본문으로 건너뛰기</a>

  <div class="app">
    <header class="top">
      <div class="top-left">
        <p class="logo">World Manager</p>
        <p class="logo-sub" id="appVersion" aria-label="앱 버전">v—</p>
      </div>
      <div class="top-right">
        <label class="field-inline">
          <span class="sr-only">모듈·설정 이름 찾기</span>
          <input id="searchInput" type="search" placeholder="모듈·설정 이름 찾기" autocomplete="off" />
        </label>
        <button type="button" id="btnWorlds" class="btn btn-weak btn-icon" tabindex="0" aria-label="세계관 목록" data-tip="세계관 목록"></button>
        <button type="button" id="btnTheme" class="btn btn-weak btn-icon" tabindex="0" aria-pressed="false" aria-label="어두운 화면으로 바꾸기" data-tip="어두운 화면"></button>
        <button type="button" id="btnMap" class="btn btn-weak btn-icon" tabindex="0" aria-pressed="false" aria-label="세계관 지도" data-tip="지도"></button>
        <button type="button" id="btnTrash" class="btn btn-weak btn-icon" tabindex="0" aria-pressed="false" aria-label="휴지통" data-tip="휴지통"></button>
        <details class="top-menu">
          <summary class="btn btn-weak btn-icon" tabindex="0" aria-label="기타 메뉴" aria-expanded="false" data-tip="기타 메뉴">
            <span class="top-menu-label-closed" aria-hidden="true"></span>
            <span class="top-menu-label-open" aria-hidden="true"></span>
          </summary>
          <div class="top-menu-panel">
            <button type="button" id="btnImportJson" class="btn btn-weak" tabindex="0" aria-label="백업 파일 불러오기">백업 불러오기</button>
            <input id="importFile" type="file" accept="application/json,.json" hidden />
            <button type="button" id="btnExportJson" class="btn btn-weak" tabindex="0">백업 저장</button>
            <details class="top-keys">
              <summary class="btn btn-weak" tabindex="0">API 키</summary>
              <div class="top-keys-fields form">
                <p id="writeQuota" class="field-hint">키 상태를 불러오는 중…</p>
                <label class="field"><span>어느 길로</span>
                  <select id="writeProvider">
                    <option value="openrouter">OpenRouter</option>
                    <option value="bytez">Bytez</option>
                  </select>
                </label>
                <label class="field"><span>OpenRouter 키</span>
                  <input id="writeOrKey" type="password" autocomplete="off" /></label>
                <label class="field"><span>Bytez 키</span>
                  <input id="writeBzKey" type="password" autocomplete="off" /></label>
                <p class="field-hint">적어 둔 칸만 바뀝니다. Bytez는 키만으로는 부족하고, 사이트 카탈로그에 chat 모델을 넣어야 합니다.</p>
                <button type="button" id="writeKeys" class="btn btn-weak" tabindex="0">키 저장</button>
              </div>
            </details>
          </div>
        </details>
      </div>
    </header>

    <div class="body board-body">
      <aside class="module-rail" id="moduleRail" aria-label="모듈 목록">
        <div class="module-rail-head">
          <h2>모듈</h2>
          <div class="module-rail-tools">
            <button type="button" id="btnAddModule" class="btn btn-primary btn-sm" tabindex="0">모듈 추가</button>
            <button type="button" id="btnToggleRail" class="btn btn-outline btn-sm btn-rail-toggle" tabindex="0" aria-expanded="true" aria-controls="moduleList" aria-label="모듈 목록 접기" title="모듈 목록 접기">‹</button>
          </div>
        </div>
        <div id="moduleList" class="module-list" role="list"></div>
        <div class="module-rail-scroll" id="moduleRailScroll" aria-hidden="true"><i></i></div>
      </aside>

      <main id="main" class="board-main">
        <div id="boardGallery">
        <div class="board-toolbar" data-mode="gallery">
          <div>
            <h1 id="boardTitle">모듈</h1>
            <p id="boardHint" class="board-hint"></p>
          </div>
          <div class="board-toolbar-actions">
            <button type="button" id="btnBoardBack" class="btn btn-outline" tabindex="0" hidden>← 뒤로</button>
            <button type="button" id="btnCorrect" class="btn btn-outline" tabindex="0" disabled>보정</button>
            <button type="button" id="btnEditModule" class="btn btn-outline" tabindex="0">고치기</button>
            <button type="button" id="btnDeleteModule" class="btn btn-outline-danger" tabindex="0">지우기</button>
            <button type="button" id="btnBoardAddGroup" class="btn btn-outline" tabindex="0">그룹 추가</button>
            <button type="button" id="btnBoardNewItem" class="btn btn-primary" tabindex="0">모듈 추가</button>
            <button type="button" id="btnTrashEmpty" class="btn btn-outline-danger" tabindex="0" hidden>휴지통 비우기</button>
          </div>
        </div>
        <div id="boardRoot" class="board-root" aria-live="polite"></div>
        </div>
      </main>
    </div>

    <footer class="status" role="status" aria-live="polite" aria-atomic="true">
      <span id="statusText">준비됐습니다</span>
      <span id="statsText"></span>
    </footer>
  </div>

  <dialog id="wmPeek" class="wm-dialog" aria-labelledby="wmPeekTitle">
    <div class="wm-dialog-panel">
      <header class="wm-dialog-head">
        <h2 id="wmPeekTitle">설정</h2>
        <button type="button" id="wmPeekClose" class="btn btn-outline btn-sm" tabindex="0" aria-label="닫기">닫기</button>
      </header>
      <div id="wmPeekBody" class="wm-dialog-body"></div>
      <footer class="wm-dialog-foot">
        <button type="button" id="wmPeekOpen" class="btn btn-primary" tabindex="0">이 모듈 열기</button>
      </footer>
    </div>
  </dialog>

  <dialog id="wmCorrect" class="wm-dialog" aria-labelledby="wmCorrectTitle">
    <div class="wm-dialog-panel">
      <header class="wm-dialog-head">
        <h2 id="wmCorrectTitle">보정</h2>
        <button type="button" id="wmCorrectClose" class="btn btn-outline btn-sm" tabindex="0" aria-label="닫기">닫기</button>
      </header>
      <div class="wm-dialog-body">
        <p id="wmCorrectHint" class="field-hint">승인한 뒤에만 원래 칸에 넣습니다.</p>
        <label class="field"><span>지금 글</span>
          <pre id="wmCorrectFrom" class="wm-correct-from"></pre></label>
        <label class="field"><span>고친 글</span>
          <textarea id="wmCorrectTo" class="page-card-area" rows="8" aria-label="고친 글"></textarea></label>
        <p id="wmCorrectSuggest" class="field-hint" hidden></p>
      </div>
      <footer class="wm-dialog-foot">
        <button type="button" id="wmCorrectCancel" class="btn btn-outline" tabindex="0">취소</button>
        <button type="button" id="wmCorrectApply" class="btn btn-primary" tabindex="0">적용</button>
      </footer>
    </div>
  </dialog>

  <dialog id="wmDialog" class="wm-dialog" aria-labelledby="wmDialogTitle">
    <div class="wm-dialog-panel">
      <header class="wm-dialog-head">
        <h2 id="wmDialogTitle">고치기</h2>
        <button type="button" id="wmDialogClose" class="btn btn-outline btn-sm" tabindex="0" aria-label="닫기">닫기</button>
      </header>
      <div id="wmDialogBody" class="wm-dialog-body"></div>
      <footer class="wm-dialog-foot">
        <button type="button" id="wmDialogOk" class="btn btn-primary" tabindex="0">확인</button>
      </footer>
    </div>
  </dialog>
  `;

  BF.mountShell = function mountShell() {
    const root = document.getElementById("app-root");
    if (!root) throw new Error("app-root가 없습니다.");
    root.innerHTML = BF.SHELL_HTML;

    const verEl = BF.$("appVersion");
    const meta = document.querySelector('meta[name="wm-asset-v"]');
    const stamp = ((meta && meta.getAttribute("content")) || "").trim();
    if (verEl) {
      var title = (BF.state.meta && BF.state.meta.title) || BF.state.worldSlug || "";
      if (title) {
        verEl.textContent = title;
        verEl.setAttribute("aria-label", "세계관 이름");
      } else if (stamp) {
        const n = parseInt(stamp.slice(0, 8), 16);
        verEl.textContent = "Ver." + (Number.isFinite(n) ? n : stamp);
      }
    }
    bootTopMenu();
    fillHeaderIcons();
  };

  /** 헤더 아이콘 채우기 (셸 HTML이 다시 꽂힐 때마다) */
  function fillHeaderIcons() {
    var I = BF.ICON || {};
    var worlds = BF.$("btnWorlds");
    var map = BF.$("btnMap");
    var trash = BF.$("btnTrash");
    if (worlds && I.earth) worlds.innerHTML = I.earth;
    if (map && I.map) map.innerHTML = I.map;
    if (trash && I.trash) trash.innerHTML = I.trash;
    var closed = document.querySelector(".top-menu-label-closed");
    var open = document.querySelector(".top-menu-label-open");
    if (closed && I.menu) closed.innerHTML = I.menu;
    if (open && I.x) open.innerHTML = I.x;
  }

  /** 메뉴 바깥을 누르거나 Esc·항목을 누르면 접기 (다시 그려도 문서 리스너는 한 번만) */
  function bootTopMenu() {
    if (document.documentElement.dataset.wmMenuDoc !== "1") {
      document.documentElement.dataset.wmMenuDoc = "1";
      document.addEventListener("click", function (e) {
        var menu = document.querySelector(".top-menu");
        if (menu && menu.open && !menu.contains(e.target)) menu.open = false;
      });
      document.addEventListener("keydown", function (e) {
        if (e.key !== "Escape") return;
        var menu = document.querySelector(".top-menu");
        if (menu && menu.open) menu.open = false;
      });
    }
    var menu = document.querySelector(".top-menu");
    if (!menu || menu.dataset.bound === "1") return;
    menu.dataset.bound = "1";
    function syncMenuLabel() {
      var sum = menu.querySelector("summary");
      if (!sum) return;
      sum.setAttribute("aria-expanded", menu.open ? "true" : "false");
      sum.setAttribute("aria-label", menu.open ? "메뉴 닫기" : "기타 메뉴");
      sum.setAttribute("data-tip", menu.open ? "메뉴 닫기" : "기타 메뉴");
    }
    menu.addEventListener("toggle", syncMenuLabel);
    menu.addEventListener("click", function (e) {
      if (e.target.closest(".top-keys")) return;
      if (e.target.closest(".top-menu-panel button")) menu.open = false;
    });
    syncMenuLabel();
  }
})(window.WorldManager = window.WorldManager || {});
