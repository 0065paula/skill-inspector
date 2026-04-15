# Workflow Generation Prompt

Role: derive a structured workflow graph from a skill source and express it as `workflow.caption`, `workflow.nodes`, and `workflow.edges`.

Goal:

- Produce a workflow graph that is easy for humans to read
- Reflect the real execution structure rather than the document layout
- Prefer a small number of meaningful nodes over line-by-line transcription

Rules:

- Model the primary execution path first
- Use serial edges for steps that must happen in order
- Use branch edges only when the source presents true alternatives or parallel high-level paths
- Use reference or resource nodes for files, schemas, examples, or docs that a step depends on
- Connect a resource node to the step that uses it, or connect the step to the resource when the graph reads more naturally; keep this consistent within one graph
- Keep labels short and action-oriented
- Do not turn every bullet into a node
- Do not treat explanatory prose, placeholders, or formatting notes as workflow nodes
- Prefer one shared validation node when multiple paths converge on the same check
- Prefer one terminal output node when multiple paths end in the same write or publish step

Node guidance:

- `kind: "decision"` for branching choice points
- `kind: "reference"` for examples, schemas, specs, and supporting docs
- `kind: "terminal"` for final write, publish, or completion steps
- Omit `kind` for normal action nodes

Edge guidance:

- Use plain edges for sequence
- Use `label` only when the label adds real meaning, such as a branch name or trigger condition
- Keep edge labels short

When the source contains stage headings such as `Step 1`, `Step 2`, `Step 3`:

- Prefer a serial main path
- Do not convert those stages into parallel branches

When the source contains grouped high-level workflows under sibling headings:

- Prefer one decision node that branches to those workflows

When the source references specs, schemas, or example files:

- Include them only if they materially affect execution or correctness

Output shape:

```json
{
  "workflow": {
    "caption": "Short description of how the graph should be read.",
    "nodes": [
      { "id": "input", "label": "Receive task" },
      { "id": "branch", "label": "Select workflow", "kind": "decision" },
      { "id": "schema", "label": "templates/report.schema.json", "kind": "reference" },
      { "id": "write", "label": "Write report", "kind": "terminal" }
    ],
    "edges": [
      { "from": "input", "to": "branch" },
      { "from": "branch", "to": "write", "label": "Default path" },
      { "from": "schema", "to": "write", "label": "Conforms to schema" }
    ]
  }
}
```
