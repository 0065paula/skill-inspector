# Pure Skill Notes

This reboot removes Python orchestration from the active `skill-inspector` and treats the skill itself as the workflow engine.

Core principles:

- JSON first, HTML second
- preserve template structure
- preserve commands, paths, URLs, and frontmatter keys
- keep translation and suggestions compact and controllable
- keep `install` as a first-class output section
- deduplicate repeated references before writing the final JSON
