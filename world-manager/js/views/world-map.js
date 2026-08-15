/**
 * 세계관 지도 — persist 때 맞춰 둔 maps 를 마크다운 코드맵으로 보여 주고, 이름을 누르면 내용 창
 */
(function (BF) {
  "use strict";

  function visibleModules() {
    var q = (BF.state.query || "").trim().toLowerCase();
    return (BF.state.maps && BF.state.maps.modules ? BF.state.maps.modules : []).filter(function (m) {
      if (!q) return true;
      var n = BF.findNode(m.id);
      var hay = (m.name || "") + " " + (m.id || "") + " " + (BF.nodePathLabel(n) || "");
      return hay.toLowerCase().indexOf(q) >= 0;
    });
  }

  function mapLink(id, name) {
    return (
      '<button type="button" class="wm-map-link" data-id="' +
      BF.escapeHtml(id) +
      '" tabindex="0">' +
      BF.escapeHtml(name) +
      "</button>"
    );
  }

  /** 갈래·그룹 아래 모듈과 관계를 마크다운 목록으로 */
  function mapCodeHtml(modules, relations) {
    var byMajor = {};
    modules.forEach(function (m) {
      var k = m.majorId || "_";
      if (!byMajor[k]) byMajor[k] = [];
      byMajor[k].push(m);
    });
    var keys = Object.keys(byMajor);
    keys.sort(function (a, b) {
      return String(a).localeCompare(String(b), "ko");
    });
    var relFrom = {};
    relations.forEach(function (e) {
      if (!relFrom[e.from]) relFrom[e.from] = [];
      relFrom[e.from].push(e);
    });
    var live = {};
    modules.forEach(function (m) {
      live[m.id] = m;
    });
    var lines = [];
    keys.forEach(function (k) {
      var maj = BF.findNode(k);
      lines.push(
        '<span class="wm-map-h"># ' + BF.escapeHtml(maj ? BF.displayName(maj) : "기타") + "</span>"
      );
      var byGroup = {};
      byMajor[k].forEach(function (m) {
        var g = m.groupId || "_";
        if (!byGroup[g]) byGroup[g] = [];
        byGroup[g].push(m);
      });
      Object.keys(byGroup).forEach(function (gid) {
        var gnode = BF.findNode(gid);
        if (gnode) {
          lines.push(
            '<span class="wm-map-h">## ' + BF.escapeHtml(BF.displayName(gnode)) + "</span>"
          );
        }
        byGroup[gid].forEach(function (m) {
          lines.push("- " + mapLink(m.id, m.name));
          (relFrom[m.id] || []).forEach(function (e) {
            var t = live[e.to];
            var tName = t ? t.name : BF.displayName(BF.findNode(e.to)) || e.to;
            var target = t ? mapLink(e.to, tName) : BF.escapeHtml(tName);
            lines.push(
              '  - <span class="wm-map-rel">' +
                BF.escapeHtml(e.type) +
                "</span> → " +
                target
            );
          });
        });
      });
      lines.push("");
    });
    return lines.join("\n");
  }

  function peekHtml(node) {
    var path = BF.nodePathLabel(node) || "";
    var blocks = (node.blocks || [])
      .map(function (b) {
        return (
          "<section class=\"wm-peek-block\"><h3>" +
          BF.escapeHtml(b.category || "메모") +
          "</h3><p>" +
          BF.escapeHtml(String(b.md || "").trim() || "아직 내용이 없습니다.") +
          "</p></section>"
        );
      })
      .join("");
    var rels = (node.relationships || []).filter(function (r) {
      return r.targetId;
    });
    var relHtml = rels.length
      ? "<h3>관계</h3><ul class=\"wm-peek-rels\">" +
        rels
          .map(function (r) {
            var t = BF.findNode(r.targetId);
            return (
              "<li><strong>" +
              BF.escapeHtml(r.category || "관계") +
              "</strong> → " +
              BF.escapeHtml(t ? BF.displayName(t) : r.targetId) +
              "</li>"
            );
          })
          .join("") +
        "</ul>"
      : "<p class=\"wm-peek-empty\">이은 관계가 없습니다.</p>";
    return (
      (path ? "<p class=\"wm-peek-path\">" + BF.escapeHtml(path) + "</p>" : "") +
      (blocks || "<p class=\"wm-peek-empty\">속성 블럭이 없습니다.</p>") +
      relHtml
    );
  }

  function closePeek() {
    var dlg = BF.$("wmPeek");
    if (dlg) {
      dlg._peekId = null;
      if (dlg.open) dlg.close();
    }
  }

  BF.openMapPeek = function openMapPeek(id) {
    var node = BF.findNode(id);
    var dlg = BF.$("wmPeek");
    var body = BF.$("wmPeekBody");
    var title = BF.$("wmPeekTitle");
    if (!node || BF.isDeleted(node) || !dlg || !body) return;
    if (title) title.textContent = BF.displayName(node);
    body.innerHTML = peekHtml(node);
    dlg._peekId = node.id;
    if (typeof dlg.showModal === "function") dlg.showModal();
    else dlg.setAttribute("open", "");
    BF.setStatus("«" + BF.displayName(node) + "»");
  };

  BF.bootMapPeek = function bootMapPeek() {
    var dlg = BF.$("wmPeek");
    if (!dlg || dlg.dataset.bound === "1") return;
    dlg.dataset.bound = "1";
    var closeBtn = BF.$("wmPeekClose");
    var openBtn = BF.$("wmPeekOpen");
    if (closeBtn) closeBtn.addEventListener("click", closePeek);
    if (openBtn)
      openBtn.addEventListener("click", function () {
        var id = dlg._peekId;
        closePeek();
        if (!id || !BF.boardOpenRow) return;
        BF.state.mapOpen = false;
        BF.boardOpenRow(id);
      });
    dlg.addEventListener("click", function (e) {
      if (e.target === dlg) closePeek();
    });
  };

  BF.openMap = function openMap() {
    BF.state.mapOpen = !BF.state.mapOpen;
    if (BF.state.mapOpen) {
    BF.state.mapOpen = false;
    BF.state.pageId = null;
    }
    closePeek();
    BF.renderBoard();
    if (BF.persist) BF.persist();
    var btn = BF.$("btnMap");
    if (btn) btn.setAttribute("aria-pressed", BF.state.mapOpen ? "true" : "false");
  };

  BF.renderWorldMap = function renderWorldMap(root) {
    if (!root) return;
    BF.rebuildMaps();
    var modules = visibleModules();
    var relations = ((BF.state.maps && BF.state.maps.relations) || []).filter(function (e) {
      return modules.some(function (m) {
        return m.id === e.from;
      }) && modules.some(function (m) {
        return m.id === e.to;
      });
    });
    if (!modules.length) {
      root.innerHTML =
        '<p class="nt-empty">아직 올릴 모듈이 없습니다. 카드를 만들고 관계를 이으면 여기에 모입니다.</p>';
      return;
    }
    root.innerHTML =
      '<div class="wm-map-wrap">' +
      '<pre class="wm-map-code" aria-label="세계관 지도">' +
      mapCodeHtml(modules, relations) +
      "</pre></div>";
    if (root.dataset.boundMap === "1") return;
    root.dataset.boundMap = "1";
    root.addEventListener("click", function (e) {
      var btn = e.target.closest(".wm-map-link");
      if (!btn || !root.contains(btn)) return;
      BF.openMapPeek(btn.getAttribute("data-id"));
    });
  };

  BF.__mapViewCheck = function mapViewCheck() {
    var prevM = BF.state.maps;
    var prevR = BF.rebuildMaps;
    BF.rebuildMaps = function () {};
    BF.state.maps = {
      modules: [
        { id: "a", name: "하나", majorId: "00_CANON" },
        { id: "b", name: "둘", majorId: "00_CANON" },
      ],
      relations: [{ from: "a", to: "b", type: "적대" }],
    };
    var box = document.createElement("div");
    var prevQ = BF.state.query;
    BF.state.query = "";
    BF.renderWorldMap(box);
    BF.state.query = prevQ;
    BF.rebuildMaps = prevR;
    BF.state.maps = prevM;
    var ok =
      box.querySelectorAll(".wm-map-link").length === 2 &&
      (box.textContent || "").indexOf("적대") !== -1 &&
      !!box.querySelector(".wm-map-code");
    return { ok: ok, reason: ok ? "" : "코드맵이 안 그려짐" };
  };
})(window.WorldManager = window.WorldManager || {});
