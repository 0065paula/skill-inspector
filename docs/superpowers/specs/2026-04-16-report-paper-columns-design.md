# Report Paper Columns Design

**Goal:** Reframe the report page as a bright academic review surface that helps engineers and designers judge a skill quickly, then study its reusable patterns.

## Audience

The page serves engineers and designers who open one report with two jobs in mind:

- decide whether a skill is worth adopting
- learn the structural patterns behind the skill

## Visual Direction

The approved direction is `C1 / Paper Columns`.

- Bright, calm, academic
- Strong title block
- Minimal corner treatment
- Weak container feel
- Thin rules, column structure, and restrained color accents

## Layout

### Hero

The hero becomes a paper-style masthead:

- large title
- short purpose summary
- one horizontal metrics rail for score, risk, references, and translation mode
- source metadata placed as a small research note

### Main Content

The main column carries the reading journey:

- workflow first
- translation second

These sections should feel like the body of a paper rather than app cards.

### Side Content

The side column becomes an annotation rail:

- safety
- install
- score
- suggestions

Each block reads like a margin note with thin separators and compact typography.

## Color and Type

- Base surfaces: cool whites and pale blue neutrals
- Text: graphite blue-gray
- Accent: muted gold for small annotations and active edges
- Typography should create stronger scale contrast in the hero and cleaner reading rhythm in body sections

## Component Language

- Remove rounded-card styling from major regions
- Prefer straight edges, section rules, and light background bands
- Keep graph and translation areas readable with subtle section framing
- Keep tags compact and flatter so they feel like labels rather than pills

## Behavior

- Navigation remains sticky
- Viewer overlay remains available
- Information hierarchy changes through spacing, linework, and scale rather than through new interactions

## Testing Focus

Lock the redesign with HTML rendering tests that verify:

- paper-column hero rail content remains present
- main/side column section ordering remains intact
- visual scaffolding classes for the new layout are emitted
