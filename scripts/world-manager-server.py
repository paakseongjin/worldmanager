"""정적 파일 서버 + 세계관 폴더 저장 · 로컬 백업."""
import json
import re
import shutil
import sys
import tempfile
import threading
import time
from datetime import datetime, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse

ROOT = Path(__file__).resolve().parents[1]
WORLDS_DIR = ROOT / "data" / "worlds"
BACKUP_DIR = ROOT / "data" / "backups"
LEGACY_BIBLE = ROOT / "data" / "world-bible.json"
LATEST_NAME = "world-bible.json"
PREV_NAME = "world-bible.prev.json"
# 휴지통에 보낸 세계관 폴더 (목록·검색·열기에서 제외)
TRASH_DIR_NAME = "_trash"
MAX_BYTES = 8 * 1024 * 1024
SLUG_BAD = re.compile(r'[<>:"/\\|?*]')
AUTO_BACKUP_SEC = 10 * 60

# 새 세계관에 깔리는 큰 분류 (화면 constants.js 와 같게)
DEFAULT_MAJORS = [
    ("00_CANON", "절대 기준", "흔들면 안 되는 확정 규칙과 금지 사항"),
    ("01_COSMOLOGY", "우주론", "차원, 사후세계, 세계를 움직이는 힘"),
    ("02_MYTHOLOGY", "신화", "신, 창세, 예언. 누가 믿고 누가 부정하는지도"),
    ("03_MAGIC", "마법", "힘보다 규칙, 대가, 한계가 먼저"),
    ("04_WORLD", "세계", "지리와 기후가 문화와 무역을 만드는 방식"),
    ("05_RACES", "종족", "종족과 생물. 인간 복사판이 아닌 이유"),
    ("06_FACTIONS", "세력", "왕국, 교단, 길드. 권력과 갈등의 뿌리"),
    ("07_CHARACTERS", "인물", "인물 시트. 겉모습, 속마음, 이야기 순으로"),
    ("08_ITEMS", "물건", "누가 만들었고, 대가는 무엇인지"),
    ("09_LANGUAGE", "언어", "이름과 말의 규칙. 누가 어떤 말을 쓰는지"),
    ("10_HISTORY", "역사", "과거가 오늘을 흔드는 사건. 두세 세대 깊이"),
    ("11_RELIGION", "신앙", "일상 의식과 금기, 신앙이 권력에 미치는 영향"),
    ("12_TERMINOLOGY", "용어", "작위, 용어, 속어. 한 줄 정의"),
    ("13_TIMELINE", "연표", "언제, 무엇이, 왜. 시간 순 인과"),
    ("14_STORY", "이야기", "소설 사건. 세계관 설정과 칸을 나눔"),
    ("15_RELATIONSHIPS", "관계", "설정끼리 왜 이어지는지. 협력, 갈등, 비밀"),
]


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def slugify(title: str) -> str:
    s = SLUG_BAD.sub("-", (title or "").strip())
    s = re.sub(r"[\s.]+", "-", s)
    s = re.sub(r"-{2,}", "-", s).strip(".-")
    return s[:80] or "world"


def unique_slug(title: str, dest_root: Path | None = None) -> str:
    base = slugify(title)
    if base == TRASH_DIR_NAME:
        base = "world"
    root = dest_root or WORLDS_DIR
    slug = base
    n = 2
    while (root / slug).exists() or slug == TRASH_DIR_NAME:
        slug = "%s-%s" % (base, n)
        n += 1
    return slug


def trash_root(dest_root: Path | None = None) -> Path:
    root = dest_root or WORLDS_DIR
    p = root / TRASH_DIR_NAME
    p.mkdir(parents=True, exist_ok=True)
    return p


def world_dir(slug: str, dest_root: Path | None = None) -> Path:
    root = (dest_root or WORLDS_DIR).resolve()
    if not slug or slug in (".", "..", TRASH_DIR_NAME) or "/" in slug or "\\" in slug or SLUG_BAD.search(slug):
        raise ValueError("bad slug")
    p = (root / slug).resolve()
    if p.parent != root:
        raise ValueError("bad slug")
    return p


def trash_world_dir(slug: str, dest_root: Path | None = None) -> Path:
    root = trash_root(dest_root).resolve()
    if not slug or slug in (".", "..") or "/" in slug or "\\" in slug or SLUG_BAD.search(slug):
        raise ValueError("bad slug")
    p = (root / slug).resolve()
    if p.parent != root:
        raise ValueError("bad slug")
    return p


def _move_unique(src: Path, dest_parent: Path) -> Path:
    """폴더를 dest_parent 아래로 옮긴다. 이름 겹치면 -2, -3…"""
    name = src.name
    dest = dest_parent / name
    n = 2
    while dest.exists():
        dest = dest_parent / ("%s-%s" % (name, n))
        n += 1
    src.rename(dest)
    return dest


def write_json(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def _safe_name(raw: str, fallback: str = "note") -> str:
    s = SLUG_BAD.sub("-", str(raw or "").strip())
    s = re.sub(r"\s+", "-", s)
    s = re.sub(r"-{2,}", "-", s).strip(".-")
    return (s[:80] or fallback)


def _display_name(node: dict) -> str:
    return str(node.get("nameKo") or node.get("name") or node.get("id") or "제목 없음").strip()


def node_to_markdown(node: dict, by_id: dict) -> str:
    """화면 저장 내용을 읽기용 마크다운으로 옮긴다. (사용자가 md를 치는 화면이 아님)"""
    short = {
        "confirmed": "확정",
        "provisional": "잠정",
        "deferred": "보류",
        "speculation": "추측",
        "unknown": "모름",
        "forgotten": "잊힘",
        "false": "와전",
        "forbidden": "금기",
        "future_reveal": "비공개",
    }
    lines = ["# " + _display_name(node), ""]
    synopsis = str(node.get("synopsis") or "").strip()
    if synopsis:
        lines += ["> " + synopsis.replace("\n", " "), ""]
    for b in node.get("blocks") or []:
        if not isinstance(b, dict):
            continue
        cat = str(b.get("category") or "메모").strip() or "메모"
        st = short.get(str(b.get("canonStatus") or ""), "")
        head = cat + ((" 〔" + st + "〕") if st else "")
        body = str(b.get("md") or "").strip()
        lines += ["## " + head, "", body, ""]
    rels = [r for r in (node.get("relationships") or []) if isinstance(r, dict) and r.get("targetId")]
    if rels:
        lines += ["## 관계", ""]
        for r in rels:
            tid = str(r.get("targetId") or "")
            t = by_id.get(tid)
            name = _display_name(t) if t else tid
            cat = str(r.get("category") or "관계").strip() or "관계"
            lines.append("- [[" + name + "]] (" + cat + ")")
            note = str(r.get("md") or "").strip()
            if note:
                lines.append("  " + note.replace("\n", " "))
        lines.append("")
    nid = str(node.get("id") or "")
    card_st = short.get(str(node.get("canonStatus") or ""), str(node.get("canonStatus") or ""))
    lines += ["---", ""]
    if nid:
        lines.append("id: `" + nid + "`")
    if card_st:
        lines.append("신뢰도: " + card_st)
    created = str(node.get("createdAt") or "").strip()
    updated = str(node.get("updatedAt") or "").strip()
    if created:
        lines.append("추가: " + created)
    if updated:
        lines.append("고침: " + updated)
    lines.append("")
    return "\n".join(lines).strip() + "\n"


def write_markdown_vault(world_folder: Path, data: dict) -> int:
    """
    세계관 폴더 아래 markdown/ 에 모듈별 .md 를 다시 쓴다.
    ponytail: 매번 폴더를 비우고 다시 씀. 파일이 수천 개면 증분 갱신으로 바꾸면 됨.
    """
    md_root = world_folder / "markdown"
    if md_root.exists():
        for child in sorted(md_root.rglob("*"), reverse=True):
            if child.is_file():
                child.unlink()
            elif child.is_dir():
                try:
                    child.rmdir()
                except OSError:
                    pass
    md_root.mkdir(parents=True, exist_ok=True)

    nodes = [n for n in (data.get("nodes") or []) if isinstance(n, dict)]
    by_id = {str(n.get("id")): n for n in nodes if n.get("id")}
    alive = [n for n in nodes if not n.get("deletedAt")]
    written = 0

    def major_of(node: dict):
        cur = node
        guard = 0
        while cur and cur.get("parentId") and guard < 64:
            guard += 1
            p = by_id.get(str(cur.get("parentId")))
            if not p:
                break
            if p.get("level") == "major" or not p.get("parentId"):
                return p
            cur = p
        if cur and (cur.get("level") == "major" or not cur.get("parentId")):
            return cur
        return None

    for node in alive:
        nid = str(node.get("id") or "")
        if not nid:
            continue
        level = str(node.get("level") or "")
        label = _safe_name(_display_name(node), _safe_name(nid, "note"))
        file_stem = _safe_name(nid + "-" + label, nid)

        if level == "major" or not node.get("parentId"):
            path = md_root / (file_stem + ".md")
        else:
            maj = major_of(node)
            maj_dir = _safe_name(
                str((maj or {}).get("id") or "etc") + "-" + _display_name(maj or {"nameKo": "기타"}),
                "etc",
            )
            parent = by_id.get(str(node.get("parentId")))
            if level == "middle":
                path = md_root / maj_dir / (file_stem + ".md")
            elif parent and parent.get("level") == "middle":
                gname = _safe_name(
                    str(parent.get("id") or "group") + "-" + _display_name(parent),
                    "group",
                )
                path = md_root / maj_dir / gname / (file_stem + ".md")
            else:
                path = md_root / maj_dir / (file_stem + ".md")

        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(node_to_markdown(node, by_id), encoding="utf-8")
        written += 1

    title = str((data.get("meta") or {}).get("title") or world_folder.name)
    index_lines = [
        "# " + title,
        "",
        "이 폴더는 World Manager가 자동으로 남기는 기록입니다. 앱에서 고치면 여기 파일이 다시 맞춰집니다.",
        "",
        "## 큰 분류",
        "",
    ]
    for n in sorted(
        [x for x in alive if x.get("level") == "major" or not x.get("parentId")],
        key=lambda x: str(x.get("id") or ""),
    ):
        index_lines.append("- [[" + _display_name(n) + "]] (`" + str(n.get("id")) + "`)")
    index_lines.append("")
    (md_root / "README.md").write_text("\n".join(index_lines), encoding="utf-8")
    return written


def save_world_bible(folder: Path, data: dict) -> None:
    """JSON 최신본 + 마크다운 폴더를 같이 맞춘다.

    ponytail: 살아 있는 노드가 갑자기 많이 줄면 덮어쓰지 않는다.
    (빈 시드·브라우저 오작동으로 세계관이 날아가는 사고 방지)
    """
    latest = folder / LATEST_NAME
    if latest.is_file():
        try:
            old = json.loads(latest.read_text(encoding="utf-8"))
            old_n = [
                n
                for n in (old.get("nodes") or [])
                if isinstance(n, dict) and not n.get("deletedAt")
            ]
            new_n = [
                n
                for n in (data.get("nodes") or [])
                if isinstance(n, dict) and not n.get("deletedAt")
            ]
            # 예전 본문이 충분히 있고, 새 본문이 절반 미만이면 거절
            if len(old_n) >= 40 and len(new_n) < max(16, len(old_n) // 2):
                raise ValueError(
                    "refuse shrink bible: had %d alive nodes, got %d"
                    % (len(old_n), len(new_n))
                )
        except ValueError:
            raise
        except Exception:
            pass
    write_json(latest, data)
    write_markdown_vault(folder, data)


def rotate_backup(data: dict, dest_dir: Path) -> Path:
    """최신을 덮어 쓰고, 직전 파일은 prev 로 남겨 둔다."""
    dest_dir.mkdir(parents=True, exist_ok=True)
    latest = dest_dir / LATEST_NAME
    prev = dest_dir / PREV_NAME
    if latest.exists():
        if prev.exists():
            prev.unlink()
        latest.replace(prev)
    write_json(latest, data)
    return latest


def backup_all_worlds() -> int:
    """열린 세계관 폴더마다 최신 bible 을 backups/ 에 덮어쓴다."""
    if not WORLDS_DIR.exists():
        return 0
    n = 0
    for child in WORLDS_DIR.iterdir():
        if not child.is_dir() or child.name == TRASH_DIR_NAME:
            continue
        bible = child / LATEST_NAME
        if not bible.is_file():
            continue
        try:
            data = json.loads(bible.read_text(encoding="utf-8"))
            if not isinstance(data, dict) or not isinstance(data.get("nodes"), list):
                continue
            rotate_backup(data, child / "backups")
            n += 1
        except (OSError, UnicodeDecodeError, json.JSONDecodeError, TypeError, ValueError):
            continue
    return n


def auto_backup_loop() -> None:
    # ponytail: 단일 스레드 sleep 루프 — 서버 프로세스당 백업 하나면 충분
    while True:
        time.sleep(AUTO_BACKUP_SEC)
        try:
            n = backup_all_worlds()
            if n:
                sys.stderr.write("auto-backup: %s world(s)\n" % n)
        except Exception as exc:  # noqa: BLE001
            sys.stderr.write("auto-backup error: %s\n" % exc)


def blank_bible(title: str) -> dict:
    nodes = []
    for nid, ko, hint in DEFAULT_MAJORS:
        nodes.append(
            {
                "id": nid,
                "parentId": None,
                "level": "major",
                "name": nid,
                "nameKo": ko,
                "description": hint,
                "canonStatus": "confirmed",
                "aliases": [],
                "relationships": [],
                "blocks": [],
                "fields": {},
                "synopsis": hint,
            }
        )
    return {
        "meta": {
            "project": "World Manager",
            "title": title,
            "version": 1,
            "bibleRev": 2,
            "coreLine": "",
            "updatedAt": now_iso(),
        },
        "levels": [
            {"id": "major", "label": "대분류", "depth": 0},
            {"id": "middle", "label": "중분류", "depth": 1},
            {"id": "minor", "label": "소분류", "depth": 2},
            {"id": "detail", "label": "세부분류", "depth": 3},
        ],
        "canonStatuses": [
            "confirmed",
            "provisional",
            "deferred",
            "speculation",
            "unknown",
            "forgotten",
            "false",
            "forbidden",
            "future_reveal",
        ],
        "nodes": nodes,
        "taxonomies": {"attributes": [], "relations": []},
        "maps": {"modules": [], "groups": [], "relations": [], "mermaid": ""},
    }




def _world_entry(child: Path, trashed: bool = False) -> dict | None:
    bible = child / LATEST_NAME
    if not child.is_dir() or not bible.exists():
        return None
    title = child.name
    updated = ""
    data = None
    try:
        data = json.loads(bible.read_text(encoding="utf-8"))
        meta = data.get("meta") or {}
        title = str(meta.get("title") or title)
        updated = str(meta.get("updatedAt") or "")
    except (OSError, UnicodeDecodeError, json.JSONDecodeError, TypeError):
        pass
    majors = 0
    try:
        nodes = data.get("nodes") if isinstance(data, dict) else []
        majors = sum(1 for n in (nodes or []) if n.get("level") == "major" and not n.get("deletedAt"))
    except Exception:
        majors = 0
    return {
        "slug": child.name,
        "title": title,
        "updatedAt": updated,
        "majors": majors,
        "trashed": bool(trashed),
    }


def list_worlds(dest_root: Path | None = None, trashed: bool = False) -> list:
    root = dest_root or WORLDS_DIR
    scan = trash_root(root) if trashed else root
    if not scan.exists():
        return []
    out = []
    for child in sorted(scan.iterdir(), key=lambda p: p.name.lower()):
        if not trashed and child.name == TRASH_DIR_NAME:
            continue
        entry = _world_entry(child, trashed=trashed)
        if entry:
            out.append(entry)
    return out


def trash_world(slug: str, dest_root: Path | None = None) -> dict:
    src = world_dir(slug, dest_root)
    if not (src / LATEST_NAME).exists():
        raise FileNotFoundError("no world")
    dest = _move_unique(src, trash_root(dest_root))
    return {"ok": True, "slug": dest.name, "trashed": True}


def restore_world(slug: str, dest_root: Path | None = None) -> dict:
    src = trash_world_dir(slug, dest_root)
    if not (src / LATEST_NAME).exists():
        raise FileNotFoundError("no world")
    dest = _move_unique(src, dest_root or WORLDS_DIR)
    return {"ok": True, "slug": dest.name, "trashed": False}


def purge_world(slug: str, dest_root: Path | None = None) -> dict:
    """휴지통에 있는 세계관만 폴더째 완전 삭제."""
    src = trash_world_dir(slug, dest_root)
    if not src.exists():
        raise FileNotFoundError("no world")
    shutil.rmtree(src)
    return {"ok": True, "slug": slug, "purged": True}


def create_world(title: str, bible: dict | None = None, dest_root: Path | None = None) -> dict:
    title = str(title or "").strip()
    if not title:
        raise ValueError("title")
    root = dest_root or WORLDS_DIR
    root.mkdir(parents=True, exist_ok=True)
    slug = unique_slug(title, root)
    data = bible if isinstance(bible, dict) else blank_bible(title)
    if not isinstance(data.get("meta"), dict):
        data["meta"] = {}
    data["meta"]["title"] = title
    data["meta"]["worldSlug"] = slug
    data["meta"]["updatedAt"] = now_iso()
    if not isinstance(data.get("nodes"), list) or not data["nodes"]:
        data["nodes"] = blank_bible(title)["nodes"]
    folder = world_dir(slug, root)
    save_world_bible(folder, data)
    return {"ok": True, "slug": slug, "title": title, "file": "data/worlds/%s/%s" % (slug, LATEST_NAME)}


def list_world_files(folder: Path) -> list[str]:
    """세계관 폴더 안 파일 상대경로(posix)."""
    folder = folder.resolve()
    out: list[str] = []
    if not folder.is_dir():
        return out
    for p in folder.rglob("*"):
        if not p.is_file():
            continue
        rel = p.relative_to(folder).as_posix()
        # 숨김·임시 파일은 올리지 않음
        if any(part.startswith(".") for part in rel.split("/")):
            continue
        out.append(rel)
    out.sort()
    return out


def migrate_legacy(dest_root: Path | None = None) -> None:
    """예전에는 단일 world-bible.json 을 폴더로 자동 이관했다.
    지금은 첫 화면을 비워 두고, 사용자가 직접 «만들기»로 시작하도록 자동 생성하지 않는다."""
    return


def self_check() -> None:
    d = Path(tempfile.mkdtemp())
    worlds = d / "worlds"
    created = create_world("새벽 세계", None, worlds)
    folder = worlds / created["slug"]
    bible = json.loads((folder / LATEST_NAME).read_text(encoding="utf-8"))
    ids = [n["id"] for n in bible["nodes"]]
    if "00_CANON" not in ids or "15_RELATIONSHIPS" not in ids:
        raise SystemExit("default majors missing")
    if any(str(n["id"]).startswith("00_test_") for n in bible["nodes"]):
        raise SystemExit("test modules leaked into blank world")
    listed = list_worlds(worlds)
    if len(listed) != 1 or listed[0]["title"] != "새벽 세계":
        raise SystemExit("list worlds failed")
    trashed = trash_world(created["slug"], worlds)
    if list_worlds(worlds):
        raise SystemExit("trashed world still listed")
    if len(list_worlds(worlds, trashed=True)) != 1:
        raise SystemExit("trash list failed")
    restored = restore_world(trashed["slug"], worlds)
    if len(list_worlds(worlds)) != 1 or list_worlds(worlds, trashed=True):
        raise SystemExit("restore world failed")
    trash_world(restored["slug"], worlds)
    purge_world(restored["slug"], worlds)
    if list_worlds(worlds, trashed=True) or (trash_root(worlds) / restored["slug"]).exists():
        raise SystemExit("purge world failed")
    # 검사 뒤 다시 하나 만들어 마크다운 검사 이어감
    created = create_world("새벽 세계", None, worlds)
    folder = worlds / created["slug"]
    bible = json.loads((folder / LATEST_NAME).read_text(encoding="utf-8"))
    md_dir = folder / "markdown"
    if not md_dir.exists() or not (md_dir / "README.md").exists():
        raise SystemExit("markdown vault missing on create")
    major_mds = list(md_dir.glob("00_CANON*.md"))
    if not major_mds:
        raise SystemExit("major markdown missing")
    # 설정 카드 저장 후 md 가 생기는지
    bible["nodes"].append(
        {
            "id": "note_harbor",
            "parentId": "00_CANON",
            "level": "minor",
            "nameKo": "항구",
            "blocks": [{"id": "b1", "category": "개요", "md": "바닷가 마을"}],
            "relationships": [],
        }
    )
    save_world_bible(folder, bible)
    harbor = list(md_dir.rglob("*항구*.md")) + list(md_dir.rglob("*note_harbor*.md"))
    if not harbor:
        raise SystemExit("module markdown missing after save")
    body = harbor[0].read_text(encoding="utf-8")
    if "항구" not in body or "바닷가 마을" not in body:
        raise SystemExit("module markdown content mismatch")
    files = list_world_files(folder)
    if LATEST_NAME not in files or not any(f.startswith("markdown/") for f in files):
        raise SystemExit("list_world_files incomplete")
    rotate_backup({"nodes": [{"id": "t"}]}, d / "bak")
    rotate_backup({"nodes": [{"id": "u"}]}, d / "bak")
    prev = (d / "bak" / PREV_NAME).read_text(encoding="utf-8")
    if '"t"' not in prev:
        raise SystemExit("backup prev rotate failed")
    # 자동 백업이 세계관 폴더에서 최신을 덮어쓰는지
    probe = WORLDS_DIR / "_autobak_check"
    try:
        probe.mkdir(parents=True, exist_ok=True)
        write_json(probe / LATEST_NAME, {"nodes": [{"id": "a"}], "meta": {}})
        n = backup_all_worlds()
        if n < 1 or not (probe / "backups" / LATEST_NAME).is_file():
            raise SystemExit("auto backup missing")
    finally:
        shutil.rmtree(probe, ignore_errors=True)
    print("ok")


def _json_bytes(obj: dict, code: int = 200):
    raw = json.dumps(obj, ensure_ascii=False).encode("utf-8")
    return code, raw


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def log_message(self, fmt: str, *args) -> None:
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))

    def _send(self, code: int, raw: bytes, ctype: str = "application/json; charset=utf-8") -> None:
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def _read_json(self):
        try:
            n = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            n = 0
        if n <= 0:
            return {}
        if n > MAX_BYTES:
            return None
        raw = self.rfile.read(n)
        try:
            data = json.loads(raw.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            return None
        return data if isinstance(data, dict) else None

    def _parts(self) -> list[str]:
        path = unquote(self.path.split("?", 1)[0])
        return [p for p in path.split("/") if p]

    def do_GET(self) -> None:
        parts = self._parts()
        if parts == ["worlds"]:
            migrate_legacy()
            qs = parse_qs(urlparse(self.path).query)
            want_trash = (qs.get("trash") or ["0"])[0] in ("1", "true", "yes")
            code, raw = _json_bytes({"worlds": list_worlds(trashed=want_trash)})
            self._send(code, raw)
            return
        if len(parts) == 2 and parts[0] == "worlds":
            try:
                folder = world_dir(parts[1])
            except ValueError:
                self.send_error(400, "slug")
                return
            latest = folder / LATEST_NAME
            if not latest.exists():
                # 휴지통에만 있으면 열지 않음 (검색·목록과 동일하게 숨김)
                self.send_error(404, "no world")
                return
            # 예전 폴더에 markdown 이 없으면 JSON 기준으로 한 번 맞춰 둔다
            md_root = folder / "markdown"
            if not md_root.exists() or not any(md_root.glob("*.md")):
                try:
                    data = json.loads(latest.read_text(encoding="utf-8"))
                    if isinstance(data, dict) and isinstance(data.get("nodes"), list):
                        write_markdown_vault(folder, data)
                except (OSError, UnicodeDecodeError, json.JSONDecodeError, TypeError):
                    pass
            raw = latest.read_bytes()
            self._send(200, raw)
            return
        if len(parts) == 3 and parts[0] == "worlds" and parts[2] == "files":
            try:
                folder = world_dir(parts[1])
            except ValueError:
                self.send_error(400, "slug")
                return
            if not (folder / LATEST_NAME).exists():
                self.send_error(404, "no world")
                return
            code, raw = _json_bytes({"slug": parts[1], "files": list_world_files(folder)})
            self._send(code, raw)
            return
        if parts == ["backup"]:
            latest = BACKUP_DIR / LATEST_NAME
            if not latest.exists():
                self.send_error(404, "no backup")
                return
            raw = latest.read_bytes()
            self._send(200, raw)
            return
        super().do_GET()

    def do_POST(self) -> None:
        parts = self._parts()
        data = self._read_json()
        if data is None:
            self.send_error(400, "json")
            return
        if parts == ["worlds"]:
            title = str(data.get("title") or "").strip()
            bible = data.get("bible") if isinstance(data.get("bible"), dict) else None
            try:
                out = create_world(title, bible)
            except ValueError:
                self.send_error(400, "title")
                return
            code, raw = _json_bytes(out)
            self._send(code, raw)
            return
        if len(parts) == 3 and parts[0] == "worlds" and parts[2] == "trash":
            try:
                out = trash_world(parts[1])
            except ValueError:
                self.send_error(400, "slug")
                return
            except FileNotFoundError:
                self.send_error(404, "no world")
                return
            code, raw = _json_bytes(out)
            self._send(code, raw)
            return
        if len(parts) == 3 and parts[0] == "worlds" and parts[2] == "restore":
            try:
                out = restore_world(parts[1])
            except ValueError:
                self.send_error(400, "slug")
                return
            except FileNotFoundError:
                self.send_error(404, "no world")
                return
            code, raw = _json_bytes(out)
            self._send(code, raw)
            return
        if len(parts) == 3 and parts[0] == "worlds" and parts[2] == "backup":
            if not isinstance(data.get("nodes"), list):
                self.send_error(400, "nodes")
                return
            try:
                folder = world_dir(parts[1])
            except ValueError:
                self.send_error(400, "slug")
                return
            if not (folder / LATEST_NAME).exists():
                self.send_error(404, "no world")
                return
            rotate_backup(data, folder / "backups")
            save_world_bible(folder, data)
            code, raw = _json_bytes({"ok": True, "file": "data/worlds/%s/backups/%s" % (parts[1], LATEST_NAME)})
            self._send(code, raw)
            return
        if parts == ["backup"]:
            if not isinstance(data.get("nodes"), list):
                self.send_error(400, "nodes")
                return
            slug = str((data.get("meta") or {}).get("worldSlug") or "").strip()
            if slug:
                try:
                    folder = world_dir(slug)
                except ValueError:
                    self.send_error(400, "slug")
                    return
                folder.mkdir(parents=True, exist_ok=True)
                rotate_backup(data, folder / "backups")
                save_world_bible(folder, data)
                code, raw = _json_bytes({"ok": True, "file": "data/worlds/%s/backups/%s" % (slug, LATEST_NAME)})
                self._send(code, raw)
                return
            rotate_backup(data, BACKUP_DIR)
            code, raw = _json_bytes({"ok": True, "file": "data/backups/world-bible.json"})
            self._send(code, raw)
            return
        self.send_error(404)

    def do_DELETE(self) -> None:
        parts = self._parts()
        if len(parts) == 2 and parts[0] == "worlds":
            try:
                out = purge_world(parts[1])
            except ValueError:
                self.send_error(400, "slug")
                return
            except FileNotFoundError:
                self.send_error(404, "no world")
                return
            code, raw = _json_bytes(out)
            self._send(code, raw)
            return
        self.send_error(404)

    def do_PUT(self) -> None:
        parts = self._parts()
        data = self._read_json()
        if data is None or not isinstance(data.get("nodes"), list):
            self.send_error(400, "nodes")
            return
        if len(parts) != 2 or parts[0] != "worlds":
            self.send_error(404)
            return
        try:
            folder = world_dir(parts[1])
        except ValueError:
            self.send_error(400, "slug")
            return
        folder.mkdir(parents=True, exist_ok=True)
        if not isinstance(data.get("meta"), dict):
            data["meta"] = {}
        data["meta"]["worldSlug"] = parts[1]
        try:
            save_world_bible(folder, data)
        except ValueError as exc:
            code, raw = _json_bytes({"ok": False, "error": str(exc)})
            self._send(409, raw)
            return
        code, raw = _json_bytes(
            {
                "ok": True,
                "file": "data/worlds/%s/%s" % (parts[1], LATEST_NAME),
                "markdown": "data/worlds/%s/markdown/" % parts[1],
            }
        )
        self._send(code, raw)


def main() -> int:
    if "--check" in sys.argv:
        self_check()
        return 0
    port = 8777
    for arg in sys.argv[1:]:
        if arg.isdigit():
            port = int(arg)
    WORLDS_DIR.mkdir(parents=True, exist_ok=True)
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    migrate_legacy()
    threading.Thread(target=auto_backup_loop, name="wm-auto-backup", daemon=True).start()
    httpd = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    print("World Manager http://127.0.0.1:%s/world-manager/" % port, flush=True)
    print("auto-backup every %ss → data/worlds/<이름>/backups/" % AUTO_BACKUP_SEC, flush=True)
    httpd.serve_forever()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
