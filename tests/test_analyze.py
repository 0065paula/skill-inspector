from types import SimpleNamespace

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


def test_analyze_document_translates_english_markdown(monkeypatch) -> None:
    calls: list[str] = []

    def fake_get(url: str, params: dict[str, str], timeout: int):
        calls.append(params["q"])
        return SimpleNamespace(
            raise_for_status=lambda: None,
            json=lambda: [[["中文：" + params["q"], params["q"], None, None]]],
        )

    monkeypatch.setattr("skill_inspector.analyze.requests.get", fake_get)

    raw = """# Writing Integration Skills

## Step 1
Research the integration path
"""

    analysis = analyze_document(normalize_document(raw))

    assert "中文：Research the integration path" in analysis["translation"]["body_zh"]
    assert calls


def test_analyze_document_falls_back_when_translation_request_fails(monkeypatch) -> None:
    def fake_get(url: str, params: dict[str, str], timeout: int):
        raise RuntimeError("translation service failed")

    monkeypatch.setattr("skill_inspector.analyze.requests.get", fake_get)

    raw = """# Writing Integration Skills

Research the integration path
"""

    analysis = analyze_document(normalize_document(raw))

    assert "Research the integration path" in analysis["translation"]["body_zh"]


def test_analyze_document_uses_better_translation_for_invocation_label(monkeypatch) -> None:
    def fake_get(url: str, params: dict[str, str], timeout: int):
        return SimpleNamespace(
            raise_for_status=lambda: None,
            json=lambda: [[["祈求", params["q"], None, None]]],
        )

    monkeypatch.setattr("skill_inspector.analyze.requests.get", fake_get)

    raw = """# Skill Inspector

## Invocation

Run:
"""

    analysis = analyze_document(normalize_document(raw))

    assert "# Skill Inspector" in analysis["translation"]["body_zh"]
    assert "调用方式" in analysis["translation"]["body_zh"]
    assert "## 调用方式" in analysis["translation"]["body_zh"]
    assert "运行：" in analysis["translation"]["body_zh"]


def test_analyze_document_generates_optimization_suggestions() -> None:
    raw = """# Skill Inspector

## Invocation

Run:

```bash
python scripts/skill_inspector.py --input-file examples/sample_generic_skill.md --output-dir out/sample
```
"""

    analysis = analyze_document(normalize_document(raw))

    assert analysis["suggestions"]
    assert any("引用" in item["title"] or "reference" in item["title"].lower() for item in analysis["suggestions"])


class StubProvider:
    def translate_blocks(self, *, title: str, blocks: list[dict[str, str]]) -> dict[str, str]:
        return {block["id"]: f"LLM:{block['text']}" for block in blocks}

    def generate_insights(self, **kwargs):
        return {
            "suggestions": [
                {"title": "LLM 建议", "detail": "由 provider 生成的建议。", "priority": "high"},
            ]
        }


def test_analyze_document_uses_llm_provider_for_translation_and_suggestions() -> None:
    raw = """# Skill Inspector

## Overview

Analyze one generic skill source at a time.
"""

    analysis = analyze_document(normalize_document(raw), llm_provider=StubProvider())

    assert "LLM:Analyze one generic skill source at a time." in analysis["translation"]["body_zh"]
    assert analysis["suggestions"][0]["title"] == "LLM 建议"


class FailingProvider:
    def translate_blocks(self, *, title: str, blocks: list[dict[str, str]]) -> dict[str, str]:
        raise RuntimeError("provider unavailable")

    def generate_insights(self, **kwargs):
        raise RuntimeError("provider unavailable")


def test_analyze_document_falls_back_when_llm_provider_fails() -> None:
    raw = """# Skill Inspector

## Invocation

Run:
"""

    analysis = analyze_document(normalize_document(raw), llm_provider=FailingProvider())

    assert "调用方式" in analysis["translation"]["body_zh"]
    assert analysis["suggestions"]


def test_analyze_document_polishes_machine_translation_into_product_doc_style(monkeypatch) -> None:
    translations = {
        "Analyze one generic skill source at a time and generate a static Chinese-first HTML report plus JSON artifacts.": "一次分析一个通用技能源，并生成静态的中文优先 HTML 报告和 JSON 工件。",
        "A human provides a skill URL, local path, or full text": "人员提供技能 URL、本地路径或全文",
        "The task requires understanding how the skill works": "该任务需要了解该技能如何发挥作用",
    }

    def fake_get(url: str, params: dict[str, str], timeout: int):
        text = translations.get(params["q"], params["q"])
        return SimpleNamespace(
            raise_for_status=lambda: None,
            json=lambda: [[[text, params["q"], None, None]]],
        )

    monkeypatch.setattr("skill_inspector.analyze.requests.get", fake_get)

    raw = """# Skill Inspector

Analyze one generic skill source at a time and generate a static Chinese-first HTML report plus JSON artifacts.
- A human provides a skill URL, local path, or full text
- The task requires understanding how the skill works
"""

    analysis = analyze_document(normalize_document(raw))
    body = analysis["translation"]["body_zh"]

    assert "一个通用 skill 来源" in body
    assert "JSON 结果文件" in body
    assert "用户提供 skill URL、本地路径或全文" in body
    assert "理解该 skill 的工作机制" in body
    assert "技能源" not in body
    assert "人员提供" not in body
    assert "该技能如何发挥作用" not in body
