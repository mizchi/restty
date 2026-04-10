import { expect, test } from "bun:test";
import {
  createRuntimeAppApi,
  type RuntimeAppApiSharedState,
} from "../src/runtime/create-runtime/runtime-app-api";

test("runtime app api coalesces concurrent init calls into a single in-flight promise", () => {
  const originalCancelAnimationFrame = globalThis.cancelAnimationFrame;
  globalThis.cancelAnimationFrame = (() => 0) as typeof cancelAnimationFrame;
  try {
    const sharedState: RuntimeAppApiSharedState = {
      wasm: null,
      wasmExports: null,
      wasmHandle: 1,
      wasmReady: true,
      activeState: null,
      needsRender: false,
      lastRenderTime: 0,
      currentContextType: null,
      isFocused: false,
      lastKeydownSeq: "",
      lastKeydownSeqAt: 0,
    };

    let ensureFontCalls = 0;
    const never = new Promise<void>(() => {});

    const runtime = createRuntimeAppApi({
      session: {
        getWasm: async () => {
          throw new Error("not reached");
        },
        getWebGPUCore: async () => {
          throw new Error("not reached");
        },
        getFontResourceStore: () => {
          throw new Error("not reached");
        },
        addWasmLogListener: () => undefined,
        removeWasmLogListener: () => undefined,
      },
      ptyTransport: {
        isConnected: () => false,
        connect: () => undefined,
        disconnect: () => undefined,
        sendInput: () => undefined,
        resize: () => undefined,
      } as never,
      inputHandler: {
        encodeKeyEvent: () => "",
        isSynchronizedOutput: () => false,
        setMouseMode: () => undefined,
        getMouseStatus: () => "auto",
      } as never,
      ptyInputRuntime: {
        setPtyStatus: () => undefined,
        updateMouseStatus: () => undefined,
        scheduleSyncOutputReset: () => undefined,
        cancelSyncOutputReset: () => undefined,
        connectPty: () => undefined,
        disconnectPty: () => undefined,
        sendKeyInput: () => undefined,
        sendPasteText: () => undefined,
        sendPastePayloadFromDataTransfer: () => false,
        getCprPosition: () => ({ row: 1, col: 1 }),
      } as never,
      interaction: {
        selectionState: { active: false, dragging: false },
        linkState: { hoverId: 0, hoverUri: "" },
        imeState: { composing: false, preedit: "", selectionStart: 0, selectionEnd: 0 },
        clearSelection: () => undefined,
        updateLinkHover: () => undefined,
      } as never,
      lifecycleThemeSizeRuntime: {
        cancelScheduledSizeUpdate: () => undefined,
        getActiveTheme: () => null,
      },
      cleanupFns: [],
      cleanupCanvasFns: [],
      callbacks: undefined,
      fpsEl: null,
      backendEl: null,
      inputDebugEl: null,
      imeInput: null,
      attachWindowEvents: false,
      isMacPlatform: false,
      textEncoder: new TextEncoder(),
      readState: () => sharedState,
      writeState: (patch) => Object.assign(sharedState, patch),
      appendLog: () => undefined,
      shouldSuppressWasmLog: () => false,
      runBeforeInputHook: (text) => text,
      runBeforeRenderOutputHook: (text) => text,
      getSelectionText: () => "",
      initialPreferredRenderer: "auto",
      CURSOR_BLINK_MS: 600,
      RESIZE_ACTIVE_MS: 180,
      TARGET_RENDER_FPS: 60,
      BACKGROUND_RENDER_FPS: 15,
      KITTY_FLAG_REPORT_EVENTS: 1 << 1,
      resizeState: { lastAt: 0 },
      tickWebGPU: () => false,
      tickWebGL: () => false,
      updateGrid: () => undefined,
      gridState: { cols: 80, rows: 24 },
      getCanvas: () => ({ width: 800, height: 480 }) as HTMLCanvasElement,
      applyTheme: () => undefined,
      ensureFont: async () => {
        ensureFontCalls += 1;
        return never;
      },
      updateSize: () => undefined,
      log: () => undefined,
      replaceCanvas: () => undefined,
      rebuildWebGPUShaderStages: () => undefined,
      rebuildWebGLShaderStages: () => undefined,
      setShaderStagesDirty: () => undefined,
      clearWebGPUShaderStages: () => undefined,
      destroyWebGPUStageTargets: () => undefined,
      clearWebGLShaderStages: () => undefined,
      destroyWebGLStageTargets: () => undefined,
      markSearchDirty: () => undefined,
      handleSearchWasmReset: () => undefined,
    });

    const app = runtime.createPublicApi({
      setFontSize: () => undefined,
      setLigatures: () => undefined,
      setFontHinting: () => undefined,
      setFontHintTarget: () => undefined,
      setFontSources: async () => undefined,
      resetTheme: () => undefined,
      setSearchQuery: () => undefined,
      clearSearch: () => undefined,
      searchNext: () => undefined,
      searchPrevious: () => undefined,
      getSearchState: () => ({
        query: "",
        active: false,
        pending: false,
        complete: false,
        total: 0,
        selectedIndex: -1,
      }),
      dumpAtlasForCodepoint: () => undefined,
      resize: () => undefined,
      focus: () => undefined,
      blur: () => undefined,
      updateSize: () => undefined,
      setShaderStages: () => undefined,
      getShaderStages: () => [],
    });

    const first = app.init();
    const second = app.init();

    expect(first).toBe(second);
    expect(ensureFontCalls).toBe(1);
  } finally {
    globalThis.cancelAnimationFrame = originalCancelAnimationFrame;
  }
});
