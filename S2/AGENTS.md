# AGENTS.md — S2 (DAA Workspace)

Working notes for AI agents editing **S2**, the desktop app for CS2009 *Design and Analysis of Algorithms* (Fall 2026), Submission 2.

Repo root is `C:\Projects\DAA_Project`; this file governs `S2/` only. Read it before touching anything.

---

## 1. What this repo is

| Path | What it holds |
| --- | --- |
| `Project2026.pdf` | **The spec and the grading rubric.** 3 pages. Everything below is derived from it. |
| `S1/` | Submission 1 — theory answers as plain text (`A.txt`…`E.txt` = Q1(a)…Q1(e)). No code. |
| `S2/` | **This project.** Tauri v2 + React desktop app covering PDF parts 2, 3 and 4. |

Course project, group of 3. Phases: S1 (part 1, due 22 Oct 2026), **S2 (parts 2–4, due 10 Nov 2026)**, S3 (part 5, the LaTeX report, due 20 Nov 2026).

The PDF parts that S2 must deliver:

- **Part 2 [10 pts]** — 20 generated dataset files (10 closest-pair + 10 multiplication) plus the generator and a record of each file's seed.
- **Part 3 [5 pts]** — run the algorithms on those datasets.
- **Part 4 [30 pts]** — a nice GUI: pick an input file, show step-by-step working for small inputs, show result + running time for million-element inputs.

Do not invent requirements. When in doubt, re-read `Project2026.pdf`; it is short and precise.

---

## 2. State of the project (read this before planning work)

The **frontend is complete**. **Karatsuba and dataset generation are connected end to end**; closest-pair remains a stub. `src/lib/backend.ts` is the single seam between UI and Rust.

- `runKaratsuba` runs the generated `karatsuba` folder by default or sends selected files as a named batch. The async `run_karatsuba_folder` and `run_karatsuba_files` commands return per-file results and continue after individual failures.
- `src-tauri/src/karatsuba.rs` implements custom base-1e9 `Vec<u32>` arithmetic, validation, timing, traces, batch orchestration, and unit tests.
- `src-tauri/src/generator.rs` implements deterministic SplitMix64 generation for all 20 datasets, per-file seeds, a JSON manifest, and unit tests. Closest-pair files go in `cpp/`; multiplication files go in `karatsuba/`.
- `generateDatasets` invokes the async `generate_datasets` Tauri command; `runClosestPair` still **throws** intentionally.
- `src-tauri/src/lib.rs` registers the two Karatsuba batch commands and `generate_datasets`; the template `greet` command has been removed.

The remaining backend work is closest-pair, its IPC contract, and replacing the remaining throw in `backend.ts`.

The app builds and runs (`bun run build` passes, `cargo check` passes). Don't re-derive that.

---

## 3. Toolchain

Package manager is **bun**. `bun.lock` is committed and `tauri.conf.json` shells out to `bun run dev` / `bun run build`. Do not switch to npm/pnpm; do not regenerate the lockfile with another tool.

Installed (from `node_modules`, may be newer than the `package.json` ranges):

| Thing | Version | Note |
| --- | --- | --- |
| Tauri | 2.12.5 (`tauri-build` 2.7.4) | Rust edition **2024** |
| React | 19.3.1 | |
| TypeScript | 6.0.3 | |
| Vite | 8.3.5 | **Rolldown**-powered, not Rollup |
| Tailwind | 4.3.3 | via `@tailwindcss/vite`, no `tailwind.config` |
| UI primitives | `@base-ui/react` 1.9.0 | **Base UI, not Radix** |
| shadcn CLI | 4.23.0 | style `base-nova` |
| Compiler | `babel-plugin-react-compiler` 1.0.0 | via `@rolldown/plugin-babel` |

Rust crate: `dsa-project`, lib target `dsa_project_lib`. Windows + WebView2. Bundle id `com.fad.dsa-project`.

---

## 4. Commands

```bash
bun install                  # deps
bun run dev                  # Vite only, http://localhost:1420 (strictPort)
bun run tauri dev            # the real app: Vite + Rust, hot reload
bun run build                # tsc && vite build   <- the only correctness gate
bun run tauri build          # release bundle
```

`bun run build` runs `tsc` first. With `noUnusedLocals` / `noUnusedParameters` on, **one unused import fails the build** before Vite ever starts.

There is no linter, no formatter config, and no test suite. `tsc` + `vite build` is all the automated checking you get. Do not add a lint/format stack uninvited.

Adding a shadcn component:

```bash
bunx --bun shadcn@latest add <component>
```

`components.json` pins `style: base-nova`, `baseColor: neutral`, css at `src/App.css`, icons `lucide`, alias `@/components/ui`.

---

## 5. Map

```
S2/
  src/
    main.tsx                 ReactDOM root: ThemeProvider > Toaster > App
    App.tsx                  shell + 3 tabs (closest-pair | karatsuba | generator)
    App.css                  <- the Tailwind entry point, despite the name
    types/workflow.ts        <- the UI<->Rust contract. Types only.
    lib/backend.ts           <- the IPC seam. Closest-pair still throws.
    lib/validation.ts        validateSeed (u64 bound, BigInt-checked)
    lib/utils.ts             re-exports cn from the "cn" package
    data/datasets.ts         cp01-cp10 / im01-im10 descriptors shown in the UI
    hooks/use-algorithm-workflow.ts   closest-pair file + status + result + error machine
    hooks/use-multiplication-workflow.ts   generated-folder/files source + batch run machine
    hooks/use-generator-workflow.ts   seed + output dir + validation + run
    components/              feature components (kebab-case files)
    components/ui/           vendored shadcn/Base UI primitives
  src-tauri/
    src/lib.rs               async commands + invoke_handler — the only registration point
    src/karatsuba.rs         Vec<u32> Karatsuba, parser, traces, batches, and unit tests
    src/generator.rs         SplitMix64 datasets, seed manifest, and unit tests
    src/main.rs              calls dsa_project_lib::run()
    tauri.conf.json          window 1100x760, bun hooks, csp null
    capabilities/default.json  window "main": core:default, opener:default
```

Frontend flow: closest-pair uses `useAlgorithmWorkflow` -> `AlgorithmPanel`; Karatsuba uses `useMultiplicationWorkflow` -> `MultiplicationPanel` -> `MultiplicationBatchResultView`; the generator has its own hook. Feature components are presentational and take props; all state lives in the three hooks.

`WorkflowStatus` is `"idle" | "running" | "success" | "error"`, and the whole UI branches on it. All three hooks guard against stale responses with a `requestId` ref — **keep that pattern**, because a 1M-element run can outlive the user's next file selection.

---

## 6. The IPC contract (the part that will bite you)

`src/types/workflow.ts` is already written in **camelCase**: `inputSize`, `elapsedMicros`, `leftDigits`, `manifestPath`, `outputDirectory`. Rust returns snake_case by default. Every result struct needs:

```rust
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClosestPairResult { /* ... */ }
```

Shape requirements, taken from the TS types:

- `ClosestPairResult`: `first`, `second` (`{x, y}` numbers), `distance: f64`, `inputSize: u64`, `elapsedMicros: u64`, `trace?: AlgorithmStep[]`.
- `MultiplicationResult`: `product: String`, `leftDigits`, `rightDigits`, `elapsedMicros`, `trace?`.
- `GenerationResult`: `filesGenerated`, `manifestPath`, `outputDirectory`, `karatsubaDirectory`, `closestPairDirectory`.
- `MultiplicationBatchResult`: `source`, `files`, `totalFiles`, `succeeded`, `failed`, `totalElapsedMicros`. Each file entry has `fileName` plus optional `result` or `error`; total time sums algorithm-only timings.
- `AlgorithmStep`: `{ title: string, description: string, depth?: number }`. `description` is rendered in a `<p>` with `whitespace-pre-wrap`, so newlines are fine, markdown is not.

Errors: return `Result<T, String>` and make the string **user-facing English prose** — it is shown verbatim inside an `Alert`. Match the tone of the existing stub messages ("…is ready and your selection has been preserved.").

### The `File` problem — decide before writing the command

The hooks currently pass a `File` object. **A `File` cannot cross Tauri's JSON IPC boundary.** Karatsuba currently reads it with `file.text()` and sends the decimal string; closest-pair still needs one of these options:

1. **Recommended:** pick a path with `@tauri-apps/plugin-dialog`, pass the path string, let Rust read the file. Fast for 1M points (~20 MB of text) and 1M digits.
2. Read bytes in JS (`await file.arrayBuffer()`) and ship them as `Vec<u8>`. Works, but you are JSON-ing tens of megabytes through the bridge.

If you go with option 1, the ripple is contained but real: `file-picker.tsx` (drop the hidden `<input type=file>`), `algorithm-panel.tsx` props, both hooks' signatures, `backend.ts`, and the `App.tsx` wiring. Add the plugin to `Cargo.toml`, `lib.rs`, and **`capabilities/default.json`** — a missing permission fails at runtime, not at build time.

### Threading

A plain `#[tauri::command]` runs on the main thread and freezes the window for the entire million-element run. Make it async and push the work off the runtime:

```rust
#[tauri::command(async)]
async fn run_closest_pair(path: String) -> Result<ClosestPairResult, String> {
    tauri::async_runtime::spawn_blocking(move || { /* ... */ })
        .await.map_err(|e| e.to_string())?
}
```

---

## 7. Graded constraints — easy to violate silently

These come straight from the PDF and are worth checking before every commit. Several are the kind of thing that only shows up during marking.

- **No library routines inside the algorithms.** No built-in sorting, no big-integer multiplication, no closest-pair helpers. They may be used *only to verify* your answers. Concretely: the closest-pair divide and conquer needs points ordered by `y` at each merge — that ordering is part of the algorithm, so write the merge sort rather than calling `sort_unstable_by`. Karatsuba's limbs are yours too; `num-bigint` is a verification-only dependency.
- **Input size is chosen at runtime, never hard-coded.** Each program must be correct at n = 10 and must finish at n = 1,000,000.
- **Reproducibility.** Every random file comes from a recorded 64-bit seed; the generator writes a manifest mapping each file to its seed. `validateSeed` already enforces the u64 range — keep Rust agreeing with it.
- **64-bit counts** anywhere a count can exceed ~2x10^9 (inversions, for instance).
- **Plain text formats.** Closest pair: first line `n`, then one `x y` pair per line. Multiplication: two lines, each one decimal integer.
- **Timing is algorithm-only.** Wrap the algorithm in `std::time::Instant`; exclude file parsing and trace construction, otherwise `elapsedMicros` is meaningless. And never benchmark a debug build — measure from `bun run tauri build` (the release profile is already `lto`, `codegen-units = 1`, `panic = "abort"`, `strip`).

Dataset spec (mirrors `src/data/datasets.ts` — if you change one, change both):

| Files | Size | Content |
| --- | --- | --- |
| cp01–cp04 | 10^3, 10^4, 10^5, 10^6 | uniform random reals in [0, 10^6] |
| cp05 | 1,000,000 | clustered around 10 random centers |
| cp06 | 1,000,000 | small integer range -> duplicates, distance 0 |
| cp07 | 100,000 | all on one vertical line |
| cp08 | 100,000 | equally spaced grid, tied pairs |
| cp09 | 1,000,000 | closest pair straddles the middle split |
| cp10 | 101 | small, for the step-by-step view |
| im01–im04 | 10^3, 10^4, 10^5, 10^6 digits | random, no leading zeros |
| im05 | 1,000,000 / 10 | wildly unbalanced |
| im06 | 100,000 | one operand all 9s |
| im07 | 99,999 | odd length, many zeros |
| im08 | 1,000,000 | both powers of 10 |
| im09 | 1 / 1,000,000 | one operand is 0 |
| im10 | 101 | small, for the step-by-step view |

The generator writes `cpp/cp01.txt`–`cpp/cp10.txt` and `karatsuba/im01.txt`–`karatsuba/im10.txt`, with relative paths and per-file seeds in `manifest.json`. Karatsuba defaults to the generated `karatsuba` folder and runs `im01.txt` through `im10.txt` in order; user-selected files use the same batch result UI.

**Traces only for cp10 and im10** (101 elements). The UI says so itself ("Small inputs include a trace"), and `TraceViewer` paginates 50 steps per page. Emitting a trace for a million-element run will stall the bridge for no marks. Keep traces a few thousand steps at most.

### UI performance constraints

- `MultiplicationResultView` bounds large products to the first/last 512 digits and reports the omitted count. Keep the full string for the Copy button; do not replace the preview with the full million-digit product.
- `TraceViewer` renders 50 steps per page and handles empty traces. Keep backend traces bounded to a few thousand steps; do not hand it 10^5 steps.

---

## 8. UI conventions

**Base UI, not Radix.** Primitives come from `@base-ui/react/*` (`button`, `toast`, `tabs`, `collapsible`, `dropdown-menu`, `scroll-area`, `separator`, `switch`…). Consequences:

- There is no `asChild`. Compose with **`render={<Button variant="outline" />}`** — see `mode-toggle.tsx` and `toast.tsx`.
- Open state surfaces as `data-panel-open` / `data-active` / `data-starting-style` attributes, which the Tailwind classes already hook into (`group-data-panel-open:rotate-180`).
- `cn` is imported from the **`cn` package**, not `@/lib/utils` (that file is a one-line re-export kept for shadcn's generator). `clsx` and `tailwind-merge` are not installed — don't reach for them.
- Every primitive sets `data-slot="…"`. Keep that habit; several styles select on it (`has-data-[slot=alert-action]`).

`src/components/ui/*` is vendored. Prefer regenerating a primitive with the CLI over hand-editing it, and put app-specific styling in the feature component that uses it.

**React Compiler is on.** `vite.config.ts` wires `babel({ presets: [reactCompilerPreset()] })`. So:

- Do **not** add `useMemo`, `React.memo`, or hand-rolled `useCallback` for performance. The compiler inserts memoisation; manual versions are noise that can even defeat it.
- The `useCallback`s in the existing hooks predate this and are harmless — leave them alone, just don't copy the habit into new code.
- `useRef` for mutable non-render state (like the `requestId` staleness guard) remains correct and expected.

**Style conventions** (match the surrounding files exactly):

- Double quotes, **no semicolons**, 2-space indent, trailing commas in multiline literals. There is no Prettier config — it's convention, so copy the file you're in.
- Files `kebab-case.tsx`; components exported as named `PascalCase` functions. `App.tsx` is the only default export.
- Imports use the `@/` alias, `import type` for type-only imports, roughly alphabetical by module.
- Accessibility is not optional here and the code is already good at it: `aria-label`, `aria-invalid`, `aria-describedby` wiring error ids, `role="status"`, `aria-live`, `aria-busy`, `sr-only` announcements. New UI matches that bar.
- User-facing copy is calm, specific, and free of exclamation marks.

---

## 9. Theme and styling

- The single Tailwind entry is **`src/App.css`** — the name is a leftover. `components.json` points `tailwind.css` at it. Don't rename it or add another CSS entry.
- Palette is "Merlot": oklch tokens, wine/rose, **no greys anywhere** (dark borders are translucent rose-white so they pick up whatever surface they sit on). The comment block at the top of `App.css` explains the intent; read it before adjusting colours.
- Tokens are declared twice — `:root` and `.dark` — and exposed through `@theme inline`. A new colour needs all three edits or it won't exist as a utility class.
- Dark mode = `.dark` class on `<html>` + `@custom-variant dark`. The storage key `daa-workspace-theme` appears in **two** places: the inline no-flash script in `index.html` and `theme-provider.tsx`. Change them together or the app flashes the wrong theme on launch.
- `--radius` drives the whole radius scale. Respect the `prefers-reduced-motion` block at the bottom of `App.css`.
- Layout idiom: shell is `h-svh flex-col`, header fixed, `main` scrolls, content `mx-auto max-w-6xl px-4 sm:px-6 lg:px-8`. Sizes are `sm:`/`lg:` based; there's one `max-[430px]` breakpoint in the tab labels to keep them from wrapping.

---

## 10. Rust conventions

- `src-tauri/src/lib.rs` holds `run()` and the `invoke_handler` — the **only** registration point. `main.rs` stays a two-liner.
- Karatsuba lives in `src/karatsuba.rs`. As the command set grows, add focused modules (`closest_pair.rs`, `generator.rs`, `model.rs`, or `commands/`) and keep `lib.rs` thin. Don't leave everything in `lib.rs`.
- The template `greet` command has been removed; do not reintroduce it.
- Add a plugin to *both* `Cargo.toml` and `.plugin(…)`, **and** grant its permission in `capabilities/default.json`. Tauri v2 fails at runtime, silently from the build's point of view.
- Edition 2024. `serde`/`serde_json` are already dependencies.
- `csp` is `null`; don't tighten it without checking that Vite's dev server still works in `tauri dev`.

---

## 11. Git

- Single branch `main`, direct commits, terse lowercase-ish subjects ("Theme", "tweak", "Some UI"). Don't introduce a PR flow or rewrite history.
- Ignored: `node_modules`, `dist`, `src-tauri/target`, plus the author's private notes `Logic.md` and `opencode.json`. Leave those alone.
- **Do not commit generated datasets.** The spec asks for the generator plus a seed record, and only files under 1 MB; the million-element files get regenerated during marking.

---

## 12. Definition of done for a change

1. `bun run build` passes (this is the `tsc` gate).
2. `bun run tauri dev` — click through all three tabs. Idle -> running -> success/error must all render, including the error path with the backend stubbed or failing.
3. For Rust: `cargo check` at minimum; if you touched an algorithm, verify against a naive implementation on small inputs (the spec explicitly allows library routines for this).
4. No unused imports, no `any` smuggled in to silence a type error, no new dependency without a reason that would survive review.
5. User-facing strings read like the ones already there.

---

## 13. Things not to do

- Don't swap bun for npm/pnpm, or replace `bun.lock`.
- Don't add Radix, `clsx`, `tailwind-merge`, a router, a state library, or a component framework. The stack is settled.
- Don't hand-write memoisation — the compiler owns that.
- Don't put state back into `App.tsx`; it belongs in the hooks.
- Don't hard-code input sizes, and don't call `sort` inside the algorithms.
- Don't benchmark debug builds or print raw million-digit products into the DOM.
- Don't restructure `src/components/ui` to "clean it up" — it's generated.
