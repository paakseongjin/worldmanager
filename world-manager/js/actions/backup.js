/**
 * JSON 백업 — «백업 저장»은 경로 선택, 자동 백업은 서버가 10분마다 담당
 */
(function (BF) {
  "use strict";

  function payload() {
    return BF.biblePayload
      ? BF.biblePayload()
      : {
          meta: BF.state.meta,
          canonStatuses: BF.state.canonStatuses,
          nodes: BF.state.nodes,
        };
  }

  function suggestedName() {
    var slug = (BF.state && BF.state.worldSlug) || "world";
    return slug + "-world-bible.json";
  }

  function downloadFallback(text) {
    var blob = new Blob([text], { type: "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = suggestedName();
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
  }

  /** 경로 창으로 고른 위치에 저장 (미지원 브라우저는 다운로드) */
  BF.exportJson = async function exportJson() {
    var text = JSON.stringify(payload(), null, 2);
    if (typeof window.showSaveFilePicker === "function") {
      try {
        var handle = await window.showSaveFilePicker({
          suggestedName: suggestedName(),
          types: [
            {
              description: "JSON",
              accept: { "application/json": [".json"] },
            },
          ],
        });
        var writable = await handle.createWritable();
        await writable.write(text);
        await writable.close();
        BF.setStatus("선택한 위치에 백업을 저장했습니다.");
        return;
      } catch (err) {
        if (err && err.name === "AbortError") {
          BF.setStatus("백업 저장을 취소했습니다.");
          return;
        }
      }
    }
    downloadFallback(text);
    BF.setStatus("이 브라우저에서는 파일 다운로드로 저장했습니다.");
  };

  BF.importJson = async function importJson(file) {
    if (!file) return;
    if (
      !confirm(
        "지금 화면에 있는 설정을 이 백업 파일로 바꿀까요?\n\n바꾸기 전에 «백업 저장»으로 받아 두는 것이 안전합니다."
      )
    ) {
      BF.setStatus("백업 불러오기를 취소했습니다.");
      return;
    }
    const prev = BF.readStore(BF.worldStorageKey ? BF.worldStorageKey() : BF.STORAGE_KEY);
    try {
      const parsed = JSON.parse(await file.text());
      if (!parsed || !Array.isArray(parsed.nodes)) {
        throw new Error("nodes 배열이 없습니다");
      }
      BF.applyData(parsed);
      if (BF.refreshAll) BF.refreshAll();
      BF.setStatus("백업을 불러왔습니다.");
    } catch (err) {
      if (prev) {
        try {
          BF.applyData(JSON.parse(prev));
          if (BF.refreshAll) BF.refreshAll();
        } catch (_) {
          /* 롤백도 실패하면 아래 안내만 */
        }
      }
      alert("백업 파일을 읽지 못했습니다. 이전 내용으로 되돌렸습니다.");
      console.error(err);
    }
  };
})(window.WorldManager = window.WorldManager || {});
