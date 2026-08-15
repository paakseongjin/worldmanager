"""styles/*.css → styles.css 합본 + index.html ?v= 자동 갱신.

옛 CSS가 남는 이유:
1) styles/ 만 고치고 합본을 안 돌림
2) ?v= 숫자를 안 바꿔 브라우저·Pages 캐시가 옛 파일을 씀
3) index 인라인 <style>이 합본 뒤에서 옛 규칙을 덮어씀

이 스크립트가 1·2를 막고, stamp 시 인라인 충돌 블록을 제거한다.
"""
from __future__ import annotations

import hashlib
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "world-manager"
SRC = ROOT / "styles"
OUT = ROOT / "styles.css"
INDEX = ROOT / "index.html"

ORDER = [
    "tokens.css",
    "base.css",
    "shell.css",
    "form.css",
    "board.css",
    "write.css",
]

# 합본 뒤에 남아 옛 레이아웃을 덮던 인라인 블록 제거용
_INLINE_STYLE_RE = re.compile(
    r"\n?\s*<style>\s*\.app\s*\{.*?</style>\s*",
    re.DOTALL,
)
_ASSET_V_META_RE = re.compile(
    r'(<meta\s+name="wm-asset-v"\s+content=")[^"]*("\s*/>)',
    re.IGNORECASE,
)
_V_QUERY_RE = re.compile(r"(\.(?:css|js)\?v=)[A-Za-z0-9._-]+")


def bundle_css() -> str:
    parts = [
        "/* 자동 합본 — 원본은 styles/ (scripts/bundle-world-manager-css.py) */",
        "",
    ]
    for name in ORDER:
        text = (SRC / name).read_text(encoding="utf-8").strip()
        # 중괄호 안 닫히면 뒤 파일(board.css 등)이 앞 규칙 안으로 빨려 들어감
        if text.count("{") != text.count("}"):
            raise SystemExit(
                f"{name}: braces {{ {text.count('{')} }} {text.count('}')} — board 스타일이 통째로 무효화됨"
            )
        parts.append(f"/* ===== {name} ===== */")
        parts.append(text)
        parts.append("")
    css = "\n".join(parts) + "\n"
    OUT.write_text(css, encoding="utf-8")
    return css


def asset_fingerprint(css: str) -> str:
    """CSS + 진입 JS 내용으로 짧은 버전 문자열을 만든다."""
    h = hashlib.sha256()
    h.update(css.encode("utf-8"))
    for path in sorted((ROOT / "js").rglob("*.js")):
        h.update(path.read_bytes())
    # 8자이면 캐시 bust에 충분하고 URL이 짧다
    return h.hexdigest()[:8]


def stamp_index(version: str) -> None:
    html = INDEX.read_text(encoding="utf-8")
    # 인라인 옛 CSS 제거 (합본 shell/layout 이 정본)
    html2, n = _INLINE_STYLE_RE.subn("\n", html)
    if n:
        html = html2
    if not _ASSET_V_META_RE.search(html):
        raise SystemExit("index.html 에 wm-asset-v 메타가 없습니다")
    html = _ASSET_V_META_RE.sub(rf"\g<1>{version}\2", html)
    html = _V_QUERY_RE.sub(rf"\g<1>{version}", html)
    # 주석도 자동 갱신 안내로 맞춤
    html = re.sub(
        r"<!-- (?:Firefox 등 강한 캐시 무력화용 버전 —.*?|자산 버전:.*?)-->",
        "<!-- 자산 버전: bundle-world-manager-css.py 가 내용 해시로 자동 갱신 -->",
        html,
        count=1,
    )
    # 개발·Pages 중간 캐시 완화 (최종 무력화는 ?v= 해시)
    if 'http-equiv="Cache-Control"' not in html:
        html = html.replace(
            '<meta name="color-scheme"',
            '<meta http-equiv="Cache-Control" content="no-cache" />\n  '
            '<meta name="color-scheme"',
            1,
        )
    INDEX.write_text(html, encoding="utf-8")
    # 한 줄 자가 검사: 해시가 빠지면 옛 CSS 재발
    stamped = INDEX.read_text(encoding="utf-8")
    assert f"styles.css?v={version}" in stamped, "styles.css 버전 스탬프 실패"
    assert "<style>" not in stamped.lower() or ".app {" not in stamped, "인라인 .app 덮어쓰기 잔존"


def main() -> None:
    css = bundle_css()
    version = asset_fingerprint(css)
    stamp_index(version)
    print(f"wrote {OUT} ({OUT.stat().st_size} bytes)")
    print(f"stamped index.html ?v={version}")


if __name__ == "__main__":
    main()
