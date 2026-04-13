from pathlib import Path
import json

from jinja2 import Environment, FileSystemLoader, select_autoescape


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
        lines.append(f'{node["id"]}["{node["label"]}"]')
        lines.append(f'class {node["id"]} {category_to_class.get(node["category"], "parseNode")}')
    for edge in workflow["edges"]:
        lines.append(f'{edge["from"]} -->|{edge["label"]}| {edge["to"]}')
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


def render_report(*, output_dir: Path, source_bundle: dict[str, object], analysis: dict[str, object]) -> None:
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
    output_dir.joinpath("report.html").write_text(
        template.render(
            analysis=analysis,
            source=source_bundle,
            mermaid_source=_mermaid_source(analysis["workflow"]),
        ),
        encoding="utf-8",
    )
