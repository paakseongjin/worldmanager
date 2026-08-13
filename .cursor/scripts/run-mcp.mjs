/**
 * Cursor MCP 크로스플랫폼 런처
 *
 * 왜:
 * - Windows Node 24+: `.cmd`(npx)를 shell 없이 spawn 하면 EINVAL
 * - Cursor GUI PATH에 uvx가 없을 수 있음 → 사용자 `.local/bin` 보강
 * - 클라우드(Linux)와 Yonsei PC에서 같은 mcp.json 사용
 *
 * 사용: node run-mcp.mjs <npx|uvx> <원래 args...>
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const [runner, ...runnerArgs] = process.argv.slice(2);

if (!runner || runnerArgs.length === 0) {
  console.error("Usage: node run-mcp.mjs <npx|uvx> <args...>");
  process.exit(1);
}

const isWin = process.platform === "win32";

/** Windows 사용자 로컬 bin / Node 경로를 PATH 앞에 붙임 */
function withAugmentedPath(env) {
  const parts = [];
  if (isWin) {
    const userProfile = env.USERPROFILE || "";
    parts.push(path.join(userProfile, ".local", "bin"));
    parts.push("C:\\Program Files\\nodejs");
  } else {
    const home = env.HOME || "";
    parts.push(path.join(home, ".local", "bin"));
  }
  const current = env.PATH || env.Path || "";
  const merged = [...parts, current].filter(Boolean).join(path.delimiter);
  return { ...env, PATH: merged, Path: merged };
}

/**
 * @returns {{ command: string, args: string[], shell: boolean }}
 */
function resolveSpawn(name, args, env) {
  if (name === "npx") {
    if (isWin) {
      // npx.cmd는 shell/cmd 경유 필수 (Node 보안 정책)
      const comspec = env.ComSpec || "cmd.exe";
      return {
        command: comspec,
        args: ["/d", "/s", "/c", "npx", ...args],
        shell: false,
      };
    }
    return { command: "npx", args, shell: false };
  }

  if (name === "uvx") {
    if (isWin) {
      const uvxExe = path.join(env.USERPROFILE || "", ".local", "bin", "uvx.exe");
      if (existsSync(uvxExe)) {
        return { command: uvxExe, args, shell: false };
      }
      const comspec = env.ComSpec || "cmd.exe";
      return {
        command: comspec,
        args: ["/d", "/s", "/c", "uvx", ...args],
        shell: false,
      };
    }
    const uvxHome = path.join(env.HOME || "", ".local", "bin", "uvx");
    if (existsSync(uvxHome)) {
      return { command: uvxHome, args, shell: false };
    }
    return { command: "uvx", args, shell: false };
  }

  console.error(`Unsupported runner: ${name} (use npx or uvx)`);
  process.exit(1);
}

const env = withAugmentedPath({
  ...process.env,
  ...(isWin
    ? {
        SystemRoot: process.env.SystemRoot || "C:\\Windows",
        PROGRAMFILES: process.env.PROGRAMFILES || "C:\\Program Files",
      }
    : {}),
});

const { command, args, shell } = resolveSpawn(runner, runnerArgs, env);

const child = spawn(command, args, {
  stdio: "inherit",
  env,
  cwd: process.cwd(),
  shell,
  windowsHide: true,
});

child.on("error", (err) => {
  console.error(`[run-mcp] failed to start ${command}:`, err.message);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
