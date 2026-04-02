import { expect, test } from "bun:test";
import type { InputHandler } from "../src/input";
import { bindImeEvents } from "../src/runtime/create-runtime/interaction-runtime/bind-ime-events";

type Listener = EventListenerOrEventListenerObject;

class FakeTextArea {
  value = "";
  selectionStart = 0;
  selectionEnd = 0;

  private listeners = new Map<string, Set<Listener>>();

  addEventListener(type: string, listener: Listener | null): void {
    if (!listener) return;
    let set = this.listeners.get(type);
    if (!set) {
      set = new Set<Listener>();
      this.listeners.set(type, set);
    }
    set.add(listener);
  }

  removeEventListener(type: string, listener: Listener | null): void {
    if (!listener) return;
    this.listeners.get(type)?.delete(listener);
  }

  emit(type: string, event: Event): void {
    const set = this.listeners.get(type);
    if (!set) return;
    for (const listener of set) {
      if (typeof listener === "function") {
        listener(event);
      } else {
        listener.handleEvent(event);
      }
    }
  }
}

function createInputHandlerStub(): InputHandler {
  return {
    sequences: {
      enter: "\r",
      backspace: "\x7f",
      delete: "\x1b[3~",
      tab: "\t",
      shiftTab: "\x1b[Z",
      escape: "\x1b",
    },
    encodeKeyEvent: () => "",
    encodeBeforeInput: (event: InputEvent) =>
      event.inputType === "deleteContentBackward" ? "\x7f" : "",
    mapKeyForPty: (seq: string) => (seq === "\x1b[127u" ? "\x7f" : seq),
    filterOutput: (output: string) => output,
    setReplySink: () => {},
    setCursorProvider: () => {},
    setPositionToCell: () => {},
    setPositionToPixel: () => {},
    setWindowOpHandler: () => {},
    setMouseMode: () => {},
    getMouseStatus: () => ({
      mode: "off",
      active: false,
      detail: "sgr",
      enabled: false,
    }),
    isMouseActive: () => false,
    isBracketedPaste: () => false,
    isFocusReporting: () => false,
    isAltScreen: () => false,
    isSynchronizedOutput: () => false,
    isPromptClickEventsEnabled: () => false,
    encodePromptClickEvent: (_cell) => "",
    sendMouseEvent: (_kind, _event) => false,
  };
}

test("bindImeEvents dedupes beforeinput erase against kitty keydown sequence", () => {
  const sent: string[] = [];
  const imeInput = new FakeTextArea();
  let prevented = false;

  bindImeEvents({
    bindOptions: {
      inputHandler: createInputHandlerStub(),
      sendKeyInput: (text) => {
        sent.push(text);
      },
      sendPasteText: () => {},
      sendPastePayloadFromDataTransfer: () => false,
      getLastKeydownSeq: () => "\x1b[127u",
      getLastKeydownSeqAt: () => performance.now(),
      keydownBeforeinputDedupeMs: 80,
      openLink: () => {},
    },
    imeInput: imeInput as unknown as HTMLTextAreaElement,
    imeState: {
      composing: false,
      preedit: "",
      selectionStart: 0,
      selectionEnd: 0,
    },
    cleanupCanvasFns: [],
    getWasmReady: () => true,
    getWasmHandle: () => 1,
    setPreedit: () => {},
    syncImeSelection: () => {},
  });

  imeInput.emit(
    "beforeinput",
    {
      inputType: "deleteContentBackward",
      data: null,
      dataTransfer: null,
      preventDefault: () => {
        prevented = true;
      },
    } as InputEvent,
  );

  expect(prevented).toBe(true);
  expect(sent).toEqual([]);
});

test("bindImeEvents forwards beforeinput erase when keydown dedupe window has elapsed", () => {
  const sent: string[] = [];
  const imeInput = new FakeTextArea();

  bindImeEvents({
    bindOptions: {
      inputHandler: createInputHandlerStub(),
      sendKeyInput: (text) => {
        sent.push(text);
      },
      sendPasteText: () => {},
      sendPastePayloadFromDataTransfer: () => false,
      getLastKeydownSeq: () => "\x1b[127u",
      getLastKeydownSeqAt: () => performance.now() - 1000,
      keydownBeforeinputDedupeMs: 80,
      openLink: () => {},
    },
    imeInput: imeInput as unknown as HTMLTextAreaElement,
    imeState: {
      composing: false,
      preedit: "",
      selectionStart: 0,
      selectionEnd: 0,
    },
    cleanupCanvasFns: [],
    getWasmReady: () => true,
    getWasmHandle: () => 1,
    setPreedit: () => {},
    syncImeSelection: () => {},
  });

  imeInput.emit(
    "beforeinput",
    {
      inputType: "deleteContentBackward",
      data: null,
      dataTransfer: null,
      preventDefault: () => {},
    } as InputEvent,
  );

  expect(sent).toEqual(["\x7f"]);
});

test("bindImeEvents falls back to imeInput value on compositionend", () => {
  const sent: string[] = [];
  const imeInput = new FakeTextArea();
  imeInput.value = "に";

  bindImeEvents({
    bindOptions: {
      inputHandler: createInputHandlerStub(),
      sendKeyInput: (text) => {
        sent.push(text);
      },
      sendPasteText: () => {},
      sendPastePayloadFromDataTransfer: () => false,
      getLastKeydownSeq: () => "",
      getLastKeydownSeqAt: () => 0,
      keydownBeforeinputDedupeMs: 80,
      openLink: () => {},
    },
    imeInput: imeInput as unknown as HTMLTextAreaElement,
    imeState: {
      composing: true,
      preedit: "",
      selectionStart: 0,
      selectionEnd: 0,
    },
    cleanupCanvasFns: [],
    getWasmReady: () => true,
    getWasmHandle: () => 1,
    setPreedit: () => {},
    syncImeSelection: () => {},
  });

  imeInput.emit(
    "compositionend",
    {
      data: "",
    } as CompositionEvent,
  );

  expect(sent).toEqual(["に"]);
  expect(imeInput.value).toBe("");
});

test("bindImeEvents does not suppress follow-up input when compositionend fires before wasm is ready", () => {
  const sent: string[] = [];
  const imeInput = new FakeTextArea();
  let wasmReady = false;
  imeInput.value = "你";

  bindImeEvents({
    bindOptions: {
      inputHandler: createInputHandlerStub(),
      sendKeyInput: (text) => {
        sent.push(text);
      },
      sendPasteText: () => {},
      sendPastePayloadFromDataTransfer: () => false,
      getLastKeydownSeq: () => "",
      getLastKeydownSeqAt: () => 0,
      keydownBeforeinputDedupeMs: 80,
      openLink: () => {},
    },
    imeInput: imeInput as unknown as HTMLTextAreaElement,
    imeState: {
      composing: true,
      preedit: "",
      selectionStart: 0,
      selectionEnd: 0,
    },
    cleanupCanvasFns: [],
    getWasmReady: () => wasmReady,
    getWasmHandle: () => (wasmReady ? 1 : 0),
    setPreedit: () => {},
    syncImeSelection: () => {},
  });

  imeInput.emit(
    "compositionend",
    {
      data: "你",
    } as CompositionEvent,
  );

  expect(sent).toEqual([]);

  wasmReady = true;
  imeInput.value = "你";
  imeInput.emit(
    "input",
    {
      data: "你",
    } as InputEvent,
  );

  expect(sent).toEqual(["你"]);
  expect(imeInput.value).toBe("");
});
