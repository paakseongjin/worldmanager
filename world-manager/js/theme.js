/**
 * 밝은/어두운 화면 전환
 * — 선택값은 브라우저에 기억, 없으면 OS 설정을 따름
 * — 버튼은 Lucide sun/moon 아이콘 (aria-label로 이름 유지)
 */
(function (BF) {
  "use strict";

  BF.THEME_KEY = "worldmanager-theme";

  // Lucide sun / moon (https://lucide.dev/icons/sun · moon)
  var ICON_SUN =
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>';
  var ICON_MOON =
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>';

  /** 저장된 값 또는 OS 선호 */
  BF.preferredTheme = function preferredTheme() {
    try {
      const saved = localStorage.getItem(BF.THEME_KEY);
      if (saved === "light" || saved === "dark") return saved;
    } catch (_) {
      /* 사생활 보호 모드 등 */
    }
    try {
      if (window.matchMedia("(prefers-color-scheme: dark)").matches) return "dark";
    } catch (_) {
      /* ignore */
    }
    return "light";
  };

  /** 테마 적용 + 아이콘 */
  BF.applyTheme = function applyTheme(mode) {
    const theme = mode === "dark" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem(BF.THEME_KEY, theme);
    } catch (_) {
      /* ignore */
    }
    const btn = BF.$("btnTheme");
    if (btn) {
      // 다크면 해(밝게), 라이트면 달(어둡게) — 다음에 바꿀 방향
      btn.innerHTML = theme === "dark" ? ICON_SUN : ICON_MOON;
      btn.setAttribute(
        "aria-label",
        theme === "dark" ? "밝은 화면으로 바꾸기" : "어두운 화면으로 바꾸기"
      );
      btn.setAttribute("aria-pressed", theme === "dark" ? "true" : "false");
      btn.setAttribute("data-tip", theme === "dark" ? "밝은 화면" : "어두운 화면");
    }
  };

  BF.toggleTheme = function toggleTheme() {
    const cur = document.documentElement.getAttribute("data-theme") || BF.preferredTheme();
    BF.applyTheme(cur === "dark" ? "light" : "dark");
  };

  BF.bootTheme = function bootTheme() {
    BF.applyTheme(BF.preferredTheme());
  };
})(window.WorldManager = window.WorldManager || {});
