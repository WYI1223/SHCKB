# Feature PRD: Block - Code

| Field | Value |
|---|---|
| Status | skeleton |
| Last updated | 2026-05-23 |
| Owner | W_YI |
| Parent PRD | [blocks.md](./blocks.md) |

---

## What this PRD will cover

Code block is a candidate built-in block kind for M3 block breadth.

This PRD will define source code content, language metadata, author editing, reader rendering, fallback, copy behavior, extraction, accessibility, and responsive behavior.

This skeleton does not lock the M3 catalog or syntax-highlighting implementation.

---

## Initial Product Intent

A code block represents source code or command text that should preserve formatting better than normal markdown prose.

Minimum expected surfaces:

- canonical source text;
- optional language metadata;
- readable monospace rendering;
- syntax highlighting when supported;
- copy-to-clipboard as a reader/author affordance;
- plain-text extraction for search/export;
- graceful fallback when a language highlighter is unavailable.

---

## Candidate BDD Scenarios

```gherkin
Scenario: Code block preserves source formatting
  Given an author has a notepage with a code block
  When the author saves source text with indentation
  Then the reader rendering preserves the indentation and line breaks
```

```gherkin
Scenario: Unsupported language highlighter degrades locally
  Given a code block declares a language unavailable to the highlighter
  When a reader opens the notepage
  Then the code block renders readable plain code
  And the rest of the notepage remains readable
```

---

## Open Questions

1. **M3 inclusion**: whether code is mandatory in M3 or only a candidate.
2. **Editing surface**: textarea, lightweight code editor, or source-only shell.
3. **Highlighting**: exact syntax highlighter and supported language set.
4. **Line numbers**: whether line numbers are a product requirement or theme/author option.
5. **Execution**: code block is display-only unless a later PRD promotes executable behavior.

---

## References

- **Parent**: [blocks.md](./blocks.md)
- **Related PRDs**: [notepage.md](../notepage/notepage.md) / [notepage-responsive.md](../notepage/notepage-responsive.md) / [theme-system.md](../theme-system/theme-system.md) / [plugin-system.md](../plugin-system/plugin-system.md)
- **Discussion record**: [blocks-prd-alignment-2026-05-23.md](../../../../engineering/design/discussions/blocks-prd-alignment-2026-05-23.md)

---

## Changelog

- 2026-05-23 skeleton created as an M3 candidate concrete block PRD.
