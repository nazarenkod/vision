#!/usr/bin/env python3
"""Fill a separate Vision project with made-up history, so every Insights block has something.

    ./scripts/seed-insights-demo.py --email admin@example.com
    ./scripts/seed-insights-demo.py --email admin@example.com --project "Insights demo" --yes

What it makes, in the project "Insights demo" (created when missing):
  * an old build (120 days back) with three screens nobody runs since -> Stale baselines,
    one of them never approved;
  * 8 builds over the last ~16 days: screens that flip, one rejected and then back,
    one whose changes are approved twice -> Unstable screens;
  * Android UI trees with unlabeled and too small buttons -> Accessibility, Most frequent problems.

The screens go through the Vision API like a real test would (POST /builds, /test-runs,
approve, reject), so the pixel diff and the accessibility checks are real. The API cannot
back-date anything, so the dates are moved afterwards in Vision's own Postgres, only for the
rows this run created, through ./scripts/vision.sh (which refuses containers that are not
Vision's). --no-backdate skips that step: then no baseline is stale.

It writes only to Vision: before anything else it checks that the API answers a route that
only Vision has, so pointed at the production VRT by mistake it stops without a write.
Standard library only. The password comes from VISION_PASSWORD or a prompt.
"""
import argparse
import base64
import getpass
import gzip
import json
import os
import pathlib
import re
import struct
import subprocess
import sys
import urllib.error
import urllib.request
import zlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
UUID = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")

WIDTH, HEIGHT, DENSITY = 540, 1200, 240  # 48 dp at 240 dpi = 72 px
BUILDS = 8
OLD_BUILD_DAYS = 120
DEVICES = [("Pixel 7", "Android 15"), ("Galaxy S23", "Android 14")]

# name -> devices, accessibility (unlabeled buttons, small buttons, a duplicated label),
# and what happens in recent build k (1..BUILDS): (look, decision); look 0 = the baseline
STALE = "stale"
SCREENS = [
    {"name": "Головна", "devices": DEVICES, "a11y": (2, 1, False)},
    {"name": "Перекази", "devices": DEVICES, "a11y": (4, 2, True)},
    {"name": "Картки та рахунки", "devices": DEVICES, "a11y": (1, 0, False)},
    {"name": "Профіль", "devices": DEVICES[:1], "a11y": (0, 1, False)},
    {"name": "Курси валют", "devices": DEVICES, "a11y": (1, 0, False),
     "plan": {k: (1, None) for k in range(1, BUILDS + 1, 2)}},
    {"name": "Акції", "devices": DEVICES[:1], "a11y": (3, 0, True), "plan": {3: (1, None), 6: (1, None)}},
    # approved twice: the new look stays, so these are new baselines, not flips
    {"name": "Кешбек", "devices": DEVICES, "a11y": (0, 0, False),
     "plan": {k: (1 if k < 6 else 2, "approve" if k in (3, 6) else None) for k in range(3, BUILDS + 1)}},
    {"name": "Оплата", "devices": DEVICES[:1], "a11y": (2, 2, False), "plan": {4: (1, "reject")}},
    {"name": "Онбординг v1", "devices": DEVICES[:1], "a11y": (1, 0, False), "only": STALE},
    {"name": "Промо: літо", "devices": DEVICES[1:], "a11y": (0, 0, False), "only": STALE},
    {"name": "Депозити (старий екран)", "devices": DEVICES[:1], "a11y": (2, 1, False), "only": STALE,
     "approve": False},
]


# ---------------------------------------------------------------- pure parts (tested)

def png(width, height, rects, background=(245, 247, 246)):
    """An RGB PNG of flat rectangles [(x, y, w, h, (r, g, b)), ...], later ones on top."""
    bg = bytes(background)
    raw = bytearray()
    for y in range(height):
        row = bytearray(bg * width)
        for x0, y0, w, h, colour in rects:
            if y0 <= y < y0 + h:
                x0, x1 = max(0, x0), min(width, x0 + w)
                if x1 > x0:
                    row[x0 * 3:x1 * 3] = bytes(colour) * (x1 - x0)
        raw += b"\x00" + row

    def chunk(kind, data):
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)

    header = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", header) + chunk(b"IDAT", zlib.compress(bytes(raw), 9)) + chunk(b"IEND", b"")


def screen_layout(screen, look):
    """Rectangles and UI-tree elements of one screen; a look other than 0 moves the banner."""
    seed = sum(map(ord, screen["name"]))
    accent = (40 + seed % 120, 120 + seed % 90, 60 + seed % 140)
    banner = [(accent), (230, 120, 40), (60, 110, 220)][look % 3]
    unlabeled, small, duplicate = screen["a11y"]
    rects = [(0, 0, WIDTH, 100, (21, 25, 24)), (24, 140, WIDTH - 48, 220, banner)]
    elements = [("android.widget.TextView", screen["name"], "", (24, 30, 300, 40), False)]
    y = 400
    for i in range(4):
        rects.append((24, y, WIDTH - 48, 96, (255, 255, 255)))
        elements.append(("android.widget.Button", f"Пункт {i + 1}", "", (24, y, WIDTH - 48, 96), True))
        y += 120
    x = 24
    for i in range(unlabeled):  # an icon button with no label: missing-label
        rects.append((x, 900, 80, 80, accent))
        elements.append(("android.widget.ImageButton", "", "", (x, 900, 80, 80), True))
        x += 100
    x = 24
    for i in range(small):  # 40 px at 240 dpi is ~27 dp: touch-target
        rects.append((x, 1020, 40, 40, accent))
        elements.append(("android.widget.ImageButton", "", f"Дія {i + 1}", (x, 1020, 40, 40), True))
        x += 60
    if duplicate:  # two different controls read out the same way
        for x in (24, 280):
            rects.append((x, 1090, 236, 80, (255, 255, 255)))
            elements.append(("android.widget.Button", "", "Детальніше", (x, 1090, 236, 80), True))
    return rects, elements


def ui_tree(elements):
    def esc(text):
        return text.replace("&", "&amp;").replace('"', "&quot;").replace("<", "&lt;")

    nodes = []
    for index, (cls, text, desc, (x, y, w, h), clickable) in enumerate(elements):
        flag = "true" if clickable else "false"
        nodes.append(
            f'    <{cls} index="{index}" package="ua.demo.app" class="{cls}" text="{esc(text)}" '
            f'content-desc="{esc(desc)}" resource-id="" clickable="{flag}" enabled="true" focusable="{flag}" '
            f'long-clickable="false" bounds="[{x},{y}][{x + w},{y + h}]" displayed="true" />'
        )
    return (
        "<?xml version='1.0' encoding='UTF-8' standalone='yes' ?>\n"
        f'<hierarchy index="0" class="hierarchy" rotation="0" width="{WIDTH}" height="{HEIGHT}">\n'
        f'  <android.widget.FrameLayout index="0" package="ua.demo.app" class="android.widget.FrameLayout" '
        f'text="" resource-id="" clickable="false" enabled="true" focusable="false" bounds="[0,0][{WIDTH},{HEIGHT}]" '
        'displayed="true">\n' + "\n".join(nodes) + "\n  </android.widget.FrameLayout>\n</hierarchy>\n"
    )


def runs_of_build(k):
    """Build 0 is the old one; 1..BUILDS the recent ones. -> [(screen, device, os, look, decision)]"""
    out = []
    for screen in SCREENS:
        if screen.get("only") == STALE and k != 0:
            continue
        if k == 0:
            look, decision = 0, ("approve" if screen.get("approve", True) else None)
        else:
            look, decision = screen.get("plan", {}).get(k, (0, None))
        for device, os_name in screen["devices"]:
            out.append((screen, device, os_name, look, decision))
    return out


def backdate_sql(project_id, builds):
    """builds: [(build_id, days_back, [test_run_ids])]. Touches only these rows of this project."""
    ids_given = [project_id]
    for build_id, _, runs in builds:
        ids_given += [build_id, *runs]
    # the ids go into SQL as text, so nothing but an id gets in
    for value in ids_given:
        if not isinstance(value, str) or not UUID.match(value):
            raise ValueError(f"not an id: {value!r}")

    def quoted(ids):
        return ", ".join(f"'{i}'" for i in ids)

    lines = [
        "\\set ON_ERROR_STOP on",
        "BEGIN;",
        # the API and this database must be the same Vision; otherwise change nothing
        f"DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM \"Project\" WHERE id = '{project_id}') THEN "
        "RAISE EXCEPTION 'project % is not in this database', '" + project_id + "'; END IF; END $$;",
    ]
    for build_id, days, runs in builds:
        at = f"now() - interval '{int(days)} days'"
        lines.append(
            f"UPDATE \"Build\" SET \"createdAt\" = {at}, \"updatedAt\" = {at} + interval '20 minutes' "
            f"WHERE id = '{build_id}' AND \"projectId\" = '{project_id}';"
        )
        if not runs:
            continue
        ids = quoted(runs)
        lines += [
            f"UPDATE \"TestRun\" SET \"createdAt\" = {at}, \"updatedAt\" = {at} + interval '3 hours' "
            f"WHERE id IN ({ids}) AND \"projectId\" = '{project_id}';",
            f"UPDATE \"Baseline\" SET \"createdAt\" = {at} + interval '3 hours', \"updatedAt\" = {at} + interval '3 hours' "
            f"WHERE \"testRunId\" IN ({ids});",
        ]
        if days >= OLD_BUILD_DAYS:  # the screens were born then too
            lines.append(
                f"UPDATE \"TestVariation\" SET \"createdAt\" = {at}, \"updatedAt\" = {at} "
                f"WHERE \"projectId\" = '{project_id}' AND id IN "
                f"(SELECT \"testVariationId\" FROM \"TestRun\" WHERE id IN ({ids}));"
            )
    lines.append("COMMIT;")
    return "\n".join(lines) + "\n"


# ---------------------------------------------------------------- talking to Vision

class Api:
    def __init__(self, base):
        self.base = base.rstrip("/")
        self.token = None
        self.key = None

    def call(self, method, path, body=None, auth="jwt"):
        headers = {"Content-Type": "application/json"}
        if auth == "jwt" and self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        if auth == "key":
            headers["apiKey"] = self.key
        request = urllib.request.Request(
            self.base + path, method=method, headers=headers,
            data=json.dumps(body).encode() if body is not None else None,
        )
        try:
            with urllib.request.urlopen(request, timeout=120) as response:
                data = response.read()
                return json.loads(data) if data else None
        except urllib.error.HTTPError as error:
            sys.exit(f"{method} {path} failed ({error.code}): {error.read().decode()[:300]}")
        except urllib.error.URLError as error:
            sys.exit(f"Cannot reach {self.base}: {error.reason}")


def is_vision(api):
    """Only Vision has /users/accounts/enabled; the production VRT answers 404."""
    try:
        with urllib.request.urlopen(api.base + "/users/accounts/enabled", timeout=15) as response:
            return response.read().strip() in (b"true", b"false")
    except (urllib.error.URLError, OSError):
        return False


def project_body(name):
    return {
        "name": name,
        "mainBranchName": "master",
        "autoApproveFeature": False,
        "imageComparison": "pixelmatch",
        "maxBuildAllowed": 100,
        "maxBranchLifetime": 30,
        "imageComparisonConfig": json.dumps({"threshold": 0.1, "ignoreAntialiasing": True, "allowDiffDimensions": False}),
    }


def seed(api, project_name):
    projects = api.call("GET", "/projects")
    project = next((p for p in projects if p["name"] == project_name), None)
    if project is None:
        project = api.call("POST", "/projects", project_body(project_name))
        print(f"created project {project_name!r}")
    images = {}
    builds = []
    for k in range(0, BUILDS + 1):
        build = api.call("POST", "/builds", {"project": project["id"], "branchName": "master"}, auth="key")
        approve, reject, run_ids = [], [], []
        for screen, device, os_name, look, decision in runs_of_build(k):
            key = (screen["name"], look)
            if key not in images:
                rects, elements = screen_layout(screen, look)
                images[key] = (base64.b64encode(png(WIDTH, HEIGHT, rects)).decode(),
                               base64.b64encode(gzip.compress(ui_tree(elements).encode())).decode())
            image, tree = images[key]
            result = api.call("POST", "/test-runs", {
                "name": screen["name"], "imageBase64": image, "uiTree": tree, "deviceDensity": DENSITY,
                "buildId": build["id"], "projectId": project["id"], "branchName": "master",
                "device": device, "os": os_name,
            }, auth="key")
            run_ids.append(result["id"])
            if decision == "approve":
                approve.append(result["id"])
            elif decision == "reject":
                reject.append(result["id"])
        api.call("PATCH", f"/builds/{build['id']}", {}, auth="key")
        if approve:
            api.call("POST", "/test-runs/approve?merge=false", approve)
        if reject:
            api.call("POST", "/test-runs/reject", reject)
        days = OLD_BUILD_DAYS if k == 0 else (BUILDS + 1 - k) * 2
        builds.append((build["id"], days, run_ids))
        print(f"  build {k}/{BUILDS}: {len(run_ids)} screens, {len(approve)} approved, {len(reject)} rejected")
    return project, builds


def backdate(project_id, builds):
    sql = backdate_sql(project_id, builds)
    command = [str(ROOT / "scripts" / "vision.sh"), "exec", "-T", "postgres",
               "sh", "-c", 'psql -q -U "$POSTGRES_USER" -d "$POSTGRES_DB"']
    done = subprocess.run(command, input=sql, text=True, cwd=ROOT)
    if done.returncode != 0:
        sys.exit("Moving the dates failed; the screens are in, but all of them are recent.")


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--email", required=True, help="an admin or editor of Vision")
    parser.add_argument("--project", default="Insights demo")
    parser.add_argument("--api", default=os.environ.get("DEMO_API_URL", "http://localhost:14200"))
    parser.add_argument("--no-backdate", action="store_true", help="leave every date as now (no stale baselines)")
    parser.add_argument("--yes", action="store_true", help="do not ask for confirmation")
    args = parser.parse_args()

    api = Api(args.api)
    if not is_vision(api):
        sys.exit(f"{args.api} is not Vision (no /users/accounts/enabled). Nothing was written.")
    runs = sum(len(runs_of_build(k)) for k in range(BUILDS + 1))
    print(f"Vision at {args.api}: project {args.project!r} gets {BUILDS + 1} builds, {runs} screens")
    if not args.no_backdate:
        print("  then the dates of exactly these rows move back (up to 120 days) in Vision's Postgres")
    if not args.yes and input("Type yes to go on: ").strip() != "yes":
        sys.exit("Stopped; nothing was written.")

    password = os.environ.get("VISION_PASSWORD") or getpass.getpass(f"Password for {args.email}: ")
    login = api.call("POST", "/users/login", {"email": args.email, "password": password}, auth=None)
    api.token, api.key = login["token"], login["apiKey"]

    project, builds = seed(api, args.project)
    if not args.no_backdate:
        backdate(project["id"], builds)
    ui = args.api.replace(os.environ.get("DEMO_API_PORT", "14200"), os.environ.get("DEMO_UI_PORT", "18080"))
    print(f"Done: {ui.rstrip('/')}/insights/{project['id']}")


if __name__ == "__main__":
    main()
