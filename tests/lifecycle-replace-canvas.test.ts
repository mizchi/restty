import { expect, test } from "bun:test";
import { createLifecycleCanvasHandlers } from "../src/runtime/create-runtime/lifecycle-theme-size-canvas";

class FakeParent {
  children: unknown[] = [];

  appendChild(child: FakeCanvas): void {
    child.parentElement = this as unknown as HTMLElement;
    this.children.push(child);
  }

  replaceChild(newChild: FakeCanvas, oldChild: FakeCanvas): void {
    const index = this.children.indexOf(oldChild);
    if (index === -1) {
      throw new Error("old child not found");
    }
    oldChild.parentElement = null;
    newChild.parentElement = this as unknown as HTMLElement;
    this.children[index] = newChild;
  }
}

class FakeCanvas {
  width = 320;
  height = 160;
  id = "canvas";
  className = "pane-canvas";
  parentElement: HTMLElement | null = null;
  tabIndex = 0;

  focus(): void {}
  blur(): void {}
  addEventListener(): void {}
  removeEventListener(): void {}
}

test("replaceCanvas re-resolves the parent after cleanup moves the canvas", () => {
  const originalDocument = (globalThis as { document?: Document }).document;
  const originalWindow = (globalThis as { window?: Window }).window;

  const viewport = new FakeParent();
  const host = new FakeParent();
  const canvas = new FakeCanvas();
  viewport.appendChild(canvas);

  let currentCanvas = canvas;
  const createdCanvases: FakeCanvas[] = [];

  (globalThis as { document?: Document }).document = {
    createElement(tagName: string) {
      if (tagName !== "canvas") throw new Error(`unexpected tag: ${tagName}`);
      const next = new FakeCanvas();
      createdCanvases.push(next);
      return next as unknown as HTMLElement;
    },
    activeElement: null,
  } as unknown as Document;
  (globalThis as { window?: Window }).window = {
    devicePixelRatio: 1,
  } as Window;

  try {
    const handlers = createLifecycleCanvasHandlers({
      attachCanvasEvents: false,
      attachWindowEvents: false,
      autoResize: false,
      imeInput: null,
      dprEl: null,
      sizeEl: null,
      callbacks: undefined,
      cleanupFns: [],
      cleanupCanvasFns: [
        () => {
          host.appendChild(currentCanvas);
        },
      ],
      gridState: {
        cols: 80,
        rows: 24,
        cellW: 8,
        cellH: 16,
        fontSizePx: 16,
      },
      resizeState: {
        active: false,
        lastAt: 0,
        cols: 80,
        rows: 24,
        dpr: 1,
      },
      fontState: { fonts: [] },
      defaultBgBase: [0, 0, 0, 1],
      defaultFgBase: [1, 1, 1, 1],
      selectionBackgroundBase: [0, 0, 0, 1],
      selectionForegroundBase: null,
      searchMatchBackgroundBase: [0, 0, 0, 1],
      searchCurrentMatchBackgroundBase: [0, 0, 0, 1],
      searchMatchTextBase: [1, 1, 1, 1],
      searchCurrentMatchTextBase: [1, 1, 1, 1],
      cursorBase: [1, 1, 1, 1],
      getCanvas: () => currentCanvas as unknown as HTMLCanvasElement,
      setCanvas: (nextCanvas) => {
        currentCanvas = nextCanvas as unknown as FakeCanvas;
      },
      getCurrentDpr: () => 1,
      setCurrentDpr: () => {},
      setCurrentContextType: () => {},
      getActiveState: () => null,
      getInputHandler: () => null,
      setIsFocused: () => {},
      getActiveTheme: () => null,
      setActiveTheme: () => {},
      setDefaultBg: () => {},
      setDefaultFg: () => {},
      setSelectionBackgroundColor: () => {},
      setSelectionForegroundColor: () => {},
      setSearchMatchBackgroundColor: () => {},
      setSearchCurrentMatchBackgroundColor: () => {},
      setSearchMatchTextColor: () => {},
      setSearchCurrentMatchTextColor: () => {},
      setCursorFallback: () => {},
      getWasmReady: () => false,
      getWasm: () => null,
      getWasmHandle: () => 0,
      appendLog: () => {},
      bindCanvasEvents: () => {},
      computeCellMetrics: () => ({ cellW: 8, cellH: 16 }),
      updateGrid: () => {},
      clearKittyRenderCaches: () => {},
      sendKeyInput: () => {},
      clearWebGLShaderStages: () => {},
      destroyWebGLStageTargets: () => {},
      destroyWebGPUStageTargets: () => {},
      setShaderStagesDirty: () => {},
      markNeedsRender: () => {},
      resetLastRenderTime: () => {},
    } as never);

    handlers.replaceCanvas();

    expect(createdCanvases).toHaveLength(1);
    expect(currentCanvas).toBe(createdCanvases[0]);
    expect(host.children).toEqual([createdCanvases[0]]);
  } finally {
    (globalThis as { document?: Document }).document = originalDocument;
    (globalThis as { window?: Window }).window = originalWindow;
  }
});
