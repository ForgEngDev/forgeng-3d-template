//#region ../../../forgeng.dev/ForgeNG-3.0.0/packages/contracts/src/ui/UiShellContract.ts
var UI_SHELL_CONTRACT_VERSION = "1.1.0";
var UI_CONTRIBUTION_SLOTS = Object.freeze([
	"top-bar",
	"side-panel",
	"bottom-status",
	"floating-overlay"
]);
//#endregion
//#region ../../../forgeng.dev/ForgeNG-3.0.0/packages/contracts/src/ui/UiSurfaceContract.ts
var UI_SURFACE_CAPABILITY_ID = "forgeng.ui.surfaces";
//#endregion
//#region ../../../forgeng.dev/ForgeNG-3.0.0/packages/contracts/src/ui/UiShellValidation.ts
var UiShellContractError = class extends Error {
	code;
	path;
	constructor(code, path, message) {
		super(message);
		this.code = code;
		this.path = path;
		this.name = "UiShellContractError";
	}
};
var NAMESPACED_ID$1 = /^[a-z0-9]+(?:[._-][a-z0-9]+)+$/;
var LOCAL_ID = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/;
var UI_SETTING_KINDS = [
	"boolean",
	"number",
	"text",
	"select",
	"command",
	"status"
];
function isRecord$3(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
function assertUiContribution(value) {
	if (!isRecord$3(value) || typeof value.id !== "string" || !NAMESPACED_ID$1.test(value.id) || typeof value.title !== "string" || value.title.trim().length === 0 || value.presentation !== void 0 && value.presentation !== "card" && value.presentation !== "mount-only" || !UI_CONTRIBUTION_SLOTS.includes(value.slot)) throw new UiShellContractError("invalid-contribution", "contribution", "UI contribution requires a namespaced id, title, and supported slot.");
}
function assertUiSettingsSchema(value) {
	if (!isRecord$3(value) || typeof value.id !== "string" || !NAMESPACED_ID$1.test(value.id) || typeof value.title !== "string" || value.title.trim().length === 0 || !Array.isArray(value.fields)) throw new UiShellContractError("invalid-settings-schema", "schema", "UI settings schema requires a namespaced id, title, and fields array.");
	const ids = /* @__PURE__ */ new Set();
	value.fields.forEach((field, index) => {
		if (!isRecord$3(field) || typeof field.id !== "string" || !LOCAL_ID.test(field.id) || typeof field.label !== "string" || field.label.trim().length === 0 || typeof field.kind !== "string" || !UI_SETTING_KINDS.includes(field.kind) || field.read !== void 0 && typeof field.read !== "function" || field.write !== void 0 && typeof field.write !== "function") throw new UiShellContractError("invalid-settings-schema", `schema.fields[${index}]`, "UI setting field is invalid.");
		if (field.kind === "select" && (!Array.isArray(field.options) || field.options.length === 0 || !field.options.every((option) => isRecord$3(option) && typeof option.value === "string" && typeof option.label === "string" && option.label.trim().length > 0))) throw new UiShellContractError("invalid-settings-schema", `schema.fields[${index}].options`, "Select field options are invalid.");
		if (field.kind === "command" && (typeof field.commandId !== "string" || !NAMESPACED_ID$1.test(field.commandId))) throw new UiShellContractError("invalid-settings-schema", `schema.fields[${index}].commandId`, "Command field commandId is invalid.");
		if (ids.has(field.id)) throw new UiShellContractError("invalid-settings-schema", `schema.fields[${index}].id`, `Duplicate setting field "${field.id}".`);
		ids.add(field.id);
	});
}
//#endregion
//#region ../../../forgeng.dev/ForgeNG-3.0.0/packages/kernel/src/lifecycle/ResourceScope.ts
function aggregateError(errors, message) {
	const constructor = globalThis.AggregateError;
	if (constructor) return new constructor(errors, message);
	const fallback = new Error(message);
	fallback.name = "AggregateError";
	fallback.errors = [...errors];
	return fallback;
}
function aggregateMembers(error) {
	if (error instanceof Error && error.name === "AggregateError" && Array.isArray(error.errors)) return error.errors;
	return [error];
}
var ScopeDisposalHandle = class {
	entry;
	constructor(entry) {
		this.entry = entry;
	}
	get disposed() {
		return !this.entry.active;
	}
	dispose() {
		if (this.entry.disposePromise) return this.entry.disposePromise;
		this.entry.active = false;
		this.entry.disposePromise = Promise.resolve().then(() => this.entry.disposer());
		return this.entry.disposePromise;
	}
};
var ResourceScope = class {
	entries = [];
	state = "open";
	disposePromise = null;
	get disposed() {
		return this.state === "disposed";
	}
	defer(disposer) {
		if (this.state !== "open") throw new Error(`Cannot register a resource in a ${this.state} ResourceScope.`);
		if (typeof disposer !== "function") throw new TypeError("Resource disposer must be a function.");
		const handle = new ScopeDisposalHandle({
			active: true,
			disposePromise: null,
			disposer
		});
		this.entries.push(handle);
		return handle;
	}
	dispose() {
		if (!this.disposePromise) this.disposePromise = this.disposeEntries();
		return this.disposePromise;
	}
	async disposeEntries() {
		this.state = "disposing";
		const errors = [];
		for (let index = this.entries.length - 1; index >= 0; index -= 1) try {
			await this.entries[index].dispose();
		} catch (error) {
			errors.push(...aggregateMembers(error));
		}
		this.entries.length = 0;
		this.state = "disposed";
		if (errors.length > 0) throw aggregateError(errors, "ResourceScope disposal failed.");
	}
};
async function initializeScoped(initialize) {
	const scope = new ResourceScope();
	try {
		return {
			value: await initialize(scope),
			scope
		};
	} catch (initializationError) {
		try {
			await scope.dispose();
		} catch (rollbackError) {
			throw aggregateError([initializationError, ...aggregateMembers(rollbackError)], "Scoped initialization failed and rollback reported errors.");
		}
		throw initializationError;
	}
}
//#endregion
//#region ../../../forgeng.dev/ForgeNG-3.0.0/packages/kernel/src/lifecycle/SyncCleanup.ts
function cleanupErrorMembers(error) {
	if (error instanceof Error && error.name === "AggregateError") {
		const errors = error.errors;
		if (Array.isArray(errors)) return errors.flatMap(cleanupErrorMembers);
	}
	return [error];
}
function cleanupAggregateError(errors, message) {
	const constructor = globalThis.AggregateError;
	if (constructor) return new constructor(errors, message);
	const fallback = new Error(message);
	fallback.name = "AggregateError";
	fallback.errors = [...errors];
	return fallback;
}
function combinePrimaryAndCleanupError(primaryError, cleanupError, message) {
	return cleanupAggregateError([...cleanupErrorMembers(primaryError), ...cleanupErrorMembers(cleanupError)], message);
}
var SyncCleanupRunner = class {
	errors = [];
	run(step) {
		try {
			step();
		} catch (error) {
			this.errors.push(...cleanupErrorMembers(error));
		}
	}
	finish(message) {
		if (this.errors.length > 0) throw cleanupAggregateError(this.errors, message);
	}
};
function runCleanupSteps(steps, message) {
	const runner = new SyncCleanupRunner();
	for (const step of steps) runner.run(step);
	runner.finish(message);
}
//#endregion
//#region ../../../forgeng.dev/ForgeNG-3.0.0/packages/ui-dom/src/DomUiShellStyles.ts
var DOM_UI_SHELL_STYLES = `
.forgeng-ui-shell{--fg-bg:rgba(10,16,28,.92);--fg-panel:rgba(18,28,46,.94);--fg-border:rgba(132,170,220,.26);--fg-text:#edf5ff;--fg-muted:#9fb2ca;--fg-accent:#53d8a2;position:fixed;inset:0;z-index:10000;pointer-events:none;color:var(--fg-text);font:12px/1.45 Inter,ui-sans-serif,system-ui,sans-serif}
.forgeng-ui-shell[data-theme="light"]{--fg-bg:rgba(245,249,255,.94);--fg-panel:rgba(255,255,255,.97);--fg-border:rgba(34,65,104,.2);--fg-text:#122036;--fg-muted:#52647a;--fg-accent:#087f5b}
.forgeng-ui-surfaces{position:absolute;inset:0;pointer-events:none}
.forgeng-ui-surface{pointer-events:auto;color:inherit;background:transparent;border:0;padding:0}
.forgeng-ui-slot{position:absolute;display:flex;gap:8px}
.forgeng-ui-slot[data-slot="top-bar"]{left:12px;right:12px;top:12px;align-items:flex-start}
.forgeng-ui-slot[data-slot="side-panel"]{right:12px;top:60px;bottom:48px;width:var(--fg-side-width,320px);flex-direction:column;align-items:stretch;overflow:auto}
.forgeng-ui-slot[data-slot="bottom-status"]{left:12px;right:12px;bottom:12px;align-items:flex-end}
.forgeng-ui-slot[data-slot="floating-overlay"]{inset:0}
.forgeng-ui-card{pointer-events:auto;min-width:140px;border:1px solid var(--fg-border);border-radius:10px;background:var(--fg-panel);box-shadow:0 12px 36px rgba(0,0,0,.24);backdrop-filter:blur(14px);overflow:hidden}
.forgeng-ui-card[data-presentation="mount-only"]{position:absolute;inset:0;min-width:0;border:0;border-radius:0;background:transparent;box-shadow:none;backdrop-filter:none;overflow:visible;pointer-events:none}
.forgeng-ui-card[data-presentation="mount-only"]>.forgeng-ui-card__body{position:absolute;inset:0;padding:0;pointer-events:none}
.forgeng-ui-card[data-presentation="mount-only"]>.forgeng-ui-card__body>*{pointer-events:auto}
.forgeng-ui-card__title{padding:8px 11px;font-weight:650;letter-spacing:.02em;border-bottom:1px solid var(--fg-border)}
.forgeng-ui-card__body{padding:9px 11px;display:flex;flex-direction:column;gap:8px}
.forgeng-ui-field{display:grid;grid-template-columns:minmax(90px,1fr) minmax(80px,1fr);gap:8px;align-items:center;color:var(--fg-muted)}
.forgeng-ui-field input,.forgeng-ui-field select,.forgeng-ui-field button,.forgeng-ui-dialog button{font:inherit;color:var(--fg-text);background:var(--fg-bg);border:1px solid var(--fg-border);border-radius:6px;padding:5px 7px}
.forgeng-ui-field button,.forgeng-ui-dialog button{cursor:pointer}
.forgeng-ui-status{color:var(--fg-text);text-align:right}
.forgeng-ui-notifications{position:absolute;right:12px;bottom:54px;width:min(360px,calc(100vw - 24px));display:flex;flex-direction:column;gap:8px;pointer-events:auto}
.forgeng-ui-notification{padding:10px 12px;border:1px solid var(--fg-border);border-left:3px solid var(--fg-accent);border-radius:8px;background:var(--fg-panel)}
.forgeng-ui-notification strong{display:block;margin-bottom:2px}
.forgeng-ui-dialog-layer{position:absolute;inset:0;display:grid;place-items:center;background:rgba(2,6,14,.5);pointer-events:auto}
.forgeng-ui-dialog{width:min(420px,calc(100vw - 32px));padding:18px;border:1px solid var(--fg-border);border-radius:12px;background:var(--fg-panel);box-shadow:0 24px 80px rgba(0,0,0,.45)}
.forgeng-ui-dialog h2{font-size:16px;margin:0 0 8px}.forgeng-ui-dialog p{color:var(--fg-muted);margin:0 0 16px}.forgeng-ui-dialog__actions{display:flex;justify-content:flex-end;gap:8px}
.forgeng-ui-shell[data-side-collapsed="true"] .forgeng-ui-slot[data-slot="side-panel"]{display:none}
`;
//#endregion
//#region ../../../forgeng.dev/ForgeNG-3.0.0/packages/ui-dom/src/DomUiShellRendererFields.ts
function readFieldValue(logger, field) {
	try {
		return field.read?.();
	} catch (error) {
		logger.warn("UI setting read failed.", {
			error,
			metadata: { settingId: field.id }
		});
		return;
	}
}
function readField(logger, field) {
	const value = readFieldValue(logger, field);
	return value === null || value === void 0 ? "—" : String(value);
}
function writeField(logger, field, input) {
	if (!field.write) return;
	let value;
	if (input.tagName === "INPUT" && field.kind === "boolean") value = input.checked;
	else if (field.kind === "number") value = Number(input.value);
	else value = input.value;
	Promise.resolve(field.write(value)).catch((error) => {
		logger.error("UI setting write failed.", {
			error,
			metadata: { settingId: field.id }
		});
	});
}
function renderUiSettingField(document, logger, commands, field) {
	const row = document.createElement("label");
	row.className = "forgeng-ui-field";
	const label = document.createElement("span");
	label.textContent = field.label;
	row.appendChild(label);
	if (field.kind === "status") {
		const status = document.createElement("span");
		status.className = "forgeng-ui-status";
		status.textContent = readField(logger, field);
		row.appendChild(status);
		return row;
	}
	if (field.kind === "command") {
		const button = document.createElement("button");
		button.type = "button";
		button.textContent = field.label;
		button.addEventListener("click", () => {
			if (!field.commandId) return;
			commands.execute(field.commandId).catch((error) => {
				logger.error("UI command failed.", {
					error,
					metadata: { commandId: field.commandId }
				});
			});
		});
		row.appendChild(button);
		return row;
	}
	const input = field.kind === "select" ? document.createElement("select") : document.createElement("input");
	if (input.tagName === "INPUT") {
		const htmlInput = input;
		htmlInput.type = field.kind === "boolean" ? "checkbox" : field.kind;
		if (field.minimum !== void 0) htmlInput.min = String(field.minimum);
		if (field.maximum !== void 0) htmlInput.max = String(field.maximum);
		if (field.step !== void 0) htmlInput.step = String(field.step);
		const value = readFieldValue(logger, field);
		if (field.kind === "boolean") htmlInput.checked = value === true;
		else if (value !== void 0 && value !== null) htmlInput.value = String(value);
	} else {
		for (const option of field.options ?? []) {
			const entry = document.createElement("option");
			entry.value = option.value;
			entry.textContent = option.label;
			input.appendChild(entry);
		}
		const value = readFieldValue(logger, field);
		if (value !== void 0 && value !== null) input.value = String(value);
	}
	input.addEventListener("change", () => writeField(logger, field, input));
	row.appendChild(input);
	return row;
}
//#endregion
//#region ../../../forgeng.dev/ForgeNG-3.0.0/packages/ui-dom/src/DomUiShellRendererSupport.ts
var UI_SHELL_SLOTS = [
	"top-bar",
	"side-panel",
	"bottom-status",
	"floating-overlay"
];
function isElement(value) {
	return !!value && typeof value === "object" && typeof value.appendChild === "function";
}
function resolveMountParent(root, host, _document) {
	if (root) return root;
	if (isElement(host) && host.tagName === "CANVAS") {
		if (host.parentElement) return host.parentElement;
		throw new Error("DOM UI shell requires an explicit root or an attached canvas host.");
	}
	if (isElement(host)) return host;
	throw new Error("DOM UI shell requires an explicit root or DOM host container.");
}
function serializeLength(value) {
	if (value === void 0) return void 0;
	return typeof value === "number" ? `${value}px` : String(value);
}
function applyInsets(style, prefix, insets) {
	const names = prefix ? [
		"top",
		"right",
		"bottom",
		"left"
	].map((side) => `${prefix}-${side}`) : [
		"top",
		"right",
		"bottom",
		"left"
	];
	for (const name of names) style.removeProperty(name);
	if (!insets) return;
	if (insets.top !== void 0) style.setProperty(names[0], serializeLength(insets.top));
	if (insets.right !== void 0) style.setProperty(names[1], serializeLength(insets.right));
	if (insets.bottom !== void 0) style.setProperty(names[2], serializeLength(insets.bottom));
	if (insets.left !== void 0) style.setProperty(names[3], serializeLength(insets.left));
}
var LAYOUT_PROPERTIES = [
	"position",
	"display",
	"flex-direction",
	"flex-wrap",
	"gap",
	"width",
	"height",
	"min-width",
	"min-height",
	"max-width",
	"max-height",
	"overflow",
	"box-sizing",
	"z-index",
	"grid-template-columns",
	"grid-template-rows",
	"grid-column-start",
	"grid-column-end",
	"grid-row-start",
	"grid-row-end",
	"align-items",
	"justify-items",
	"align-content",
	"justify-content",
	"align-self",
	"justify-self",
	"transform"
];
var STYLE_PROPERTIES = [
	"background",
	"opacity",
	"visibility",
	"border-color",
	"border-style",
	"border-width",
	"border-radius",
	"box-shadow",
	"font-family",
	"font-size",
	"font-weight",
	"line-height",
	"color",
	"text-align"
];
function applySurfaceLayout(element, surface, _warnUnsupported) {
	const layout = surface.layout;
	const style = element.style;
	for (const property of LAYOUT_PROPERTIES) style.removeProperty(property);
	style.position = layout?.placement?.mode ?? "relative";
	const mode = layout?.mode ?? "stack";
	style.display = mode === "grid" ? "grid" : mode === "overlay" ? "block" : "flex";
	if (style.display === "flex") style.flexDirection = layout?.direction ?? (mode === "row" ? "row" : "column");
	if (layout?.wrap) style.flexWrap = layout.wrap;
	if (layout?.gap !== void 0) style.gap = serializeLength(layout.gap);
	if (layout?.width !== void 0) style.width = serializeLength(layout.width);
	if (layout?.height !== void 0) style.height = serializeLength(layout.height);
	if (layout?.minWidth !== void 0) style.minWidth = serializeLength(layout.minWidth);
	if (layout?.minHeight !== void 0) style.minHeight = serializeLength(layout.minHeight);
	if (layout?.maxWidth !== void 0) style.maxWidth = serializeLength(layout.maxWidth);
	if (layout?.maxHeight !== void 0) style.maxHeight = serializeLength(layout.maxHeight);
	if (layout?.overflow) style.overflow = layout.overflow;
	if (layout?.clip) style.overflow = "clip";
	if (layout?.boxSizing) style.boxSizing = layout.boxSizing;
	if (layout?.placement?.zLayer !== void 0) style.zIndex = String(layout.placement.zLayer);
	if (layout?.gridColumns) style.gridTemplateColumns = layout.gridColumns.map((track) => serializeLength(track.size)).join(" ");
	if (layout?.gridRows) style.gridTemplateRows = layout.gridRows.map((track) => serializeLength(track.size)).join(" ");
	if (layout?.gridPlacement?.column !== void 0) style.gridColumnStart = String(layout.gridPlacement.column);
	if (layout?.gridPlacement?.columnSpan !== void 0) style.gridColumnEnd = `span ${layout.gridPlacement.columnSpan}`;
	if (layout?.gridPlacement?.row !== void 0) style.gridRowStart = String(layout.gridPlacement.row);
	if (layout?.gridPlacement?.rowSpan !== void 0) style.gridRowEnd = `span ${layout.gridPlacement.rowSpan}`;
	if (layout?.alignItems) style.alignItems = layout.alignItems;
	if (layout?.justifyItems) style.justifyItems = layout.justifyItems;
	if (layout?.alignContent) style.alignContent = layout.alignContent;
	if (layout?.justifyContent) style.justifyContent = layout.justifyContent;
	if (layout?.alignSelf) style.alignSelf = layout.alignSelf;
	if (layout?.justifySelf) style.justifySelf = layout.justifySelf;
	applyInsets(style, "margin", layout?.margin);
	applyInsets(style, "padding", layout?.padding);
	applyInsets(style, "", layout?.placement?.inset);
	if (layout?.safeArea) for (const side of [
		"top",
		"right",
		"bottom",
		"left"
	]) {
		const base = serializeLength(layout.padding?.[side]);
		const safe = `env(safe-area-inset-${side}, 0px)`;
		style.setProperty(`padding-${side}`, base ? `calc(${base} + ${safe})` : safe);
	}
	if (layout?.placement?.anchor) {
		const anchor = layout.placement.anchor;
		if (anchor.includes("top")) style.top ||= "0";
		if (anchor.includes("bottom")) style.bottom ||= "0";
		if (anchor.includes("left")) style.left ||= "0";
		if (anchor.includes("right")) style.right ||= "0";
		if (anchor === "center") {
			style.left = "50%";
			style.top = "50%";
			style.transform = "translate(-50%, -50%)";
		}
	}
}
function applySurfaceStyle(element, surface, previousTokens = /* @__PURE__ */ new Set()) {
	for (const property of STYLE_PROPERTIES) element.style.removeProperty(property);
	for (const token of previousTokens) element.style.removeProperty(token);
	const style = surface.style;
	if (!style) return /* @__PURE__ */ new Set();
	if (style.background) element.style.background = style.background;
	if (style.opacity !== void 0) element.style.opacity = String(style.opacity);
	if (style.visibility) element.style.visibility = style.visibility;
	if (style.border?.color) element.style.borderColor = style.border.color;
	if (style.border?.width !== void 0) {
		element.style.borderStyle = "solid";
		element.style.borderWidth = serializeLength(style.border.width);
	}
	if (style.border?.radius !== void 0) element.style.borderRadius = serializeLength(style.border.radius);
	if (style.border?.shadow) element.style.boxShadow = style.border.shadow;
	if (style.font?.family) element.style.fontFamily = style.font.family;
	if (style.font?.size !== void 0) element.style.fontSize = serializeLength(style.font.size);
	if (style.font?.weight !== void 0) element.style.fontWeight = String(style.font.weight);
	if (style.font?.lineHeight !== void 0) element.style.lineHeight = serializeLength(style.font.lineHeight);
	if (style.font?.color) element.style.color = style.font.color;
	if (style.font?.align) element.style.textAlign = style.font.align;
	const tokens = /* @__PURE__ */ new Set();
	for (const [token, value] of Object.entries(style.tokens ?? {})) {
		const property = token.startsWith("--") ? token : `--${token}`;
		tokens.add(property);
		element.style.setProperty(property, String(value));
	}
	return tokens;
}
//#endregion
//#region ../../../forgeng.dev/ForgeNG-3.0.0/packages/ui-dom/src/UiSurfaceLayoutValidation.ts
var LAYOUT_MODES = [
	"stack",
	"row",
	"column",
	"grid",
	"overlay"
];
var DIRECTIONS = ["row", "column"];
var WRAPS = [
	"nowrap",
	"wrap",
	"wrap-reverse"
];
var BOX_SIZING = ["content-box", "border-box"];
var ALIGNMENTS = [
	"start",
	"center",
	"end",
	"stretch",
	"space-between",
	"space-around",
	"space-evenly"
];
var OVERFLOWS = [
	"visible",
	"hidden",
	"clip",
	"scroll",
	"auto"
];
var POSITION_MODES = [
	"relative",
	"absolute",
	"fixed"
];
var ANCHORS = [
	"top-left",
	"top",
	"top-right",
	"left",
	"center",
	"right",
	"bottom-left",
	"bottom",
	"bottom-right"
];
var LENGTH$1 = /^-?(?:\d+(?:\.\d+)?|\.\d+)(?:px|%|rem|vw|vh|fr)$/;
function isRecord$2(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
function finite$1(value, label) {
	if (value !== void 0 && (typeof value !== "number" || !Number.isFinite(value))) throw new TypeError(`${label} must be a finite number.`);
}
function valueOf$1(value, values, label) {
	if (value !== void 0 && (typeof value !== "string" || !values.includes(value))) throw new TypeError(`${label} is invalid.`);
}
function length$1(value, label) {
	if (value === void 0) return;
	if (typeof value === "number") return finite$1(value, label);
	if (value !== "auto" && (typeof value !== "string" || !LENGTH$1.test(value))) throw new TypeError(`${label} is invalid.`);
}
function insets(value, label) {
	if (value === void 0 || value === null) return;
	if (!isRecord$2(value)) throw new TypeError(`${label} must be an object.`);
	for (const side of [
		"top",
		"right",
		"bottom",
		"left"
	]) length$1(value[side], `${label}.${side}`);
}
function positiveInteger(value, label) {
	if (value !== void 0 && (!Number.isInteger(value) || value < 1)) throw new TypeError(`${label} must be a positive integer.`);
}
function validateSurfaceLayout(layout, label, validateStyle) {
	if (layout === void 0) return;
	if (!isRecord$2(layout)) throw new TypeError(`${label} must be an object.`);
	valueOf$1(layout.mode, LAYOUT_MODES, `${label}.mode`);
	valueOf$1(layout.direction, DIRECTIONS, `${label}.direction`);
	valueOf$1(layout.wrap, WRAPS, `${label}.wrap`);
	for (const key of [
		"width",
		"height",
		"minWidth",
		"minHeight",
		"maxWidth",
		"maxHeight",
		"gap"
	]) length$1(layout[key], `${label}.${key}`);
	insets(layout.margin, `${label}.margin`);
	insets(layout.padding, `${label}.padding`);
	valueOf$1(layout.boxSizing, BOX_SIZING, `${label}.boxSizing`);
	for (const key of [
		"alignItems",
		"justifyItems",
		"alignContent",
		"justifyContent",
		"alignSelf",
		"justifySelf"
	]) valueOf$1(layout[key], ALIGNMENTS, `${label}.${key}`);
	valueOf$1(layout.overflow, OVERFLOWS, `${label}.overflow`);
	if (layout.clip !== void 0 && typeof layout.clip !== "boolean") throw new TypeError(`${label}.clip must be a boolean.`);
	if (layout.safeArea !== void 0 && typeof layout.safeArea !== "boolean") throw new TypeError(`${label}.safeArea must be a boolean.`);
	for (const key of ["gridColumns", "gridRows"]) {
		const tracks = layout[key];
		if (tracks === void 0) continue;
		if (!Array.isArray(tracks)) throw new TypeError(`${label}.${key} must be an array.`);
		tracks.forEach((track, index) => {
			if (!isRecord$2(track) || track.size === void 0) throw new TypeError(`${label}.${key}[${index}].size is required.`);
			length$1(track.size, `${label}.${key}[${index}].size`);
		});
	}
	if (layout.gridPlacement !== void 0 && layout.gridPlacement !== null) {
		if (!isRecord$2(layout.gridPlacement)) throw new TypeError(`${label}.gridPlacement must be an object.`);
		for (const key of [
			"column",
			"columnSpan",
			"row",
			"rowSpan"
		]) positiveInteger(layout.gridPlacement[key], `${label}.gridPlacement.${key}`);
	}
	if (layout.placement !== void 0 && layout.placement !== null) {
		if (!isRecord$2(layout.placement)) throw new TypeError(`${label}.placement must be an object.`);
		valueOf$1(layout.placement.mode, POSITION_MODES, `${label}.placement.mode`);
		valueOf$1(layout.placement.anchor, ANCHORS, `${label}.placement.anchor`);
		finite$1(layout.placement.zLayer, `${label}.placement.zLayer`);
		insets(layout.placement.inset, `${label}.placement.inset`);
	}
	if (layout.responsive === void 0 || layout.responsive === null) return;
	if (!Array.isArray(layout.responsive)) throw new TypeError(`${label}.responsive must be an array.`);
	layout.responsive.forEach((rule, index) => {
		if (!isRecord$2(rule) || !isRecord$2(rule.query)) throw new TypeError(`${label}.responsive[${index}] requires a query.`);
		const query = rule.query;
		for (const key of [
			"minWidth",
			"maxWidth",
			"minHeight",
			"maxHeight"
		]) {
			finite$1(query[key], `${label}.responsive[${index}].query.${key}`);
			if (typeof query[key] === "number" && query[key] < 0) throw new TypeError(`${label}.responsive[${index}].query.${key} cannot be negative.`);
		}
		if (typeof query.minWidth === "number" && typeof query.maxWidth === "number" && query.minWidth > query.maxWidth) throw new TypeError(`${label}.responsive[${index}] minWidth cannot exceed maxWidth.`);
		if (typeof query.minHeight === "number" && typeof query.maxHeight === "number" && query.minHeight > query.maxHeight) throw new TypeError(`${label}.responsive[${index}] minHeight cannot exceed maxHeight.`);
		validateSurfaceLayout(rule.layout, `${label}.responsive[${index}].layout`, validateStyle);
		validateStyle(rule.style, `${label}.responsive[${index}].style`);
	});
}
//#endregion
//#region ../../../forgeng.dev/ForgeNG-3.0.0/packages/ui-dom/src/UiSurfaceStyleValidation.ts
var LENGTH = /^-?(?:\d+(?:\.\d+)?|\.\d+)(?:px|%|rem|vw|vh|fr)$/;
function isRecord$1(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
function finite(value, label) {
	if (value !== void 0 && (typeof value !== "number" || !Number.isFinite(value))) throw new TypeError(`${label} must be a finite number.`);
}
function text(value, label) {
	if (value !== void 0 && (typeof value !== "string" || value.trim().length === 0)) throw new TypeError(`${label} must be a non-empty string.`);
}
function valueOf(value, values, label) {
	if (value !== void 0 && (typeof value !== "string" || !values.includes(value))) throw new TypeError(`${label} is invalid.`);
}
function length(value, label) {
	if (value === void 0) return;
	if (typeof value === "number") return finite(value, label);
	if (value !== "auto" && (typeof value !== "string" || !LENGTH.test(value))) throw new TypeError(`${label} is invalid.`);
}
function validateSurfaceStyle(style, label) {
	if (style === void 0) return;
	if (!isRecord$1(style)) throw new TypeError(`${label} must be an object.`);
	text(style.background, `${label}.background`);
	finite(style.opacity, `${label}.opacity`);
	if (typeof style.opacity === "number" && (style.opacity < 0 || style.opacity > 1)) throw new TypeError(`${label}.opacity must be between 0 and 1.`);
	valueOf(style.visibility, ["visible", "hidden"], `${label}.visibility`);
	valueOf(style.pointerEvents, [
		"auto",
		"none",
		"painted"
	], `${label}.pointerEvents`);
	if (style.border !== void 0 && style.border !== null) {
		if (!isRecord$1(style.border)) throw new TypeError(`${label}.border must be an object.`);
		text(style.border.color, `${label}.border.color`);
		length(style.border.width, `${label}.border.width`);
		length(style.border.radius, `${label}.border.radius`);
		text(style.border.shadow, `${label}.border.shadow`);
	}
	if (style.font !== void 0 && style.font !== null) {
		if (!isRecord$1(style.font)) throw new TypeError(`${label}.font must be an object.`);
		text(style.font.family, `${label}.font.family`);
		length(style.font.size, `${label}.font.size`);
		if (style.font.weight !== void 0 && typeof style.font.weight !== "number" && typeof style.font.weight !== "string") throw new TypeError(`${label}.font.weight is invalid.`);
		if (typeof style.font.weight === "number") finite(style.font.weight, `${label}.font.weight`);
		length(style.font.lineHeight, `${label}.font.lineHeight`);
		text(style.font.color, `${label}.font.color`);
		valueOf(style.font.align, [
			"start",
			"center",
			"end",
			"justify"
		], `${label}.font.align`);
	}
	if (style.tokens === void 0 || style.tokens === null) return;
	if (!isRecord$1(style.tokens)) throw new TypeError(`${label}.tokens must be an object.`);
	for (const [key, token] of Object.entries(style.tokens)) if (!/^(?:--)?[a-z][a-z0-9-]*$/.test(key) || typeof token !== "string" && (typeof token !== "number" || !Number.isFinite(token))) throw new TypeError(`${label}.tokens must use normalized names and string or finite number values.`);
}
//#endregion
//#region ../../../forgeng.dev/ForgeNG-3.0.0/packages/ui-dom/src/UiSurfaceStoreSupport.ts
var NAMESPACED_ID = /^[a-z0-9]+(?:[._-][a-z0-9]+)+$/;
var UI_SURFACE_ROLE_VALUES = [
	"generic",
	"container",
	"banner",
	"complementary",
	"navigation",
	"toolbar",
	"status",
	"dialog",
	"button",
	"text"
];
function isRecord(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
function deepFreeze(value, seen = /* @__PURE__ */ new WeakSet()) {
	if (typeof value !== "object" && typeof value !== "function" || value === null) return value;
	const object = value;
	if (seen.has(object)) return value;
	seen.add(object);
	if (Array.isArray(value)) value.forEach((item) => deepFreeze(item, seen));
	else for (const nested of Object.values(object)) deepFreeze(nested, seen);
	return Object.freeze(value);
}
function cloneData(value, label) {
	try {
		return deepFreeze(structuredClone(value));
	} catch {
		throw new TypeError(`${label} must contain cloneable data.`);
	}
}
function mergePatch(current, patch) {
	if (patch === void 0) return current ? { ...current } : void 0;
	if (patch === null) return void 0;
	const next = {
		...current ?? {},
		...patch
	};
	return Object.keys(next).length > 0 ? next : void 0;
}
function assertBoolean(value, label) {
	if (value !== void 0 && typeof value !== "boolean") throw new TypeError(`${label} must be a boolean.`);
}
function assertString(value, label) {
	if (value !== void 0 && (typeof value !== "string" || value.trim().length === 0)) throw new TypeError(`${label} must be a non-empty string.`);
}
function assertEnum(value, values, label) {
	if (value !== void 0 && (typeof value !== "string" || !values.includes(value))) throw new TypeError(`${label} is invalid.`);
}
function assertContent(content) {
	if (content === void 0 || content === null) return;
	if (!isRecord(content) || content.kind !== void 0 && content.kind !== "none" && content.kind !== "text") throw new TypeError("UI surface content is invalid.");
	if (content.kind === "text" && typeof content.value !== "string") throw new TypeError("UI surface text content requires a string value.");
}
function cloneLayout(layout) {
	return layout === void 0 ? void 0 : cloneData(layout, "UI surface layout");
}
function cloneStyle(style) {
	return style === void 0 ? void 0 : cloneData(style, "UI surface style");
}
function cloneContent(content) {
	return content === void 0 ? void 0 : cloneData(content, "UI surface content");
}
function cloneBindingSnapshot(snapshot) {
	if (!isRecord(snapshot) || snapshot.version !== 1 || !Object.hasOwn(snapshot, "value")) throw new TypeError(`UI surface binding snapshot must use version 1.`);
	return Object.freeze({
		version: 1,
		value: cloneData(snapshot.value, "UI surface binding snapshot value")
	});
}
function captureActions(actions) {
	if (!actions) return void 0;
	if (actions.onPress !== void 0 && typeof actions.onPress !== "function") throw new TypeError("UI surface onPress action must be a function.");
	return Object.freeze({ onPress: actions.onPress });
}
function captureBindingPort(binding) {
	if (!isRecord(binding) || typeof binding.getSnapshot !== "function" || typeof binding.subscribe !== "function") throw new TypeError("UI surface binding must implement getSnapshot and subscribe.");
	const getSnapshot = binding.getSnapshot;
	const subscribe = binding.subscribe;
	return Object.freeze({
		getSnapshot: () => Reflect.apply(getSnapshot, binding, []),
		subscribe: (listener) => Reflect.apply(subscribe, binding, [listener])
	});
}
function captureMountContent(mountContent) {
	if (!mountContent) return void 0;
	if (typeof mountContent.mount !== "function") throw new TypeError("UI surface mountContent must define mount.");
	return Object.freeze({ mount: mountContent.mount });
}
function mergeLayout(current, patch) {
	if (patch === void 0) return cloneLayout(current);
	return cloneLayout({
		...current ?? {},
		...patch,
		margin: mergePatch(current?.margin, patch.margin),
		padding: mergePatch(current?.padding, patch.padding),
		placement: patch.placement === null ? void 0 : mergePatch(current?.placement, patch.placement ? {
			...patch.placement,
			inset: mergePatch(current?.placement?.inset, patch.placement.inset)
		} : void 0),
		gridPlacement: mergePatch(current?.gridPlacement, patch.gridPlacement),
		responsive: patch.responsive === null ? void 0 : patch.responsive ?? current?.responsive
	});
}
function mergeStyle(current, patch) {
	if (patch === void 0) return cloneStyle(current);
	return cloneStyle({
		...current ?? {},
		...patch,
		border: mergePatch(current?.border, patch.border),
		font: mergePatch(current?.font, patch.font),
		tokens: patch.tokens === null ? void 0 : patch.tokens ?? current?.tokens
	});
}
function ensureFiniteNumber(value, label) {
	if (value === void 0) return;
	if (typeof value !== "number" || !Number.isFinite(value)) throw new TypeError(`${label} must be a finite number.`);
}
function validateSurfaceDescriptor(descriptor, knownIds) {
	if (!isRecord(descriptor) || typeof descriptor.id !== "string" || !NAMESPACED_ID.test(descriptor.id)) throw new TypeError("UI surface id must be normalized and namespaced.");
	if (descriptor.parentId !== void 0) {
		if (typeof descriptor.parentId !== "string" || !NAMESPACED_ID.test(descriptor.parentId)) throw new TypeError("UI surface parent id must be normalized and namespaced.");
		if (!knownIds.has(descriptor.parentId)) throw new Error(`UI surface parent "${descriptor.parentId}" does not exist.`);
	}
	ensureFiniteNumber(descriptor.order, "UI surface order");
	assertEnum(descriptor.role, UI_SURFACE_ROLE_VALUES, "UI surface role");
	assertString(descriptor.accessibleLabel, "UI surface accessibleLabel");
	assertBoolean(descriptor.focusable, "UI surface focusable");
	assertBoolean(descriptor.hidden, "UI surface hidden");
	validateSurfaceLayout(descriptor.layout, "UI surface layout", validateSurfaceStyle);
	validateSurfaceStyle(descriptor.style, "UI surface style");
	assertContent(descriptor.content);
	captureActions(descriptor.actions);
	if (descriptor.binding !== void 0) captureBindingPort(descriptor.binding);
	captureMountContent(descriptor.mountContent);
}
//#endregion
//#region ../../../forgeng.dev/ForgeNG-3.0.0/packages/ui-dom/src/DomUiSurfaceResponsive.ts
function resolveResponsiveSurface(surface, width, height) {
	const rules = surface.layout?.responsive;
	if (!rules?.length) return surface;
	let layout = surface.layout;
	let style = surface.style;
	for (const rule of rules) {
		const query = rule.query;
		if (query.minWidth !== void 0 && width < query.minWidth || query.maxWidth !== void 0 && width > query.maxWidth || query.minHeight !== void 0 && height < query.minHeight || query.maxHeight !== void 0 && height > query.maxHeight) continue;
		layout = mergeLayout(layout, rule.layout);
		style = mergeStyle(style, rule.style);
	}
	return {
		...surface,
		layout,
		style
	};
}
//#endregion
//#region ../../../forgeng.dev/ForgeNG-3.0.0/packages/ui-dom/src/DomUiShellRenderer.ts
var DomUiShellRenderer = class {
	document;
	services;
	logger;
	configuredRoot;
	host;
	scope = new ResourceScope();
	mountedContent = /* @__PURE__ */ new Map();
	mountedSurfaces = /* @__PURE__ */ new Map();
	renderedSurfaces = /* @__PURE__ */ new Map();
	pendingCleanup = /* @__PURE__ */ new Set();
	slots = /* @__PURE__ */ new Map();
	root = null;
	surfaceLayer = null;
	destroyed = false;
	destroyPromise = null;
	surfaceRenderQueued = false;
	styleId = `fg-ui-${Math.random().toString(36).slice(2, 10)}`;
	warnedUnsupported = /* @__PURE__ */ new Set();
	previousFocus = null;
	constructor(document, services, logger, configuredRoot, host) {
		this.document = document;
		this.services = services;
		this.logger = logger;
		this.configuredRoot = configuredRoot;
		this.host = host;
	}
	async initialize() {
		if (this.root) throw new Error("DOM UI shell renderer is already initialized.");
		try {
			const style = this.document.createElement("style");
			style.dataset.forgengUiShell = "styles";
			style.dataset.forgengUiShellInstance = this.styleId;
			style.textContent = DOM_UI_SHELL_STYLES.replaceAll(".forgeng-ui-shell", `.forgeng-ui-shell[data-ui-instance="${this.styleId}"]`);
			this.document.head.appendChild(style);
			this.scope.defer(() => style.remove());
			const mountParent = resolveMountParent(this.configuredRoot, this.host, this.document);
			const root = this.document.createElement("div");
			root.className = "forgeng-ui-shell";
			root.dataset.forgengUiShell = "root";
			root.dataset.uiInstance = this.styleId;
			root.setAttribute("aria-live", "polite");
			const surfaces = this.document.createElement("div");
			surfaces.className = "forgeng-ui-surfaces";
			root.appendChild(surfaces);
			this.surfaceLayer = surfaces;
			for (const slot of UI_SHELL_SLOTS) {
				const element = this.document.createElement("div");
				element.className = "forgeng-ui-slot";
				element.dataset.slot = slot;
				root.appendChild(element);
				this.slots.set(slot, element);
			}
			mountParent.appendChild(root);
			this.root = root;
			this.scope.defer(() => root.remove());
			this.retain(this.services.contributions.subscribe(() => this.renderContributions()));
			this.retain(this.services.settings.subscribe(() => this.renderContributions()));
			this.retain(this.services.notifications.subscribe(() => this.renderNotifications()));
			this.retain(this.services.dialogs.subscribe(() => this.renderDialogs()));
			this.retain(this.services.preferences.subscribe(() => this.applyPreferences()));
			this.retain(this.services.surfaces.subscribe(() => this.renderSurfaces()));
			const view = this.document.defaultView;
			if (view) {
				const onResize = () => this.queueSurfaceRender();
				view.addEventListener("resize", onResize);
				this.scope.defer(() => view.removeEventListener("resize", onResize));
			}
			this.applyPreferences();
			this.renderNow();
		} catch (error) {
			try {
				await this.scope.dispose();
			} catch (cleanupError) {
				throw combinePrimaryAndCleanupError(error, cleanupError, "DOM UI shell initialization and rollback failed.");
			}
			throw error;
		}
	}
	destroy() {
		this.destroyPromise ??= this.destroyOnce();
		return this.destroyPromise;
	}
	async destroyOnce() {
		this.destroyed = true;
		const cleanup = new ResourceScope();
		cleanup.defer(() => this.scope.dispose());
		for (const id of [...this.mountedContent.keys()]) cleanup.defer(() => this.detachMountedContent(id)?.dispose());
		for (const id of [...this.mountedSurfaces.keys()]) cleanup.defer(() => this.detachMountedSurface(id)?.dispose());
		for (const [id, rendered] of this.renderedSurfaces) {
			this.services.surfaces.setMountTarget(id, null);
			rendered.element.remove();
		}
		this.renderedSurfaces.clear();
		const pending = [...this.pendingCleanup];
		if (pending.length > 0) cleanup.defer(() => Promise.all(pending).then(() => void 0));
		this.root = null;
		this.surfaceLayer = null;
		this.slots.clear();
		await cleanup.dispose();
	}
	retain(disposable) {
		this.scope.defer(() => disposable.dispose());
	}
	queueSurfaceRender() {
		if (this.surfaceRenderQueued || this.destroyed) return;
		this.surfaceRenderQueued = true;
		queueMicrotask(() => {
			this.surfaceRenderQueued = false;
			this.renderSurfaces();
		});
	}
	renderNow() {
		if (this.destroyed) return;
		this.renderSurfaces();
		this.renderContributions();
		this.renderNotifications();
		this.renderDialogs();
	}
	renderSurfaces() {
		const layer = this.surfaceLayer;
		if (!layer) return;
		const surfaces = [];
		this.collectSurfaceTree(void 0, surfaces);
		const desired = new Set(surfaces.map((surface) => surface.id));
		for (const id of [...this.renderedSurfaces.keys()]) if (!desired.has(id)) this.releaseRenderedSurface(id);
		for (const surface of surfaces) {
			const parent = surface.parentId ? this.renderedSurfaces.get(surface.parentId)?.element : layer;
			if (!parent) continue;
			const interactive = !!surface.actions?.onPress;
			let rendered = this.renderedSurfaces.get(surface.id);
			if (rendered && (rendered.element.tagName !== (interactive ? "BUTTON" : "DIV") || rendered.mountContent !== surface.mountContent)) {
				this.releaseRenderedSurface(surface.id);
				rendered = void 0;
			}
			const created = !rendered;
			rendered ??= this.createRenderedSurface(surface, interactive);
			this.updateRenderedSurface(rendered, surface);
			parent.appendChild(rendered.element);
			this.services.surfaces.setMountTarget(surface.id, rendered.element);
			if (created && surface.mountContent) this.mountSurfaceContent(surface, rendered.element);
		}
	}
	collectSurfaceTree(parentId, output) {
		for (const surface of this.services.surfaces.list(parentId)) {
			output.push(surface);
			this.collectSurfaceTree(surface.id, output);
		}
	}
	createRenderedSurface(surface, interactive) {
		const element = this.document.createElement(interactive ? "button" : "div");
		element.className = "forgeng-ui-surface";
		element.dataset.surfaceId = surface.id;
		if (interactive) {
			const button = element;
			button.type = "button";
			button.addEventListener("click", (event) => {
				event.stopPropagation();
				const action = this.renderedSurfaces.get(surface.id)?.snapshot.actions?.onPress;
				if (!action) return;
				try {
					Promise.resolve(action()).catch((error) => this.logger.error("UI surface action failed.", {
						error,
						metadata: { surfaceId: surface.id }
					}));
				} catch (error) {
					this.logger.error("UI surface action failed.", {
						error,
						metadata: { surfaceId: surface.id }
					});
				}
			});
		}
		const rendered = {
			element,
			snapshot: surface,
			mountContent: surface.mountContent,
			textNode: null,
			tokens: /* @__PURE__ */ new Set()
		};
		this.renderedSurfaces.set(surface.id, rendered);
		return rendered;
	}
	updateRenderedSurface(rendered, snapshot) {
		const view = this.document.defaultView;
		const surface = resolveResponsiveSurface(snapshot, this.root?.clientWidth || view?.innerWidth || 0, this.root?.clientHeight || view?.innerHeight || 0);
		const { element } = rendered;
		rendered.snapshot = snapshot;
		element.removeAttribute("role");
		element.removeAttribute("aria-label");
		element.removeAttribute("tabindex");
		if (surface.role && surface.role !== "generic") element.setAttribute("role", surface.role === "button" ? "button" : surface.role);
		if (surface.accessibleLabel) element.setAttribute("aria-label", surface.accessibleLabel);
		if (surface.focusable) element.tabIndex = 0;
		element.hidden = surface.hidden === true;
		applySurfaceLayout(element, surface, (key, message) => this.warnUnsupportedOnce(key, message));
		rendered.tokens = applySurfaceStyle(element, surface, rendered.tokens);
		element.style.pointerEvents = surface.actions?.onPress || surface.style?.pointerEvents === "auto" ? "auto" : surface.style?.pointerEvents === "none" ? "none" : "auto";
		if (surface.hidden === true) element.style.display = "none";
		const bindingSnapshot = surface.binding?.getSnapshot();
		if (bindingSnapshot) element.dataset.bindingVersion = String(bindingSnapshot.version);
		else delete element.dataset.bindingVersion;
		const content = surface.content;
		if (content?.kind === "text") {
			rendered.textNode ??= this.document.createTextNode("");
			rendered.textNode.data = content.value;
			if (rendered.textNode.parentNode !== element) element.insertBefore(rendered.textNode, element.firstChild);
		} else {
			rendered.textNode?.remove();
			rendered.textNode = null;
		}
	}
	mountSurfaceContent(surface, target) {
		const scope = new ResourceScope();
		this.mountedSurfaces.set(surface.id, scope);
		try {
			const handle = surface.mountContent?.mount({
				target,
				registerDispose: (dispose) => scope.defer(dispose)
			});
			if (handle) scope.defer(() => handle.dispose());
		} catch (error) {
			this.logger.error("UI surface mount failed.", {
				error,
				metadata: { surfaceId: surface.id }
			});
			this.mountedSurfaces.delete(surface.id);
			this.trackCleanup(scope, "UI surface cleanup failed.", { surfaceId: surface.id });
		}
	}
	releaseRenderedSurface(surfaceId) {
		const rendered = this.renderedSurfaces.get(surfaceId);
		if (!rendered) return;
		this.renderedSurfaces.delete(surfaceId);
		this.services.surfaces.setMountTarget(surfaceId, null);
		const scope = this.detachMountedSurface(surfaceId);
		if (scope) this.trackCleanup(scope, "UI surface cleanup failed.", { surfaceId });
		rendered.element.remove();
	}
	detachMountedSurface(surfaceId) {
		const scope = this.mountedSurfaces.get(surfaceId) ?? null;
		this.mountedSurfaces.delete(surfaceId);
		return scope;
	}
	renderContributions() {
		for (const id of [...this.mountedContent.keys()]) this.releaseMountedContent(id);
		for (const slot of UI_SHELL_SLOTS) {
			const target = this.slots.get(slot);
			if (!target) continue;
			target.replaceChildren();
			const hidden = this.services.preferences.get().layout.hiddenSlots.includes(slot);
			target.hidden = hidden;
			if (hidden) continue;
			for (const contribution of this.services.contributions.list(slot)) target.appendChild(this.renderContribution(contribution));
		}
	}
	renderContribution(contribution) {
		const card = this.document.createElement("section");
		card.className = "forgeng-ui-card";
		card.dataset.contributionId = contribution.id;
		const presentation = contribution.presentation ?? "card";
		card.dataset.presentation = presentation;
		if (presentation === "card") {
			const title = this.document.createElement("div");
			title.className = "forgeng-ui-card__title";
			title.textContent = contribution.title;
			card.appendChild(title);
		}
		const body = this.document.createElement("div");
		body.className = "forgeng-ui-card__body";
		card.appendChild(body);
		this.services.contributions.setMountTarget(contribution.id, body);
		const schema = contribution.settingsSchemaId ? this.services.settings.get(contribution.settingsSchemaId) : null;
		if (schema) for (const field of schema.fields) body.appendChild(renderUiSettingField(this.document, this.logger, this.services.commands, field));
		if (contribution.content) this.mountContent(contribution, body);
		return card;
	}
	mountContent(contribution, target) {
		const scope = new ResourceScope();
		this.mountedContent.set(contribution.id, scope);
		try {
			const handle = contribution.content?.mount({
				target,
				registerDispose: (dispose) => scope.defer(dispose)
			});
			if (handle) scope.defer(() => handle.dispose());
		} catch (error) {
			this.logger.error("UI contribution mount failed.", {
				error,
				metadata: { contributionId: contribution.id }
			});
			scope.dispose();
		}
	}
	releaseMountedContent(contributionId) {
		this.services.contributions.setMountTarget(contributionId, null);
		const scope = this.detachMountedContent(contributionId);
		if (!scope) return;
		this.trackCleanup(scope, "UI contribution cleanup failed.", { contributionId });
	}
	detachMountedContent(contributionId) {
		const scope = this.mountedContent.get(contributionId) ?? null;
		this.mountedContent.delete(contributionId);
		return scope;
	}
	renderNotifications() {
		const overlay = this.slots.get("floating-overlay");
		if (!overlay || this.destroyed) return;
		overlay.querySelector(".forgeng-ui-notifications")?.remove();
		const notifications = this.services.notifications.list();
		if (notifications.length === 0) return;
		const list = this.document.createElement("div");
		list.className = "forgeng-ui-notifications";
		for (const notification of notifications) {
			const item = this.document.createElement("div");
			item.className = "forgeng-ui-notification";
			item.dataset.level = notification.level;
			const title = this.document.createElement("strong");
			title.textContent = notification.title;
			item.appendChild(title);
			if (notification.message) item.append(notification.message);
			list.appendChild(item);
		}
		overlay.appendChild(list);
	}
	renderDialogs() {
		const overlay = this.slots.get("floating-overlay");
		if (!overlay || this.destroyed) return;
		overlay.querySelector(".forgeng-ui-dialog-layer")?.remove();
		const request = this.services.dialogs.list()[0];
		if (!request) {
			this.previousFocus?.focus?.();
			this.previousFocus = null;
			return;
		}
		const layer = this.document.createElement("div");
		layer.className = "forgeng-ui-dialog-layer";
		const dialog = this.document.createElement("div");
		dialog.className = "forgeng-ui-dialog";
		dialog.setAttribute("role", "dialog");
		dialog.setAttribute("aria-modal", "true");
		const title = this.document.createElement("h2");
		title.textContent = request.title;
		dialog.appendChild(title);
		if (request.message) {
			const message = this.document.createElement("p");
			message.textContent = request.message;
			dialog.appendChild(message);
		}
		const actions = this.document.createElement("div");
		actions.className = "forgeng-ui-dialog__actions";
		this.previousFocus ??= this.document.activeElement instanceof HTMLElement ? this.document.activeElement : null;
		for (const action of request.actions) {
			const button = this.document.createElement("button");
			button.type = "button";
			button.textContent = action.label;
			button.dataset.kind = action.kind ?? "secondary";
			button.addEventListener("click", () => this.services.dialogs.resolve(request.id, action.id));
			actions.appendChild(button);
		}
		dialog.appendChild(actions);
		layer.appendChild(dialog);
		overlay.appendChild(layer);
		actions.querySelector("button")?.focus();
	}
	applyPreferences() {
		const root = this.root;
		if (!root) return;
		const preferences = this.services.preferences.get();
		root.dataset.theme = preferences.theme;
		root.dataset.sideCollapsed = String(preferences.layout.sidePanelCollapsed);
		root.style.setProperty("--fg-side-width", `${preferences.layout.sidePanelWidth}px`);
		this.renderContributions();
	}
	trackCleanup(scope, message, metadata) {
		const cleanup = scope.dispose().catch((error) => this.logger.error(message, {
			error,
			metadata
		}));
		this.pendingCleanup.add(cleanup);
		cleanup.finally(() => this.pendingCleanup.delete(cleanup));
	}
	warnUnsupportedOnce(key, message) {
		if (this.warnedUnsupported.has(key)) return;
		this.warnedUnsupported.add(key);
		this.logger.warn(message);
	}
};
//#endregion
//#region ../../../forgeng.dev/ForgeNG-3.0.0/packages/ui-dom/src/UiShellStorePrimitives.ts
var UiStoreDisposable = class {
	release;
	disposed = false;
	constructor(release) {
		this.release = release;
	}
	dispose() {
		if (this.disposed) return;
		this.disposed = true;
		return this.release();
	}
};
var UiStoreChangeSignal = class {
	listeners = /* @__PURE__ */ new Set();
	subscribe(listener) {
		this.listeners.add(listener);
		return new UiStoreDisposable(() => {
			this.listeners.delete(listener);
		});
	}
	emit(...args) {
		for (const listener of [...this.listeners]) listener(...args);
	}
	clear() {
		this.listeners.clear();
	}
};
//#endregion
//#region ../../../forgeng.dev/ForgeNG-3.0.0/packages/ui-dom/src/UiContributionStore.ts
var UiContributionStore = class {
	values = /* @__PURE__ */ new Map();
	mountTargets = /* @__PURE__ */ new Map();
	changes = new UiStoreChangeSignal();
	register(contribution) {
		assertUiContribution(contribution);
		if (this.values.has(contribution.id)) throw new Error(`UI contribution "${contribution.id}" is already registered.`);
		this.values.set(contribution.id, Object.freeze({ ...contribution }));
		this.changes.emit();
		return new UiStoreDisposable(() => {
			if (!this.values.delete(contribution.id)) return;
			this.mountTargets.delete(contribution.id);
			this.changes.emit();
		});
	}
	list(slot) {
		return [...this.values.values()].filter((contribution) => slot === void 0 || contribution.slot === slot).sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.id.localeCompare(b.id));
	}
	subscribe(listener) {
		return this.changes.subscribe(listener);
	}
	getMountTarget(contributionId) {
		return this.mountTargets.get(contributionId) ?? null;
	}
	setMountTarget(contributionId, target) {
		if (target === null) this.mountTargets.delete(contributionId);
		else if (this.values.has(contributionId)) this.mountTargets.set(contributionId, target);
	}
	clear() {
		this.values.clear();
		this.mountTargets.clear();
		this.changes.clear();
	}
};
//#endregion
//#region ../../../forgeng.dev/ForgeNG-3.0.0/packages/ui-dom/src/UiDialogStore.ts
var UiDialogStore = class {
	values = /* @__PURE__ */ new Map();
	changes = new UiStoreChangeSignal();
	open(request) {
		if (!request.id || !request.title || request.actions.length === 0) return Promise.reject(/* @__PURE__ */ new TypeError("UI dialog requires id, title, and at least one action."));
		if (this.values.has(request.id)) return Promise.reject(/* @__PURE__ */ new Error(`UI dialog "${request.id}" is already open.`));
		return new Promise((resolve) => {
			this.values.set(request.id, {
				request,
				resolve
			});
			this.changes.emit();
		});
	}
	dismiss(dialogId) {
		this.resolve(dialogId, null);
	}
	resolve(dialogId, actionId) {
		const pending = this.values.get(dialogId);
		if (!pending) return;
		this.values.delete(dialogId);
		pending.resolve({ actionId });
		this.changes.emit();
	}
	list() {
		return [...this.values.values()].map(({ request }) => request);
	}
	subscribe(listener) {
		return this.changes.subscribe(listener);
	}
	clear() {
		for (const id of [...this.values.keys()]) this.resolve(id, null);
		this.changes.clear();
	}
};
//#endregion
//#region ../../../forgeng.dev/ForgeNG-3.0.0/packages/ui-dom/src/UiShellServices.ts
var UiCommandStore = class {
	values = /* @__PURE__ */ new Map();
	register(command) {
		if (!command.id || !command.title || typeof command.execute !== "function") throw new TypeError("UI command requires id, title, and execute.");
		if (this.values.has(command.id)) throw new Error(`UI command "${command.id}" is already registered.`);
		this.values.set(command.id, command);
		return new UiStoreDisposable(() => {
			this.values.delete(command.id);
		});
	}
	async execute(commandId, payload) {
		const command = this.values.get(commandId);
		if (!command) throw new Error(`UI command "${commandId}" is not registered.`);
		return await command.execute(payload);
	}
	list() {
		return [...this.values.values()].map(({ id, title }) => Object.freeze({
			id,
			title
		}));
	}
	clear() {
		this.values.clear();
	}
};
var UiNotificationStore = class {
	values = /* @__PURE__ */ new Map();
	changes = new UiStoreChangeSignal();
	nextId = 0;
	publish(input) {
		const id = input.id ?? `forgeng.ui.notification.${this.nextId++}`;
		if (this.values.has(id)) throw new Error(`UI notification "${id}" is already active.`);
		this.values.set(id, Object.freeze({
			...input,
			id,
			createdAt: Date.now()
		}));
		this.changes.emit();
		return new UiStoreDisposable(() => this.dismiss(id));
	}
	list() {
		return [...this.values.values()];
	}
	dismiss(notificationId) {
		if (this.values.delete(notificationId)) this.changes.emit();
	}
	subscribe(listener) {
		return this.changes.subscribe(listener);
	}
	clear() {
		this.values.clear();
		this.changes.clear();
	}
};
var UiSettingsStore = class {
	values = /* @__PURE__ */ new Map();
	changes = new UiStoreChangeSignal();
	register(schema) {
		assertUiSettingsSchema(schema);
		if (this.values.has(schema.id)) throw new Error(`UI settings schema "${schema.id}" is already registered.`);
		this.values.set(schema.id, Object.freeze({
			...schema,
			fields: Object.freeze([...schema.fields])
		}));
		this.changes.emit();
		return new UiStoreDisposable(() => {
			if (this.values.delete(schema.id)) this.changes.emit();
		});
	}
	get(schemaId) {
		return this.values.get(schemaId) ?? null;
	}
	list() {
		return [...this.values.values()];
	}
	subscribe(listener) {
		return this.changes.subscribe(listener);
	}
	refresh(_schemaId) {
		this.changes.emit();
	}
	clear() {
		this.values.clear();
		this.changes.clear();
	}
};
//#endregion
//#region ../../../forgeng.dev/ForgeNG-3.0.0/packages/ui-dom/src/UiSurfaceStore.ts
function toSnapshot(record) {
	return Object.freeze({
		id: record.id,
		parentId: record.parentId,
		order: record.order,
		role: record.role,
		accessibleLabel: record.accessibleLabel,
		focusable: record.focusable,
		hidden: record.hidden,
		visible: !record.hidden,
		disposed: record.disposed,
		layout: cloneLayout(record.layout),
		style: cloneStyle(record.style),
		content: cloneContent(record.content),
		actions: record.actions,
		binding: record.bindingState?.port,
		mountContent: record.mountContent
	});
}
var StoredUiSurfaceHandle = class {
	store;
	record;
	constructor(store, record) {
		this.store = store;
		this.record = record;
	}
	get id() {
		return this.record.id;
	}
	getSnapshot() {
		return this.store.snapshotRecord(this.record);
	}
	update(patch) {
		return this.store.updateRecord(this.record, patch);
	}
	show() {
		return this.update({ hidden: false });
	}
	hide() {
		return this.update({ hidden: true });
	}
	dispose() {
		this.store.disposeRecord(this.record);
		return Promise.resolve();
	}
};
var UiSurfaceStore = class {
	values = /* @__PURE__ */ new Map();
	handles = /* @__PURE__ */ new Map();
	mountTargets = /* @__PURE__ */ new Map();
	changes = new UiStoreChangeSignal();
	create(descriptor) {
		validateSurfaceDescriptor(descriptor, this.valuesAsSet());
		if (this.values.has(descriptor.id)) throw new Error(`UI surface "${descriptor.id}" is already registered.`);
		if (descriptor.parentId && this.createsCycle(descriptor.id, descriptor.parentId)) throw new Error(`UI surface "${descriptor.id}" would create a parent cycle.`);
		const bindingState = descriptor.binding ? this.prepareBinding(descriptor.binding) : void 0;
		const record = {
			id: descriptor.id,
			parentId: descriptor.parentId,
			order: descriptor.order,
			role: descriptor.role,
			accessibleLabel: descriptor.accessibleLabel,
			focusable: descriptor.focusable,
			hidden: descriptor.hidden,
			disposed: false,
			layout: cloneLayout(descriptor.layout),
			style: cloneStyle(descriptor.style),
			content: cloneContent(descriptor.content),
			actions: captureActions(descriptor.actions),
			bindingState,
			mountContent: captureMountContent(descriptor.mountContent),
			children: /* @__PURE__ */ new Set()
		};
		const handle = new StoredUiSurfaceHandle(this, record);
		this.values.set(record.id, record);
		this.handles.set(record.id, handle);
		if (record.parentId) this.values.get(record.parentId)?.children.add(record.id);
		try {
			if (bindingState) this.subscribeBinding(record, bindingState);
		} catch (error) {
			this.values.get(record.parentId ?? "")?.children.delete(record.id);
			this.values.delete(record.id);
			this.handles.delete(record.id);
			record.disposed = true;
			bindingState?.subscription?.dispose();
			throw error;
		}
		this.changes.emit();
		return handle;
	}
	get(surfaceId) {
		return this.handles.get(surfaceId) ?? null;
	}
	list(parentId) {
		return Object.freeze([...this.values.values()].filter((record) => record.parentId === parentId).sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.id.localeCompare(b.id)).map((record) => toSnapshot(record)));
	}
	subscribe(listener) {
		return this.changes.subscribe(listener);
	}
	getMountTarget(surfaceId) {
		return this.mountTargets.get(surfaceId) ?? null;
	}
	setMountTarget(surfaceId, target) {
		if (target === null) this.mountTargets.delete(surfaceId);
		else if (this.values.has(surfaceId)) this.mountTargets.set(surfaceId, target);
	}
	clear() {
		const records = [...this.values.values()];
		records.forEach((record) => {
			record.disposed = true;
		});
		this.values.clear();
		this.handles.clear();
		this.mountTargets.clear();
		try {
			this.disposeBindingSubscriptions(records);
		} finally {
			if (records.length > 0) this.changes.emit();
			this.changes.clear();
		}
	}
	snapshot(surfaceId) {
		const record = this.values.get(surfaceId);
		if (!record) throw this.disposedError(surfaceId);
		return this.snapshotRecord(record);
	}
	updateSurface(surfaceId, patch) {
		const record = this.values.get(surfaceId);
		if (!record) throw this.disposedError(surfaceId);
		return this.updateRecord(record, patch);
	}
	disposeSurface(surfaceId) {
		const record = this.values.get(surfaceId);
		if (!record) throw this.disposedError(surfaceId);
		this.disposeRecord(record);
	}
	snapshotRecord(record) {
		this.assertCurrent(record);
		return toSnapshot(record);
	}
	updateRecord(record, patch) {
		this.assertCurrent(record);
		const parentId = patch.parentId === null ? void 0 : patch.parentId ?? record.parentId;
		const nextLayout = patch.layout === void 0 ? record.layout : mergeLayout(record.layout, patch.layout);
		const nextStyle = patch.style === void 0 ? record.style : mergeStyle(record.style, patch.style);
		const nextContent = patch.content === void 0 ? record.content : cloneContent(patch.content ?? void 0);
		const nextActions = patch.actions === void 0 ? record.actions : captureActions(patch.actions ?? void 0);
		const nextMountContent = patch.mountContent === void 0 ? record.mountContent : captureMountContent(patch.mountContent ?? void 0);
		const descriptor = {
			id: record.id,
			parentId,
			order: patch.order ?? record.order,
			role: patch.role ?? record.role,
			accessibleLabel: patch.accessibleLabel === null ? void 0 : patch.accessibleLabel ?? record.accessibleLabel,
			focusable: patch.focusable ?? record.focusable,
			hidden: patch.hidden ?? record.hidden,
			layout: nextLayout,
			style: nextStyle,
			content: nextContent,
			actions: nextActions,
			binding: patch.binding === null ? void 0 : patch.binding ?? record.bindingState?.port,
			mountContent: nextMountContent
		};
		validateSurfaceDescriptor(descriptor, this.valuesAsSet());
		if (parentId && this.createsCycle(record.id, parentId)) throw new Error(`UI surface "${record.id}" would create a parent cycle.`);
		const bindingChanged = patch.binding !== void 0;
		const nextBinding = patch.binding ? this.prepareBinding(patch.binding) : patch.binding === null ? void 0 : record.bindingState;
		if (bindingChanged && nextBinding) this.subscribeBinding(record, nextBinding);
		const previousParentId = record.parentId;
		const previousBinding = record.bindingState;
		record.parentId = parentId;
		record.order = descriptor.order;
		record.role = descriptor.role;
		record.accessibleLabel = descriptor.accessibleLabel;
		record.focusable = descriptor.focusable;
		record.hidden = descriptor.hidden;
		record.layout = nextLayout;
		record.style = nextStyle;
		record.content = nextContent;
		record.actions = nextActions;
		record.bindingState = nextBinding;
		record.mountContent = nextMountContent;
		if (previousParentId !== parentId) {
			this.values.get(previousParentId ?? "")?.children.delete(record.id);
			this.values.get(parentId ?? "")?.children.add(record.id);
		}
		this.changes.emit();
		if (bindingChanged && previousBinding !== nextBinding) previousBinding?.subscription?.dispose();
		return toSnapshot(record);
	}
	disposeRecord(record) {
		if (record.disposed) return;
		this.assertCurrent(record);
		const removed = [];
		this.collectForDisposal(record, removed);
		this.values.get(record.parentId ?? "")?.children.delete(record.id);
		for (const removedRecord of removed) {
			removedRecord.disposed = true;
			this.values.delete(removedRecord.id);
			this.handles.delete(removedRecord.id);
			this.mountTargets.delete(removedRecord.id);
		}
		try {
			this.disposeBindingSubscriptions(removed);
		} finally {
			this.changes.emit();
		}
	}
	prepareBinding(binding) {
		const sourcePort = captureBindingPort(binding);
		const state = {
			sourcePort,
			port: sourcePort,
			snapshot: cloneBindingSnapshot(sourcePort.getSnapshot())
		};
		state.port = Object.freeze({
			getSnapshot: () => cloneBindingSnapshot(state.snapshot),
			subscribe: (listener) => sourcePort.subscribe((snapshot) => {
				listener(cloneBindingSnapshot(snapshot));
			})
		});
		return state;
	}
	subscribeBinding(record, state) {
		const subscription = state.sourcePort.subscribe((snapshot) => {
			state.snapshot = cloneBindingSnapshot(snapshot);
			if (!record.disposed && this.values.get(record.id) === record && record.bindingState === state) this.changes.emit();
		});
		if (!subscription || typeof subscription.dispose !== "function") throw new TypeError("UI surface binding subscription must return a disposable.");
		state.subscription = subscription;
	}
	collectForDisposal(record, removed) {
		for (const childId of [...record.children]) {
			const child = this.values.get(childId);
			if (child) this.collectForDisposal(child, removed);
		}
		removed.push(record);
	}
	assertCurrent(record) {
		if (record.disposed || this.values.get(record.id) !== record) throw this.disposedError(record.id);
	}
	disposedError(surfaceId) {
		return /* @__PURE__ */ new Error(`UI surface "${surfaceId}" is disposed.`);
	}
	disposeBindingSubscriptions(records) {
		runCleanupSteps(records.flatMap((record) => record.bindingState?.subscription ? [() => record.bindingState?.subscription?.dispose()] : []), "UI surface binding cleanup failed.");
	}
	valuesAsSet() {
		return new Set(this.values.keys());
	}
	createsCycle(surfaceId, parentId) {
		let current = parentId;
		while (current) {
			if (current === surfaceId) return true;
			current = this.values.get(current)?.parentId;
		}
		return false;
	}
};
//#endregion
//#region ../../../forgeng.dev/ForgeNG-3.0.0/packages/ui-dom/src/UiShellPreferences.ts
var DEFAULT_LAYOUT = Object.freeze({
	sidePanelWidth: 320,
	sidePanelCollapsed: false,
	hiddenSlots: Object.freeze([])
});
var DEFAULT_PREFERENCES = Object.freeze({
	version: 1,
	theme: "dark",
	layout: DEFAULT_LAYOUT
});
var THEMES = /* @__PURE__ */ new Set([
	"system",
	"light",
	"dark"
]);
var SLOTS = /* @__PURE__ */ new Set([
	"top-bar",
	"side-panel",
	"bottom-status",
	"floating-overlay"
]);
function normalize(value) {
	if (typeof value !== "object" || value === null) return DEFAULT_PREFERENCES;
	const candidate = value;
	if (candidate.version !== 1 || !THEMES.has(candidate.theme)) return DEFAULT_PREFERENCES;
	const layout = candidate.layout;
	if (!layout || !Number.isFinite(layout.sidePanelWidth) || typeof layout.sidePanelCollapsed !== "boolean" || !Array.isArray(layout.hiddenSlots) || layout.hiddenSlots.some((slot) => !SLOTS.has(slot))) return DEFAULT_PREFERENCES;
	return freezeSnapshot(candidate.theme, {
		sidePanelWidth: Math.min(640, Math.max(220, layout.sidePanelWidth)),
		sidePanelCollapsed: layout.sidePanelCollapsed,
		hiddenSlots: [...new Set(layout.hiddenSlots)]
	});
}
function freezeSnapshot(theme, layout) {
	return Object.freeze({
		version: 1,
		theme,
		layout: Object.freeze({
			...layout,
			hiddenSlots: Object.freeze([...layout.hiddenSlots])
		})
	});
}
var UiShellPreferences = class {
	storage;
	storageKey;
	listeners = /* @__PURE__ */ new Set();
	snapshot;
	destroyPromise = null;
	destroyed = false;
	constructor(storage, storageKey = "forgeng.ui.preferences.v1") {
		this.storage = storage;
		this.storageKey = storageKey;
		this.snapshot = this.read();
	}
	get() {
		return this.snapshot;
	}
	update(patch) {
		this.assertActive();
		const nextLayout = {
			...this.snapshot.layout,
			...patch.layout ?? {}
		};
		this.snapshot = normalize({
			version: 1,
			theme: patch.theme ?? this.snapshot.theme,
			layout: nextLayout
		});
		this.persist();
		this.emit();
		return this.snapshot;
	}
	reset() {
		this.assertActive();
		this.snapshot = DEFAULT_PREFERENCES;
		this.storage?.removeItem(this.storageKey);
		this.emit();
		return this.snapshot;
	}
	subscribe(listener) {
		this.listeners.add(listener);
		return { dispose: () => {
			this.listeners.delete(listener);
		} };
	}
	clear() {
		this.listeners.clear();
	}
	flush() {
		return this.storage?.flush?.() ?? Promise.resolve();
	}
	destroy() {
		if (!this.destroyPromise) {
			this.destroyed = true;
			this.destroyPromise = this.flush().finally(() => this.clear());
		}
		return this.destroyPromise;
	}
	assertActive() {
		if (this.destroyed) throw new Error("UI preferences have been destroyed.");
	}
	read() {
		const stored = this.storage?.getItem(this.storageKey);
		if (!stored) return DEFAULT_PREFERENCES;
		try {
			return normalize(JSON.parse(stored));
		} catch {
			return DEFAULT_PREFERENCES;
		}
	}
	persist() {
		this.storage?.setItem(this.storageKey, JSON.stringify(this.snapshot));
	}
	emit() {
		for (const listener of [...this.listeners]) listener(this.snapshot);
	}
};
//#endregion
//#region ../../../forgeng.dev/ForgeNG-3.0.0/packages/ui-dom/src/StorageUiPreferenceAdapter.ts
function createUiPersistenceFailure(failures, message) {
	if (failures.length === 1) return failures[0];
	const error = new Error(message);
	Object.defineProperty(error, "errors", { value: Object.freeze([...failures]) });
	return error;
}
var encoder = new TextEncoder();
var decoder = new TextDecoder("utf-8", { fatal: true });
var StorageUiPreferenceAdapter = class {
	area;
	storageKey;
	cached;
	pending = /* @__PURE__ */ new Set();
	failures = [];
	constructor(area, storageKey, cached) {
		this.area = area;
		this.storageKey = storageKey;
		this.cached = cached;
	}
	getItem(key) {
		this.assertKey(key);
		return this.cached;
	}
	setItem(key, value) {
		this.assertKey(key);
		this.cached = value;
		this.track(this.area.set(key, encoder.encode(value)));
	}
	removeItem(key) {
		this.assertKey(key);
		this.cached = null;
		this.track(this.area.remove(key).then(() => void 0));
	}
	async flush() {
		await Promise.allSettled([...this.pending]);
		if (this.failures.length > 0) throw createUiPersistenceFailure(this.failures, "UI preference persistence observed failed writes.");
	}
	assertKey(key) {
		if (key !== this.storageKey) throw new TypeError(`UI preference adapter owns only the configured key "${this.storageKey}".`);
	}
	track(operation) {
		this.pending.add(operation);
		operation.then(() => {
			this.pending.delete(operation);
		}, (error) => {
			this.pending.delete(operation);
			this.failures.push(error);
		});
	}
};
async function createStorageUiPreferenceAdapter(area, storageKey) {
	const value = await area.get(storageKey);
	let cached = null;
	if (value) try {
		cached = decoder.decode(value);
	} catch {
		cached = null;
	}
	return new StorageUiPreferenceAdapter(area, storageKey, cached);
}
//#endregion
//#region ../../../forgeng.dev/ForgeNG-3.0.0/packages/ui-dom/src/DomUiShell.ts
var DEFAULT_UI_PREFERENCE_STORAGE_KEY = "forgeng.ui.preferences.v1";
function resolveDocument(host, configured) {
	if (configured) return configured;
	const ownerDocument = host?.ownerDocument;
	if (ownerDocument && typeof ownerDocument.createElement === "function") return ownerDocument;
	throw new Error("DOM UI shell requires an explicit Document or a DOM host with ownerDocument.");
}
var DomUiShell = class {
	options;
	contributions = new UiContributionStore();
	commands = new UiCommandStore();
	notifications = new UiNotificationStore();
	dialogs = new UiDialogStore();
	settings = new UiSettingsStore();
	surfaces = new UiSurfaceStore();
	preferences;
	state = "new";
	initializePromise = null;
	destroyPromise = null;
	scope = null;
	constructor(options = {}) {
		this.options = options;
		this.preferences = new UiShellPreferences(options.storage ?? null, options.storageKey);
	}
	initialize(context) {
		if (this.initializePromise) return this.initializePromise;
		if (this.state !== "new") return Promise.reject(/* @__PURE__ */ new Error(`Cannot initialize DOM UI shell in state ${this.state}.`));
		this.state = "initializing";
		this.initializePromise = this.initializeOnce(context);
		return this.initializePromise;
	}
	destroy() {
		if (!this.destroyPromise) this.destroyPromise = this.destroyOnce();
		return this.destroyPromise;
	}
	async initializeOnce(context) {
		try {
			if (context.signal.aborted) throw context.signal.reason;
			const document = resolveDocument(context.host, this.options.document);
			const initialized = await initializeScoped(async (scope) => {
				const renderer = new DomUiShellRenderer(document, this, context.logger.child("dom"), this.options.root ?? null, context.host);
				await renderer.initialize();
				scope.defer(() => renderer.destroy());
				if (context.signal.aborted) throw context.signal.reason;
			});
			this.scope = initialized.scope;
			this.state = "ready";
		} catch (error) {
			this.state = "destroyed";
			throw error;
		}
	}
	async destroyOnce() {
		this.state = "destroying";
		if (this.initializePromise) try {
			await this.initializePromise;
		} catch {}
		const scope = this.scope;
		this.scope = null;
		const results = await Promise.allSettled([scope?.dispose() ?? Promise.resolve(), this.preferences.destroy()]);
		try {
			this.dialogs.clear();
			this.notifications.clear();
			this.contributions.clear();
			this.settings.clear();
			this.commands.clear();
			this.surfaces.clear();
			this.state = "destroyed";
		} finally {
			const failures = results.filter((result) => result.status === "rejected").map((result) => result.reason);
			if (failures.length > 0) throw createUiPersistenceFailure(failures, "DOM UI shell cleanup failed.");
		}
	}
};
function isStorageBindable(descriptor) {
	return "bindStorageArea" in descriptor && typeof descriptor.bindStorageArea === "function";
}
function bindDomUiShellProviderStorage(descriptor, area) {
	return isStorageBindable(descriptor) ? descriptor.bindStorageArea(area) : Promise.resolve(descriptor);
}
function createDomUiShellProviderDescriptor(defaults = {}) {
	return Object.freeze({
		id: "forgeng.ui.dom-devtools",
		contractVersion: UI_SHELL_CONTRACT_VERSION,
		implementationVersion: "3.0.0",
		capabilities: [{
			id: UI_SURFACE_CAPABILITY_ID,
			version: "1.0.0"
		}],
		create: (options = defaults) => new DomUiShell(options),
		bindStorageArea: async (area) => createDomUiShellProviderDescriptor({
			...defaults,
			storage: area ? await createStorageUiPreferenceAdapter(area, defaults.storageKey ?? "forgeng.ui.preferences.v1") : null
		})
	});
}
var DOM_UI_SHELL_PROVIDER_DESCRIPTOR = createDomUiShellProviderDescriptor();
//#endregion
export { DEFAULT_UI_PREFERENCE_STORAGE_KEY, DOM_UI_SHELL_PROVIDER_DESCRIPTOR, DomUiShell, DomUiShellRenderer, StorageUiPreferenceAdapter, UiCommandStore, UiContributionStore, UiDialogStore, UiNotificationStore, UiSettingsStore, UiShellPreferences, UiSurfaceStore, bindDomUiShellProviderStorage, createDomUiShellProviderDescriptor, createStorageUiPreferenceAdapter };
