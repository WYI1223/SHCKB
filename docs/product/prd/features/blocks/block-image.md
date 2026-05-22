# Feature PRD: Block - Image

| Field | Value |
|---|---|
| Status | skeleton |
| Last updated | 2026-05-23 |
| Owner | W_YI |
| Parent PRD | [blocks.md](./blocks.md) |

---

## What this PRD will cover

Image block is a candidate built-in block kind for M3 block breadth.

This PRD will define image/media content, author edit behavior, reader rendering, fallback, accessibility, responsive behavior, blob/storage dependencies, and extraction behavior.

This skeleton does not lock the M3 catalog or blob schema.

---

## Initial Product Intent

An image block represents a bounded visual asset inside a notepage. It should let authors attach or reference an image, provide metadata such as alt text/caption, and render predictably for readers across responsive projections.

Minimum expected surfaces:

- image source or blob reference;
- alt text for accessibility and extraction;
- optional caption;
- responsive rendering inside the block bounds;
- missing image fallback;
- reader-safe rendering with no author-only controls.

---

## Candidate BDD Scenarios

```gherkin
Scenario: Image block renders with accessible text
  Given a public notepage contains an image block with alt text
  When a reader opens the notepage
  Then the image is shown within the block bounds
  And the alt text is available for accessibility
```

```gherkin
Scenario: Missing image asset degrades locally
  Given an image block references an unavailable asset
  When a reader opens the notepage
  Then the image block shows a safe missing-asset fallback
  And the rest of the notepage remains readable
```

---

## Open Questions

1. **Source model**: upload-only, URL reference, or both.
2. **Blob lifecycle**: exact storage/deletion/backup interaction belongs to storage and self-host PRDs/ADRs.
3. **Transforms**: whether crop, resize, focal point, and thumbnail generation are M3 or later.
4. **Extraction**: whether alt text, caption, filename, or OCR are searchable.
5. **Privacy**: how private image assets are guarded when a notepage is private or deleted.

---

## References

- **Parent**: [blocks.md](./blocks.md)
- **Related PRDs**: [notepage.md](../notepage/notepage.md) / [notepage-responsive.md](../notepage/notepage-responsive.md) / [theme-system.md](../theme-system/theme-system.md) / [plugin-system.md](../plugin-system/plugin-system.md)
- **Discussion record**: [blocks-prd-alignment-2026-05-23.md](../../../../engineering/design/discussions/blocks-prd-alignment-2026-05-23.md)

---

## Changelog

- 2026-05-23 skeleton created as an M3 candidate concrete block PRD.
