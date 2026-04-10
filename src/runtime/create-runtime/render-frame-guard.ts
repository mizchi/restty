import type { RenderState } from "../../wasm";

export function hasPresentableRenderState(
  render: RenderState | null,
  fontReady: boolean,
): render is RenderState & {
  codepoints: Uint32Array;
  fgBytes: Uint8Array;
} {
  if (!render || !fontReady) return false;
  if (render.rows <= 0 || render.cols <= 0 || render.cellCount <= 0) return false;
  if (!render.codepoints || !render.fgBytes) return false;
  if (render.codepoints.length < render.cellCount) return false;
  if (render.fgBytes.length < render.cellCount * 4) return false;
  return true;
}

export function shouldDeferIncompleteGlyphFrame(params: {
  queuedGlyphItems: number;
  emittedGlyphInstances: number;
}): boolean {
  return params.queuedGlyphItems > 0 && params.emittedGlyphInstances === 0;
}
