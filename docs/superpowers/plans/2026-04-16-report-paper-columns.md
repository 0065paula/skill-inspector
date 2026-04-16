# Report Paper Columns Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the approved `C1 / Paper Columns` redesign for the report page while preserving report rendering behavior.

**Architecture:** Keep the report generation pipeline intact and concentrate the redesign in `templates/report.html`, with focused assertions in `tests/render-report.test.mjs`. Regenerate `out/report.html` from the canonical JSON after the template update so the shipped sample reflects the new direction.

**Tech Stack:** Node.js scripts, HTML template rendering, `node:test`

---

### Task 1: Lock the paper-column structure in tests

**Files:**
- Modify: `tests/render-report.test.mjs`
- Test: `tests/render-report.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
test('rendered report uses the paper-column layout shell', () => {
  execFileSync('node', [scriptPath, reportPath, outputPath], { cwd: root });

  const html = fs.readFileSync(outputPath, 'utf8');

  assert.match(html, /class="hero-metrics"/);
  assert.match(html, /class="report-shell"/);
  assert.match(html, /class="side-rail"/);
  assert.match(html, /<section class="panel workflow-panel" id="workflow">/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/render-report.test.mjs`
Expected: FAIL because the current template does not emit `hero-metrics`, `report-shell`, or `side-rail`.

- [ ] **Step 3: Write minimal implementation**

```html
<dl class="hero-metrics">
  ...
</dl>
<div class="report-shell">
  <div class="main-column">...</div>
  <aside class="side-rail">...</aside>
</div>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/render-report.test.mjs`
Expected: PASS for the new layout test and existing render tests.

### Task 2: Apply the visual redesign in the template

**Files:**
- Modify: `templates/report.html`

- [ ] **Step 1: Adjust root tokens and typography**

```html
:root {
  --bg: #f4f8fb;
  --paper: rgba(248, 251, 253, 0.86);
  --ink: #182634;
  --muted: #617385;
  --accent: #31597c;
  --accent-warm: #b89a56;
}
```

- [ ] **Step 2: Restructure the hero into a masthead and metrics rail**

```html
<section class="hero">
  <div class="hero-copy">...</div>
  <dl class="hero-metrics">...</dl>
</section>
```

- [ ] **Step 3: Convert the body into a paper-style main column and side rail**

```html
<div class="report-shell">
  <div class="main-column">...</div>
  <aside class="side-rail">...</aside>
</div>
```

- [ ] **Step 4: Flatten region styling**

```html
.meta-card,
.panel,
.translation-block,
.meta-row {
  border-radius: 0;
  box-shadow: none;
}
```

### Task 3: Refresh the generated sample output

**Files:**
- Modify: `out/report.html`

- [ ] **Step 1: Regenerate the HTML sample from canonical report data**

Run: `node scripts/render-report.mjs out/report.json out/report.html`
Expected: `out/report.html` reflects the new paper-column structure and updated visual tokens.

- [ ] **Step 2: Verify the sample includes the new layout anchors**

Run: `rg -n "hero-metrics|report-shell|side-rail" out/report.html`
Expected: matches for all three class names.
