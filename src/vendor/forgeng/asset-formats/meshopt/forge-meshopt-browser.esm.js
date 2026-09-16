var Q = Object.defineProperty;
var F = (i, e, t) => e in i ? Q(i, e, { enumerable: !0, configurable: !0, writable: !0, value: t }) : i[e] = t;
var n = (i, e, t) => F(i, typeof e != "symbol" ? e + "" : e, t);
const I = "forgeng.codec-worker/1";
class c extends Error {
  constructor(t, s, r = {}) {
    super(s);
    n(this, "code");
    n(this, "codecId");
    n(this, "jobId");
    n(this, "retryable");
    n(this, "cause");
    this.name = "CodecRuntimeError", this.code = t, this.codecId = r.codecId, this.jobId = r.jobId, this.retryable = r.retryable ?? !1, this.cause = r.cause;
  }
}
function U(i) {
  const e = typeof document < "u" ? document.baseURI : typeof location < "u" ? location.href : void 0;
  if (!i.baseUrl && !e)
    throw new c("invalid-config", "Browser codec platform requires a baseUrl outside a document.");
  return new URL(i.baseUrl ?? e);
}
function S(i, e) {
  if (/^(?:blob|data):/i.test(i.uri))
    throw new c("invalid-config", "Browser codec artifacts cannot use blob: or data: URLs.");
  const t = U(e), s = new URL(i.uri, t);
  if (s.protocol !== "https:" && s.protocol !== "http:")
    throw new c("invalid-config", "Browser codec artifacts require an HTTP(S) release URL.");
  if (s.username || s.password) throw new c("invalid-config", "Browser codec artifact URLs cannot contain credentials.");
  if (!new Set(e.allowedOrigins ?? [t.origin]).has(s.origin))
    throw new c("invalid-config", "Browser codec artifact origin is not allowed by release policy.");
  return s;
}
async function H(i, e) {
  const t = i.headers.get("content-length");
  if (t !== null && Number(t) !== e)
    throw new c("artifact-size", "Codec release response byte length does not match its descriptor.");
  if (!i.body) {
    const u = new Uint8Array(await i.arrayBuffer());
    if (u.byteLength !== e) throw new c("artifact-size", "Codec release artifact byte length is invalid.");
    return u;
  }
  const s = i.body.getReader(), r = [];
  let o = 0;
  try {
    for (; ; ) {
      const u = await s.read();
      if (u.done) break;
      if (o += u.value.byteLength, o > e)
        throw await s.cancel(), new c("artifact-size", "Codec release artifact exceeded its declared byte length.");
      r.push(u.value);
    }
  } finally {
    s.releaseLock();
  }
  if (o !== e) throw new c("artifact-size", "Codec release artifact byte length is invalid.");
  const d = new Uint8Array(o);
  let f = 0;
  for (const u of r)
    d.set(u, f), f += u.byteLength;
  return d;
}
class _ {
  constructor(e) {
    n(this, "options");
    this.options = e;
  }
  async read(e, t) {
    const s = S(e, this.options), r = this.options.fetch ?? globalThis.fetch;
    if (typeof r != "function") throw new c("artifact-read", "Browser fetch is unavailable.");
    const o = new AbortController(), d = () => o.abort(t.reason);
    t.addEventListener("abort", d, { once: !0 });
    try {
      const f = await r(s, {
        cache: "force-cache",
        credentials: s.origin === U(this.options).origin ? "same-origin" : "omit",
        redirect: "error",
        signal: o.signal
      });
      if (!f.ok) throw new c("artifact-read", `Codec release artifact returned HTTP ${f.status}.`);
      if (f.url && S({ ...e, uri: f.url }, this.options).href !== s.href)
        throw new c("artifact-read", "Codec release artifact redirected away from its pinned URL.");
      return await H(f, e.byteLength);
    } finally {
      t.removeEventListener("abort", d);
    }
  }
}
class G {
  constructor(e) {
    n(this, "implementation");
    this.implementation = e;
  }
  async sha256(e) {
    const t = e.slice().buffer, s = await this.implementation.subtle.digest("SHA-256", t);
    return [...new Uint8Array(s)].map((r) => r.toString(16).padStart(2, "0")).join("");
  }
}
class X {
  constructor(e) {
    n(this, "worker");
    n(this, "messages", /* @__PURE__ */ new Map());
    n(this, "errors", /* @__PURE__ */ new Map());
    this.worker = e;
  }
  postMessage(e, t) {
    this.worker.postMessage(e, [...t]);
  }
  addMessageListener(e) {
    const t = (s) => e(s.data);
    this.messages.set(e, t), this.worker.addEventListener("message", t);
  }
  removeMessageListener(e) {
    const t = this.messages.get(e);
    t && (this.worker.removeEventListener("message", t), this.messages.delete(e));
  }
  addErrorListener(e) {
    const t = (s) => e(s.error ?? s);
    this.errors.set(e, t), this.worker.addEventListener("error", t);
  }
  removeErrorListener(e) {
    const t = this.errors.get(e);
    t && (this.worker.removeEventListener("error", t), this.errors.delete(e));
  }
  async terminate() {
    this.messages.clear(), this.errors.clear(), this.worker.terminate();
  }
}
class K {
  constructor(e) {
    n(this, "options");
    this.options = e;
  }
  async create(e, t) {
    if (t.aborted)
      throw new c("cancelled", "Browser codec worker creation was cancelled.", { cause: t.reason });
    if (e.descriptor.kind !== "worker") throw new c("invalid-config", "Worker factory received a non-worker artifact.");
    const s = S(e.descriptor, this.options), r = this.options.createWorker ?? ((o, d) => new Worker(o, d));
    return new X(r(s, {
      type: "module",
      name: `forgeng-codec-${e.descriptor.implementationVersion}`
    }));
  }
}
const Z = Object.freeze({
  now: () => performance.now(),
  schedule: (i, e) => globalThis.setTimeout(i, e),
  cancel: (i) => globalThis.clearTimeout(i)
});
function Y(i = {}) {
  const e = i.crypto ?? globalThis.crypto;
  if (!e?.subtle) throw new c("invalid-config", "Browser Web Crypto SHA-256 is unavailable.");
  return Object.freeze({
    artifacts: new _(i),
    digest: new G(e),
    schedule: Z,
    workers: new K(i)
  });
}
const M = Object.freeze({ type: "abort" });
class q {
  constructor() {
    n(this, "listeners", /* @__PURE__ */ new Map());
    n(this, "abortedValue", !1);
    n(this, "reasonValue");
  }
  get aborted() {
    return this.abortedValue;
  }
  get reason() {
    return this.reasonValue;
  }
  addEventListener(e, t, s) {
    if (e === "abort") {
      if (this.abortedValue) {
        t(M);
        return;
      }
      this.listeners.set(t, s?.once === !0);
    }
  }
  removeEventListener(e, t) {
    e === "abort" && this.listeners.delete(t);
  }
  abort(e) {
    if (!this.abortedValue) {
      this.abortedValue = !0, this.reasonValue = e;
      for (const [t] of this.listeners)
        try {
          t(M);
        } catch {
        }
      this.listeners.clear();
    }
  }
}
class $ {
  constructor() {
    n(this, "inner", new q());
  }
  get signal() {
    return this.inner;
  }
  abort(e) {
    this.inner.abort(e);
  }
}
function ee(i) {
  if (i instanceof ArrayBuffer) return i.slice(0);
  const e = new Uint8Array(i.byteLength);
  return e.set(new Uint8Array(i.buffer, i.byteOffset, i.byteLength)), e.buffer;
}
class v {
  constructor(e, t) {
    n(this, "buffers");
    n(this, "stateValue", "owned");
    n(this, "byteLengthValue");
    n(this, "expectedLengths");
    this.buffers = e.map((s) => t ? s.slice(0) : s), this.expectedLengths = this.buffers.map((s) => s.byteLength), this.byteLengthValue = this.buffers.reduce((s, r) => s + r.byteLength, 0);
  }
  static copyOf(e) {
    return new v(e.map(ee), !1);
  }
  /** Takes exclusive ownership. Callers must not retain or reuse the supplied buffers. */
  static take(e) {
    return new v(e, !1);
  }
  get byteLength() {
    return this.stateValue === "owned" ? this.byteLengthValue : 0;
  }
  get originalByteLength() {
    return this.byteLengthValue;
  }
  get state() {
    return this.stateValue;
  }
  clone() {
    return this.assertOwned("clone"), new v(this.buffers, !0);
  }
  /** Moves ownership exactly once. The wrapper rejects all later reads or transfers. */
  move() {
    this.assertOwned("move");
    const e = this.buffers;
    return this.buffers = [], this.stateValue = "moved", e;
  }
  dispose() {
    if (this.stateValue === "owned") {
      for (const e of this.buffers)
        e.byteLength > 0 && new Uint8Array(e).fill(0);
      this.buffers = [], this.stateValue = "disposed";
    }
  }
  assertOwned(e) {
    if (this.stateValue !== "owned")
      throw new c(
        "ownership-released",
        `Codec buffers cannot ${e} after ownership was ${this.stateValue}.`
      );
    if (this.buffers.some((t, s) => t.byteLength !== this.expectedLengths[s]))
      throw this.buffers = [], this.stateValue = "moved", new c("ownership-released", "Detached codec buffers cannot be reused.");
  }
}
class te {
  constructor(e, t, s, r, o) {
    n(this, "codecId");
    n(this, "implementationVersion");
    n(this, "jobId");
    n(this, "owned");
    n(this, "owner");
    n(this, "active", !0);
    this.codecId = e, this.implementationVersion = t, this.jobId = s, this.owned = r, this.owner = o;
  }
  get byteLength() {
    return this.active ? this.owned.byteLength : 0;
  }
  get released() {
    return !this.active;
  }
  /** Moves decoded buffers to the caller and releases runtime accounting. */
  takeBuffers() {
    this.assertActive();
    const e = this.owned.byteLength, t = this.owned.move();
    return this.active = !1, this.owner.release(this, e), t;
  }
  release() {
    if (!this.active) return;
    const e = this.owned.byteLength;
    this.owned.dispose(), this.active = !1, this.owner.release(this, e);
  }
  assertActive() {
    if (!this.active) throw new c("ownership-released", "Codec result lease was already released.", {
      codecId: this.codecId,
      jobId: this.jobId
    });
  }
}
const ie = /^[a-f0-9]{64}$/, se = /^[a-z0-9](?:[a-z0-9._/-]{0,126}[a-z0-9])?$/, re = /^[0-9]+\.[0-9]+\.[0-9]+(?:[-+][0-9A-Za-z.-]+)?$/;
function N(i, e) {
  if (i.kind !== "worker" && i.kind !== "wasm")
    throw new c("invalid-config", "Codec artifact kind must be worker or wasm.");
  if (!i.uri || /^(?:blob|data):/i.test(i.uri))
    throw new c("invalid-config", "Codec artifacts require a static release URI; blob: and data: are forbidden.");
  if (!ie.test(i.sha256))
    throw new c("invalid-config", "Codec artifact SHA-256 must be 64 lowercase hexadecimal characters.");
  if (!Number.isSafeInteger(i.byteLength) || i.byteLength < 1)
    throw new c("invalid-config", "Codec artifact byteLength must be a positive safe integer.");
  if (i.implementationVersion !== e)
    throw new c(
      "implementation-version-mismatch",
      "Codec artifact implementation version does not match its runtime descriptor."
    );
}
function ne(i) {
  if (!se.test(i.id)) throw new c("invalid-config", "Codec implementation ID is invalid.");
  if (!re.test(i.implementationVersion))
    throw new c("invalid-config", "Codec implementation version must be an exact semantic version.");
  i.worker && N(i.worker, i.implementationVersion), i.wasm && N(i.wasm, i.implementationVersion);
}
async function R(i, e, t, s) {
  if (t.aborted)
    throw new c("cancelled", "Codec artifact loading was cancelled.", { codecId: s, cause: t.reason });
  let r;
  try {
    r = await e.artifacts.read(i, t);
  } catch (f) {
    throw f instanceof c ? f : new c("artifact-read", "Codec release artifact could not be read.", { codecId: s, retryable: !0, cause: f });
  }
  if (t.aborted)
    throw r.fill(0), new c("cancelled", "Codec artifact loading was cancelled.", { codecId: s, cause: t.reason });
  if (r.byteLength !== i.byteLength)
    throw r.fill(0), new c("artifact-size", "Codec release artifact byte length does not match its descriptor.", { codecId: s });
  const o = r.slice();
  if (r.fill(0), (await e.digest.sha256(o)).toLowerCase() !== i.sha256)
    throw o.fill(0), new c("integrity-mismatch", "Codec release artifact SHA-256 verification failed.", { codecId: s });
  return Object.freeze({ descriptor: Object.freeze({ ...i }), bytes: o });
}
const oe = Object.freeze({
  workers: 0,
  listeners: 0,
  pendingJobs: 0,
  queuedJobs: 0,
  runningJobs: 0,
  ownedInputBytes: 0,
  ownedOutputBytes: 0,
  artifactBytes: 0,
  wasmAllocations: 0,
  wasmBytes: 0,
  initializationAttempts: 0,
  initializationFailures: 0,
  jobsStarted: 0,
  jobsCompleted: 0,
  jobsCancelled: 0,
  jobsFailed: 0,
  jobsTimedOut: 0,
  inflightJoins: 0,
  workerCrashes: 0
});
class ae {
  constructor() {
    n(this, "values", { ...oe });
  }
  add(e, t) {
    this.values[e] = Math.max(0, this.values[e] + t);
  }
  increment(e) {
    this.values[e] += 1;
  }
  zeroGauges() {
    for (const e of [
      "workers",
      "listeners",
      "pendingJobs",
      "queuedJobs",
      "runningJobs",
      "ownedInputBytes",
      "ownedOutputBytes",
      "artifactBytes",
      "wasmAllocations",
      "wasmBytes"
    ]) this.values[e] = 0;
  }
  snapshot() {
    return Object.freeze({ ...this.values });
  }
}
const k = Object.freeze({
  maxWorkers: 2,
  maxQueuedJobs: 64,
  maxInputBytes: 256 * 1024 * 1024,
  maxOutputBytes: 512 * 1024 * 1024,
  defaultTimeoutMs: 3e4,
  initializationTimeoutMs: 1e4
});
function O(i, e, t, s, r) {
  const o = e ?? t;
  if (!Number.isSafeInteger(o) || o < s || o > r)
    throw new c("invalid-config", `${i} must be a safe integer from ${s} through ${r}.`);
  return o;
}
function ce(i) {
  const e = i.mode ?? "auto", t = e === "auto" ? i.implementation.worker && i.platform.workers ? "worker" : "inline" : e;
  if (t === "worker" && (!i.implementation.worker || !i.platform.workers))
    throw new c("invalid-config", "Worker mode requires a worker release artifact and worker factory port.");
  if (t === "inline" && !i.inline)
    throw new c("invalid-config", "Inline mode requires an explicit inline codec factory.");
  return Object.freeze({
    mode: t,
    maxWorkers: O("maxWorkers", i.maxWorkers, k.maxWorkers, 1, 8),
    maxQueuedJobs: O("maxQueuedJobs", i.maxQueuedJobs, k.maxQueuedJobs, 1, 1024),
    maxInputBytes: O("maxInputBytes", i.maxInputBytes, k.maxInputBytes, 1, 1024 * 1024 * 1024),
    maxOutputBytes: O("maxOutputBytes", i.maxOutputBytes, k.maxOutputBytes, 1, 1024 * 1024 * 1024),
    defaultTimeoutMs: O("defaultTimeoutMs", i.defaultTimeoutMs, k.defaultTimeoutMs, 1, 3e5),
    initializationTimeoutMs: O(
      "initializationTimeoutMs",
      i.initializationTimeoutMs,
      k.initializationTimeoutMs,
      1,
      6e4
    )
  });
}
function de(i) {
  const e = Object.freeze({
    id: i.implementation.id,
    implementationVersion: i.implementation.implementationVersion,
    ...i.implementation.worker ? { worker: Object.freeze({ ...i.implementation.worker }) } : {},
    ...i.implementation.wasm ? { wasm: Object.freeze({ ...i.implementation.wasm }) } : {}
  });
  return Object.freeze({
    implementation: e,
    platform: i.platform,
    ...i.inline ? { inline: i.inline } : {},
    ...i.mode ? { mode: i.mode } : {},
    ...i.maxWorkers !== void 0 ? { maxWorkers: i.maxWorkers } : {},
    ...i.maxQueuedJobs !== void 0 ? { maxQueuedJobs: i.maxQueuedJobs } : {},
    ...i.maxInputBytes !== void 0 ? { maxInputBytes: i.maxInputBytes } : {},
    ...i.maxOutputBytes !== void 0 ? { maxOutputBytes: i.maxOutputBytes } : {},
    ...i.defaultTimeoutMs !== void 0 ? { defaultTimeoutMs: i.defaultTimeoutMs } : {},
    ...i.initializationTimeoutMs !== void 0 ? { initializationTimeoutMs: i.initializationTimeoutMs } : {}
  });
}
function fe(i) {
  if (!i) return Object.freeze({});
  const e = Object.entries(i).sort(([s], [r]) => s.localeCompare(r));
  if (e.length > 64) throw new c("invalid-config", "Codec job metadata is limited to 64 fields.");
  const t = {};
  for (const [s, r] of e) {
    if (!/^[A-Za-z0-9_.-]{1,64}$/.test(s) || typeof r != "string" && typeof r != "number" && typeof r != "boolean" && r !== null || typeof r == "number" && !Number.isFinite(r) || typeof r == "string" && r.length > 1024)
      throw new c("invalid-config", "Codec job metadata is not closed, finite, and bounded.");
    t[s] = r;
  }
  return Object.freeze(t);
}
function ue(i, e, t, s, r) {
  return i.operation === e.operation && i.inputByteLength === e.input.byteLength && i.maxOutputBytes === s && i.timeoutMs === r && JSON.stringify(i.metadata) === JSON.stringify(t);
}
function j(i, e) {
  let t = 0;
  for (const s of i) {
    if (!(s instanceof ArrayBuffer)) throw new c("worker-protocol", "Codec output contains a non-ArrayBuffer value.");
    if (t += s.byteLength, !Number.isSafeInteger(t) || t > e)
      throw new c("result-too-large", "Codec output exceeds the configured byte limit.");
  }
  return t;
}
function le(i, e, t) {
  const s = (r, o) => new c(r, o, { codecId: t });
  if (!(i.input instanceof v) || i.input.state !== "owned")
    throw s("ownership-released", "Codec input must be an exclusively owned, reusable buffer wrapper.");
  if (!i.key || i.key.length > 512) throw s("invalid-config", "Codec job key must contain 1 through 512 characters.");
  if (!/^[A-Za-z0-9_.:/-]{1,128}$/.test(i.operation)) throw s("invalid-config", "Codec job operation is invalid.");
  if (i.input.byteLength > e) throw s("invalid-config", "Codec input exceeds the configured byte limit.");
  if (i.timeoutMs !== void 0 && (!Number.isSafeInteger(i.timeoutMs) || i.timeoutMs < 1))
    throw s("invalid-config", "Codec job timeout must be a positive safe integer.");
  if (i.maxOutputBytes !== void 0 && (!Number.isSafeInteger(i.maxOutputBytes) || i.maxOutputBytes < 1))
    throw s("invalid-config", "Codec output limit must be a positive safe integer.");
}
class he {
  constructor(e, t, s, r, o, d) {
    n(this, "source");
    n(this, "options");
    n(this, "cancellation");
    n(this, "metrics");
    n(this, "host");
    n(this, "workerPool");
    n(this, "initialization");
    n(this, "workerArtifact");
    n(this, "wasmArtifact");
    n(this, "inlineSessionValue");
    this.source = e, this.options = t, this.cancellation = s, this.metrics = r, this.host = o, this.workerPool = d;
  }
  get inlineSession() {
    return this.inlineSessionValue;
  }
  ensure() {
    if (this.initialization) return this.initialization;
    this.metrics.increment("initializationAttempts");
    const t = this.initialize().catch((s) => {
      throw this.metrics.increment("initializationFailures"), this.initialization === t && (this.initialization = void 0), this.clearArtifacts(), s;
    });
    return this.initialization = t, t;
  }
  reset() {
    this.initialization = void 0, this.clearArtifacts();
  }
  async destroy() {
    const e = this.initialization;
    if (e)
      try {
        await e;
      } catch {
      }
    if (this.inlineSessionValue) {
      try {
        await this.inlineSessionValue.destroy();
      } catch {
      }
      this.inlineSessionValue = void 0;
    }
    this.clearArtifacts();
  }
  async initialize() {
    const e = this.source.implementation, t = await Promise.all([
      this.options.mode === "worker" && e.worker ? R(e.worker, this.source.platform, this.cancellation.signal, e.id) : Promise.resolve(void 0),
      e.wasm ? R(e.wasm, this.source.platform, this.cancellation.signal, e.id) : Promise.resolve(void 0)
    ]);
    if (!this.host.active)
      throw t.forEach((s) => s?.bytes.fill(0)), this.host.error("destroyed", "Codec runtime was destroyed during initialization.");
    this.workerArtifact = t[0], this.wasmArtifact = t[1], this.metrics.add("artifactBytes", (t[0]?.bytes.byteLength ?? 0) + (t[1]?.bytes.byteLength ?? 0)), this.options.mode === "worker" ? this.workerPool.configure(this.workerArtifact, this.wasmArtifact) : await this.initializeInline();
  }
  async initializeInline() {
    const e = this.wasmArtifact?.bytes.slice();
    try {
      const t = await this.source.inline.initialize({
        codecId: this.source.implementation.id,
        implementationVersion: this.source.implementation.implementationVersion,
        ...e ? { wasm: e } : {},
        signal: this.cancellation.signal
      });
      if (e?.fill(0), !this.host.active)
        throw await t.destroy(), this.host.error("destroyed", "Codec runtime was destroyed during inline initialization.");
      this.inlineSessionValue = t, this.wasmArtifact && (this.metrics.add("wasmAllocations", 1), this.metrics.add("wasmBytes", this.wasmArtifact.bytes.byteLength));
    } catch (t) {
      throw e?.fill(0), t instanceof c ? t : this.host.error("init-failed", "Inline codec initialization failed.", void 0, t, !0);
    }
  }
  clearArtifacts() {
    const e = (this.workerArtifact?.bytes.byteLength ?? 0) + (this.wasmArtifact?.bytes.byteLength ?? 0);
    this.workerArtifact?.bytes.fill(0), this.wasmArtifact?.bytes.fill(0), this.workerArtifact = void 0, this.wasmArtifact = void 0, this.metrics.add("artifactBytes", -e);
  }
}
function me(i) {
  return typeof i == "object" && i !== null && !Array.isArray(i);
}
function T(i, e) {
  const t = Object.keys(i).sort(), s = [...e].sort();
  return t.length === s.length && t.every((r, o) => r === s[o]);
}
function we(i) {
  if (!(!me(i) || i.protocol !== I || typeof i.type != "string")) {
    if (i.type === "ready")
      return T(i, ["protocol", "type", "codecId", "implementationVersion"]) && typeof i.codecId == "string" && typeof i.implementationVersion == "string" ? i : void 0;
    if (i.type === "result")
      return T(i, ["protocol", "type", "jobId", "implementationVersion", "output"]) && typeof i.jobId == "string" && typeof i.implementationVersion == "string" && Array.isArray(i.output) && i.output.every((e) => e instanceof ArrayBuffer) ? i : void 0;
    if (i.type === "error")
      return T(i, ["protocol", "type", "jobId", "code", "message"]) && typeof i.jobId == "string" && typeof i.code == "string" && /^[a-z0-9.-]{1,64}$/.test(i.code) && typeof i.message == "string" && i.message.length <= 256 ? i : void 0;
  }
}
class pe {
  constructor(e, t, s, r, o, d) {
    n(this, "options");
    n(this, "maxWorkers");
    n(this, "initializationTimeoutMs");
    n(this, "metrics");
    n(this, "host");
    n(this, "signal");
    n(this, "workers", /* @__PURE__ */ new Set());
    n(this, "spawning", !1);
    n(this, "workerArtifact");
    n(this, "wasmArtifact");
    this.options = e, this.maxWorkers = t, this.initializationTimeoutMs = s, this.metrics = r, this.host = o, this.signal = d;
  }
  configure(e, t) {
    this.workerArtifact = e, this.wasmArtifact = t;
  }
  get canProgress() {
    return [...this.workers].some((e) => e.state === "idle") || !this.spawning && this.workers.size < this.maxWorkers;
  }
  pump() {
    if (this.host.active) {
      for (const e of this.workers) {
        if (e.state !== "idle") continue;
        const t = this.host.takeQueuedJob();
        if (!t) break;
        this.start(e, t);
      }
      this.host.hasQueuedJobs() && this.workers.size < this.maxWorkers && !this.spawning && (this.spawning = !0, this.spawn().then(
        () => {
          this.spawning = !1, this.host.requestPump();
        },
        (e) => {
          if (this.spawning = !1, !this.host.active) return;
          this.metrics.increment("initializationFailures");
          const t = e instanceof c ? e : this.host.error("init-failed", "Codec worker initialization failed.", void 0, e, !0);
          this.host.spawnFailed(t, this.workers.size > 0);
        }
      ));
    }
  }
  cancel(e) {
    const t = [...this.workers].find((s) => s.job === e);
    if (t) {
      try {
        t.transport.postMessage({ protocol: I, type: "cancel", jobId: e.id }, []);
      } catch {
      }
      t.job = void 0, this.close(t).finally(() => this.host.requestPump());
    }
  }
  releaseIfUnused() {
    if (!this.host.hasQueuedJobs())
      for (const e of [...this.workers])
        e.state !== "running" && this.close(e);
  }
  async destroy() {
    await Promise.allSettled([...this.workers].map((e) => this.close(e))), this.workers.clear();
  }
  async spawn() {
    const e = this.workerArtifact, t = this.options.platform.workers;
    if (!e || !t || !this.host.active) throw this.host.error("init-failed", "Verified worker artifact is unavailable.");
    let s;
    try {
      s = await t.create(e, this.signal);
    } catch (a) {
      throw this.host.error("init-failed", "Codec worker could not be created.", void 0, a, !0);
    }
    if (!this.host.active) {
      try {
        await s.terminate();
      } catch {
      }
      throw this.host.error("destroyed", "Codec runtime was destroyed during worker creation.");
    }
    let r;
    const o = (a) => this.onMessage(r, a), d = (a) => this.onCrash(r, a);
    r = { transport: s, onMessage: o, onError: d, state: "initializing", listenerCount: 0, wasmTracked: !1 }, this.workers.add(r), this.metrics.add("workers", 1);
    try {
      s.addMessageListener(o), r.listenerCount += 1, this.metrics.add("listeners", 1), s.addErrorListener(d), r.listenerCount += 1, this.metrics.add("listeners", 1);
    } catch (a) {
      throw await this.close(r), this.host.error("init-failed", "Codec worker listeners could not be installed.", void 0, a, !0);
    }
    this.wasmArtifact && (r.wasmTracked = !0, this.metrics.add("wasmAllocations", 1), this.metrics.add("wasmBytes", this.wasmArtifact.bytes.byteLength));
    const f = new Promise((a, h) => {
      r.readyResolve = a, r.readyReject = h, r.readyTimeout = this.options.platform.schedule.schedule(
        () => h(this.host.error("timeout", "Codec worker initialization timed out.", void 0, void 0, !0)),
        this.initializationTimeoutMs
      );
    }), u = this.wasmArtifact?.bytes.slice().buffer;
    try {
      s.postMessage({
        protocol: I,
        type: "initialize",
        codecId: this.options.implementation.id,
        implementationVersion: this.options.implementation.implementationVersion,
        workerArtifactSha256: e.descriptor.sha256,
        ...u ? { wasm: u } : {}
      }, u ? [u] : []), await f;
    } catch (a) {
      throw await this.close(r), a;
    } finally {
      r.readyTimeout !== void 0 && this.options.platform.schedule.cancel(r.readyTimeout), r.readyTimeout = void 0, r.readyResolve = void 0, r.readyReject = void 0;
    }
    if (!this.host.active)
      throw await this.close(r), this.host.error("destroyed", "Codec runtime was destroyed during worker initialization.");
    r.state = "idle";
  }
  onMessage(e, t) {
    if (e.state === "closed") return;
    const s = we(t);
    if (!s) {
      this.onCrash(e, this.host.error("worker-protocol", "Codec worker sent an invalid protocol message."));
      return;
    }
    if (e.state === "initializing") {
      s.type !== "ready" || s.codecId !== this.options.implementation.id || s.implementationVersion !== this.options.implementation.implementationVersion ? e.readyReject?.(this.host.error(
        "implementation-version-mismatch",
        "Codec worker identity or implementation version does not match its runtime descriptor."
      )) : e.readyResolve?.();
      return;
    }
    const r = e.job;
    if (!r || e.state !== "running" || !("jobId" in s) || s.jobId !== r.id) {
      this.onCrash(e, this.host.error("worker-protocol", "Codec worker response does not match its active job."));
      return;
    }
    if (s.type === "error") {
      this.host.failJob(r, this.host.error("execution-failed", "Codec worker reported an execution failure.", r.id)), this.idle(e);
      return;
    }
    if (s.type !== "result" || s.implementationVersion !== this.options.implementation.implementationVersion || !Array.isArray(s.output)) {
      this.onCrash(e, this.host.error("worker-protocol", "Codec worker result is malformed or version-mismatched.", r.id));
      return;
    }
    try {
      j(s.output, r.maxOutputBytes), this.host.succeedJob(r, v.take(s.output)), this.idle(e);
    } catch (o) {
      this.host.failJob(r, o instanceof c ? o : this.host.error("worker-protocol", "Codec worker output is invalid.", r.id, o)), this.idle(e);
    }
  }
  onCrash(e, t) {
    if (e.state !== "closed") {
      if (this.metrics.increment("workerCrashes"), e.state === "initializing") {
        e.readyReject?.(t instanceof c ? t : this.host.error("worker-crashed", "Codec worker crashed during initialization.", void 0, t, !0));
        return;
      }
      e.job && this.host.failJob(e.job, t instanceof c ? t : this.host.error("worker-crashed", "Codec worker crashed while executing a job.", e.job.id, t, !0)), e.job = void 0, this.close(e).finally(() => this.host.requestPump());
    }
  }
  start(e, t) {
    if (!(!this.host.active || e.state !== "idle" || t.state !== "queued")) {
      t.state = "running-worker", e.state = "running", e.job = t, this.host.startJob(t);
      try {
        const s = t.input.move();
        e.transport.postMessage({
          protocol: I,
          type: "execute",
          jobId: t.id,
          implementationVersion: this.options.implementation.implementationVersion,
          operation: t.operation,
          input: s,
          metadata: t.metadata,
          maxOutputBytes: t.maxOutputBytes
        }, s);
      } catch (s) {
        this.onCrash(e, s);
      }
    }
  }
  idle(e) {
    e.job = void 0, e.state = "idle", this.host.requestPump();
  }
  async close(e) {
    if (e.state !== "closed") {
      e.state === "initializing" && e.readyReject?.(this.host.error("cancelled", "Codec worker initialization no longer has an owning job.")), e.state = "closed", this.workers.delete(e), e.readyTimeout !== void 0 && this.options.platform.schedule.cancel(e.readyTimeout);
      try {
        e.transport.removeMessageListener(e.onMessage);
      } catch {
      }
      try {
        e.transport.removeErrorListener(e.onError);
      } catch {
      }
      this.metrics.add("listeners", -e.listenerCount), e.listenerCount = 0, this.metrics.add("workers", -1), e.wasmTracked && this.wasmArtifact && (e.wasmTracked = !1, this.metrics.add("wasmAllocations", -1), this.metrics.add("wasmBytes", -this.wasmArtifact.bytes.byteLength));
      try {
        await e.transport.terminate();
      } catch {
      }
    }
  }
}
class be {
  constructor(e) {
    n(this, "sourceOptions");
    n(this, "options");
    n(this, "metricsValue", new ae());
    n(this, "cancellation", new $());
    n(this, "queued", []);
    n(this, "jobs", /* @__PURE__ */ new Map());
    n(this, "leases", /* @__PURE__ */ new Set());
    n(this, "inlineJobs", /* @__PURE__ */ new Set());
    n(this, "workerPool");
    n(this, "initializer");
    n(this, "state", "active");
    n(this, "nextJob", 1);
    n(this, "pumping", !1);
    n(this, "activeInline", 0);
    n(this, "destroyPromise");
    this.sourceOptions = de(e), ne(this.sourceOptions.implementation), this.options = ce(this.sourceOptions), this.options.mode === "worker" && (this.workerPool = new pe(
      this.sourceOptions,
      this.options.maxWorkers,
      this.options.initializationTimeoutMs,
      this.metricsValue,
      this,
      this.cancellation.signal
    )), this.initializer = new he(
      this.sourceOptions,
      this.options,
      this.cancellation,
      this.metricsValue,
      this,
      this.workerPool
    );
  }
  get mode() {
    return this.options.mode;
  }
  get destroyed() {
    return this.state === "destroyed";
  }
  get active() {
    return this.state === "active";
  }
  metrics() {
    return this.metricsValue.snapshot();
  }
  /** Takes ownership of request.input whether the request starts, joins, or fails validation. */
  execute(e) {
    let t;
    try {
      le(e, this.options.maxInputBytes, this.sourceOptions.implementation.id), t = fe(e.metadata);
    } catch (u) {
      return e.input.dispose(), Promise.reject(u);
    }
    if (!this.active)
      return e.input.dispose(), Promise.reject(this.error("destroyed", "Codec runtime has been destroyed."));
    if (e.signal?.aborted)
      return e.input.dispose(), Promise.reject(this.error("cancelled", "Codec job consumer was already cancelled.", void 0, e.signal.reason));
    const s = Math.min(e.maxOutputBytes ?? this.options.maxOutputBytes, this.options.maxOutputBytes), r = Math.min(e.timeoutMs ?? this.options.defaultTimeoutMs, this.options.defaultTimeoutMs), o = this.jobs.get(e.key);
    if (o && o.state !== "settled")
      return ue(o, e, t, s, r) ? (e.input.dispose(), this.metricsValue.increment("inflightJoins"), this.addWaiter(o, e.signal)) : (e.input.dispose(), Promise.reject(this.error("invalid-config", "Codec shared job key collided with different normalized work.")));
    if (this.queued.length >= this.options.maxQueuedJobs)
      return e.input.dispose(), Promise.reject(this.error("queue-full", "Codec job queue is full.", void 0, void 0, !0));
    const d = this.createJob(e, t, s, r);
    this.jobs.set(d.key, d), this.queued.push(d), this.metricsValue.add("pendingJobs", 1), this.metricsValue.add("queuedJobs", 1), this.metricsValue.add("ownedInputBytes", d.inputByteLength);
    const f = this.addWaiter(d, e.signal);
    return this.requestPump(), f;
  }
  destroy() {
    return this.destroyPromise ? this.destroyPromise : (this.destroyPromise = this.destroyInternal(), this.destroyPromise);
  }
  release(e, t) {
    this.leases.delete(e) && this.metricsValue.add("ownedOutputBytes", -t);
  }
  takeQueuedJob() {
    const e = this.queued.shift();
    return e && this.metricsValue.add("queuedJobs", -1), e;
  }
  hasQueuedJobs() {
    return this.queued.length > 0;
  }
  startJob(e) {
    this.metricsValue.add("runningJobs", 1), this.metricsValue.increment("jobsStarted"), this.armTimeout(e);
  }
  requestPump() {
    this.pumping || !this.active || this.queued.length === 0 || (this.pumping = !0, this.pump().finally(() => {
      this.pumping = !1;
      const e = this.options.mode === "inline" ? this.activeInline < this.options.maxWorkers : this.workerPool.canProgress;
      this.active && this.queued.length > 0 && e && this.requestPump();
    }));
  }
  spawnFailed(e, t) {
    t ? this.requestPump() : (this.initializer.reset(), this.failQueued(e));
  }
  succeedJob(e, t) {
    if (e.state === "settled") {
      t.dispose();
      return;
    }
    const s = [...e.waiters].filter((r) => r.active);
    for (let r = 0; r < s.length; r += 1) {
      const o = s[r];
      if (!this.finishWaiter(e, o)) continue;
      const d = r === s.length - 1 ? t : t.clone(), f = new te(
        this.sourceOptions.implementation.id,
        this.sourceOptions.implementation.implementationVersion,
        e.id,
        d,
        this
      );
      this.leases.add(f), this.metricsValue.add("ownedOutputBytes", d.byteLength), o.resolve(f);
    }
    s.length === 0 && t.dispose(), this.metricsValue.increment("jobsCompleted"), this.settleJob(e);
  }
  failJob(e, t) {
    if (e.state !== "settled") {
      for (const s of [...e.waiters])
        this.finishWaiter(e, s) && s.reject(t);
      t.code === "timeout" ? this.metricsValue.increment("jobsTimedOut") : t.code !== "cancelled" && t.code !== "destroyed" && this.metricsValue.increment("jobsFailed"), this.settleJob(e);
    }
  }
  error(e, t, s, r, o = !1) {
    return new c(e, t, {
      codecId: this.sourceOptions.implementation.id,
      ...s ? { jobId: s } : {},
      ...r !== void 0 ? { cause: r } : {},
      retryable: o
    });
  }
  createJob(e, t, s, r) {
    return {
      id: `${this.sourceOptions.implementation.id}:${this.nextJob++}`,
      key: e.key,
      operation: e.operation,
      metadata: t,
      input: e.input,
      inputByteLength: e.input.byteLength,
      maxOutputBytes: s,
      timeoutMs: r,
      cancellation: new $(),
      waiters: /* @__PURE__ */ new Set(),
      state: "queued"
    };
  }
  addWaiter(e, t) {
    return new Promise((s, r) => {
      const o = { resolve: s, reject: r, signal: t, active: !0 };
      if (e.waiters.add(o), t) {
        const d = () => this.abortWaiter(e, o, t.reason);
        Object.assign(o, { onAbort: d }), this.metricsValue.add("listeners", 1), t.addEventListener("abort", d, { once: !0 });
      }
    });
  }
  abortWaiter(e, t, s) {
    this.finishWaiter(e, t) && (this.metricsValue.increment("jobsCancelled"), t.reject(this.error("cancelled", "Codec job consumer was cancelled.", e.id, s)), [...e.waiters].every((r) => !r.active) && this.cancelUnobserved(e, s));
  }
  finishWaiter(e, t) {
    return t.active ? (t.active = !1, e.waiters.delete(t), t.signal && t.onAbort && (t.signal.removeEventListener("abort", t.onAbort), this.metricsValue.add("listeners", -1)), !0) : !1;
  }
  cancelUnobserved(e, t) {
    e.state !== "settled" && (e.cancellation.abort(t), e.state === "queued" ? (this.removeQueued(e), this.settleJob(e), this.workerPool?.releaseIfUnused()) : e.state === "running-worker" && (this.settleJob(e), this.workerPool?.cancel(e)));
  }
  async pump() {
    try {
      await this.initializer.ensure();
    } catch (e) {
      this.failQueued(e instanceof c ? e : this.error("init-failed", "Codec runtime initialization failed.", void 0, e, !0));
      return;
    }
    if (this.active)
      if (this.options.mode === "worker") this.workerPool.pump();
      else
        for (; this.activeInline < this.options.maxWorkers; ) {
          const e = this.takeQueuedJob();
          if (!e) break;
          this.startInline(e);
        }
  }
  startInline(e) {
    const t = this.initializer.inlineSession;
    if (!this.active || e.state !== "queued" || !t) return;
    e.state = "running-inline", this.inlineJobs.add(e), this.activeInline += 1, this.startJob(e);
    const s = e.input.move(), r = {
      jobId: e.id,
      operation: e.operation,
      input: s,
      metadata: e.metadata,
      maxOutputBytes: e.maxOutputBytes,
      signal: e.cancellation.signal
    };
    Promise.resolve().then(() => t.execute(r)).then(
      (o) => this.acceptInlineOutput(e, o),
      (o) => {
        e.state === "running-inline" && this.failJob(e, e.cancellation.signal.aborted ? this.error("cancelled", "Inline codec execution was cancelled.", e.id, e.cancellation.signal.reason) : this.error("execution-failed", "Inline codec execution failed.", e.id, o, !0));
      }
    ).finally(() => {
      this.inlineJobs.delete(e) && (this.activeInline = Math.max(0, this.activeInline - 1)), this.requestPump();
    });
  }
  acceptInlineOutput(e, t) {
    if (e.state !== "running-inline") {
      for (const s of t) s instanceof ArrayBuffer && s.byteLength > 0 && new Uint8Array(s).fill(0);
      return;
    }
    try {
      j(t, e.maxOutputBytes), this.succeedJob(e, v.take(t));
    } catch (s) {
      this.failJob(e, s instanceof c ? s : this.error("execution-failed", "Inline codec output is invalid.", e.id, s));
    }
  }
  armTimeout(e) {
    e.timeoutHandle = this.sourceOptions.platform.schedule.schedule(() => {
      if (e.state === "settled") return;
      const t = e.state === "running-worker", s = this.error("timeout", "Codec job timed out.", e.id, void 0, !0);
      e.cancellation.abort(s), this.failJob(e, s), t && this.workerPool?.cancel(e);
    }, e.timeoutMs);
  }
  settleJob(e) {
    if (e.state === "settled") return;
    const t = e.state === "queued", s = e.state === "running-worker" || e.state === "running-inline";
    e.state = "settled", e.timeoutHandle !== void 0 && this.sourceOptions.platform.schedule.cancel(e.timeoutHandle), e.timeoutHandle = void 0, t && this.metricsValue.add("queuedJobs", -1), s && this.metricsValue.add("runningJobs", -1), this.metricsValue.add("pendingJobs", -1), this.metricsValue.add("ownedInputBytes", -e.inputByteLength), e.input.dispose(), this.jobs.get(e.key) === e && this.jobs.delete(e.key);
  }
  removeQueued(e) {
    const t = this.queued.indexOf(e);
    t >= 0 && this.queued.splice(t, 1);
  }
  failQueued(e) {
    for (const t of this.queued.splice(0)) this.failJob(t, e);
  }
  async destroyInternal() {
    if (this.state !== "destroyed") {
      this.state = "destroying", this.cancellation.abort(this.error("destroyed", "Codec runtime is being destroyed."));
      for (const e of [...this.jobs.values()])
        e.cancellation.abort(this.cancellation.signal.reason), this.removeQueued(e), this.failJob(e, this.error("destroyed", "Codec runtime was destroyed while work was pending.", e.id));
      await this.workerPool?.destroy(), await this.initializer.destroy();
      for (const e of [...this.leases]) e.release();
      this.queued.length = 0, this.jobs.clear(), this.inlineJobs.clear(), this.activeInline = 0, this.metricsValue.zeroGauges(), this.state = "destroyed";
    }
  }
}
class m extends Error {
  constructor(t, s, r, o = {}) {
    super(`Meshopt ${s}: ${r}`);
    n(this, "code");
    n(this, "phase");
    n(this, "formatCode");
    n(this, "cause");
    this.code = t, this.phase = s, this.name = "MeshoptFormatError", this.formatCode = `meshopt.${t}`, this.cause = o.cause;
  }
}
class ye {
  constructor(e) {
    n(this, "buffer");
    n(this, "active", !0);
    this.buffer = e;
  }
  get byteLength() {
    return this.active ? this.buffer.byteLength : 0;
  }
  copyBytes() {
    return this.assertActive(), new Uint8Array(this.buffer.slice(0));
  }
  takeBuffer() {
    this.assertActive();
    const e = this.buffer;
    return this.buffer = new ArrayBuffer(0), this.active = !1, e;
  }
  dispose() {
    this.active && (new Uint8Array(this.buffer).fill(0), this.buffer = new ArrayBuffer(0), this.active = !1);
  }
  assertActive() {
    if (!this.active) throw new m("disposed", "lifecycle", "decoded view is disposed");
  }
}
const b = "EXT_meshopt_compression", ge = "1.0.0", C = "1.1.1-forgeng.1", V = Object.freeze({
  maxCompressedViewBytes: 64 * 1024 * 1024,
  maxDecodedViewBytes: 256 * 1024 * 1024,
  maxTotalDecodedBytes: 256 * 1024 * 1024,
  maxExpansionRatio: 512
});
function W(i = {}) {
  const e = { ...V, ...i };
  for (const [t, s] of Object.entries(e))
    if (!Number.isSafeInteger(s) || s < 1) throw new RangeError(`Meshopt limit ${t} must be a positive safe integer.`);
  return Object.freeze(e);
}
const ve = /* @__PURE__ */ new Set(["ATTRIBUTES", "TRIANGLES", "INDICES"]), ke = /* @__PURE__ */ new Set(["NONE", "OCTAHEDRAL", "QUATERNION", "EXPONENTIAL"]);
function Oe(i) {
  let e = 2166136261, t = 2654435769;
  for (const s of i)
    e = Math.imul(e ^ s, 16777619) >>> 0, t = Math.imul(t ^ s + 1, 2246822507) >>> 0;
  return `${e.toString(16).padStart(8, "0")}${t.toString(16).padStart(8, "0")}:${i.byteLength}`;
}
function Le(i) {
  const e = W(i.limits);
  if (!(i.source instanceof Uint8Array) || i.source.byteLength < 1)
    throw new m("invalid-schema", "selection", "source must contain compressed bytes");
  if (!Number.isSafeInteger(i.count) || i.count < 1 || !Number.isSafeInteger(i.byteStride) || i.byteStride < 1 || !ve.has(i.mode))
    throw new m("invalid-schema", "selection", "count, byteStride, or mode is invalid");
  const t = i.filter ?? "NONE";
  if (!ke.has(t)) throw new m("invalid-schema", "selection", "filter is invalid");
  if (i.byteStride > 256) throw new m("invalid-schema", "selection", "byteStride exceeds 256");
  if (i.mode === "ATTRIBUTES") {
    if (i.byteStride % 4 !== 0 || t === "OCTAHEDRAL" && i.byteStride !== 4 && i.byteStride !== 8 || t === "QUATERNION" && i.byteStride !== 8)
      throw new m("invalid-schema", "selection", "ATTRIBUTES stride/filter combination is invalid");
  } else if (t !== "NONE" || i.byteStride !== 2 && i.byteStride !== 4 || i.mode === "TRIANGLES" && i.count % 3 !== 0)
    throw new m("invalid-schema", "selection", `${i.mode} layout is invalid`);
  const s = i.count * i.byteStride;
  if (!Number.isSafeInteger(s)) throw new m("limit-exceeded", "selection", "output size overflows");
  if (i.source.byteLength > e.maxCompressedViewBytes || s > e.maxDecodedViewBytes || s > i.source.byteLength * e.maxExpansionRatio)
    throw new m("limit-exceeded", "selection", "decode exceeds configured limits");
  return { outputBytes: s, filter: t };
}
function xe(i) {
  return i instanceof m ? i : i instanceof c && i.code === "cancelled" ? new m("cancelled", "decode", "decode was cancelled", { cause: i }) : new m("decode-failed", "decode", "meshoptimizer execution failed", { cause: i });
}
class Ie {
  constructor(e) {
    n(this, "runtime");
    this.runtime = e;
  }
  metrics() {
    return this.runtime.metrics();
  }
  async decodeView(e) {
    const { outputBytes: t, filter: s } = Le(e), r = e.source.slice(), o = e.cacheKey ?? Oe(r);
    let d;
    try {
      d = await this.runtime.execute({
        key: `${o}|${e.count}|${e.byteStride}|${e.mode}|${s}`,
        operation: "meshopt.decode",
        input: v.take([r.buffer]),
        metadata: Object.freeze({
          count: e.count,
          byteStride: e.byteStride,
          mode: e.mode,
          filter: s
        }),
        signal: e.signal,
        maxOutputBytes: t
      });
      const f = d.takeBuffers();
      if (f.length !== 1 || f[0].byteLength !== t) {
        for (const u of f) new Uint8Array(u).fill(0);
        throw new m("decode-failed", "decode", "decoder returned an invalid output layout");
      }
      return new ye(f[0]);
    } catch (f) {
      throw d?.release(), xe(f);
    }
  }
  destroy() {
    return this.runtime.destroy();
  }
}
const Ae = "forgeng.codec.meshoptimizer", Te = `artifacts/${C}`, Se = Object.freeze({
  worker: Object.freeze({
    kind: "worker",
    uri: `${Te}/meshopt-worker.mjs`,
    sha256: "7a95f3f7476461c1143e264315d4c1aeb04abd9d9e1d4211c9946c46d22a2163",
    byteLength: 30621,
    implementationVersion: C
  })
});
function Ve(i, e = {}) {
  const t = e.artifacts ?? Se;
  return new Ie(new be({
    implementation: Object.freeze({
      id: Ae,
      implementationVersion: C,
      worker: t.worker
    }),
    platform: i,
    mode: "worker",
    maxWorkers: e.maxWorkers ?? 2,
    maxQueuedJobs: e.maxQueuedJobs ?? 64,
    maxInputBytes: V.maxCompressedViewBytes,
    maxOutputBytes: V.maxDecodedViewBytes,
    defaultTimeoutMs: e.defaultTimeoutMs ?? 3e4,
    initializationTimeoutMs: e.initializationTimeoutMs ?? 15e3
  }));
}
class Ce extends Error {
  constructor(t, s, r, o = `gltf.${t}`, d) {
    super(`glTF ${s}: ${r}`, d);
    n(this, "code");
    n(this, "phase");
    n(this, "formatCode");
    this.code = t, this.phase = s, this.formatCode = o;
  }
  get name() {
    return "GLTFLoadError";
  }
}
const Be = /* @__PURE__ */ new Set(["ATTRIBUTES", "TRIANGLES", "INDICES"]), Ee = /* @__PURE__ */ new Set(["NONE", "OCTAHEDRAL", "QUATERNION", "EXPONENTIAL"]), ze = /* @__PURE__ */ new Set(["buffer", "byteOffset", "byteLength", "byteStride", "count", "mode", "filter"]);
function l(i) {
  throw new m("invalid-schema", "schema", i);
}
function x(i) {
  throw new m("invalid-bounds", "schema", i);
}
function A(i) {
  throw new m("limit-exceeded", "schema", i);
}
function D(i, e) {
  return (!i || typeof i != "object" || Array.isArray(i)) && l(`${e} must be an object`), i;
}
function g(i, e, t = 0) {
  return (!Number.isSafeInteger(i) || i < t) && l(`${e} must be a safe integer >= ${t}`), i;
}
function Me(i, e, t) {
  const s = i * e;
  return Number.isSafeInteger(s) || A(`${t} overflows`), s;
}
function J(i, e, t) {
  const s = i + e;
  return Number.isSafeInteger(s) || A(`${t} overflows`), s;
}
function $e(i, e, t, s, r) {
  if (s > 256 && l(`${r}.byteStride exceeds 256`), i === "ATTRIBUTES") {
    s % 4 !== 0 && l(`${r}.byteStride must be divisible by 4 for ATTRIBUTES`), e === "OCTAHEDRAL" && s !== 4 && s !== 8 && l(`${r}.byteStride must be 4 or 8 for OCTAHEDRAL`), e === "QUATERNION" && s !== 8 && l(`${r}.byteStride must be 8 for QUATERNION`), e === "EXPONENTIAL" && s % 4 !== 0 && l(`${r}.byteStride must be divisible by 4 for EXPONENTIAL`);
    return;
  }
  e !== "NONE" && l(`${r}.filter must be NONE for ${i}`), s !== 2 && s !== 4 && l(`${r}.byteStride must be 2 or 4 for ${i}`), i === "TRIANGLES" && t % 3 !== 0 && l(`${r}.count must be divisible by 3 for TRIANGLES`);
}
function Ne(i, e) {
  const t = `bufferView ${e} ${b}`, s = D(i, t), r = Object.keys(s).find((p) => !ze.has(p));
  r && l(`${t} has unknown field ${r}`);
  const o = ["buffer", "byteLength", "byteStride", "count", "mode"];
  for (const p of o) Object.prototype.hasOwnProperty.call(s, p) || l(`${t}.${p} is required`);
  const d = g(s.buffer, `${t}.buffer`), f = g(s.byteOffset ?? 0, `${t}.byteOffset`), u = g(s.byteLength, `${t}.byteLength`, 1), a = g(s.byteStride, `${t}.byteStride`, 1), h = g(s.count, `${t}.count`, 1);
  (typeof s.mode != "string" || !Be.has(s.mode)) && l(`${t}.mode is invalid`);
  const y = s.mode, w = s.filter ?? "NONE";
  (typeof w != "string" || !Ee.has(w)) && l(`${t}.filter is invalid`);
  const L = w;
  return $e(y, L, h, a, t), Object.freeze({ buffer: d, byteOffset: f, byteLength: u, byteStride: a, count: h, mode: y, filter: L });
}
function Re(i) {
  const e = /* @__PURE__ */ new Set();
  for (const [t, s] of (i.buffers ?? []).entries()) {
    const r = s.extensions?.[b];
    if (r === void 0) continue;
    const o = D(r, `buffer ${t} ${b}`), d = Object.keys(o);
    (d.length !== 1 || d[0] !== "fallback" || o.fallback !== !0) && l(`buffer ${t} ${b} must contain only fallback: true`), e.add(t);
  }
  return e;
}
function Je(i, e, t = {}) {
  const s = W(t), r = i.buffers ?? [], o = i.bufferViews ?? [], d = Re(i), f = [];
  let u = 0;
  e.length < r.length && x("loaded buffer list is incomplete");
  for (const [a, h] of o.entries()) {
    const y = h.extensions?.[b];
    if (y === void 0) {
      d.has(h.buffer) && l(`bufferView ${a} references a fallback buffer without compression metadata`);
      continue;
    }
    const w = Ne(y, a);
    (!r[w.buffer] || !e[w.buffer]) && x(`bufferView ${a} compressed buffer is unavailable`), d.has(w.buffer) && l(`bufferView ${a} compressed source references a fallback buffer`);
    const L = g(h.byteOffset ?? 0, `bufferView ${a}.byteOffset`), p = g(h.byteLength, `bufferView ${a}.byteLength`, 1), B = g(h.buffer, `bufferView ${a}.buffer`), E = r[B];
    E || x(`bufferView ${a} output buffer is unavailable`), Me(w.count, w.byteStride, `bufferView ${a} decoded length`) !== p && l(`bufferView ${a}.byteLength must equal count * byteStride`);
    const z = J(w.byteOffset, w.byteLength, `bufferView ${a} compressed range`);
    (z > r[w.buffer].byteLength || z > e[w.buffer].byteLength) && x(`bufferView ${a} compressed range exceeds source buffer`), J(L, p, `bufferView ${a} output range`) > E.byteLength && x(`bufferView ${a} output range exceeds target buffer`), (w.byteLength > s.maxCompressedViewBytes || p > s.maxDecodedViewBytes || p > w.byteLength * s.maxExpansionRatio) && A(`bufferView ${a} exceeds configured per-view limits`), u += p, (!Number.isSafeInteger(u) || u > s.maxTotalDecodedBytes) && A("total decoded bufferView bytes exceed configured limit"), f.push(Object.freeze({
      ...w,
      viewIndex: a,
      outputBuffer: B,
      outputByteOffset: L,
      outputByteLength: p
    }));
  }
  f.length === 0 && l(`${b} is declared but no compressed bufferView exists`);
  for (const a of d)
    f.some((h) => h.outputBuffer === a) || l(`fallback buffer ${a} is not referenced by a compressed bufferView`);
  return Object.freeze(f);
}
function Pe(i) {
  if (!i) return;
  const e = i;
  return typeof e.addEventListener == "function" && typeof e.removeEventListener == "function" ? i : Object.freeze({
    get aborted() {
      return i.aborted;
    },
    get reason() {
      return i.reason;
    },
    addEventListener: () => {
    },
    removeEventListener: () => {
    }
  });
}
function P(i) {
  if (!i || i[b] === void 0) return i;
  const e = { ...i };
  return delete e[b], Object.keys(e).length ? e : void 0;
}
function Ue(i) {
  const e = JSON.parse(JSON.stringify(i));
  for (const t of e.bufferViews ?? []) t.extensions = P(t.extensions);
  for (const t of e.buffers ?? []) t.extensions = P(t.extensions);
  return e.extensionsUsed = e.extensionsUsed?.filter((t) => t !== b), e.extensionsRequired = e.extensionsRequired?.filter((t) => t !== b), e.extensionsUsed?.length === 0 && delete e.extensionsUsed, e.extensionsRequired?.length === 0 && delete e.extensionsRequired, e;
}
function je(i) {
  return (i.document.buffers ?? []).map((e, t) => {
    const s = new ArrayBuffer(e.byteLength), r = i.buffers[t];
    return r && new Uint8Array(s).set(new Uint8Array(r, 0, Math.min(r.byteLength, s.byteLength))), s;
  });
}
function Fe(i) {
  const e = Object.freeze({ ...i.limits });
  return Object.freeze({
    id: "forgeng.assets.meshopt.gltf",
    implementationVersion: ge,
    extensions: Object.freeze([b]),
    stage: "pre-buffer-validation",
    decode: async (t) => {
      const s = Je(t.document, t.buffers, e), r = i.createDecoder(), o = [];
      let d;
      try {
        const f = Pe(t.signal), u = await Promise.all(s.map(async (a) => {
          const h = new Uint8Array(
            t.buffers[a.buffer],
            a.byteOffset,
            a.byteLength
          ), y = await r.decodeView({
            source: h,
            count: a.count,
            byteStride: a.byteStride,
            mode: a.mode,
            filter: a.filter,
            cacheKey: `${t.sourceUrl}|bufferView:${a.viewIndex}`,
            signal: f,
            limits: e
          });
          return o.push(y), y;
        }));
        d = je(t);
        for (let a = 0; a < s.length; a += 1) {
          const h = s[a];
          new Uint8Array(d[h.outputBuffer], h.outputByteOffset, h.outputByteLength).set(u[a].copyBytes());
        }
        return Object.freeze({ document: Ue(t.document), buffers: Object.freeze(d) });
      } catch (f) {
        for (const u of d ?? []) new Uint8Array(u).fill(0);
        throw f instanceof m || f instanceof Ce ? f : new m("decode-failed", "decode", "EXT_meshopt_compression decode failed", { cause: f });
      } finally {
        for (const f of o) f.dispose();
        await r.destroy();
      }
    }
  });
}
function He(i = {}) {
  return Ve(Y(i.platform), i);
}
export {
  Se as MESHOPT_ARTIFACTS,
  Te as MESHOPT_ARTIFACT_ROOT,
  Ae as MESHOPT_CODEC_ID,
  He as createBrowserMeshoptDecoder,
  Fe as createMeshoptGLTFExtension
};

