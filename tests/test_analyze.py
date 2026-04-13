from skill_inspector.analyze import analyze_document
from skill_inspector.normalize import normalize_document


def test_analyze_document_builds_scores_and_workflow() -> None:
    raw = """---
name: demo-skill
description: Use when reviewing workflows.
---

# Demo Skill

Use when reviewing workflows.

## Steps
- Read `docs/guide.md` when examples are required
- Run: pytest tests/test_demo.py -v
"""

    analysis = analyze_document(normalize_document(raw))

    assert analysis["summary"]["title"] == "Demo Skill"
    assert analysis["summary"]["purpose"] == "适用于 reviewing workflows."
    assert analysis["score"]["total"] > 0
    assert analysis["workflow"]["nodes"]
    assert any(node["category"] == "reference" for node in analysis["workflow"]["nodes"])
    assert analysis["translation"]["title_zh"] == "Demo Skill"
    assert analysis["safety"]["level"] in {"Low", "Medium", "High", "Critical"}
