import re
from typing import Any

import yaml

from .models import NormalizedDocument, Reference


FRONTMATTER_RE = re.compile(r"^---\n(.*?)\n---\n", re.DOTALL)
SECTION_RE = re.compile(r"^##\s+(.*)$", re.MULTILINE)
PATH_RE = re.compile(r"`([^`]+\.(?:md|txt|py|sh|json|yaml|yml))`")
URL_RE = re.compile(r"https?://\S+")
CONDITION_RE = re.compile(r"\bwhen\b(.+)$", re.IGNORECASE)
FENCE_RE = re.compile(r"^```(bash|sh|shell|zsh)\s*$", re.IGNORECASE)


def _reference_kind(target: str) -> str:
    return "url" if target.startswith("http") else "file"


def normalize_document(raw_text: str) -> NormalizedDocument:
    metadata: dict[str, Any] = {}
    match = FRONTMATTER_RE.match(raw_text)
    body = raw_text
    if match:
        metadata = yaml.safe_load(match.group(1)) or {}
        body = raw_text[match.end() :]

    title_match = re.search(r"^#\s+(.*)$", body, re.MULTILINE)
    title = title_match.group(1).strip() if title_match else metadata.get("name", "Untitled Skill")

    sections: list[dict[str, Any]] = [{"title": section_title} for section_title in SECTION_RE.findall(body)]
    references: list[Reference] = []
    commands: list[str] = []
    inside_shell_fence = False

    for line in body.splitlines():
        stripped = line.strip()

        if stripped == "```" and inside_shell_fence:
            inside_shell_fence = False
            continue
        if FENCE_RE.match(stripped):
            inside_shell_fence = True
            continue

        command_line = stripped[2:].strip() if stripped.startswith("- ") else stripped
        if inside_shell_fence and command_line and not command_line.startswith("#"):
            commands.append(command_line)
        elif command_line.startswith(("Run:", "Command:", "$ ")):
            commands.append(command_line)

        condition_match = CONDITION_RE.search(stripped)
        condition = f"when{condition_match.group(1)}".strip() if condition_match else None

        for target in PATH_RE.findall(stripped):
            references.append(
                Reference(
                    target=target,
                    kind=_reference_kind(target),
                    line=stripped,
                    condition=condition,
                )
            )

        for target in URL_RE.findall(stripped):
            references.append(
                Reference(
                    target=target.rstrip(").,"),
                    kind="url",
                    line=stripped,
                    condition=condition,
                )
            )

    return NormalizedDocument(
        title=title,
        metadata=metadata,
        sections=sections,
        references=references,
        commands=commands,
        raw_text=raw_text,
    )
