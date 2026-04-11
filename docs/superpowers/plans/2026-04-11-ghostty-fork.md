# ghostty Fork Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the stale `wiedymi/ghostty @ wterm-wasm-kitty-compat` submodule with a fresh `mizchi/ghostty` fork whose `wasm-kitty` branch carries minimal patches needed to keep the Kitty graphics protocol working on `wasm32-freestanding`, and add the tooling to rebase it periodically onto `ghostty-org/main`.

**Architecture:** The fork's `main` branch is a plain mirror of `ghostty-org/main`. All custom work lives on `wasm-kitty`, which is rebased onto `main` on each sync. Upstream has already absorbed most of the `.lib`/wasm enablement via the `Options.Artifact` enum, `LoadingImage.Limits` struct, and `sys.zig` injection points — so the fork only needs to (a) force `kitty_graphics` on for `wasm32-freestanding` and (b) provide a wasm-compatible `Timestamp` for `Image.transmit_time`. Everything else the wiedymi branch shimmed is now unnecessary.

**Tech Stack:** Zig 0.15.x, `just` (new to restty), `git submodule`, GitHub Actions (existing CI).

**Spec:** `docs/superpowers/specs/2026-04-11-ghostty-fork-design.md`

---

## File Structure

**Changes in `mizchi/ghostty` (new fork, `wasm-kitty` branch):**
- Modify: `src/terminal/build_options.zig` — force `kitty_graphics` on for wasm32-freestanding
- Modify: `src/terminal/kitty/graphics_image.zig` — wasm-compatible `Timestamp` alias, `nowTimestamp` helper, `std.fs.max_path_bytes` fallback if needed
- Modify: `src/terminal/kitty/graphics_storage.zig` — `timestampOrder` helper so storage code works with both `std.time.Instant` and the wasm fallback
- Optionally modify: any other file the compiler surfaces during the rebuild loop (iterative; record each addition in this plan's notes)

**Changes in `mizchi/restty`:**
- Modify: `.gitmodules` — point `reference/ghostty` at `mizchi/ghostty` with `branch = wasm-kitty`
- Create: `justfile` — new; holds `ghostty-*` recipes
- Create: `docs/development/ghostty-sync.md` — operator runbook for rebasing
- Modify: `docs/internals/wasm-core.md` — mention the fork and link the runbook
- Submodule pin: `reference/ghostty` advances to the new `wasm-kitty` HEAD

---

## Task 1: Create the fork and wasm-kitty branch

**Files:**
- GitHub: create `mizchi/ghostty` as a fork of `ghostty-org/ghostty`

- [ ] **Step 1: Create the fork on GitHub**

Run:

```bash
gh repo fork ghostty-org/ghostty --clone=false --org=mizchi 2>&1 || \
gh repo fork ghostty-org/ghostty --clone=false
```

Expected output: `✓ Created fork mizchi/ghostty`

If the fork already exists, `gh` prints `! mizchi/ghostty already exists` — that's fine, move on.

- [ ] **Step 2: Verify fork is public and has `main` branch synced**

Run:

```bash
gh api repos/mizchi/ghostty --jq '{name, fork, private, default_branch}'
gh api repos/mizchi/ghostty/compare/ghostty-org:main...mizchi:main --jq '{ahead: .ahead_by, behind: .behind_by}'
```

Expected:
- `fork: true, private: false, default_branch: "main"`
- `ahead: 0, behind: N` — where N may be non-zero if the fork was created some time ago. Run `gh repo sync mizchi/ghostty -b main` to bring it up to date, then re-run and confirm `behind: 0`.

- [ ] **Step 3: Create the `wasm-kitty` branch on the fork**

Run:

```bash
MAIN_SHA=$(gh api repos/mizchi/ghostty/git/ref/heads/main --jq '.object.sha')
gh api -X POST repos/mizchi/ghostty/git/refs -f ref=refs/heads/wasm-kitty -f sha="$MAIN_SHA"
```

Expected: JSON response with `{"ref": "refs/heads/wasm-kitty", ...}`. If `422 Reference already exists`, the branch is there — move on.

- [ ] **Step 4: Verify the branch exists and equals main**

Run:

```bash
gh api repos/mizchi/ghostty/compare/mizchi:main...mizchi:wasm-kitty --jq '{ahead: .ahead_by, behind: .behind_by}'
```

Expected: `ahead: 0, behind: 0`. At this point `wasm-kitty` is identical to `main`; Task 2 adds the shim commits.

- [ ] **Step 5: Commit nothing (no local changes yet), proceed to Task 2.**

---

## Task 2: Initialise reference/ghostty against the new fork

**Files:**
- Modify in place: `reference/ghostty` (submodule working tree)
- No restty commits yet — this task is discovery.

- [ ] **Step 1: Deinitialise any existing submodule state**

Run:

```bash
cd /Users/mz/ghq/github.com/mizchi/restty
git submodule deinit -f reference/ghostty 2>/dev/null || true
rm -rf .git/modules/reference/ghostty
rm -rf reference/ghostty
```

Expected: no errors. `git status` should show no changes (because `.gitmodules` still points at wiedymi and the pin hasn't changed yet).

- [ ] **Step 2: Temporarily clone `mizchi/ghostty @ wasm-kitty` into `reference/ghostty`**

Run:

```bash
git clone --branch wasm-kitty https://github.com/mizchi/ghostty.git reference/ghostty
cd reference/ghostty
git remote add upstream https://github.com/ghostty-org/ghostty.git
git fetch upstream main
git log --oneline -5
cd ../..
```

Expected: the clone succeeds. `git log` on `wasm-kitty` shows the same HEAD as `ghostty-org/main` (since Task 1 Step 3 created the branch from main).

Note: this is a plain `git clone`, not a `git submodule update`. The submodule pointer in restty is *not* updated yet. We will update `.gitmodules` and the pin together in Task 8, after the shim patches are pushed to `mizchi/ghostty`.

- [ ] **Step 3: Baseline wasm build attempt**

Run:

```bash
cd wasm
zig build 2>&1 | tee /tmp/zig-baseline.log
cd ..
```

Expected: **PASS**, silently. This is the counter-intuitive part. Upstream's `src/terminal/kitty.zig` uses
`pub const graphics = if (build_options.kitty_graphics) @import("kitty/graphics.zig") else struct {};`
so when `kitty_graphics` is false, `ghostty.kitty.graphics` evaluates to an empty struct. restty guards every Kitty usage with `if (comptime !kitty_graphics_enabled) return;` (see `wasm/src/restty.zig:123,446,825,1263`), which means the build compiles cleanly but the resulting `.wasm` does nothing when asked to decode Kitty image data. If the build fails at this step, stop and investigate — the plan's premise is wrong.

- [ ] **Step 4: Confirm Kitty is silently disabled in the baseline**

Run:

```bash
pnpm install
pnpm test -- kitty 2>&1 | tail -30
```

Expected: one or more failures in `tests/kitty-graphics-placement.test.ts`, `tests/kitty-graphics-probe.test.ts`, `tests/kitty-graphics-snacks.test.ts`, or `tests/kitty-media.test.ts`. These tests exercise the Kitty image path and will surface the no-op behaviour. Record the failure pattern in `/tmp/zig-baseline.log` notes — the same test command must PASS by the end of Task 8.

- [ ] **Step 5: No commit. Move to Task 3.**

---

## Task 3: Patch A — Force `kitty_graphics` on for wasm32-freestanding

**Files:**
- Modify: `reference/ghostty/src/terminal/build_options.zig:66-72`

- [ ] **Step 1: Read the current `Options.add` function**

Run:

```bash
sed -n '58,75p' reference/ghostty/src/terminal/build_options.zig
```

Expected to see:

```zig
        // Kitty graphics is almost always true. ...
        // We disable it on wasm32-freestanding because we at the least
        // require the ability to get timestamps and there is no way to
        // do that with freestanding targets.
        const target = m.resolved_target.?.result;
        opts.addOption(
            bool,
            "kitty_graphics",
            !(target.cpu.arch == .wasm32 and target.os.tag == .freestanding),
        );
```

- [ ] **Step 2: Edit the file to remove the wasm disable**

Replace the block above with:

```zig
        // Kitty graphics is almost always true. We generalize the
        // implementation to support optional PNG decoding, OS capabilities
        // like filesystems, etc., so it is safe to always enable it and let
        // the implementation deal with unsupported features as needed.
        //
        // Upstream disables kitty_graphics on wasm32-freestanding because
        // `std.time.Instant` is unavailable there. The `mizchi/ghostty`
        // wasm-kitty fork re-enables it and provides a monotonic-counter
        // fallback for `Image.transmit_time` in `graphics_image.zig`.
        _ = m;
        opts.addOption(bool, "kitty_graphics", true);
```

Apply the edit using `Edit` tool or `sed`. Verify with:

```bash
grep -n "kitty_graphics" reference/ghostty/src/terminal/build_options.zig
```

Expected: a single line `opts.addOption(bool, "kitty_graphics", true);`

Note: the `_ = m;` is needed because `m` is the only function argument that is no longer used in that branch. Zig errors on unused parameters only if they have no `_ = ...` discard.

- [ ] **Step 3: Rebuild wasm and capture the next error**

Run:

```bash
cd wasm
zig build 2>&1 | tee /tmp/zig-patch-a.log
cd ..
```

Expected: **FAIL** — now that `kitty_graphics` is true, `src/terminal/kitty.zig` pulls in `kitty/graphics.zig`, which transitively imports `graphics_image.zig`, which references `std.time.Instant.now()` (line ~405) and `std.time.Instant` as a field type (line ~515). On `wasm32-freestanding`, `std.time.Instant` does not compile. The error cite should be one of `graphics_image.zig` or `graphics_storage.zig`. If it is somewhere else entirely, stop and re-plan.

- [ ] **Step 4: Commit Patch A inside the submodule**

Run:

```bash
cd reference/ghostty
git add src/terminal/build_options.zig
git commit -m "build: force kitty_graphics on for wasm32-freestanding

Upstream disables the Kitty graphics protocol on wasm32-freestanding
because std.time.Instant is unavailable there. mizchi/ghostty re-enables
it; the follow-up patch in graphics_image.zig provides a
monotonic-counter fallback for Image.transmit_time."
cd ../..
```

Expected: a new commit on the local `wasm-kitty` branch. Do *not* push yet.

---

## Task 4: Patch B — Wasm-compatible `Timestamp` in graphics_image.zig

**Files:**
- Modify: `reference/ghostty/src/terminal/kitty/graphics_image.zig`

- [ ] **Step 1: Add the `Timestamp` alias and helper near the imports**

Read the current header (first ~25 lines):

```bash
sed -n '1,25p' reference/ghostty/src/terminal/kitty/graphics_image.zig
```

Expected start:

```zig
const std = @import("std");
const builtin = @import("builtin");
const assert = @import("../../quirks.zig").inlineAssert;
const Allocator = std.mem.Allocator;
...
const sys = @import("../sys.zig");
...
const log = std.log.scoped(.kitty_gfx);
```

Insert after the `const log = ...` line:

```zig

/// Monotonic timestamp used for Image eviction ordering.
///
/// On wasm32-freestanding, `std.time.Instant` is not available, so we fall
/// back to a monotonic counter bumped on each call to `nowTimestamp`. Order
/// comparisons use `timestampOrder` (also exported) so that callers can work
/// with both representations uniformly.
pub const Timestamp = if (builtin.target.cpu.arch == .wasm32 and
                          builtin.target.os.tag == .freestanding)
    u64
else
    std.time.Instant;

var wasm_timestamp_counter: u64 = 1;

pub fn nowTimestamp() error{InternalError}!Timestamp {
    if (comptime builtin.target.cpu.arch == .wasm32 and
        builtin.target.os.tag == .freestanding)
    {
        defer wasm_timestamp_counter +%= 1;
        return wasm_timestamp_counter;
    }
    return std.time.Instant.now() catch |err| {
        log.warn("failed to get time: {}", .{err});
        return error.InternalError;
    };
}

pub fn timestampOrder(lhs: Timestamp, rhs: Timestamp) std.math.Order {
    return switch (@typeInfo(Timestamp)) {
        .int, .comptime_int => std.math.order(lhs, rhs),
        else => lhs.order(rhs),
    };
}
```

- [ ] **Step 2: Replace the call site in `LoadingImage.complete`**

Find line ~405 where `self.image.transmit_time = std.time.Instant.now() catch ...` is. Read context:

```bash
grep -n "transmit_time = std.time.Instant" reference/ghostty/src/terminal/kitty/graphics_image.zig
```

Replace the 4-line block:

```zig
        // Set our time
        self.image.transmit_time = std.time.Instant.now() catch |err| {
            log.warn("failed to get time: {}", .{err});
            return error.InternalError;
        };
```

with:

```zig
        // Set our time
        self.image.transmit_time = try nowTimestamp();
```

- [ ] **Step 3: Update the `Image` struct's `transmit_time` field**

Find the field definition (around line 515):

```bash
grep -n "transmit_time: std.time.Instant" reference/ghostty/src/terminal/kitty/graphics_image.zig
```

Replace:

```zig
    transmit_time: std.time.Instant = undefined,
```

with:

```zig
    transmit_time: Timestamp = undefined,
```

- [ ] **Step 4: Rebuild and capture the next error**

Run:

```bash
cd wasm
zig build 2>&1 | tee /tmp/zig-patch-b.log
cd ..
```

Expected: the error should now be in `graphics_storage.zig` — it uses `std.time.Instant` directly as a type and calls `.order()` on instances, both of which break when `Image.transmit_time` is `u64` on wasm.

- [ ] **Step 5: Commit Patch B**

Run:

```bash
cd reference/ghostty
git add src/terminal/kitty/graphics_image.zig
git commit -m "kitty: wasm-compatible Timestamp for Image.transmit_time

Add a compile-time Timestamp alias that falls back to a monotonic u64
counter on wasm32-freestanding, where std.time.Instant is unavailable.
Expose nowTimestamp() and timestampOrder() helpers so graphics_storage
can compare timestamps uniformly."
cd ../..
```

---

## Task 5: Patch C — `timestampOrder` in graphics_storage.zig

**Files:**
- Modify: `reference/ghostty/src/terminal/kitty/graphics_storage.zig`

- [ ] **Step 1: Read the current `std.time.Instant` use sites**

Run:

```bash
grep -n "std\.time\.Instant\|transmit_time\|\.order(" reference/ghostty/src/terminal/kitty/graphics_storage.zig
```

Expected lines (approximate):
- `~12:` `const Image = @import("graphics_image.zig").Image;` (no change needed)
- `~210:` `if (kv.value_ptr.transmit_time.order(newest.?.transmit_time) == .gt)`
- `~529:` `time: std.time.Instant,`
- `~557:` `.time = img.transmit_time,`
- `~576:` `if (lhs.used == rhs.used) return switch (lhs.time.order(rhs.time)) {`

- [ ] **Step 2: Import the helpers from graphics_image**

Near the top of the file, after:

```zig
const Image = @import("graphics_image.zig").Image;
```

add:

```zig
const Timestamp = @import("graphics_image.zig").Timestamp;
const timestampOrder = @import("graphics_image.zig").timestampOrder;
```

- [ ] **Step 3: Replace direct `Instant` usages**

At line ~529 (the `Candidate` struct field):

```zig
        const Candidate = struct {
            id: u32,
            time: std.time.Instant,
            used: bool,
        };
```

Change `time: std.time.Instant,` to `time: Timestamp,`.

- [ ] **Step 4: Replace `.order()` call sites with `timestampOrder`**

At line ~210:

```zig
            if (newest == null or
                kv.value_ptr.transmit_time.order(newest.?.transmit_time) == .gt)
```

Change to:

```zig
            if (newest == null or
                timestampOrder(kv.value_ptr.transmit_time, newest.?.transmit_time) == .gt)
```

At line ~576:

```zig
                    if (lhs.used == rhs.used) return switch (lhs.time.order(rhs.time)) {
```

Change to:

```zig
                    if (lhs.used == rhs.used) return switch (timestampOrder(lhs.time, rhs.time)) {
```

- [ ] **Step 5: Rebuild**

Run:

```bash
cd wasm
zig build 2>&1 | tee /tmp/zig-patch-c.log
cd ..
```

Expected: either the build succeeds, or a new error surfaces (possibly `std.fs.max_path_bytes` not defined on freestanding, or a `posix.realpath` linker issue). If the build succeeds, skip to Step 7.

- [ ] **Step 6: Iterate on remaining errors**

For each new error the compiler surfaces:

1. Read the error line and file.
2. Decide whether the offending code is reachable when `LoadingImage.Limits.direct` is used (i.e., `file = temporary_file = shared_memory = false`). If it is reachable, add a `comptime` guard that short-circuits on `wasm32-freestanding`. If it is unreachable (behind an `if (!limits.file)` guard), add a `comptime` stub so the type-checker is satisfied.
3. Common patterns:
   - `std.fs.max_path_bytes` → declare `const path_max_bytes = if (builtin.target.os.tag == .freestanding) 4096 else std.fs.max_path_bytes;` at the top of the file and use `path_max_bytes` everywhere.
   - `posix.realpath` calls inside test blocks → wrap the whole test in `if (builtin.target.os.tag == .freestanding) return;`.
   - `std.c.shm_open` references → already comptime-guarded by `if (comptime !builtin.link_libc) return error.UnsupportedMedium;`, which triggers first on wasm, so usually no change needed.
4. After each fix, run `zig build` again and record the progress in `/tmp/zig-patch-iter-N.log`.

Stop when `zig build` completes with no error.

- [ ] **Step 7: Commit all remaining changes as Patch C**

Run:

```bash
cd reference/ghostty
git status
git add -A
git commit -m "kitty: storage and misc wasm32-freestanding shims

Thread the Timestamp alias through graphics_storage and add any
further compile-time guards needed to make the ghostty-vt module
build cleanly for wasm32-freestanding with kitty_graphics enabled."
cd ../..
```

If Step 6 produced multiple distinct fixes, split them into separate commits for future rebase clarity — each file or each logical shim gets its own commit.

---

## Task 6: Verify and push wasm-kitty

**Files:**
- No restty files touched yet.

- [ ] **Step 1: Full wasm build sanity check**

Run:

```bash
cd wasm
rm -rf zig-out .zig-cache
zig build
cd ..
```

Expected: clean build, no warnings, `wasm/zig-out/bin/restty.wasm` exists.

- [ ] **Step 2: Verify the build output**

Run:

```bash
ls -la wasm/zig-out/bin/
file wasm/zig-out/bin/restty.wasm 2>/dev/null || echo "file(1) unavailable"
```

Expected: a `.wasm` file larger than 0 bytes.

- [ ] **Step 3: Push wasm-kitty to the fork**

Run:

```bash
cd reference/ghostty
git log --oneline main..wasm-kitty
git push origin wasm-kitty
cd ../..
```

Expected: 3–5 commits (Patches A, B, C plus any Step 6 iterations) pushed to `mizchi/ghostty`. The compare view `mizchi:main...mizchi:wasm-kitty` should now show these as the only divergence.

- [ ] **Step 4: Record the new HEAD commit for the submodule bump**

Run:

```bash
cd reference/ghostty
git rev-parse wasm-kitty
cd ../..
```

Record this SHA — it becomes the new submodule pin in Task 8.

---

## Task 7: Create the justfile with ghostty-* recipes

**Files:**
- Create: `justfile` (restty repo root)

- [ ] **Step 1: Create justfile**

Create `justfile` at the restty repo root with the following content:

```just
# restty task runner — see docs/development/ghostty-sync.md for ghostty fork ops

GHOSTTY_REMOTE    := "git@github.com:mizchi/ghostty.git"
GHOSTTY_UPSTREAM  := "https://github.com/ghostty-org/ghostty.git"
GHOSTTY_BRANCH    := "wasm-kitty"
GHOSTTY_DIR       := "reference/ghostty"

# Default: show available recipes.
default:
    @just --list

# Initialise the reference/ghostty submodule and ensure the ghostty-org
# remote is configured as `upstream`.
ghostty-init:
    git submodule update --init --recursive -- {{GHOSTTY_DIR}}
    cd {{GHOSTTY_DIR}} && (git remote get-url upstream >/dev/null 2>&1 \
        || git remote add upstream {{GHOSTTY_UPSTREAM}})

# Fetch ghostty-org/main, reset origin/main to match, then rebase the
# wasm-kitty branch onto it. Stops on conflict.
ghostty-sync: ghostty-init
    cd {{GHOSTTY_DIR}} && git fetch upstream main
    cd {{GHOSTTY_DIR}} && git checkout main \
        && git reset --hard upstream/main \
        && git push origin main
    cd {{GHOSTTY_DIR}} && git checkout {{GHOSTTY_BRANCH}} \
        && git fetch origin {{GHOSTTY_BRANCH}} \
        && git rebase main
    @echo "→ Run 'just ghostty-verify' then 'just ghostty-push'."

# Smoke build of the restty wasm target against the current submodule state.
ghostty-verify:
    cd wasm && zig build

# Force-push the rebased wasm-kitty branch and stage the submodule bump.
ghostty-push:
    cd {{GHOSTTY_DIR}} && git push --force-with-lease origin {{GHOSTTY_BRANCH}}
    git add {{GHOSTTY_DIR}}
    @echo "→ Submodule pointer staged. Commit it with a message like:"
    @echo "    chore(deps): bump ghostty wasm-kitty to <short-sha>"
```

- [ ] **Step 2: Verify just can parse the file**

Run:

```bash
just --list
```

Expected: lists `default`, `ghostty-init`, `ghostty-sync`, `ghostty-verify`, `ghostty-push`. If `just` is not installed, install it first (`brew install just` or use devbox).

- [ ] **Step 3: Smoke test `ghostty-verify`**

Run:

```bash
just ghostty-verify
```

Expected: PASS (same as Task 6 Step 1). This confirms the recipe works against the locally-cloned `reference/ghostty` (even though the submodule pointer in restty still points at the old wiedymi pin, the checked-out files on disk are the new `wasm-kitty` content).

- [ ] **Step 4: Commit the justfile**

Run:

```bash
git add justfile
git commit -m "chore: add justfile with ghostty-* recipes

Add a just-based task runner for the ghostty fork workflow:
ghostty-init, ghostty-sync, ghostty-verify, ghostty-push. See
docs/development/ghostty-sync.md for the runbook."
```

---

## Task 8: Swap the submodule to mizchi/ghostty

**Files:**
- Modify: `.gitmodules`
- Modify: `reference/ghostty` submodule pin (implicit via git submodule bookkeeping)

- [ ] **Step 1: Edit .gitmodules**

Current content:

```ini
[submodule "reference/ghostty"]
	path = reference/ghostty
	url = https://github.com/wiedymi/ghostty.git
[submodule "reference/text-shaper"]
	path = reference/text-shaper
	url = https://github.com/wiedymi/text-shaper.git
```

Change the `reference/ghostty` entry (leave `reference/text-shaper` untouched) to:

```ini
[submodule "reference/ghostty"]
	path = reference/ghostty
	url = https://github.com/mizchi/ghostty.git
	branch = wasm-kitty
```

- [ ] **Step 2: Clear the old submodule bookkeeping**

Run:

```bash
git submodule deinit -f reference/ghostty
rm -rf .git/modules/reference/ghostty
rm -rf reference/ghostty
```

Expected: all three commands succeed. `git status` now shows `reference/ghostty` as deleted.

- [ ] **Step 3: Re-initialise against the new URL**

Run:

```bash
git submodule update --init reference/ghostty
cd reference/ghostty
git checkout wasm-kitty
git rev-parse HEAD
cd ../..
```

Expected: `HEAD` equals the SHA recorded in Task 6 Step 4.

- [ ] **Step 4: Verify wasm build once more from a clean state**

Run:

```bash
rm -rf wasm/zig-out wasm/.zig-cache
just ghostty-verify
```

Expected: PASS. This is the load-bearing validation — it confirms that the new submodule URL + branch + pin produces a working wasm binary.

- [ ] **Step 5: Run restty's existing tests**

Run:

```bash
pnpm install
pnpm test 2>&1 | tee /tmp/restty-test.log
```

Expected: all tests pass. If any test fails, diagnose before committing. A likely failure mode is a test that captured the old wiedymi submodule pin in a snapshot — update the snapshot if appropriate.

- [ ] **Step 6: Commit the submodule swap**

Run:

```bash
git add .gitmodules reference/ghostty
git commit -m "chore: switch ghostty submodule to mizchi/ghostty wasm-kitty

Replaces the stale wiedymi/ghostty @ wterm-wasm-kitty-compat pin
(533+ commits behind upstream) with a fresh fork of
ghostty-org/ghostty carrying only the minimal wasm-kitty shim.

See docs/superpowers/specs/2026-04-11-ghostty-fork-design.md."
```

---

## Task 9: Write the ghostty-sync operator runbook

**Files:**
- Create: `docs/development/ghostty-sync.md`

- [ ] **Step 1: Create the runbook**

Create `docs/development/ghostty-sync.md` with the following content:

````markdown
# Syncing the ghostty fork

`reference/ghostty` is a submodule pinned to a branch called `wasm-kitty`
on [`mizchi/ghostty`](https://github.com/mizchi/ghostty), which is a fork
of [`ghostty-org/ghostty`](https://github.com/ghostty-org/ghostty). The
`wasm-kitty` branch carries a small set of patches that keep the Kitty
graphics protocol working on `wasm32-freestanding`; upstream disables it
there because `std.time.Instant` is unavailable on freestanding targets.

The design and rationale are in
[`docs/superpowers/specs/2026-04-11-ghostty-fork-design.md`](../superpowers/specs/2026-04-11-ghostty-fork-design.md).

## When to sync

- When a restty change needs a `ghostty-vt` feature or bugfix that landed
  upstream after our current submodule pin.
- Opportunistically, when you notice the pin is far behind upstream. A
  rough rule of thumb is "sync if more than a month stale".
- Never during a release freeze — a stale pin is safer than a broken one.

## The happy path

```bash
just ghostty-sync      # fetch upstream, rebase wasm-kitty onto main
just ghostty-verify    # wasm/zig build smoke test
just ghostty-push      # force-with-lease push wasm-kitty, stage bump
git commit -m "chore(deps): bump ghostty wasm-kitty to <short-sha>"
```

Then run `pnpm test` as the final sanity check before pushing restty.

## Conflict handling

If `just ghostty-sync` stops mid-rebase, the submodule is left with
conflict markers. Resolve them in `reference/ghostty`:

```bash
cd reference/ghostty
# edit conflicted files
git add -A
git rebase --continue
cd ../..
just ghostty-verify
just ghostty-push
```

Expect conflicts in `src/terminal/kitty/graphics_image.zig` and
`src/terminal/kitty/graphics_storage.zig`, which are the files the
`wasm-kitty` shim touches and are actively developed upstream.

If a conflict is severe enough that the shim no longer makes sense (e.g.
upstream restructured `Timestamp` or the `sys.zig` injection surface),
abort and open an issue:

```bash
cd reference/ghostty
git rebase --abort
cd ../..
```

The previous submodule pin remains valid — restty keeps working.

## What the shim patches do

Three small commits live on `wasm-kitty`:

1. **`build: force kitty_graphics on for wasm32-freestanding`**
   Changes `src/terminal/build_options.zig` so `kitty_graphics` is
   unconditionally `true` rather than disabled on wasm.
2. **`kitty: wasm-compatible Timestamp for Image.transmit_time`**
   Adds a compile-time `Timestamp` alias in
   `src/terminal/kitty/graphics_image.zig` that falls back to a
   monotonic `u64` counter on `wasm32-freestanding`, along with
   `nowTimestamp()` and `timestampOrder()` helpers.
3. **`kitty: storage and misc wasm32-freestanding shims`**
   Threads the new `Timestamp` alias through
   `src/terminal/kitty/graphics_storage.zig` and adds any other
   compile-time guards the type-checker demands (e.g.
   `std.fs.max_path_bytes` fallbacks).

If you find yourself adding a fourth patch during a rebase, update this
document with a one-line description of the new shim.

## Rollback

If the latest bump causes a regression, revert the submodule bump commit
in restty:

```bash
git revert HEAD
git submodule update --init reference/ghostty
just ghostty-verify
```

The old pin is still reachable — `mizchi/ghostty` never force-deletes
history.
````

- [ ] **Step 2: Commit the runbook**

Run:

```bash
git add docs/development/ghostty-sync.md
git commit -m "docs: add ghostty-sync runbook"
```

---

## Task 10: Update wasm-core docs to mention the fork

**Files:**
- Modify: `docs/internals/wasm-core.md`

- [ ] **Step 1: Read the current top of the file**

Run:

```bash
sed -n '1,20p' docs/internals/wasm-core.md
```

- [ ] **Step 2: Add a fork note near the introduction**

Insert after the first heading and first intro paragraph a new paragraph:

```markdown
> **Submodule note:** `reference/ghostty` is pinned to the `wasm-kitty`
> branch of [`mizchi/ghostty`](https://github.com/mizchi/ghostty), a fork
> of `ghostty-org/ghostty` that re-enables the Kitty graphics protocol on
> `wasm32-freestanding`. The rebase workflow is documented in
> [`docs/development/ghostty-sync.md`](../development/ghostty-sync.md).
```

Use the `Edit` tool to insert it at the appropriate place (after the
existing intro paragraph, before the "What" or "How" section).

- [ ] **Step 3: Commit the doc update**

Run:

```bash
git add docs/internals/wasm-core.md
git commit -m "docs(internals): note the mizchi/ghostty wasm-kitty fork"
```

---

## Task 11: Final verification and push

**Files:**
- No file changes.

- [ ] **Step 1: Re-run the full smoke test**

Run:

```bash
git status
rm -rf wasm/zig-out wasm/.zig-cache
just ghostty-verify
pnpm test 2>&1 | tail -20
```

Expected: `git status` clean, wasm build passes, `pnpm test` passes.

- [ ] **Step 2: Review the commit log for this feature**

Run:

```bash
git log --oneline -15
```

Expected commits (roughly in this order, newest first):

1. `docs(internals): note the mizchi/ghostty wasm-kitty fork`
2. `docs: add ghostty-sync runbook`
3. `chore: switch ghostty submodule to mizchi/ghostty wasm-kitty`
4. `chore: add justfile with ghostty-* recipes`
5. `docs: add ghostty fork design spec` (from the brainstorming session)

- [ ] **Step 3: Push**

Ask the user before pushing — this is a cross-system change that touches
both `mizchi/ghostty` (already pushed in Task 6 Step 3) and `mizchi/restty`.

```bash
git push origin main
```

- [ ] **Step 4: Done**

At this point:
- `mizchi/ghostty` exists, has `main` mirroring upstream and `wasm-kitty`
  carrying the shim.
- `mizchi/restty` `.gitmodules` points at the new fork, the submodule pin
  advances to the new `wasm-kitty` HEAD, and the justfile + runbook make
  future syncs mechanical.
- The design spec and this plan are both committed for future reference.

---

## Post-plan follow-ups (NOT part of this plan)

Captured here so they are not lost:

- **GitHub Actions cron for `ghostty-sync`.** Worth revisiting after ~3
  manual syncs have given us a feel for how often conflicts appear.
- **Upstream PR offering the `sys.zig`-based clock injection.** Would
  eliminate the fork entirely if accepted.
- **Parallel work on `wiedymi/text-shaper`.** Out of scope for this plan.

Do NOT attempt any of these during plan execution.
