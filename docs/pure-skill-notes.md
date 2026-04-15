# Pure Skill Notes

This reboot removes Python orchestration from the active `skill-inspector` and treats the skill itself as the workflow engine.

Core principles:

- JSON first, HTML second
- preserve template structure
- preserve commands, paths, URLs, and frontmatter keys
- keep translation and suggestions compact and controllable
- keep `install` as a first-class output section
- deduplicate repeated references before writing the final JSON
- when embedding Mermaid or any JSON blob into `<script type="application/json">`, keep the payload valid for `JSON.parse`; do not replace quotes with HTML entities like `&quot;`
- treat embedded JSON as a render boundary worth testing, because a visually empty section can still come from a silent parse failure
