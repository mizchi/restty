export type PreferredRenderer = "auto" | "auto-webgl2" | "webgpu" | "webgl2";
export type RuntimeBackendAttempt = "webgpu" | "webgl2";

export function resolveRendererAttemptOrder(
  preferredRenderer: PreferredRenderer,
): RuntimeBackendAttempt[] {
  switch (preferredRenderer) {
    case "webgpu":
      return ["webgpu"];
    case "webgl2":
      return ["webgl2"];
    case "auto-webgl2":
      return ["webgl2", "webgpu"];
    default:
      return ["webgpu", "webgl2"];
  }
}
