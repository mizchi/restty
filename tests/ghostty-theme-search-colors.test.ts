import { expect, test } from "bun:test";
import { parseGhosttyTheme } from "../src/theme";

test("parseGhosttyTheme reads Ghostty search color keys", () => {
  const theme = parseGhosttyTheme(`
background = #101010
foreground = #efefef
search-background = #ffe082
search-foreground = #000000
search-selected-background = #f2a57e
search-selected-foreground = #111111
`);

  expect(theme.colors.searchBackground).toEqual({ r: 255, g: 224, b: 130 });
  expect(theme.colors.searchForeground).toEqual({ r: 0, g: 0, b: 0 });
  expect(theme.colors.searchSelectedBackground).toEqual({ r: 242, g: 165, b: 126 });
  expect(theme.colors.searchSelectedForeground).toEqual({ r: 17, g: 17, b: 17 });
});

test("parseGhosttyTheme preserves TerminalColor aliases for search colors", () => {
  const theme = parseGhosttyTheme(`
search-background = cell-foreground
search-foreground = cell-background
search-selected-background = cell-background
search-selected-foreground = cell-foreground
`);

  expect(theme.colors.searchBackground).toBe("cell-foreground");
  expect(theme.colors.searchForeground).toBe("cell-background");
  expect(theme.colors.searchSelectedBackground).toBe("cell-background");
  expect(theme.colors.searchSelectedForeground).toBe("cell-foreground");
});
