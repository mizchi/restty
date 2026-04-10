import { describe, expect, it } from "bun:test";
import { resolveRendererAttemptOrder } from "../src/runtime/create-runtime/renderer-attempt-order";

describe("renderer attempt order", () => {
  it("keeps auto as webgpu-first", () => {
    expect(resolveRendererAttemptOrder("auto")).toEqual(["webgpu", "webgl2"]);
  });

  it("supports webgl2-first auto mode", () => {
    expect(resolveRendererAttemptOrder("auto-webgl2")).toEqual(["webgl2", "webgpu"]);
  });

  it("keeps explicit renderer selection as a single-backend attempt", () => {
    expect(resolveRendererAttemptOrder("webgpu")).toEqual(["webgpu"]);
    expect(resolveRendererAttemptOrder("webgl2")).toEqual(["webgl2"]);
  });
});
