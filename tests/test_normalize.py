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
- Run: pytest tests/test_demo.py -v
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
    assert document.commands == ["Run: pytest tests/test_demo.py -v"]


def test_normalize_document_uses_metadata_name_when_h1_is_missing() -> None:
    raw = """---
name: audit
description: Use when reviewing quality
---

## Workflow
- Inspect the page
"""

    document = normalize_document(raw)

    assert document.title == "audit"


def test_normalize_document_extracts_shell_commands_from_fenced_blocks() -> None:
    raw = """# Demo Skill

## Commands

```bash
curl -s https://example.com
python scripts/run.py --check
```
"""

    document = normalize_document(raw)

    assert document.commands == [
        "curl -s https://example.com",
        "python scripts/run.py --check",
    ]
