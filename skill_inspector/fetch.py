from pathlib import Path
from urllib.parse import urlparse

import requests
from bs4 import BeautifulSoup

from .models import SourceBundle, read_text_file


def _html_to_text(html: str) -> str:
    soup = BeautifulSoup(html, "html.parser")
    main = soup.find("main") or soup.body or soup
    return main.get_text("\n", strip=True)


def _canonicalize_remote_url(url: str) -> str:
    parsed = urlparse(url)
    path = parsed.path.strip("/")
    parts = path.split("/")

    if parsed.netloc == "github.com" and len(parts) >= 5 and parts[2] == "blob":
        owner, repo = parts[0], parts[1]
        branch = parts[3]
        remainder = "/".join(parts[4:])
        return f"https://raw.githubusercontent.com/{owner}/{repo}/{branch}/{remainder}"

    if parsed.netloc == "gist.github.com" and len(parts) >= 2:
        owner, gist_id = parts[0], parts[1]
        return f"https://gist.githubusercontent.com/{owner}/{gist_id}/raw"

    return url


def fetch_source(*, input_text: str | None, input_file: Path | None, input_url: str | None) -> SourceBundle:
    provided = [value is not None for value in (input_text, input_file, input_url)]
    if sum(provided) != 1:
        raise ValueError("Provide exactly one input source")

    if input_text is not None:
        return SourceBundle(kind="text", text=input_text, meta={"source": "pasted"})

    if input_file is not None:
        return SourceBundle(kind="file", text=read_text_file(input_file), meta={"path": str(input_file)})

    request_url = _canonicalize_remote_url(input_url)
    response = requests.get(request_url, timeout=15)
    response.raise_for_status()
    content_type = response.headers.get("content-type", "")
    text = response.text if "html" not in content_type else _html_to_text(response.text)
    return SourceBundle(
        kind="url",
        text=text,
        meta={
            "url": input_url,
            "request_url": request_url,
            "resolved_url": response.url,
            "content_type": content_type,
            "status_code": response.status_code,
        },
    )
