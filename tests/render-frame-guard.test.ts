import { expect, test } from "bun:test";
import {
  hasPresentableRenderState,
  shouldDeferIncompleteGlyphFrame,
} from "../src/runtime/create-runtime/render-frame-guard";
import type { RenderState } from "../src/wasm";

function createRenderState(overrides: Partial<RenderState> = {}): RenderState {
  return {
    rows: 1,
    cols: 1,
    cellCount: 1,
    codepoints: new Uint32Array([65]),
    contentTags: null,
    wide: null,
    cellFlags: null,
    styleFlags: null,
    linkIds: null,
    fgBytes: new Uint8Array([255, 255, 255, 255]),
    bgBytes: null,
    ulBytes: null,
    ulStyle: null,
    linkOffsets: null,
    linkLengths: null,
    linkBuffer: null,
    graphemeOffset: null,
    graphemeLen: null,
    graphemeBuffer: null,
    selectionStart: null,
    selectionEnd: null,
    cursor: null,
    ...overrides,
  };
}

test("accepts render states with a full grid and color data", () => {
  expect(hasPresentableRenderState(createRenderState(), true)).toBe(true);
});

test("rejects render states while the font or grid is not ready", () => {
  expect(hasPresentableRenderState(createRenderState(), false)).toBe(false);
  expect(hasPresentableRenderState(createRenderState({ rows: 0 }), true)).toBe(false);
  expect(hasPresentableRenderState(createRenderState({ cols: 0 }), true)).toBe(false);
  expect(hasPresentableRenderState(createRenderState({ cellCount: 0 }), true)).toBe(false);
});

test("rejects incomplete typed-array snapshots", () => {
  expect(hasPresentableRenderState(createRenderState({ codepoints: null }), true)).toBe(false);
  expect(hasPresentableRenderState(createRenderState({ fgBytes: null }), true)).toBe(false);
  expect(
    hasPresentableRenderState(createRenderState({ codepoints: new Uint32Array(0) }), true),
  ).toBe(false);
  expect(
    hasPresentableRenderState(createRenderState({ fgBytes: new Uint8Array(0) }), true),
  ).toBe(false);
});

test("defers frames when glyph work exists but nothing can be emitted", () => {
  expect(
    shouldDeferIncompleteGlyphFrame({
      queuedGlyphItems: 3,
      emittedGlyphInstances: 0,
    }),
  ).toBe(true);
  expect(
    shouldDeferIncompleteGlyphFrame({
      queuedGlyphItems: 0,
      emittedGlyphInstances: 0,
    }),
  ).toBe(false);
  expect(
    shouldDeferIncompleteGlyphFrame({
      queuedGlyphItems: 3,
      emittedGlyphInstances: 2,
    }),
  ).toBe(false);
});
