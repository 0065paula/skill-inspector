from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any


@dataclass(slots=True)
class SourceBundle:
    kind: str
    text: str
    meta: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(slots=True)
class Reference:
    target: str
    kind: str
    line: str
    condition: str | None


@dataclass(slots=True)
class NormalizedDocument:
    title: str
    metadata: dict[str, Any]
    sections: list[dict[str, Any]]
    references: list[Reference]
    commands: list[str]
    raw_text: str


def read_text_file(path: Path) -> str:
    return path.read_text(encoding="utf-8")
