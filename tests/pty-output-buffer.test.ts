import { expect, test } from "bun:test";
import { createPtyOutputBufferController } from "../src/runtime/pty-output-buffer";

test("flushes buffered PTY output once per animation frame", () => {
  const originalRaf = globalThis.requestAnimationFrame;
  const originalCancelRaf = globalThis.cancelAnimationFrame;
  const originalSetTimeout = globalThis.setTimeout;
  const originalClearTimeout = globalThis.clearTimeout;
  const frames: FrameRequestCallback[] = [];
  const timers = new Map<number, () => void>();
  let nextTimerId = 1;

  globalThis.requestAnimationFrame = ((callback: FrameRequestCallback) => {
    frames.push(callback);
    return frames.length;
  }) as typeof requestAnimationFrame;
  globalThis.cancelAnimationFrame = (() => {}) as typeof cancelAnimationFrame;
  globalThis.setTimeout = (((callback: () => void) => {
    const id = nextTimerId++;
    timers.set(id, callback);
    return id as unknown as Timer;
  }) as unknown) as typeof setTimeout;
  globalThis.clearTimeout = (((id: number) => {
    timers.delete(id);
  }) as unknown) as typeof clearTimeout;

  try {
    const flushed: string[] = [];
    const controller = createPtyOutputBufferController({
      idleMs: 10,
      maxMs: 40,
      onFlush(text) {
        flushed.push(text);
      },
    });

    controller.queue("hel");
    controller.queue("lo");

    expect(flushed).toEqual([]);
    expect(frames).toHaveLength(1);

    frames[0]?.(0);

    expect(flushed).toEqual(["hello"]);
  } finally {
    globalThis.requestAnimationFrame = originalRaf;
    globalThis.cancelAnimationFrame = originalCancelRaf;
    globalThis.setTimeout = originalSetTimeout;
    globalThis.clearTimeout = originalClearTimeout;
  }
});

test("falls back to max timer when animation frames do not advance", () => {
  const originalRaf = globalThis.requestAnimationFrame;
  const originalCancelRaf = globalThis.cancelAnimationFrame;
  const originalSetTimeout = globalThis.setTimeout;
  const originalClearTimeout = globalThis.clearTimeout;
  const frames: FrameRequestCallback[] = [];
  const timers = new Map<number, () => void>();
  let nextTimerId = 1;

  globalThis.requestAnimationFrame = ((callback: FrameRequestCallback) => {
    frames.push(callback);
    return frames.length;
  }) as typeof requestAnimationFrame;
  globalThis.cancelAnimationFrame = (() => {}) as typeof cancelAnimationFrame;
  globalThis.setTimeout = (((callback: () => void) => {
    const id = nextTimerId++;
    timers.set(id, callback);
    return id as unknown as Timer;
  }) as unknown) as typeof setTimeout;
  globalThis.clearTimeout = (((id: number) => {
    timers.delete(id);
  }) as unknown) as typeof clearTimeout;

  try {
    const flushed: string[] = [];
    const controller = createPtyOutputBufferController({
      idleMs: 10,
      maxMs: 40,
      onFlush(text) {
        flushed.push(text);
      },
    });

    controller.queue("wor");
    controller.queue("ld");

    expect(flushed).toEqual([]);
    expect(frames).toHaveLength(1);
    expect(timers.size).toBe(1);

    const fallback = Array.from(timers.values())[0];
    fallback?.();

    expect(flushed).toEqual(["world"]);
  } finally {
    globalThis.requestAnimationFrame = originalRaf;
    globalThis.cancelAnimationFrame = originalCancelRaf;
    globalThis.setTimeout = originalSetTimeout;
    globalThis.clearTimeout = originalClearTimeout;
  }
});
