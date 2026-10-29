#!/usr/bin/env python3
"""Validate the mini-tool bundle against the container rules, then zip it.

Checks mirror the self-check lists in .claude/SKILL.md and its references
(zip-artifact-spec.md / device-capabilities.md / jsbridge-api.md).
Exits non-zero if any hard rule fails.
"""
import os, re, subprocess, sys, zipfile

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SRC  = os.environ.get("MT_SRC")  or os.path.join(ROOT, "minitool")
DIST = os.environ.get("MT_DIST") or os.path.join(ROOT, "dist")
ZIP  = os.path.join(DIST, "drive-escape-minitool.zip")

ALLOWED_EXT = {".html", ".css", ".js", ".png", ".jpg", ".jpeg", ".gif",
               ".webp", ".svg", ".woff", ".woff2", ".json"}
JUNK = {".DS_Store", "Thumbs.db"}

# 被禁能力扫描（device-capabilities.md §7）
BANNED = [
    (r"\bfetch\s*\(",                         "网络请求 fetch()"),
    (r"XMLHttpRequest",                       "网络请求 XMLHttpRequest"),
    (r"new\s+WebSocket\s*\(",                 "WebSocket"),
    (r"new\s+EventSource\s*\(",               "EventSource"),
    (r"new\s+RTCPeerConnection\s*\(",         "WebRTC"),
    (r"navigator\.geolocation",               "定位"),
    (r"navigator\.clipboard",                 "剪贴板"),
    (r"document\.execCommand\s*\(",           "execCommand"),
    (r"navigator\.(bluetooth|usb|hid|serial)","硬件连接"),
    (r"navigator\.(getBattery|connection|credentials|locks)", "设备信息 / 凭据"),
    (r"navigator\.mediaDevices\.(enumerateDevices|getDisplayMedia)", "设备枚举 / 屏幕共享"),
    (r"navigator\.storage\.persist",          "持久化存储"),
    (r"navigator\.serviceWorker",             "Service Worker"),
    (r"new\s+(Shared)?Worker\s*\(",           "Worker"),
    (r"new\s+(Accelerometer|Gyroscope|Magnetometer)\s*\(", "传感器"),
    (r"DeviceMotionEvent|DeviceOrientationEvent|['\"]devicemotion['\"]|['\"]deviceorientation['\"]", "运动传感器"),
    (r"(webkit)?[Rr]equestFullscreen",        "全屏"),
    (r"\beval\s*\(",                          "eval()"),
    (r"new\s+Function\s*\(",                  "new Function()"),
    (r"WebAssembly\.",                        "WebAssembly"),
    (r"window\.open\s*\(",                    "window.open"),
    (r"window\.prompt\s*\(|[^.\w]prompt\s*\(","window.prompt"),
    (r"location\.(href\s*=|assign\s*\(|replace\s*\()", "站外跳转"),
    (r"<iframe|<object",                      "iframe / object"),
    (r"<form[\s>]",                           "form 提交跳转"),
    (r"target\s*=\s*['\"]_blank",             "target=_blank"),
    (r"<a[^>]+\bdownload\b",                  "a[download] 文件下载"),
    (r"PaymentRequest|navigator\.share",      "支付 / 系统分享"),
]

# 外部资源 / CSP / 模块脚本（zip-artifact-spec.md §3–§5）
STRUCTURE = [
    (r"https?://",                            "外部资源引用"),
    (r'<script(?![^>]*\bsrc=)[^>]*>(?!\s*</script>)', "内联 <script>"),
    (r'\son[a-z]+\s*=\s*["\']',               "行内事件（onclick 等）"),
    (r"javascript:",                          "javascript: URI"),
    (r'type\s*=\s*["\']module["\']',          "type=module"),
    (r"<base\s",                              "<base href>"),
    (r'<meta[^>]+http-equiv\s*=\s*["\']Content-Security-Policy', "自建 CSP meta"),
]

JS_MODULE = [
    (r"^\s*import\s+[\w{*]",                  "ES import"),
    (r"^\s*export\s+(default|const|function|class|\{)", "ES export"),
]

# jsbridge-api.md 允许的 API
BRIDGE_OK = {"postNote", "saveImageToPhotosAlbum", "openRedPage", "writeTempFile"}

errors, warnings = [], []


def scan():
    files = []
    for dirpath, dirnames, filenames in os.walk(SRC):
        dirnames[:] = [d for d in dirnames if d not in (".git", "node_modules", "__MACOSX")]
        for fn in filenames:
            files.append(os.path.join(dirpath, fn))

    # ── 包结构 ──
    if not os.path.isfile(os.path.join(SRC, "index.html")):
        errors.append("index.html 不在包根目录")
    n_html = sum(1 for f in files if f.endswith(".html"))
    if n_html != 1:
        errors.append(f"应有且仅有一个 html（当前 {n_html} 个）")

    for f in files:
        rel = os.path.relpath(f, SRC)
        base = os.path.basename(f)
        ext = os.path.splitext(f)[1].lower()
        if base in JUNK or base.startswith("._"):
            errors.append(f"开发垃圾文件: {rel}")
        elif ext not in ALLOWED_EXT:
            errors.append(f"不支持的文件类型: {rel}")
        if f.endswith(".map"):
            errors.append(f"source map: {rel}")

    # ── 能力 / 结构扫描 ──
    for f in files:
        ext = os.path.splitext(f)[1].lower()
        if ext not in (".html", ".css", ".js"):
            continue
        rel = os.path.relpath(f, SRC)
        text = open(f, encoding="utf-8").read()
        lines = text.split("\n")

        rules = list(BANNED)
        if ext in (".html", ".css"):
            rules += STRUCTURE
        elif ext == ".js":
            rules += [r for r in STRUCTURE if r[1] in ("外部资源引用", "javascript: URI")]
            rules += JS_MODULE

        for pat, label in rules:
            for i, line in enumerate(lines, 1):
                if re.search(pat, line, re.M):
                    errors.append(f"{rel}:{i} 命中「{label}」 → {line.strip()[:88]}")

    # ── 引用的本地资源是否都在包内 ──
    html = open(os.path.join(SRC, "index.html"), encoding="utf-8").read()
    for m in re.finditer(r'(?:src|href)\s*=\s*["\']([^"\']+)["\']', html):
        ref = m.group(1)
        if ref.startswith("data:") or ref.startswith("#"):
            continue
        if ref.startswith("/"):
            errors.append(f"index.html 使用绝对路径: {ref}")
            continue
        if not os.path.isfile(os.path.join(SRC, ref.lstrip("./").split("?")[0])):
            errors.append(f"index.html 引用了不存在的资源: {ref}")

    for f in files:
        if not f.endswith(".css"):
            continue
        css = open(f, encoding="utf-8").read()
        for m in re.finditer(r"url\(\s*['\"]?([^'\")]+)", css):
            u = m.group(1)
            if u.startswith("data:"):
                continue
            p = os.path.join(os.path.dirname(f), u)
            if not os.path.isfile(p):
                errors.append(f"{os.path.relpath(f, SRC)} 引用了不存在的资源: {u}")

    # ── viewport / doctype / lang ──
    if "<!DOCTYPE html>" not in html:
        errors.append("index.html 缺少 <!DOCTYPE html>")
    if 'lang="zh-CN"' not in html:
        errors.append('index.html 缺少 lang="zh-CN"')
    if "charset=UTF-8" not in html and 'charset="UTF-8"' not in html:
        errors.append("index.html 缺少 charset=UTF-8")
    for need in ["width=device-width", "initial-scale=1.0", "viewport-fit=cover"]:
        if need not in html:
            errors.append(f"viewport 缺少 {need}")

    # ── JSBridge 白名单 ──
    for f in files:
        if not f.endswith(".js"):
            continue
        js = open(f, encoding="utf-8").read()
        for m in re.finditer(r"miniTool\.(\w+)", js):
            if m.group(1) not in BRIDGE_OK:
                errors.append(f"调用了未列出的 JSBridge API: {m.group(1)}")

    # ── JS 语法 ──
    for f in files:
        if f.endswith(".js"):
            r = subprocess.run(["node", "--check", f], capture_output=True)
            if r.returncode != 0:
                errors.append(f"{os.path.relpath(f, SRC)} 语法错误: "
                              f"{r.stderr.decode()[:200]}")
    return files


def pack(files):
    os.makedirs(DIST, exist_ok=True)
    if os.path.exists(ZIP):
        os.remove(ZIP)
    # 压缩「目录内容」，保证解压后 index.html 直接在根
    with zipfile.ZipFile(ZIP, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for f in sorted(files):
            z.write(f, os.path.relpath(f, SRC))
    return ZIP


def main():
    files = scan()
    print("=" * 62)
    print("小工具 ZIP 校验")
    print("=" * 62)
    if errors:
        print(f"\n✗ {len(errors)} 项未通过：")
        for e in errors:
            print("   -", e)
        sys.exit(1)
    print("\n✓ 包结构：index.html 位于根目录，仅含允许的文件类型")
    print("✓ 端能力：未命中任何被禁 Web API / 行为")
    print("✓ 资源：全部相对路径，无外部引用，引用文件均在包内")
    print("✓ 脚本：全部外置、经典脚本，无内联 / 行内事件 / module")
    print("✓ JSBridge：仅使用白名单 API")
    print("✓ JS 语法检查通过")

    path = pack(files)
    size = os.path.getsize(path)
    print(f"\n产物: {os.path.relpath(path, ROOT)}")
    print(f"体积: {size/1024:.1f} KB  (上限 10240 KB，建议 ≤2048 KB)")
    with zipfile.ZipFile(path) as z:
        names = z.namelist()
        print(f"条目: {len(names)}")
        for n in sorted(names):
            print(f"   {n}")
    if size > 10 * 1024 * 1024:
        print("\n✗ 超过 10MB 上限"); sys.exit(1)
    if size > 2 * 1024 * 1024:
        print("\n! 超过 2MB 建议值")
    else:
        print("\n✓ 体积在建议值以内")


main()
