import { expect, test } from "bun:test";
import { resolveDesktopWordSelectionRange } from "../src/runtime/create-runtime/interaction-runtime/desktop-word-selection";
import type { RenderState } from "../src/wasm";

function createRenderState(text: string, wideCols: number[] = []): RenderState {
  const cols = text.length;
  const cellCount = cols;
  const codepoints = new Uint32Array(cellCount);
  for (let i = 0; i < cols; i += 1) {
    codepoints[i] = text.codePointAt(i) ?? 0;
  }
  const wide = new Uint8Array(cellCount);
  for (const col of wideCols) {
    if (col >= 0 && col < cols) wide[col] = 1;
    if (col + 1 >= 0 && col + 1 < cols) wide[col + 1] = 2;
  }
  return {
    rows: 1,
    cols,
    cellCount,
    codepoints,
    contentTags: new Uint8Array(cellCount),
    wide,
    cellFlags: new Uint16Array(cellCount),
    styleFlags: new Uint16Array(cellCount),
    linkIds: new Uint32Array(cellCount),
    fgBytes: new Uint8Array(cellCount * 4),
    bgBytes: new Uint8Array(cellCount * 4),
    ulBytes: new Uint8Array(cellCount * 4),
    ulStyle: new Uint8Array(cellCount),
    linkOffsets: new Uint32Array(0),
    linkLengths: new Uint32Array(0),
    linkBuffer: new Uint8Array(0),
    graphemeOffset: new Uint32Array(cellCount),
    graphemeLen: new Uint32Array(cellCount),
    graphemeBuffer: new Uint32Array(0),
    selectionStart: new Int16Array(1),
    selectionEnd: new Int16Array(1),
    cursor: null,
  };
}

test("resolveDesktopWordSelectionRange selects contiguous word runs", () => {
  const render = createRenderState("echo hello_world again");
  expect(resolveDesktopWordSelectionRange(render, { row: 0, col: 6 })).toEqual({
    start: 5,
    end: 16,
  });
});

test("resolveDesktopWordSelectionRange selects contiguous whitespace runs", () => {
  const render = createRenderState("foo   bar");
  expect(resolveDesktopWordSelectionRange(render, { row: 0, col: 4 })).toEqual({
    start: 3,
    end: 6,
  });
});

test("resolveDesktopWordSelectionRange treats configured boundary chars separately", () => {
  const render = createRenderState("foo::bar");
  expect(resolveDesktopWordSelectionRange(render, { row: 0, col: 4 })).toEqual({
    start: 3,
    end: 5,
  });
});

test("resolveDesktopWordSelectionRange keeps dots, slashes, and hyphens inside words", () => {
  const render = createRenderState("docker-compose.valkey.yml");
  expect(resolveDesktopWordSelectionRange(render, { row: 0, col: 8 })).toEqual({
    start: 0,
    end: 25,
  });
});

test("resolveDesktopWordSelectionRange treats path separators as word chars", () => {
  const render = createRenderState("src/runtime/types.ts foo");
  expect(resolveDesktopWordSelectionRange(render, { row: 0, col: 5 })).toEqual({
    start: 0,
    end: 20,
  });
});

test("resolveDesktopWordSelectionRange keeps wide glyph spans intact", () => {
  const render = createRenderState("A好 B", [1]);
  expect(resolveDesktopWordSelectionRange(render, { row: 0, col: 1 })).toEqual({
    start: 0,
    end: 4,
  });
});
