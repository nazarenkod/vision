"""Tests for the Vision CLI (frontend/public/cli/vision.py).

    python3 -I scripts/tests/test_vision_cli.py

A fake Vision API runs on a local port and a fake adb sits first on PATH, so
nothing needs a device or a server.
"""
import base64
import gzip
import importlib.util
import io
import json
import os
import stat
import sys
import tempfile
import threading
import unittest
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CLI = ROOT / "frontend" / "public" / "cli" / "vision.py"
PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 32
XML = ('<?xml version="1.0" encoding="UTF-8"?><hierarchy rotation="0"><node class="android.widget.Button" '
       'resource-id="com.bank.app:id/btn_pay" text="Pay" bounds="[42,2200][1038,2326]"/></hierarchy>')


def load_cli():
    spec = importlib.util.spec_from_file_location("vision_cli", CLI)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class FakeVision(BaseHTTPRequestHandler):
    requests = []

    def log_message(self, *args):
        pass

    def reply(self, body, code=200):
        data = json.dumps(body).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def handle_any(self, method):
        length = int(self.headers.get("Content-Length") or 0)
        body = json.loads(self.rfile.read(length)) if length else None
        FakeVision.requests.append({"method": method, "path": self.path, "body": body,
                                    "apiKey": self.headers.get("apiKey")})
        if self.headers.get("apiKey") != "KEY":
            return self.reply({"message": "Unauthorized"}, 401)
        if method == "POST" and self.path == "/builds":
            return self.reply({"id": "build-1", "projectId": "project-1", "number": 7})
        if method == "PATCH" and self.path.startswith("/builds/"):
            return self.reply({"id": "build-1"})
        if method == "POST" and self.path == "/test-runs":
            return self.reply({
                "id": "run-1", "status": "unresolved", "diffPercent": 6.9,
                "url": "http://vision/project-1?buildId=build-1&testId=run-1",
                "a11y": {"newCount": 1, "totalCount": 2, "url": "x"},
                # a server from before spec 020 still sends these; they are not shown
                "warnings": [{"kind": "loading", "message": "Taken before the screen settled: ProgressBar visible."}],
            })
        if self.path == "/test-runs/run-1/a11y":
            return self.reply({"summary": {"new": 1, "total": 2}, "violations": [
                {"status": "existing", "title": "Touch target too small", "message": "Tab 1 is 38 dp"},
                {"status": "new", "title": "Missing label", "message": "ImageButton has no label",
                 "issue": {"jiraKey": "MOB-12"}},
            ]})
        if self.path == "/test-runs/run-1/structure":
            return self.reply({"hasUiTree": True,
                               "invisible": [{"element": 'Button "Pay"', "before": "default", "after": "disabled"}],
                               "regions": [{"element": "BottomNavigationView (id/bottom_nav)"}]})
        return self.reply({"message": "not found"}, 404)

    def do_GET(self):
        self.handle_any("GET")

    def do_POST(self):
        self.handle_any("POST")

    def do_PATCH(self):
        self.handle_any("PATCH")


FAKE_ADB = r'''#!/usr/bin/env python3
import sys
args = sys.argv[1:]
if args[:1] == ["-s"]:
    args = args[2:]
if args[:1] == ["devices"]:
    print("List of devices attached")
    print("emulator-5554          device product:sdk model:Pixel_7 device:emu")
elif args[:3] == ["exec-out", "screencap", "-p"]:
    sys.stdout.buffer.write(PNG)
elif args[:2] == ["shell", "uiautomator"]:
    print("UI hierchary dumped to: /sdcard/vision_ui.xml")
elif args[:2] == ["exec-out", "cat"]:
    sys.stdout.write(XML)
elif args[:3] == ["shell", "wm", "density"]:
    print("Physical density: 420")
elif args[:2] == ["shell", "getprop"]:
    print({"ro.product.model": "Pixel 7", "ro.build.version.release": "15"}.get(args[2], ""))
elif args[:3] == ["shell", "dumpsys", "activity"]:
    print("  topResumedActivity=ActivityRecord{1a2b u0 com.bank.app/.PaymentActivity t12}")
'''


class VisionCliTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = HTTPServer(("127.0.0.1", 0), FakeVision)
        threading.Thread(target=cls.server.serve_forever, daemon=True).start()
        cls.api = f"http://127.0.0.1:{cls.server.server_port}"

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()

    def setUp(self):
        FakeVision.requests.clear()
        self.tmp = tempfile.TemporaryDirectory()
        tmp = Path(self.tmp.name)
        bin_dir = tmp / "bin"
        bin_dir.mkdir()
        adb = bin_dir / "adb"
        adb.write_text(FAKE_ADB.replace("PNG)", f"{PNG!r})").replace("(XML)", f"({XML!r})"))
        adb.chmod(adb.stat().st_mode | stat.S_IEXEC)
        self.env = {"VISION_CONFIG_DIR": str(tmp / "config"), "PATH": f"{bin_dir}{os.pathsep}{os.environ['PATH']}",
                    "VISION_API": "", "VISION_API_KEY": "", "VISION_PROJECT": "", "VISION_BRANCH": "",
                    "VISION_DEVICE": "", "VISION_OS": ""}
        self.old_env = {key: os.environ.get(key) for key in self.env}
        os.environ.update(self.env)
        self.cli = load_cli()
        self.files = tmp

    def tearDown(self):
        for key, value in self.old_env.items():
            if value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = value
        self.tmp.cleanup()

    def run_cli(self, *argv):
        out, err = io.StringIO(), io.StringIO()
        old = sys.stdout, sys.stderr
        sys.stdout, sys.stderr = out, err
        try:
            code = self.cli.main(list(argv))
        finally:
            sys.stdout, sys.stderr = old
        return code, out.getvalue(), err.getvalue()

    def configure(self):
        code, out, _ = self.run_cli("config", "--api", self.api, "--key", "KEY", "--project", "Mobile app")
        self.assertEqual(code, 0)
        self.assertIn('"key": "•••"', out)  # the key is never printed whole

    def test_asks_for_settings_first(self):
        code, _, err = self.run_cli("check", "Payment", "--png", "x.png")
        self.assertEqual(code, 1)
        self.assertIn("Missing api, key, project", err)

    def test_checks_the_screen_of_an_adb_device(self):
        self.configure()
        code, out, err = self.run_cli("check", "Payment")
        self.assertEqual(code, 0, err)

        methods = [(r["method"], r["path"]) for r in FakeVision.requests]
        self.assertEqual(methods[:3], [("POST", "/builds"), ("POST", "/test-runs"), ("PATCH", "/builds/build-1")])
        build = FakeVision.requests[0]["body"]
        self.assertEqual(build, {"project": "Mobile app", "branchName": "manual"})
        body = FakeVision.requests[1]["body"]
        self.assertEqual(base64.b64decode(body["imageBase64"]), PNG)
        self.assertEqual(gzip.decompress(base64.b64decode(body["uiTree"])).decode(), XML)
        self.assertEqual(body["device"], "Pixel 7")
        self.assertEqual(body["os"], "Android 15")
        self.assertEqual(body["deviceDensity"], 420)
        self.assertEqual(body["uiActivity"], ".PaymentActivity")
        self.assertEqual(body["uiTreeFormat"], "appium-android")
        self.assertEqual(body["name"], "Payment")

        self.assertIn("Status: differs from the baseline (diff 6.90%)", out)
        self.assertNotIn("Warning:", out)
        self.assertIn('Hidden change: Button "Pay": default → disabled', out)
        self.assertIn("Changed: BottomNavigationView (id/bottom_nav)", out)
        self.assertIn("Accessibility: 1 new, 2 total", out)
        self.assertIn("NEW Missing label: ImageButton has no label [MOB-12]", out)
        self.assertIn("Review: http://vision/project-1?buildId=build-1&testId=run-1", out)

    def test_sends_files_into_one_session_build(self):
        self.configure()
        png = self.files / "screen.png"
        png.write_bytes(PNG)
        xml = self.files / "screen.xml"
        xml.write_text(XML)

        self.assertEqual(self.run_cli("start")[0], 0)
        for name in ("Home", "Cards"):
            code, _, err = self.run_cli("check", name, "--png", str(png), "--xml", str(xml),
                                        "--device", "Galaxy S23", "--tags", "dark")
            self.assertEqual(code, 0, err)
        self.assertEqual(self.run_cli("finish")[0], 0)

        methods = [(r["method"], r["path"]) for r in FakeVision.requests if r["path"] in ("/builds", "/test-runs")
                   or r["path"].startswith("/builds/")]
        self.assertEqual(methods, [("POST", "/builds"), ("POST", "/test-runs"), ("POST", "/test-runs"),
                                   ("PATCH", "/builds/build-1")])
        sent = [r["body"] for r in FakeVision.requests if r["path"] == "/test-runs"]
        self.assertEqual([b["customTags"] for b in sent], ["dark", "dark"])
        self.assertEqual({b["device"] for b in sent}, {"Galaxy S23"})
        self.assertFalse((self.files / "config" / "session.json").exists())

    def test_names_the_device_as_configured(self):
        self.configure()
        self.run_cli("config", "--device", "Pixel 7 emulator", "--os", "Android 15")
        code, _, err = self.run_cli("check", "Payment")
        self.assertEqual(code, 0, err)
        body = next(r["body"] for r in FakeVision.requests if r["path"] == "/test-runs")
        self.assertEqual((body["device"], body["os"]), ("Pixel 7 emulator", "Android 15"))

    def test_reports_a_wrong_api_key(self):
        self.run_cli("config", "--api", self.api, "--key", "WRONG", "--project", "Mobile app")
        png = self.files / "screen.png"
        png.write_bytes(PNG)
        code, _, err = self.run_cli("check", "Payment", "--png", str(png))
        self.assertEqual(code, 1)
        self.assertIn("not allowed (401)", err)

    def test_saves_a_capture_without_sending(self):
        target = self.files / "shot"
        code, out, err = self.run_cli("capture", str(target))
        self.assertEqual(code, 0, err)
        self.assertEqual((self.files / "shot.png").read_bytes(), PNG)
        self.assertEqual((self.files / "shot.xml").read_text(), XML)
        self.assertEqual(FakeVision.requests, [])

    def test_mcp_server_lists_and_calls_tools(self):
        self.configure()
        png = self.files / "screen.png"
        png.write_bytes(PNG)
        messages = [
            {"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {"protocolVersion": "2025-06-18"}},
            {"jsonrpc": "2.0", "method": "notifications/initialized"},
            {"jsonrpc": "2.0", "id": 2, "method": "tools/list"},
            {"jsonrpc": "2.0", "id": 3, "method": "tools/call",
             "params": {"name": "vision_check", "arguments": {"name": "Payment", "png": str(png)}}},
            {"jsonrpc": "2.0", "id": 4, "method": "tools/call", "params": {"name": "vision_devices", "arguments": {}}},
            {"jsonrpc": "2.0", "id": 5, "method": "tools/call",
             "params": {"name": "vision_check", "arguments": {"name": "Payment", "png": "/missing.png"}}},
            {"jsonrpc": "2.0", "id": 6, "method": "nope"},
        ]
        stdin = io.StringIO("\n".join(json.dumps(m) for m in messages) + "\n")
        stdout = io.StringIO()
        self.cli.mcp_serve(stdin, stdout)
        replies = {r["id"]: r for r in map(json.loads, stdout.getvalue().splitlines())}

        self.assertEqual(sorted(replies), [1, 2, 3, 4, 5, 6])  # no reply to the notification
        self.assertEqual(replies[1]["result"]["protocolVersion"], "2025-06-18")
        self.assertEqual(replies[1]["result"]["serverInfo"]["name"], "vision")
        self.assertEqual([t["name"] for t in replies[2]["result"]["tools"]],
                         ["vision_check", "vision_devices", "vision_session"])
        check = replies[3]["result"]
        self.assertFalse(check["isError"])
        self.assertIn("Status: differs from the baseline", check["content"][0]["text"])
        self.assertIn("emulator-5554", replies[4]["result"]["content"][0]["text"])
        self.assertTrue(replies[5]["result"]["isError"])
        self.assertEqual(replies[6]["error"]["code"], -32601)


if __name__ == "__main__":
    unittest.main(verbosity=2)
