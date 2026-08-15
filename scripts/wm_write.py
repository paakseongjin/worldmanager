"""설정 글 보정 — OpenRouter / Bytez, 하루 토큰 한도."""
from __future__ import annotations

import json
import os
import urllib.error
import urllib.parse
import urllib.request
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SECRETS = ROOT / "data" / ".secrets.json"
QUOTA = ROOT / "data" / "write-quota.json"
DEFAULT_LIMIT = 30000
CTX_CHARS = 12000
OR_URL = "https://openrouter.ai/api/v1/chat/completions"
BYTEZ_URL = "https://api.bytez.com/models/v2/"
OR_DEFAULT = "openai/gpt-oss-20b:free"
BYTEZ_LIST = "https://api.bytez.com/models/v2/list/models"
# 계정 카탈로그에 있을 때만 이 순서로 고른다.
BYTEZ_CHAIN = (
    "Qwen/Qwen3-4B",
    "Qwen/Qwen2.5-7B-Instruct",
    "meta-llama/Llama-3.1-8B-Instruct",
    "mistralai/Mistral-7B-Instruct-v0.2",
    "mistralai/Mixtral-8x7B-Instruct-v0.1",
)
BYTEZ_DEFAULT = BYTEZ_CHAIN[0]


def load_dotenv() -> None:
    path = ROOT / ".env"
    if not path.is_file():
        return
    for line in path.read_text(encoding="utf-8-sig").splitlines():
        s = line.strip()
        if not s or s.startswith("#") or "=" not in s:
            continue
        k, v = s.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


def _secrets() -> dict:
    if not SECRETS.is_file():
        return {}
    try:
        data = json.loads(SECRETS.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    return data if isinstance(data, dict) else {}


def save_secrets(openrouter: str | None, bytez: str | None) -> dict:
    cur = _secrets()
    if openrouter is not None:
        cur["openrouter"] = openrouter.strip()
    if bytez is not None:
        cur["bytez"] = bytez.strip()
    SECRETS.parent.mkdir(parents=True, exist_ok=True)
    SECRETS.write_text(json.dumps(cur, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return status()


def _key(name: str) -> str:
    sec = _secrets()
    if name == "openrouter":
        return (os.environ.get("OPENROUTER_API_KEY") or str(sec.get("openrouter") or "")).strip()
    return (
        os.environ.get("BYTEZ_KEY")
        or os.environ.get("BYTEZ_API_KEY")
        or str(sec.get("bytez") or "")
    ).strip()


def daily_limit() -> int:
    try:
        n = int(os.environ.get("WRITE_DAILY_TOKENS") or DEFAULT_LIMIT)
    except ValueError:
        n = DEFAULT_LIMIT
    return max(1000, n)


def _quota() -> dict:
    today = date.today().isoformat()
    data = {"day": today, "used": 0, "limit": daily_limit()}
    if QUOTA.is_file():
        try:
            old = json.loads(QUOTA.read_text(encoding="utf-8"))
            if isinstance(old, dict) and old.get("day") == today:
                data["used"] = int(old.get("used") or 0)
        except (OSError, json.JSONDecodeError, TypeError, ValueError):
            pass
    data["limit"] = daily_limit()
    return data


def _write_quota(data: dict) -> None:
    QUOTA.parent.mkdir(parents=True, exist_ok=True)
    QUOTA.write_text(json.dumps(data, ensure_ascii=False) + "\n", encoding="utf-8")


def remaining() -> int:
    q = _quota()
    return max(0, int(q["limit"]) - int(q["used"]))


def add_usage(tokens: int) -> dict:
    q = _quota()
    q["used"] = int(q["used"]) + max(0, int(tokens))
    _write_quota(q)
    q["remaining"] = max(0, int(q["limit"]) - int(q["used"]))
    return q


def status() -> dict:
    q = _quota()
    return {
        "openrouter": bool(_key("openrouter")),
        "bytez": bool(_key("bytez")),
        "limit": q["limit"],
        "used": q["used"],
        "remaining": max(0, int(q["limit"]) - int(q["used"])),
        "orModel": OR_DEFAULT,
        "bytezModel": BYTEZ_DEFAULT,
        "bytezChain": list(BYTEZ_CHAIN),
    }


def bible_excerpt(bible: dict, limit: int = CTX_CHARS) -> str:
    nodes = bible.get("nodes") if isinstance(bible, dict) else None
    if not isinstance(nodes, list):
        return ""
    chunks: list[str] = ["[모듈]"]
    nlen = 4
    for n in nodes:
        if not isinstance(n, dict) or n.get("deletedAt"):
            continue
        name = str(n.get("nameKo") or n.get("name") or "").strip()
        bits = [name]
        desc = str(n.get("description") or n.get("synopsis") or "").strip()
        if desc:
            bits.append(desc)
        for b in n.get("blocks") or []:
            if isinstance(b, dict):
                md = str(b.get("md") or "").strip()
                if md:
                    bits.append(md[:800])
        line = " / ".join([x for x in bits if x])
        if not line:
            continue
        if nlen + len(line) > limit:
            break
        chunks.append(line)
        nlen += len(line) + 1
    maps = bible.get("maps") if isinstance(bible, dict) else None
    mermaid = ""
    if isinstance(maps, dict):
        mermaid = str(maps.get("mermaid") or "").strip()
    if mermaid:
        extra = "\n[지도]\n" + mermaid[:2000]
        if nlen + len(extra) <= limit + 2000:
            chunks.append(extra)
    return "\n".join(chunks)


def _flatten_content(content: object) -> str:
    """모델 응답 content 가 문자열·조각 배열이어도 본문만 꺼낸다."""
    if content is None:
        return ""
    if isinstance(content, str):
        return content.strip()
    if isinstance(content, list):
        bits: list[str] = []
        for part in content:
            if isinstance(part, str):
                bits.append(part)
            elif isinstance(part, dict):
                bits.append(str(part.get("text") or part.get("content") or part.get("summary") or ""))
        return "".join(bits).strip()
    return str(content).strip()


def _choice_text(data: dict) -> str:
    choices = data.get("choices") or []
    if not choices or not isinstance(choices[0], dict):
        return ""
    first = choices[0]
    msg = first.get("message") if isinstance(first.get("message"), dict) else {}
    text = _flatten_content(msg.get("content"))
    if not text:
        text = _flatten_content(msg.get("reasoning"))
    if not text:
        text = _flatten_content(msg.get("reasoning_details"))
    if not text:
        text = _flatten_content(msg.get("refusal"))
    if not text:
        text = _flatten_content(first.get("text"))
    return text


def parse_revise(text: str) -> tuple[str, str]:
    s = (text or "").strip()
    if s.startswith("```"):
        s = s.strip("`")
        if s[:4].lower() == "json":
            s = s[4:]
        s = s.strip()
    chunks = [s]
    i = s.find("{")
    j = s.rfind("}")
    if i >= 0 and j > i:
        chunks.append(s[i : j + 1])
    for cand in chunks:
        try:
            obj = json.loads(cand)
        except json.JSONDecodeError:
            continue
        if not isinstance(obj, dict):
            continue
        rewrite = str(obj.get("rewrite") or obj.get("text") or "").strip()
        suggest = str(obj.get("suggest") or obj.get("note") or "").strip()
        if rewrite:
            return rewrite, suggest
        if suggest:
            return suggest, ""
    return s, ""


def _http_json(url: str, payload: dict, headers: dict, timeout: int = 40) -> dict:
    raw = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=raw, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            body = resp.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        err = e.read().decode("utf-8", errors="replace")[:800]
        raise RuntimeError("HTTP %s: %s" % (e.code, err)) from e
    data = json.loads(body) if body else {}
    if not isinstance(data, dict):
        raise RuntimeError("응답이 JSON 객체가 아닙니다.")
    return data


def _revise_prompt(excerpt: str) -> str:
    return (
        "세계관 설정 글을 다듬는다. 고른 문장을 같은 뜻의 더 자연스러운 한국어로 다시 쓴다. "
        "목록에 없는 고유명은 만들지 마라. 고친 문장만 출력한다.\n\n"
        + (excerpt or "(등록된 모듈 없음)")
    )


def call_openrouter(prompt: str, excerpt: str, model: str, max_tokens: int) -> tuple[str, int]:
    key = _key("openrouter")
    if not key:
        raise RuntimeError("OpenRouter 키가 없습니다. .env 의 OPENROUTER_API_KEY 또는 화면에서 키를 저장하세요.")
    mid = (model or "").strip() or OR_DEFAULT
    data = _http_json(
        OR_URL,
        {
            "model": mid,
            "messages": [
                {"role": "system", "content": _revise_prompt(excerpt)},
                {"role": "user", "content": prompt},
            ],
            "max_tokens": max_tokens,
        },
        {
            "Authorization": "Bearer " + key,
            "Content-Type": "application/json",
            "HTTP-Referer": "http://127.0.0.1:8777/world-manager/",
            "X-OpenRouter-Title": "World Manager",
        },
    )
    if data.get("error"):
        raise RuntimeError(str(data["error"]))
    text = _choice_text(data)
    if not text:
        raise RuntimeError("모델이 빈 글을 보냈습니다. 다시 받아 보세요.")
    used = int(((data.get("usage") or {}).get("total_tokens")) or _guess_tokens(prompt + text))
    return text, used


def list_bytez_models(task: str = "chat") -> list[str]:
    key = _key("bytez")
    url = BYTEZ_LIST + "?task=" + urllib.parse.quote(task)
    req = urllib.request.Request(url, headers={"Authorization": key})
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            body = resp.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        err = e.read().decode("utf-8", errors="replace")[:400]
        raise RuntimeError("HTTP %s: %s" % (e.code, err)) from e
    data = json.loads(body) if body else {}
    if not isinstance(data, dict):
        return []
    if data.get("error"):
        raise RuntimeError(str(data["error"]))
    ids: list[str] = []
    for item in data.get("output") or []:
        if isinstance(item, dict):
            mid = str(item.get("modelId") or "").strip()
        else:
            mid = str(item).strip()
        if mid and mid not in ids:
            ids.append(mid)
    return ids


def _bytez_queue(picked: str, catalog: list[str] | None = None) -> list[str]:
    picked = (picked or "").strip()
    out: list[str] = []
    if picked:
        out.append(picked)
    if catalog is not None:
        pref = [m for m in BYTEZ_CHAIN if m in catalog]
        rest = [m for m in catalog if m not in pref]
        for mid in pref + rest:
            if mid not in out:
                out.append(mid)
            if len(out) >= 6:
                break
        return out
    for mid in BYTEZ_CHAIN:
        if mid not in out:
            out.append(mid)
    return out


def _bytez_try_next(err: BaseException) -> bool:
    s = str(err).lower()
    if s.startswith("http 401") or s.startswith("http 403"):
        return False
    keys = (
        "http 404",
        "http 429",
        "http 402",
        "http 503",
        "does not exist",
        "yet to be added",
        "rate limit",
        "quota",
        "exceeded",
        "capacity",
        "too many",
        "out of credit",
    )
    return any(k in s for k in keys)


def _bytez_output_text(out: object) -> str:
    if out is None:
        return ""
    if isinstance(out, str):
        return out.strip()
    if isinstance(out, dict):
        return _flatten_content(
            out.get("content") or out.get("generated_text") or out.get("text") or ""
        )
    if isinstance(out, list) and out:
        return _bytez_output_text(out[0])
    return str(out).strip()


def _call_bytez_one(prompt: str, excerpt: str, model: str, max_tokens: int, key: str) -> tuple[str, int]:
    mid = urllib.parse.quote(model, safe="/")
    data = _http_json(
        BYTEZ_URL + mid,
        {
            "messages": [
                {"role": "system", "content": _revise_prompt(excerpt)},
                {"role": "user", "content": prompt},
            ],
            "stream": False,
            "params": {"max_new_tokens": max_tokens},
        },
        {
            "Authorization": key,
            "Content-Type": "application/json",
        },
    )
    if data.get("error"):
        raise RuntimeError(str(data["error"]))
    text = _bytez_output_text(data.get("output"))
    used = int((data.get("usage") or {}).get("total_tokens") or _guess_tokens(prompt + text))
    if not text.strip():
        raise RuntimeError("Bytez가 빈 글을 돌려줬습니다.")
    return text.strip(), used


def call_bytez(prompt: str, excerpt: str, model: str, max_tokens: int) -> tuple[str, int, str]:
    key = _key("bytez")
    if not key:
        raise RuntimeError("Bytez 키가 없습니다. .env 의 BYTEZ_KEY 또는 화면에서 키를 저장하세요.")
    catalog: list[str] | None = None
    try:
        catalog = list_bytez_models("chat")
        if not catalog:
            catalog = list_bytez_models("text-generation")
    except RuntimeError as e:
        if "http 401" in str(e).lower() or "http 403" in str(e).lower() or "unauthorized" in str(e).lower():
            raise RuntimeError("Bytez 키가 거절되었습니다. 키를 다시 저장해 주세요.") from e
        if catalog is None:
            catalog = None
    if catalog == []:
        raise RuntimeError(
            "Bytez 키는 되지만, 이 계정에 쓸 모델이 없습니다. "
            "Bytez 사이트에서 chat 모델을 카탈로그에 넣은 뒤 다시 시도하세요."
        )
    queue = _bytez_queue(model, catalog)
    last: BaseException | None = None
    for mid in queue:
        try:
            text, used = _call_bytez_one(prompt, excerpt, mid, max_tokens, key)
            return text, used, mid
        except RuntimeError as e:
            last = e
            if _bytez_try_next(e):
                continue
            raise
    raise RuntimeError("Bytez 모델을 모두 써 봤지만 실패했습니다. %s" % last) from last


def _guess_tokens(s: str) -> int:
    # ponytail: 한글 대략 2글자=1토큰. 공급자가 usage 안 줄 때만
    return max(1, len(s) // 2)


def generate(body: dict, bible: dict | None) -> dict:
    provider = str(body.get("provider") or "openrouter").strip().lower()
    selected = str(body.get("selected") or body.get("prompt") or "").strip()
    if not selected:
        raise ValueError("고칠 글을 먼저 드래그해 주세요.")
    if remaining() < 50:
        raise RuntimeError("오늘 글쓰기 한도를 다 썼습니다. 내일 다시 시도하세요.")
    max_tokens = min(400, remaining(), int(body.get("max_tokens") or 220))
    max_tokens = max(64, max_tokens)
    excerpt = bible_excerpt(bible or {}, limit=1200)
    model = str(body.get("model") or "").strip()
    context = str(body.get("context") or "").strip()
    prompt = "고른 글:\n" + selected
    if context:
        prompt += "\n\n주변:\n" + context
    used_model = model or OR_DEFAULT
    if provider == "bytez":
        text, used, used_model = call_bytez(prompt, excerpt, model, max_tokens)
    else:
        text, used = call_openrouter(prompt, excerpt, model, max_tokens)
    rewrite, suggest = parse_revise(text)
    q = add_usage(used)
    return {
        "text": rewrite,
        "rewrite": rewrite,
        "suggest": suggest,
        "used": used,
        "remaining": q["remaining"],
        "limit": q["limit"],
        "model": used_model,
    }


if __name__ == "__main__":
    sample = {"nodes": [{"nameKo": "항구", "blocks": [{"md": "안개가 낀다"}], "deletedAt": None}]}
    ex = bible_excerpt(sample)
    assert "항구" in ex and "안개" in ex
    assert "지움" not in bible_excerpt({"nodes": [{"nameKo": "지움", "deletedAt": "1"}]})
    mapped = bible_excerpt(
        {"nodes": [{"nameKo": "항구"}], "maps": {"mermaid": "graph LR\n  a-->b"}}
    )
    assert "[지도]" in mapped and "a-->b" in mapped
    sys = _revise_prompt(ex)
    assert "고친 문장만" in sys and "항구" in sys
    assert "스토리 기여" not in sys
    rw, sg = parse_revise('{"rewrite":"안개가 짙다","suggest":"냄새를 보태 보세요"}')
    assert rw == "안개가 짙다" and "냄새" in sg
    assert parse_revise('생각\n{"rewrite":"고침","suggest":""}')[0] == "고침"
    assert parse_revise("그냥 문장")[0] == "그냥 문장"
    try:
        generate({}, {})
        raise AssertionError("empty selected")
    except ValueError as exc:
        assert "드래그" in str(exc)
    assert _choice_text({"choices": [{"message": {"content": "  장면  "}}]}) == "장면"
    assert (
        _choice_text({"choices": [{"message": {"content": [{"type": "text", "text": "안개"}]}}]})
        == "안개"
    )
    assert _choice_text({"choices": [{"message": {"content": ""}}]}) == ""
    assert _choice_text({"choices": [{"message": {"content": None, "reasoning": "  고침  "}}]}) == "고침"
    assert (
        _choice_text(
            {"choices": [{"message": {"content": None, "reasoning_details": [{"text": "세부"}]}}]}
        )
        == "세부"
    )
    assert _bytez_output_text({"role": "assistant", "content": "안개"}) == "안개"
    assert _bytez_queue("") == list(BYTEZ_CHAIN)
    assert _bytez_queue(BYTEZ_CHAIN[0]) == list(BYTEZ_CHAIN)
    assert _bytez_queue("custom/x")[0] == "custom/x" and _bytez_queue("custom/x")[1:] == list(BYTEZ_CHAIN)
    assert _bytez_queue("", []) == []
    assert _bytez_queue("a", ["b", "a"]) == ["a", "b"]
    assert _bytez_try_next(RuntimeError("HTTP 404: does not exist"))
    assert _bytez_try_next(RuntimeError("HTTP 429: rate limit exceeded"))
    assert not _bytez_try_next(RuntimeError("HTTP 401: bad key"))
    print("wm_write ok")
