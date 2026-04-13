import argparse
from pathlib import Path
import json
import sys

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from skill_inspector.fetch import fetch_source


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input-text")
    parser.add_argument("--input-file", type=Path)
    parser.add_argument("--input-url")
    parser.add_argument("--output-dir", type=Path, required=True)
    args = parser.parse_args()

    bundle = fetch_source(input_text=args.input_text, input_file=args.input_file, input_url=args.input_url)
    args.output_dir.mkdir(parents=True, exist_ok=True)
    args.output_dir.joinpath("report.json").write_text(
        json.dumps({"source": bundle.to_dict()}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    args.output_dir.joinpath("report.html").write_text(
        "<html><body>stub</body></html>",
        encoding="utf-8",
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
