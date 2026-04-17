# Workflow Generation Prompt

Role: derive a structured workflow graph from a skill source and express it as `workflow.caption`, `workflow.nodes`, and `workflow.edges`.

Goal:

- Produce a workflow graph that is easy for humans to read
- Reflect the real execution structure rather than the document layout
- Keep output stable across models by following the same compression and graph-selection protocol

## Generation Protocol

Follow these steps in order before writing the final graph:

1. Determine the workflow family from the source:
   - `serial_procedure`: mostly one ordered path
   - `branching_workflow`: explicit alternatives or high-level sibling workflows
   - `iterative_loop`: repeated refine / evaluate / retry cycles
   - `phase_serial`: explicit phase headings form the primary ordered backbone
   - `phase_with_internal_steps`: explicit phases exist and each phase contains meaningful internal execution steps
   - `reference_driven_workflow`: references materially gate correct execution
   - `hybrid`: more than one of the above is clearly present
2. Extract the primary execution path first.
3. Add only the references, validations, or decision points that materially change execution or correctness.
4. Compress adjacent micro-steps into one action node when they belong to the same stage.
5. Check that the graph still matches the workflow family chosen in step 1.

Do not emit this intermediate reasoning. Use it to constrain the final graph.

## Node Selection Rules

A node should exist only if it does at least one of the following:

- changes execution stage
- introduces or resolves a branch
- introduces a loop or retry boundary
- depends on an external file, schema, script, or resource that materially affects correctness
- produces a terminal artifact or completion state

Do not create nodes for:

- explanatory prose
- rationale paragraphs
- examples that do not affect execution
- formatting notes
- repeated bullets that only elaborate the same stage

## Main Path First

Build the graph in this order:

1. main execution path
2. decision nodes
3. validation nodes
4. reference nodes

If an element does not change execution order, it should usually be side-attached as a reference or validation node instead of inserted into the main path.

Execution-order rules:

- Main-path edges express real runtime sequence
- Side-attached reference edges express dependency or support, not runtime sequence
- Document grouping should not be turned into branch structure unless the source explicitly presents alternatives
- When the source uses phases and those phases are sequential, make the phase backbone visually obvious before adding internal step detail

## Workflow Family Rules

### `serial_procedure`

- Prefer a single ordered path
- Do not invent decision nodes
- Allow at most one shared validation node if several steps converge on the same check

### `phase_serial`

- Treat `Phase 1`, `Phase 2`, `Phase 3`, and similar headings as the primary serial backbone
- Preserve the phase order from the source
- Do not fan phases out from a shared decision node unless the source explicitly says they are alternative workflows
- Prefer one node per phase when internal detail would make the graph noisy

### `phase_with_internal_steps`

- Use phases as the main serial backbone
- Show one or two key internal execution steps for a phase only when they materially clarify what happens inside that phase
- Keep internal steps visually subordinate to the phase backbone rather than replacing it
- Attach references and scripts to the internal step they support, or to the phase when no single step is clearly dominant
- Preserve explicit loop and handoff edges such as `Needs more variants` or `Direction selected`

### `branching_workflow`

- Prefer one explicit decision node near the branch point
- Keep the number of branch targets small, usually 2-4
- When possible, converge branches back into one validation or terminal node

### `iterative_loop`

- Show the loop explicitly with one feedback edge
- Keep the loop boundary obvious
- Do not create multiple loop-back edges unless the source clearly requires it

### `reference_driven_workflow`

- Include references only if they are required for correctness, not just helpful reading
- Keep reference node count lower than action node count whenever possible

### `hybrid`

- Preserve the main path first
- Add one branch or one loop only when clearly supported by the source
- If both branch and loop exist, keep the graph compact and avoid exploding into subgraphs

## Label Rules

- Use short action-oriented labels
- Target 2-6 words when possible
- Preserve critical source-language terms such as product names, commands, file names, `baseline`, `dry_run`, `git revert`, `SVG`, `PNG`, or API names
- Keep human-readable terminology in `label`
- Do not copy long headings verbatim if they can be compressed without losing meaning
- Do not include explanatory clauses like `see below`, `for details`, `recommended`, `optional note`

## Edge Rules

- Use plain edges for sequence
- Use `label` only when it adds real meaning, such as a branch condition or trigger
- Keep edge labels short
- Prefer one shared terminal node when several paths end in the same output

## Reference Rules

- Use `kind: "reference"` for files, schemas, examples, scripts, or docs that materially affect execution
- Attach a reference node to the action that uses it, not randomly to the graph
- Do not include every mentioned file; include only the ones that change execution or correctness

## Anti-Patterns

Do not do any of the following:

- turn every bullet into a node
- mirror the document heading structure mechanically
- insert long prose into node labels
- mix main-path steps and side references into one linear chain
- overfit the graph to examples or non-executable notes
- omit obvious branch or loop structure when the source clearly contains one
- turn sequential phase headings into sibling branches from a generic `Select workflow` node
- replace an explicit phase structure with step-only nodes when phase correspondence is important for reading the source

## Phase-Aware Examples

Bad for explicit phase skills:

- `Receive task -> Read source -> Select workflow -> Phase 1 / Phase 2 / Phase 3 / Phase 4 / Phase 5`

Reason:

- this treats sequential phases as alternative branches
- this hides the serial backbone present in the source

Better for explicit phase skills:

- `Receive request -> Phase 1 -> Phase 2 -> Phase 3 -> Phase 4 -> Phase 5`
- add loop or branch labels only where the source explicitly introduces them
- side-attach `references/design_patterns.md`, `assets/showcase_template.html`, or scripts to the step or phase they support

Better for phase + internal step skills:

- main path:
  - `Phase 1: Gather brand info`
  - `Phase 2: Generate variants`
  - `Phase 3: Refine direction`
  - `Phase 4: Generate showcase`
  - `Phase 5: Deliver assets`
- internal detail:
  - attach `Create interactive showcase page` under or near `Phase 2`
  - attach `Export SVG to PNG` and `Generate showcase images` under or near `Phase 4`
- reference style:
  - `references/design_patterns.md -> Match patterns & generate variants`
  - `assets/showcase_template.html -> Create interactive showcase page`
  - `scripts/generate_showcase.py -> Generate showcase images`

## Compression Examples

Bad:

- `Read source`
- `Read source carefully`
- `Normalize the source`

Good:

- `Read and normalize source`

Bad:

- `Review \`references/schema.md\``
- `Review \`references/examples.md\``
- `Review \`references/guide.md\``

Good:

- `Read schema`
- `Read examples`

Only keep all three if the source clearly requires all three for correctness.

## Family Hints

When the source contains:

- `Step 1`, `Step 2`, `Step 3`
  - Prefer `serial_procedure`
- `Phase 1`, `Phase 2`, `Phase 3`
  - Prefer `phase_serial`
- `Phase 1`, `Phase 2`, `Phase 3` and each phase contains concrete actions
  - Prefer `phase_with_internal_steps`
- sibling workflow headings under one parent
  - Prefer `branching_workflow`
- retry, iterate, refine, hill-climb, re-evaluate
  - Prefer `iterative_loop`
- many references that gate execution correctness
  - Prefer `reference_driven_workflow`

## Final Self-Check

Before finalizing, ensure all of the following are true:

- the graph reflects execution, not document layout
- the main path is obvious
- if phases exist in the source, the graph preserves their serial relationship unless the source explicitly says otherwise
- branch and loop structure match the workflow family
- reference nodes are only included when they materially matter
- reference and dependency edges are visually secondary to the execution backbone
- labels are short and preserve critical source-language terms
- the graph is compact enough to render clearly

## Output Shape

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
