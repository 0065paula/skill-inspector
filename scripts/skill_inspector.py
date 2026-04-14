import argparse
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from skill_inspector.analyze import analyze_document, build_llm_request
from skill_inspector.fetch import fetch_source
from skill_inspector.llm_assist import PrecomputedJSONProvider, load_provider_from_env
from skill_inspector.normalize import normalize_document
from skill_inspector.render import render_report


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input-text")
    parser.add_argument("--input-file", type=Path)
    parser.add_argument("--input-url")
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--dump-llm-request", type=Path)
    parser.add_argument("--llm-response-file", type=Path)
    args = parser.parse_args()

    bundle = fetch_source(input_text=args.input_text, input_file=args.input_file, input_url=args.input_url)
    document = normalize_document(bundle.text)
    if args.dump_llm_request is not None:
        args.dump_llm_request.parent.mkdir(parents=True, exist_ok=True)
        args.dump_llm_request.write_text(
            json.dumps(build_llm_request(document), ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

    provider = (
        PrecomputedJSONProvider(args.llm_response_file)
        if args.llm_response_file is not None
        else load_provider_from_env()
    )
    analysis = analyze_document(document, llm_provider=provider)
    render_report(output_dir=args.output_dir, source_bundle=bundle.to_dict(), analysis=analysis)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
