# Domain Docs

How the engineering skills should consume this repository's domain documentation.

## Before exploring, read these

- `CONTEXT.md` at the repo root.
- `docs/adr/`; read ADRs that touch the area being explored.

If these files do not exist, proceed silently. The `/domain-modeling` skill creates them lazily when domain terms or decisions are resolved.

## Use the glossary

Use the vocabulary defined in `CONTEXT.md` for issue titles, refactor proposals, hypotheses, and test names. Do not drift to synonyms listed under `_Avoid_`.

## Flag ADR conflicts

If output contradicts an existing ADR, surface the conflict explicitly instead of silently overriding it.

## File structure

This is a single-context repository:

```text
/
├── CONTEXT.md
├── docs/adr/
└── src/
```
