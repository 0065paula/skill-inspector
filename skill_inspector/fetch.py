from pathlib import Path

import requests
from bs4 import BeautifulSoup

from .models import SourceBundle, read_text_file


def _html_to_text(html: str) -> str:
    soup = BeautifulSoup(html, "html.parser")
    main = soup.find("main") or soup.body or soup
    return main.get_text("\n", strip=True)


def fetch_source(*, input_text: str | None, input_file: Path | None, input_url: str | None) -> SourceBundle:
    provided = [value is not None for value in (input_text, input_file, input_url)]
    if sum(provided) != 1:
        raise ValueError("Provide exactly one input source")

    if input_text is not None:
        return SourceBundle(kind="text", text=input_text, meta={"source": "pasted"})

    if input_file is not None:
        return SourceBundle(kind="file", text=read_text_file(input_file), meta={"path": str(input_file)})

    response = requests.get(input_url, timeout=15)
    response.raise_for_status()
    content_type = response.headers.get("content-type", "")
    text = response.text if "html" not in content_type else _html_to_text(response.text)
    return SourceBundle(
        kind="url",
        text=text,
        meta={
            "url": input_url,
            "resolved_url": response.url,
            "content_type": content_type,
            "status_code": response.status_code,
        },
    )
