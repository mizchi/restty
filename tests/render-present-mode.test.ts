import { describe, expect, it } from "bun:test";
import { resolveRenderPresentMode } from "../src/runtime/create-runtime/render-present-mode";

describe("render present mode", () => {
  it("renders directly only when atomic present is disabled and no custom stages exist", () => {
    expect(resolveRenderPresentMode({ hasCustomStages: false, atomicPresent: false })).toBe(
      "direct",
    );
  });

  it("uses an offscreen copy pass when atomic present is enabled", () => {
    expect(resolveRenderPresentMode({ hasCustomStages: false, atomicPresent: true })).toBe(
      "offscreen-copy",
    );
  });

  it("keeps custom shader stages on the staged offscreen path", () => {
    expect(resolveRenderPresentMode({ hasCustomStages: true, atomicPresent: false })).toBe(
      "offscreen-stage",
    );
    expect(resolveRenderPresentMode({ hasCustomStages: true, atomicPresent: true })).toBe(
      "offscreen-stage",
    );
  });
});
