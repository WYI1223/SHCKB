# Feature PRD: Block - Drawing

| Field | Value |
|---|---|
| Status | skeleton |
| Last updated | 2026-05-23 |
| Owner | W_YI |
| Parent PRD | [blocks.md](./blocks.md) |

---

## What this PRD will cover

Drawing block is a candidate built-in block kind for M3 or later block breadth.

This PRD will define a bounded sketch/diagram surface inside a single block. It must not redefine the notepage grid, page layout workflow, or cross-page canvas model.

This skeleton does not lock the M3 catalog, drawing library, persistence format, or editing depth.

---

## Initial Product Intent

A drawing block lets an author place lightweight visual thinking inside a notepage without turning the whole page into an infinite whiteboard.

Minimum expected surfaces:

- bounded drawing content inside one block;
- reader rendering as an interactive or static visual surface;
- safe static fallback or snapshot when the drawing runtime fails;
- responsive behavior that keeps the drawing inspectable;
- accessible label/description;
- extraction behavior that at least exposes title/description and declares limits.

---

## Candidate BDD Scenarios

```gherkin
Scenario: Drawing block stays bounded inside its block
  Given an author has a notepage with a drawing block
  When the author edits the drawing content
  Then the drawing remains content of that block
  And the notepage GridState is not reinterpreted as drawing state
```

```gherkin
Scenario: Drawing runtime failure shows a snapshot fallback
  Given a public notepage contains a drawing block
  When the interactive drawing runtime fails to load
  Then the drawing block shows a safe fallback or snapshot
  And the rest of the notepage remains readable
```

---

## Open Questions

1. **M3 inclusion**: whether drawing is M3 or later.
2. **Scope**: freehand sketch, diagramming, structured shapes, or a smaller MVP.
3. **Persistence**: vector JSON, raster snapshot plus source, or another format.
4. **Fallback**: whether static snapshot generation is required before public publishing.
5. **Extraction**: how much text/shape metadata search and future AI can consume.

---

## References

- **Parent**: [blocks.md](./blocks.md)
- **Related PRDs**: [notepage.md](../notepage/notepage.md) / [notepage-responsive.md](../notepage/notepage-responsive.md) / [theme-system.md](../theme-system/theme-system.md) / [plugin-system.md](../plugin-system/plugin-system.md)
- **Discussion record**: [blocks-prd-alignment-2026-05-23.md](../../../../engineering/design/discussions/blocks-prd-alignment-2026-05-23.md)

---

## Changelog

- 2026-05-23 skeleton created as a concrete block PRD candidate; named `drawing` to avoid overloading product-level canvas terminology.
