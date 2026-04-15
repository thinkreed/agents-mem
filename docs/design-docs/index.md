# Design Documents Index

**Maintenance**: All design docs must be registered here | Mark outdated docs as `deprecated`

---

## Core Design

| Document | Status | Last Updated | Description |
|----------|--------|--------------|-------------|
| [`../agents-mem-py-DESIGN-v2.md`](../agents-mem-py-DESIGN-v2.md) | ✅ active | 2026-04-14 | 4-layer architecture design (L0-L3) |
| [`../agents-mem-py-EXPORT-v2.md`](../agents-mem-py-EXPORT-v2.md) | ✅ active | 2026-04-14 | Markdown export design |
| [`../agents-mem-py-QUICKSTART-v2.md`](../agents-mem-py-QUICKSTART-v2.md) | ✅ active | 2026-04-14 | Quick start guide |
| [`core-beliefs.md`](core-beliefs.md) | ✅ active | 2026-04-14 | Agent-first core principles |

## Technical Guidelines

| Document | Status | Last Updated | Description |
|----------|--------|--------------|-------------|
| [`../QUALITY_SCORE.md`](../QUALITY_SCORE.md) | ✅ active | 2026-04-14 | Quality scoring system |
| [`../RELIABILITY.md`](../RELIABILITY.md) | ✅ active | 2026-04-14 | Reliability guidelines |
| [`../SECURITY.md`](../SECURITY.md) | ✅ active | 2026-04-14 | Security specifications |
| [`../GOLDEN_RULES.md`](../GOLDEN_RULES.md) | ✅ active | 2026-04-14 | Golden principles |
| [`../FRONTEND.md`](../FRONTEND.md) | ✅ active | 2026-04-14 | MCP interface design |
| [`../SPEC.md`](../SPEC.md) | ✅ active | 2026-04-14 | Development specifications |

---

## Status Legend

- **active**: Reflects current codebase behavior
- **deprecated**: Outdated, pending deletion or update
- **draft**: Draft, not yet implemented

## Adding New Documents

1. Register in this index
2. Set status to `draft` → `active`
3. Ensure cross-links to code
4. Run `pytest` to validate
