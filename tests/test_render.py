from pathlib import Path

from skill_inspector.render import render_report


def test_render_report_writes_html_json_and_artifacts(tmp_path: Path) -> None:
    bundle = {"kind": "text", "text": "# Demo Skill", "meta": {"source": "pasted"}}
    analysis = {
        "summary": {"title": "Demo Skill", "purpose": "适用于演示"},
        "structure": {"metadata": {"name": "demo-skill"}, "sections": ["Workflow"], "commands": [], "reference_count": 1},
        "translation": {"title_zh": "Demo Skill", "body_zh": "# Demo Skill\n\n## 工作流\n适用于演示"},
        "references": [{"target": "https://example.com/docs", "kind": "url", "condition": "when docs are missing", "line": "Visit https://example.com/docs"}],
        "score": {"total": 72, "dimensions": {"trigger_clarity": 18}},
        "safety": {"level": "Low", "findings": []},
        "workflow": {
            "nodes": [
                {"id": "input", "label": "Input Source", "category": "input"},
                {
                    "id": "reference_1",
                    "label": 'https://gist.github.com/octocat/123.js"></script>',
                    "category": "reference",
                },
                {"id": "output", "label": "HTML + JSON Report", "category": "output"},
            ],
            "edges": [
                {"from": "input", "to": "reference_1", "label": "when docs are missing"},
                {"from": "reference_1", "to": "output", "label": "render"},
            ],
        },
        "install": {
            "Codex": {"status": "Installed", "checked_paths": ["/Users/example/.codex/skills"], "matches": ["/Users/example/.codex/skills/demo-skill"]},
        },
    }

    render_report(output_dir=tmp_path, source_bundle=bundle, analysis=analysis)

    assert (tmp_path / "report.html").exists()
    assert (tmp_path / "report.json").exists()
    assert (tmp_path / "artifacts" / "source.txt").exists()
    html = (tmp_path / "report.html").read_text(encoding="utf-8")
    assert "mermaid" in html
    assert 'href="#workflow"' in html
    assert 'id="workflow"' in html
    assert "全屏查看" in html
    assert "中文翻译" in html
    assert "引用关系" in html
    assert "安装情况" in html
    assert "Input Source" in html
    assert 'gist.github.com/octocat/123.js"></script>' not in html
    assert ".js&quot;&gt;&lt;/script&gt;" not in html
    assert 'id="mermaid-viewer"' in html
    assert "viewer-graph" in html
    assert "workflow-graph" in html
    assert "图例" not in html
    assert "输入类型" in html
    assert "来源" in html
    assert "{'source': 'pasted'}" not in html
