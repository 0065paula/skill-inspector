import argparse
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from skill_inspector.analyze import analyze_document, build_llm_request
from skill_inspector.fetch import fetch_source
from skill_inspector.llm_assist import (
    AGENT_BRIDGE_PROMPT_TEMPLATE,
    PrecomputedJSONProvider,
    build_response_template,
    load_provider_from_env,
)
from skill_inspector.normalize import normalize_document
from skill_inspector.render import render_report


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input-text")
    parser.add_argument("--input-file", type=Path)
    parser.add_argument("--input-url")
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--dump-llm-request", type=Path)
    parser.add_argument("--dump-llm-response-template", type=Path)
    parser.add_argument("--dump-llm-prompt", type=Path)
    parser.add_argument("--llm-response-file", type=Path)
    args = parser.parse_args()

    bundle = fetch_source(input_text=args.input_text, input_file=args.input_file, input_url=args.input_url)
    document = normalize_document(bundle.text)
    llm_request = build_llm_request(document)
    if args.dump_llm_request is not None:
        args.dump_llm_request.parent.mkdir(parents=True, exist_ok=True)
        args.dump_llm_request.write_text(
            json.dumps(llm_request, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
    if args.dump_llm_response_template is not None:
        args.dump_llm_response_template.parent.mkdir(parents=True, exist_ok=True)
        args.dump_llm_response_template.write_text(
            json.dumps(build_response_template(llm_request), ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
    if args.dump_llm_prompt is not None:
        args.dump_llm_prompt.parent.mkdir(parents=True, exist_ok=True)
        args.dump_llm_prompt.write_text(AGENT_BRIDGE_PROMPT_TEMPLATE, encoding="utf-8")

    provider = (
        PrecomputedJSONProvider(args.llm_response_file)
        if args.llm_response_file is not None
        else load_provider_from_env()
    )
    analysis = analyze_document(document, llm_provider=provider)
    render_report(output_dir=args.output_dir, source_bundle=bundle.to_dict(), analysis=analysis)
    if args.dump_llm_request is not None:
        response_hint = args.llm_response_file or Path("out/llm_response.json")
        print(
            "Next step:\n"
            f"python scripts/skill_inspector.py --input-file {args.input_file} "
            f"--output-dir {args.output_dir} --llm-response-file {response_hint}"
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
