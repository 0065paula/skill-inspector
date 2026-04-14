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


def _split_blocks(text: str) -> list[str]:
    blocks: list[str] = []
    current: list[str] = []
    for line in text.splitlines():
        if not line.strip():
            if current:
                blocks.append("\n".join(current).strip())
                current = []
            continue
        current.append(line)
    if current:
        blocks.append("\n".join(current).strip())
    return blocks


def _paired_translation_sections(original_text: str, translated_text: str) -> list[dict[str, object]]:
    original_sections = _translation_sections(original_text)
    translated_sections = _translation_sections(translated_text)
    total = max(len(original_sections), len(translated_sections))
    sections: list[dict[str, object]] = []

    for index in range(total):
        original = original_sections[index] if index < len(original_sections) else {"title": "", "body": ""}
        translated = translated_sections[index] if index < len(translated_sections) else {"title": "", "body": ""}
        zh_blocks = _split_blocks(translated.get("body", ""))
        en_blocks = _split_blocks(original.get("body", ""))
        block_total = max(len(zh_blocks), len(en_blocks), 1)
        blocks = []
        for block_index in range(block_total):
            blocks.append(
                {
                    "zh": zh_blocks[block_index] if block_index < len(zh_blocks) else "",
                    "en": en_blocks[block_index] if block_index < len(en_blocks) else "",
                }
            )
        sections.append(
            {
                "id": f"translation-{index + 1}",
                "title_zh": translated.get("title") or original.get("title") or f"段落 {index + 1}",
                "title_en": original.get("title") or translated.get("title") or f"Section {index + 1}",
                "blocks": blocks,
            }
        )
    return sections


def _source_meta_items(source_bundle: dict[str, object]) -> list[dict[str, str]]:
    meta = source_bundle.get("meta", {})
    if meta.get("url"):
        return [{"label": "原始链接", "value": str(meta["url"])}]
    if meta.get("path"):
        return [{"label": "本地路径", "value": str(meta["path"])}]
    if meta.get("source"):
        return [{"label": "来源", "value": str(meta["source"])}]
    return [{"label": "输入类型", "value": str(source_bundle.get("kind", "unknown"))}]


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
    translation_sections = _paired_translation_sections(source_bundle["text"], analysis["translation"]["body_zh"])
    nav_items = _nav_items(analysis)
    output_dir.joinpath("report.html").write_text(
        template.render(
            analysis=analysis,
            source=source_bundle,
            mermaid_source=_mermaid_source(analysis["workflow"]),
            mermaid_source_json=json.dumps(_mermaid_source(analysis["workflow"]), ensure_ascii=False),
            translation_sections=translation_sections,
            nav_items=nav_items,
            source_meta_items=_source_meta_items(source_bundle),
        ),
        encoding="utf-8",
    )
