import json
from types import SimpleNamespace

from skill_inspector.llm_assist import CommandJSONProvider, load_provider_from_env


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
