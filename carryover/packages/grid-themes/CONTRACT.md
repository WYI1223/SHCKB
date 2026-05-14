# `@skb/grid-themes` — contract

> **Themed visual layer on top of `@skb/grid-engine`.**
> Themes own the *chrome* (baseplate, block frame, drop-ghost styles).
> Per [ADR-0020](../../docs/decisions/ADR-0020-grid-engine-contract.md) D7-D9.

## Scope

- Provide a `GridTheme` interface so editor / read-mode can render the same grid in different visual languages
- Ship 3 built-in themes (`graph-paper`, `lego-studs` default, `bento-canvas`)
- Provide a small registry + storage layer for theme resolution
- Provide `ThemeSwitcher` floating chip UI (production-fold rule)

**Out of scope**: block content rendering (engine + caller own that), drag/resize event wiring (consumer wires PointerEvents → engine ops), persistence of GridState itself (consumer owns).

## Public surface

```ts
// types
export type {
  GridTheme,            // the contract every theme implements
  ThemeKey,             // closed v1 union: 'graph-paper' | 'lego-studs' | 'bento-canvas'
  ResizeAxis,           // 6 axes: right/left/top/bottom/corner/top-left
  BaseplateProps,
  BlockRenderProps,
  DropPreviewProps,
  ResizeHandleProps,
};
// registry
export { registerTheme, getTheme, tryGetTheme, listThemes, listThemeKeys };
// storage / resolution
export { resolveTheme, resolveAndGetTheme, getUserTheme, setUserTheme };
export { STORAGE_KEY, DEFAULT_THEME };
// UI
export { ThemeSwitcher };
// built-ins (already self-registered)
export { graphPaperTheme, legoStudsTheme, bentoCanvasTheme };
```

## `GridTheme` interface

Every theme provides:

| Field | Type | Purpose |
|---|---|---|
| `key` | `ThemeKey` | Stable kebab-case id (storage key + URL param) |
| `displayName` | `string` | Human-readable label for switcher |
| `description?` | `string` | One-liner shown in switcher menu |
| `slotSize` | `number` | Pixel size of one (col, row) slot — uniform square |
| `cssVars` | `Record<string, string>` | CSS variables to inject at editor root |
| `renderBaseplate(props)` | function | Returns ReactNode for grid backdrop |
| `renderBlock(props)` | function | Returns ReactNode wrapping `children` with themed chrome |
| `renderDropPreview(props)` | function | Returns ReactNode for drag ghost |
| `renderResizeHandle?(props)` | function | Optional; consumer falls back to default chrome |

Slot size **must be uniform square** (rowHeight = colWidth) per ADR-0020 D1.

## Registry

```ts
registerTheme(theme: GridTheme): void
getTheme(key: ThemeKey): GridTheme      // throws if unregistered
tryGetTheme(key: ThemeKey): GridTheme | undefined
listThemes(): GridTheme[]               // insertion order
listThemeKeys(): ThemeKey[]
```

The 3 built-in themes self-register at module load via `./built-in/index.ts` — consumers do not need to call `registerTheme`. Re-registering the same key overwrites (last write wins).

## Storage / resolution

Precedence (highest → lowest) per ADR-0020 D8:

1. Per-doc MDX frontmatter `theme: 'bento-canvas'`
2. Per-user `localStorage['skb.grid.theme']`
3. Default `'lego-studs'`

```ts
resolveTheme({ frontmatterTheme?, userTheme? }): ThemeKey
resolveAndGetTheme({ frontmatterTheme?, userTheme? }): GridTheme
getUserTheme(): ThemeKey | undefined      // SSR-safe; returns undefined in Node
setUserTheme(key: ThemeKey): void         // SSR-safe; no-op in Node
```

Invalid values at any layer (typo'd frontmatter, corrupted localStorage) silently fall through to the next layer. `resolveTheme` is **guaranteed** to return a valid `ThemeKey`.

## `ThemeSwitcher` production fold rule

Per ADR-0020 D9:

- **Dev mode** (`NODE_ENV !== 'production'`): always visible
- **Prod, new user** (no `localStorage` entry, or entry equals default): hidden — no UI clutter
- **Prod, returning user** (`localStorage` set to non-default): visible
- **`forceShow` prop**: bypass the fold rule (e.g., from a settings-panel "manage theme" toggle)

## Block kind hue convention

Themes use CSS variables `--skb-kind-<kind>` for per-kind tinting. Defined in `built-in/shared.ts` and re-injected by every built-in's `cssVars`. 9 kinds covered: markdown, image, code, callout, math, pdf, jupyter, nn-viz, agent-flow.

## What this package does NOT do

- **No drag/resize event handling** — consumer wires PointerEvents → engine ops
- **No block content rendering** — themes wrap `children`; consumer renders content
- **No GridState persistence** — consumer (ProseMirror doc, frontmatter, etc.)
- **No theme animations** — themes can use CSS transitions but no JS animation
- **No v2 extensibility** (yet) — `ThemeKey` is a closed union; v2 may open it without breaking the `GridTheme` interface

## Tests

- `__tests__/registry.test.ts` — register / get / list / overwrite semantics
- `__tests__/storage.test.ts` — precedence + invalid-value fall-through + SSR safety
- `__tests__/themes.test.tsx` — smoke render for all 3 built-ins (baseplate / block / drop ghost)

## See also

- [ADR-0020](../../docs/decisions/ADR-0020-grid-engine-contract.md) — engine + theme contract lock
- [`@skb/grid-engine` CONTRACT.md](../grid-engine/CONTRACT.md) — engine surface that themes render
- [`docs/design/grid-redesign-2026-05-11.md`](../../docs/design/grid-redesign-2026-05-11.md) — design rationale
