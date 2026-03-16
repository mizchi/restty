import { expect, test } from "bun:test";
import {
  resolveHighlightBackgroundColor,
  resolveHighlightForegroundColor,
  runtimeTerminalColorFromTheme,
} from "../src/runtime/create-runtime/highlight-terminal-color-utils";

test("runtimeTerminalColorFromTheme keeps explicit colors opaque", () => {
  const color = runtimeTerminalColorFromTheme({ r: 255, g: 224, b: 130 });

  expect(color).toEqual({
    kind: "color",
    color: [1, 224 / 255, 130 / 255, 1],
  });
});

test("runtimeTerminalColorFromTheme preserves Ghostty TerminalColor aliases", () => {
  expect(runtimeTerminalColorFromTheme("cell-foreground")).toEqual({
    kind: "cell-foreground",
  });
  expect(runtimeTerminalColorFromTheme("cell-background")).toEqual({
    kind: "cell-background",
  });
});

test("highlight resolvers map aliases to the rendered cell colors", () => {
  const fg: [number, number, number, number] = [0.1, 0.2, 0.3, 1];
  const bg: [number, number, number, number] = [0.7, 0.8, 0.9, 1];

  expect(resolveHighlightBackgroundColor({ kind: "cell-foreground" }, fg, bg, false)).toEqual(fg);
  expect(resolveHighlightBackgroundColor({ kind: "cell-background" }, fg, bg, false)).toEqual(bg);
  expect(resolveHighlightForegroundColor({ kind: "cell-foreground" }, fg, bg, true)).toEqual(bg);
  expect(resolveHighlightForegroundColor({ kind: "cell-background" }, fg, bg, true)).toEqual(fg);
});
