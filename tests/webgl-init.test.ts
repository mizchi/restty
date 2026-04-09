import { expect, test } from "bun:test";
import { initWebGL } from "../src/renderer/webgpu/webgl";

test("initWebGL requests a preserved drawing buffer to avoid blank composite frames", () => {
  let requestedType: string | null = null;
  let requestedOptions: WebGLContextAttributes | null = null;

  const canvas = {
    getContext: (type: string, options?: WebGLContextAttributes | null) => {
      requestedType = type;
      requestedOptions = options ?? null;
      return null;
    },
  } as unknown as HTMLCanvasElement;

  expect(initWebGL(canvas)).toBeNull();
  expect(requestedType).toBe("webgl2");
  expect(requestedOptions).toEqual({
    antialias: false,
    alpha: false,
    preserveDrawingBuffer: true,
  });
});
