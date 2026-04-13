from pathlib import Path
import argparse
import json


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input-file", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    args = parser.parse_args()

    args.output_dir.mkdir(parents=True, exist_ok=True)
    args.output_dir.joinpath("report.json").write_text(
        json.dumps({"source": str(args.input_file)}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    args.output_dir.joinpath("report.html").write_text(
        "<html><body>stub</body></html>",
        encoding="utf-8",
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
