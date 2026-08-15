/**
 * API 키(기타 메뉴) + 고른 글 보정
 */
(function (BF) {
  "use strict";

  var pending = null;

  function esc(s) {
    return BF.escapeHtml ? BF.escapeHtml(s) : String(s || "");
  }

  function isEditField(el) {
    if (!el || el.disabled || el.readOnly) return false;
    if (el.id === "searchInput" || el.id === "writeOrKey" || el.id === "writeBzKey" || el.id === "wmCorrectTo") return false;
    var tag = el.tagName;
    if (tag === "TEXTAREA") return true;
    if (tag === "INPUT") {
      var t = String(el.type || "text").toLowerCase();
      return t === "text" || t === "search" || t === "" || t === "url";
    }
    return false;
  }

  function readSel() {
    var el = document.activeElement;
    if (!isEditField(el)) return null;
    var a = el.selectionStart;
    var b = el.selectionEnd;
    if (a == null || b == null || a === b) return null;
    var start = Math.min(a, b);
    var end = Math.max(a, b);
    var text = String(el.value || "").slice(start, end);
    if (!String(text).trim()) return null;
    return { el: el, start: start, end: end, text: text };
  }

  function syncCorrectBtn() {
    var btn = BF.$("btnCorrect");
    if (!btn) return;
    var sel = readSel();
    if (sel) pending = sel;
    var live = pending && pending.el && document.contains(pending.el) && String(pending.text || "").trim();
    btn.disabled = !live;
  }

  function spliceText(val, start, end, ins) {
    return String(val || "").slice(0, start) + ins + String(val || "").slice(end);
  }

  function revealDialog(dlg) {
    if (!dlg) return false;
    if (dlg.open) return true;
    try {
      if (typeof dlg.showModal === "function") {
        dlg.showModal();
        return true;
      }
    } catch (e) {}
    dlg.setAttribute("open", "");
    return true;
  }

  function fillCorrectDialog(sel, state, payload) {
    var dlg = BF.$("wmCorrect");
    var fromEl = BF.$("wmCorrectFrom");
    var toEl = BF.$("wmCorrectTo");
    var hintEl = BF.$("wmCorrectHint");
    var noteEl = BF.$("wmCorrectSuggest");
    var apply = BF.$("wmCorrectApply");
    var rewrite = String((payload && (payload.rewrite || payload.text || payload.suggest)) || "").trim();
    var suggest = String((payload && payload.suggest) || "").trim();
    var err = String((payload && payload.error) || "").trim();
    if (fromEl) fromEl.textContent = (sel && sel.text) || "";
    if (state === "wait") {
      if (toEl) {
        toEl.value = "";
        toEl.placeholder = "보정을 받는 중…";
      }
      if (hintEl) hintEl.textContent = "보정을 받는 중입니다. 끝나면 고친 글이 여기에 뜹니다.";
      if (noteEl) {
        noteEl.hidden = true;
        noteEl.textContent = "";
      }
      if (apply) apply.disabled = true;
    } else if (state === "err") {
      if (toEl) toEl.value = "";
      if (hintEl) hintEl.textContent = err || "보정에 실패했습니다.";
      if (noteEl) {
        noteEl.hidden = true;
        noteEl.textContent = "";
      }
      if (apply) apply.disabled = true;
    } else {
      if (toEl) toEl.value = rewrite;
      if (hintEl) hintEl.textContent = "승인한 뒤에만 원래 칸에 넣습니다.";
      if (noteEl) {
        noteEl.hidden = !suggest || suggest === rewrite;
        noteEl.textContent = suggest && suggest !== rewrite ? "제안: " + suggest : "";
      }
      if (apply) apply.disabled = !rewrite;
    }
    revealDialog(dlg);
    return rewrite;
  }

  function fillStatus(box, st) {
    if (!box || !st) return;
    box.textContent =
      "오늘 남은 분량 " +
      (st.remaining || 0) +
      " / " +
      (st.limit || 0) +
      " · OpenRouter " +
      (st.openrouter ? "연결됨" : "키 없음") +
      " · Bytez " +
      (st.bytez ? "연결됨" : "키 없음");
  }

  function bootKeys() {
    var keysBtn = BF.$("writeKeys");
    var quotaEl = BF.$("writeQuota");
    fetch("/api/write")
      .then(function (r) {
        return r.json();
      })
      .then(function (st) {
        fillStatus(quotaEl, st);
      })
      .catch(function () {
        if (quotaEl) quotaEl.textContent = "서버가 글쓰기 API를 아직 안 켜 둔 것 같습니다.";
      });
    if (!keysBtn || keysBtn.dataset.bound === "1") return;
    keysBtn.dataset.bound = "1";
    keysBtn.addEventListener("click", function () {
      var orEl = BF.$("writeOrKey");
      var bzEl = BF.$("writeBzKey");
      var payload = {};
      if (orEl && orEl.value) payload.openrouter = orEl.value;
      if (bzEl && bzEl.value) payload.bytez = bzEl.value;
      if (!payload.openrouter && !payload.bytez) {
        BF.setStatus("바꿀 키를 적어 주세요.");
        return;
      }
      fetch("/api/write/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
        .then(function (r) {
          return r.json();
        })
        .then(function (st) {
          fillStatus(quotaEl, st);
          if (orEl) orEl.value = "";
          if (bzEl) bzEl.value = "";
          BF.setStatus("키를 이 컴퓨터에 저장했습니다.");
        })
        .catch(function () {
          BF.setStatus("키 저장에 실패했습니다.");
        });
    });
  }

  function bootCorrect() {
    var btn = BF.$("btnCorrect");
    var dlg = BF.$("wmCorrect");
    if (document.documentElement.dataset.wmCorrectDoc !== "1") {
      document.documentElement.dataset.wmCorrectDoc = "1";
      document.addEventListener("selectionchange", syncCorrectBtn);
      document.addEventListener("keyup", syncCorrectBtn);
      document.addEventListener("mouseup", syncCorrectBtn);
    }
    if (btn && btn.dataset.bound !== "1") {
      btn.dataset.bound = "1";
      btn.addEventListener("mousedown", function (e) {
        e.preventDefault();
      });
      btn.addEventListener("click", function () {
        runCorrect();
      });
    }
    if (dlg && dlg.dataset.bound !== "1") {
      dlg.dataset.bound = "1";
      var close = BF.$("wmCorrectClose");
      var cancel = BF.$("wmCorrectCancel");
      var apply = BF.$("wmCorrectApply");
      function hide() {
        if (dlg.open) dlg.close();
      }
      if (close) close.addEventListener("click", hide);
      if (cancel) cancel.addEventListener("click", hide);
      if (apply) apply.addEventListener("click", applyCorrect);
    }
    syncCorrectBtn();
  }

  function runCorrect() {
    var sel = readSel() || pending;
    if (!sel || !sel.el || !document.contains(sel.el) || !String(sel.text || "").trim()) {
      BF.setStatus("고칠 글을 먼저 드래그해 주세요.");
      return;
    }
    pending = sel;
    var btn = BF.$("btnCorrect");
    var provider = BF.$("writeProvider");
    var val = String(sel.el.value || "");
    var around = val.slice(Math.max(0, sel.start - 240), Math.min(val.length, sel.end + 240));
    if (btn) btn.disabled = true;
    fillCorrectDialog(sel, "wait");
    BF.setStatus("보정을 받는 중…");
    fetch("/api/write", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "revise",
        provider: provider ? provider.value : "openrouter",
        selected: sel.text,
        context: around,
        slug: BF.state.worldSlug || "",
      }),
    })
      .then(function (r) {
        return r.text().then(function (raw) {
          var j = {};
          try {
            j = raw ? JSON.parse(raw) : {};
          } catch (e) {
            j = { error: raw || "응답을 읽지 못했습니다." };
          }
          return { ok: r.ok, j: j };
        });
      })
      .then(function (pack) {
        if (!pack.ok) {
          var err = (pack.j && pack.j.error) || "보정에 실패했습니다.";
          fillCorrectDialog(sel, "err", { error: err });
          BF.setStatus(err);
          return;
        }
        var rewrite = fillCorrectDialog(sel, "ok", pack.j);
        fillStatus(BF.$("writeQuota"), pack.j);
        if (!rewrite) {
          fillCorrectDialog(sel, "err", { error: "모델이 빈 글을 보냈습니다. 다시 받아 보세요." });
          BF.setStatus("모델이 빈 글을 보냈습니다. 다시 받아 보세요.");
          return;
        }
        pending.rewrite = rewrite;
        BF.setStatus("보정안을 확인한 뒤 적용을 눌러 주세요.");
      })
      .catch(function () {
        var msg = "서버에 닿지 못했습니다. 열어보기.bat 이 켜져 있는지 보세요.";
        fillCorrectDialog(sel, "err", { error: msg });
        BF.setStatus(msg);
      })
      .then(function () {
        syncCorrectBtn();
      });
  }

  function applyCorrect() {
    var dlg = BF.$("wmCorrect");
    var toEl = BF.$("wmCorrectTo");
    var sel = pending;
    var ins = toEl ? String(toEl.value || "") : "";
    if (!sel || !sel.el || !document.contains(sel.el)) {
      BF.setStatus("원래 칸을 찾지 못했습니다. 글을 다시 고른 뒤 보정해 주세요.");
      if (dlg && dlg.open) dlg.close();
      return;
    }
    sel.el.value = spliceText(sel.el.value, sel.start, sel.end, ins);
    sel.el.dispatchEvent(new Event("input", { bubbles: true }));
    sel.el.dispatchEvent(new Event("change", { bubbles: true }));
    pending = null;
    if (dlg && dlg.open) dlg.close();
    BF.setStatus("보정한 글을 넣었습니다.");
    syncCorrectBtn();
  }

  BF.syncCorrectBtn = syncCorrectBtn;

  BF.bootWriteTools = function bootWriteTools() {
    bootKeys();
    bootCorrect();
  };

  /** 고른 구간만 바꿔 넣는지 — 깨지면 실패 */
  BF.__correctApplyCheck = function () {
    var out = spliceText("가나다라", 1, 3, "XY");
    var ok = out === "가XY라";
    return { ok: ok, reason: ok ? "" : "고른 글 치환이 어긋남" };
  };
})(window.WorldManager = window.WorldManager || {});
