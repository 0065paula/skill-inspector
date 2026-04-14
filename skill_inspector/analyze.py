import re
from functools import lru_cache

import requests
from .install_probe import probe_installation
from .llm_assist import LLMProvider
from .models import NormalizedDocument


TERM_MAP = {
    "Use when": "适用于",
    "Workflow": "工作流",
    "Steps": "步骤",
    "Reference": "引用",
    "Overview": "概述",
    "When to Use": "何时使用",
    "Invocation": "调用方式",
    "Run:": "运行：",
}

SENSITIVE_CREDENTIAL_PATTERNS = [
    r"\baccess token\b",
    r"\bbearer token\b",
    r"\brefresh token\b",
    r"\bpersonal access token\b",
    r"\bapi[_ -]?key\b",
    r"\bclient[_ -]?secret\b",
    r"\bpassword\b",
    r"\bcookie\b",
    r"\bsession[_ -]?cookie\b",
]


def _translate_text(text: str) -> str:
    translated = text
    for source, target in TERM_MAP.items():
        translated = translated.replace(source, target)
    return translated


def _polish_technical_chinese(text: str) -> str:
    replacements = [
        ("一个通用技能源", "一个通用 skill 来源"),
        ("通用技能源", "通用 skill 来源"),
        ("JSON 工件", "JSON 结果文件"),
        ("人员提供", "用户提供"),
        ("用户提供skill URL", "用户提供 skill URL"),
        ("技能 URL", "skill URL"),
        ("技能链接", "skill 链接"),
        ("技能文件", "skill 文件"),
        ("技能内容", "skill 内容"),
        ("该技能如何发挥作用", "该 skill 的工作机制"),
        ("了解该技能", "理解该 skill"),
        ("了解该 skill 的工作机制", "理解该 skill 的工作机制"),
        ("该技能", "该 skill"),
        ("这个技能", "这个 skill"),
    ]
    polished = text
    for old, new in replacements:
        polished = polished.replace(old, new)
    polished = re.sub(r"(?<=[\u4e00-\u9fff])skill\b", " skill", polished)
    polished = re.sub(r"\bskill(?=[\u4e00-\u9fff])", "skill ", polished)
    polished = re.sub(r"[ \t]{2,}", " ", polished)
    return polished


def _contains_cjk(text: str) -> bool:
    return bool(re.search(r"[\u4e00-\u9fff]", text))


@lru_cache(maxsize=512)
def _translate_via_google(text: str) -> str:
    try:
        response = requests.get(
            "https://translate.googleapis.com/translate_a/single",
            params={
                "client": "gtx",
                "sl": "auto",
                "tl": "zh-CN",
                "dt": "t",
                "q": text,
            },
            timeout=15,
        )
        response.raise_for_status()
        payload = response.json()
        parts = payload[0] if payload and payload[0] else []
        translated = "".join(part[0] for part in parts if part and part[0])
        return translated or text
    except Exception:
        return text


def _translate_markdown_line(line: str, *, title_hint: str | None = None) -> str:
    if not line.strip():
        return line
    if line.strip() in {"---", "```", "```bash", "```sh", "```shell", "```zsh"}:
        return line
    if _contains_cjk(line):
        return _translate_text(line)
    if re.fullmatch(r"[`#>*\-\d.\s]+", line):
        return line

    exact_terms = {
        "Invocation": "调用方式",
        "Run:": "运行：",
        "Overview": "概述",
        "When to Use": "何时使用",
    }

    patterns = [
        r"^(#{1,6}\s+)(.+)$",
        r"^(\s*[-*]\s+)(.+)$",
        r"^(\s*\d+\.\s+)(.+)$",
        r"^(\s*>\s+)(.+)$",
    ]
    for pattern in patterns:
        match = re.match(pattern, line)
        if match:
            prefix, content = match.groups()
            if title_hint and content == title_hint:
                return prefix + _translate_text(content)
            if content in exact_terms:
                return prefix + exact_terms[content]
            return prefix + _translate_via_google(content)
    if line in exact_terms:
        return exact_terms[line]
    return _translate_via_google(line)


def _translate_markdown(text: str, *, title_hint: str | None = None) -> str:
    lines = text.splitlines()
    translated_lines: list[str] = []
    inside_code_fence = False
    inside_frontmatter = False
    for line in lines:
        stripped = line.strip()
        if stripped == "---":
            inside_frontmatter = not inside_frontmatter
            translated_lines.append(line)
            continue
        if inside_frontmatter:
            metadata_match = re.match(r"^([A-Za-z_][\w-]*):(.*)$", line)
            if metadata_match:
                key, value = metadata_match.groups()
                value = value.strip()
                if not value:
                    translated_lines.append(line)
                elif key in {"description", "summary"}:
                    translated_lines.append(f"{key}: {_translate_via_google(value)}")
                else:
                    translated_lines.append(f"{key}: {value}")
            else:
                translated_lines.append(line)
            continue
        if stripped.startswith("```"):
            inside_code_fence = not inside_code_fence
            translated_lines.append(line)
            continue
        if inside_code_fence:
            translated_lines.append(line)
            continue
        translated_lines.append(_translate_markdown_line(line, title_hint=title_hint))
    return _polish_technical_chinese("\n".join(translated_lines))


def _build_translation_job(text: str, *, title_hint: str | None = None) -> tuple[list[dict[str, str]], list[dict[str, str]]]:
    lines = text.splitlines()
    blocks: list[dict[str, str]] = []
    descriptors: list[dict[str, str]] = []
    inside_code_fence = False
    inside_frontmatter = False

    exact_terms = {
        "Invocation": "调用方式",
        "Run:": "运行：",
        "Overview": "概述",
        "When to Use": "何时使用",
    }

    for index, line in enumerate(lines):
        stripped = line.strip()
        if stripped == "---":
            inside_frontmatter = not inside_frontmatter
            descriptors.append({"mode": "literal", "value": line})
            continue
        if inside_frontmatter:
            metadata_match = re.match(r"^([A-Za-z_][\w-]*):(.*)$", line)
            if metadata_match:
                key, value = metadata_match.groups()
                value = value.strip()
                if not value:
                    descriptors.append({"mode": "literal", "value": line})
                elif key in {"description", "summary"}:
                    block_id = f"line-{index}"
                    blocks.append({"id": block_id, "section": "frontmatter", "text": value})
                    descriptors.append({"mode": "frontmatter", "id": block_id, "key": key})
                else:
                    descriptors.append({"mode": "literal", "value": f"{key}: {value}"})
            else:
                descriptors.append({"mode": "literal", "value": line})
            continue
        if stripped.startswith("```"):
            inside_code_fence = not inside_code_fence
            descriptors.append({"mode": "literal", "value": line})
            continue
        if inside_code_fence or not stripped:
            descriptors.append({"mode": "literal", "value": line})
            continue
        if _contains_cjk(line):
            descriptors.append({"mode": "literal", "value": _translate_text(line)})
            continue
        if re.fullmatch(r"[`#>*\-\d.\s]+", line):
            descriptors.append({"mode": "literal", "value": line})
            continue

        patterns = [
            r"^(#{1,6}\s+)(.+)$",
            r"^(\s*[-*]\s+)(.+)$",
            r"^(\s*\d+\.\s+)(.+)$",
            r"^(\s*>\s+)(.+)$",
        ]
        matched = False
        for pattern in patterns:
            match = re.match(pattern, line)
            if match:
                prefix, content = match.groups()
                if title_hint and content == title_hint:
                    descriptors.append({"mode": "literal", "value": prefix + _translate_text(content)})
                elif content in exact_terms:
                    descriptors.append({"mode": "literal", "value": prefix + exact_terms[content]})
                else:
                    block_id = f"line-{index}"
                    blocks.append({"id": block_id, "section": "markdown", "text": content})
                    descriptors.append({"mode": "prefixed", "id": block_id, "prefix": prefix})
                matched = True
                break
        if matched:
            continue
        if line in exact_terms:
            descriptors.append({"mode": "literal", "value": exact_terms[line]})
            continue
        block_id = f"line-{index}"
        blocks.append({"id": block_id, "section": "paragraph", "text": line})
        descriptors.append({"mode": "block", "id": block_id})

    return blocks, descriptors


def _compose_translated_markdown(
    *,
    descriptors: list[dict[str, str]],
    translated_map: dict[str, str],
) -> str:
    translated_lines: list[str] = []

    for descriptor in descriptors:
        mode = descriptor["mode"]
        if mode == "literal":
            translated_lines.append(descriptor["value"])
        elif mode == "frontmatter":
            translated_lines.append(f"{descriptor['key']}: {translated_map.get(descriptor['id'], '')}")
        elif mode == "prefixed":
            translated_lines.append(f"{descriptor['prefix']}{translated_map.get(descriptor['id'], '')}")
        elif mode == "block":
            translated_lines.append(translated_map.get(descriptor["id"], ""))

    return _polish_technical_chinese("\n".join(translated_lines))


def _translate_markdown_with_provider(text: str, *, title_hint: str | None, provider: LLMProvider) -> str:
    blocks, descriptors = _build_translation_job(text, title_hint=title_hint)
    translated_map = provider.translate_blocks(title=title_hint or "Skill Document", blocks=blocks) if blocks else {}
    return _compose_translated_markdown(descriptors=descriptors, translated_map=translated_map)


def _has_clear_trigger(document: NormalizedDocument) -> bool:
    trigger_text = "\n".join(
        [
            document.metadata.get("description", ""),
            document.raw_text,
        ]
    )
    trigger_patterns = [
        r"\bUse when\b",
        r"当用户.*?(要求|需要|提供).*?(时使用|时)",
        r".*时使用",
        r"适用场景",
    ]
    return any(re.search(pattern, trigger_text, re.IGNORECASE) for pattern in trigger_patterns)


def _score_document(document: NormalizedDocument) -> dict[str, object]:
    dimensions = {
        "trigger_clarity": 18 if _has_clear_trigger(document) else 10,
        "structural_quality": min(20, 8 + len(document.sections) * 4),
        "operational_guidance": 16 if document.commands or document.references else 8,
        "reference_hygiene": min(20, 8 + len(document.references) * 4),
        "maintainability": 16 if document.metadata else 12,
    }
    return {"total": sum(dimensions.values()), "dimensions": dimensions}


def _safety_level(document: NormalizedDocument) -> dict[str, object]:
    findings: list[dict[str, str]] = []
    if document.commands:
        findings.append({"signal": "shell-command", "level": "Medium", "evidence": document.commands[0]})
    if any(reference.kind == "url" for reference in document.references):
        first_url = next(reference.target for reference in document.references if reference.kind == "url")
        findings.append({"signal": "external-reference", "level": "Medium", "evidence": first_url})
    credential_match = next(
        (
            re.search(pattern, document.raw_text, re.IGNORECASE)
            for pattern in SENSITIVE_CREDENTIAL_PATTERNS
            if re.search(pattern, document.raw_text, re.IGNORECASE)
        ),
        None,
    )
    if credential_match:
        findings.append(
            {
                "signal": "credential-handling",
                "level": "High",
                "evidence": credential_match.group(0),
            }
        )

    level = "Low"
    if any(item["level"] == "High" for item in findings):
        level = "High"
    elif findings:
        level = "Medium"

    return {"level": level, "findings": findings}


def _workflow(document: NormalizedDocument) -> dict[str, object]:
    nodes = [
        {"id": "input", "label": "Input Source", "category": "input"},
        {"id": "parse", "label": "Normalize Skill", "category": "parse"},
    ]
    edges = [{"from": "input", "to": "parse", "label": "source loaded"}]

    for index, reference in enumerate(document.references, start=1):
        node_id = f"reference_{index}"
        nodes.append(
            {
                "id": node_id,
                "label": reference.target,
                "category": "reference",
                "condition": reference.condition,
            }
        )
        edges.append(
            {
                "from": "parse",
                "to": node_id,
                "label": reference.condition or "reference available",
            }
        )

    nodes.extend(
        [
            {"id": "safety", "label": "Safety Review", "category": "risk"},
            {"id": "output", "label": "HTML + JSON Report", "category": "output"},
        ]
    )
    edges.extend(
        [
            {"from": "parse", "to": "safety", "label": "analyze"},
            {"from": "safety", "to": "output", "label": "render"},
        ]
    )
    return {"nodes": nodes, "edges": edges}


def _suggestions(document: NormalizedDocument, score: dict[str, object], safety: dict[str, object]) -> list[dict[str, str]]:
    suggestions: list[dict[str, str]] = []

    if document.commands and not document.references:
        suggestions.append(
            {
                "title": "补强引用关系",
                "detail": "命令已被识别，但相关脚本或文件路径没有进入引用关系。建议把命令中的脚本路径识别为 reference，并显示触发条件。",
            }
        )
    elif document.commands and any(reference.kind == "file" for reference in document.references):
        suggestions.append(
            {
                "title": "细化命令引用说明",
                "detail": "已识别到脚本路径引用。建议在报告中进一步标明这些脚本是在什么步骤被调用，以及它们对 skill 行为的作用。",
            }
        )

    if score["dimensions"]["reference_hygiene"] < 12:
        suggestions.append(
            {
                "title": "提升引用完整度",
                "detail": "当前引用关系较少或证据不足。建议显式列出关键文档、脚本、模板和外部链接，避免分析结果把重要依赖遗漏掉。",
            }
        )

    if safety["level"] in {"Medium", "High", "Critical"}:
        suggestions.append(
            {
                "title": "补充安全边界说明",
                "detail": "建议明确区分只读操作、命令执行、联网抓取和全局写入，减少安全等级被动抬高时的歧义。",
            }
        )

    if not suggestions:
        suggestions.append(
            {
                "title": "维持当前结构并继续样本回放",
                "detail": "当前 skill 结构基本清晰。建议继续用更多真实 skill 样本回放，验证翻译、引用和安全判断是否稳定。",
            }
        )

    return suggestions


def _provider_suggestions(
    provider: LLMProvider,
    *,
    title: str,
    summary: str,
    sections: list[str],
    references: list[dict[str, str]],
    commands: list[str],
    score: dict[str, object],
    safety: dict[str, object],
) -> list[dict[str, str]] | None:
    try:
        data = provider.generate_insights(
            title=title,
            summary=summary,
            sections=sections,
            references=references,
            commands=commands,
            score=score,
            safety=safety,
        )
    except Exception:
        return None
    suggestions = data.get("suggestions")
    if isinstance(suggestions, list) and suggestions:
        return suggestions
    return None


def build_llm_request(document: NormalizedDocument) -> dict[str, object]:
    purpose = document.metadata.get("description") or document.title
    score = _score_document(document)
    safety = _safety_level(document)
    references = [
        {
            "target": reference.target,
            "kind": reference.kind,
            "condition": reference.condition,
            "line": reference.line,
        }
        for reference in document.references
    ]
    blocks, _ = _build_translation_job(document.raw_text, title_hint=document.title)
    return {
        "translation": {
            "title": document.title,
            "blocks": blocks,
        },
        "insights": {
            "title": document.title,
            "summary": _translate_text(purpose),
            "sections": [section["title"] for section in document.sections],
            "references": references,
            "commands": document.commands,
            "score": score,
            "safety": safety,
        },
    }


def analyze_document(document: NormalizedDocument, llm_provider: LLMProvider | None = None) -> dict[str, object]:
    skill_name = document.metadata.get("name", "skill-inspector")
    lines = [line for line in document.raw_text.splitlines() if line.strip()]
    purpose = document.metadata.get("description")
    if not purpose:
        use_when_line = next((line for line in lines if line.startswith("Use when")), None)
        purpose = use_when_line or document.title

    score = _score_document(document)
    safety = _safety_level(document)
    references = [
        {
            "target": reference.target,
            "kind": reference.kind,
            "condition": reference.condition,
            "line": reference.line,
        }
        for reference in document.references
    ]
    translation_body = (
        _translate_markdown_with_provider(document.raw_text, title_hint=document.title, provider=llm_provider)
        if llm_provider is not None
        else _translate_markdown(document.raw_text, title_hint=document.title)
    )
    suggestions = (
        _provider_suggestions(
            llm_provider,
            title=document.title,
            summary=_translate_text(purpose),
            sections=[section["title"] for section in document.sections],
            references=references,
            commands=document.commands,
            score=score,
            safety=safety,
        )
        if llm_provider is not None
        else None
    )
    if suggestions is None:
        suggestions = _suggestions(document, score, safety)

    return {
        "summary": {
            "title": document.title,
            "purpose": _translate_text(purpose),
        },
        "structure": {
            "metadata": document.metadata,
            "sections": [section["title"] for section in document.sections],
            "commands": document.commands,
            "reference_count": len(document.references),
        },
        "translation": {
            "title_zh": _translate_text(document.title),
            "body_zh": translation_body,
        },
        "references": references,
        "score": score,
        "safety": safety,
        "suggestions": suggestions,
        "workflow": _workflow(document),
        "install": probe_installation(skill_name),
    }
