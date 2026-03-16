import type { ResttySearchState } from "../runtime/types";

type SearchUiPaneApp = {
  setSearchQuery: (query: string) => void;
  clearSearch: () => void;
  searchNext: () => void;
  searchPrevious: () => void;
  getSearchState: () => ResttySearchState;
};

export type ResttyPaneSearchUiPane = {
  id: number;
  container: HTMLDivElement;
  focusTarget?: HTMLElement | null;
  app: SearchUiPaneApp;
};

export type ResttyPaneSearchUiStyleOptions = {
  offsetTopPx?: number;
  offsetRightPx?: number;
  minWidthPx?: number;
  maxWidthPx?: number;
  zIndex?: number;
  borderRadiusPx?: number;
  backdropBlurPx?: number;
  panelBackground?: string;
  panelBorderColor?: string;
  panelTextColor?: string;
  panelShadow?: string;
  inputBackground?: string;
  inputTextColor?: string;
  inputPlaceholderColor?: string;
  buttonBackground?: string;
  buttonTextColor?: string;
  buttonHoverBackground?: string;
  buttonDisabledOpacity?: number;
  statusTextColor?: string;
  statusActiveTextColor?: string;
  statusCompleteTextColor?: string;
};

export type ResttyPaneSearchUiShortcutOptions = {
  enabled?: boolean;
  canOpen?: (event: KeyboardEvent, paneId: number) => boolean;
};

export type ResttyPaneSearchUiOptions = {
  enabled?: boolean;
  placeholder?: string;
  previousButtonText?: string;
  nextButtonText?: string;
  clearButtonText?: string;
  closeButtonText?: string;
  statusFormatter?: (state: ResttySearchState) => string;
  shortcut?: boolean | ResttyPaneSearchUiShortcutOptions;
  styles?: ResttyPaneSearchUiStyleOptions;
};

export type ResttyPaneSearchUiOpenOptions = {
  selectAll?: boolean;
};

export type ResttyPaneSearchUiCloseOptions = {
  restoreFocus?: boolean;
};

export type PaneSearchUiController = {
  registerPane: (pane: ResttyPaneSearchUiPane) => void;
  unregisterPane: (paneId: number) => void;
  handleSearchState: (paneId: number, state: ResttySearchState) => void;
  handleActivePaneChange: (paneId: number | null) => void;
  open: (paneId: number, options?: ResttyPaneSearchUiOpenOptions) => void;
  close: (paneId: number, options?: ResttyPaneSearchUiCloseOptions) => void;
  toggle: (
    paneId: number,
    options?: ResttyPaneSearchUiOpenOptions & ResttyPaneSearchUiCloseOptions,
  ) => void;
  isOpen: (paneId: number) => boolean;
  getStyleOptions: () => Readonly<Required<ResttyPaneSearchUiStyleOptions>>;
  setStyleOptions: (options: ResttyPaneSearchUiStyleOptions) => void;
  destroy: () => void;
};

type PaneSearchUiState = {
  pane: ResttyPaneSearchUiPane;
  root: HTMLDivElement;
  input: HTMLInputElement;
  prevButton: HTMLButtonElement;
  nextButton: HTMLButtonElement;
  clearButton: HTMLButtonElement;
  closeButton: HTMLButtonElement;
  status: HTMLDivElement;
  cleanupFns: Array<() => void>;
  state: ResttySearchState;
  open: boolean;
};

const ROOT_CLASS = "restty-search-ui-root";
const STYLE_MARKER = "data-restty-pane-search-ui-styles";
const STYLE_TEXT = `
.${ROOT_CLASS} .restty-pane-search {
  position: absolute;
  top: var(--restty-search-ui-top, 10px);
  right: var(--restty-search-ui-right, 10px);
  z-index: var(--restty-search-ui-z-index, 8);
  width: min(var(--restty-search-ui-max-width, 332px), calc(100% - 20px));
  min-width: var(--restty-search-ui-min-width, 232px);
  display: none;
  align-items: center;
  padding: 6px;
  border: 1px solid var(--restty-search-ui-border, #2a2a2a);
  border-radius: var(--restty-search-ui-radius, 8px);
  background: var(--restty-search-ui-background, #161616);
  color: var(--restty-search-ui-text, #d6d6d6);
  backdrop-filter: blur(var(--restty-search-ui-blur, 8px));
  box-shadow: var(--restty-search-ui-shadow, 0 14px 40px rgba(0, 0, 0, 0.45));
}

.${ROOT_CLASS} .restty-pane-search[data-open="1"] {
  display: flex;
}

.${ROOT_CLASS} .restty-pane-search-row {
  display: grid;
  width: 100%;
  grid-template-columns: minmax(0, 1fr) auto auto auto auto auto;
  gap: 4px;
  align-items: center;
}

.${ROOT_CLASS} .restty-pane-search-input,
.${ROOT_CLASS} .restty-pane-search-button {
  min-width: 0;
  height: 28px;
  border: 1px solid transparent;
  border-radius: 6px;
  transition:
    background-color 120ms ease-out,
    border-color 120ms ease-out,
    color 120ms ease-out,
    transform 120ms ease-out;
}

.${ROOT_CLASS} .restty-pane-search-input {
  padding: 0 10px;
  background: var(--restty-search-ui-input-background, #252525);
  color: var(--restty-search-ui-input-text, #d6d6d6);
  outline: none;
  font-size: 11px;
  letter-spacing: 0.01em;
}

.${ROOT_CLASS} .restty-pane-search-input::placeholder {
  color: var(--restty-search-ui-input-placeholder, #868686);
}

.${ROOT_CLASS} .restty-pane-search-input:focus {
  border-color: #3a3a3a;
}

.${ROOT_CLASS} .restty-pane-search-button {
  padding: 0 8px;
  background: var(--restty-search-ui-button-background, transparent);
  color: var(--restty-search-ui-button-text, #d6d6d6);
  cursor: pointer;
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.01em;
}

.${ROOT_CLASS} .restty-pane-search-button:hover:not(:disabled) {
  background: var(--restty-search-ui-button-hover, #252525);
}

.${ROOT_CLASS} .restty-pane-search-button:disabled {
  cursor: default;
  opacity: var(--restty-search-ui-button-disabled-opacity, 0.42);
}

.${ROOT_CLASS} .restty-pane-search-button:focus-visible {
  outline: none;
  border-color: #3a3a3a;
}

.${ROOT_CLASS} .restty-pane-search-status {
  min-width: 0;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 8px;
  border-radius: 6px;
  background: #252525;
  border: 1px solid #2a2a2a;
  font-size: 10px;
  line-height: 1;
  color: var(--restty-search-ui-status, #868686);
  letter-spacing: 0.01em;
  white-space: nowrap;
}

.${ROOT_CLASS} .restty-pane-search-status[data-empty="1"] {
  display: none;
}

.${ROOT_CLASS} .restty-pane-search-status[data-active="1"] {
  color: var(--restty-search-ui-status-active, #d6d6d6);
}

.${ROOT_CLASS} .restty-pane-search-status[data-complete="1"] {
  color: var(--restty-search-ui-status-complete, #868686);
}
`;

const DEFAULT_STYLE_OPTIONS: Required<ResttyPaneSearchUiStyleOptions> = {
  offsetTopPx: 10,
  offsetRightPx: 10,
  minWidthPx: 232,
  maxWidthPx: 332,
  zIndex: 8,
  borderRadiusPx: 8,
  backdropBlurPx: 8,
  panelBackground: "#161616",
  panelBorderColor: "#2a2a2a",
  panelTextColor: "#d6d6d6",
  panelShadow: "0 14px 40px rgba(0, 0, 0, 0.45)",
  inputBackground: "#252525",
  inputTextColor: "#d6d6d6",
  inputPlaceholderColor: "#868686",
  buttonBackground: "transparent",
  buttonTextColor: "#d6d6d6",
  buttonHoverBackground: "#252525",
  buttonDisabledOpacity: 0.42,
  statusTextColor: "#868686",
  statusActiveTextColor: "#d6d6d6",
  statusCompleteTextColor: "#868686",
};

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeColor(value: string | undefined, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed ? trimmed : fallback;
}

function normalizeStyleOptions(
  options: ResttyPaneSearchUiStyleOptions | undefined,
): Required<ResttyPaneSearchUiStyleOptions> {
  return {
    offsetTopPx: Number.isFinite(options?.offsetTopPx)
      ? clampNumber(Number(options?.offsetTopPx), 0, 256)
      : DEFAULT_STYLE_OPTIONS.offsetTopPx,
    offsetRightPx: Number.isFinite(options?.offsetRightPx)
      ? clampNumber(Number(options?.offsetRightPx), 0, 256)
      : DEFAULT_STYLE_OPTIONS.offsetRightPx,
    minWidthPx: Number.isFinite(options?.minWidthPx)
      ? clampNumber(Number(options?.minWidthPx), 160, 800)
      : DEFAULT_STYLE_OPTIONS.minWidthPx,
    maxWidthPx: Number.isFinite(options?.maxWidthPx)
      ? clampNumber(Number(options?.maxWidthPx), 180, 960)
      : DEFAULT_STYLE_OPTIONS.maxWidthPx,
    zIndex: Number.isFinite(options?.zIndex)
      ? clampNumber(Number(options?.zIndex), 1, 9999)
      : DEFAULT_STYLE_OPTIONS.zIndex,
    borderRadiusPx: Number.isFinite(options?.borderRadiusPx)
      ? clampNumber(Number(options?.borderRadiusPx), 0, 48)
      : DEFAULT_STYLE_OPTIONS.borderRadiusPx,
    backdropBlurPx: Number.isFinite(options?.backdropBlurPx)
      ? clampNumber(Number(options?.backdropBlurPx), 0, 48)
      : DEFAULT_STYLE_OPTIONS.backdropBlurPx,
    panelBackground: normalizeColor(
      options?.panelBackground,
      DEFAULT_STYLE_OPTIONS.panelBackground,
    ),
    panelBorderColor: normalizeColor(
      options?.panelBorderColor,
      DEFAULT_STYLE_OPTIONS.panelBorderColor,
    ),
    panelTextColor: normalizeColor(options?.panelTextColor, DEFAULT_STYLE_OPTIONS.panelTextColor),
    panelShadow: normalizeColor(options?.panelShadow, DEFAULT_STYLE_OPTIONS.panelShadow),
    inputBackground: normalizeColor(
      options?.inputBackground,
      DEFAULT_STYLE_OPTIONS.inputBackground,
    ),
    inputTextColor: normalizeColor(options?.inputTextColor, DEFAULT_STYLE_OPTIONS.inputTextColor),
    inputPlaceholderColor: normalizeColor(
      options?.inputPlaceholderColor,
      DEFAULT_STYLE_OPTIONS.inputPlaceholderColor,
    ),
    buttonBackground: normalizeColor(
      options?.buttonBackground,
      DEFAULT_STYLE_OPTIONS.buttonBackground,
    ),
    buttonTextColor: normalizeColor(
      options?.buttonTextColor,
      DEFAULT_STYLE_OPTIONS.buttonTextColor,
    ),
    buttonHoverBackground: normalizeColor(
      options?.buttonHoverBackground,
      DEFAULT_STYLE_OPTIONS.buttonHoverBackground,
    ),
    buttonDisabledOpacity: Number.isFinite(options?.buttonDisabledOpacity)
      ? clampNumber(Number(options?.buttonDisabledOpacity), 0, 1)
      : DEFAULT_STYLE_OPTIONS.buttonDisabledOpacity,
    statusTextColor: normalizeColor(
      options?.statusTextColor,
      DEFAULT_STYLE_OPTIONS.statusTextColor,
    ),
    statusActiveTextColor: normalizeColor(
      options?.statusActiveTextColor,
      DEFAULT_STYLE_OPTIONS.statusActiveTextColor,
    ),
    statusCompleteTextColor: normalizeColor(
      options?.statusCompleteTextColor,
      DEFAULT_STYLE_OPTIONS.statusCompleteTextColor,
    ),
  };
}

function ensurePaneSearchUiStyles(doc: Document): void {
  if (doc.querySelector(`style[${STYLE_MARKER}="1"]`)) return;
  const style = doc.createElement("style");
  style.setAttribute(STYLE_MARKER, "1");
  style.textContent = STYLE_TEXT;
  doc.head.appendChild(style);
}

function applySearchUiStyleOptions(
  root: HTMLElement,
  options: Readonly<Required<ResttyPaneSearchUiStyleOptions>>,
): void {
  root.classList.add(ROOT_CLASS);
  root.style.setProperty("--restty-search-ui-top", `${options.offsetTopPx}px`);
  root.style.setProperty("--restty-search-ui-right", `${options.offsetRightPx}px`);
  root.style.setProperty("--restty-search-ui-min-width", `${options.minWidthPx}px`);
  root.style.setProperty("--restty-search-ui-max-width", `${options.maxWidthPx}px`);
  root.style.setProperty("--restty-search-ui-z-index", `${options.zIndex}`);
  root.style.setProperty("--restty-search-ui-radius", `${options.borderRadiusPx}px`);
  root.style.setProperty("--restty-search-ui-blur", `${options.backdropBlurPx}px`);
  root.style.setProperty("--restty-search-ui-background", options.panelBackground);
  root.style.setProperty("--restty-search-ui-border", options.panelBorderColor);
  root.style.setProperty("--restty-search-ui-text", options.panelTextColor);
  root.style.setProperty("--restty-search-ui-shadow", options.panelShadow);
  root.style.setProperty("--restty-search-ui-input-background", options.inputBackground);
  root.style.setProperty("--restty-search-ui-input-text", options.inputTextColor);
  root.style.setProperty("--restty-search-ui-input-placeholder", options.inputPlaceholderColor);
  root.style.setProperty("--restty-search-ui-button-background", options.buttonBackground);
  root.style.setProperty("--restty-search-ui-button-text", options.buttonTextColor);
  root.style.setProperty("--restty-search-ui-button-hover", options.buttonHoverBackground);
  root.style.setProperty(
    "--restty-search-ui-button-disabled-opacity",
    options.buttonDisabledOpacity.toFixed(3),
  );
  root.style.setProperty("--restty-search-ui-status", options.statusTextColor);
  root.style.setProperty("--restty-search-ui-status-active", options.statusActiveTextColor);
  root.style.setProperty("--restty-search-ui-status-complete", options.statusCompleteTextColor);
}

function clearSearchUiStyleOptions(root: HTMLElement): void {
  root.classList.remove(ROOT_CLASS);
  root.style.removeProperty("--restty-search-ui-top");
  root.style.removeProperty("--restty-search-ui-right");
  root.style.removeProperty("--restty-search-ui-min-width");
  root.style.removeProperty("--restty-search-ui-max-width");
  root.style.removeProperty("--restty-search-ui-z-index");
  root.style.removeProperty("--restty-search-ui-radius");
  root.style.removeProperty("--restty-search-ui-blur");
  root.style.removeProperty("--restty-search-ui-background");
  root.style.removeProperty("--restty-search-ui-border");
  root.style.removeProperty("--restty-search-ui-text");
  root.style.removeProperty("--restty-search-ui-shadow");
  root.style.removeProperty("--restty-search-ui-input-background");
  root.style.removeProperty("--restty-search-ui-input-text");
  root.style.removeProperty("--restty-search-ui-input-placeholder");
  root.style.removeProperty("--restty-search-ui-button-background");
  root.style.removeProperty("--restty-search-ui-button-text");
  root.style.removeProperty("--restty-search-ui-button-hover");
  root.style.removeProperty("--restty-search-ui-button-disabled-opacity");
  root.style.removeProperty("--restty-search-ui-status");
  root.style.removeProperty("--restty-search-ui-status-active");
  root.style.removeProperty("--restty-search-ui-status-complete");
}

function defaultStatusFormatter(state: ResttySearchState): string {
  if (!state.query) return "";
  if (state.pending) return "…";
  if (state.total <= 0) return "0";
  if (state.selectedIndex !== null) {
    return `${state.selectedIndex + 1}/${state.total}`;
  }
  return `${state.total}`;
}

function isNodeWithinRoot(root: HTMLElement, target: EventTarget | null): boolean {
  return target instanceof Node && root.contains(target);
}

export function createPaneSearchUiController(options: {
  root: HTMLElement;
  enabled?: boolean;
  placeholder?: string;
  previousButtonText?: string;
  nextButtonText?: string;
  clearButtonText?: string;
  closeButtonText?: string;
  statusFormatter?: (state: ResttySearchState) => string;
  shortcut?: boolean | ResttyPaneSearchUiShortcutOptions;
  styles?: ResttyPaneSearchUiStyleOptions;
  getPaneById: (paneId: number) => ResttyPaneSearchUiPane | null;
  getActivePane: () => ResttyPaneSearchUiPane | null;
  getFocusedPane: () => ResttyPaneSearchUiPane | null;
}): PaneSearchUiController {
  const enabled = options.enabled ?? true;
  const paneStates = new Map<number, PaneSearchUiState>();
  const ownerDoc = options.root.ownerDocument ?? document;
  const ownerWin = ownerDoc.defaultView ?? window;
  let styleOptions = normalizeStyleOptions(options.styles);

  const shortcutOptions: ResttyPaneSearchUiShortcutOptions =
    typeof options.shortcut === "object"
      ? options.shortcut
      : { enabled: options.shortcut !== false };
  const statusFormatter = options.statusFormatter ?? defaultStatusFormatter;
  const placeholder = options.placeholder ?? "Find in scrollback";
  const previousButtonText = options.previousButtonText ?? "↑";
  const nextButtonText = options.nextButtonText ?? "↓";
  const clearButtonText = options.clearButtonText ?? "Clear";
  const closeButtonText = options.closeButtonText ?? "×";

  if (enabled) {
    ensurePaneSearchUiStyles(ownerDoc);
    applySearchUiStyleOptions(options.root, styleOptions);
  }

  function getOpenPaneId(): number | null {
    for (const [paneId, state] of paneStates) {
      if (state.open) return paneId;
    }
    return null;
  }

  function syncPaneUi(paneState: PaneSearchUiState): void {
    const { input, prevButton, nextButton, clearButton, root, status, state } = paneState;
    if (ownerDoc.activeElement !== input) {
      input.value = state.query;
    }
    const hasMatches = state.active && state.total > 0;
    prevButton.disabled = !hasMatches;
    nextButton.disabled = !hasMatches;
    clearButton.disabled = !state.query;
    root.dataset.open = paneState.open ? "1" : "0";
    status.textContent = statusFormatter(state);
    status.dataset.active = state.active ? "1" : "0";
    status.dataset.complete = state.complete ? "1" : "0";
    status.dataset.empty = status.textContent ? "0" : "1";
  }

  function restoreFocus(paneState: PaneSearchUiState | undefined): void {
    const target = paneState?.pane.focusTarget ?? paneState?.pane.container ?? null;
    if (target instanceof HTMLElement) {
      target.focus({ preventScroll: true });
    }
  }

  function closeAllExcept(paneId: number | null): void {
    for (const [id, paneState] of paneStates) {
      if (id === paneId || !paneState.open) continue;
      paneState.open = false;
      syncPaneUi(paneState);
    }
  }

  function focusSearchInput(paneState: PaneSearchUiState, selectAll = false): void {
    paneState.input.focus({ preventScroll: true });
    if (selectAll) paneState.input.select();
  }

  function open(paneId: number, config: ResttyPaneSearchUiOpenOptions = {}): void {
    if (!enabled) return;
    const paneState = paneStates.get(paneId);
    if (!paneState) return;
    closeAllExcept(paneId);
    paneState.open = true;
    paneState.state = { ...paneState.pane.app.getSearchState() };
    syncPaneUi(paneState);
    focusSearchInput(paneState, config.selectAll ?? true);
  }

  function close(paneId: number, config: ResttyPaneSearchUiCloseOptions = {}): void {
    const paneState = paneStates.get(paneId);
    if (!paneState || !paneState.open) return;
    paneState.open = false;
    syncPaneUi(paneState);
    if (config.restoreFocus !== false) {
      restoreFocus(paneState);
    }
  }

  function toggle(
    paneId: number,
    config: ResttyPaneSearchUiOpenOptions & ResttyPaneSearchUiCloseOptions = {},
  ): void {
    if (paneStates.get(paneId)?.open) {
      close(paneId, config);
      return;
    }
    open(paneId, config);
  }

  function registerPane(pane: ResttyPaneSearchUiPane): void {
    if (!enabled) return;
    const root = ownerDoc.createElement("div");
    root.className = "restty-pane-search";
    root.dataset.open = "0";
    root.setAttribute("role", "search");
    root.setAttribute("aria-label", "Search terminal scrollback");

    const row = ownerDoc.createElement("div");
    row.className = "restty-pane-search-row";

    const input = ownerDoc.createElement("input");
    input.className = "restty-pane-search-input";
    input.type = "text";
    input.placeholder = placeholder;
    input.spellcheck = false;
    input.autocapitalize = "off";
    input.autocomplete = "off";
    input.autocorrect = "off";

    const prevButton = ownerDoc.createElement("button");
    prevButton.className = "restty-pane-search-button";
    prevButton.type = "button";
    prevButton.textContent = previousButtonText;
    prevButton.title = "Match above";

    const nextButton = ownerDoc.createElement("button");
    nextButton.className = "restty-pane-search-button";
    nextButton.type = "button";
    nextButton.textContent = nextButtonText;
    nextButton.title = "Match below";

    const clearButton = ownerDoc.createElement("button");
    clearButton.className = "restty-pane-search-button";
    clearButton.type = "button";
    clearButton.textContent = clearButtonText;

    const closeButton = ownerDoc.createElement("button");
    closeButton.className = "restty-pane-search-button";
    closeButton.type = "button";
    closeButton.textContent = closeButtonText;
    closeButton.title = "Close search";
    closeButton.setAttribute("aria-label", "Close search");

    const status = ownerDoc.createElement("div");
    status.className = "restty-pane-search-status";

    row.append(input, status, prevButton, nextButton, clearButton, closeButton);

    root.append(row);
    if (!pane.container.style.position) {
      pane.container.style.position = "relative";
    }
    pane.container.appendChild(root);

    const paneState: PaneSearchUiState = {
      pane,
      root,
      input,
      prevButton,
      nextButton,
      clearButton,
      closeButton,
      status,
      cleanupFns: [],
      state: { ...pane.app.getSearchState() },
      open: false,
    };

    const onInput = () => {
      pane.app.setSearchQuery(input.value);
    };
    input.addEventListener("input", onInput);
    paneState.cleanupFns.push(() => {
      input.removeEventListener("input", onInput);
    });

    const onInputKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Enter") {
        event.preventDefault();
        if (event.shiftKey) {
          pane.app.searchNext();
        } else {
          pane.app.searchPrevious();
        }
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        close(pane.id);
      }
    };
    input.addEventListener("keydown", onInputKeyDown);
    paneState.cleanupFns.push(() => {
      input.removeEventListener("keydown", onInputKeyDown);
    });

    const onPrev = () => {
      pane.app.searchNext();
      focusSearchInput(paneState);
    };
    prevButton.addEventListener("click", onPrev);
    paneState.cleanupFns.push(() => {
      prevButton.removeEventListener("click", onPrev);
    });

    const onNext = () => {
      pane.app.searchPrevious();
      focusSearchInput(paneState);
    };
    nextButton.addEventListener("click", onNext);
    paneState.cleanupFns.push(() => {
      nextButton.removeEventListener("click", onNext);
    });

    const onClear = () => {
      pane.app.clearSearch();
      paneState.state = { ...pane.app.getSearchState() };
      syncPaneUi(paneState);
      focusSearchInput(paneState);
    };
    clearButton.addEventListener("click", onClear);
    paneState.cleanupFns.push(() => {
      clearButton.removeEventListener("click", onClear);
    });

    const onClose = () => {
      close(pane.id);
    };
    closeButton.addEventListener("click", onClose);
    paneState.cleanupFns.push(() => {
      closeButton.removeEventListener("click", onClose);
    });

    paneStates.set(pane.id, paneState);
    syncPaneUi(paneState);
  }

  function unregisterPane(paneId: number): void {
    const paneState = paneStates.get(paneId);
    if (!paneState) return;
    for (const cleanup of paneState.cleanupFns) {
      cleanup();
    }
    paneState.root.remove();
    paneStates.delete(paneId);
  }

  function handleSearchState(paneId: number, state: ResttySearchState): void {
    const paneState = paneStates.get(paneId);
    if (!paneState) return;
    paneState.state = { ...state };
    syncPaneUi(paneState);
  }

  function handleActivePaneChange(paneId: number | null): void {
    const openPaneId = getOpenPaneId();
    if (openPaneId !== null && openPaneId !== paneId) {
      close(openPaneId, { restoreFocus: false });
    }
  }

  function isOpen(paneId: number): boolean {
    return paneStates.get(paneId)?.open ?? false;
  }

  const onWindowKeyDown = (event: KeyboardEvent) => {
    if (!enabled) return;
    if (shortcutOptions.enabled === false) return;

    const isMac = typeof navigator !== "undefined" && /mac/i.test(navigator.platform);
    const primaryModifier = isMac ? event.metaKey : event.ctrlKey;
    if (!primaryModifier || event.altKey || event.repeat || event.key.toLowerCase() !== "f") {
      return;
    }

    if (
      !isNodeWithinRoot(options.root, event.target) &&
      !isNodeWithinRoot(options.root, ownerDoc.activeElement)
    ) {
      return;
    }

    const pane = options.getFocusedPane() ?? options.getActivePane();
    if (!pane) return;
    if (shortcutOptions.canOpen && !shortcutOptions.canOpen(event, pane.id)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    open(pane.id, { selectAll: true });
  };

  ownerWin.addEventListener("keydown", onWindowKeyDown, { capture: true });

  return {
    registerPane,
    unregisterPane,
    handleSearchState,
    handleActivePaneChange,
    open,
    close,
    toggle,
    isOpen,
    getStyleOptions: () => ({ ...styleOptions }),
    setStyleOptions: (next) => {
      styleOptions = normalizeStyleOptions({
        ...styleOptions,
        ...next,
      });
      if (enabled) {
        applySearchUiStyleOptions(options.root, styleOptions);
      }
    },
    destroy: () => {
      ownerWin.removeEventListener("keydown", onWindowKeyDown, { capture: true });
      for (const paneId of Array.from(paneStates.keys())) {
        unregisterPane(paneId);
      }
      if (enabled) {
        clearSearchUiStyleOptions(options.root);
      }
    },
  };
}
