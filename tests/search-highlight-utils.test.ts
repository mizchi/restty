import { expect, test } from "bun:test";
import {
  appendSearchHighlights,
  searchHighlightForColumn,
} from "../src/runtime/create-runtime/search-highlight-utils";

test("appendSearchHighlights clamps viewport spans and marks active match color", () => {
  const rects: Array<{ x: number; y: number; width: number; height: number; color: number[] }> =
    [];

  appendSearchHighlights({
    target: [],
    matches: [
      { row: 1, startCol: -2, endCol: 3, selected: false },
      { row: 2, startCol: 4, endCol: 9, selected: true },
      { row: -1, startCol: 0, endCol: 1, selected: false },
      { row: 9, startCol: 1, endCol: 2, selected: true },
    ],
    rows: 4,
    cols: 6,
    cellW: 10,
    cellH: 20,
    inactiveColor: [1, 2, 3, 4],
    activeColor: [5, 6, 7, 8],
    pushRect: (_target, x, y, width, height, color) => {
      rects.push({ x, y, width, height, color });
    },
  });

  expect(rects).toEqual([
    { x: 0, y: 20, width: 30, height: 20, color: [1, 2, 3, 4] },
    { x: 40, y: 40, width: 20, height: 20, color: [5, 6, 7, 8] },
  ]);
});

test("searchHighlightForColumn distinguishes inactive and active row matches", () => {
  const matches = [
    { row: 0, startCol: 1, endCol: 3, selected: false },
    { row: 0, startCol: 5, endCol: 7, selected: true },
  ];

  expect(searchHighlightForColumn(matches, 0, 2, 0, 10)).toEqual({
    nextIndex: 0,
    kind: 0,
  });
  expect(searchHighlightForColumn(matches, 0, 2, 1, 10)).toEqual({
    nextIndex: 0,
    kind: 1,
  });
  expect(searchHighlightForColumn(matches, 0, 2, 4, 10)).toEqual({
    nextIndex: 1,
    kind: 0,
  });
  expect(searchHighlightForColumn(matches, 1, 2, 5, 10)).toEqual({
    nextIndex: 1,
    kind: 2,
  });
});
