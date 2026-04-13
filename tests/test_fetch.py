from pathlib import Path

from skill_inspector.fetch import fetch_source


def test_fetch_source_reads_local_file(tmp_path: Path) -> None:
    skill_file = tmp_path / "skill.md"
    skill_file.write_text("# Title\n\nUse when local.\n", encoding="utf-8")

    bundle = fetch_source(input_text=None, input_file=skill_file, input_url=None)

    assert bundle.kind == "file"
    assert bundle.text.startswith("# Title")
    assert bundle.meta["path"] == str(skill_file)


def test_fetch_source_uses_pasted_text() -> None:
    bundle = fetch_source(input_text="# Title\n\nUse when pasted.\n", input_file=None, input_url=None)

    assert bundle.kind == "text"
    assert "pasted" in bundle.text


def test_fetch_source_rewrites_github_blob_urls(monkeypatch) -> None:
    seen: dict[str, str] = {}

    class Response:
        status_code = 200
        headers = {"content-type": "text/plain"}
        text = "# Demo Skill"
        url = "https://raw.githubusercontent.com/openai/example/main/SKILL.md"

        def raise_for_status(self) -> None:
            return None

    def fake_get(url: str, timeout: int) -> Response:
        seen["url"] = url
        return Response()

    monkeypatch.setattr("skill_inspector.fetch.requests.get", fake_get)

    bundle = fetch_source(
        input_text=None,
        input_file=None,
        input_url="https://github.com/openai/example/blob/main/SKILL.md",
    )

    assert seen["url"] == "https://raw.githubusercontent.com/openai/example/main/SKILL.md"
    assert bundle.text == "# Demo Skill"


def test_fetch_source_rewrites_gist_urls(monkeypatch) -> None:
    seen: dict[str, str] = {}

    class Response:
        status_code = 200
        headers = {"content-type": "text/plain"}
        text = "# Demo Skill"
        url = "https://gist.githubusercontent.com/octocat/123/raw"

        def raise_for_status(self) -> None:
            return None

    def fake_get(url: str, timeout: int) -> Response:
        seen["url"] = url
        return Response()

    monkeypatch.setattr("skill_inspector.fetch.requests.get", fake_get)

    bundle = fetch_source(
        input_text=None,
        input_file=None,
        input_url="https://gist.github.com/octocat/123",
    )

    assert seen["url"] == "https://gist.githubusercontent.com/octocat/123/raw"
    assert bundle.text == "# Demo Skill"
