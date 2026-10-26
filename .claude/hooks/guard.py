#!/usr/bin/env python3
"""PreToolUse hook: stops shell commands that break Vision's hard rules.

AGENTS.md states the rules; an agent may still slip, so this hook enforces
the ones whose breach cannot be undone (docs/decisions/0002, 0001, 0003):

- docker compose only through ./scripts/vision.sh (the pinned "vision" project);
- no pruning or removing Docker volumes, and no stopping or removing
  containers that are not Vision's: production runs on the same host;
- git push only to the "vision" remote ("origin" is upstream VRT);
- no database resets, drops or data-losing schema pushes.

Reads the hook JSON on stdin; exits 2 with the reason on stderr to block,
0 to let the normal permission flow decide.
"""
import json
import re
import shlex
import sys

SEGMENT = re.compile(r"\|\||&&|;|\||\n|\$\(|`")


def words(segment: str) -> list[str]:
    try:
        return shlex.split(segment, comments=True)
    except ValueError:
        return segment.split()


def after_env(tokens: list[str]) -> list[str]:
    """Drops leading VAR=value assignments and wrappers like sudo, nice, env."""
    rest = list(tokens)
    while rest and (re.match(r"^[A-Za-z_][A-Za-z0-9_]*=", rest[0]) or rest[0] in {"sudo", "nice", "env", "time", "exec"}):
        rest.pop(0)
    return rest


def positional(tokens: list[str]) -> list[str]:
    """Arguments that are not options (and not the values of -c / -C)."""
    out, skip = [], False
    for token in tokens:
        if skip:
            skip = False
            continue
        if token in {"-c", "-C", "--git-dir", "--work-tree"}:
            skip = True
            continue
        if not token.startswith("-"):
            out.append(token)
    return out


def check_segment(segment: str):
    tokens = after_env(words(segment.strip()))
    if not tokens:
        return None
    program = tokens[0].rsplit("/", 1)[-1]
    args = positional(tokens[1:])

    if program == "docker-compose" or (program == "docker" and args[:1] == ["compose"]):
        return "docker compose runs only through ./scripts/vision.sh: it pins the 'vision' project and refuses foreign containers (ADR-0002)."
    if program == "docker":
        verb = args[0] if args else ""
        if verb in {"system", "volume", "container", "image", "network"} and args[1:2] and args[1] in {"prune", "rm"}:
            return f"'docker {verb} {args[1]}' can delete production's data on this host. Do it by hand if you really mean it (ADR-0002)."
        if verb in {"rm", "stop", "kill", "restart"}:
            targets = args[1:]
            foreign = [t for t in targets if "vision" not in t]
            if not targets or foreign:
                return f"'docker {verb}' only on Vision's containers (names with 'vision'); refused for: {', '.join(foreign) or 'no container named'} (ADR-0002)."
    if program == "git" and "push" in args:
        rest = args[args.index("push") + 1:]
        if not rest or rest[0] != "vision":
            return "git push goes only to the 'vision' remote: git push vision mvp/demo:main ('origin' is upstream VRT, ADR-0001)."
    if program in {"npx", "prisma"} or "prisma" in tokens[:3]:
        joined = " ".join(tokens)
        if re.search(r"\bmigrate\s+reset\b", joined) or re.search(r"\bdb\s+push\b.*--(force-reset|accept-data-loss)", joined):
            return "Database resets and data-losing pushes are not allowed; migrations are additive (ADR-0003)."
    if program == "dropdb" or (program == "pg_restore" and ("--clean" in tokens or "-c" in tokens)):
        return f"'{program}' deletes data; run it by hand against Vision's own database only (ADR-0002)."
    if re.search(r"\bDROP\s+(DATABASE|SCHEMA)\b", segment, re.I):
        return "DROP DATABASE / DROP SCHEMA is not allowed from an agent (ADR-0002)."
    return None


def check(command: str):
    for segment in SEGMENT.split(command):
        reason = check_segment(segment)
        if reason:
            return reason
    return None


def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except json.JSONDecodeError:
        return 0
    if payload.get("tool_name") != "Bash":
        return 0
    reason = check(payload.get("tool_input", {}).get("command", ""))
    if reason:
        print(f"Blocked by .claude/hooks/guard.py: {reason}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
