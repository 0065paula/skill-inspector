# Skill Inspector

一个面向 agent 的 skill，用于分析单个 skill 来源，并生成：

- `report.json`
- `report.html`

当前版本是纯 skill 工作流，不依赖 Python 分析脚本。  
agent 需要先读取目标 skill，再按 `templates/report.schema.json` 生成结构化 `report.json`，最后填充 `templates/report.html`。

适用场景：

- 分析本地 skill 文件
- 分析贴入的 skill 全文
- 分析远程 skill 链接
- 输出可读的 HTML 报告与结构化 JSON

## Workflow

1. 读取目标 skill 内容。
2. 按 `templates/report.schema.json` 生成 `report.json`。
3. 使用结构化数据填充 `templates/report.html`。
4. 将 `report.json` 和 `report.html` 写入 `out/` 目录。

注意事项：

- 必须先生成 JSON，再生成 HTML
- references 需要去重
- `suggestions` 不能为空
- `install` 字段必须始终存在，即使当前结果只是启发式判断

## 示例页面

- GitHub Pages 示例：<https://0065paula.github.io/skill-inspector/>

## Key Files

- `SKILL.md`: 主工作流与约束
- `templates/report.html`: 报告 HTML 模板
- `templates/report.schema.json`: 输出 JSON 的结构约束
- `templates/report.example.json`: 示例输出
- `prompts/translation.md`: 翻译规则
- `prompts/insights.md`: 建议、评分说明与安全表达规则
