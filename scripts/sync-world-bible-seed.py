"""data/world-bible.json → world-manager/js/seed-data.js 동기화
(file://에서 fetch 없이 시드를 쓰기 위함)
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "data" / "world-bible.json"
OUT = ROOT / "world-manager" / "js" / "seed-data.js"


def main() -> None:
    data = json.loads(SRC.read_text(encoding="utf-8"))
    body = json.dumps(data, ensure_ascii=False)
    OUT.write_text(
        "/* 기본 세계관 시드 — file://에서도 동작 (JSON과 동기화: scripts/sync-world-bible-seed.py) */\n"
        f"window.WORLD_SEED = {body};\n",
        encoding="utf-8",
    )
    print(f"wrote {OUT} ({OUT.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
