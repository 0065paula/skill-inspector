from pathlib import Path


PLATFORM_PATHS = {
    "Codex": [Path.home() / ".agents" / "skills", Path.home() / ".codex" / "skills"],
    "Kimi CLI": [Path.home() / ".kimi" / "skills", Path.home() / ".config" / "kimi" / "skills"],
    "Claude": [Path.home() / ".claude" / "skills", Path.home() / ".config" / "claude" / "skills"],
    "Gemini": [Path.home() / ".gemini" / "skills", Path.home() / ".config" / "gemini" / "skills"],
    "Hermes Agent": [Path.home() / ".hermes" / "skills", Path.home() / ".config" / "hermes-agent" / "skills"],
}


def probe_installation(skill_name: str) -> dict[str, dict[str, object]]:
    results: dict[str, dict[str, object]] = {}
    for platform, paths in PLATFORM_PATHS.items():
        checked = [str(path) for path in paths]
        matches = [str(path / skill_name) for path in paths if (path / skill_name).exists()]
        status = "Installed" if matches else "Not Found"
        results[platform] = {
            "status": status,
            "checked_paths": checked,
            "matches": matches,
        }
    return results
