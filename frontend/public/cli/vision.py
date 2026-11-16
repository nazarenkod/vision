#!/usr/bin/env python3
"""Vision CLI: send the screen you are looking at to Vision for a check.

For manual testing. Takes a screenshot and the UI tree from a connected
Android device (adb), an Appium session (Android or iOS), an iOS simulator
(screenshot only) or files, sends them as one check and prints what Vision
found: status against the baseline, changed elements, hidden changes,
accessibility issues, and a link to the review page.

    python3 vision.py config --api https://vision-api.example --key API_KEY --project "Mobile app"
    python3 vision.py check "Payment"                  # from the only adb device
    python3 vision.py check "Payment" --serial emulator-5554
    python3 vision.py check "Payment" --appium http://127.0.0.1:4723
    python3 vision.py check "Payment" --png screen.png --xml screen.xml
    python3 vision.py start && ... check ... && python3 vision.py finish   # many checks, one build

    python3 vision.py mcp                              # MCP server (stdio) for AI assistants

Needs Python 3.8+ and nothing else; adb or Xcode only for those sources.
The API key is on your profile page in Vision (editor role or higher).
"""
import argparse
import base64
import gzip
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
from pathlib import Path

VERSION = "1.0.0"
CONFIG_DIR = Path(os.environ.get("VISION_CONFIG_DIR") or Path.home() / ".config" / "vision")
CONFIG_FILE = CONFIG_DIR / "config.json"
SESSION_FILE = CONFIG_DIR / "session.json"
DEFAULT_BRANCH = "manual"
PNG_MAGIC = b"\x89PNG\r\n\x1a\n"


class VisionError(Exception):
    pass


# ---------------------------------------------------------------- settings


def load_json(path):
    try:
        return json.loads(path.read_text())
    except (OSError, ValueError):
        return {}


def save_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2))
    try:
        path.chmod(0o600)  # holds the API key
    except OSError:
        pass


def settings(overrides=None):
    """Config file, then environment, then command line options."""
    result = {"branch": DEFAULT_BRANCH}
    result.update({k: v for k, v in load_json(CONFIG_FILE).items() if v})
    env = {
        "api": os.environ.get("VISION_API"),
        "key": os.environ.get("VISION_API_KEY"),
        "project": os.environ.get("VISION_PROJECT"),
        "branch": os.environ.get("VISION_BRANCH"),
        "device": os.environ.get("VISION_DEVICE"),
        "os": os.environ.get("VISION_OS"),
    }
    result.update({k: v for k, v in env.items() if v})
    result.update({k: v for k, v in (overrides or {}).items() if v})
    missing = [name for name in ("api", "key", "project") if not result.get(name)]
    if missing:
        raise VisionError(
            "Missing " + ", ".join(missing) + ". Run: vision.py config --api URL --key API_KEY --project NAME"
        )
    result["api"] = result["api"].rstrip("/")
    return result


# ---------------------------------------------------------------- HTTP


def call(conf, method, path, body=None, quiet=False):
    request = urllib.request.Request(
        conf["api"] + path,
        method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={"Content-Type": "application/json", "apiKey": conf["key"], "User-Agent": f"vision-cli/{VERSION}"},
    )
    try:
        with urllib.request.urlopen(request, timeout=120) as response:
            data = response.read()
            return json.loads(data) if data else None
    except urllib.error.HTTPError as error:
        if quiet:
            return None
        detail = error.read().decode(errors="replace")[:300]
        if error.code in (401, 403):
            raise VisionError(f"{method} {path}: not allowed ({error.code}). Check the API key and that your role is editor or admin.")
        raise VisionError(f"{method} {path} failed ({error.code}): {detail}")
    except urllib.error.URLError as error:
        if quiet:
            return None
        raise VisionError(f"Cannot reach {conf['api']}: {error.reason}")


# ---------------------------------------------------------------- capture


def run(command, binary=False, timeout=60):
    try:
        result = subprocess.run(command, capture_output=True, timeout=timeout)
    except FileNotFoundError:
        raise VisionError(f"{command[0]} not found")
    except subprocess.TimeoutExpired:
        raise VisionError(f"{' '.join(command)} timed out")
    if result.returncode != 0:
        raise VisionError(f"{' '.join(command)}: {result.stderr.decode(errors='replace').strip() or 'failed'}")
    return result.stdout if binary else result.stdout.decode(errors="replace")


def adb_devices():
    if not shutil.which("adb"):
        return []
    lines = run(["adb", "devices", "-l"]).splitlines()[1:]
    devices = []
    for line in lines:
        parts = line.split()
        if len(parts) >= 2 and parts[1] == "device":
            model = next((p.split(":", 1)[1] for p in parts if p.startswith("model:")), "")
            devices.append({"serial": parts[0], "model": model.replace("_", " ")})
    return devices


def capture_adb(serial=None):
    devices = adb_devices()
    if not devices:
        raise VisionError("No Android device: connect one (adb devices) or use --appium / --png")
    if serial is None:
        if len(devices) > 1:
            raise VisionError("Several devices are connected, pick one with --serial: " + ", ".join(d["serial"] for d in devices))
        serial = devices[0]["serial"]
    adb = ["adb", "-s", serial]

    png = run(adb + ["exec-out", "screencap", "-p"], binary=True)
    if not png.startswith(PNG_MAGIC):
        raise VisionError("adb screencap did not return a PNG")

    xml = None
    remote = "/sdcard/vision_ui.xml"
    for attempt in range(3):
        try:
            run(adb + ["shell", "uiautomator", "dump", remote], timeout=30)
            xml = run(adb + ["exec-out", "cat", remote], timeout=30)
            run(adb + ["shell", "rm", "-f", remote], timeout=10)
            break
        except VisionError:
            # "could not get idle state" while something animates
            time.sleep(1 + attempt)
    if not xml or "<hierarchy" not in xml:
        print("warning: no UI tree from uiautomator; sending the screenshot only", file=sys.stderr)
        xml = None

    def prop(name):
        try:
            return run(adb + ["shell", "getprop", name], timeout=10).strip()
        except VisionError:
            return ""

    density = None
    try:
        text = run(adb + ["shell", "wm", "density"], timeout=10)
        match = re.search(r"Override density:\s*(\d+)", text) or re.search(r"Physical density:\s*(\d+)", text)
        density = int(match.group(1)) if match else None
    except VisionError:
        pass

    activity = None
    try:
        text = run(adb + ["shell", "dumpsys", "activity", "activities"], timeout=15)
        match = re.search(r"(?:topResumedActivity|mResumedActivity)[^{]*\{[^}]*?\s([\w.]+/[\w.$]+)", text)
        if match:
            activity = match.group(1).split("/", 1)[1]
    except VisionError:
        pass

    release = prop("ro.build.version.release")
    return {
        "png": png,
        "xml": xml,
        "format": "appium-android" if xml else None,
        "density": density,
        "activity": activity,
        "device": prop("ro.product.model") or serial,
        "os": f"Android {release}" if release else "Android",
    }


def appium_get(base, path):
    try:
        with urllib.request.urlopen(base.rstrip("/") + path, timeout=60) as response:
            return json.loads(response.read()).get("value")
    except urllib.error.HTTPError as error:
        raise VisionError(f"Appium {path} failed ({error.code}): {error.read().decode(errors='replace')[:200]}")
    except urllib.error.URLError as error:
        raise VisionError(f"Cannot reach Appium at {base}: {error.reason}")


def capture_appium(base, session=None):
    if not session:
        sessions = None
        for path in ("/appium/sessions", "/sessions"):  # Appium 2, then 1
            try:
                sessions = appium_get(base, path)
                break
            except VisionError:
                continue
        if not sessions:
            raise VisionError("No Appium session found; start one or pass --session")
        session = sessions[0]["id"]
    caps = appium_get(base, f"/session/{session}") or {}
    png = base64.b64decode(appium_get(base, f"/session/{session}/screenshot"))
    xml = appium_get(base, f"/session/{session}/source")
    platform = str(caps.get("platformName") or caps.get("appium:platformName") or "").lower()
    ios = platform == "ios" or "XCUIElementType" in (xml or "")[:5000]
    version = caps.get("platformVersion") or caps.get("appium:platformVersion") or ""
    density = caps.get("deviceScreenDensity") or caps.get("appium:deviceScreenDensity")
    return {
        "png": png,
        "xml": xml,
        "format": "appium-ios" if ios else "appium-android",
        "density": int(density) if density and not ios else None,
        "activity": None,
        "device": caps.get("deviceName") or caps.get("appium:deviceName") or caps.get("deviceModel") or "",
        "os": f"{'iOS' if ios else 'Android'} {version}".strip(),
    }


def capture_simulator():
    if not shutil.which("xcrun"):
        raise VisionError("xcrun not found (Xcode is needed for the iOS simulator)")
    with tempfile.TemporaryDirectory() as folder:
        target = Path(folder) / "screen.png"
        run(["xcrun", "simctl", "io", "booted", "screenshot", "--type=png", str(target)])
        png = target.read_bytes()
    device = ""
    try:
        listing = json.loads(run(["xcrun", "simctl", "list", "devices", "booted", "-j"]))
        for runtime, items in listing.get("devices", {}).items():
            for item in items:
                if item.get("state") == "Booted":
                    version = re.sub(r".*iOS-(\d+)-(\d+).*", r"iOS \1.\2", runtime)
                    return {"png": png, "xml": None, "format": None, "density": None, "activity": None,
                            "device": item.get("name", ""), "os": version}
    except (VisionError, ValueError):
        pass
    print("warning: screenshot only; for the UI tree use --appium", file=sys.stderr)
    return {"png": png, "xml": None, "format": None, "density": None, "activity": None, "device": device, "os": "iOS"}


def capture_files(png_path, xml_path=None):
    png = Path(png_path).read_bytes()
    if not png.startswith(PNG_MAGIC):
        raise VisionError(f"{png_path} is not a PNG")
    xml = Path(xml_path).read_text(encoding="utf-8") if xml_path else None
    return {"png": png, "xml": xml, "format": None, "density": None, "activity": None, "device": "", "os": ""}


def capture(options):
    if options.get("png"):
        return capture_files(options["png"], options.get("xml"))
    if options.get("appium"):
        return capture_appium(options["appium"], options.get("session"))
    if options.get("simulator"):
        return capture_simulator()
    return capture_adb(options.get("serial"))


# ---------------------------------------------------------------- check


def start_session(conf):
    build = call(conf, "POST", "/builds", {"project": conf["project"], "branchName": conf["branch"]})
    session = {"buildId": build["id"], "projectId": build["projectId"], "api": conf["api"],
               "project": conf["project"], "branch": conf["branch"], "number": build.get("number")}
    save_json(SESSION_FILE, session)
    return session


def finish_session(conf):
    session = load_json(SESSION_FILE)
    if not session:
        return None
    try:
        call(conf, "PATCH", f"/builds/{session['buildId']}", {})
    finally:
        SESSION_FILE.unlink(missing_ok=True)
    return session


def open_session(conf):
    session = load_json(SESSION_FILE)
    if session and session.get("api") == conf["api"] and session.get("project") == conf["project"] \
            and session.get("branch") == conf["branch"]:
        return session
    return None


def own_build_for(conf):
    build = call(conf, "POST", "/builds", {"project": conf["project"], "branchName": conf["branch"]})
    return {"buildId": build["id"], "projectId": build["projectId"]}


def check(conf, name, shot, tags=None, device=None, os_name=None, details=True):
    session = open_session(conf)
    own_build = session is None
    build = own_build_for(conf) if own_build else session
    body = {
        "name": name,
        "imageBase64": base64.b64encode(shot["png"]).decode(),
        "buildId": build["buildId"],
        "projectId": build["projectId"],
        "branchName": conf["branch"],
        # the baseline is per device: naming it as the autotests do compares with their baselines
        "device": device or conf.get("device") or shot.get("device") or "",
        "os": os_name or conf.get("os") or shot.get("os") or "",
    }
    if tags:
        body["customTags"] = tags
    if shot.get("xml"):
        body["uiTree"] = base64.b64encode(gzip.compress(shot["xml"].encode("utf-8"))).decode()
        if shot.get("format"):
            body["uiTreeFormat"] = shot["format"]
        if shot.get("density"):
            body["deviceDensity"] = shot["density"]
        if shot.get("activity"):
            body["uiActivity"] = shot["activity"]
    try:
        result = call(conf, "POST", "/test-runs", body)
    finally:
        if own_build:
            call(conf, "PATCH", f"/builds/{build['buildId']}", {}, quiet=True)
    report = {"name": name, "device": body["device"], "os": body["os"], "result": result}
    if details and result.get("id"):
        report["a11y"] = call(conf, "GET", f"/test-runs/{result['id']}/a11y", quiet=True)
        report["structure"] = call(conf, "GET", f"/test-runs/{result['id']}/structure", quiet=True)
    return report


STATUS_TEXT = {
    "new": "new: no baseline yet; approve it in Vision to make it the baseline",
    "ok": "matches the baseline",
    "unresolved": "differs from the baseline",
    "autoApproved": "matches an approved baseline",
    "failed": "failed",
}


def describe(report):
    result = report["result"] or {}
    lines = []
    title = " · ".join(part for part in (report["name"], report["device"], report["os"]) if part)
    lines.append(title)
    status = result.get("status", "?")
    diff = result.get("diffPercent")
    lines.append(f"Status: {STATUS_TEXT.get(status, status)}" + (f" (diff {diff:.2f}%)" if diff else ""))

    structure = report.get("structure") or {}
    for change in structure.get("invisible") or []:
        lines.append(f"Hidden change: {change.get('element')}: {change.get('before')} → {change.get('after')}")
    changed = [area.get("element") for area in structure.get("regions") or [] if area.get("element")]
    if changed:
        lines.append("Changed: " + ", ".join(dict.fromkeys(changed)))

    a11y = report.get("a11y")
    if a11y:
        summary = a11y.get("summary", {})
        lines.append(f"Accessibility: {summary.get('new', 0)} new, {summary.get('total', 0)} total")
        for violation in sorted(a11y.get("violations") or [], key=lambda v: v.get("status") != "new")[:10]:
            mark = "NEW " if violation.get("status") == "new" else "    "
            tracked = f" [{violation['issue'].get('jiraKey')}]" if violation.get("issue", {}).get("jiraKey") else ""
            lines.append(f"  {mark}{violation.get('title')}: {violation.get('message')}{tracked}")
    elif result.get("a11y"):
        lines.append(f"Accessibility: {result['a11y']['newCount']} new, {result['a11y']['totalCount']} total")
    elif not (report.get("structure") or {}).get("hasUiTree"):
        lines.append("Accessibility: not checked (no UI tree)")

    if result.get("url"):
        lines.append(f"Review: {result['url']}")
    return "\n".join(lines)


# ---------------------------------------------------------------- MCP


MCP_TOOLS = [
    {
        "name": "vision_check",
        "description": "Take the screen currently shown on the test device (adb, Appium or iOS simulator) or given files, "
                       "send it to Vision as a named check and return what Vision found: status against the baseline, "
                       "changed elements, hidden changes, accessibility issues and a review link.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "name": {"type": "string", "description": "Check name, e.g. 'Payment' or 'Payment – error state'"},
                "serial": {"type": "string", "description": "adb device serial when several are connected"},
                "appium": {"type": "string", "description": "Appium server URL, to take the screen from its session"},
                "simulator": {"type": "boolean", "description": "Take a screenshot of the booted iOS simulator"},
                "png": {"type": "string", "description": "Path to a screenshot instead of a device"},
                "xml": {"type": "string", "description": "Path to the UI tree XML going with png"},
                "tags": {"type": "string", "description": "Custom tags, e.g. 'dark'"},
                "branch": {"type": "string", "description": "Branch to check against (default: manual)"},
            },
            "required": ["name"],
        },
    },
    {
        "name": "vision_devices",
        "description": "List Android devices connected over adb.",
        "inputSchema": {"type": "object", "properties": {}},
    },
    {
        "name": "vision_session",
        "description": "Start or finish a session: checks sent while it is open go to one build.",
        "inputSchema": {
            "type": "object",
            "properties": {"action": {"type": "string", "enum": ["start", "finish"]}},
            "required": ["action"],
        },
    },
]


def mcp_call(name, arguments):
    if name == "vision_devices":
        devices = adb_devices()
        return "\n".join(f"{d['serial']} {d['model']}" for d in devices) or "No adb devices."
    if name == "vision_session":
        conf = settings()
        if arguments.get("action") == "start":
            session = start_session(conf)
            return f"Session started: build #{session.get('number')} on branch {conf['branch']}."
        session = finish_session(conf)
        return "Session finished." if session else "No open session."
    if name == "vision_check":
        conf = settings({"branch": arguments.get("branch")})
        shot = capture(arguments)
        return describe(check(conf, arguments["name"], shot, tags=arguments.get("tags")))
    raise VisionError(f"Unknown tool {name}")


def mcp_serve(stdin=sys.stdin, stdout=sys.stdout):
    """Minimal MCP server over stdio (newline-delimited JSON-RPC)."""

    def send(message):
        stdout.write(json.dumps(message) + "\n")
        stdout.flush()

    for line in stdin:
        line = line.strip()
        if not line:
            continue
        try:
            message = json.loads(line)
        except ValueError:
            send({"jsonrpc": "2.0", "id": None, "error": {"code": -32700, "message": "Parse error"}})
            continue
        method, request_id = message.get("method"), message.get("id")
        if request_id is None:
            continue  # notifications need no answer
        if method == "initialize":
            requested = (message.get("params") or {}).get("protocolVersion") or "2024-11-05"
            result = {"protocolVersion": requested, "capabilities": {"tools": {}},
                      "serverInfo": {"name": "vision", "version": VERSION}}
        elif method == "ping":
            result = {}
        elif method == "tools/list":
            result = {"tools": MCP_TOOLS}
        elif method == "tools/call":
            params = message.get("params") or {}
            try:
                text = mcp_call(params.get("name"), params.get("arguments") or {})
                result = {"content": [{"type": "text", "text": text}], "isError": False}
            except (VisionError, OSError, KeyError) as error:
                result = {"content": [{"type": "text", "text": f"Error: {error}"}], "isError": True}
        else:
            send({"jsonrpc": "2.0", "id": request_id, "error": {"code": -32601, "message": f"Unknown method {method}"}})
            continue
        send({"jsonrpc": "2.0", "id": request_id, "result": result})


# ---------------------------------------------------------------- CLI


def main(argv=None):
    parser = argparse.ArgumentParser(prog="vision.py", description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--version", action="version", version=VERSION)
    commands = parser.add_subparsers(dest="command")

    config = commands.add_parser("config", help="save the API URL, key and project")
    config.add_argument("--api", help="Vision API URL, e.g. http://vision:14200")
    config.add_argument("--key", help="your API key (profile page in Vision)")
    config.add_argument("--project", help="project name or id")
    config.add_argument("--branch", help=f"branch to check against (default {DEFAULT_BRANCH})")
    config.add_argument("--device", help="device name to send instead of the model, as the autotests name it")
    config.add_argument("--os", dest="os_name", help="OS to send instead of the detected one, as the autotests name it")

    def source_options(sub):
        sub.add_argument("--serial", help="adb device serial when several are connected")
        sub.add_argument("--appium", help="Appium server URL: take the screen from its session (Android or iOS)")
        sub.add_argument("--session", help="Appium session id (default: the first one)")
        sub.add_argument("--simulator", action="store_true", help="booted iOS simulator, screenshot only")
        sub.add_argument("--png", help="screenshot file instead of a device")
        sub.add_argument("--xml", help="UI tree file going with --png")

    check_cmd = commands.add_parser("check", help="send the current screen as a check")
    check_cmd.add_argument("name", help="check name, e.g. 'Payment' or 'Payment – error state'")
    source_options(check_cmd)
    check_cmd.add_argument("--tags", help="custom tags, e.g. dark")
    check_cmd.add_argument("--device", help="device name to show (default: from the device)")
    check_cmd.add_argument("--os", dest="os_name", help="OS to show (default: from the device)")
    check_cmd.add_argument("--branch", help="branch to check against")
    check_cmd.add_argument("--project", help="project name or id")
    check_cmd.add_argument("--json", action="store_true", help="print the raw result as JSON")

    capture_cmd = commands.add_parser("capture", help="save the current screen to files without sending it")
    capture_cmd.add_argument("output", help="file name without extension; writes .png and .xml")
    source_options(capture_cmd)

    commands.add_parser("devices", help="list adb devices")
    commands.add_parser("start", help="open a session: following checks go to one build")
    commands.add_parser("finish", help="close the session")
    commands.add_parser("mcp", help="run as an MCP server over stdio")

    args = parser.parse_args(argv)
    try:
        if args.command == "config":
            current = load_json(CONFIG_FILE)
            current.update({k: v for k, v in {"api": args.api, "key": args.key, "project": args.project,
                                              "branch": args.branch, "device": args.device,
                                              "os": args.os_name}.items() if v})
            save_json(CONFIG_FILE, current)
            # the key is shown by its last characters only, and not at all when it is short
            shown = {k: (("•••" + v[-4:]) if len(v) > 12 else "•••") if k == "key" and v else v
                     for k, v in current.items()}
            print(f"Saved to {CONFIG_FILE}: {json.dumps(shown, ensure_ascii=False)}")
        elif args.command == "check":
            conf = settings({"branch": args.branch, "project": args.project})
            shot = capture(vars(args))
            report = check(conf, args.name, shot, tags=args.tags, device=args.device, os_name=args.os_name)
            print(json.dumps(report, indent=2, ensure_ascii=False) if args.json else describe(report))
        elif args.command == "capture":
            shot = capture(vars(args))
            Path(args.output + ".png").write_bytes(shot["png"])
            if shot.get("xml"):
                Path(args.output + ".xml").write_text(shot["xml"], encoding="utf-8")
            print(f"Saved {args.output}.png" + (f" and {args.output}.xml" if shot.get("xml") else ""))
        elif args.command == "devices":
            devices = adb_devices()
            print("\n".join(f"{d['serial']}\t{d['model']}" for d in devices) or "No adb devices.")
        elif args.command == "start":
            session = start_session(settings())
            print(f"Session started: build #{session.get('number')}. Checks go to it until 'vision.py finish'.")
        elif args.command == "finish":
            session = finish_session(settings())
            print("Session finished." if session else "No open session.")
        elif args.command == "mcp":
            mcp_serve()
        else:
            parser.print_help()
        return 0
    except VisionError as error:
        print(f"error: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
