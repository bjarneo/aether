# Aether — agent notes

Desktop theming app. **Wails 2** (Go backend) + **Svelte 5** frontend (TypeScript, Tailwind v4). Extracts color palettes from wallpapers and applies cohesive themes across a Linux desktop (Omarchy-friendly, works standalone).

## Detailed project docs (outside the repo)

Architecture decisions, design rationale, flow diagrams, ADRs, feature specs, and historical context live at:

```
~/Documents/bjarne/projects/Aether
```

**Read that folder** before making non-trivial changes or when the user asks "how does X work". **Write new detailed docs there** — the repo's `docs/` folder is reserved for user-facing documentation (CLI, installation, custom apps, templates). Content in `~/Documents/bjarne/projects/Aether` is deliberately outside git.

See the `aether-docs` skill (`.claude/skills/aether-docs/SKILL.md`) for the full convention.

## Commands

From repo root (requires Go + `wails` CLI + Node):

- `make dev` — live-reload dev build
- `make build` — production build (`build/bin/aether`); on Linux also builds `aether-wp` service binary
- `make test` — `go test ./internal/... ./cli/...`
- `make install` — system install (Linux: copies to `/usr/bin/`; macOS: `/Applications/`)

Inside `frontend/`:

- `npm run check` — svelte-check type-checking (run before committing frontend code)
- `npm run dev` — Vite dev server (usually invoked by `wails dev`)

Pre-commit hook runs **prettier** on changed JS/TS/Svelte files and **gofmt** on Go. Don't bypass it.

## Layout

```
app.go                  # Wails app struct; ALL exported methods auto-bound to frontend
main.go                 # entry point
cmd/aether-wp/          # Linux-only wallpaper service binary (GTK + gtk-layer-shell)
internal/
├── extraction/         # palette extraction (OKLab median-cut)
├── theme/              # theme state, applier, format classifiers (IsVideoFile, IsImageFile)
├── wallpaper/          # file scanning, thumbnails, video-frame extraction (ffmpeg)
├── blueprint/          # saved theme snapshots
├── color/              # color math (RGB/OKLab/HSL/Adjustments)
├── template/           # per-app template engine
├── wallhaven/          # wallhaven.cc API client
├── batch/              # batch palette generation
├── favorites/, omarchy/, platform/
frontend/
├── src/
│   ├── App.svelte              # top-level router
│   ├── app.css                 # Tailwind + theme tokens (light-mode class flips them)
│   ├── lib/
│   │   ├── components/         # UI (editor/, sidebar/, color-picker/, blueprints/, wallhaven/, ...)
│   │   ├── stores/*.svelte.ts  # reactive state (Svelte 5 runes, .svelte.ts extension required)
│   │   ├── utils/              # color.ts, canvas-filters.ts, keyboard.ts, debounce.ts
│   │   ├── constants/colors.ts # ANSI / extended color labels
│   │   └── types/theme.ts      # shared TS types + DEFAULT_PALETTE / DEFAULT_ADJUSTMENTS
└── wailsjs/go/         # generated bindings — DO NOT HAND-EDIT EXCEPT AS LAST RESORT
localfilehandler.go     # localhost HTTP media server for streaming videos (sends CORS)
```

## Svelte 5 conventions

- Stores live in `*.svelte.ts` files and expose `getX()` / `setX()` functions that read/mutate module-scoped `$state`. Never export the state directly — callers use getters so TS can see the boundary.
- Components use runes: `$state`, `$derived`, `$props`, `$effect`. No `writable/derived` from `svelte/store`.
- **`$effect` dependency tracking pattern**: to force an effect to track non-reactive-read values, touch them:
  ```ts
  $effect(() => {
      const _ = JSON.stringify(points);   // deep mutation tracker
      const __ = histogram.length;
      const ___ = getLightMode();
      draw();
  });
  ```
  Throw-away `_` / `__` / `___` names are the established pattern (see `CurvesEditor.svelte`, `WallpaperEditor.svelte`).
- Single-use `$derived` is fine to inline. Multi-use or non-trivial expressions get a named derived.

## Theming & styles

- Theme tokens in `frontend/src/app.css` under `@theme { ... }` (dark) and `:root.light-mode { ... }` (overrides). Tokens: `bg-bg-primary/secondary/surface/elevated/hover`, `text-fg-primary/secondary/dimmed`, `border-border/border-focus`, `text-accent`, `bg-accent-muted`, `text-destructive/success/warning`.
- Light mode toggles via `document.documentElement.classList.add('light-mode')` — tied to the `getLightMode()` store and applied by `ActionBar.svelte`'s `handleApply`.
- **Overlay coloring rule**: UI that sits on top of the wallpaper image uses fixed scrim colors (`bg-black/60..80` + `text-white`) because image content is arbitrary. UI that sits on top of app chrome uses theme tokens (`bg-bg-secondary` + `text-fg-primary` + `border-border`) so it inverts correctly in light mode. Never `text-fg-primary` on a black scrim — it goes invisible in light mode.
- Canvas rendering: canvas can't inherit CSS vars. Read `getLightMode()` in your `draw()` and branch on ink color (see `CurvesEditor.svelte`'s `ink(alpha)` helper).
- Tooltips: use the native `title=` attribute (pattern in `WallpaperHero.svelte`, `HeaderBar.svelte`). No custom tooltip component.
- `border-radius: 0` is enforced globally (see `app.css`). Don't fight it.

## Wails bindings gotchas

- Generated request classes (e.g. `main.ApplyThemeRequest`, `main.SaveBlueprintRequest`) include an instance method `convertValues`, so plain object literals fail structural type-checks. Workaround: `import type {main}`, then cast `{...} as unknown as main.ApplyThemeRequest`. Don't `as any` — lose field type-checking.
- `Adjustments` is a class with numeric fields but no index signature, so it's not assignable to `Record<string, number>`. Spread it: `adjustments: {...getAdjustments()}` — the resulting plain object is structurally compatible.
- New Go method on `App` → need to update `frontend/wailsjs/go/main/App.d.ts`, `App.js`, and if it returns/accepts a named Go struct also `frontend/wailsjs/go/models.ts`. The `wails` CLI regenerates these during `wails dev`/`wails build`, but manual additions are required when hand-building the frontend.

## Extraction pipeline (Go)

`extraction.ExtractColors(path, lightMode, mode)` flow:

1. `GetCacheKey` + mode suffix via `buildCacheKey` — returns cached `[16]string` if hit (`LoadCachedPalette`).
2. `ExtractDominantColors(path, N)` → `LoadAndSamplePixels` (decode, downscale to `ImageScaleSize`, sample up to `MaxPixelsToSample`) → `ExtractDominantColorsFromPixels` (RGB→OKLab → `boostChromaticPixels` → `MedianCut` → sort by count → hex).
3. `GeneratePaletteByMode(dominantColors, lightMode, mode)` — dispatches to the mode-specific generator (monochromatic / analogous / pastel / material / colorful / muted / bright / auto-detect).
4. `NormalizeBrightness` — final readability pass.
5. `SavePaletteToCache`.

`extraction.ExtractColorsFromImages(paths, lightMode, mode)` blends multiple images by concatenating `LoadAndSamplePixels` outputs before step 3. Skips non-image entries via `theme.IsImageFile`. `app.go` wrapper resolves video paths to frames via `wallpaper.ExtractVideoFrame` first.

## Video + eyedropper specifics

- Videos served by the localhost media server (`localfilehandler.go`) as `http://127.0.0.1:<port>/media?path=...`. Different origin from Wails, so it sends `Access-Control-Allow-Origin: *` and `<video>` elements use `crossorigin="anonymous"` — required for canvas pixel sampling without SecurityError.
- Full-res image cache returns data URLs (same-origin, never CORS-tainted).
- Eyedropper uses in-image canvas sampling (not `window.EyeDropper` — not available in webkit2gtk). Hot-path: `mapEventToSource` in `WallpaperHero.svelte` handles object-cover vs object-contain scale math + letterbox bounds.

## Testing + verification

- Go: `make test` runs `./internal/... ./cli/...`. No frontend unit tests.
- Frontend: `npm run check` is the type-gate. Five `ApplyThemeRequest`/`Adjustments`/`Blueprint` errors fixed in commit `e0ccce4` — if they reappear, it's because someone bypassed the pattern.
- No E2E tests. Manual verification by running `wails dev`.

## Output style when the user asks to commit

- Maintainer convention: **no `Co-Authored-By: Claude` trailer** on commits (user prefers clean commits). Use short imperative subjects matching repo style (`Add ...`, `Fix ...`, `Move ...`, `Make ...`). The pre-commit hook runs prettier/gofmt — don't bypass with `--no-verify`.
