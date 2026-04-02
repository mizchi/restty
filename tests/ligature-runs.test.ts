import { expect, test } from "bun:test";
import {
  Font,
  UnicodeBuffer,
  shape,
  tagToString,
} from "text-shaper";
import {
  resolveLigatureRun,
  shouldUseLigatureShape,
} from "../src/runtime/create-runtime/ligature-runs";

const FIRA_CODE_PATH = "playground/public/fonts/FiraCode-Regular.ttf";

function rgba(bytes: number[]): Uint8Array {
  return new Uint8Array(bytes);
}

async function loadFont(path: string) {
  const buffer = await Bun.file(path).arrayBuffer();
  return Font.loadAsync(buffer);
}

test("resolveLigatureRun groups visually uniform operator runs", () => {
  const text = "=>=";
  const codepoints = new Uint32Array(Array.from(text, (ch) => ch.codePointAt(0) ?? 0));
  const styleFlags = new Uint16Array([0, 0, 0]);
  const linkIds = new Uint32Array([0, 0, 0]);
  const fgBytes = rgba([
    255, 255, 255, 255,
    255, 255, 255, 255,
    255, 255, 255, 255,
  ]);
  const bgBytes = rgba([
    0, 0, 0, 255,
    0, 0, 0, 255,
    0, 0, 0, 255,
  ]);

  const run = resolveLigatureRun({
    idx: 0,
    row: 0,
    col: 0,
    cols: 3,
    contentTags: null,
    styleFlags,
    linkIds,
    fgBytes,
    bgBytes,
    ulBytes: null,
    ulStyle: null,
    cursorBlock: false,
    cursorCell: null,
    readCellCluster: (cellIndex) => ({
      cp: codepoints[cellIndex] ?? 0,
      text: text[cellIndex] ?? "",
      span: 1,
    }),
  });

  expect(run).toEqual({
    text: "=>=",
    span: 3,
    indices: [0, 1, 2],
  });
});

test("resolveLigatureRun stops at style boundaries", () => {
  const text = "=>";

  const run = resolveLigatureRun({
    idx: 0,
    row: 0,
    col: 0,
    cols: 2,
    contentTags: null,
    styleFlags: new Uint16Array([0, 1]),
    linkIds: new Uint32Array([0, 0]),
    fgBytes: rgba([
      255, 255, 255, 255,
      255, 255, 255, 255,
    ]),
    bgBytes: null,
    ulBytes: null,
    ulStyle: null,
    cursorBlock: false,
    cursorCell: null,
    readCellCluster: (cellIndex) => ({
      cp: text.codePointAt(cellIndex) ?? 0,
      text: text[cellIndex] ?? "",
      span: 1,
    }),
  });

  expect(run).toBeNull();
});

test("resolveLigatureRun avoids merging across the block cursor cell", () => {
  const text = "->";

  const run = resolveLigatureRun({
    idx: 0,
    row: 0,
    col: 0,
    cols: 2,
    contentTags: null,
    styleFlags: new Uint16Array([0, 0]),
    linkIds: new Uint32Array([0, 0]),
    fgBytes: rgba([
      255, 255, 255, 255,
      255, 255, 255, 255,
    ]),
    bgBytes: null,
    ulBytes: null,
    ulStyle: null,
    cursorBlock: true,
    cursorCell: { row: 0, col: 1, wide: false },
    readCellCluster: (cellIndex) => ({
      cp: text.codePointAt(cellIndex) ?? 0,
      text: text[cellIndex] ?? "",
      span: 1,
    }),
  });

  expect(run).toBeNull();
});

test("bundled Fira Code exposes ligature-oriented GSUB features", async () => {
  const font = await loadFont(FIRA_CODE_PATH);
  const gsubFeatures = (font.gsub?.featureList?.features ?? []).map((feature) =>
    tagToString(feature.featureTag),
  );

  expect(gsubFeatures).toContain("calt");
  expect(gsubFeatures).toContain("ss01");
  expect(gsubFeatures).toContain("ss02");
});

test("bundled Fira Code changes operator shaping even when glyph count stays the same", async () => {
  const font = await loadFont(FIRA_CODE_PATH);
  const combined = shape(font, new UnicodeBuffer().addStr("=>"));
  const singleEquals = shape(font, new UnicodeBuffer().addStr("="));
  const singleArrow = shape(font, new UnicodeBuffer().addStr(">"));
  const toComparableShape = (glyphBuffer: typeof combined) => ({
    glyphs: glyphBuffer.infos.map((glyph, index) => ({
      glyphId: glyph.glyphId,
      xAdvance: glyphBuffer.positions[index]?.xAdvance ?? 0,
      xOffset: glyphBuffer.positions[index]?.xOffset ?? 0,
    })),
    advance: glyphBuffer.positions.reduce((sum, glyph) => sum + glyph.xAdvance, 0),
  });

  expect(combined.infos.length).toBe(singleEquals.infos.length + singleArrow.infos.length);
  expect(
    shouldUseLigatureShape(
      toComparableShape(combined),
      [singleEquals, singleArrow].map(toComparableShape),
    ),
  ).toBe(true);
});
