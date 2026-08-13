/**
 * 모듈 안 — 속성 블럭·관계를 카드로 보고, 눌러서 고친다
 */
(function (BF) {
  "use strict";

  function editingOf(type, id) {
    var ed = BF.state.editingCard;
    return !!(ed && ed.type === type && ed.id === id);
  }

  function setEditing(type, id) {
    BF.state.editingCard = type && id ? { type: type, id: id } : null;
  }

  function previewText(md) {
    var t = String(md || "")
      .replace(/\s+/g, " ")
      .trim();
    if (!t) return "아직 내용이 없습니다. 눌러서 적으세요.";
    return t.length > 120 ? t.slice(0, 120) + "…" : t;
  }

  function categorySelectHtml(kind, current) {
    // 관계는 5종을 맨 앞, 그다음 예전 분류·사용자가 만든 이름
    var defaults =
      kind === "relations"
        ? (BF.DEFAULT_RELATION_TYPES || []).concat([
            "혈연",
            "유정",
            "동맹",
            "기원",
            "가호",
            "신앙",
            "지리",
            "인과",
            "동일",
            "신뢰",
            "친분",
            "치유",
            "상징",
            "관측",
            "플롯",
            "미스터리",
            "적대",
          ])
        : [
            "개요",
            "기본",
            "외형",
            "성격",
            "배경",
            "능력",
            "규칙",
            "한계",
            "대가",
            "지리",
            "사회",
            "역사",
            "신앙",
            "사건",
            "역할",
            "서사",
            "미정",
          ];
    var seen = {};
    var opts = [];
    function add(v) {
      v = String(v || "").trim();
      if (!v || seen[v]) return;
      seen[v] = 1;
      opts.push(v);
    }
    defaults.forEach(add);
    (BF.taxonomyList(kind) || []).forEach(add);
    add(current);
    var cur = String(current || "").trim();
    return (
      '<select class="page-card-field" data-field="category" aria-label="' +
      (kind === "relations" ? "관계 분류" : "속성 분류") +
      '">' +
      '<option value="">' +
      (kind === "relations" ? "관계 고르기" : "분류 고르기") +
      "</option>" +
      opts
        .map(function (v) {
          return (
            '<option value="' +
            BF.escapeHtml(v) +
            '"' +
            (v === cur ? " selected" : "") +
            ">" +
            BF.escapeHtml(v) +
            "</option>"
          );
        })
        .join("") +
      "</select>"
    );
  }

  function targetLabel(id) {
    var n = BF.findNode(id);
    return n ? BF.displayName(n) : "";
  }

  function hitHtml(n) {
    var path = BF.nodePathLabel(n) || "";
    return (
      '<li role="option" data-action="pick-target" data-id="' +
      BF.escapeHtml(n.id) +
      '" tabindex="0">' +
      "<strong>" +
      BF.escapeHtml(BF.displayName(n)) +
      "</strong>" +
      (path ? "<span>" + BF.escapeHtml(path) + "</span>" : "") +
      "</li>"
    );
  }

  function fillTargetMenu(menu, selfId, query) {
    if (!menu) return;
    var hits = (BF.searchLinkTargets(query, selfId, 24) || []).filter(function (n) {
      return n.level !== "middle";
    });
    menu.innerHTML = hits.length
      ? hits.map(hitHtml).join("")
      : '<li class="wm-rel-empty">맞는 설정이 없습니다.</li>';
    menu.hidden = false;
  }

  function cardActions(delAction, delLabel) {
    return (
      '<div class="wm-card-actions">' +
      '<button type="button" class="btn btn-primary btn-sm" data-action="save-card" tabindex="0">저장</button>' +
      '<button type="button" class="btn btn-outline btn-sm" data-action="close-card" tabindex="0">닫기</button>' +
      '<button type="button" class="btn btn-outline-danger btn-sm" data-action="' +
      delAction +
      '" tabindex="0">' +
      delLabel +
      "</button>" +
      "</div>"
    );
  }

  function blockHtml(b) {
    var open = editingOf("block", b.id);
    var title = (b.category && String(b.category).trim()) || "새 속성 블럭";
    var status = b.canonStatus || "provisional";
    var short = BF.canonShort ? BF.canonShort(status) : status;
    if (!open) {
      return (
        '<article class="nt-card is-block is-view" data-block-id="' +
        BF.escapeHtml(b.id) +
        '" data-canon="' +
        BF.escapeHtml(status) +
        '" data-action="edit-block" tabindex="0" role="button" aria-label="' +
        BF.escapeHtml(title) +
        ' 고치기">' +
        '<div class="wm-card-summary">' +
        '<p class="wm-card-title">' +
        BF.escapeHtml(title) +
        ' <span class="wm-canon-mini">' +
        BF.escapeHtml(short) +
        "</span></p>" +
        '<p class="wm-card-preview">' +
        BF.escapeHtml(previewText(b.md)) +
        "</p>" +
        "</div></article>"
      );
    }
    var labels = BF.CANON_LABELS || {};
    var keys =
      (BF.state.canonStatuses && BF.state.canonStatuses.length && BF.state.canonStatuses) ||
      BF.DEFAULT_CANON_STATUSES ||
      Object.keys(labels);
    var opts = keys
      .map(function (k) {
        var on = k === status ? " selected" : "";
        return (
          '<option value="' +
          k +
          '"' +
          on +
          ">" +
          BF.escapeHtml((BF.CANON_SHORT && BF.CANON_SHORT[k]) || labels[k] || k) +
          "</option>"
        );
      })
      .join("");
    return (
      '<article class="nt-card is-block is-editing" data-block-id="' +
      BF.escapeHtml(b.id) +
      '">' +
      '<div class="wm-block-edit">' +
      '<div class="wm-block-toolbar">' +
      '<label class="wm-field"><span>분류</span>' +
      categorySelectHtml("attributes", b.category) +
      "</label>" +
      '<label class="wm-field"><span>신뢰도</span>' +
      '<select class="page-card-field wm-canon-select" data-field="canonStatus" aria-label="신뢰도">' +
      opts +
      "</select></label>" +
      "</div>" +
      '<label class="wm-field wm-field-body"><span>내용</span>' +
      '<textarea class="page-card-area wm-block-md" data-field="md" rows="18" placeholder="내용을 넉넉히 적으세요." aria-label="내용">' +
      BF.escapeHtml(b.md || "") +
      "</textarea></label>" +
      cardActions("del-block", "지우기") +
      "</div></article>"
    );
  }

  function relHtml(r) {
    var open = editingOf("rel", r.id);
    var linked = targetLabel(r.targetId);
    var kind = (r.category && String(r.category).trim()) || "";
    var title = linked
      ? kind
        ? linked + " · " + kind
        : linked
      : kind || "새 관계";
    if (!open) {
      return (
        '<article class="nt-card is-block is-view" data-rel-id="' +
        BF.escapeHtml(r.id) +
        '" data-action="edit-rel" tabindex="0" role="button" aria-label="' +
        BF.escapeHtml(title) +
        ' 고치기">' +
        '<div class="wm-card-summary">' +
        '<p class="wm-card-title">' +
        BF.escapeHtml(title) +
        "</p>" +
        '<p class="wm-card-preview">' +
        BF.escapeHtml(previewText(r.md)) +
        "</p>" +
        "</div></article>"
      );
    }
    return (
      '<article class="nt-card is-block is-editing" data-rel-id="' +
      BF.escapeHtml(r.id) +
      '">' +
      '<div class="wm-block-edit">' +
      '<div class="wm-block-toolbar">' +
      '<label class="wm-field wm-field-grow"><span>이을 대상</span>' +
      '<div class="wm-rel-pick">' +
      '<input class="page-card-field" data-field="targetSearch" value="' +
      BF.escapeHtml(linked) +
      '" placeholder="이름 찾아 잇기" aria-label="이을 모듈 찾기" autocomplete="off" />' +
      '<ul class="wm-rel-menu" hidden></ul>' +
      "</div></label>" +
      '<label class="wm-field"><span>관계</span>' +
      categorySelectHtml("relations", r.category) +
      "</label>" +
      "</div>" +
      '<label class="wm-field wm-field-body"><span>메모</span>' +
      '<textarea class="page-card-area wm-block-md wm-block-md-rel" data-field="md" rows="8" placeholder="이 관계에 대해 적으세요." aria-label="관계 설명">' +
      BF.escapeHtml(r.md || "") +
      "</textarea></label>" +
      cardActions("del-rel", "지우기") +
      "</div></article>"
    );
  }

  BF.addModuleBlock = function addModuleBlock() {
    var node = BF.findNode(BF.state.pageId);
    if (!node) return;
    if (!node.blocks) node.blocks = [];
    var id = BF.uid("block");
    node.blocks.push({
      id: id,
      category: "",
      md: "",
      canonStatus: node.canonStatus || "provisional",
    });
    setEditing("block", id);
    if (BF.touchNode) BF.touchNode(node);
    BF.persist();
    BF.renderBoard();
    BF.setStatus("속성 블럭을 추가했습니다.");
  };

  /** 갈래별 권장 블럭을 한 번에 넣음 (이미 있으면 건너뜀) */
  BF.applyEmptyBlockPresets = function applyEmptyBlockPresets() {
    var node = BF.findNode(BF.state.pageId);
    if (!node) return;
    var maj = BF.majorOf ? BF.majorOf(node) : null;
    var mid = maj ? maj.id : node.id;
    var cats = (BF.EMPTY_BLOCK_PRESETS && BF.EMPTY_BLOCK_PRESETS[mid]) || [];
    if (!cats.length) {
      BF.setStatus("이 갈래용 기본 블럭이 없습니다.");
      return;
    }
    if (!node.blocks) node.blocks = [];
    var have = {};
    node.blocks.forEach(function (b) {
      if (b && b.category) have[b.category] = 1;
    });
    var added = 0;
    cats.forEach(function (cat) {
      if (have[cat]) return;
      node.blocks.push({
        id: BF.uid("block"),
        category: cat,
        md: "",
        canonStatus: node.canonStatus || "provisional",
      });
      have[cat] = 1;
      added += 1;
    });
    if (!added) {
      BF.setStatus("권장 블럭이 이미 있습니다.");
      return;
    }
    if (BF.touchNode) BF.touchNode(node);
    BF.persist();
    BF.renderBoard();
    BF.setStatus("기본 블럭 " + added + "개를 넣었습니다.");
  };

  BF.addModuleRel = function addModuleRel() {
    var node = BF.findNode(BF.state.pageId);
    if (!node) return;
    if (!node.relationships) node.relationships = [];
    var id = BF.uid("rel");
    node.relationships.push({ id: id, targetId: "", category: "", md: "" });
    setEditing("rel", id);
    BF.persist();
    BF.renderBoard();
    BF.setStatus("관계를 추가했습니다.");
  };

  BF.renderModulePage = function renderModulePage(root) {
    var node = BF.findNode(BF.state.pageId);
    if (!root || !node) return;
    // 고치던 카드가 사라졌으면 접기
    var ed = BF.state.editingCard;
    if (ed) {
      var alive =
        ed.type === "block"
          ? (node.blocks || []).some(function (b) {
              return b.id === ed.id;
            })
          : (node.relationships || []).some(function (r) {
              return r.id === ed.id;
            });
      if (!alive) BF.state.editingCard = null;
    }
    var blocks = node.blocks || [];
    var rels = node.relationships || [];
    var status = node.canonStatus || "provisional";
    var labels = BF.CANON_LABELS || {};
    var keys =
      (BF.state.canonStatuses && BF.state.canonStatuses.length && BF.state.canonStatuses) ||
      BF.DEFAULT_CANON_STATUSES ||
      Object.keys(labels);
    var cardCanonOpts = keys
      .map(function (k) {
        var on = k === status ? " selected" : "";
        return (
          '<option value="' +
          k +
          '"' +
          on +
          ">" +
          BF.escapeHtml(labels[k] || k) +
          "</option>"
        );
      })
      .join("");
    var majNode = BF.majorOf ? BF.majorOf(node) : null;
    var presetKey = majNode ? majNode.id : node.id;
    var presets = (BF.EMPTY_BLOCK_PRESETS && BF.EMPTY_BLOCK_PRESETS[presetKey]) || [];
    var presetBtn =
      presets.length && !blocks.length
        ? '<button type="button" class="btn btn-outline btn-sm" data-action="apply-presets" tabindex="0">기본 블럭 넣기 (' +
          BF.escapeHtml(presets.join(" · ")) +
          ")</button>"
        : "";
    root.innerHTML =
      '<section class="wm-stack">' +
      '<label class="wm-name-field"><span>화면 이름</span>' +
      '<input class="page-card-field" data-page-field="nameKo" value="' +
      BF.escapeHtml(node.nameKo || "") +
      '" placeholder="이 모듈 이름" aria-label="화면 이름" /></label>' +
      '<label class="wm-name-field"><span>신뢰도</span>' +
      '<select class="page-card-field" data-page-field="canonStatus" aria-label="이 카드 신뢰도">' +
      cardCanonOpts +
      "</select></label>" +
      "</section>" +
      '<section class="wm-stack">' +
      '<h2 class="wm-stack-title">속성 블럭</h2>' +
      (blocks.length ? blocks.map(blockHtml).join("") : '<p class="nt-empty">아직 블럭이 없습니다.</p>') +
      presetBtn +
      '<button type="button" class="nt-add-group" data-action="add-block" tabindex="0">+ 블럭 추가</button>' +
      "</section>" +
      '<section class="wm-stack">' +
      '<h2 class="wm-stack-title">관계</h2>' +
      (rels.length ? rels.map(relHtml).join("") : '<p class="nt-empty">아직 이은 관계가 없습니다.</p>') +
      '<button type="button" class="nt-add-group" data-action="add-rel" tabindex="0">+ 관계 추가</button>' +
      "</section>";
    bindPage(root);
    var focus =
      root.querySelector(".is-editing [data-field=\"md\"]") ||
      root.querySelector(".is-editing [data-field=\"targetSearch\"]");
    if (focus) {
      try {
        focus.focus();
      } catch (err) {}
    }
  };

  function patchField(owner, field, value, kind, remember) {
    if (!owner) return;
    owner[field] = value;
    if (remember && field === "category") BF.rememberTaxonomy(kind, value);
    var page = BF.findNode(BF.state.pageId);
    if (page && BF.touchNode) BF.touchNode(page);
    BF.persist();
  }

  function bindPage(root) {
    if (root.dataset.boundPage === "1") return;
    root.dataset.boundPage = "1";
    root.addEventListener("click", function (e) {
      if (!BF.state.pageId) return;
      var pickT = e.target.closest('[data-action="pick-target"]');
      if (pickT && root.contains(pickT)) {
        e.preventDefault();
        e.stopPropagation();
        var tid = pickT.getAttribute("data-id");
        var relEl0 = pickT.closest("[data-rel-id]");
        var n0 = BF.findNode(BF.state.pageId);
        if (!relEl0 || !n0 || !tid) return;
        var rel0 = (n0.relationships || []).find(function (x) {
          return x.id === relEl0.getAttribute("data-rel-id");
        });
        if (!rel0) return;
        rel0.targetId = tid;
        BF.persist();
        var searchInp = relEl0.querySelector('[data-field="targetSearch"]');
        if (searchInp) searchInp.value = targetLabel(tid);
        var menu0 = relEl0.querySelector(".wm-rel-menu");
        if (menu0) menu0.hidden = true;
        return;
      }
      var act = e.target.closest("[data-action]");
      if (!act || !root.contains(act)) return;
      var action = act.getAttribute("data-action");
      if (action === "edit-block") {
        e.stopPropagation();
        var bidOpen = act.closest("[data-block-id]");
        if (!bidOpen) return;
        setEditing("block", bidOpen.getAttribute("data-block-id"));
        BF.renderBoard();
        return;
      }
      if (action === "edit-rel") {
        e.stopPropagation();
        var ridOpen = act.closest("[data-rel-id]");
        if (!ridOpen) return;
        setEditing("rel", ridOpen.getAttribute("data-rel-id"));
        BF.renderBoard();
        return;
      }
      if (action === "save-card") {
        e.stopPropagation();
        var card = act.closest("[data-block-id], [data-rel-id]");
        if (card) {
          var cat = card.querySelector('[data-field="category"]');
          if (cat && cat.value.trim()) {
            var isBlock = !!card.getAttribute("data-block-id");
            BF.rememberTaxonomy(isBlock ? "attributes" : "relations", cat.value.trim());
          }
        }
        BF.persist();
        setEditing(null, null);
        BF.renderBoard();
        BF.setStatus("저장했습니다.");
        return;
      }
      if (action === "close-card") {
        e.stopPropagation();
        setEditing(null, null);
        BF.renderBoard();
        return;
      }
      if (action === "add-block") {
        e.stopPropagation();
        BF.addModuleBlock();
        return;
      }
      if (action === "apply-presets") {
        e.stopPropagation();
        BF.applyEmptyBlockPresets();
        return;
      }
      if (action === "add-rel") {
        e.stopPropagation();
        BF.addModuleRel();
        return;
      }
      if (action === "del-block") {
        e.stopPropagation();
        var bid = act.closest("[data-block-id]");
        var n1 = BF.findNode(BF.state.pageId);
        if (!n1 || !bid) return;
        var delId = bid.getAttribute("data-block-id");
        n1.blocks = (n1.blocks || []).filter(function (b) {
          return b.id !== delId;
        });
        if (editingOf("block", delId)) setEditing(null, null);
        BF.persist();
        BF.renderBoard();
        BF.setStatus("블럭을 지웠습니다.");
        return;
      }
      if (action === "del-rel") {
        e.stopPropagation();
        var rid = act.closest("[data-rel-id]");
        var n2 = BF.findNode(BF.state.pageId);
        if (!n2 || !rid) return;
        var delRid = rid.getAttribute("data-rel-id");
        n2.relationships = (n2.relationships || []).filter(function (r) {
          return r.id !== delRid;
        });
        if (editingOf("rel", delRid)) setEditing(null, null);
        BF.persist();
        BF.renderBoard();
        BF.setStatus("관계를 지웠습니다.");
      }
    });
    root.addEventListener("keydown", function (e) {
      var view = e.target.closest(".nt-card.is-view");
      if (view && root.contains(view) && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        view.click();
        return;
      }
      if (e.key === "Escape" && BF.state.editingCard) {
        e.preventDefault();
        setEditing(null, null);
        BF.renderBoard();
        return;
      }
      var el = e.target;
      if (el.getAttribute("data-field") !== "targetSearch") return;
      var menu = el.closest(".wm-rel-pick") && el.closest(".wm-rel-pick").querySelector(".wm-rel-menu");
      if (!menu) return;
      if (e.key === "Escape") {
        menu.hidden = true;
        return;
      }
      if (e.key === "Enter") {
        var first = menu.querySelector('[data-action="pick-target"]');
        if (first) {
          e.preventDefault();
          first.click();
        }
      }
    });
    root.addEventListener("input", function (e) {
      if (!BF.state.pageId) return;
      var el = e.target;
      var pageField = el.getAttribute("data-page-field");
      var node = BF.findNode(BF.state.pageId);
      if (!node) return;
      if (pageField) {
        node[pageField] = el.value;
        if (pageField === "nameKo") node.name = node.name || el.value;
        if (BF.touchNode) BF.touchNode(node);
        BF.persist();
        var titleEl = BF.$("boardTitle");
        if (titleEl) titleEl.textContent = BF.displayName(node);
        return;
      }
      var field = el.getAttribute("data-field");
      if (!field) return;
      if (field === "targetSearch") {
        var relBox = el.closest("[data-rel-id]");
        var menu = relBox && relBox.querySelector(".wm-rel-menu");
        fillTargetMenu(menu, node.id, el.value);
        return;
      }
      var blockEl = el.closest("[data-block-id]");
      if (blockEl) {
        var b = (node.blocks || []).find(function (x) {
          return x.id === blockEl.getAttribute("data-block-id");
        });
        patchField(b, field, el.value, "attributes", false);
        return;
      }
      var relEl = el.closest("[data-rel-id]");
      if (relEl) {
        var r = (node.relationships || []).find(function (x) {
          return x.id === relEl.getAttribute("data-rel-id");
        });
        patchField(r, field, el.value, "relations", false);
      }
    });
    root.addEventListener("change", function (e) {
      if (!BF.state.pageId) return;
      var el = e.target;
      var pageField = el.getAttribute("data-page-field");
      var node = BF.findNode(BF.state.pageId);
      if (!node) return;
      if (pageField) {
        node[pageField] = el.value;
        if (BF.touchNode) BF.touchNode(node);
        BF.persist();
        BF.renderBoard();
        return;
      }
      var field = el.getAttribute("data-field");
      if (!field || field === "targetSearch") return;
      var blockEl = el.closest("[data-block-id]");
      if (blockEl) {
        var b = (node.blocks || []).find(function (x) {
          return x.id === blockEl.getAttribute("data-block-id");
        });
        patchField(b, field, el.value, "attributes", true);
        return;
      }
      var relEl = el.closest("[data-rel-id]");
      if (!relEl) return;
      var r = (node.relationships || []).find(function (x) {
        return x.id === relEl.getAttribute("data-rel-id");
      });
      patchField(r, field, el.value, "relations", true);
    });
    root.addEventListener("focusin", function (e) {
      var el = e.target;
      if (!BF.state.pageId || el.getAttribute("data-field") !== "targetSearch") return;
      var node = BF.findNode(BF.state.pageId);
      var relBox = el.closest("[data-rel-id]");
      fillTargetMenu(relBox && relBox.querySelector(".wm-rel-menu"), node && node.id, el.value);
    });
    document.addEventListener("click", function (e) {
      if (e.target.closest(".wm-rel-pick")) return;
      root.querySelectorAll(".wm-rel-menu").forEach(function (m) {
        m.hidden = true;
      });
    });
  }

  // ponytail: 카드 열림/접힘만 검사. 저장 본문은 persist 경로를 그대로 탄다
  BF.__cardEditCheck = function cardEditCheck() {
    var prev = BF.state.editingCard;
    setEditing("block", "x");
    var on = editingOf("block", "x") && !editingOf("rel", "x");
    setEditing(null, null);
    var off = !BF.state.editingCard;
    BF.state.editingCard = prev;
    return { ok: on && off, reason: on && off ? "" : "카드 편집 상태가 어긋남" };
  };
})(window.WorldManager = window.WorldManager || {});
