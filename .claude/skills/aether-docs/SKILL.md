---
name: aether-docs
description: >
  Use when working in the Aether codebase and you need detailed project
  documentation — architecture decisions, design rationale, flow diagrams,
  feature specs, ADRs, historical context, WIP drafts. Detailed docs live
  OUTSIDE the repo at ~/Documents/bjarne/projects/Aether. Read that folder
  before making non-trivial changes, and write new detailed docs there
  (never into the git repo's docs/ folder, which is for user-facing docs
  only — CLI, installation, custom apps, templates).
---

# Aether detailed documentation

The in-repo docs (`README.md`, `docs/*.md`, `CLAUDE.md`) cover only the minimum needed to build, run, and understand the public feature surface. **Detailed project documentation lives outside the repo** at:

```
~/Documents/bjarne/projects/Aether
```

## When to consult this folder

- Before implementing a non-trivial feature — check for existing design docs, prior decisions, or half-finished drafts on the area you're touching.
- Before architectural changes — look for ADRs or flow diagrams that explain *why* things are structured as they are.
- When the user asks "how does X work" or "why did we build X that way" and the answer isn't obvious from code.
- After a significant design discussion — write a new doc so future work has the context.

## How to use

```bash
ls ~/Documents/bjarne/projects/Aether
rg "<topic>" ~/Documents/bjarne/projects/Aether
```

Read relevant files before drafting a plan. Cite the filename when you rely on one.

## Writing new docs

When the user asks you to document a design decision, flow, or feature internal:

- Write to `~/Documents/bjarne/projects/Aether/<topic>.md`.
- Use a short descriptive filename (e.g. `palette-extraction-pipeline.md`, `eyedropper-loupe-design.md`, `adr-001-split-sidebars.md`).
- Include date headers so the reader can see when something was decided.

**Do not** put these detailed docs into the repo's `docs/` folder — that directory is reserved for user-facing documentation (CLI usage, installation, custom apps, custom templates, wallhaven setup, etc.).

## Do not

- Don't guess at Aether's architecture or history without checking this folder first — the user keeps decisions here rather than in commit messages or PR descriptions.
- Don't duplicate content from here into the repo.
- Don't commit anything to git from this folder — it's deliberately outside version control.
