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


def test_cli_can_dump_llm_request_and_consume_response(tmp_path: Path) -> None:
    source_path = tmp_path / "skill.md"
    source_path.write_text(
        "# Example Skill\n\n## Overview\nAnalyze one generic skill source at a time.\n",
        encoding="utf-8",
    )
    output_dir = tmp_path / "out"
    request_path = tmp_path / "llm_request.json"
    template_path = tmp_path / "llm_response.template.json"
    prompt_path = tmp_path / "llm_prompt.md"
    response_path = tmp_path / "llm_response.json"

    prepare = subprocess.run(
        [
            sys.executable,
            "scripts/skill_inspector.py",
            "--input-file",
            str(source_path),
            "--output-dir",
            str(output_dir),
            "--dump-llm-request",
            str(request_path),
            "--dump-llm-response-template",
            str(template_path),
            "--dump-llm-prompt",
            str(prompt_path),
        ],
        cwd=Path(__file__).resolve().parents[1],
        capture_output=True,
        text=True,
    )

    assert prepare.returncode == 0, prepare.stderr
    payload = json.loads(request_path.read_text(encoding="utf-8"))
    template_payload = json.loads(template_path.read_text(encoding="utf-8"))
    prompt_text = prompt_path.read_text(encoding="utf-8")
    translation_ids = [item["id"] for item in payload["translation"]["blocks"]]
    assert set(template_payload["translations"].keys()) == set(translation_ids)
    assert "请只返回 JSON" in prompt_text
    assert "--llm-response-file" in prepare.stdout
    response_path.write_text(
        json.dumps(
            {
                "translations": {translation_ids[0]: "中文：Analyze one generic skill source at a time."},
                "suggestions": [
                    {"title": "LLM 建议", "detail": "补充结构化说明。", "priority": "high"},
                ],
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )

    run = subprocess.run(
        [
            sys.executable,
            "scripts/skill_inspector.py",
            "--input-file",
            str(source_path),
            "--output-dir",
            str(output_dir),
            "--llm-response-file",
            str(response_path),
        ],
        cwd=Path(__file__).resolve().parents[1],
        capture_output=True,
        text=True,
    )

    assert run.returncode == 0, run.stderr
    report = json.loads((output_dir / "report.json").read_text(encoding="utf-8"))
    assert "中文：Analyze one generic skill source at a time." in report["analysis"]["translation"]["body_zh"]
    assert report["analysis"]["suggestions"][0]["title"] == "LLM 建议"
