# ghostty Fork Design: `mizchi/ghostty` with `wasm-kitty` shim

- **Status**: Draft — awaiting user review
- **Date**: 2026-04-11
- **Author**: mizchi (with Claude)
- **Related**: `reference/ghostty` submodule in `mizchi/restty`

## 1. Goal

Create a long-lived fork of `ghostty-org/ghostty` that:

1. Tracks `ghostty-org/main` as its primary base, with minimal divergence.
2. Carries just enough patches to keep the Kitty graphics protocol working on
   `wasm32-freestanding` builds of `ghostty-vt` (the `.lib` artifact).
3. Replaces the current `reference/ghostty` submodule, which points at
   `wiedymi/ghostty @ wterm-wasm-kitty-compat` and has drifted ~533 commits
   behind upstream.

Non-goals:

- Maintain a long-lived parallel ghostty distribution.
- Carry non-wasm patches.
- Fork `wiedymi/text-shaper` (it is a standalone repo, not a fork, and is
  orthogonal to the ghostty-vt story).

## 2. Background

### 2.1 Current state

- `reference/ghostty` is a git submodule declared in `.gitmodules` pointing at
  `https://github.com/wiedymi/ghostty.git`.
- The pinned commit is `1722662593143277b24a9413deaab59114c6536a`, the HEAD of
  the `wterm-wasm-kitty-compat` branch in `wiedymi/ghostty`.
- The submodule is unregistered locally (`git submodule status` shows a leading
  `-`). CI (`.github/workflows/ci.yml:16`) initialises it via
  `submodules: recursive`.
- `wasm/build.zig.zon:8` points at `../reference/ghostty` as the `ghostty`
  dependency. `wasm/build.zig:22` imports the `ghostty-vt` module from that
  dependency.
- restty actively uses Kitty graphics in `wasm/src/restty.zig` (see
  references to `ghostty.kitty.graphics.Command`, `Image`, `Response`,
  `unicode.placementIterator`).

### 2.2 The wiedymi patches

`wiedymi:wterm-wasm-kitty-compat` is 2 commits ahead of `ghostty-org:main`
(and ~533 behind). The two commits are:

1. `12e1e339` — *Improve wasm/lib compatibility for kitty graphics and
   terminal types* — touches `quirks.zig`, `build_options.zig`,
   `graphics_image.zig`, `graphics_storage.zig`, `mouse.zig`, `style.zig`.
2. `1722662593` — *fix(wasm): restore zig 0.15 stream compatibility* — touches
   `mouse.zig`, `stream.zig`.

Combined size: 7 files, roughly +138 / -54 lines.

The patches' real purpose is narrower than the commit messages suggest: they
re-enable the Kitty graphics protocol on `wasm32-freestanding`, working around
the fact that `std.time.Instant`, `std.fs.max_path_bytes`, `shm_open`, and
`wuffs` are unavailable there.

### 2.3 Why the patches are largely obsolete

In the 533 upstream commits since the wiedymi branch diverged, `ghostty-org`
absorbed most of the `.lib`/wasm enablement work:

- `src/terminal/build_options.zig` now has a first-class `Options.Artifact`
  enum with a `.lib` variant.
- `kitty_graphics` is a build option, automatically disabled on
  `wasm32-freestanding` because "we at the least require the ability to get
  timestamps and there is no way to do that with freestanding targets".
- `src/terminal/sys.zig` (new) provides runtime-swappable function pointers
  (e.g. `decode_png`) so embedders can inject their own implementations
  without touching the module source.
- `LoadingImage.Limits` (`file`, `temporary_file`, `shared_memory` booleans)
  lets callers disable unsupported media per-platform.

Upstream's explicit design decision is: **Kitty graphics is off on
wasm32-freestanding**. restty's requirement is: **Kitty graphics must be on
wasm32-freestanding**. This gap — and only this gap — is what the fork exists
to bridge.

## 3. Architecture

```
github.com/ghostty-org/ghostty (upstream, untouched)
         |
         | fork
         v
github.com/mizchi/ghostty (this fork)
    |
    +-- main        # plain mirror of ghostty-org/main, no custom commits
    |
    +-- wasm-kitty  # main + minimal shim patches for Kitty on wasm

github.com/mizchi/restty
    |
    +-- reference/ghostty  (submodule)
             -> url:    https://github.com/mizchi/ghostty.git
             -> branch: wasm-kitty
             -> pin:    wasm-kitty HEAD at bump time
```

Key properties:

- **`main` is a strict mirror.** We never land custom commits on `main`. The
  sync recipe performs `git reset --hard upstream/main`, which means any
  accidental local commits are auto-erased. This makes "track ghostty-org
  main" literally true.
- **`wasm-kitty` holds the entire divergence.** It is rebased onto `main`
  every time we sync. Force-push is expected.
- **One name per concern.** The branch name (`wasm-kitty`) reflects *what the
  branch does*, not which downstream uses it, so the fork can outlive restty.
- **restty submodule tracks a branch.** `.gitmodules` declares
  `branch = wasm-kitty`, so `git submodule update --remote` can advance the
  pin. Normal `git submodule update` still pins to a specific commit.

## 4. Shim patch design

Principle: **use upstream extension points, not parallel code paths**.

### 4.1 Expected patches (scope estimate: 2–3 commits, ~40 / -10 lines)

**Patch 1 — Optional override for `kitty_graphics` build flag.**

Add an optional `force_kitty_graphics: ?bool = null` field to
`Options` in `src/terminal/build_options.zig`. When set, it overrides the
automatic wasm32-freestanding disable. Default behaviour for all existing
consumers is unchanged.

`wasm/build.zig` in restty then passes `.force_kitty_graphics = true` when
creating the dependency, so the build option flips back on.

**Patch 2 — Wasm-compatible `transmit_time` in `graphics_image.zig`.**

Replace the direct `std.time.Instant` usage with a compile-time alias that
falls back to a monotonic counter on `wasm32-freestanding`:

```zig
pub const Timestamp = if (builtin.target.cpu.arch.isWasm() and
                          builtin.target.os.tag == .freestanding)
    u64
else
    std.time.Instant;
```

All comparison sites get a small `timestampOrder` helper (as in the wiedymi
patch). `std.fs.max_path_bytes` references on freestanding become a local
constant.

Note: upstream's `LoadingImage.Limits` already handles the "no file system"
case, so the massive `posix.realpath` / `shm_open` / `wuffs` diffs from the
wiedymi patch are *not* needed. Callers on wasm pass
`Limits{ .file = false, .temporary_file = false, .shared_memory = false }`
and those code paths are never entered.

**Patch 3 — (maybe) `sys.zig` injection glue.**

If upstream's `sys.zig` already exposes a clock-like function pointer, this
patch is empty and we instead document the injection pattern on the restty
side. If not, add a single function pointer `now: ?NowFn` to `sys.zig` and
use it in `graphics_image.zig` when available, falling back to the
compile-time `Timestamp`.

This patch may collapse to zero after reading the current `sys.zig`.

### 4.2 What we deliberately do NOT port from wiedymi

- `quirks.zig` font stub — upstream handles `.lib` artifact fonts already.
- `mouse.zig` GObject switch refactor — `.lib` artifact already avoids the
  GTK path upstream.
- `style.zig` `configpkg` stub — `.lib` artifact has its own config
  decoupling upstream.
- `stream.zig` `error_union` branching — zig 0.15 stream compat is likely
  already resolved upstream; verify at implementation time.

If any of these turn out to still be needed after the first rebase, add them
as additional shim patches and update this document.

### 4.3 Uncertainty

The exact patch contents cannot be finalised until `reference/ghostty` is
initialised and refreshed to the real `ghostty-org/main` HEAD. The
implementation plan's first step is therefore "initialise the submodule
against mizchi/ghostty, refresh to upstream main, inspect actual diff".

## 5. Tooling: `justfile` recipes

restty currently has no `justfile`. We create one with the following recipes
(namespaced under `ghostty-*` so it does not collide with future additions):

```just
GHOSTTY_REMOTE   := "git@github.com:mizchi/ghostty.git"
GHOSTTY_UPSTREAM := "https://github.com/ghostty-org/ghostty.git"
GHOSTTY_BRANCH   := "wasm-kitty"
GHOSTTY_DIR      := "reference/ghostty"

# Initialise submodule and ensure upstream remote is present.
ghostty-init:
    git submodule update --init --recursive -- {{GHOSTTY_DIR}}
    cd {{GHOSTTY_DIR}} && (git remote get-url upstream 2>/dev/null \
        || git remote add upstream {{GHOSTTY_UPSTREAM}})

# Fetch ghostty-org/main, mirror it to origin/main, rebase wasm-kitty.
# Stops on conflict; operator must resolve before pushing.
ghostty-sync: ghostty-init
    cd {{GHOSTTY_DIR}} && git fetch upstream main
    cd {{GHOSTTY_DIR}} && git checkout main \
        && git reset --hard upstream/main \
        && git push origin main
    cd {{GHOSTTY_DIR}} && git checkout {{GHOSTTY_BRANCH}} \
        && git fetch origin {{GHOSTTY_BRANCH}} \
        && git rebase main
    @echo "→ Run 'just ghostty-verify' and then 'just ghostty-push'."

# Smoke build of the restty wasm target.
ghostty-verify:
    cd wasm && zig build

# Force-push rebased wasm-kitty and stage the submodule bump in restty.
ghostty-push:
    cd {{GHOSTTY_DIR}} && git push --force-with-lease origin {{GHOSTTY_BRANCH}}
    git add {{GHOSTTY_DIR}}
    @echo "→ Submodule pointer staged. Commit and push restty."
```

Design decisions:

- **Sync and push are separate recipes.** A human verifies the build between
  them.
- **`--force-with-lease`**, never plain `--force`, on `wasm-kitty`.
- **`main` uses `reset --hard`** so accidental local commits never
  accumulate on the mirror branch.
- **`ghostty-verify` is `zig build` only.** Heavier e2e checks are a
  release-time concern, not a per-rebase concern.
- **Recipes are idempotent.** `ghostty-init` safely re-runs.

## 6. restty-side integration

### 6.1 `.gitmodules` change

Before:

```ini
[submodule "reference/ghostty"]
    path = reference/ghostty
    url = https://github.com/wiedymi/ghostty.git
```

After:

```ini
[submodule "reference/ghostty"]
    path = reference/ghostty
    url = https://github.com/mizchi/ghostty.git
    branch = wasm-kitty
```

### 6.2 Local swap procedure

```bash
# 1. Edit .gitmodules (URL + branch).

# 2. Deinitialise the old submodule and clear cached git dir.
git submodule deinit -f reference/ghostty
rm -rf .git/modules/reference/ghostty
rm -rf reference/ghostty

# 3. Re-initialise against the new URL and check out wasm-kitty.
git submodule update --init reference/ghostty
cd reference/ghostty && git checkout wasm-kitty && cd ../..

# 4. Stage the new pin.
git add .gitmodules reference/ghostty
git commit -m "chore: switch ghostty submodule to mizchi/ghostty wasm-kitty"

# 5. Verify.
just ghostty-verify
```

### 6.3 CI impact

`.github/workflows/ci.yml:16` already uses `submodules: recursive`. As long
as `mizchi/ghostty` is **public**, CI works without changes. A private fork
would require deploy-key configuration, which is explicitly out of scope —
the fork will be public.

### 6.4 Documentation updates

A grep for `wiedymi/ghostty` in the restty tree finds only one file:
`.gitmodules`. The rest of the docs talk about "Ghostty" generically and do
not pin a URL, so no mandatory rewrites are needed there.

What we do change:

- `.gitmodules` — URL and `branch` entries (mandatory).
- `docs/internals/wasm-core.md` — add a short note naming
  `mizchi/ghostty @ wasm-kitty` as the source of `ghostty-vt` and pointing
  at the new runbook for why the fork exists.
- `docs/development/ghostty-sync.md` — new operator runbook: when to sync,
  conflict handling, rollback, links to the spec.

Explicitly out of scope for this PR:

- `README.md`, `package.json`, the playground assets, and
  `THIRD_PARTY_NOTICES.md` contain `wiedymi` references that are about
  restty's own heritage (forked from `wiedymi/restty`) or `wiedymi/text-shaper`.
  Those are separate concerns and are not touched here.
- `.gitmodules`'s `reference/text-shaper` entry stays unchanged —
  `wiedymi/text-shaper` is a standalone repo, not a fork.

## 7. Verification strategy

Three layers, used at different points in the workflow:

| Layer | Command | When | Purpose |
|---|---|---|---|
| L1: zig build | `just ghostty-verify` | Every rebase | API / type drift detection |
| L2: wasm load | `pnpm test` wasm init path | Before `ghostty-push` | JS can load the module |
| L3: Kitty graphics e2e | restty image-display tests | Release candidate | Shim's main purpose still works |

L1 is mandatory and automated by the justfile. L2 is expected before pushing
a bump commit. L3 is manual and release-gated.

## 8. Operational workflow

```
Developer intent     Recipe                       Effect
────────────────────────────────────────────────────────────────
"sync ghostty"       just ghostty-sync            reference/ghostty rebased
                            ↓ (may stop on conflict)
"did it build?"      just ghostty-verify          wasm/zig-out
                            ↓ (human decides)
"publish"            just ghostty-push            mizchi/ghostty force-with-lease
                            ↓                     reference/ghostty staged
                     pnpm test                    restty regression check
                            ↓
                     git commit & push restty     submodule bump lands
```

## 9. Conflict handling

When `ghostty-sync` stops mid-rebase:

- **Trivial conflicts** (renames, refactors that don't touch shim logic):
  resolve in place, `git rebase --continue`, run `ghostty-verify`, push.
- **Moderate conflicts** (upstream API moved): rewrite the shim patch,
  record the change in `docs/development/ghostty-sync.md`.
- **Fatal conflicts** (upstream makes Kitty graphics on wasm impossible):
  `git rebase --abort`, keep the old pin, open an issue, revisit strategy.
  restty stays on its previous working pin in all cases.

## 10. Rollback plan

If the switch to `mizchi/ghostty` turns out to be broken after landing:

```bash
# Restore the previous .gitmodules entry.
git checkout HEAD~1 -- .gitmodules
git submodule deinit -f reference/ghostty
rm -rf .git/modules/reference/ghostty reference/ghostty
git submodule update --init reference/ghostty
```

`wiedymi/ghostty @ 1722662593` remains untouched on GitHub, so this is fully
reversible.

## 11. Milestones

| # | Milestone | Deliverable |
|---|---|---|
| A | Fork baseline | `mizchi/ghostty` created; `main` mirrored; `wasm-kitty` exists (identical to `main` at first) |
| B | Shim implementation | Patches 1–3 landed on `wasm-kitty`; `wasm/zig build` passes locally |
| C | restty switch | `.gitmodules`, submodule pin, README/doc updates, CI green |
| D | Tooling | `justfile` recipes, `docs/development/ghostty-sync.md` runbook |

Milestone B carries the most uncertainty — the concrete patches cannot be
finalised until the current `ghostty-org/main` is inspected.

## 12. Out of scope

- Automating `ghostty-sync` via GitHub Actions cron. Revisit after operator
  experience accumulates.
- Forking `wiedymi/text-shaper`. It is a standalone repo, not a fork.
- Upstreaming the shim to `ghostty-org` via a PR. A nice-to-have future
  step, but unpredictable timing and not required for restty.
- Any non-wasm ghostty patches.

## 13. Open questions (deferred to implementation)

- Does upstream's `sys.zig` already expose a clock-like function pointer
  that eliminates the need for Patch 2's compile-time `Timestamp` alias?
- After the rebase, do any of the wiedymi patches for `mouse.zig`,
  `style.zig`, or `stream.zig` turn out to still be needed?
- Is there a clean way to express "this submodule follows upstream
  `wasm-kitty`" in `.gitmodules` without breaking `submodules: recursive`
  in CI? (Current assumption: `branch = wasm-kitty` is sufficient.)

These are implementation-time discoveries, not blockers for the spec.
