"""[폐기] 옛 styles.css 라인 범위로 다시 쪼개는 일회성 스크립트.

현재 워크플로: styles/*.css 원본 → scripts/bundle-world-manager-css.py → styles.css
이 파일을 실행하면 합본이 @import 진입점으로 바뀌어 Firefox/file:// 환경이 깨질 수 있습니다.
"""
from __future__ import annotations
import sys

sys.exit(
    "폐기된 스크립트입니다. styles/ 파일을 고친 뒤 "
    "`python scripts/bundle-world-manager-css.py` 를 실행하세요."
)
