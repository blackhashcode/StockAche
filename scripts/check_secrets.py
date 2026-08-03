#!/usr/bin/env python
"""Scan git-tracked files for credentials that must never be committed.

    python scripts/check_secrets.py            # scan everything git tracks
    python scripts/check_secrets.py --staged   # scan only what is staged

Exits non-zero when something is found, so it works as a pre-commit hook and
as a CI step. Install the hook with:

    python scripts/check_secrets.py --install-hook
"""

from __future__ import annotations

import argparse
import base64
import json
import pathlib
import re
import subprocess
import sys

REPO = pathlib.Path(__file__).resolve().parent.parent

# Files that are *supposed* to describe secrets without containing them.
ALLOWLIST_NAMES = {"check_secrets.py", ".gitignore"}
ALLOWLIST_SUFFIXES = {".example"}

# (label, compiled pattern, severity)
PATTERNS: list[tuple[str, re.Pattern, str]] = [
    ("Supabase secret key", re.compile(r"sb_secret_[A-Za-z0-9_\-]{8,}"), "critical"),
    (
        "Google OAuth client secret",
        re.compile(r"GOCSPX-[A-Za-z0-9_\-]{10,}"),
        "critical",
    ),
    (
        "Django SECRET_KEY assignment",
        re.compile(r"DJANGO_SECRET_KEY\s*=\s*['\"]?[^\s'\"#]{20,}"),
        "warning",
    ),
    (
        "Postgres connection string with password",
        re.compile(r"postgres(?:ql)?://[^:\s]+:[^@\s]{4,}@"),
        "critical",
    ),
    ("Private key block", re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----"), "critical"),
]

# JWTs need decoding rather than pattern matching: an anon token is fine to
# ship to the browser, a service_role token is a full admin credential.
JWT_RE = re.compile(r"eyJ[A-Za-z0-9_\-]{8,}\.([A-Za-z0-9_\-]{8,})\.[A-Za-z0-9_\-]{8,}")

# Documentation is full of connection-string templates. Anything carrying
# angle brackets, braces, or an obvious filler word is a placeholder, not a
# credential -- flagging those trains people to ignore the scanner.
PLACEHOLDER_RE = re.compile(
    r"[<>{}]|\b(your|example|changeme|change-me|placeholder|xxx+|redacted|dummy|"
    r"password|secret|token|key)\b",
    re.IGNORECASE,
)


def looks_like_placeholder(text: str) -> bool:
    return bool(PLACEHOLDER_RE.search(text))


def tracked_files(staged: bool) -> list[pathlib.Path]:
    cmd = (
        ["git", "diff", "--cached", "--name-only", "--diff-filter=ACM"]
        if staged
        else ["git", "ls-files"]
    )
    out = subprocess.run(cmd, cwd=REPO, capture_output=True, text=True, check=True)
    paths = []
    for line in out.stdout.splitlines():
        p = REPO / line.strip()
        if not line.strip() or not p.is_file():
            continue
        if p.name in ALLOWLIST_NAMES or p.suffix in ALLOWLIST_SUFFIXES:
            continue
        paths.append(p)
    return paths


def jwt_role(payload_segment: str) -> str | None:
    try:
        seg = payload_segment + "=" * (-len(payload_segment) % 4)
        return json.loads(base64.urlsafe_b64decode(seg)).get("role")
    except Exception:
        return None


def scan(path: pathlib.Path) -> list[tuple[str, int, str, str]]:
    try:
        text = path.read_text(encoding="utf-8", errors="ignore")
    except OSError:
        return []

    findings = []
    rel = path.relative_to(REPO).as_posix()

    for lineno, line in enumerate(text.splitlines(), 1):
        for label, pattern, severity in PATTERNS:
            match = pattern.search(line)
            if match and not looks_like_placeholder(match.group(0)):
                findings.append((rel, lineno, label, severity))

        for match in JWT_RE.finditer(line):
            role = jwt_role(match.group(1))
            if role == "service_role":
                findings.append((rel, lineno, "Supabase service_role JWT", "critical"))
            elif role == "anon":
                findings.append((rel, lineno, "Supabase anon JWT", "warning"))

    return findings


HOOK = """#!/bin/sh
# Installed by scripts/check_secrets.py
python scripts/check_secrets.py --staged || exit 1
"""


def install_hook() -> int:
    hooks = REPO / ".git" / "hooks"
    if not hooks.is_dir():
        print("No .git/hooks directory found — is this a git repository?")
        return 1
    target = hooks / "pre-commit"
    target.write_text(HOOK, encoding="utf-8")
    target.chmod(0o755)
    print(f"Installed pre-commit hook at {target}")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--staged", action="store_true", help="scan staged files only")
    parser.add_argument("--install-hook", action="store_true", help="install pre-commit hook")
    args = parser.parse_args()

    if args.install_hook:
        return install_hook()

    findings = []
    for path in tracked_files(args.staged):
        findings.extend(scan(path))

    if not findings:
        scope = "staged files" if args.staged else "tracked files"
        print(f"No credentials found in {scope}.")
        return 0

    critical = [f for f in findings if f[3] == "critical"]
    print("Potential credentials found:\n")
    for rel, lineno, label, severity in findings:
        marker = "CRITICAL" if severity == "critical" else "warning "
        print(f"  {marker}  {rel}:{lineno}  {label}")

    print()
    if critical:
        print(f"{len(critical)} critical finding(s). Commit blocked.")
        print("Move the value into a gitignored .env file and rotate the exposed key.")
        return 1

    print("Warnings only — nothing blocking.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
