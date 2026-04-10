import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

test("native scrollbar host moves sticky transform handling onto a wrapper instead of the canvas", () => {
  const source = readFileSync(
    join(process.cwd(), "src/runtime/create-runtime/native-scrollbar-host.ts"),
    "utf8",
  );
  expect(source.includes("restty-native-scroll-viewport")).toBe(true);
  expect(source.includes("viewport.append(canvas);")).toBe(true);
  expect(source.includes('viewport.style.transform = "translate3d(0, 0, 0)"')).toBe(true);
  expect(source.includes("viewport.style.transform = `translate3d(0, ${-residual}px, 0)`")).toBe(
    true,
  );
  expect(source.includes("canvas.style.transform =")).toBe(false);
});
