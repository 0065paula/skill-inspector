from pathlib import Path
import json
import subprocess
import sys


def test_cli_writes_report_directory(tmp_path: Path) -> None:
    source_path = tmp_path / "skill.md"
    source_path.write_text(
        "# Example Skill\n\nUse when parsing docs.\n\n## Workflow\n- Read `docs/reference.md` when examples are requested\n",
        encoding="utf-8",
    )
    output_dir = tmp_path / "out"

    result = subprocess.run(
        [
            sys.executable,
            "scripts/skill_inspector.py",
            "--input-file",
            str(source_path),
            "--output-dir",
            str(output_dir),
        ],
        cwd=Path(__file__).resolve().parents[1],
        capture_output=True,
        text=True,
    )

    assert result.returncode == 0, result.stderr
    payload = json.loads((output_dir / "report.json").read_text(encoding="utf-8"))
    assert payload["analysis"]["workflow"]["nodes"]
    assert payload["analysis"]["score"]["total"] > 0
    html = (output_dir / "report.html").read_text(encoding="utf-8")
    assert "docs/reference.md" in html
    assert "执行逻辑" in html
