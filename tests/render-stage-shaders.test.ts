import { describe, expect, it } from "bun:test";
import {
  PASSTHROUGH_STAGE_SHADER_GL,
  PASSTHROUGH_STAGE_SHADER_WGSL,
} from "../src/runtime/render-stage-shaders";

describe("render stage shaders", () => {
  it("defines a full passthrough WGSL stage function", () => {
    expect(PASSTHROUGH_STAGE_SHADER_WGSL).toContain("fn resttyStage(");
    expect(PASSTHROUGH_STAGE_SHADER_WGSL).toContain("return color;");
  });

  it("defines a full passthrough GLSL stage function", () => {
    expect(PASSTHROUGH_STAGE_SHADER_GL).toContain("vec4 resttyStage(");
    expect(PASSTHROUGH_STAGE_SHADER_GL).toContain("return color;");
  });
});
