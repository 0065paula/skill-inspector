import re

from .install_probe import probe_installation
from .models import NormalizedDocument


TERM_MAP = {
    "Use when": "适用于",
    "Workflow": "工作流",
    "Steps": "步骤",
    "Reference": "引用",
}

SENSITIVE_CREDENTIAL_PATTERNS = [
    r"\baccess token\b",
    r"\bbearer token\b",
    r"\brefresh token\b",
    r"\bpersonal access token\b",
    r"\bapi[_ -]?key\b",
    r"\bclient[_ -]?secret\b",
    r"\bpassword\b",
    r"\bcookie\b",
    r"\bsession[_ -]?cookie\b",
]


def _translate_text(text: str) -> str:
    translated = text
    for source, target in TERM_MAP.items():
        translated = translated.replace(source, target)
    return translated


def _has_clear_trigger(document: NormalizedDocument) -> bool:
    trigger_text = "\n".join(
        [
            document.metadata.get("description", ""),
            document.raw_text,
        ]
    )
    trigger_patterns = [
        r"\bUse when\b",
        r"当用户.*?(要求|需要|提供).*?(时使用|时)",
        r".*时使用",
        r"适用场景",
    ]
    return any(re.search(pattern, trigger_text, re.IGNORECASE) for pattern in trigger_patterns)


def _score_document(document: NormalizedDocument) -> dict[str, object]:
    dimensions = {
        "trigger_clarity": 18 if _has_clear_trigger(document) else 10,
        "structural_quality": min(20, 8 + len(document.sections) * 4),
        "operational_guidance": 16 if document.commands or document.references else 8,
        "reference_hygiene": min(20, 8 + len(document.references) * 4),
        "maintainability": 16 if document.metadata else 12,
    }
    return {"total": sum(dimensions.values()), "dimensions": dimensions}


def _safety_level(document: NormalizedDocument) -> dict[str, object]:
    findings: list[dict[str, str]] = []
    if document.commands:
        findings.append({"signal": "shell-command", "level": "Medium", "evidence": document.commands[0]})
    if any(reference.kind == "url" for reference in document.references):
        first_url = next(reference.target for reference in document.references if reference.kind == "url")
        findings.append({"signal": "external-reference", "level": "Medium", "evidence": first_url})
    credential_match = next(
        (
            re.search(pattern, document.raw_text, re.IGNORECASE)
            for pattern in SENSITIVE_CREDENTIAL_PATTERNS
            if re.search(pattern, document.raw_text, re.IGNORECASE)
        ),
        None,
    )
    if credential_match:
        findings.append(
            {
                "signal": "credential-handling",
                "level": "High",
                "evidence": credential_match.group(0),
            }
        )

    level = "Low"
    if any(item["level"] == "High" for item in findings):
        level = "High"
    elif findings:
        level = "Medium"

    return {"level": level, "findings": findings}


def _workflow(document: NormalizedDocument) -> dict[str, object]:
    nodes = [
        {"id": "input", "label": "Input Source", "category": "input"},
        {"id": "parse", "label": "Normalize Skill", "category": "parse"},
    ]
    edges = [{"from": "input", "to": "parse", "label": "source loaded"}]

    for index, reference in enumerate(document.references, start=1):
        node_id = f"reference_{index}"
        nodes.append(
            {
                "id": node_id,
                "label": reference.target,
                "category": "reference",
                "condition": reference.condition,
            }
        )
        edges.append(
            {
                "from": "parse",
                "to": node_id,
                "label": reference.condition or "reference available",
            }
        )

    nodes.extend(
        [
            {"id": "safety", "label": "Safety Review", "category": "risk"},
            {"id": "output", "label": "HTML + JSON Report", "category": "output"},
        ]
    )
    edges.extend(
        [
            {"from": "parse", "to": "safety", "label": "analyze"},
            {"from": "safety", "to": "output", "label": "render"},
        ]
    )
    return {"nodes": nodes, "edges": edges}


def analyze_document(document: NormalizedDocument) -> dict[str, object]:
    skill_name = document.metadata.get("name", "skill-inspector")
    lines = [line for line in document.raw_text.splitlines() if line.strip()]
    purpose = document.metadata.get("description")
    if not purpose:
        use_when_line = next((line for line in lines if line.startswith("Use when")), None)
        purpose = use_when_line or document.title

    return {
        "summary": {
            "title": document.title,
            "purpose": _translate_text(purpose),
        },
        "structure": {
            "metadata": document.metadata,
            "sections": [section["title"] for section in document.sections],
            "commands": document.commands,
            "reference_count": len(document.references),
        },
        "translation": {
            "title_zh": _translate_text(document.title),
            "body_zh": _translate_text(document.raw_text),
        },
        "references": [
            {
                "target": reference.target,
                "kind": reference.kind,
                "condition": reference.condition,
                "line": reference.line,
            }
            for reference in document.references
        ],
        "score": _score_document(document),
        "safety": _safety_level(document),
        "workflow": _workflow(document),
        "install": probe_installation(skill_name),
    }
