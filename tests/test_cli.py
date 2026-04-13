from pathlib import Path
import subprocess
import sys


def test_cli_writes_report_directory(tmp_path: Path) -> None:
    source_path = tmp_path / "skill.md"
    source_path.write_text("# Example Skill\n\nUse when parsing docs.\n", encoding="utf-8")
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
    assert (output_dir / "report.json").exists()
    assert (output_dir / "report.html").exists()
