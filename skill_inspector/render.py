from html import unescape
from pathlib import Path
import json
import re
from urllib.parse import urlparse

from jinja2 import Environment, FileSystemLoader, select_autoescape


MAX_MERMAID_LABEL = 56


def _sanitize_mermaid_text(value: object, *, category: str | None = None) -> str:
    text = unescape(str(value or ""))
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    if category == "reference" and text.startswith(("http://", "https://")):
        parsed = urlparse(text)
        text = f"{parsed.netloc}{parsed.path}"
    text = text.replace('"', "'").replace("[", "(").replace("]", ")").replace("{", "(").replace("}", ")").replace("|", "/")
    if len(text) > MAX_MERMAID_LABEL:
        text = f"{text[: MAX_MERMAID_LABEL - 3]}..."
    return text or "Untitled"


def _mermaid_source(workflow: dict[str, object]) -> str:
    lines = ["flowchart TD"]
    category_to_class = {
        "input": "inputNode",
        "parse": "parseNode",
        "decision": "decisionNode",
        "reference": "referenceNode",
        "risk": "riskNode",
        "output": "outputNode",
    }
    for node in workflow["nodes"]:
        label = _sanitize_mermaid_text(node["label"], category=node.get("category"))
        lines.append(f'{node["id"]}["{label}"]')
        lines.append(f'class {node["id"]} {category_to_class.get(node["category"], "parseNode")}')
    for edge in workflow["edges"]:
        edge_label = _sanitize_mermaid_text(edge["label"])
        lines.append(f'{edge["from"]} -->|{edge_label}| {edge["to"]}')
    lines.extend(
        [
            "classDef inputNode fill:#e0f2fe,stroke:#0369a1,color:#0c4a6e;",
            "classDef parseNode fill:#dcfce7,stroke:#15803d,color:#166534;",
            "classDef decisionNode fill:#fef3c7,stroke:#d97706,color:#92400e;",
            "classDef referenceNode fill:#ede9fe,stroke:#7c3aed,color:#5b21b6;",
            "classDef riskNode fill:#fee2e2,stroke:#dc2626,color:#991b1b;",
            "classDef outputNode fill:#e5e7eb,stroke:#4b5563,color:#1f2937;",
        ]
    )
    return "\n".join(lines)


def _translation_sections(text: str) -> list[dict[str, str]]:
    cleaned = re.sub(r"^---\n.*?\n---\n?", "", text, flags=re.DOTALL).strip()
    if not cleaned:
        return [{"id": "translation-1", "title": "中文整理", "body": ""}]

    sections: list[dict[str, str]] = []
    current_title = "中文整理"
    current_lines: list[str] = []

    def flush() -> None:
        if current_lines or not sections:
            section_id = f"translation-{len(sections) + 1}"
            sections.append(
                {
                    "id": section_id,
                    "title": current_title,
                    "body": "\n".join(current_lines).strip(),
                }
            )

    for line in cleaned.splitlines():
        heading = re.match(r"^(#{1,2})\s+(.*)$", line.strip())
        if heading:
            if current_lines:
                flush()
                current_lines = []
            current_title = heading.group(2).strip()
            continue
        current_lines.append(line)

    flush()
    return [section for section in sections if section["body"] or section["title"]]


def _nav_items(analysis: dict[str, object]) -> list[dict[str, str]]:
    items = [
        {"id": "workflow", "label": "流程图"},
        {"id": "translation", "label": "中文翻译"},
    ]
    if analysis.get("references"):
        items.append({"id": "references", "label": "引用"})
    items.extend(
        [
            {"id": "safety", "label": "安全"},
            {"id": "install", "label": "安装"},
            {"id": "score", "label": "评分"},
            {"id": "source", "label": "来源"},
        ]
    )
    return items


def render_report(*, output_dir: Path, source_bundle: dict[str, object], analysis: dict[str, object]) -> None:
    analysis.setdefault("structure", {"metadata": {}, "sections": [], "commands": [], "reference_count": 0})
    analysis.setdefault("references", [])
    analysis.setdefault("install", {})
    analysis.setdefault("score", {"total": 0, "dimensions": {}})
    analysis.setdefault("safety", {"level": "Unknown", "findings": []})
    analysis.setdefault("translation", {"body_zh": ""})
    analysis.setdefault("summary", {"title": "Untitled Skill", "purpose": ""})

    template_dir = Path(__file__).resolve().parents[1] / "templates"
    env = Environment(
        loader=FileSystemLoader(template_dir),
        autoescape=select_autoescape(["html", "xml"]),
    )
    template = env.get_template("report.html.j2")

    output_dir.mkdir(parents=True, exist_ok=True)
    artifacts_dir = output_dir / "artifacts"
    artifacts_dir.mkdir(exist_ok=True)
    artifacts_dir.joinpath("source.txt").write_text(source_bundle["text"], encoding="utf-8")
    artifacts_dir.joinpath("fetch-meta.json").write_text(
        json.dumps(source_bundle["meta"], ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    payload = {"source": source_bundle, "analysis": analysis}
    output_dir.joinpath("report.json").write_text(
        json.dumps(payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    translation_sections = _translation_sections(analysis["translation"]["body_zh"])
    nav_items = _nav_items(analysis)
    output_dir.joinpath("report.html").write_text(
        template.render(
            analysis=analysis,
            source=source_bundle,
            mermaid_source=_mermaid_source(analysis["workflow"]),
            translation_sections=translation_sections,
            nav_items=nav_items,
        ),
        encoding="utf-8",
    )
