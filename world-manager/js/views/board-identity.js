/**
 * 모듈·칸 이름/개요 고치기 대화상자
 */
(function (BF) {
  "use strict";

  function canonOptions(selected) {
    var labels = BF.CANON_LABELS || {};
    var keys =
      (BF.state.canonStatuses && BF.state.canonStatuses.length && BF.state.canonStatuses) ||
      BF.DEFAULT_CANON_STATUSES ||
      Object.keys(labels);
    if (!keys.length) keys = ["confirmed", "provisional", "deferred", "unknown"];
    return keys
      .map(function (k) {
        var on = k === (selected || "provisional") ? " selected" : "";
        return '<option value="' + k + '"' + on + ">" + BF.escapeHtml(labels[k] || k) + "</option>";
      })
      .join("");
  }

  function identityFormHtml(node) {
    var isMajor = node.level === "major" || !node.parentId;
    var parts = BF.splitModuleId(node.id);
    var rows = [];
    if (isMajor) {
      rows.push(
        '<label class="field"><span>번호</span><input id="idNum" class="page-card-field" inputmode="numeric" maxlength="4" value="' +
          BF.escapeHtml(parts.num) +
          '" aria-label="번호" /></label>'
      );
      rows.push(
        '<label class="field"><span>모듈 ID</span><input id="idSlug" class="page-card-field" value="' +
          BF.escapeHtml(parts.slug) +
          '" aria-label="모듈 ID" /></label>'
      );
    }
    rows.push(
      '<label class="field"><span>화면 이름</span><input id="idNameKo" class="page-card-field" value="' +
        BF.escapeHtml(node.nameKo || "") +
        '" aria-label="화면 이름" /></label>'
    );
    rows.push(
      '<p class="wm-stamp-row" aria-live="polite">' +
        '<span class="wm-stamp-k">추가</span> ' +
        BF.escapeHtml(BF.formatStamp ? BF.formatStamp(node.createdAt) : "—") +
        '<span class="wm-stamp-sep" aria-hidden="true">·</span>' +
        '<span class="wm-stamp-k">고침</span> ' +
        BF.escapeHtml(BF.formatStamp ? BF.formatStamp(node.updatedAt) : "—") +
        "</p>"
    );
    if (!isMajor) {
      rows.push(
        '<label class="field"><span>고유 이름</span><input id="idName" class="page-card-field" value="' +
          BF.escapeHtml(node.name || "") +
          '" aria-label="고유 이름" /></label>'
      );
    }
    rows.push(
      '<label class="field"><span>신뢰도</span><select id="idCanon" class="page-card-field" aria-label="신뢰도">' +
        canonOptions(node.canonStatus) +
        "</select></label>"
    );
    rows.push(
      '<label class="field"><span>한 줄 개요</span><input id="idSynopsis" class="page-card-field" maxlength="280" value="' +
        BF.escapeHtml(node.synopsis || "") +
        '" aria-label="한 줄 개요" /></label>'
    );
    rows.push(
      '<label class="field"><span>설명</span><textarea id="idDesc" class="page-card-area" rows="6" aria-label="설명">' +
        BF.escapeHtml(node.description || "") +
        "</textarea></label>"
    );
    return '<form id="identityForm" class="id-form" action="#">' + rows.join("") + "</form>";
  }

  BF.openIdentityDialog = function openIdentityDialog(node) {
    var dlg = BF.$("wmDialog");
    var body = BF.$("wmDialogBody");
    var title = BF.$("wmDialogTitle");
    var ok = BF.$("wmDialogOk");
    if (!dlg || !body || !node) return;
    dlg._mode = "identity";
    var isMajor = node.level === "major" || !node.parentId;
    if (title) title.textContent = isMajor ? "모듈 고치기" : "이 칸 고치기";
    if (ok) ok.textContent = "확인";
    body.innerHTML = identityFormHtml(node);
    dlg._identityId = node.id;
    if (typeof dlg.showModal === "function") dlg.showModal();
    var focus = body.querySelector("input, textarea, select");
    if (focus) {
      try {
        focus.focus();
      } catch (e) {
        /* 포커스 실패는 무시 */
      }
    }
  };

  BF.saveIdentityDialog = function saveIdentityDialog() {
    var dlg = BF.$("wmDialog");
    var id = dlg && dlg._identityId;
    var node = BF.findNode(id);
    if (!node) return false;
    var isMajor = node.level === "major" || !node.parentId;
    var nameKo = (BF.$("idNameKo") && BF.$("idNameKo").value.trim()) || "";
    var synopsis = (BF.$("idSynopsis") && BF.$("idSynopsis").value.trim()) || "";
    var description = (BF.$("idDesc") && BF.$("idDesc").value.trim()) || "";
    var canon = (BF.$("idCanon") && BF.$("idCanon").value) || node.canonStatus;
    if (isMajor) {
      var composed = BF.composeModuleId(
        BF.$("idNum") && BF.$("idNum").value,
        BF.$("idSlug") && BF.$("idSlug").value
      );
      if (composed && composed !== node.id && !BF.renameNodeId(node.id, composed)) return false;
      node = BF.findNode(composed) || node;
      node.name = node.id;
      node.nameKo = nameKo || node.nameKo || node.id;
    } else {
      node.name = (BF.$("idName") && BF.$("idName").value.trim()) || node.name;
      node.nameKo = nameKo;
    }
    node.synopsis = synopsis;
    node.description = description;
    node.canonStatus = canon;
    if (BF.touchNode) BF.touchNode(node);
    dlg._identityId = null;
    BF.persist();
    BF.renderBoard();
    BF.setStatus("«" + BF.displayName(node) + "»을(를) 고쳤습니다.");
    return true;
  };

  BF.bootIdentityDialog = function bootIdentityDialog() {
    var dlg = BF.$("wmDialog");
    if (!dlg || dlg.dataset.bound === "1") return;
    dlg.dataset.bound = "1";
    var close = function () {
      dlg._identityId = null;
      dlg._mode = "";
      var ok = BF.$("wmDialogOk");
      if (ok) ok.textContent = "확인";
      if (dlg.open) dlg.close();
    };
    var ok = BF.$("wmDialogOk");
    var closeBtn = BF.$("wmDialogClose");
    if (ok)
      ok.addEventListener("click", function () {
        if (BF.saveIdentityDialog()) close();
      });
    if (closeBtn) closeBtn.addEventListener("click", close);
    dlg.addEventListener("click", function (e) {
      if (e.target === dlg) close();
    });
    dlg.addEventListener("keydown", function (e) {
      if (e.key !== "Enter" || e.target.tagName === "TEXTAREA") return;
      e.preventDefault();
      if (BF.saveIdentityDialog()) close();
    });
  };

})(window.WorldManager = window.WorldManager || {});
