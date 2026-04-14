import json
from pathlib import Path
from types import SimpleNamespace

from skill_inspector.llm_assist import CommandJSONProvider, PrecomputedJSONProvider, load_provider_from_env


def test_load_provider_from_env_returns_none_when_unset(monkeypatch) -> None:
    monkeypatch.delenv("SKILL_INSPECTOR_LLM_COMMAND", raising=False)

    assert load_provider_from_env() is None


def test_command_json_provider_invokes_command(monkeypatch) -> None:
    recorded: dict[str, object] = {}

    def fake_run(command, input, capture_output, text, check):
        recorded["command"] = command
        recorded["payload"] = json.loads(input)
        return SimpleNamespace(stdout=json.dumps({"translations": {"line-1": "中文"}}))

    monkeypatch.setattr("skill_inspector.llm_assist.subprocess.run", fake_run)
    provider = CommandJSONProvider("python fake_provider.py")

    result = provider.translate_blocks(
        title="Demo Skill",
        blocks=[{"id": "line-1", "section": "body", "text": "Translate me"}],
    )

    assert recorded["command"] == ["python", "fake_provider.py"]
    assert recorded["payload"]["task"] == "translate_blocks"
    assert result == {"line-1": "中文"}


def test_precomputed_json_provider_reads_saved_results(tmp_path: Path) -> None:
    response_file = tmp_path / "llm_response.json"
    response_file.write_text(
        json.dumps(
            {
                "translations": {"line-1": "中文译文"},
                "suggestions": [{"title": "建议", "detail": "细化引用说明。", "priority": "high"}],
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )

    provider = PrecomputedJSONProvider(response_file)

    assert provider.translate_blocks(title="Demo", blocks=[{"id": "line-1", "section": "body", "text": "hello"}]) == {
        "line-1": "中文译文"
    }
    assert provider.generate_insights(
        title="Demo",
        summary="summary",
        sections=[],
        references=[],
        commands=[],
        score={},
        safety={},
    )["suggestions"][0]["title"] == "建议"
