import { expect, test } from "bun:test";
import { createLifecycleCanvasHandlers } from "../src/runtime/create-runtime/lifecycle-theme-size-canvas";

class FakeCanvas {
  width: number;
  height: number;
  id = "";
  className = "";
  parentElement: HTMLElement | null = null;
  tabIndex = 0;

  private rect: { width: number; height: number };

  constructor(options: { width: number; height: number; rectWidth: number; rectHeight: number }) {
    this.width = options.width;
    this.height = options.height;
    this.rect = {
      width: options.rectWidth,
      height: options.rectHeight,
    };
  }

  getBoundingClientRect(): DOMRect {
    return {
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: this.rect.width,
      bottom: this.rect.height,
      width: this.rect.width,
      height: this.rect.height,
      toJSON: () => ({}),
    } as DOMRect;
  }

  focus(): void {}

  blur(): void {}

  addEventListener(): void {}

  removeEventListener(): void {}
}

function createDeps(canvas: FakeCanvas) {
  let currentDpr = 1;
  let markNeedsRenderCalls = 0;
  let updateGridCalls = 0;
  let resetLastRenderTimeCalls = 0;

  const handlers = createLifecycleCanvasHandlers({
    attachCanvasEvents: false,
    attachWindowEvents: false,
    autoResize: false,
    imeInput: null,
    dprEl: null,
    sizeEl: null,
    callbacks: undefined,
    cleanupFns: [],
    cleanupCanvasFns: [],
    gridState: {
      cols: 80,
      rows: 24,
      cellW: 10,
      cellH: 20,
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
    getCanvas: () => canvas as unknown as HTMLCanvasElement,
    setCanvas: () => {},
    getCurrentDpr: () => currentDpr,
    setCurrentDpr: (value) => {
      currentDpr = value;
    },
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
    getWasmReady: () => true,
    getWasm: () => null,
    getWasmHandle: () => 1,
    appendLog: () => {},
    bindCanvasEvents: () => {},
    computeCellMetrics: () => ({ cellW: 10, cellH: 20 }),
    updateGrid: () => {
      updateGridCalls += 1;
    },
    clearKittyRenderCaches: () => {},
    sendKeyInput: () => {},
    clearWebGLShaderStages: () => {},
    destroyWebGLStageTargets: () => {},
    destroyWebGPUStageTargets: () => {},
    setShaderStagesDirty: () => {},
    markNeedsRender: () => {
      markNeedsRenderCalls += 1;
    },
    resetLastRenderTime: () => {
      resetLastRenderTimeCalls += 1;
    },
  } as never);

  return {
    handlers,
    readCounts: () => ({
      markNeedsRenderCalls,
      updateGridCalls,
      resetLastRenderTimeCalls,
    }),
    getCurrentDpr: () => currentDpr,
  };
}

test("updateSize keeps the current canvas buffer when the pane is hidden", () => {
  const originalWindow = (globalThis as { window?: Window }).window;
  (globalThis as { window?: Window }).window = {
    devicePixelRatio: 2,
  } as Window;

  try {
    const canvas = new FakeCanvas({
      width: 640,
      height: 320,
      rectWidth: 0,
      rectHeight: 0,
    });
    const deps = createDeps(canvas);

    deps.handlers.updateSize();

    expect(canvas.width).toBe(640);
    expect(canvas.height).toBe(320);
    expect(deps.readCounts()).toEqual({
      markNeedsRenderCalls: 0,
      updateGridCalls: 0,
      resetLastRenderTimeCalls: 0,
    });
    expect(deps.getCurrentDpr()).toBe(1);
  } finally {
    (globalThis as { window?: Window }).window = originalWindow;
  }
});

test("updateSize resizes the canvas when the pane has visible bounds", () => {
  const originalWindow = (globalThis as { window?: Window }).window;
  (globalThis as { window?: Window }).window = {
    devicePixelRatio: 2,
  } as Window;

  try {
    const canvas = new FakeCanvas({
      width: 640,
      height: 320,
      rectWidth: 400,
      rectHeight: 200,
    });
    const deps = createDeps(canvas);

    deps.handlers.updateSize();

    expect(canvas.width).toBe(800);
    expect(canvas.height).toBe(400);
    expect(deps.readCounts()).toEqual({
      markNeedsRenderCalls: 1,
      updateGridCalls: 1,
      resetLastRenderTimeCalls: 1,
    });
    expect(deps.getCurrentDpr()).toBe(2);
  } finally {
    (globalThis as { window?: Window }).window = originalWindow;
  }
});
