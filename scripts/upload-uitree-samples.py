#!/usr/bin/env python3
"""Upload screenshots with their Appium UI trees as one VRT build.

Takes a folder of pairs exported from Appium Inspector (or saved by a test):
    Payment.png + Payment.xml, Transfer.png + Transfer.xml, ...
and sends each pair as a test run, so the accessibility checks and the
element-level diff can be shown without a device at hand.

    ./scripts/upload-uitree-samples.py samples/ --project "Mobile app" \
        --api http://localhost:14200 --api-key KEY --device "Pixel 7" --density 420
"""
import argparse
import base64
import gzip
import json
import pathlib
import sys
import urllib.error
import urllib.request


def call(api, key, method, path, body=None):
    request = urllib.request.Request(
        api.rstrip("/") + path,
        method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={"Content-Type": "application/json", "apiKey": key},
    )
    try:
        with urllib.request.urlopen(request) as response:
            data = response.read()
            return json.loads(data) if data else None
    except urllib.error.HTTPError as error:
        sys.exit(f"{method} {path} failed ({error.code}): {error.read().decode()[:300]}")


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("folder", type=pathlib.Path)
    parser.add_argument("--project", required=True, help="project name or id")
    parser.add_argument("--api", default="http://localhost:14200")
    parser.add_argument("--api-key", required=True)
    parser.add_argument("--branch", default="master")
    parser.add_argument("--device", default="")
    parser.add_argument("--os", default="")
    parser.add_argument("--density", type=int, help="Android screen density in dpi")
    args = parser.parse_args()

    pairs = [(png, png.with_suffix(".xml")) for png in sorted(args.folder.glob("*.png"))]
    if not pairs:
        sys.exit(f"No .png files in {args.folder}")

    build = call(args.api, args.api_key, "POST", "/builds", {"project": args.project, "branchName": args.branch})
    print(f"build #{build.get('number')} {build['id']}")
    for png, xml in pairs:
        body = {
            "name": png.stem,
            "imageBase64": base64.b64encode(png.read_bytes()).decode(),
            "buildId": build["id"],
            "projectId": build["projectId"],
            "branchName": args.branch,
            "device": args.device,
            "os": args.os,
        }
        if xml.exists():
            body["uiTree"] = base64.b64encode(gzip.compress(xml.read_bytes())).decode()
            if args.density:
                body["deviceDensity"] = args.density
        result = call(args.api, args.api_key, "POST", "/test-runs", body)
        a11y = result.get("a11y")
        a11y_text = f", a11y {a11y['newCount']} new / {a11y['totalCount']}" if a11y else ", no UI tree"
        print(f"  {png.stem}: {result['status']}{a11y_text}")
    call(args.api, args.api_key, "PATCH", f"/builds/{build['id']}", {})
    print(result["url"].split("&testId=")[0])


if __name__ == "__main__":
    main()
