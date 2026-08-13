/**
 * 검색·자기점검 (World Manager)
 */
(function (BF) {
  "use strict";

  BF.findNodeByLabel = function findNodeByLabel(raw) {
    const q = String(raw || "").trim();
    if (!q) return null;
    return (
      BF.state.nodes.find((n) => {
        if (!n || n.deletedAt) return false;
        if (BF.displayName(n) === q || n.name === q || n.nameKo === q || n.id === q) {
          return true;
        }
        return (n.aliases || []).some((a) => a === q);
      }) || null
    );
  };

  /** 모듈 › 그룹 › 설정 경로 (검색·카드 안내용) */
  BF.nodePathLabel = function nodePathLabel(node) {
    if (!node) return "";
    return BF.ancestorsOf(node.id)
      .map((n) => BF.displayName(n))
      .join(" › ");
  };

  /** 이 설정을 가리키는 연결 (누가 나를 잇는지) */
  BF.incomingRelations = function incomingRelations(nodeId) {
    const hits = [];
    if (!nodeId) return hits;
    BF.state.nodes.forEach((n) => {
      if (!n || n.deletedAt) return;
      (n.relationships || []).forEach((r, idx) => {
        if (r.targetId === nodeId) hits.push({ from: n, rel: r, idx });
      });
    });
    return hits;
  };

  /**
   * 이을 대상 검색 — 이름·별칭·id·경로. 관계 없어도 저장 가능(빈 배열).
   * ponytail: O(n) 훑기, 설정이 수천 개 넘으면 id 인덱스를 붙이면 됨
   */
  BF.searchLinkTargets = function searchLinkTargets(query, exceptId, limit) {
    const q = String(query || "").trim().toLowerCase();
    const lim = limit || 48;
    const out = [];
    BF.state.nodes.forEach((n) => {
      if (!n || n.deletedAt) return;
      if (exceptId && n.id === exceptId) return;
      if (n.level === "middle") return;
      // 빈 칸에서는 큰 갈래(16개)를 넣지 않음 — 검색어가 있을 때만
      if (n.level === "major" && !q) return;
      if (!q) {
        out.push(n);
        return;
      }
      const hay = [
        n.id,
        n.name,
        n.nameKo,
        n.synopsis,
        BF.nodePathLabel(n),
        ...(n.aliases || []),
        ...(n.blocks || []).map((b) => (b.category || "") + " " + (b.md || "")),
      ]
        .join(" ")
        .toLowerCase();
      if (hay.includes(q)) out.push(n);
    });
    out.sort((a, b) => {
      const ra = a.level === "major" ? 1 : 0;
      const rb = b.level === "major" ? 1 : 0;
      if (ra !== rb) return ra - rb;
      return BF.displayName(a).localeCompare(BF.displayName(b), "ko");
    });
    return out.slice(0, lim);
  };

  BF.__linkSearchCheck = function linkSearchCheck() {
    const sample = [
      { id: "a", level: "minor", name: "Harbor", nameKo: "항구", aliases: ["바닷가"], parentId: "g" },
      { id: "b", level: "minor", name: "Other", nameKo: "다른것", aliases: [], parentId: "g" },
      { id: "M", level: "major", nameKo: "큰갈래", parentId: null },
    ];
    const prev = BF.state.nodes;
    BF.state.nodes = sample;
    const hit = BF.searchLinkTargets("항구", "b", 10);
    const none = BF.searchLinkTargets("없는말", null, 10);
    const empty = BF.searchLinkTargets("", null, 10);
    BF.state.nodes = [
      { id: "dead", level: "minor", nameKo: "항구", deletedAt: "1", aliases: [], parentId: "g" },
      { id: "live", level: "minor", nameKo: "항구", aliases: [], parentId: "g" },
    ];
    const trashHidden = BF.searchLinkTargets("항구", null, 10);
    const byLabel = BF.findNodeByLabel("항구");
    BF.state.nodes = prev;
    const ok =
      hit.length === 1 &&
      hit[0].id === "a" &&
      none.length === 0 &&
      empty.length === 2 &&
      empty.every(function (n) {
        return n.level !== "major";
      }) &&
      trashHidden.length === 1 &&
      trashHidden[0].id === "live" &&
      byLabel &&
      byLabel.id === "live";
    return { ok, reason: ok ? "" : "검색이 이름·별칭을 못 찾음" };
  };

  BF.__mapCheck = function mapCheck() {
    const prevN = BF.state.nodes;
    const prevT = BF.state.taxonomies;
    BF.state.nodes = [
      { id: "00_A", parentId: null, level: "major", nameKo: "큰" },
      { id: "g", parentId: "00_A", level: "middle", nameKo: "묶음" },
      {
        id: "p1",
        parentId: "g",
        level: "minor",
        nameKo: "하나",
        blocks: [{ id: "b1", category: "외모", md: "키가 크다" }],
        relationships: [{ id: "r1", targetId: "p2", category: "적대", md: "" }],
      },
      { id: "p2", parentId: "g", level: "minor", nameKo: "둘", blocks: [], relationships: [] },
    ];
    BF.state.taxonomies = { attributes: [], relations: [] };
    BF.state.nodes.forEach(BF.normalizeNode);
    BF.rememberTaxonomy("attributes", "외모");
    BF.rememberTaxonomy("relations", "적대");
    BF.forgetTaxonomy("attributes", "외모");
    const forgotten = BF.state.taxonomies.attributes.indexOf("외모") === -1;
    BF.rememberTaxonomy("attributes", "외모");
    BF.rememberTaxonomy("attributes", "ㅁ");
    BF.rebuildMaps();
    const md = BF.state.nodes[2].markdown || "";
    const ok =
      forgotten &&
      BF.state.maps.modules.length === 2 &&
      BF.state.maps.relations.length === 1 &&
      BF.state.maps.relations[0].type === "적대" &&
      md.indexOf("## 외모") !== -1 &&
      BF.state.taxonomies.attributes.indexOf("외모") !== -1 &&
      BF.state.taxonomies.attributes.indexOf("ㅁ") === -1 &&
      BF.state.taxonomies.relations.indexOf("적대") !== -1;
    BF.state.nodes = prevN;
    BF.state.taxonomies = prevT;
    return { ok, reason: ok ? "" : "마크다운·지도·분류 기억이 어긋남" };
  };

  BF.__statsCheck = function statsCheck() {
    const prev = BF.state.nodes;
    BF.state.nodes = [
      { id: "M", level: "major", parentId: null, blocks: [], relationships: [] },
      { id: "G", level: "middle", parentId: "M", blocks: [{ id: "b1" }], relationships: [] },
      {
        id: "N",
        level: "minor",
        parentId: "G",
        blocks: [{ id: "b2" }, { id: "b3" }],
        relationships: [{ id: "r1", targetId: "G" }],
      },
      { id: "T", level: "minor", parentId: "G", deletedAt: 1, blocks: [{ id: "bx" }], relationships: [] },
    ];
    const c = BF.statCounts();
    BF.state.nodes = prev;
    const ok =
      c.majors === 1 &&
      c.groups === 1 &&
      c.modules === 1 &&
      c.attrs === 3 &&
      c.rels === 1 &&
      c.trash === 1;
    return { ok: ok, reason: ok ? "" : "하단 개수 집계가 어긋남" };
  };

  BF.__placeCheck = function placeCheck() {
    const snap = {
      nodes: BF.state.nodes,
      mapOpen: BF.state.mapOpen,
      trashOpen: BF.state.trashOpen,
      pageId: BF.state.pageId,
      boardModuleId: BF.state.boardModuleId,
      worldSlug: BF.state.worldSlug,
    };
    BF.state.nodes = [
      { id: "M", level: "major", parentId: null, nameKo: "큰갈래" },
      { id: "N", level: "minor", parentId: "M", nameKo: "카드" },
    ];
    BF.state.worldSlug = "";
    const list = BF.placeLabel();
    BF.state.worldSlug = "t";
    BF.state.mapOpen = true;
    BF.state.trashOpen = false;
    BF.state.pageId = null;
    BF.state.boardModuleId = "M";
    const map = BF.placeLabel();
    BF.state.mapOpen = false;
    BF.state.trashOpen = true;
    const trash = BF.placeLabel();
    BF.state.trashOpen = false;
    BF.state.pageId = "N";
    const page = BF.placeLabel();
    BF.state.pageId = null;
    const board = BF.placeLabel();
    BF.state.nodes = snap.nodes;
    BF.state.mapOpen = snap.mapOpen;
    BF.state.trashOpen = snap.trashOpen;
    BF.state.pageId = snap.pageId;
    BF.state.boardModuleId = snap.boardModuleId;
    BF.state.worldSlug = snap.worldSlug;
    const ok =
      list === "세계관 목록" &&
      map === "세계관 지도" &&
      trash === "휴지통" &&
      page === "카드" &&
      board === "큰갈래";
    return { ok: ok, reason: ok ? "" : "화면 위치 문구가 어긋남" };
  };

})(window.WorldManager = window.WorldManager || {});
