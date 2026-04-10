export type RenderPresentMode = "direct" | "offscreen-copy" | "offscreen-stage";

export function resolveRenderPresentMode(params: {
  hasCustomStages: boolean;
  atomicPresent: boolean;
}): RenderPresentMode {
  if (params.hasCustomStages) return "offscreen-stage";
  if (params.atomicPresent) return "offscreen-copy";
  return "direct";
}
