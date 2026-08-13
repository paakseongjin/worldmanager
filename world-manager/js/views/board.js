/**
 * 모듈 갤러리 — 그룹으로 모듈을 묶고, 카드를 누르면 블럭 작성 화면
 */
(function (BF) {
  "use strict";

  var TINTS = BF.BOARD_TINTS || ["peach", "rose", "mint", "lavender", "sky", "yellow", "cream", "gray"];
  var CANON_TINT = {
    confirmed: "mint",
    provisional: "sky",
    deferred: "cream",
    speculation: "lavender",
    unknown: "gray",
    forgotten: "cream",
    false: "peach",
    forbidden: "rose",
    future_reveal: "yellow",
  };

  BF.activeModuleId = function activeModuleId() {
    var id = BF.state.boardModuleId;
    var n = id && BF.findNode(id);
    if (n && !BF.isDeleted(n)) return id;
    var first = BF.majorModules()[0];
    BF.state.boardModuleId = first ? first.id : null;
    return BF.state.boardModuleId;
  };

  BF.setBoardModule = function setBoardModule(id) {
    var node = BF.findNode(id);
    if (!node || BF.isDeleted(node)) return;
    BF.state.trashOpen = false;
    BF.state.mapOpen = false;
    BF.state.pageId = null;
    BF.state.boardModuleId = id;
    BF.state.draftParentId = id;
    BF.state.expanded.add(id);
    BF.persist();
    BF.renderBoard();
  };

  function boardGroups(moduleId) {
    var middles = BF.childrenOf(moduleId).filter(function (n) {
      return n.level === "middle";
    });
    var orphans = BF.childrenOf(moduleId).filter(function (n) {
      return n.level !== "middle";
    });
    middles.sort(BF.compareByModuleNumber);
    var groups = middles.map(function (g, i) {
      return {
        id: g.id,
        node: g,
        tint: TINTS[i % TINTS.length],
        rows: BF.childrenOf(g.id).sort(BF.compareByModuleNumber),
      };
    });
    if (orphans.length) {
      groups.push({
        id: "__orphan__",
        node: null,
        tint: "gray",
        rows: orphans.slice().sort(BF.compareByModuleNumber),
        title: "분류 없음",
      });
    }
    return groups;
  }

  function canonLabel(status) {
    if (BF.canonShort) return BF.canonShort(status);
    return (BF.CANON_LABELS && BF.CANON_LABELS[status]) || status || "미정";
  }

  function passesCanonFilter(node) {
    var f = BF.state.canonFilter || "all";
    if (!f || f === "all") return true;
    return (node.canonStatus || "unknown") === f;
  }

  function canonFilterHtml(groups) {
    var keys = (BF.state.canonStatuses && BF.state.canonStatuses.length
      ? BF.state.canonStatuses
      : BF.DEFAULT_CANON_STATUSES || Object.keys(BF.CANON_SHORT || {})
    ).slice();
    var counts = { all: 0 };
    groups.forEach(function (g) {
      (g.rows || []).forEach(function (n) {
        counts.all += 1;
        var s = n.canonStatus || "unknown";
        counts[s] = (counts[s] || 0) + 1;
      });
    });
    var cur = BF.state.canonFilter || "all";
    var chips =
      '<button type="button" class="wm-canon-chip' +
      (cur === "all" ? " is-on" : "") +
      '" data-action="canon-filter" data-canon="all" tabindex="0" aria-pressed="' +
      (cur === "all" ? "true" : "false") +
      '">전체 <span>' +
      counts.all +
      "</span></button>";
    keys.forEach(function (k) {
      var n = counts[k] || 0;
      if (!n && k !== cur) return; // 이 갈래에 없는 신뢰도는 숨김
      chips +=
        '<button type="button" class="wm-canon-chip' +
        (cur === k ? " is-on" : "") +
        '" data-action="canon-filter" data-canon="' +
        BF.escapeHtml(k) +
        '" tabindex="0" aria-pressed="' +
        (cur === k ? "true" : "false") +
        '">' +
        BF.escapeHtml(canonLabel(k)) +
        " <span>" +
        n +
        "</span></button>";
    });
    return (
      '<div class="wm-canon-filter" role="toolbar" aria-label="신뢰도로 보기">' +
      '<span class="wm-canon-filter-label">신뢰도</span>' +
      chips +
      "</div>"
    );
  }

  function cardHtml(node, tint) {
    var rels = (node.relationships || []).length;
    var selected = node.id === BF.state.selectedId ? " is-selected" : "";
    var status = node.canonStatus || "unknown";
    var tagTint = CANON_TINT[status] || tint || "gray";
    var preview =
      (node.blocks && node.blocks[0] && node.blocks[0].md) ||
      node.synopsis ||
      node.description ||
      "아직 내용이 없습니다. 눌러서 적으세요.";
    var title = BF.displayName(node) || "제목 없음";
    var sub = node.name && node.name !== title ? node.name : "";
    var stamp =
      (BF.formatStamp && node.updatedAt ? "고침 " + BF.formatStamp(node.updatedAt) : "") ||
      (BF.formatStamp && node.createdAt ? "추가 " + BF.formatStamp(node.createdAt) : "");
    var subBits = [];
    if (sub) subBits.push(sub);
    if (rels) subBits.push(rels + " 연결");
    if (stamp) subBits.push(stamp);
    return (
      '<article class="nt-card' +
      selected +
      '" data-id="' +
      BF.escapeHtml(node.id) +
      '" data-canon="' +
      BF.escapeHtml(status) +
      '" data-action="open" tabindex="0" role="button" aria-label="' +
      BF.escapeHtml(title) +
      ' 열기">' +
      '<div class="nt-card-preview nt-tint-' +
      tagTint +
      '" aria-hidden="true">' +
      '<p class="nt-card-preview-text">' +
      BF.escapeHtml(String(preview).slice(0, 120)) +
      "</p>" +
      "</div>" +
      '<div class="nt-card-meta">' +
      '<div class="nt-card-meta-text">' +
      '<p class="nt-card-title">' +
      BF.escapeHtml(title) +
      "</p>" +
      '<p class="nt-card-sub">' +
      BF.escapeHtml(subBits.join(" · ")) +
      "</p>" +
      "</div>" +
      '<span class="nt-tag nt-tint-' +
      tagTint +
      '" title="' +
      BF.escapeHtml((BF.CANON_LABELS && BF.CANON_LABELS[status]) || status) +
      '">' +
      BF.escapeHtml(canonLabel(status)) +
      "</span>" +
      '<button type="button" class="nt-card-del" data-action="delete" tabindex="0" aria-label="휴지통으로 보내기">×</button>' +
      "</div></article>"
    );
  }

  function trashCardHtml(node) {
    var when = "";
    try {
      when = node.deletedAt ? new Date(node.deletedAt).toLocaleString("ko-KR") : "";
    } catch (e) {
      when = node.deletedAt || "";
    }
    var path = BF.nodePathLabel ? BF.nodePathLabel(node) : "";
    return (
      '<article class="nt-card" data-id="' +
      BF.escapeHtml(node.id) +
      '">' +
      '<div class="nt-card-preview nt-tint-gray" aria-hidden="true">' +
      '<p class="nt-card-preview-text">' +
      BF.escapeHtml(
        String(
          (node.blocks && node.blocks[0] && node.blocks[0].md) ||
            node.synopsis ||
            node.description ||
            "휴지통에 있습니다."
        ).slice(0, 120)
      ) +
      "</p>" +
      "</div>" +
      '<div class="nt-card-meta">' +
      '<div class="nt-card-meta-text">' +
      '<p class="nt-card-title">' +
      BF.escapeHtml(BF.displayName(node) || "제목 없음") +
      "</p>" +
      '<p class="nt-card-sub">' +
      BF.escapeHtml((path ? path + " · " : "") + (when ? "보낸 시각 " + when : "휴지통")) +
      "</p>" +
      "</div>" +
      '<span class="nt-tag nt-tint-gray">휴지통</span>' +
      '<button type="button" class="btn btn-outline btn-xs nt-card-restore" data-action="restore" tabindex="0" aria-label="되돌리기">되돌리기</button>' +
      '<button type="button" class="nt-card-del" data-action="purge" tabindex="0" aria-label="완전 삭제">×</button>' +
      "</div></article>"
    );
  }

  function setToolbarBtn(id, show, label, aria) {
    var el = BF.$(id);
    if (!el) return;
    el.hidden = !show;
    if (label) el.textContent = label;
    if (aria) el.setAttribute("aria-label", aria);
  }

  /** 안내 · 상태 · 시각(있을 때만)을 오른쪽으로 이어 붙임 */
  function setBoardHint(guide, meta, stamp) {
    var hintEl = BF.$("boardHint");
    if (!hintEl) return;
    guide = String(guide || "").trim();
    meta = String(meta || "").trim();
    stamp = String(stamp || "").trim();
    if (!meta && !stamp) {
      hintEl.textContent = guide;
      return;
    }
    var html =
      '<span class="board-hint-guide">' + BF.escapeHtml(guide) + "</span>";
    if (meta) {
      html +=
        '<span class="board-hint-meta">' + BF.escapeHtml(meta) + "</span>";
    }
    if (stamp) {
      html +=
        '<span class="board-hint-stamp">' + BF.escapeHtml(stamp) + "</span>";
    }
    hintEl.innerHTML = html;
  }

  /** 보드 / 모듈 안 / 휴지통 — 그때그때 버튼만 */
  function syncToolbar(mode) {
    var bar = document.querySelector(".board-toolbar");
    if (bar) bar.setAttribute("data-mode", mode || "gallery");
    var isTrash = mode === "trash";
    var isPage = mode === "page";
    var isMap = mode === "map";
    setToolbarBtn("btnBoardBack", isTrash || isPage || isMap, "← 보드", "보드로 돌아가기");
    setToolbarBtn("btnEditModule", mode === "gallery", "고치기", "이 갈래 고치기");
    setToolbarBtn(
      "btnDeleteModule",
      !isTrash && !isMap,
      "지우기",
      isPage ? "이 모듈 휴지통으로" : "이 갈래 휴지통으로"
    );
    setToolbarBtn("btnBoardAddGroup", mode === "gallery", "그룹 추가", "그룹 추가");
    setToolbarBtn("btnBoardNewItem", mode === "gallery", "모듈 추가", "모듈 추가");
    setToolbarBtn("btnTrashEmpty", isTrash, "휴지통 비우기", "휴지통 비우기");
    var trashBtn = BF.$("btnTrash");
    if (trashBtn) trashBtn.setAttribute("aria-pressed", isTrash ? "true" : "false");
    var mapBtn = BF.$("btnMap");
    if (mapBtn) mapBtn.setAttribute("aria-pressed", isMap ? "true" : "false");
  }

  /** 그룹이 접혀 있는지 — 사용자가 고른 값 우선, 없으면 빈 그룹만 접힘 */
  function isGroupCollapsed(groupId, isEmpty) {
    var fold = BF.state.groupFold || {};
    if (Object.prototype.hasOwnProperty.call(fold, groupId)) return !!fold[groupId];
    return !!isEmpty;
  }

  function groupHtml(g) {
    var title = g.title || BF.displayName(g.node) || "그룹";
    var visible = (g.rows || []).filter(passesCanonFilter);
    var count = visible.length;
    var isEmpty = count === 0;
    var collapsed = isGroupCollapsed(g.id, isEmpty);
    var addBtn =
      g.id === "__orphan__"
        ? ""
        : '<button type="button" class="btn btn-outline-primary btn-xs" data-action="add-row" data-group="' +
          BF.escapeHtml(g.id) +
          '" tabindex="0">+ 새 모듈</button>';
    var delBtn = g.node
      ? '<button type="button" class="btn btn-outline-danger btn-xs" data-action="delete-group" data-group="' +
        BF.escapeHtml(g.id) +
        '" tabindex="0" aria-label="그룹 지우기">지우기</button>'
      : "";
    var rename = g.node
      ? '<input class="nt-group-title" data-action="rename-group" data-group="' +
        BF.escapeHtml(g.id) +
        '" value="' +
        BF.escapeHtml(title) +
        '" aria-label="그룹 이름" />'
      : '<h2 class="nt-group-title-text">' + BF.escapeHtml(title) + "</h2>";
    var toggle =
      '<button type="button" class="btn btn-outline btn-xs" data-action="toggle-group" data-group="' +
      BF.escapeHtml(g.id) +
      '" tabindex="0" aria-expanded="' +
      (collapsed ? "false" : "true") +
      '" aria-label="' +
      (collapsed ? "그룹 펼치기" : "그룹 접기") +
      '">' +
      (collapsed ? "펼치기" : "접기") +
      "</button>";
    return (
      '<section class="nt-group' +
      (collapsed ? " is-collapsed" : "") +
      '" data-group="' +
      BF.escapeHtml(g.id) +
      '">' +
      '<header class="nt-group-head">' +
      '<span class="nt-dot nt-tint-' +
      g.tint +
      '" aria-hidden="true"></span>' +
      rename +
      '<span class="nt-count">' +
      count +
      "</span>" +
      toggle +
      delBtn +
      addBtn +
      "</header>" +
      '<div class="nt-gallery">' +
      (visible.length
        ? visible
            .map(function (n) {
              return cardHtml(n, g.tint);
            })
            .join("")
        : '<p class="nt-empty">' +
          ((BF.state.canonFilter || "all") !== "all"
            ? "이 신뢰도에 맞는 카드가 없습니다."
            : "비어 있습니다. + 새 모듈로 카드를 추가하세요.") +
          "</p>") +
      "</div></section>"
    );
  }

  BF.renderBoard = function renderBoard() {
    BF.renderModules();
    var root = BF.$("boardRoot");
    var titleEl = BF.$("boardTitle");
    var gallery = BF.$("boardGallery");
    var moduleId = BF.activeModuleId();
    var mod = BF.findNode(moduleId);
    function done() {
      BF.setStatus();
    }
    if (BF.state.trashOpen) {
      syncToolbar("trash");
      if (titleEl) titleEl.textContent = "휴지통";
      setBoardHint("여기 있는 설정은 아직 남아 있습니다. 완전 삭제를 눌러야 이 컴퓨터에서 사라집니다.");
      if (!root) {
        done();
        return;
      }
      var rows = BF.trashedNodes();
      // 휴지통 데이터는 검색에 절대 잡히지 않음 — 목록만 보여 줌
      root.innerHTML =
        '<section class="nt-group">' +
        '<header class="nt-group-head"><h2 class="nt-group-name">' +
        rows.length +
        "개</h2></header>" +
        '<div class="nt-gallery">' +
        (rows.length
          ? rows.map(trashCardHtml).join("")
          : '<p class="nt-empty">휴지통이 비어 있습니다.</p>') +
        "</div></section>";
      bindBoardRoot(root);
      if (gallery) gallery.hidden = false;
      done();
      return;
    }
    if (BF.state.mapOpen) {
      syncToolbar("map");
      if (titleEl) titleEl.textContent = "세계관 지도";
      setBoardHint("이름을 누르면 내용이 열립니다. 설정을 고치면 이 목록도 바로 다시 맞춰집니다.");
      if (!root) {
        done();
        return;
      }
      if (BF.renderWorldMap) BF.renderWorldMap(root);
      if (gallery) gallery.hidden = false;
      done();
      return;
    }
    if (BF.state.pageId) {
      var page = BF.findNode(BF.state.pageId);
      if (page && !BF.isDeleted(page) && BF.renderModulePage) {
        syncToolbar("page");
        if (titleEl) titleEl.textContent = BF.displayName(page);
        var st = BF.canonShort ? BF.canonShort(page.canonStatus) : page.canonStatus || "";
        var created = BF.formatStamp ? BF.formatStamp(page.createdAt) : "—";
        var updated = BF.formatStamp ? BF.formatStamp(page.updatedAt) : "—";
        setBoardHint(
          "속성 블럭과 관계를 적으세요. 신뢰도는 바로 아래에서 고를 수 있습니다.",
          st ? "이 카드 · " + st : "",
          "추가 " + created + " · 고침 " + updated
        );
        if (!root) {
          done();
          return;
        }
        BF.renderModulePage(root);
        if (gallery) gallery.hidden = false;
        done();
        return;
      }
      BF.state.pageId = null;
    }
    syncToolbar("gallery");
    if (titleEl) titleEl.textContent = mod ? BF.displayName(mod) : "모듈을 고르세요";
    setBoardHint(
      mod
        ? (BF.MAJOR_HINTS && BF.MAJOR_HINTS[mod.id]) ||
            mod.description ||
            "그룹으로 모듈을 묶고, 카드를 눌러 설정을 적으세요. 위 신뢰도로 걸러 볼 수 있습니다."
        : "왼쪽에서 큰 갈래를 고르거나, 모듈 추가를 누르세요."
    );
    if (!root) {
      done();
      return;
    }
    if (!moduleId) {
      root.innerHTML = '<p class="nt-empty">모듈이 없습니다. 모듈 추가로 시작하세요.</p>';
      done();
      return;
    }
    var groups = boardGroups(moduleId);
    root.innerHTML =
      canonFilterHtml(groups) +
      groups.map(groupHtml).join("") +
      '<button type="button" class="nt-add-group" id="btnAddGroup" tabindex="0">+ 새 그룹</button>';
    // 루트는 유지되므로 리스너는 한 번만 붙인다 (매 렌더마다 쌓이면 클릭이 중복 실행됨)
    bindBoardRoot(root);
    var addG = BF.$("btnAddGroup");
    if (addG) {
      addG.addEventListener("click", function () {
        BF.boardAddGroup();
      });
    }
    if (gallery) gallery.hidden = false;
    done();
  };

  function bindBoardRoot(root) {
    if (root.dataset.bound === "1") return;
    root.dataset.bound = "1";
    root.addEventListener("click", function (e) {
      var del = e.target.closest('[data-action="delete"]');
      if (del) {
        e.stopPropagation();
        var card = del.closest(".nt-card");
        if (card) BF.boardDeleteRow(card.getAttribute("data-id"));
        return;
      }
      var restore = e.target.closest('[data-action="restore"]');
      if (restore) {
        e.stopPropagation();
        var rc = restore.closest(".nt-card");
        if (rc && BF.restoreNodeCascade(rc.getAttribute("data-id"))) {
          BF.renderBoard();
          BF.setStatus("되돌렸습니다.");
        }
        return;
      }
      var purge = e.target.closest('[data-action="purge"]');
      if (purge) {
        e.stopPropagation();
        var pc = purge.closest(".nt-card");
        if (pc && BF.purgeNodeCascade(pc.getAttribute("data-id"))) {
          BF.renderBoard();
          BF.setStatus("완전히 지웠습니다.");
        }
        return;
      }
      var t = e.target.closest("[data-action]");
      if (!t) return;
      var action = t.getAttribute("data-action");
      var group = t.getAttribute("data-group");
      var card = t.closest(".nt-card") || (t.classList.contains("nt-card") ? t : null);
      var id = card && card.getAttribute("data-id");
      if (action === "add-row") BF.boardAddRow(group);
      else if (action === "canon-filter") {
        BF.state.canonFilter = t.getAttribute("data-canon") || "all";
        BF.renderBoard();
        return;
      } else if (action === "delete-group") {
        e.preventDefault();
        e.stopPropagation();
        BF.boardDeleteGroup(group);
      } else if (action === "toggle-group") {
        var sec = Array.prototype.find.call(root.querySelectorAll(".nt-group"), function (el) {
          return el.getAttribute("data-group") === group;
        });
        if (sec) {
          var nowCollapsed = sec.classList.toggle("is-collapsed");
          if (!BF.state.groupFold) BF.state.groupFold = {};
          BF.state.groupFold[group] = nowCollapsed;
          t.textContent = nowCollapsed ? "펼치기" : "접기";
          t.setAttribute("aria-expanded", nowCollapsed ? "false" : "true");
          t.setAttribute("aria-label", nowCollapsed ? "그룹 펼치기" : "그룹 접기");
        }
      } else if (action === "open" && id && !BF.state.trashOpen) BF.boardOpenRow(id);
    });
    root.addEventListener("change", function (e) {
      var el = e.target;
      if (el.classList.contains("nt-group-title")) {
        BF.boardRenameGroup(el.getAttribute("data-group"), el.value);
      }
    });
    root.addEventListener("keydown", function (e) {
      var card = e.target.closest(".nt-card");
      if (!card || BF.state.trashOpen || BF.state.pageId) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        BF.boardOpenRow(card.getAttribute("data-id"));
      }
    });
  }

  BF.boardAddRow = function boardAddRow(groupId) {
    var parent = BF.findNode(groupId);
    if (!parent) {
      alert("그룹을 찾을 수 없습니다.");
      return;
    }
    var level = (BF.NEXT_LEVEL && BF.NEXT_LEVEL[parent.level]) || "minor";
    var node = BF.blankNode({
      parentId: parent.id,
      level: level,
      name: "새 모듈",
      nameKo: "새 모듈",
      canonStatus: "provisional",
      synopsis: "",
      description: "",
      blocks: [{ id: BF.uid("block"), category: "개요", md: "", canonStatus: "provisional" }],
    });
    BF.state.nodes.push(node);
    BF.state.selectedId = node.id;
    BF.state.pageId = node.id;
    BF.state.draftParentId = parent.id;
    BF.state.expanded.add(parent.id);
    BF.persist();
    BF.renderBoard();
    BF.setStatus("모듈을 추가했습니다. 이름과 블럭을 적으세요.");
  };

  BF.boardAddGroup = function boardAddGroup() {
    var moduleId = BF.activeModuleId();
    if (!moduleId) {
      alert("먼저 모듈을 추가하세요.");
      return;
    }
    var node = BF.blankNode({
      id: BF.uid("middle"),
      parentId: moduleId,
      level: "middle",
      name: "new_group",
      nameKo: "새 그룹",
      canonStatus: "provisional",
    });
    BF.state.nodes.push(node);
    BF.state.expanded.add(moduleId);
    BF.persist();
    BF.renderBoard();
    BF.setStatus("그룹을 추가했습니다.");
  };

  BF.boardRenameGroup = function boardRenameGroup(id, value) {
    var node = BF.findNode(id);
    if (!node) return;
    var v = String(value || "").trim();
    if (!v) return;
    node.nameKo = v;
    if (!node.name || node.name === "new_group") node.name = v;
    BF.persist();
  };

  BF.boardDeleteGroup = function boardDeleteGroup(id) {
    if (!BF.deleteNodeCascade(id)) return;
    BF.renderBoard();
    BF.setStatus("그룹을 지웠습니다.");
  };

  BF.boardDeleteRow = function boardDeleteRow(id) {
    if (!BF.deleteNodeCascade(id)) return;
    BF.renderBoard();
    BF.setStatus("모듈을 휴지통으로 보냈습니다.");
  };

  /** 카드를 누르면 블럭·관계 작성 화면 */
  BF.boardOpenRow = function boardOpenRow(id) {
    var node = BF.findNode(id);
    if (!node || BF.isDeleted(node) || node.level === "middle") return;
    BF.state.pageId = node.id;
    BF.state.selectedId = node.id;
    BF.state.editingCard = null;
    BF.state.trashOpen = false;
    BF.state.mapOpen = false;
    BF.persist();
    BF.renderBoard();
  };

  BF.boardBack = function boardBack() {
    if (BF.state.trashOpen) {
      BF.state.trashOpen = false;
      BF.renderBoard();
      return;
    }
    if (BF.state.mapOpen) {
      BF.state.mapOpen = false;
      BF.renderBoard();
      return;
    }
    if (BF.state.pageId) {
      BF.state.pageId = null;
      BF.state.editingCard = null;
      BF.persist();
      BF.renderBoard();
      return;
    }
    var mod = BF.findNode(BF.activeModuleId());
    if (!mod || !mod.parentId) return;
    BF.setBoardModule(mod.parentId);
  };

  BF.openTrash = function openTrash() {
    BF.state.trashOpen = !BF.state.trashOpen;
    if (BF.state.trashOpen) {
      BF.state.pageId = null;
      BF.state.editingCard = null;
      BF.state.mapOpen = false;
      // 휴지통 항목이 검색어에 잡히지 않게 입력도 비움
      BF.state.query = "";
      var inp = BF.$("searchInput");
      if (inp) inp.value = "";
    }
    BF.renderBoard();
  };

  BF.refreshAll = function refreshAll() {
    BF.renderBoard();
  };

  BF.__boardSelfCheck = function boardSelfCheck(nodes) {
    var list = nodes || [];
    var major = list.find(function (n) {
      return n.level === "major";
    });
    if (!major) return { ok: false, reason: "no major" };
    var middles = list.filter(function (n) {
      return n.parentId === major.id && n.level === "middle";
    });
    var orphans = list.filter(function (n) {
      return n.parentId === major.id && n.level !== "middle";
    });
    var order = BF.__moduleOrderCheck ? BF.__moduleOrderCheck() : { ok: true };
    return {
      ok: !!order.ok,
      groups: middles.length,
      orphans: orphans.length,
      reason: order.ok ? "" : order.reason,
    };
  };
})(window.WorldManager = window.WorldManager || {});
