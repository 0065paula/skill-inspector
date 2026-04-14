# Skill Inspector

Project-local Python tool for analyzing a single skill source and rendering a static report.

## Install

```bash
python -m pip install -e ".[dev]"
```

## Run

### Direct Run

```bash
python scripts/skill_inspector.py --input-file examples/sample_generic_skill.md --output-dir out/sample
```

### Agent Bridge Workflow

Preferred workflow. Use this when the current agent should call the model first, then feed structured results back into the script.

1. Dump the LLM request payload:

```bash
python scripts/skill_inspector.py \
  --input-file SKILL.md \
  --output-dir out/bridge \
  --dump-llm-request out/bridge-request.json
```

2. Let the agent read `out/bridge-request.json` and produce `out/bridge-response.json` with this shape:

```json
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
```

3. Feed the response back into the script:

```bash
python scripts/skill_inspector.py \
  --input-file SKILL.md \
  --output-dir out/bridge \
  --llm-response-file out/bridge-response.json
```

### Command Provider Workflow

If you already have an external command that accepts JSON stdin and returns JSON stdout, set:

```bash
export SKILL_INSPECTOR_LLM_COMMAND="python your_provider.py"
```

Then run the script normally. This is a secondary option when agent-bridge is not being used. The built-in fallback still handles failures.
