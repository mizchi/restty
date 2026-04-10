import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

test("scrollbar runtime respects the nativeScrollbar option before creating DOM host", () => {
  const source = readFileSync(
    join(process.cwd(), "src/runtime/create-runtime/interaction-runtime/scrollbar-runtime.ts"),
    "utf8",
  );

  expect(source.includes("nativeScrollbar !== false")).toBe(true);
  expect(source.includes("? createNativeScrollbarHost(")).toBe(true);
});
