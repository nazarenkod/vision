#!/usr/bin/env python3
"""Checks the documentation against itself and against the code.

    python3 -I scripts/check-docs.py            # from the repository root

- relative links in every Markdown file lead somewhere;
- every spec has a known status, unique requirement ids of its own number,
  and (unless it is a Draft) a design.md that traces every requirement;
- every test a trace names exists and still has that name;
- every repository path a design names in backticks exists;
- every ADR has its status and the sections the template asks for, and the
  indexes of specs and ADRs list every one of them.

Exits 1 and prints each problem when something is off.
"""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SKIP_DIRS = {"node_modules", "build", "test-results", "playwright-report", ".git", "coverage"}
STATUSES = {"Draft", "Approved", "Implemented", "Verified"}
REQ = re.compile(r"\bREQ-(\d{3})-(\d{2})\b")
LINK = re.compile(r"\]\(([^)#\s]+)(?:#[^)]*)?\)")
# `path/to/file.ts › name of the test` — the name may be cut short with …
TRACE = re.compile(r"`([\w./-]+\.(?:ts|tsx|py|java|sh)) › ([^`]+)`")
REPO_PATH = re.compile(r"`((?:backend|frontend|sdk-java|scripts|docs|dist)/[\w./\-\[\]]+)`")
ADR_SECTIONS = ["## Контекст", "## Розглянуті варіанти", "## Рішення", "## Наслідки", "## Як перевіряємо"]


def markdown_files(root: pathlib.Path):
    for path in root.rglob("*.md"):
        if not SKIP_DIRS.intersection(path.relative_to(root).parts):
            yield path


def check_links(root: pathlib.Path):
    problems = []
    for md in markdown_files(root):
        text = re.sub(r"```.*?```", "", md.read_text(encoding="utf-8"), flags=re.S)
        for link in LINK.findall(text):
            if re.match(r"^[a-z]+:", link):
                continue
            if not (md.parent / link).exists():
                problems.append(f"{md.relative_to(root)}: broken link {link}")
    return problems


def status_of(text: str):
    match = re.search(r"\|\s*Статус\s*\|\s*([A-Za-z]+)", text)
    return match.group(1) if match else None


def test_exists(root: pathlib.Path, path: str, name: str):
    file = root / path
    if not file.exists():
        return f"no such test file {path}"
    wanted = name.split("…")[0].strip()
    if wanted and wanted not in file.read_text(encoding="utf-8"):
        return f"{path} has no test named “{wanted}”"
    return None


def check_specs(root: pathlib.Path):
    problems = []
    specs_dir = root / "docs" / "specs"
    index = (specs_dir / "README.md").read_text(encoding="utf-8")
    for folder in sorted(p for p in specs_dir.iterdir() if p.is_dir() and re.match(r"^\d{3}-", p.name)):
        number = folder.name[:3]
        where = folder.relative_to(root)
        spec_file = folder / "spec.md"
        if not spec_file.exists():
            problems.append(f"{where}: no spec.md")
            continue
        spec = spec_file.read_text(encoding="utf-8")
        status = status_of(spec)
        if status not in STATUSES:
            problems.append(f"{where}/spec.md: unknown status {status!r}")
        if f"]({folder.name}/spec.md)" not in index:
            problems.append(f"docs/specs/README.md does not list {folder.name}")
        elif status and not re.search(rf"\]\({re.escape(folder.name)}/spec\.md\)[^\n]*\|\s*{status}\s*\|", index):
            problems.append(f"docs/specs/README.md shows another status for {folder.name} (spec says {status})")

        defined = [m.group(0) for m in REQ.finditer(spec) if spec[max(0, m.start() - 2):m.start()] == "| "]
        for req in defined:
            if req[4:7] != number:
                problems.append(f"{where}/spec.md: {req} belongs to another spec")
        for req in {r for r in defined if defined.count(r) > 1}:
            problems.append(f"{where}/spec.md: {req} is defined twice")

        design_file = folder / "design.md"
        if status == "Draft" and not design_file.exists():
            continue
        if not design_file.exists():
            problems.append(f"{where}: no design.md for a {status} spec")
            continue
        design = design_file.read_text(encoding="utf-8")
        traced = set(REQ.findall(design))
        traced_ids = {f"REQ-{a}-{b}" for a, b in traced}
        # a Draft may have a draft design that traces nothing yet
        for req in defined if status != "Draft" else []:
            if req not in traced_ids:
                problems.append(f"{where}/design.md: {req} is not traced")
        for req in traced_ids - set(defined):
            problems.append(f"{where}/design.md: traces {req}, which the spec does not define")
        for path, name in TRACE.findall(design):
            problem = test_exists(root, path, name)
            if problem:
                problems.append(f"{where}/design.md: {problem}")
        # a draft design names files that are still to be written
        for path in REPO_PATH.findall(design) if status != "Draft" else []:
            if not (root / path.rstrip("/")).exists():
                problems.append(f"{where}/design.md: no such path {path}")
    return problems


def check_adrs(root: pathlib.Path):
    problems = []
    adr_dir = root / "docs" / "decisions"
    index = (adr_dir / "README.md").read_text(encoding="utf-8")
    for adr in sorted(adr_dir.glob("[0-9][0-9][0-9][0-9]-*.md")):
        text = adr.read_text(encoding="utf-8")
        where = adr.relative_to(root)
        if not re.search(r"\|\s*Статус\s*\|\s*(Proposed|Accepted|Deprecated|Superseded by ADR-\d{4})", text):
            problems.append(f"{where}: no known status")
        for section in ADR_SECTIONS:
            if section not in text:
                problems.append(f"{where}: no “{section[3:]}” section")
        if f"]({adr.name})" not in index:
            problems.append(f"docs/decisions/README.md does not list {adr.name}")
    return problems


def main(root: pathlib.Path = ROOT) -> int:
    problems = check_links(root) + check_specs(root) + check_adrs(root)
    for problem in problems:
        print(problem)
    print(f"{len(problems)} problem(s)" if problems else "Documentation is consistent")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
