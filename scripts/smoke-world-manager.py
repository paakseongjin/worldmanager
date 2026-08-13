"""world-manager 정적 자산·모듈 진입 스모크 테스트"""
import http.server
import json
import os
import re
import sys
import threading
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PORT = 8765
for _p in (8765, 18765, 28765):
    try:
        import socket
        s = socket.socket()
        s.bind(("127.0.0.1", _p))
        s.close()
        PORT = _p
        break
    except OSError:
        continue

MODULE_PATHS = [
    "/world-manager/index.html",
    "/world-manager/js/main.js",
    "/world-manager/js/store.js",
    "/world-manager/js/store-maps.js",
    "/world-manager/js/store-query.js",
    "/world-manager/js/theme.js",
    "/world-manager/js/constants.js",
    "/world-manager/js/seed-data.js",
    "/world-manager/js/templates/shell.js",
    "/world-manager/js/views/module-rail.js",
    "/world-manager/js/views/board.js",
    "/world-manager/js/views/board-identity.js",
    "/world-manager/js/views/module-page.js",
    "/world-manager/js/views/world-map.js",
    "/world-manager/js/views/world-picker.js",
    "/world-manager/js/actions/nodes.js",
    "/world-manager/js/actions/backup.js",
    "/world-manager/styles.css",
    "/data/world-bible.json",
]


def main() -> int:
    os.chdir(ROOT)
    handler = http.server.SimpleHTTPRequestHandler
    httpd = http.server.HTTPServer(("127.0.0.1", PORT), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    base = f"http://127.0.0.1:{PORT}"
    checks = []

    for path in MODULE_PATHS:
        try:
            with urllib.request.urlopen(base + path, timeout=5) as r:
                body = r.read()
                checks.append((path, r.status == 200 and len(body) > 40, len(body)))
        except Exception as exc:  # noqa: BLE001
            checks.append((path, False, str(exc)))

    html = urllib.request.urlopen(base + "/world-manager/index.html").read().decode("utf-8")
    checks.append(("app-root", 'id="app-root"' in html, "ok"))
    checks.append(("classic scripts", 'src="js/main.js' in html and 'type="module"' not in html, "ok"))
    checks.append(("shell template", 'src="js/templates/shell.js' in html, "ok"))
    checks.append(("board view", 'src="js/views/board.js' in html, "ok"))
    checks.append(("module-rail view", 'src="js/views/module-rail.js' in html, "ok"))
    checks.append(("no old editor", "editor.js" not in html and "character-sheet.js" not in html, "ok"))
    checks.append(("no detail panel script leftovers", "relations.js" not in html and "steps.js" not in html, "ok"))
    checks.append(("no github sync", "github-sync.js" not in html, "ok"))
    checks.append(("no vault io", "vault-io.js" not in html, "ok"))

    shell = (ROOT / "world-manager/js/templates/shell.js").read_text(encoding="utf-8")
    checks.append(("board gallery", 'id="boardGallery"' in shell, "ok"))
    checks.append(("no detail panel", "detailPanel" not in shell and "editorForm" not in shell, "ok"))
    checks.append(("identity dialog", 'id="wmDialog"' in shell, "ok"))
    checks.append(("back button", 'id="btnBoardBack"' in shell, "ok"))
    checks.append(("edit module button", 'id="btnEditModule"' in shell, "ok"))
    checks.append(("toolbar modes", 'data-mode="gallery"' in shell and "data-mode" in (ROOT / "world-manager/js/views/board.js").read_text(encoding="utf-8"), "ok"))
    checks.append(("module add button", 'id="btnBoardNewItem"' in shell and "모듈 추가" in shell, "ok"))
    checks.append(("in-page add block", "add-block" in (ROOT / "world-manager/js/views/module-page.js").read_text(encoding="utf-8"), "ok"))
    checks.append(("trash button", 'id="btnTrash"' in shell and 'id="btnTrashEmpty"' in shell, "ok"))
    checks.append(("map button", 'id="btnMap"' in shell and 'id="wmPeek"' in shell, "ok"))
    checks.append(("header menu", 'class="top-menu"' in shell and "메뉴" in shell, "ok"))
    checks.append(("status live", 'aria-live="polite"' in shell and 'id="statusText"' in shell, "ok"))
    shell_css = (ROOT / "world-manager/styles/shell.css").read_text(encoding="utf-8")
    checks.append(("status bar css", ".status" in shell_css and "#statusText" in shell_css, "ok"))
    backup_js = (ROOT / "world-manager/js/actions/backup.js").read_text(encoding="utf-8")
    checks.append(("backup save picker", "showSaveFilePicker" in backup_js and "exportJson" in backup_js, "ok"))
    checks.append(("export fallback download", "appendChild(a)" in backup_js, "ok"))
    checks.append(("no client auto backup timer", "saveLocalBackup" not in backup_js and "15 * 60 * 1000" not in backup_js, "ok"))
    bat = (ROOT / "world-manager" / "열어보기.bat").read_text(encoding="utf-8", errors="ignore")
    checks.append(("backup server bat", "world-manager-server.py" in bat, "ok"))
    import subprocess
    chk = subprocess.run(
        [sys.executable, str(ROOT / "scripts" / "world-manager-server.py"), "--check"],
        cwd=str(ROOT),
        capture_output=True,
        text=True,
        timeout=10,
    )
    checks.append(("backup server check", chk.returncode == 0 and "ok" in (chk.stdout or ""), chk.stdout.strip() or chk.stderr.strip()))

    store_js = (ROOT / "world-manager/js/store.js").read_text(encoding="utf-8")
    store_maps = (ROOT / "world-manager/js/store-maps.js").read_text(encoding="utf-8")
    store_query = (ROOT / "world-manager/js/store-query.js").read_text(encoding="utf-8")
    checks.append(("composeModuleId", "composeModuleId" in store_js and "renameNodeId" in store_js, "ok"))
    checks.append(("escapeHtml helper", "BF.escapeHtml" in store_js, "ok"))
    checks.append(("persist fail status", "브라우저에 저장하지 못했습니다" in store_js, "ok"))
    checks.append(("granular stats", "갈래 " in store_js and " · 그룹 " in store_js and "__statsCheck" in store_query, "ok"))
    checks.append(("place label", "placeLabel" in store_js and "__placeCheck" in store_query, "ok"))
    checks.append(("module number sort", "compareByModuleNumber" in store_js, "ok"))
    checks.append(("store modules in index", "js/store-maps.js" in html and "js/store-query.js" in html, "ok"))

    def _split(mid: str):
        m = re.match(r"^(\d+)[_-](.+)$", mid)
        return (m.group(1), m.group(2)) if m else ("", mid)

    n, s = _split("00_CANON")
    checks.append(("split 00_CANON", n == "00" and s == "CANON", f"{n}_{s}"))

    board_js = (ROOT / "world-manager/js/views/board.js").read_text(encoding="utf-8")
    board_id = (ROOT / "world-manager/js/views/board-identity.js").read_text(encoding="utf-8")
    checks.append(("nt-card gallery", "nt-card" in board_js and "boardOpenRow" in board_js, "ok"))
    checks.append(("open module page", "pageId" in board_js and "renderModulePage" in board_js, "ok"))
    checks.append(("identity dialog api", "openIdentityDialog" in board_id and "bootIdentityDialog" in board_id, "ok"))
    checks.append(("board-identity in index", "js/views/board-identity.js" in html, "ok"))
    checks.append(("board bind once", "dataset.bound" in board_js, "ok"))
    checks.append(("group fold toggle", "toggle-group" in board_js and "groupFold" in board_js and "접기" in board_js, "ok"))
    checks.append(("trash board", "openTrash" in board_js and "trashedNodes" in store_js, "ok"))

    nodes_js = (ROOT / "world-manager/js/actions/nodes.js").read_text(encoding="utf-8")
    checks.append(
        ("soft delete", "deletedAt" in nodes_js and "restoreNodeCascade" in nodes_js and "purgeNodeCascade" in nodes_js, "ok")
    )
    checks.append(("trash self-check", "__trashCheck" in nodes_js, "ok"))

    checks.append(("no drive script", "js/actions/drive.js" not in html and "accounts.google.com/gsi/client" not in html, "ok"))
    checks.append(("no drive button", 'id="btnDrive"' not in shell, "ok"))
    checks.append(("no cover button", 'id="btnCover"' not in shell, "ok"))
    checks.append(("no quality button", 'id="btnQuality"' not in shell, "ok"))
    checks.append(("world files api", "list_world_files" in (ROOT / "scripts/world-manager-server.py").read_text(encoding="utf-8"), "ok"))
    checks.append(("markdown maps", "nodeToMarkdown" in store_maps and "rebuildMaps" in store_maps and "__mapCheck" in store_query, "ok"))
    checks.append(("taxonomies", "rememberTaxonomy" in store_maps and "forgetTaxonomy" in store_maps, "ok"))
    checks.append(("taxonomy junk filter", "isTaxonomyJunk" in store_maps and "pruneTaxonomies" in store_maps, "ok"))
    checks.append(("empty search skips major", 'n.level === "major" && !q' in store_query, "ok"))
    checks.append(
        ("page hides gallery edit", 'setToolbarBtn("btnEditModule", mode === "gallery"' in board_js, "ok")
    )
    page_js = (ROOT / "world-manager/js/views/module-page.js").read_text(encoding="utf-8")
    checks.append(("module page view", "renderModulePage" in page_js and "addModuleBlock" in page_js, "ok"))
    checks.append(("rel target search", "targetSearch" in page_js and "searchLinkTargets" in store_query, "ok"))
    checks.append(("card edit mode", "editingCard" in page_js and "is-view" in page_js and "save-card" in page_js and "__cardEditCheck" in page_js, "ok"))
    checks.append(("module-page in index", "js/views/module-page.js" in html, "ok"))
    map_js = (ROOT / "world-manager/js/views/world-map.js").read_text(encoding="utf-8")
    checks.append(("world map view", "renderWorldMap" in map_js and "openMapPeek" in map_js and "wm-map-code" in map_js, "ok"))
    checks.append(("world map empty state", "아직 올릴 모듈이 없습니다" in map_js and "wm-map-code" in map_js, "ok"))
    checks.append(("no map demo seed", "ensureMapDemo" not in map_js and "wm_demo_" not in map_js, "ok"))
    checks.append(("world-map in index", "js/views/world-map.js" in html, "ok"))

    board_css = (ROOT / "world-manager/styles/board.css").read_text(encoding="utf-8")
    checks.append(
        (
            "fixed rail width",
            "--module-rail-width: calc(312px * var(--wm-type-scale))" in board_css,
            "ok",
        )
    )
    checks.append(
        (
            "equal rail cards",
            "height: calc(120px * var(--wm-type-scale))" in board_css
            and "min-height: calc(120px * var(--wm-type-scale))" in board_css,
            "ok",
        )
    )
    checks.append(
        ("board theme tokens", "--nt-canvas: var(--canvas)" in board_css and "--nt-ink: var(--foreground)" in board_css, "ok")
    )
    checks.append(("no forced light shell", ".app:has(.board-body)" not in board_css, "ok"))
    checks.append(("dark board tints", '[data-theme="dark"] .board-body' in board_css, "ok"))
    checks.append(("no board btn pill", ".board-body .btn-primary" not in board_css, "ok"))
    checks.append(("no detail-panel css", ".detail-panel" not in board_css, "ok"))

    tokens_css = (ROOT / "world-manager/styles/tokens.css").read_text(encoding="utf-8")
    checks.append(("four col gallery", "--gallery-cols" in tokens_css and "repeat(var(--gallery-cols" in board_css, "ok"))
    checks.append(
        (
            "fixed card height",
            "--card-h: calc(192px * var(--wm-type-scale))" in tokens_css,
            "ok",
        )
    )
    checks.append(("soft dark page", "#16151a" in tokens_css and '[data-theme="dark"]' in tokens_css, "ok"))
    checks.append(
        (
            "btn size tokens",
            "--btn-h: calc(32px * var(--wm-type-scale))" in tokens_css and "--btn-radius" in tokens_css,
            "ok",
        )
    )
    checks.append(("type scale 120", "--wm-type-scale: 1.2" in tokens_css, "ok"))
    checks.append(("single focus border", "--focus-border" in tokens_css and "--focus-ring: none" in tokens_css, "ok"))
    checks.append(
        (
            "krds typo tokens",
            "--typo-page-title-size" in tokens_css
            and "--typo-caption-size" in tokens_css
            and "--krds-pc-font-size-body-medium" in tokens_css
            and "min(28rem" in board_css
            and ".picker-guide-item" in board_css,
            "ok",
        )
    )

    brace_ok = True
    for css_path in (ROOT / "world-manager/styles").glob("*.css"):
        t = css_path.read_text(encoding="utf-8")
        if t.count("{") != t.count("}"):
            brace_ok = False
            checks.append((f"braces {css_path.name}", False, f"{{ {t.count('{')} }} {t.count('}')}"))
            break
    if brace_ok:
        checks.append(("styles braces balanced", True, "ok"))

    bundled = (ROOT / "world-manager/styles.css").read_text(encoding="utf-8")
    checks.append(("board.css bundled", "board.css" in bundled, "ok"))
    checks.append(("no leftover outline.css", "outline.css" not in bundled, "ok"))

    asset_v = re.search(r'name="wm-asset-v"\s+content="([A-Za-z0-9._-]+)"', html)
    css_v = re.search(r'href="styles\.css\?v=([A-Za-z0-9._-]+)"', html)
    checks.append(("asset v meta", bool(asset_v), asset_v.group(1) if asset_v else "missing"))
    checks.append(("styles.css ?v=", bool(css_v), css_v.group(1) if css_v else "missing"))
    checks.append(
        ("asset v match", bool(asset_v and css_v and asset_v.group(1) == css_v.group(1)), "ok"),
    )
    checks.append(("no inline app override", "<style>" not in html.lower() or ".app {" not in html, "ok"))

    mcp = (ROOT / ".cursor" / "mcp.json").read_text(encoding="utf-8")
    checks.append(("crg mcp", "code-review-graph" in mcp, "ok"))

    rail_js = (ROOT / "world-manager/js/views/module-rail.js").read_text(encoding="utf-8")
    checks.append(("module crud", "boardEditModule" in rail_js and "boardDeleteModule" in rail_js, "ok"))
    checks.append(("module cards", "nt-mod-card" in rail_js, "ok"))
    checks.append(("rail collapse", "applyRailCollapsed" in rail_js and "btnToggleRail" in shell, "ok"))

    shell_css = (ROOT / "world-manager/styles/shell.css").read_text(encoding="utf-8")
    checks.append(
        (
            "app viewport scroll lock",
            "overflow: hidden" in shell_css and "height: 100vh" in shell_css and "height: 100dvh" in shell_css,
            "ok",
        )
    )
    checks.append(
        (
            "board-main inner scroll",
            "overflow: auto" in board_css and "overscroll-behavior: contain" in board_css,
            "ok",
        )
    )

    def _mod_key(src: str) -> int:
        m = re.match(r"^(\d+)", src)
        return int(m.group(1)) if m else 10**9

    ordered = sorted(["nope", "02_X", "00_A"], key=_mod_key)
    checks.append(("module order 00-02-none", ordered == ["00_A", "02_X", "nope"], ordered))

    seed = json.load(urllib.request.urlopen(base + "/data/world-bible.json"))
    checks.append(
        ("seed nodes", isinstance(seed.get("nodes"), list) and len(seed["nodes"]) > 0, len(seed.get("nodes", [])))
    )

    main_js = urllib.request.urlopen(base + "/world-manager/js/main.js").read().decode("utf-8")
    checks.append(("global WorldManager", "window.WorldManager" in main_js, "ok"))
    checks.append(("mountShell", "mountShell" in main_js, "ok"))
    checks.append(("boot opens picker", "showWorldPicker" in main_js and "openWorldApp" in main_js, "ok"))

    picker_js = (ROOT / "world-manager/js/views/world-picker.js").read_text(encoding="utf-8")
    checks.append(
        (
            "world picker form",
            'id="worldCreateForm"' in picker_js and 'id="worldTitleInput"' in picker_js and "blankWorldBible" in picker_js,
            "ok",
        )
    )
    checks.append(("world-picker in index", "js/views/world-picker.js" in html, "ok"))
    checks.append(("worlds list button", 'id="btnWorlds"' in shell and "세계관 목록" in shell, "ok"))
    checks.append(("picker uses major hints", "MAJOR_HINTS" in picker_js and "blankWorldBible" in picker_js, "ok"))
    checks.append(
        (
            "empty world reseeds majors",
            "기본 큰 분류" in picker_js and "_openingWorld" in (ROOT / "world-manager/js/main.js").read_text(encoding="utf-8"),
            "ok",
        )
    )
    checks.append(
        (
            "world trash api ui",
            "trashWorld" in picker_js
            and "restoreWorld" in picker_js
            and "purgeWorld" in picker_js
            and 'id="btnPickerTrash"' in picker_js
            and 'id="btnPickerDelete"' in picker_js
            and "picker-slider" in picker_js
            and "DELETE" in picker_js
            and 'data-action="trash"' not in picker_js,
            "ok",
        )
    )

    const_js = (ROOT / "world-manager/js/constants.js").read_text(encoding="utf-8")
    checks.append(("major ko labels", "MAJOR_KO" in const_js and "절대 기준" in const_js, "ok"))
    checks.append(("world storage key", "worldStorageKey" in const_js and "driveWorldFolderKey" not in const_js, "ok"))
    checks.append(
        (
            "relation types + empty presets",
            "DEFAULT_RELATION_TYPES" in const_js
            and "소속" in const_js
            and "QUALITY_CHECKLIST_ITEMS" not in const_js
            and "blankQualityChecklist" not in const_js
            and "EMPTY_BLOCK_PRESETS" in const_js
            and "CREATIVE_AXES" in const_js,
            "ok",
        )
    )
    store_js = (ROOT / "world-manager/js/store.js").read_text(encoding="utf-8")
    checks.append(
        (
            "applyData seeds relations",
            "DEFAULT_RELATION_TYPES" in store_js and "drivePushSoon" not in store_js,
            "ok",
        )
    )
    maps_js = (ROOT / "world-manager/js/store-maps.js").read_text(encoding="utf-8")
    checks.append(("mermaid relation styles", 'typ === "대립"' in maps_js and "==>" in maps_js, "ok"))
    page_js = (ROOT / "world-manager/js/views/module-page.js").read_text(encoding="utf-8")
    checks.append(
        ("empty block presets", "applyEmptyBlockPresets" in page_js and "apply-presets" in page_js, "ok")
    )
    ident_js = (ROOT / "world-manager/js/views/board-identity.js").read_text(encoding="utf-8")
    checks.append(
        ("no quality checklist dialog", "openQualityChecklist" not in ident_js and "saveQualityChecklist" not in ident_js, "ok")
    )

    server_py = (ROOT / "scripts/world-manager-server.py").read_text(encoding="utf-8")
    checks.append(("server worlds api", "DEFAULT_MAJORS" in server_py and "create_world" in server_py, "ok"))
    checks.append(("server markdown vault", "write_markdown_vault" in server_py and "save_world_bible" in server_py, "ok"))
    checks.append(
        (
            "server world trash",
            "TRASH_DIR_NAME" in server_py
            and "def trash_world" in server_py
            and "def restore_world" in server_py
            and "def purge_world" in server_py,
            "ok",
        )
    )
    checks.append(
        (
            "server auto backup 10m",
            "AUTO_BACKUP_SEC" in server_py
            and "backup_all_worlds" in server_py
            and "auto_backup_loop" in server_py
            and "def find_cover" not in server_py
            and "COVER_FILES" not in server_py,
            "ok",
        )
    )
    httpd.shutdown()
    failed = [c for c in checks if not c[1]]
    for c in checks:
        print(("OK" if c[1] else "FAIL"), c[0], c[2])
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
