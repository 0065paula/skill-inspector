from __future__ import annotations

import json
import os
import shlex
import subprocess
from typing import Any, Protocol


TRANSLATION_SYSTEM_PROMPT = """You are a technical documentation translator.

Translate only natural-language content into concise, high-quality Simplified Chinese.
Keep the output controlled and minimal.

Rules:
- Preserve product names, framework names, tool names, and proper nouns in English.
- Preserve commands, code, file paths, URLs, environment variables, and frontmatter keys exactly.
- Do not add explanations, summaries, or commentary.
- Do not omit information.
- Prefer product/technical documentation tone: natural, precise, readable.
- Return JSON only.
"""


INSIGHT_SYSTEM_PROMPT = """You are reviewing an AI agent skill as a technical editor.

Return concise, actionable suggestions only.

Rules:
- Focus on structure, reference quality, maintainability, and safety boundaries.
- Avoid generic advice.
- Keep each suggestion short and specific.
- Return JSON only.
"""


AGENT_BRIDGE_PROMPT_TEMPLATE = """请基于 `llm_request.json` 生成 `llm_response.json`。

要求：
- 请只返回 JSON，不要输出解释。
- `translations` 的 key 必须与请求中的 block id 一一对应。
- 只翻译自然语言内容；命令、路径、URL、代码、frontmatter key 保持原样。
- 中文风格：精简、高质量、可控，偏产品/技术文档。
- `suggestions` 保持简短、具体、可执行。

输出 JSON 结构：
{
  "translations": {
    "line-2": "..."
  },
  "suggestions": [
    {
      "title": "...",
      "detail": "...",
      "priority": "high"
    }
  ]
}
"""


class LLMProvider(Protocol):
    def translate_blocks(self, *, title: str, blocks: list[dict[str, str]]) -> dict[str, str]:
        ...

    def generate_insights(
        self,
        *,
        title: str,
        summary: str,
        sections: list[str],
        references: list[dict[str, str]],
        commands: list[str],
        score: dict[str, object],
        safety: dict[str, object],
    ) -> dict[str, Any]:
        ...


class CommandJSONProvider:
    def __init__(self, command: str) -> None:
        self.command = shlex.split(command)

    def _run(self, payload: dict[str, Any]) -> dict[str, Any]:
        result = subprocess.run(
            self.command,
            input=json.dumps(payload, ensure_ascii=False),
            capture_output=True,
            text=True,
            check=True,
        )
        return json.loads(result.stdout)

    def translate_blocks(self, *, title: str, blocks: list[dict[str, str]]) -> dict[str, str]:
        payload = {
            "task": "translate_blocks",
            "system_prompt": TRANSLATION_SYSTEM_PROMPT,
            "title": title,
            "blocks": blocks,
        }
        data = self._run(payload)
        return data.get("translations", {})

    def generate_insights(
        self,
        *,
        title: str,
        summary: str,
        sections: list[str],
        references: list[dict[str, str]],
        commands: list[str],
        score: dict[str, object],
        safety: dict[str, object],
    ) -> dict[str, Any]:
        payload = {
            "task": "generate_insights",
            "system_prompt": INSIGHT_SYSTEM_PROMPT,
            "title": title,
            "summary": summary,
            "sections": sections,
            "references": references,
            "commands": commands,
            "score": score,
            "safety": safety,
        }
        return self._run(payload)


class PrecomputedJSONProvider:
    def __init__(self, response_file: str | os.PathLike[str]) -> None:
        self.response_file = response_file

    def _load(self) -> dict[str, Any]:
        return json.loads(open(self.response_file, encoding="utf-8").read())

    def translate_blocks(self, *, title: str, blocks: list[dict[str, str]]) -> dict[str, str]:
        data = self._load()
        return data.get("translations", {})

    def generate_insights(
        self,
        *,
        title: str,
        summary: str,
        sections: list[str],
        references: list[dict[str, str]],
        commands: list[str],
        score: dict[str, object],
        safety: dict[str, object],
    ) -> dict[str, Any]:
        return self._load()


def load_provider_from_env() -> LLMProvider | None:
    command = os.environ.get("SKILL_INSPECTOR_LLM_COMMAND")
    if not command:
        return None
    return CommandJSONProvider(command)


def build_response_template(request_payload: dict[str, Any]) -> dict[str, Any]:
    translation_ids = [item["id"] for item in request_payload.get("translation", {}).get("blocks", [])]
    return {
        "translations": {block_id: "" for block_id in translation_ids},
        "suggestions": [
            {
                "title": "",
                "detail": "",
                "priority": "high",
            }
        ],
    }
