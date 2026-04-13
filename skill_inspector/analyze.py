from .install_probe import probe_installation
from .models import NormalizedDocument


TERM_MAP = {
    "Use when": "适用于",
    "Workflow": "工作流",
    "Steps": "步骤",
    "Reference": "引用",
}


def _translate_text(text: str) -> str:
    translated = text
    for source, target in TERM_MAP.items():
        translated = translated.replace(source, target)
    return translated


def _score_document(document: NormalizedDocument) -> dict[str, object]:
    dimensions = {
        "trigger_clarity": 18 if "Use when" in document.raw_text else 10,
        "structural_quality": min(20, 8 + len(document.sections) * 4),
        "operational_guidance": 16 if document.commands or document.references else 8,
        "reference_hygiene": min(20, 8 + len(document.references) * 4),
        "maintainability": 16 if document.metadata else 12,
    }
    return {"total": sum(dimensions.values()), "dimensions": dimensions}


def _safety_level(document: NormalizedDocument) -> dict[str, object]:
    findings: list[dict[str, str]] = []
    if document.commands:
        findings.append({"signal": "shell-command", "level": "Medium"})
    if any(reference.kind == "url" for reference in document.references):
        findings.append({"signal": "external-reference", "level": "Medium"})
    if "token" in document.raw_text.lower():
        findings.append({"signal": "credential-handling", "level": "High"})

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
    purpose = lines[1] if len(lines) > 1 else document.title

    return {
        "summary": {
            "title": document.title,
            "purpose": _translate_text(purpose),
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
