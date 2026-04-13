from pathlib import Path

from skill_inspector.render import render_report


def test_render_report_writes_html_json_and_artifacts(tmp_path: Path) -> None:
    bundle = {"kind": "text", "text": "# Demo Skill", "meta": {"source": "pasted"}}
    analysis = {
        "summary": {"title": "Demo Skill", "purpose": "适用于演示"},
        "translation": {"title_zh": "Demo Skill", "body_zh": "适用于演示"},
        "references": [],
        "score": {"total": 72, "dimensions": {"trigger_clarity": 18}},
        "safety": {"level": "Low", "findings": []},
        "workflow": {
            "nodes": [
                {"id": "input", "label": "Input Source", "category": "input"},
                {"id": "output", "label": "HTML + JSON Report", "category": "output"},
            ],
            "edges": [{"from": "input", "to": "output", "label": "render"}],
        },
        "install": {},
    }

    render_report(output_dir=tmp_path, source_bundle=bundle, analysis=analysis)

    assert (tmp_path / "report.html").exists()
    assert (tmp_path / "report.json").exists()
    assert (tmp_path / "artifacts" / "source.txt").exists()
    html = (tmp_path / "report.html").read_text(encoding="utf-8")
    assert "mermaid" in html
    assert "Input Source" in html
