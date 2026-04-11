# restty task runner.
#
# See docs/development/ghostty-sync.md for the ghostty fork operator runbook.
#
# NOTE: native zig 0.15.2 is currently broken on macOS 26.4 (libSystem linker
# error in the build runner). `ghostty-verify` runs the wasm build inside an
# Apple container with Linux zig so that builds work on this host. On a Linux
# host with a working native zig you can run `cd wasm && zig build
# -Dtarget=wasm32-freestanding -Doptimize=ReleaseSafe` directly.

GHOSTTY_REMOTE     := "https://github.com/mizchi/ghostty.git"
GHOSTTY_UPSTREAM   := "https://github.com/ghostty-org/ghostty.git"
GHOSTTY_BRANCH     := "wasm-kitty"
GHOSTTY_DIR        := "reference/ghostty"
ZIG_LINUX_VERSION  := "0.15.2"
ZIG_LINUX_ARCH     := "aarch64"
ZIG_LINUX_DIR      := ".cache/zig-linux/zig-" + ZIG_LINUX_ARCH + "-linux-" + ZIG_LINUX_VERSION
CONTAINER_IMAGE    := "alpine:3.21"
REPO_ROOT          := justfile_directory()

# Default: show available recipes.
default:
    @just --list

# Initialise the reference/ghostty submodule and ensure the ghostty-org
# remote is configured as `upstream` inside it.
ghostty-init:
    git submodule update --init --recursive -- {{GHOSTTY_DIR}}
    cd {{GHOSTTY_DIR}} && (git remote get-url upstream >/dev/null 2>&1 \
        || git remote add upstream {{GHOSTTY_UPSTREAM}})

# Download the Linux zig toolchain used by ghostty-verify if it's missing.
# Idempotent: re-running is a no-op.
ghostty-zig-linux:
    #!/usr/bin/env bash
    set -euo pipefail
    if [[ -x "{{ZIG_LINUX_DIR}}/zig" ]]; then
        exit 0
    fi
    mkdir -p "$(dirname "{{ZIG_LINUX_DIR}}")"
    url="https://ziglang.org/download/{{ZIG_LINUX_VERSION}}/zig-{{ZIG_LINUX_ARCH}}-linux-{{ZIG_LINUX_VERSION}}.tar.xz"
    echo "Downloading $url"
    curl -sSL "$url" -o "{{ZIG_LINUX_DIR}}.tar.xz"
    tar -xf "{{ZIG_LINUX_DIR}}.tar.xz" -C "$(dirname "{{ZIG_LINUX_DIR}}")"
    rm "{{ZIG_LINUX_DIR}}.tar.xz"
    test -x "{{ZIG_LINUX_DIR}}/zig"

# Smoke-build the restty wasm target against the current submodule state.
# Runs inside an Apple container with Linux zig because native zig 0.15.2
# is broken on macOS 26.4.
ghostty-verify: ghostty-zig-linux
    #!/usr/bin/env bash
    set -euo pipefail
    rm -rf wasm/zig-out wasm/.zig-cache
    container run --rm \
        -v "{{REPO_ROOT}}:/work" \
        -w /work/wasm \
        {{CONTAINER_IMAGE}} \
        /work/{{ZIG_LINUX_DIR}}/zig build \
            -Dtarget=wasm32-freestanding -Doptimize=ReleaseSafe
    test -s wasm/zig-out/bin/restty.wasm
    echo "→ wasm/zig-out/bin/restty.wasm built successfully"

# Fetch ghostty-org/main, reset our fork's main to match, then rebase
# the wasm-kitty branch onto it. Stops on conflict.
ghostty-sync: ghostty-init
    cd {{GHOSTTY_DIR}} && git fetch upstream main
    cd {{GHOSTTY_DIR}} && git checkout main \
        && git reset --hard upstream/main \
        && git push origin main
    cd {{GHOSTTY_DIR}} && git checkout {{GHOSTTY_BRANCH}} \
        && git fetch origin {{GHOSTTY_BRANCH}} \
        && git rebase main
    @echo "→ Run 'just ghostty-verify' then 'just ghostty-push'."

# Force-push the rebased wasm-kitty branch and stage the submodule bump.
ghostty-push:
    cd {{GHOSTTY_DIR}} && git push --force-with-lease origin {{GHOSTTY_BRANCH}}
    git add {{GHOSTTY_DIR}}
    @echo "→ Submodule pointer staged. Commit with a message like:"
    @echo "    chore(deps): bump ghostty wasm-kitty to $(cd {{GHOSTTY_DIR}} && git rev-parse --short {{GHOSTTY_BRANCH}})"
