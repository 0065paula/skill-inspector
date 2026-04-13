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
