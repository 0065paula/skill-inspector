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


def test_analyze_document_scores_chinese_trigger_descriptions() -> None:
    raw = """---
name: smartx-industry-page
description: 生成响应式 SmartX 行业解决方案页面，保持品牌一致性。当用户要求创建行业页面、解决方案页面时使用。
---

# SmartX 行业页面生成器
"""

    analysis = analyze_document(normalize_document(raw))

    assert analysis["score"]["dimensions"]["trigger_clarity"] >= 16


def test_analyze_document_does_not_treat_design_tokens_as_credentials() -> None:
    raw = """# Demo Skill

## 参考文件
- 读取 `design-tokens/base.md`
- 读取 `design-tokens/finance.md`
"""

    analysis = analyze_document(normalize_document(raw))

    assert analysis["safety"]["level"] == "Low"
    assert not any(finding["signal"] == "credential-handling" for finding in analysis["safety"]["findings"])


def test_analyze_document_does_not_treat_design_tokens_language_as_credentials() -> None:
    raw = """# Demo Skill

- 使用 `var(--token-name)`
- 不要使用旧 token
"""

    analysis = analyze_document(normalize_document(raw))

    assert analysis["safety"]["level"] == "Low"
    assert not any(finding["signal"] == "credential-handling" for finding in analysis["safety"]["findings"])
