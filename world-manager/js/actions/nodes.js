/**
 * 노트 공통 만들기·휴지통·완전삭제
 */
(function (BF) {
  "use strict";

  BF.blankNode = function blankNode(partial) {
    return Object.assign(
      {
        id: BF.uid("note"),
        parentId: null,
        level: "minor",
        name: "",
        nameKo: "",
        description: "",
        synopsis: "",
        canonStatus: "provisional",
        aliases: [],
        relationships: [],
        blocks: [],
        markdown: "",
        fields: {},
        deletedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      partial || {}
    );
  };

  /** 카드 수정 시각만 갱신 (저장 시마다 전 카드 시간을 건드리지 않음) */
  BF.touchNode = function touchNode(node) {
    if (!node) return;
    var now = new Date().toISOString();
    if (!node.createdAt) node.createdAt = now;
    node.updatedAt = now;
  };

  function collectTree(id) {
    const kill = new Set();
    const walk = (nid) => {
      kill.add(nid);
      BF.childrenOf(nid, { all: true }).forEach((c) => walk(c.id));
    };
    walk(id);
    return kill;
  }

  function stampDeleted(kill) {
    const now = new Date().toISOString();
    BF.state.nodes.forEach((n) => {
      if (kill.has(n.id) && !n.deletedAt) n.deletedAt = now;
    });
  }

  /**
   * 휴지통으로 보냄 (아직 완전 삭제가 아님)
   * @returns {boolean} 보냈으면 true
   */
  BF.deleteNodeCascade = function deleteNodeCascade(id) {
    const node = BF.findNode(id);
    if (!node || node.deletedAt) return false;

    const kids = BF.descendantsOf(id).filter((n) => !n.deletedAt);
    const label = BF.LEVELS[node.level] || "설정";
    // 아래에 내용이 있을 때만 확인. 빈 그룹·빈 카드는 바로 휴지통 (되돌리기 가능)
    if (kids.length) {
      const ok = confirm(
        `「${BF.displayName(node)}」(${label}) 아래에 ${kids.length}개가 있습니다.\n휴지통으로 보낼까요?`
      );
      if (!ok) return false;
    }

    const kill = collectTree(id);
    stampDeleted(kill);

    if (kill.has(BF.state.selectedId)) BF.state.selectedId = node.parentId || null;
    if (kill.has(BF.state.draftParentId)) {
      BF.state.draftParentId = node.parentId || null;
    }
    if (kill.has(BF.state.boardModuleId)) {
      BF.state.boardModuleId = node.parentId || null;
    }
    if (kill.has(BF.state.pageId)) BF.state.pageId = null;
    BF.persist();
    return true;
  };

  /** 휴지통에서 되돌림 (아래 설정도 함께) */
  BF.restoreNodeCascade = function restoreNodeCascade(id) {
    const node = BF.findNode(id);
    if (!node || !node.deletedAt) return false;
    const kill = collectTree(id);
    BF.state.nodes.forEach((n) => {
      if (kill.has(n.id)) n.deletedAt = null;
    });
    BF.persist();
    return true;
  };

  /**
   * 이 컴퓨터 저장에서 완전히 지움
   * ponytail: 예전에 PC에 받아 둔 JSON 파일 기록은 여기선 못 지움
   */
  BF.purgeNodeCascade = function purgeNodeCascade(id) {
    const node = BF.findNode(id);
    if (!node) return false;
    const kids = BF.descendantsOf(id);
    const label = BF.LEVELS[node.level] || "설정";
    const extra = kids.length ? `\n아래 ${kids.length}개도 함께 사라집니다.` : "";
    if (
      !confirm(
        `「${BF.displayName(node)}」(${label})을(를) 완전히 지울까요?${extra}\n되돌릴 수 없습니다.`
      )
    ) {
      return false;
    }
    const kill = collectTree(id);
    BF.state.nodes = BF.state.nodes.filter((n) => !kill.has(n.id));
    BF.state.nodes.forEach((n) => {
      n.relationships = (n.relationships || []).filter((r) => !kill.has(r.targetId));
    });
    if (kill.has(BF.state.selectedId)) BF.state.selectedId = null;
    if (kill.has(BF.state.draftParentId)) BF.state.draftParentId = null;
    if (kill.has(BF.state.boardModuleId)) BF.state.boardModuleId = null;
    if (kill.has(BF.state.pageId)) BF.state.pageId = null;
    BF.persist();
    return true;
  };

  /** 휴지통 전부 완전 삭제 */
  BF.purgeTrash = function purgeTrash() {
    const list = BF.trashedNodes();
    if (!list.length) return false;
    if (!confirm(`휴지통 ${list.length}개를 완전히 지울까요?\n되돌릴 수 없습니다.`)) return false;
    const kill = new Set(list.map((n) => n.id));
    BF.state.nodes = BF.state.nodes.filter((n) => !kill.has(n.id));
    BF.state.nodes.forEach((n) => {
      n.relationships = (n.relationships || []).filter((r) => !kill.has(r.targetId));
    });
    BF.persist();
    return true;
  };

  // 휴지통 로직이 깨지면 바로 실패
  BF.__trashCheck = function trashCheck() {
    const prev = BF.state.nodes;
    BF.state.nodes = [
      { id: "a", parentId: null, level: "major", nameKo: "A" },
      { id: "b", parentId: "a", level: "middle", nameKo: "B" },
    ];
    stampDeleted(collectTree("a"));
    const hidden = BF.childrenOf("a").length === 0 && BF.trashedNodes().length === 2;
    BF.state.nodes.forEach((n) => {
      n.deletedAt = null;
    });
    const restored = BF.childrenOf("a").length === 1;
    BF.state.nodes = BF.state.nodes.filter((n) => n.id !== "b");
    const purged = !BF.findNode("b") && !!BF.findNode("a");
    BF.state.nodes = prev;
    const ok = hidden && restored && purged;
    return { ok, reason: ok ? "" : "휴지통 보내기·되돌리기·완전삭제가 어긋남" };
  };
})(window.WorldManager = window.WorldManager || {});
