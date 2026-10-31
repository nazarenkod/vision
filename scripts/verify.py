#!/usr/bin/env python3
"""Runs every check of a Vision change with one command.

    python3 -I scripts/verify.py                    # everything, from the repository root
    python3 -I scripts/verify.py --skip-e2e         # without Playwright, while iterating
    python3 -I scripts/verify.py --update-baselines # after fixing a known tsc error

All unit tests of backend and frontend, all functional Playwright tests,
tsc compared with the known errors in scripts/baselines/, eslint on the
changed files, additive-only migrations, the scripts' tests and
check-docs.py. Backend, frontend and scripts run side by side; Playwright
runs after them because it needs the CPU to itself.

Screenshot comparisons are skipped here: they only match inside Docker
(docs/decisions/0011), so they run through frontend/test-docker.sh.

Exits 1 when any check fails; full logs stay in the printed folder.
"""
import argparse
import collections
import os
import pathlib
import re
import subprocess
import sys
import tempfile
import threading
import time

ROOT = pathlib.Path(__file__).resolve().parent.parent
BASELINES = ROOT / "scripts" / "baselines"
LINTED = (".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs")
TSC_ERROR = re.compile(r"^(?P<file>[^\s(][^(]*)\(\d+,\d+\): error (?P<code>TS\d+): (?P<message>.*)$")
# statements that lose or rewrite data; docs/decisions/0003-additive-schema-only.md
DESTRUCTIVE_SQL = re.compile(r"\bdrop\s|\brename\b|\balter\s+type\b|\bset\s+not\s+null\b", re.I)


def tsc_errors(output: str) -> collections.Counter:
    """Errors keyed without line numbers, so an edit above a known error does not make it new."""
    found = collections.Counter()
    for line in output.splitlines():
        match = TSC_ERROR.match(line.strip())
        if match:
            found[f"{match['file']}: {match['code']}: {match['message']}"] += 1
    return found


def compare_with_baseline(current: collections.Counter, baseline: collections.Counter):
    return sorted((current - baseline).elements()), sorted((baseline - current).elements())


def read_baseline(name: str) -> collections.Counter:
    path = BASELINES / f"{name}-tsc.txt"
    if not path.exists():
        return collections.Counter()
    return collections.Counter(line for line in path.read_text(encoding="utf-8").splitlines() if line.strip())


def destructive_statements(sql: str):
    """Lines of a migration that are not additive; SQL comments do not count."""
    lines = []
    for line in sql.splitlines():
        code = line.split("--", 1)[0]
        if DESTRUCTIVE_SQL.search(code):
            lines.append(line.strip())
    return lines


def git(*args: str) -> str:
    done = subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True)
    return done.stdout if done.returncode == 0 else ""


def changed_files(base: str = ""):
    """Files changed since the branch left base, plus uncommitted and untracked ones."""
    # origin/main first: a local main that nobody pulled would count old commits as the change
    candidates = [base] if base else ["origin/main", "main"]
    merge_base = next((m for m in (git("merge-base", "HEAD", c).strip() for c in candidates) if m), "")
    names = set()
    if merge_base:
        names.update(git("diff", "--name-only", merge_base).split())
    names.update(git("diff", "--name-only", "HEAD").split())
    names.update(git("ls-files", "--others", "--exclude-standard").split())
    return sorted(n for n in names if (ROOT / n).is_file())


def lint_targets(files, package: str):
    prefix = f"{package}/"
    return [f[len(prefix):] for f in files if f.startswith(prefix) and f.endswith(LINTED) and "/node_modules/" not in f]


def new_migrations(files):
    return [f for f in files if f.startswith("backend/prisma/migrations/") and f.endswith("migration.sql")]


class Run:
    def __init__(self, logs: pathlib.Path):
        self.logs = logs
        self.results = []
        self.lock = threading.Lock()

    def record(self, name, ok, seconds, note=""):
        with self.lock:
            self.results.append((name, ok, seconds, note))

    def command(self, name, args, cwd, env=None):
        """Runs a command into its own log; returns its output."""
        started = time.time()
        log = self.logs / (re.sub(r"\W+", "-", name).strip("-") + ".log")
        done = subprocess.run(args, cwd=cwd, env={**os.environ, **(env or {})}, capture_output=True, text=True)
        output = done.stdout + done.stderr
        log.write_text(output, encoding="utf-8")
        return done.returncode, output, time.time() - started, log

    def check(self, name, args, cwd, env=None):
        code, output, seconds, log = self.command(name, args, cwd, env)
        self.record(name, code == 0, seconds, "" if code == 0 else f"log: {log}\n{tail(output)}")
        return code == 0

    def tsc(self, package, args, update):
        code, output, seconds, log = self.command(f"{package} tsc", args, ROOT / package)
        current = tsc_errors(output)
        if code != 0 and not current:
            self.record(f"{package} tsc", False, seconds, f"tsc failed without errors to compare; log: {log}\n{tail(output)}")
            return
        if update:
            BASELINES.mkdir(exist_ok=True)
            (BASELINES / f"{package}-tsc.txt").write_text("".join(f"{e}\n" for e in sorted(current.elements())), encoding="utf-8")
            self.record(f"{package} tsc", True, seconds, f"baseline updated: {sum(current.values())} known error(s)")
            return
        new, fixed = compare_with_baseline(current, read_baseline(package))
        notes = []
        if new:
            notes.append("new errors:\n" + "\n".join(f"  {e}" for e in new))
        if fixed:
            notes.append("fixed known errors, run with --update-baselines:\n" + "\n".join(f"  {e}" for e in fixed))
        self.record(f"{package} tsc", not new, seconds, "\n".join(notes))


def tail(output: str, lines: int = 40) -> str:
    return "\n".join(output.rstrip().splitlines()[-lines:])


def backend(run: Run, files, update):
    where = ROOT / "backend"
    run.check("backend unit tests", ["npm", "test", "--silent"], where)
    run.tsc("backend", ["npx", "tsc", "--noEmit", "-p", "tsconfig.json"], update)
    targets = lint_targets(files, "backend")
    if targets:
        run.check("backend eslint (changed files)", ["npx", "eslint", *targets], where)


def frontend(run: Run, files, update):
    where = ROOT / "frontend"
    run.check("frontend unit tests", ["npx", "jest"], where, {"CI": "true"})
    run.tsc("frontend", ["npx", "tsc", "--noEmit", "-p", "."], update)
    targets = lint_targets(files, "frontend")
    if targets:
        run.check("frontend eslint (changed files)", ["npx", "eslint", *targets], where)


def scripts_and_docs(run: Run, files):
    for test in sorted((ROOT / "scripts" / "tests").glob("test_*.py")):
        run.check(f"scripts {test.stem}", [sys.executable, "-I", str(test)], ROOT)
    run.check("docs check-docs.py", [sys.executable, "-I", str(ROOT / "scripts" / "check-docs.py")], ROOT)
    started = time.time()
    problems = []
    for migration in new_migrations(files):
        problems += [f"{migration}: {line}" for line in destructive_statements((ROOT / migration).read_text(encoding="utf-8"))]
    run.record("migrations are additive", not problems, time.time() - started, "\n".join(problems))


def playwright(run: Run):
    # The line reporter: the configured html one opens a browser on failure and waits
    run.check(
        "frontend playwright (no screenshots)",
        ["npx", "playwright", "test", "--ignore-snapshots", "--reporter=line"],
        ROOT / "frontend",
    )


def missing_dependencies():
    return [p for p in ("backend", "frontend") if not (ROOT / p / "node_modules").is_dir()]


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--skip-e2e", action="store_true", help="do not run Playwright")
    parser.add_argument("--update-baselines", action="store_true", help="write the current tsc errors as the known ones")
    parser.add_argument("--base", default="", help="branch the change started from (default: origin/main, else main)")
    args = parser.parse_args(argv)

    missing = missing_dependencies()
    if missing:
        print(f"No node_modules in {', '.join(missing)}: run npm ci there first.")
        return 1

    logs = pathlib.Path(tempfile.mkdtemp(prefix="vision-verify-"))
    run = Run(logs)
    files = changed_files(args.base)
    started = time.time()
    jobs = [
        threading.Thread(target=backend, args=(run, files, args.update_baselines)),
        threading.Thread(target=frontend, args=(run, files, args.update_baselines)),
        threading.Thread(target=scripts_and_docs, args=(run, files)),
    ]
    for job in jobs:
        job.start()
    for job in jobs:
        job.join()
    if not args.skip_e2e:
        playwright(run)

    failed = [r for r in run.results if not r[1]]
    for name, ok, seconds, note in sorted(run.results, key=lambda r: (r[1], r[0])):
        print(f"{'ok  ' if ok else 'FAIL'}  {seconds:6.1f}s  {name}")
        if note:
            print("\n".join(f"        {line}" for line in note.splitlines()))
    if args.skip_e2e:
        print("skip  Playwright (--skip-e2e)")
    print(f"\n{len(failed)} failed, {len(run.results) - len(failed)} passed in {time.time() - started:.0f}s; logs: {logs}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
