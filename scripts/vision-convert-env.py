#!/usr/bin/env python3
"""Converts the settings of an older Vision for this version, before its first start.

    python3 -I scripts/vision-convert-env.py [--env-file .env.demo] [--jira-hosts jira.bank.example] [--yes]

What changes, and why:
  - VRT_* settings get their VISION_* names (041); a VISION_* already set wins.
  - VISION_SECRET_KEY is made when there is none (044): it seals Jira tokens and Gemini keys,
    and the API does not start without it. One already set is kept: a new one would make
    everyone enter their tokens again. One the API refuses (an example, under 32 characters, 051)
    is replaced: the API would not start with it.
  - VISION_JIRA_HOSTS from --jira-hosts (044): without hosts Vision calls no Jira.
  - JWT_SECRET is new: everyone signs in again, sessions of the old version open nothing.
  - POSTGRES_DB keeps the database the old version used (vrt_demo) when it was never set:
    the new default (vision) would point at a database the data volume does not have.
  - DEMO_POSTGRES_PORT goes: Vision's database has no port on the host any more.

The file is shown changed with secrets masked, and written only after `yes` (or --yes),
the old one kept beside it. Nothing else is touched: no container, no database.
"""
import argparse
import datetime
import pathlib
import re
import secrets
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
OLD_POSTGRES_DB = "vrt_demo"
SECRET = re.compile(r"SECRET|PASSWORD|TOKEN|_KEY$", re.I)
PLACEHOLDER = {"", "change-me", "changeme"}
# the API does not start with a shorter one (051, backend/src/shared/server-secrets.ts)
MIN_SECRET_LENGTH = 32


def refused_key(value):
    # compose reads KEY="value" without the quotes, and so does the API
    value = value.strip()
    if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
        value = value[1:-1].strip()
    return value.lower() in PLACEHOLDER or value.lower().startswith("change-me") or len(value) < MIN_SECRET_LENGTH
LINE = re.compile(r"^(?P<key>[A-Za-z_][A-Za-z0-9_]*)=(?P<value>.*)$")


def new_secret():
    return secrets.token_urlsafe(32)


def convert(text, jira_hosts=None, make_secret=new_secret):
    """The new text, and what changed: (key, before, after, why), before or after None when absent."""
    lines = text.splitlines()
    values = {}
    for line in lines:
        match = LINE.match(line.strip())
        if match:
            values[match["key"]] = match["value"]

    out, changes, seen = [], [], set()
    for line in lines:
        match = LINE.match(line.strip())
        if not match:
            out.append(line)
            continue
        key, value = match["key"], match["value"]
        if key.startswith("VRT_"):
            renamed = "VISION_" + key[len("VRT_"):]
            if renamed in values or renamed in seen:
                changes.append((key, value, None, f"{renamed} is set already"))
            else:
                out.append(f"{renamed}={value}")
                seen.add(renamed)
                changes.append((key, value, None, f"now {renamed}"))
            continue
        if key == "DEMO_POSTGRES_PORT":
            changes.append((key, value, None, "the database has no host port any more"))
            continue
        if key == "JWT_SECRET":
            fresh = make_secret()
            out.append(f"{key}={fresh}")
            changes.append((key, value, fresh, "new: everyone signs in again"))
            continue
        if key == "VISION_SECRET_KEY" and refused_key(value):
            fresh = make_secret()
            out.append(f"{key}={fresh}")
            changes.append((key, value, fresh, "made: seals Jira tokens and Gemini keys; keep it"))
            continue
        if key == "VISION_JIRA_HOSTS" and jira_hosts is not None and value != jira_hosts:
            out.append(f"{key}={jira_hosts}")
            changes.append((key, value, jira_hosts, "Jira hosts a token may go to"))
            continue
        out.append(line)

    added = []
    if "VISION_SECRET_KEY" not in values:
        fresh = make_secret()
        added.append(("VISION_SECRET_KEY", fresh,
                      "# Seals Jira tokens and Gemini keys in the database: keep it, a new one makes\n"
                      "# everyone enter their tokens again"))
        changes.append(("VISION_SECRET_KEY", None, fresh, "made: seals Jira tokens and Gemini keys; keep it"))
    if "VISION_JIRA_HOSTS" not in values:
        hosts = jira_hosts or ""
        added.append(("VISION_JIRA_HOSTS", hosts, "# Jira hosts a personal token may go to; empty: Vision calls no Jira"))
        changes.append(("VISION_JIRA_HOSTS", None, hosts,
                        "Jira hosts a token may go to" if hosts else "empty: no Jira until hosts are set"))
    if "POSTGRES_DB" not in values:
        added.append(("POSTGRES_DB", OLD_POSTGRES_DB, "# the database the older version created in the data volume"))
        changes.append(("POSTGRES_DB", None, OLD_POSTGRES_DB, "keeps the database of the older version"))
    if added:
        out.append("")
        out.append("## Added for this version (scripts/vision-convert-env.py)")
        for key, value, comment in added:
            out.extend([comment, f"{key}={value}"])
    return "\n".join(out) + "\n", changes


def shown(key, value):
    if value is None:
        return "—"
    if SECRET.search(key) and value:
        return value[:2] + "…" if len(value) > 8 else "***"
    return value or '""'


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--env-file", default=str(ROOT / ".env.demo"))
    parser.add_argument("--jira-hosts", help="host names of the bank's Jira, comma-separated")
    parser.add_argument("--yes", action="store_true", help="write without asking")
    args = parser.parse_args(argv)

    path = pathlib.Path(args.env_file)
    if not path.is_file():
        print(f"!!  No {path}: nothing to convert.", file=sys.stderr)
        return 1
    hosts = None
    if args.jira_hosts is not None:
        hosts = ",".join(host.strip().lower() for host in args.jira_hosts.split(",") if host.strip())
    text, changes = convert(path.read_text(encoding="utf-8"), hosts)
    if not changes:
        print(f"==> {path} needs no changes.")
        return 0

    print(f"==> {path}:")
    for key, before, after, why in changes:
        print(f"    {key}: {shown(key, before)} → {shown(key, after)}  ({why})")
    if not args.yes:
        answer = input("Write these changes? Type yes: ").strip()
        if answer != "yes":
            print("Nothing was written.")
            return 1
    kept = path.with_name(f"{path.name}.before-vision-{datetime.datetime.now():%Y%m%d-%H%M%S}")
    kept.write_text(path.read_text(encoding="utf-8"), encoding="utf-8")
    kept.chmod(0o600)
    path.write_text(text, encoding="utf-8")
    path.chmod(0o600)
    print(f"==> Written. The old file is {kept}.")
    if not hosts and not any(key == "VISION_JIRA_HOSTS" and after for key, _, after, _ in changes):
        print("    VISION_JIRA_HOSTS is empty: Vision calls no Jira until it lists the bank's Jira host.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
