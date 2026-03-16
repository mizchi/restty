import { expect, test } from "bun:test";
import {
  DEFAULT_IME_FONT_FAMILY,
  PREEDIT_ACTIVE_BG,
  PREEDIT_BG,
  resolveImeAnchor,
  syncImeInputTypography,
  updateImePosition,
} from "../src/ime";

function createFakeImeInput(): HTMLInputElement {
  return {
    style: {},
  } as unknown as HTMLInputElement;
}

test("syncImeInputTypography applies default IME typography", () => {
  const imeInput = createFakeImeInput();

  syncImeInputTypography(imeInput, 19.7);

  expect(imeInput.style.fontSize).toBe("20pt");
  expect(imeInput.style.lineHeight).toBe("20pt");
  expect(imeInput.style.fontFamily).toBe(DEFAULT_IME_FONT_FAMILY);
  expect(imeInput.style.fontWeight).toBe("400");
  expect(imeInput.style.letterSpacing).toBe("0");
});

test("syncImeInputTypography clamps font size to supported range", () => {
  const imeInput = createFakeImeInput();

  syncImeInputTypography(imeInput, 2);
  expect(imeInput.style.fontSize).toBe("10pt");

  syncImeInputTypography(imeInput, 200);
  expect(imeInput.style.fontSize).toBe("64pt");
});

test("syncImeInputTypography safely ignores null input", () => {
  expect(() => syncImeInputTypography(null, 18)).not.toThrow();
});

test("resolveImeAnchor clamps row/col into viewport bounds", () => {
  expect(resolveImeAnchor({ row: 300, col: -6 }, 80, 24)).toEqual({ row: 23, col: 0 });
  expect(resolveImeAnchor({ row: 7, col: 9 }, 80, 24)).toEqual({ row: 7, col: 9 });
});

test("resolveImeAnchor backs up wide-tail cursor and clamps", () => {
  expect(resolveImeAnchor({ row: 5, col: 0, wideTail: true }, 80, 24)).toEqual({ row: 5, col: 0 });
  expect(resolveImeAnchor({ row: 5, col: 12, wideTail: true }, 80, 24)).toEqual({
    row: 5,
    col: 11,
  });
});

test("updateImePosition writes absolute left/top for IME anchor", () => {
  const imeInput = createFakeImeInput();
  updateImePosition(
    imeInput,
    { row: 2, col: 3 },
    20,
    30,
    1,
    {
      left: 100,
      top: 200,
    } as DOMRect,
  );
  expect(imeInput.style.transform).toBe("none");
  expect(imeInput.style.left).toBe("160px");
  expect(imeInput.style.top).toBe("260px");
});

test("preedit overlay backgrounds stay opaque for readability", () => {
  expect(PREEDIT_BG[3]).toBe(1);
  expect(PREEDIT_ACTIVE_BG[3]).toBe(1);
});
