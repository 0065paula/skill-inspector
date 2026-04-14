import argparse
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from skill_inspector.analyze import analyze_document
from skill_inspector.fetch import fetch_source
from skill_inspector.llm_assist import load_provider_from_env
from skill_inspector.normalize import normalize_document
from skill_inspector.render import render_report


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input-text")
    parser.add_argument("--input-file", type=Path)
    parser.add_argument("--input-url")
    parser.add_argument("--output-dir", type=Path, required=True)
    args = parser.parse_args()

    bundle = fetch_source(input_text=args.input_text, input_file=args.input_file, input_url=args.input_url)
    document = normalize_document(bundle.text)
    analysis = analyze_document(document, llm_provider=load_provider_from_env())
    render_report(output_dir=args.output_dir, source_bundle=bundle.to_dict(), analysis=analysis)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
