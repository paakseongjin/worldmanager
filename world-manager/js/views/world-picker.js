/**
 * 접속 화면 — 세계관 목록 · 제목으로 새 폴더 만들기
 */
(function (BF) {
  "use strict";

  BF.PICKER_HTML = `
  <a class="skip-link" href="#main">본문으로 건너뛰기</a>
  <div class="app">
    <header class="top">
      <div class="top-left">
        <p class="logo">World Manager</p>
        <p class="logo-sub" id="appVersion">세계관을 고르거나 만드세요</p>
      </div>
      <div class="top-right">
        <button type="button" id="btnPickerDelete" class="btn btn-outline-danger" tabindex="0" aria-pressed="false" aria-label="세계관 삭제">삭제</button>
        <button type="button" id="btnPickerDeleteCancel" class="btn btn-weak" tabindex="0" hidden>취소</button>
        <button type="button" id="btnPickerTrash" class="btn btn-weak btn-icon" tabindex="0" aria-pressed="false" aria-label="세계관 휴지통" data-tip="휴지통"></button>
        <button type="button" id="btnTheme" class="btn btn-weak btn-icon" tabindex="0" aria-pressed="false" aria-label="어두운 화면으로 바꾸기" data-tip="어두운 화면"></button>
      </div>
    </header>
    <div class="body board-body is-picker">
      <main id="main" class="board-main">
        <div id="boardGallery" class="picker-stage">
          <section class="picker-block picker-create" aria-labelledby="pickerTitle">
            <header class="picker-hero">
              <div class="picker-hero-row">
                <h1 id="pickerTitle">세계관</h1>
                <div class="picker-help">
                  <button type="button" id="btnPickerHelp" class="picker-help-btn" tabindex="0" aria-expanded="false" aria-controls="pickerGuide" aria-label="이 화면 안내">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>
                  </button>
                  <aside id="pickerGuide" class="picker-guide" aria-labelledby="pickerGuideTitle" aria-hidden="true">
                    <header class="picker-guide-head">
                      <h2 id="pickerGuideTitle" class="picker-guide-title">이 화면 안내</h2>
                    </header>
                    <p id="pickerHint" class="picker-guide-live">카드를 누르면 열려요. 지울 땐 위 «삭제»로 고른 뒤 휴지통에 넣으면 됩니다.</p>
                    <dl class="picker-guide-list">
                      <div class="picker-guide-item">
                        <dt>만들기</dt>
                        <dd>제목을 넣고 만들기를 누르면 이 컴퓨터에 폴더가 생기고, 큰 분류가 미리 채워집니다.</dd>
                      </div>
                      <div class="picker-guide-item">
                        <dt>열기</dt>
                        <dd>아래 카드를 누르면 그 세계관으로 들어갑니다.</dd>
                      </div>
                      <div class="picker-guide-item">
                        <dt>넘기기</dt>
                        <dd>카드가 많으면 ‹ › 또는 옆으로 밀어 넘기세요.</dd>
                      </div>
                      <div class="picker-guide-item">
                        <dt>삭제</dt>
                        <dd>위 삭제로 고른 뒤 휴지통으로 보냅니다. 당장 완전히 지워지진 않아요.</dd>
                      </div>
                      <div class="picker-guide-item">
                        <dt>휴지통</dt>
                        <dd>되돌릴 수 있고, 완전 삭제는 확인 창에 DELETE를 입력해야 합니다. 휴지통에 넣은 건 목록·검색에 안 나옵니다.</dd>
                      </div>
                    </dl>
                  </aside>
                </div>
              </div>
            </header>
            <form id="worldCreateForm" class="picker-form" action="#">
              <div class="field">
                <label class="field-label-text" for="worldTitleInput">세계관 제목</label>
                <div class="picker-form-row">
                  <input id="worldTitleInput" type="text" maxlength="80" placeholder="제목을 입력해주세요" autocomplete="off" required tabindex="0" aria-label="세계관 제목" />
                  <button type="submit" id="btnCreateWorld" class="btn btn-primary" tabindex="0">만들기</button>
                </div>
              </div>
            </form>
          </section>
          <section class="picker-block picker-list" aria-label="세계관 목록">
            <div class="picker-slider">
              <button type="button" id="btnPickerPrev" class="btn btn-weak picker-nav" tabindex="0" aria-label="이전 세계관" hidden>‹</button>
              <div id="worldList" class="picker-gallery" role="list"></div>
              <button type="button" id="btnPickerNext" class="btn btn-weak picker-nav" tabindex="0" aria-label="다음 세계관" hidden>›</button>
            </div>
          </section>
        </div>
      </main>
    </div>
    <footer class="status" role="status" aria-live="polite" aria-atomic="true">
      <span id="statusText">세계관 목록</span>
      <span id="statsText"></span>
    </footer>
  </div>

  <dialog id="pickerDialog" class="wm-dialog" aria-labelledby="pickerDialogTitle">
    <div class="wm-dialog-panel">
      <header class="wm-dialog-head">
        <h2 id="pickerDialogTitle">확인</h2>
        <button type="button" id="pickerDialogClose" class="btn btn-outline btn-sm" tabindex="0" aria-label="닫기">닫기</button>
      </header>
      <div id="pickerDialogBody" class="wm-dialog-body"></div>
      <div id="pickerDialogConfirmWrap" class="wm-dialog-body" hidden>
        <label class="field" for="pickerDialogConfirm">
          <span class="field-label-text">확인 입력</span>
          <input id="pickerDialogConfirm" type="text" autocomplete="off" spellcheck="false" placeholder="DELETE" aria-label="DELETE 입력" />
        </label>
      </div>
      <footer class="wm-dialog-foot">
        <button type="button" id="pickerDialogCancel" class="btn btn-outline" tabindex="0">취소</button>
        <button type="button" id="pickerDialogOk" class="btn btn-primary" tabindex="0">확인</button>
      </footer>
    </div>
  </dialog>
  `;

  /** 새 세계관에 깔 큰 분류 16개 (테스트 카드 없음) */
  BF.blankWorldBible = function blankWorldBible(title) {
    title = String(title || "").trim();
    var hints = BF.MAJOR_HINTS || {};
    var ko = BF.MAJOR_KO || {};
    var nodes = Object.keys(hints)
      .sort()
      .map(function (id) {
        var hint = hints[id];
        return {
          id: id,
          parentId: null,
          level: "major",
          name: id,
          nameKo: ko[id] || id,
          description: hint,
          canonStatus: "confirmed",
          aliases: [],
          relationships: [],
          blocks: [],
          fields: {},
          synopsis: hint,
        };
      });
    return {
      meta: {
        project: "World Manager",
        title: title,
        version: 1,
        bibleRev: 2,
        coreLine: "",
        updatedAt: new Date().toISOString(),
      },
      levels: [
        { id: "major", label: "대분류", depth: 0 },
        { id: "middle", label: "중분류", depth: 1 },
        { id: "minor", label: "소분류", depth: 2 },
        { id: "detail", label: "세부분류", depth: 3 },
      ],
      canonStatuses: (BF.DEFAULT_CANON_STATUSES || []).slice(),
      nodes: nodes,
      taxonomies: {
        attributes: [],
        relations: (BF.DEFAULT_RELATION_TYPES || []).slice(),
      },
      maps: { modules: [], groups: [], relations: [], mermaid: "" },
    };
  };

  BF.listWorlds = async function listWorlds(opts) {
    var trashed = opts && opts.trashed;
    var res = await fetch("/worlds" + (trashed ? "?trash=1" : ""));
    if (!res.ok) throw new Error("세계관 목록을 불러오지 못했습니다. 열어보기.bat으로 여세요.");
    var data = await res.json();
    return Array.isArray(data.worlds) ? data.worlds : [];
  };

  BF.createWorld = async function createWorld(title) {
    title = String(title || "").trim();
    if (!title) throw new Error("제목을 적어 주세요.");
    var res = await fetch("/worlds", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title, bible: BF.blankWorldBible(title) }),
    });
    if (!res.ok) throw new Error("세계관 폴더를 만들지 못했습니다.");
    return res.json();
  };

  BF.trashWorld = async function trashWorld(slug) {
    slug = String(slug || "").trim();
    if (!slug) throw new Error("세계관이 없습니다.");
    var res = await fetch("/worlds/" + encodeURIComponent(slug) + "/trash", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    if (!res.ok) throw new Error("휴지통으로 보내지 못했습니다.");
    return res.json();
  };

  BF.restoreWorld = async function restoreWorld(slug) {
    slug = String(slug || "").trim();
    if (!slug) throw new Error("세계관이 없습니다.");
    var res = await fetch("/worlds/" + encodeURIComponent(slug) + "/restore", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    if (!res.ok) throw new Error("되돌리지 못했습니다.");
    return res.json();
  };

  BF.purgeWorld = async function purgeWorld(slug) {
    slug = String(slug || "").trim();
    if (!slug) throw new Error("세계관이 없습니다.");
    var res = await fetch("/worlds/" + encodeURIComponent(slug), { method: "DELETE" });
    if (!res.ok) throw new Error("완전히 지우지 못했습니다.");
    return res.json();
  };

  function selectedSlugs() {
    return Object.keys(BF.state.pickerSelected || {});
  }

  function selectedTitles() {
    var map = BF.state.pickerSelected || {};
    return selectedSlugs().map(function (s) {
      return map[s] || s;
    });
  }

  function setSelectMode(on) {
    BF.state.pickerSelectMode = !!on;
    if (!on) BF.state.pickerSelected = {};
    var body = document.querySelector(".board-body.is-picker");
    if (body) body.classList.toggle("is-selecting", !!on);
    syncDeleteChrome();
  }

  function syncDeleteChrome() {
    var del = BF.$("btnPickerDelete");
    var cancel = BF.$("btnPickerDeleteCancel");
    var selecting = !!BF.state.pickerSelectMode;
    var n = selectedSlugs().length;
    var inTrash = !!BF.state.pickerTrashOpen;
    if (cancel) cancel.hidden = !selecting;
    if (!del) return;
    del.setAttribute("aria-pressed", selecting ? "true" : "false");
    if (!selecting) {
      del.textContent = "삭제";
      del.disabled = false;
      del.className = "btn btn-outline-danger";
      return;
    }
    del.textContent = inTrash
      ? n
        ? "완전 삭제 (" + n + ")"
        : "완전 삭제"
      : n
        ? "휴지통으로 (" + n + ")"
        : "휴지통으로";
    del.disabled = n === 0;
    del.className = "btn btn-primary";
  }

  function closePickerDialog() {
    var dlg = BF.$("pickerDialog");
    if (dlg && typeof dlg.close === "function") dlg.close();
    BF._pickerDialogOk = null;
  }

  function openPickerDialog(opts) {
    opts = opts || {};
    var dlg = BF.$("pickerDialog");
    var title = BF.$("pickerDialogTitle");
    var body = BF.$("pickerDialogBody");
    var ok = BF.$("pickerDialogOk");
    if (!dlg || !body) return Promise.reject(new Error("확인 창이 없습니다."));
    if (title) title.textContent = opts.title || "확인";
    body.innerHTML = opts.bodyHtml || "";
    if (ok) {
      ok.textContent = opts.okLabel || "확인";
      ok.className = opts.danger ? "btn btn-outline-danger" : "btn btn-primary";
    }
    BF._pickerDialogOk = null;
    if (typeof dlg.showModal === "function" && !dlg.open) dlg.showModal();
    var need = !!opts.requireDelete;
    var wrap = BF.$("pickerDialogConfirmWrap");
    var inp = BF.$("pickerDialogConfirm");
    if (wrap) wrap.hidden = !need;
    if (inp) {
      inp.value = "";
      if (need) {
        try {
          inp.focus();
        } catch (e) {
          /* ignore */
        }
      }
    }
    if (ok) ok.disabled = need;
    return new Promise(function (resolve) {
      BF._pickerDialogOk = function (accepted) {
        if (accepted && need) {
          var typed = ((BF.$("pickerDialogConfirm") && BF.$("pickerDialogConfirm").value) || "").trim();
          if (typed !== "DELETE") {
            BF.setStatus("완전 삭제하려면 DELETE 를 입력하세요.");
            return;
          }
        }
        closePickerDialog();
        resolve(!!accepted);
      };
    });
  }

  function ensurePickerDialogBound() {
    if (BF._pickerDialogBound) return;
    BF._pickerDialogBound = true;
    function accept(v) {
      if (typeof BF._pickerDialogOk === "function") BF._pickerDialogOk(v);
      else closePickerDialog();
    }
    ["pickerDialogClose", "pickerDialogCancel"].forEach(function (id) {
      var el = BF.$(id);
      if (el) el.addEventListener("click", function () {
        accept(false);
      });
    });
    var ok = BF.$("pickerDialogOk");
    if (ok) {
      ok.addEventListener("click", function () {
        accept(true);
      });
    }
    var inp = BF.$("pickerDialogConfirm");
    if (inp) {
      inp.addEventListener("input", function () {
        if (ok) ok.disabled = inp.value.trim() !== "DELETE";
      });
      inp.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
          e.preventDefault();
          if (ok && !ok.disabled) accept(true);
        }
      });
    }
    var dlg = BF.$("pickerDialog");
    if (dlg) {
      dlg.addEventListener("cancel", function (e) {
        e.preventDefault();
        accept(false);
      });
    }
  }

  function cardHtml(w, i, inTrash) {
    var tints = BF.BOARD_TINTS || ["gray"];
    var tint = tints[i % tints.length];
    var majors = w.majors != null ? w.majors : "";
    var selecting = !!BF.state.pickerSelectMode;
    var checked = !!(BF.state.pickerSelected && BF.state.pickerSelected[w.slug]);
    var sub = inTrash
      ? selecting
        ? "선택해서 완전 삭제할 수 있습니다"
        : "휴지통 · 되돌리거나 선택 후 완전 삭제"
      : majors === ""
        ? "열어서 관리"
        : "큰 분류 " + majors + "개 · 열어서 관리";
    var actions = "";
    if (selecting) {
      actions =
        '<span class="picker-check' +
        (checked ? " is-on" : "") +
        '" aria-hidden="true"></span>';
    } else if (inTrash) {
      actions =
        '<button type="button" class="btn btn-outline btn-xs" data-action="restore" tabindex="0" aria-label="되돌리기">되돌리기</button>';
    } else {
      actions = '<span class="picker-card-go" aria-hidden="true">열기</span>';
    }
    var previewInner = '<p class="nt-card-preview-text">' + BF.escapeHtml(w.title) + "</p>";
    return (
      '<article class="nt-card picker-card' +
      (checked ? " is-checked" : "") +
      '" data-slug="' +
      BF.escapeHtml(w.slug) +
      '" data-title="' +
      BF.escapeHtml(w.title) +
      '" role="listitem" tabindex="0" aria-selected="' +
      (checked ? "true" : "false") +
      '" aria-label="' +
      BF.escapeHtml(w.title) +
      (selecting ? " 선택" : inTrash ? " 휴지통" : " 열기") +
      '">' +
      '<div class="nt-card-preview nt-tint-' +
      tint +
      '" aria-hidden="true">' +
      previewInner +
      "</div>" +
      '<div class="nt-card-meta"><div class="nt-card-meta-text">' +
      '<p class="nt-card-title">' +
      BF.escapeHtml(w.title) +
      "</p>" +
      '<p class="nt-card-sub">' +
      BF.escapeHtml(sub) +
      "</p></div>" +
      '<div class="picker-card-actions">' +
      actions +
      "</div></div></article>"
    );
  }

  function syncPickerNav() {
    var list = BF.$("worldList");
    var prev = BF.$("btnPickerPrev");
    var next = BF.$("btnPickerNext");
    if (!list || !prev || !next) return;
    var overflow = list.scrollWidth > list.clientWidth + 4;
    prev.hidden = !overflow;
    next.hidden = !overflow;
    if (!overflow) return;
    prev.disabled = list.scrollLeft <= 2;
    next.disabled = list.scrollLeft + list.clientWidth >= list.scrollWidth - 2;
  }

  function refreshPickerList() {
    var trashed = !!BF.state.pickerTrashOpen;
    return BF.listWorlds({ trashed: trashed })
      .then(function (worlds) {
        BF.renderWorldPicker(worlds, { trashed: trashed });
      })
      .catch(function (err) {
        BF.setStatus(err && err.message ? err.message : String(err));
      });
  }

  function confirmTrashSelected() {
    var slugs = selectedSlugs();
    if (!slugs.length) return;
    var titles = selectedTitles();
    var list = titles
      .map(function (t) {
        return "<li>" + BF.escapeHtml(t) + "</li>";
      })
      .join("");
    openPickerDialog({
      title: "휴지통으로 보내기",
      okLabel: "휴지통으로",
      danger: true,
      bodyHtml:
        "<p>선택한 세계관 " +
        slugs.length +
        "개를 휴지통으로 보낼까요? 폴더도 함께 옮겨집니다.</p><ul class=\"picker-dialog-list\">" +
        list +
        "</ul>",
    }).then(function (ok) {
      if (!ok) return;
      var chain = Promise.resolve();
      slugs.forEach(function (slug) {
        chain = chain.then(function () {
          return BF.trashWorld(slug);
        });
      });
      return chain
        .then(function () {
          setSelectMode(false);
          return refreshPickerList();
        })
        .then(function () {
          BF.setStatus("선택한 세계관을 휴지통으로 보냈습니다.");
        })
        .catch(function (err) {
          BF.setStatus(err && err.message ? err.message : String(err));
        });
    });
  }

  function confirmPurgeSelected() {
    var slugs = selectedSlugs();
    if (!slugs.length) return;
    var titles = selectedTitles();
    var list = titles
      .map(function (t) {
        return "<li>" + BF.escapeHtml(t) + "</li>";
      })
      .join("");
    openPickerDialog({
      title: "완전 삭제",
      okLabel: "완전히 지우기",
      danger: true,
      requireDelete: true,
      bodyHtml:
        "<p>선택한 세계관 " +
        slugs.length +
        "개를 되돌릴 수 없이 지웁니다.</p><ul class=\"picker-dialog-list\">" +
        list +
        "</ul>" +
        "<p class=\"board-hint\">아래에 DELETE 를 입력해야 확인 버튼이 켜집니다.</p>",
    }).then(function (ok) {
      if (!ok) return;
      var chain = Promise.resolve();
      slugs.forEach(function (slug) {
        chain = chain.then(function () {
          return BF.purgeWorld(slug);
        });
      });
      return chain
        .then(function () {
          setSelectMode(false);
          return refreshPickerList();
        })
        .then(function () {
          BF.setStatus("선택한 세계관을 완전히 지웠습니다.");
        })
        .catch(function (err) {
          BF.setStatus(err && err.message ? err.message : String(err));
        });
    });
  }

  function bindPicker() {
    var form = BF.$("worldCreateForm");
    var input = BF.$("worldTitleInput");
    var list = BF.$("worldList");
    BF.state.pickerTrashOpen = false;
    BF.state.pickerSelectMode = false;
    BF.state.pickerSelected = {};
    ensurePickerDialogBound();
    if (BF.$("btnTheme")) {
      BF.$("btnTheme").addEventListener("click", function () {
        if (BF.toggleTheme) BF.toggleTheme();
      });
      // 피커 HTML을 다시 꽂은 뒤에도 현재 테마 아이콘·aria 맞추기
      if (BF.applyTheme) {
        BF.applyTheme(document.documentElement.getAttribute("data-theme") || BF.preferredTheme());
      }
    }
    var trashIconBtn = BF.$("btnPickerTrash");
    if (trashIconBtn && BF.ICON && BF.ICON.trash && !trashIconBtn.innerHTML) {
      trashIconBtn.innerHTML = BF.ICON.trash;
    }
    var helpWrap = document.querySelector(".picker-help");
    var helpBtn = BF.$("btnPickerHelp");
    var guide = BF.$("pickerGuide");
    if (helpWrap && helpBtn && guide && helpWrap.dataset.bound !== "1") {
      helpWrap.dataset.bound = "1";
      function setHelpOpen(on) {
        guide.setAttribute("aria-hidden", on ? "false" : "true");
        helpBtn.setAttribute("aria-expanded", on ? "true" : "false");
        helpWrap.classList.toggle("is-open", !!on);
      }
      helpWrap.addEventListener("mouseenter", function () {
        setHelpOpen(true);
      });
      helpWrap.addEventListener("mouseleave", function () {
        setHelpOpen(false);
      });
      helpWrap.addEventListener("focusin", function () {
        setHelpOpen(true);
      });
      helpWrap.addEventListener("focusout", function (e) {
        if (!helpWrap.contains(e.relatedTarget)) setHelpOpen(false);
      });
    }
    if (BF.$("btnPickerTrash")) {
      BF.$("btnPickerTrash").addEventListener("click", function () {
        setSelectMode(false);
        BF.state.pickerTrashOpen = !BF.state.pickerTrashOpen;
        refreshPickerList();
      });
    }
    if (BF.$("btnPickerDeleteCancel")) {
      BF.$("btnPickerDeleteCancel").addEventListener("click", function () {
        setSelectMode(false);
        refreshPickerList();
      });
    }
    if (BF.$("btnPickerDelete")) {
      BF.$("btnPickerDelete").addEventListener("click", function () {
        if (!BF.state.pickerSelectMode) {
          setSelectMode(true);
          refreshPickerList();
          BF.setStatus(
            BF.state.pickerTrashOpen
              ? "지울 세계관을 고른 뒤 «완전 삭제»를 누르세요."
              : "지울 세계관을 고른 뒤 «휴지통으로»를 누르세요."
          );
          return;
        }
        if (BF.state.pickerTrashOpen) confirmPurgeSelected();
        else confirmTrashSelected();
      });
    }
    if (BF.$("btnPickerPrev")) {
      BF.$("btnPickerPrev").addEventListener("click", function () {
        if (!list) return;
        list.scrollBy({ left: -Math.max(240, list.clientWidth * 0.8), behavior: "smooth" });
      });
    }
    if (BF.$("btnPickerNext")) {
      BF.$("btnPickerNext").addEventListener("click", function () {
        if (!list) return;
        list.scrollBy({ left: Math.max(240, list.clientWidth * 0.8), behavior: "smooth" });
      });
    }
    if (list) {
      list.addEventListener("scroll", syncPickerNav, { passive: true });
      window.addEventListener("resize", syncPickerNav);
    }
    if (form) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        if (BF.state.pickerTrashOpen || BF.state.pickerSelectMode) return;
        var title = (input && input.value) || "";
        BF.createWorld(title)
          .then(function (out) {
            return BF.enterWorld(out.slug);
          })
          .catch(function (err) {
            BF.setStatus(err && err.message ? err.message : String(err));
          });
      });
    }
    if (list) {
      list.addEventListener("click", function (e) {
        var btn = e.target.closest("[data-action]");
        var card = e.target.closest(".nt-card");
        if (!card || !list.contains(card)) return;
        var slug = card.getAttribute("data-slug");
        if (!slug) return;
        if (btn && btn.getAttribute("data-action") === "restore") {
          e.preventDefault();
          e.stopPropagation();
          BF.restoreWorld(slug)
            .then(refreshPickerList)
            .then(function () {
              BF.setStatus("세계관을 되돌렸습니다.");
            })
            .catch(function (err) {
              BF.setStatus(err && err.message ? err.message : String(err));
            });
          return;
        }
        if (BF.state.pickerSelectMode) {
          e.preventDefault();
          if (!BF.state.pickerSelected) BF.state.pickerSelected = {};
          if (BF.state.pickerSelected[slug]) delete BF.state.pickerSelected[slug];
          else BF.state.pickerSelected[slug] = card.getAttribute("data-title") || slug;
          var on = !!BF.state.pickerSelected[slug];
          card.classList.toggle("is-checked", on);
          card.setAttribute("aria-selected", on ? "true" : "false");
          var mark = card.querySelector(".picker-check");
          if (mark) mark.classList.toggle("is-on", on);
          syncDeleteChrome();
          return;
        }
        if (BF.state.pickerTrashOpen) return;
        BF.enterWorld(slug);
      });
      list.addEventListener("keydown", function (e) {
        if (e.key !== "Enter" && e.key !== " ") return;
        if (e.target.closest("[data-action]")) return;
        var card = e.target.closest(".nt-card");
        if (!card) return;
        e.preventDefault();
        card.click();
      });
    }
    if (input) input.focus();
    syncDeleteChrome();
  }

  BF.renderWorldPicker = function renderWorldPicker(worlds, opts) {
    var list = BF.$("worldList");
    var hint = BF.$("pickerHint");
    var stats = BF.$("statsText");
    var title = BF.$("pickerTitle");
    var form = BF.$("worldCreateForm");
    var createBlock = document.querySelector(".picker-create");
    var trashBtn = BF.$("btnPickerTrash");
    var inTrash = !!(opts && opts.trashed);
    BF.state.pickerTrashOpen = inTrash;
    worlds = worlds || [];
    if (title) title.textContent = inTrash ? "휴지통" : "세계관";
    if (form) form.hidden = inTrash || !!BF.state.pickerSelectMode;
    // 제목·안내 아이콘은 휴지통에서도 보이게, 만들기 폼만 숨김
    if (createBlock) createBlock.classList.toggle("is-form-hidden", inTrash || !!BF.state.pickerSelectMode);
    var listBlock = document.querySelector(".picker-list");
    if (listBlock) {
      listBlock.classList.toggle("is-solo", inTrash);
      listBlock.setAttribute("aria-label", inTrash ? "휴지통 세계관" : "세계관 목록");
    }
    if (trashBtn) {
      trashBtn.setAttribute("aria-pressed", inTrash ? "true" : "false");
      trashBtn.setAttribute("aria-label", inTrash ? "세계관 목록으로" : "세계관 휴지통");
      trashBtn.setAttribute("data-tip", inTrash ? "목록으로" : "휴지통");
      // 휴지통 안이면 지구(목록), 밖이면 휴지통 아이콘
      if (BF.ICON) trashBtn.innerHTML = inTrash ? BF.ICON.earth || BF.ICON.trash : BF.ICON.trash;
      trashBtn.hidden = !!BF.state.pickerSelectMode;
    }
    if (hint) {
      hint.textContent = BF.state.pickerSelectMode
        ? inTrash
          ? "지울 카드를 고른 뒤 «완전 삭제»를 누르세요. 확인 창에 DELETE를 넣어야 지워져요."
          : "지울 카드를 고른 뒤 «휴지통으로»를 누르세요."
        : inTrash
          ? "휴지통에 넣은 세계관은 목록·검색에 안 나와요. 되돌리거나, 삭제로 골라 완전히 지울 수 있습니다."
          : worlds.length
            ? "카드를 누르면 열려요. 지울 땐 위 «삭제»로 고른 뒤 휴지통에 넣으면 됩니다."
            : "아직 세계관이 없어요. 위에서 이름을 짓고 만들기를 눌러 보세요.";
    }
    if (list) {
      list.innerHTML = worlds.length
        ? worlds
            .map(function (w, i) {
              return cardHtml(w, i, inTrash);
            })
            .join("")
        : '<p class="nt-empty">' + (inTrash ? "휴지통이 비어 있습니다." : "여기가 비어 있어요. 첫 세계관을 만들어 보세요.") + "</p>";
      list.scrollLeft = 0;
    }
    if (stats) stats.textContent = (inTrash ? "휴지통 " : "세계관 ") + worlds.length + "개";
    BF.setStatus(inTrash ? "세계관 휴지통" : worlds.length ? "세계관 목록" : "첫 세계관을 만들어 보세요.");
    syncDeleteChrome();
    requestAnimationFrame(syncPickerNav);
  };

  BF.showWorldPicker = async function showWorldPicker() {
    BF.state.worldSlug = "";
    BF.state.mapOpen = false;
    BF.state.trashOpen = false;
    BF.state.pickerTrashOpen = false;
    BF.state.pickerSelectMode = false;
    BF.state.pickerSelected = {};
    BF.state.pageId = null;
    BF.state.nodes = [];
    BF.state.query = "";
    var root = document.getElementById("app-root");
    if (!root) throw new Error("app-root가 없습니다.");
    BF._pickerDialogBound = false;
    root.innerHTML = BF.PICKER_HTML;
    bindPicker();
    if (BF.updateStats) BF.updateStats();
    var worlds = [];
    try {
      worlds = await BF.listWorlds();
    } catch (err) {
      BF.setStatus(err && err.message ? err.message : String(err));
      var hint = BF.$("pickerHint");
      if (hint) hint.textContent = "로컬 서버(열어보기.bat)로 열어야 세계관 폴더를 만들 수 있어요.";
      return;
    }
    BF.renderWorldPicker(worlds);
  };

  BF.syncWorldChrome = function syncWorldChrome() {
    var el = BF.$("appVersion");
    if (!el) return;
    var title = (BF.state.meta && BF.state.meta.title) || BF.state.worldSlug || "";
    if (title) {
      el.textContent = title;
      el.setAttribute("aria-label", "세계관 이름");
    }
  };

  BF.enterWorld = async function enterWorld(slug) {
    slug = String(slug || "").trim();
    if (!slug) return;
    BF.setStatus("세계관을 여는 중…");
    var data = await BF.loadWorldData(slug);
    var seeded = false;
    // 폴더 본문이 정말 비었을 때만 뼈대 시드. majors만 남은 얇은 본문은 시드로 덮지 않음.
    if (!Array.isArray(data.nodes) || !data.nodes.length) {
      var title = (data.meta && data.meta.title) || slug;
      var blank = BF.blankWorldBible(title);
      blank.meta = Object.assign({}, blank.meta, data.meta || {}, {
        title: title,
        worldSlug: slug,
        updatedAt: new Date().toISOString(),
      });
      data = blank;
      seeded = true;
    }
    // 새로고침 전 보던 카드·갈래 (폴더 JSON에는 없음)
    var viewUi = BF.readViewState ? BF.readViewState(slug) : null;
    BF.state.worldSlug = slug;
    if (BF.writeStore && BF.ACTIVE_WORLD_KEY) BF.writeStore(BF.ACTIVE_WORLD_KEY, slug);
    if (BF.openWorldApp) {
      await BF.openWorldApp(
        data,
        seeded
          ? "「" + ((data.meta && data.meta.title) || slug) + "」· 기본 모듈을 다시 넣었습니다."
          : "「" + ((data.meta && data.meta.title) || slug) + "」을 열었습니다."
      );
    }
    if (viewUi && BF.restoreViewState) {
      BF.restoreViewState(viewUi);
      if (BF.refreshAll) BF.refreshAll();
      else if (BF.renderBoard) BF.renderBoard();
    }
    // 시드로 채운 직후 바로 폴더에 밀어 넣으면, 잠깐 비었던 본문이 영구 삭제될 수 있음
    // → 시드가 아닐 때만 자동 저장. 시드는 사용자가 편집한 뒤 저장되게 둔다.
    if (!seeded && BF.persist) BF.persist();
  };

  BF.leaveWorld = function leaveWorld() {
    if (BF.state.worldSlug && BF.persist) BF.persist();
    BF.state.worldSlug = "";
    // 목록으로 나간 뒤에는 새로고침해도 목록이 나오게
    if (BF.writeStore && BF.ACTIVE_WORLD_KEY) BF.writeStore(BF.ACTIVE_WORLD_KEY, "");
    BF.showWorldPicker();
  };

  BF.__worldsCheck = function worldsCheck() {
    var bible = BF.blankWorldBible("검사");
    var ids = (bible.nodes || []).map(function (n) {
      return n.id;
    });
    var ok =
      bible.meta.title === "검사" &&
      ids.indexOf("00_CANON") !== -1 &&
      ids.indexOf("15_RELATIONSHIPS") !== -1 &&
      ids.every(function (id) {
        return id.indexOf("00_test_") !== 0 && id.indexOf("wm_demo_") !== 0;
      });
    return { ok: ok, reason: ok ? "" : "기본 큰 분류 뼈대가 어긋남" };
  };
})(window.WorldManager = window.WorldManager || {});
