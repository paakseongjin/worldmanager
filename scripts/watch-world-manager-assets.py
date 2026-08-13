"""styles/·js/ 변경을 감시해 합본·?v= 스탬프를 즉시 다시 돌린다.

로컬 실시간 반영용. Ctrl+C 로 종료.
사용: python scripts/watch-world-manager-assets.py
"""
from __future__ import annotations

import importlib.util
import time
from pathlib import Path

_BUNDLE = Path(__file__).resolve().parent / "bundle-world-manager-css.py"
_spec = importlib.util.spec_from_file_location("bundle_wm", _BUNDLE)
_mod = importlib.util.module_from_spec(_spec)
assert _spec.loader is not None
_spec.loader.exec_module(_mod)

bundle_and_stamp = _mod.main
ROOT = _mod.ROOT
POLL_SEC = 0.6


def fingerprint_sources() -> tuple[tuple[str, int, int], ...]:
    """경로·크기·mtime 으로 변경만 감지한다 (가벼움)."""
    items: list[tuple[str, int, int]] = []
    for base in (ROOT / "styles", ROOT / "js"):
        for path in sorted(base.rglob("*")):
            if not path.is_file():
                continue
            if path.suffix.lower() not in {".css", ".js"}:
                continue
            st = path.stat()
            items.append((str(path.relative_to(ROOT)), st.st_size, int(st.st_mtime_ns)))
    return tuple(items)


def main() -> None:
    print("watching world-manager/styles + js — Ctrl+C to stop")
    last = None
    while True:
        cur = fingerprint_sources()
        if cur != last:
            bundle_and_stamp()
            last = cur
        time.sleep(POLL_SEC)


if __name__ == "__main__":
    main()
