/**
 * 지도·분류·마크다운 (World Manager)
 */
(function (BF) {
  "use strict";

  /** 큰 갈래(왼쪽 목록) 찾기 */
  BF.majorOf = function majorOf(node) {
    var cur = node;
    while (cur && cur.parentId) {
      var p = BF.findNode(cur.parentId);
      if (!p) break;
      if (p.level === "major" || !p.parentId) return p;
      cur = p;
    }
    return cur && (cur.level === "major" || !cur.parentId) ? cur : null;
  };

  /** 입력기 자모만 (ㅁ, ㅁㄴ …) — 완성된 한글·영문은 통과 */
  BF.isTaxonomyJunk = function isTaxonomyJunk(label) {
    var v = String(label || "").trim();
    if (!v) return true;
    return /^[\u3131-\u318E\u1100-\u11FF]+$/.test(v);
  };

  BF.pruneTaxonomies = function pruneTaxonomies() {
    if (!BF.state.taxonomies) BF.state.taxonomies = { attributes: [], relations: [] };
    ["attributes", "relations"].forEach(function (kind) {
      var list = BF.state.taxonomies[kind] || [];
      BF.state.taxonomies[kind] = list.filter(function (x) {
        return x && !BF.isTaxonomyJunk(x);
      });
    });
  };

  /** 분류 이름 기억 — 다음에 바로 고를 수 있게 */
  BF.rememberTaxonomy = function rememberTaxonomy(kind, label) {
    var v = String(label || "").trim();
    if (!v || (kind !== "attributes" && kind !== "relations")) return;
    if (BF.isTaxonomyJunk(v)) return;
    if (!BF.state.taxonomies) BF.state.taxonomies = { attributes: [], relations: [] };
    var list = BF.state.taxonomies[kind] || [];
    if (list.indexOf(v) === -1) list.push(v);
    BF.state.taxonomies[kind] = list;
  };

  /** 등록된 분류 지우기 (블럭 내용은 그대로) */
  BF.forgetTaxonomy = function forgetTaxonomy(kind, label) {
    var v = String(label || "").trim();
    if (!v || !BF.state.taxonomies || !BF.state.taxonomies[kind]) return;
    BF.state.taxonomies[kind] = BF.state.taxonomies[kind].filter(function (x) {
      return x !== v;
    });
  };

  BF.taxonomyList = function taxonomyList(kind) {
    return ((BF.state.taxonomies && BF.state.taxonomies[kind]) || []).slice().sort(function (a, b) {
      return a.localeCompare(b, "ko");
    });
  };

  /** 모듈 하나를 마크다운으로 */
  BF.nodeToMarkdown = function nodeToMarkdown(node) {
    if (!node) return "";
    var lines = ["# " + BF.displayName(node), ""];
    if (node.synopsis) {
      lines.push("> " + String(node.synopsis).replace(/\n/g, " "), "");
    }
    (node.blocks || []).forEach(function (b) {
      var cat = String(b.category || "메모").trim() || "메모";
      lines.push("## " + cat, "", String(b.md || "").trim(), "");
    });
    var rels = (node.relationships || []).filter(function (r) {
      return r.targetId;
    });
    if (rels.length) {
      lines.push("## 관계", "");
      rels.forEach(function (r) {
        var t = BF.findNode(r.targetId);
        var name = t ? BF.displayName(t) : r.targetId;
        var cat = String(r.category || "관계").trim() || "관계";
        lines.push("- [[" + name + "]] (" + cat + ")");
        if (r.md) lines.push("  " + String(r.md).trim().replace(/\n/g, " "));
      });
      lines.push("");
    }
    return lines.join("\n").trim() + "\n";
  };

  function normalizeRel(r) {
    if (!r.id) r.id = BF.uid("rel");
    if (!r.category && r.type) r.category = r.type;
    if (r.md == null) r.md = r.note || r.label || "";
    return r;
  }

  /** 옛 데이터도 블럭·마크다운 형태로 맞춤 */
  BF.normalizeNode = function normalizeNode(node) {
    if (!node) return node;
    var now = new Date().toISOString();
    // 신뢰도·날짜는 처음 한 번만 채움 (매번 덮어쓰지 않음)
    if (!node.canonStatus) node.canonStatus = "provisional";
    if (!node.createdAt) node.createdAt = node.updatedAt || now;
    if (!node.updatedAt) node.updatedAt = node.createdAt;
    if (!Array.isArray(node.blocks)) node.blocks = [];
    if (!node.blocks.length && (node.description || node.synopsis)) {
      node.blocks.push({
        id: BF.uid("block"),
        category: "개요",
        md: [node.synopsis, node.description].filter(Boolean).join("\n\n"),
        canonStatus: node.canonStatus || "provisional",
      });
    }
    if (!Array.isArray(node.relationships)) node.relationships = [];
    node.relationships = node.relationships.map(normalizeRel);
    node.blocks.forEach(function (b) {
      if (!b.id) b.id = BF.uid("block");
      if (b.md == null) b.md = b.body || b.value || "";
      if (!b.category) b.category = b.key || "메모";
      if (!b.canonStatus) b.canonStatus = node.canonStatus || "provisional";
    });
    node.markdown = BF.nodeToMarkdown(node);
    return node;
  };

  /** 화면용 짧은 신뢰도 이름 */
  BF.canonShort = function canonShort(status) {
    var key = status || "unknown";
    return (BF.CANON_SHORT && BF.CANON_SHORT[key]) || key;
  };

  /** 카드 날짜를 사람이 읽기 쉽게 */
  BF.formatStamp = function formatStamp(iso) {
    if (!iso) return "—";
    try {
      var d = new Date(iso);
      if (isNaN(d.getTime())) return String(iso).slice(0, 10);
      return d.toLocaleString("ko-KR", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (e) {
      return String(iso).slice(0, 16);
    }
  };

  function mermaidSafe(id) {
    return String(id || "n").replace(/[^A-Za-z0-9_]/g, "_");
  }

  /** 관계·모듈 지도 — persist 때마다 다시 그림 */
  BF.rebuildMaps = function rebuildMaps() {
    var alive = BF.state.nodes.filter(function (n) {
      return !n.deletedAt;
    });
    var modules = alive
      .filter(function (n) {
        return n.level === "minor" || n.level === "detail";
      })
      .map(function (n) {
        var maj = BF.majorOf(n);
        return {
          id: n.id,
          name: BF.displayName(n),
          groupId: n.parentId,
          majorId: maj ? maj.id : null,
          categories: (n.blocks || [])
            .map(function (b) {
              return b.category;
            })
            .filter(Boolean),
        };
      });
    var groups = alive
      .filter(function (n) {
        return n.level === "middle";
      })
      .map(function (n) {
        var maj = BF.majorOf(n);
        return { id: n.id, name: BF.displayName(n), majorId: maj ? maj.id : null };
      });
    var relations = [];
    alive.forEach(function (n) {
      (n.relationships || []).forEach(function (r) {
        if (!r.targetId) return;
        var t = BF.findNode(r.targetId);
        if (!t || t.deletedAt) return;
        relations.push({
          from: n.id,
          to: r.targetId,
          type: String(r.category || "관계").trim() || "관계",
        });
      });
    });
    var lines = ["graph LR"];
    modules.forEach(function (m) {
      lines.push("  " + mermaidSafe(m.id) + '["' + String(m.name).replace(/"/g, "'") + '"]');
    });
    relations.forEach(function (e) {
      var typ = String(e.type || "관계").replace(/\|/g, "/");
      var arrow = "-->";
      // 관계 타입별 선 모양 (mermaid graph)
      if (typ === "대립") arrow = "-.->";
      else if (typ === "원인") arrow = "==>";
      else if (typ === "파생") arrow = "-.->";
      else if (typ === "제약") arrow = "--x";
      else if (typ === "소속") arrow = "-->";
      lines.push(
        "  " + mermaidSafe(e.from) + " " + arrow + "|" + typ + "| " + mermaidSafe(e.to)
      );
    });
    BF.state.maps = {
      modules: modules,
      groups: groups,
      relations: relations,
      mermaid: lines.join("\n") + "\n",
    };
  };

})(window.WorldManager = window.WorldManager || {});
