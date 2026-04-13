from skill_inspector.normalize import normalize_document


def test_normalize_document_extracts_sections_and_references() -> None:
    raw = """---
name: demo-skill
description: Use when documenting references
---

# Demo Skill

## Workflow
- Read `docs/reference.md` when the user asks for examples
- Visit https://example.com if the local docs are missing
"""

    document = normalize_document(raw)

    assert document.title == "Demo Skill"
    assert document.metadata["name"] == "demo-skill"
    assert len(document.sections) == 1
    assert [reference.target for reference in document.references] == [
        "docs/reference.md",
        "https://example.com",
    ]
    assert document.references[0].condition == "when the user asks for examples"
