var me = Object.defineProperty;
var pe = (t, e, i) => e in t ? me(t, e, { enumerable: !0, configurable: !0, writable: !0, value: i }) : t[e] = i;
var o = (t, e, i) => pe(t, typeof e != "symbol" ? e + "" : e, i);
const j = "forgeng.codec-worker/1";
class d extends Error {
  constructor(i, s, n = {}) {
    super(s);
    o(this, "code");
    o(this, "codecId");
    o(this, "jobId");
    o(this, "retryable");
    o(this, "cause");
    this.name = "CodecRuntimeError", this.code = i, this.codecId = n.codecId, this.jobId = n.jobId, this.retryable = n.retryable ?? !1, this.cause = n.cause;
  }
}
function de(t) {
  const e = typeof document < "u" ? document.baseURI : typeof location < "u" ? location.href : void 0;
  if (!t.baseUrl && !e)
    throw new d("invalid-config", "Browser codec platform requires a baseUrl outside a document.");
  return new URL(t.baseUrl ?? e);
}
function F(t, e) {
  if (/^(?:blob|data):/i.test(t.uri))
    throw new d("invalid-config", "Browser codec artifacts cannot use blob: or data: URLs.");
  const i = de(e), s = new URL(t.uri, i);
  if (s.protocol !== "https:" && s.protocol !== "http:")
    throw new d("invalid-config", "Browser codec artifacts require an HTTP(S) release URL.");
  if (s.username || s.password) throw new d("invalid-config", "Browser codec artifact URLs cannot contain credentials.");
  if (!new Set(e.allowedOrigins ?? [i.origin]).has(s.origin))
    throw new d("invalid-config", "Browser codec artifact origin is not allowed by release policy.");
  return s;
}
async function we(t, e) {
  const i = t.headers.get("content-length");
  if (i !== null && Number(i) !== e)
    throw new d("artifact-size", "Codec release response byte length does not match its descriptor.");
  if (!t.body) {
    const l = new Uint8Array(await t.arrayBuffer());
    if (l.byteLength !== e) throw new d("artifact-size", "Codec release artifact byte length is invalid.");
    return l;
  }
  const s = t.body.getReader(), n = [];
  let r = 0;
  try {
    for (; ; ) {
      const l = await s.read();
      if (l.done) break;
      if (r += l.value.byteLength, r > e)
        throw await s.cancel(), new d("artifact-size", "Codec release artifact exceeded its declared byte length.");
      n.push(l.value);
    }
  } finally {
    s.releaseLock();
  }
  if (r !== e) throw new d("artifact-size", "Codec release artifact byte length is invalid.");
  const a = new Uint8Array(r);
  let c = 0;
  for (const l of n)
    a.set(l, c), c += l.byteLength;
  return a;
}
class be {
  constructor(e) {
    o(this, "options");
    this.options = e;
  }
  async read(e, i) {
    const s = F(e, this.options), n = this.options.fetch ?? globalThis.fetch;
    if (typeof n != "function") throw new d("artifact-read", "Browser fetch is unavailable.");
    const r = new AbortController(), a = () => r.abort(i.reason);
    i.addEventListener("abort", a, { once: !0 });
    try {
      const c = await n(s, {
        cache: "force-cache",
        credentials: s.origin === de(this.options).origin ? "same-origin" : "omit",
        redirect: "error",
        signal: r.signal
      });
      if (!c.ok) throw new d("artifact-read", `Codec release artifact returned HTTP ${c.status}.`);
      if (c.url && F({ ...e, uri: c.url }, this.options).href !== s.href)
        throw new d("artifact-read", "Codec release artifact redirected away from its pinned URL.");
      return await we(c, e.byteLength);
    } finally {
      i.removeEventListener("abort", a);
    }
  }
}
class ye {
  constructor(e) {
    o(this, "implementation");
    this.implementation = e;
  }
  async sha256(e) {
    const i = e.slice().buffer, s = await this.implementation.subtle.digest("SHA-256", i);
    return [...new Uint8Array(s)].map((n) => n.toString(16).padStart(2, "0")).join("");
  }
}
class ge {
  constructor(e) {
    o(this, "worker");
    o(this, "messages", /* @__PURE__ */ new Map());
    o(this, "errors", /* @__PURE__ */ new Map());
    this.worker = e;
  }
  postMessage(e, i) {
    this.worker.postMessage(e, [...i]);
  }
  addMessageListener(e) {
    const i = (s) => e(s.data);
    this.messages.set(e, i), this.worker.addEventListener("message", i);
  }
  removeMessageListener(e) {
    const i = this.messages.get(e);
    i && (this.worker.removeEventListener("message", i), this.messages.delete(e));
  }
  addErrorListener(e) {
    const i = (s) => e(s.error ?? s);
    this.errors.set(e, i), this.worker.addEventListener("error", i);
  }
  removeErrorListener(e) {
    const i = this.errors.get(e);
    i && (this.worker.removeEventListener("error", i), this.errors.delete(e));
  }
  async terminate() {
    this.messages.clear(), this.errors.clear(), this.worker.terminate();
  }
}
class ve {
  constructor(e) {
    o(this, "options");
    this.options = e;
  }
  async create(e, i) {
    if (i.aborted)
      throw new d("cancelled", "Browser codec worker creation was cancelled.", { cause: i.reason });
    if (e.descriptor.kind !== "worker") throw new d("invalid-config", "Worker factory received a non-worker artifact.");
    const s = F(e.descriptor, this.options), n = this.options.createWorker ?? ((r, a) => new Worker(r, a));
    return new ge(n(s, {
      type: "module",
      name: `forgeng-codec-${e.descriptor.implementationVersion}`
    }));
  }
}
const xe = Object.freeze({
  now: () => performance.now(),
  schedule: (t, e) => globalThis.setTimeout(t, e),
  cancel: (t) => globalThis.clearTimeout(t)
});
function ke(t = {}) {
  const e = t.crypto ?? globalThis.crypto;
  if (!e?.subtle) throw new d("invalid-config", "Browser Web Crypto SHA-256 is unavailable.");
  return Object.freeze({
    artifacts: new be(t),
    digest: new ye(e),
    schedule: xe,
    workers: new ve(t)
  });
}
const ne = Object.freeze({ type: "abort" });
class Ce {
  constructor() {
    o(this, "listeners", /* @__PURE__ */ new Map());
    o(this, "abortedValue", !1);
    o(this, "reasonValue");
  }
  get aborted() {
    return this.abortedValue;
  }
  get reason() {
    return this.reasonValue;
  }
  addEventListener(e, i, s) {
    if (e === "abort") {
      if (this.abortedValue) {
        i(ne);
        return;
      }
      this.listeners.set(i, s?.once === !0);
    }
  }
  removeEventListener(e, i) {
    e === "abort" && this.listeners.delete(i);
  }
  abort(e) {
    if (!this.abortedValue) {
      this.abortedValue = !0, this.reasonValue = e;
      for (const [i] of this.listeners)
        try {
          i(ne);
        } catch {
        }
      this.listeners.clear();
    }
  }
}
class re {
  constructor() {
    o(this, "inner", new Ce());
  }
  get signal() {
    return this.inner;
  }
  abort(e) {
    this.inner.abort(e);
  }
}
function Oe(t) {
  if (t instanceof ArrayBuffer) return t.slice(0);
  const e = new Uint8Array(t.byteLength);
  return e.set(new Uint8Array(t.buffer, t.byteOffset, t.byteLength)), e.buffer;
}
class C {
  constructor(e, i) {
    o(this, "buffers");
    o(this, "stateValue", "owned");
    o(this, "byteLengthValue");
    o(this, "expectedLengths");
    this.buffers = e.map((s) => i ? s.slice(0) : s), this.expectedLengths = this.buffers.map((s) => s.byteLength), this.byteLengthValue = this.buffers.reduce((s, n) => s + n.byteLength, 0);
  }
  static copyOf(e) {
    return new C(e.map(Oe), !1);
  }
  /** Takes exclusive ownership. Callers must not retain or reuse the supplied buffers. */
  static take(e) {
    return new C(e, !1);
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
    return this.assertOwned("clone"), new C(this.buffers, !0);
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
      throw new d(
        "ownership-released",
        `Codec buffers cannot ${e} after ownership was ${this.stateValue}.`
      );
    if (this.buffers.some((i, s) => i.byteLength !== this.expectedLengths[s]))
      throw this.buffers = [], this.stateValue = "moved", new d("ownership-released", "Detached codec buffers cannot be reused.");
  }
}
class Ie {
  constructor(e, i, s, n, r) {
    o(this, "codecId");
    o(this, "implementationVersion");
    o(this, "jobId");
    o(this, "owned");
    o(this, "owner");
    o(this, "active", !0);
    this.codecId = e, this.implementationVersion = i, this.jobId = s, this.owned = n, this.owner = r;
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
    const e = this.owned.byteLength, i = this.owned.move();
    return this.active = !1, this.owner.release(this, e), i;
  }
  release() {
    if (!this.active) return;
    const e = this.owned.byteLength;
    this.owned.dispose(), this.active = !1, this.owner.release(this, e);
  }
  assertActive() {
    if (!this.active) throw new d("ownership-released", "Codec result lease was already released.", {
      codecId: this.codecId,
      jobId: this.jobId
    });
  }
}
const Le = /^[a-f0-9]{64}$/, Ae = /^[a-z0-9](?:[a-z0-9._/-]{0,126}[a-z0-9])?$/, ze = /^[0-9]+\.[0-9]+\.[0-9]+(?:[-+][0-9A-Za-z.-]+)?$/;
function oe(t, e) {
  if (t.kind !== "worker" && t.kind !== "wasm")
    throw new d("invalid-config", "Codec artifact kind must be worker or wasm.");
  if (!t.uri || /^(?:blob|data):/i.test(t.uri))
    throw new d("invalid-config", "Codec artifacts require a static release URI; blob: and data: are forbidden.");
  if (!Le.test(t.sha256))
    throw new d("invalid-config", "Codec artifact SHA-256 must be 64 lowercase hexadecimal characters.");
  if (!Number.isSafeInteger(t.byteLength) || t.byteLength < 1)
    throw new d("invalid-config", "Codec artifact byteLength must be a positive safe integer.");
  if (t.implementationVersion !== e)
    throw new d(
      "implementation-version-mismatch",
      "Codec artifact implementation version does not match its runtime descriptor."
    );
}
function Ve(t) {
  if (!Ae.test(t.id)) throw new d("invalid-config", "Codec implementation ID is invalid.");
  if (!ze.test(t.implementationVersion))
    throw new d("invalid-config", "Codec implementation version must be an exact semantic version.");
  t.worker && oe(t.worker, t.implementationVersion), t.wasm && oe(t.wasm, t.implementationVersion);
}
async function ae(t, e, i, s) {
  if (i.aborted)
    throw new d("cancelled", "Codec artifact loading was cancelled.", { codecId: s, cause: i.reason });
  let n;
  try {
    n = await e.artifacts.read(t, i);
  } catch (c) {
    throw c instanceof d ? c : new d("artifact-read", "Codec release artifact could not be read.", { codecId: s, retryable: !0, cause: c });
  }
  if (i.aborted)
    throw n.fill(0), new d("cancelled", "Codec artifact loading was cancelled.", { codecId: s, cause: i.reason });
  if (n.byteLength !== t.byteLength)
    throw n.fill(0), new d("artifact-size", "Codec release artifact byte length does not match its descriptor.", { codecId: s });
  const r = n.slice();
  if (n.fill(0), (await e.digest.sha256(r)).toLowerCase() !== t.sha256)
    throw r.fill(0), new d("integrity-mismatch", "Codec release artifact SHA-256 verification failed.", { codecId: s });
  return Object.freeze({ descriptor: Object.freeze({ ...t }), bytes: r });
}
const Be = Object.freeze({
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
class Te {
  constructor() {
    o(this, "values", { ...Be });
  }
  add(e, i) {
    this.values[e] = Math.max(0, this.values[e] + i);
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
const B = Object.freeze({
  maxWorkers: 2,
  maxQueuedJobs: 64,
  maxInputBytes: 256 * 1024 * 1024,
  maxOutputBytes: 512 * 1024 * 1024,
  defaultTimeoutMs: 3e4,
  initializationTimeoutMs: 1e4
});
function T(t, e, i, s, n) {
  const r = e ?? i;
  if (!Number.isSafeInteger(r) || r < s || r > n)
    throw new d("invalid-config", `${t} must be a safe integer from ${s} through ${n}.`);
  return r;
}
function $e(t) {
  const e = t.mode ?? "auto", i = e === "auto" ? t.implementation.worker && t.platform.workers ? "worker" : "inline" : e;
  if (i === "worker" && (!t.implementation.worker || !t.platform.workers))
    throw new d("invalid-config", "Worker mode requires a worker release artifact and worker factory port.");
  if (i === "inline" && !t.inline)
    throw new d("invalid-config", "Inline mode requires an explicit inline codec factory.");
  return Object.freeze({
    mode: i,
    maxWorkers: T("maxWorkers", t.maxWorkers, B.maxWorkers, 1, 8),
    maxQueuedJobs: T("maxQueuedJobs", t.maxQueuedJobs, B.maxQueuedJobs, 1, 1024),
    maxInputBytes: T("maxInputBytes", t.maxInputBytes, B.maxInputBytes, 1, 1024 * 1024 * 1024),
    maxOutputBytes: T("maxOutputBytes", t.maxOutputBytes, B.maxOutputBytes, 1, 1024 * 1024 * 1024),
    defaultTimeoutMs: T("defaultTimeoutMs", t.defaultTimeoutMs, B.defaultTimeoutMs, 1, 3e5),
    initializationTimeoutMs: T(
      "initializationTimeoutMs",
      t.initializationTimeoutMs,
      B.initializationTimeoutMs,
      1,
      6e4
    )
  });
}
function Se(t) {
  const e = Object.freeze({
    id: t.implementation.id,
    implementationVersion: t.implementation.implementationVersion,
    ...t.implementation.worker ? { worker: Object.freeze({ ...t.implementation.worker }) } : {},
    ...t.implementation.wasm ? { wasm: Object.freeze({ ...t.implementation.wasm }) } : {}
  });
  return Object.freeze({
    implementation: e,
    platform: t.platform,
    ...t.inline ? { inline: t.inline } : {},
    ...t.mode ? { mode: t.mode } : {},
    ...t.maxWorkers !== void 0 ? { maxWorkers: t.maxWorkers } : {},
    ...t.maxQueuedJobs !== void 0 ? { maxQueuedJobs: t.maxQueuedJobs } : {},
    ...t.maxInputBytes !== void 0 ? { maxInputBytes: t.maxInputBytes } : {},
    ...t.maxOutputBytes !== void 0 ? { maxOutputBytes: t.maxOutputBytes } : {},
    ...t.defaultTimeoutMs !== void 0 ? { defaultTimeoutMs: t.defaultTimeoutMs } : {},
    ...t.initializationTimeoutMs !== void 0 ? { initializationTimeoutMs: t.initializationTimeoutMs } : {}
  });
}
function Me(t) {
  if (!t) return Object.freeze({});
  const e = Object.entries(t).sort(([s], [n]) => s.localeCompare(n));
  if (e.length > 64) throw new d("invalid-config", "Codec job metadata is limited to 64 fields.");
  const i = {};
  for (const [s, n] of e) {
    if (!/^[A-Za-z0-9_.-]{1,64}$/.test(s) || typeof n != "string" && typeof n != "number" && typeof n != "boolean" && n !== null || typeof n == "number" && !Number.isFinite(n) || typeof n == "string" && n.length > 1024)
      throw new d("invalid-config", "Codec job metadata is not closed, finite, and bounded.");
    i[s] = n;
  }
  return Object.freeze(i);
}
function Je(t, e, i, s, n) {
  return t.operation === e.operation && t.inputByteLength === e.input.byteLength && t.maxOutputBytes === s && t.timeoutMs === n && JSON.stringify(t.metadata) === JSON.stringify(i);
}
function ue(t, e) {
  let i = 0;
  for (const s of t) {
    if (!(s instanceof ArrayBuffer)) throw new d("worker-protocol", "Codec output contains a non-ArrayBuffer value.");
    if (i += s.byteLength, !Number.isSafeInteger(i) || i > e)
      throw new d("result-too-large", "Codec output exceeds the configured byte limit.");
  }
  return i;
}
function Pe(t, e, i) {
  const s = (n, r) => new d(n, r, { codecId: i });
  if (!(t.input instanceof C) || t.input.state !== "owned")
    throw s("ownership-released", "Codec input must be an exclusively owned, reusable buffer wrapper.");
  if (!t.key || t.key.length > 512) throw s("invalid-config", "Codec job key must contain 1 through 512 characters.");
  if (!/^[A-Za-z0-9_.:/-]{1,128}$/.test(t.operation)) throw s("invalid-config", "Codec job operation is invalid.");
  if (t.input.byteLength > e) throw s("invalid-config", "Codec input exceeds the configured byte limit.");
  if (t.timeoutMs !== void 0 && (!Number.isSafeInteger(t.timeoutMs) || t.timeoutMs < 1))
    throw s("invalid-config", "Codec job timeout must be a positive safe integer.");
  if (t.maxOutputBytes !== void 0 && (!Number.isSafeInteger(t.maxOutputBytes) || t.maxOutputBytes < 1))
    throw s("invalid-config", "Codec output limit must be a positive safe integer.");
}
class Ee {
  constructor(e, i, s, n, r, a) {
    o(this, "source");
    o(this, "options");
    o(this, "cancellation");
    o(this, "metrics");
    o(this, "host");
    o(this, "workerPool");
    o(this, "initialization");
    o(this, "workerArtifact");
    o(this, "wasmArtifact");
    o(this, "inlineSessionValue");
    this.source = e, this.options = i, this.cancellation = s, this.metrics = n, this.host = r, this.workerPool = a;
  }
  get inlineSession() {
    return this.inlineSessionValue;
  }
  ensure() {
    if (this.initialization) return this.initialization;
    this.metrics.increment("initializationAttempts");
    const i = this.initialize().catch((s) => {
      throw this.metrics.increment("initializationFailures"), this.initialization === i && (this.initialization = void 0), this.clearArtifacts(), s;
    });
    return this.initialization = i, i;
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
    const e = this.source.implementation, i = await Promise.all([
      this.options.mode === "worker" && e.worker ? ae(e.worker, this.source.platform, this.cancellation.signal, e.id) : Promise.resolve(void 0),
      e.wasm ? ae(e.wasm, this.source.platform, this.cancellation.signal, e.id) : Promise.resolve(void 0)
    ]);
    if (!this.host.active)
      throw i.forEach((s) => s?.bytes.fill(0)), this.host.error("destroyed", "Codec runtime was destroyed during initialization.");
    this.workerArtifact = i[0], this.wasmArtifact = i[1], this.metrics.add("artifactBytes", (i[0]?.bytes.byteLength ?? 0) + (i[1]?.bytes.byteLength ?? 0)), this.options.mode === "worker" ? this.workerPool.configure(this.workerArtifact, this.wasmArtifact) : await this.initializeInline();
  }
  async initializeInline() {
    const e = this.wasmArtifact?.bytes.slice();
    try {
      const i = await this.source.inline.initialize({
        codecId: this.source.implementation.id,
        implementationVersion: this.source.implementation.implementationVersion,
        ...e ? { wasm: e } : {},
        signal: this.cancellation.signal
      });
      if (e?.fill(0), !this.host.active)
        throw await i.destroy(), this.host.error("destroyed", "Codec runtime was destroyed during inline initialization.");
      this.inlineSessionValue = i, this.wasmArtifact && (this.metrics.add("wasmAllocations", 1), this.metrics.add("wasmBytes", this.wasmArtifact.bytes.byteLength));
    } catch (i) {
      throw e?.fill(0), i instanceof d ? i : this.host.error("init-failed", "Inline codec initialization failed.", void 0, i, !0);
    }
  }
  clearArtifacts() {
    const e = (this.workerArtifact?.bytes.byteLength ?? 0) + (this.wasmArtifact?.bytes.byteLength ?? 0);
    this.workerArtifact?.bytes.fill(0), this.wasmArtifact?.bytes.fill(0), this.workerArtifact = void 0, this.wasmArtifact = void 0, this.metrics.add("artifactBytes", -e);
  }
}
function Re(t) {
  return typeof t == "object" && t !== null && !Array.isArray(t);
}
function W(t, e) {
  const i = Object.keys(t).sort(), s = [...e].sort();
  return i.length === s.length && i.every((n, r) => n === s[r]);
}
function je(t) {
  if (!(!Re(t) || t.protocol !== j || typeof t.type != "string")) {
    if (t.type === "ready")
      return W(t, ["protocol", "type", "codecId", "implementationVersion"]) && typeof t.codecId == "string" && typeof t.implementationVersion == "string" ? t : void 0;
    if (t.type === "result")
      return W(t, ["protocol", "type", "jobId", "implementationVersion", "output"]) && typeof t.jobId == "string" && typeof t.implementationVersion == "string" && Array.isArray(t.output) && t.output.every((e) => e instanceof ArrayBuffer) ? t : void 0;
    if (t.type === "error")
      return W(t, ["protocol", "type", "jobId", "code", "message"]) && typeof t.jobId == "string" && typeof t.code == "string" && /^[a-z0-9.-]{1,64}$/.test(t.code) && typeof t.message == "string" && t.message.length <= 256 ? t : void 0;
  }
}
class De {
  constructor(e, i, s, n, r, a) {
    o(this, "options");
    o(this, "maxWorkers");
    o(this, "initializationTimeoutMs");
    o(this, "metrics");
    o(this, "host");
    o(this, "signal");
    o(this, "workers", /* @__PURE__ */ new Set());
    o(this, "spawning", !1);
    o(this, "workerArtifact");
    o(this, "wasmArtifact");
    this.options = e, this.maxWorkers = i, this.initializationTimeoutMs = s, this.metrics = n, this.host = r, this.signal = a;
  }
  configure(e, i) {
    this.workerArtifact = e, this.wasmArtifact = i;
  }
  get canProgress() {
    return [...this.workers].some((e) => e.state === "idle") || !this.spawning && this.workers.size < this.maxWorkers;
  }
  pump() {
    if (this.host.active) {
      for (const e of this.workers) {
        if (e.state !== "idle") continue;
        const i = this.host.takeQueuedJob();
        if (!i) break;
        this.start(e, i);
      }
      this.host.hasQueuedJobs() && this.workers.size < this.maxWorkers && !this.spawning && (this.spawning = !0, this.spawn().then(
        () => {
          this.spawning = !1, this.host.requestPump();
        },
        (e) => {
          if (this.spawning = !1, !this.host.active) return;
          this.metrics.increment("initializationFailures");
          const i = e instanceof d ? e : this.host.error("init-failed", "Codec worker initialization failed.", void 0, e, !0);
          this.host.spawnFailed(i, this.workers.size > 0);
        }
      ));
    }
  }
  cancel(e) {
    const i = [...this.workers].find((s) => s.job === e);
    if (i) {
      try {
        i.transport.postMessage({ protocol: j, type: "cancel", jobId: e.id }, []);
      } catch {
      }
      i.job = void 0, this.close(i).finally(() => this.host.requestPump());
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
    const e = this.workerArtifact, i = this.options.platform.workers;
    if (!e || !i || !this.host.active) throw this.host.error("init-failed", "Verified worker artifact is unavailable.");
    let s;
    try {
      s = await i.create(e, this.signal);
    } catch (h) {
      throw this.host.error("init-failed", "Codec worker could not be created.", void 0, h, !0);
    }
    if (!this.host.active) {
      try {
        await s.terminate();
      } catch {
      }
      throw this.host.error("destroyed", "Codec runtime was destroyed during worker creation.");
    }
    let n;
    const r = (h) => this.onMessage(n, h), a = (h) => this.onCrash(n, h);
    n = { transport: s, onMessage: r, onError: a, state: "initializing", listenerCount: 0, wasmTracked: !1 }, this.workers.add(n), this.metrics.add("workers", 1);
    try {
      s.addMessageListener(r), n.listenerCount += 1, this.metrics.add("listeners", 1), s.addErrorListener(a), n.listenerCount += 1, this.metrics.add("listeners", 1);
    } catch (h) {
      throw await this.close(n), this.host.error("init-failed", "Codec worker listeners could not be installed.", void 0, h, !0);
    }
    this.wasmArtifact && (n.wasmTracked = !0, this.metrics.add("wasmAllocations", 1), this.metrics.add("wasmBytes", this.wasmArtifact.bytes.byteLength));
    const c = new Promise((h, m) => {
      n.readyResolve = h, n.readyReject = m, n.readyTimeout = this.options.platform.schedule.schedule(
        () => m(this.host.error("timeout", "Codec worker initialization timed out.", void 0, void 0, !0)),
        this.initializationTimeoutMs
      );
    }), l = this.wasmArtifact?.bytes.slice().buffer;
    try {
      s.postMessage({
        protocol: j,
        type: "initialize",
        codecId: this.options.implementation.id,
        implementationVersion: this.options.implementation.implementationVersion,
        workerArtifactSha256: e.descriptor.sha256,
        ...l ? { wasm: l } : {}
      }, l ? [l] : []), await c;
    } catch (h) {
      throw await this.close(n), h;
    } finally {
      n.readyTimeout !== void 0 && this.options.platform.schedule.cancel(n.readyTimeout), n.readyTimeout = void 0, n.readyResolve = void 0, n.readyReject = void 0;
    }
    if (!this.host.active)
      throw await this.close(n), this.host.error("destroyed", "Codec runtime was destroyed during worker initialization.");
    n.state = "idle";
  }
  onMessage(e, i) {
    if (e.state === "closed") return;
    const s = je(i);
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
    const n = e.job;
    if (!n || e.state !== "running" || !("jobId" in s) || s.jobId !== n.id) {
      this.onCrash(e, this.host.error("worker-protocol", "Codec worker response does not match its active job."));
      return;
    }
    if (s.type === "error") {
      this.host.failJob(n, this.host.error("execution-failed", "Codec worker reported an execution failure.", n.id)), this.idle(e);
      return;
    }
    if (s.type !== "result" || s.implementationVersion !== this.options.implementation.implementationVersion || !Array.isArray(s.output)) {
      this.onCrash(e, this.host.error("worker-protocol", "Codec worker result is malformed or version-mismatched.", n.id));
      return;
    }
    try {
      ue(s.output, n.maxOutputBytes), this.host.succeedJob(n, C.take(s.output)), this.idle(e);
    } catch (r) {
      this.host.failJob(n, r instanceof d ? r : this.host.error("worker-protocol", "Codec worker output is invalid.", n.id, r)), this.idle(e);
    }
  }
  onCrash(e, i) {
    if (e.state !== "closed") {
      if (this.metrics.increment("workerCrashes"), e.state === "initializing") {
        e.readyReject?.(i instanceof d ? i : this.host.error("worker-crashed", "Codec worker crashed during initialization.", void 0, i, !0));
        return;
      }
      e.job && this.host.failJob(e.job, i instanceof d ? i : this.host.error("worker-crashed", "Codec worker crashed while executing a job.", e.job.id, i, !0)), e.job = void 0, this.close(e).finally(() => this.host.requestPump());
    }
  }
  start(e, i) {
    if (!(!this.host.active || e.state !== "idle" || i.state !== "queued")) {
      i.state = "running-worker", e.state = "running", e.job = i, this.host.startJob(i);
      try {
        const s = i.input.move();
        e.transport.postMessage({
          protocol: j,
          type: "execute",
          jobId: i.id,
          implementationVersion: this.options.implementation.implementationVersion,
          operation: i.operation,
          input: s,
          metadata: i.metadata,
          maxOutputBytes: i.maxOutputBytes
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
class Ne {
  constructor(e) {
    o(this, "sourceOptions");
    o(this, "options");
    o(this, "metricsValue", new Te());
    o(this, "cancellation", new re());
    o(this, "queued", []);
    o(this, "jobs", /* @__PURE__ */ new Map());
    o(this, "leases", /* @__PURE__ */ new Set());
    o(this, "inlineJobs", /* @__PURE__ */ new Set());
    o(this, "workerPool");
    o(this, "initializer");
    o(this, "state", "active");
    o(this, "nextJob", 1);
    o(this, "pumping", !1);
    o(this, "activeInline", 0);
    o(this, "destroyPromise");
    this.sourceOptions = Se(e), Ve(this.sourceOptions.implementation), this.options = $e(this.sourceOptions), this.options.mode === "worker" && (this.workerPool = new De(
      this.sourceOptions,
      this.options.maxWorkers,
      this.options.initializationTimeoutMs,
      this.metricsValue,
      this,
      this.cancellation.signal
    )), this.initializer = new Ee(
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
    let i;
    try {
      Pe(e, this.options.maxInputBytes, this.sourceOptions.implementation.id), i = Me(e.metadata);
    } catch (l) {
      return e.input.dispose(), Promise.reject(l);
    }
    if (!this.active)
      return e.input.dispose(), Promise.reject(this.error("destroyed", "Codec runtime has been destroyed."));
    if (e.signal?.aborted)
      return e.input.dispose(), Promise.reject(this.error("cancelled", "Codec job consumer was already cancelled.", void 0, e.signal.reason));
    const s = Math.min(e.maxOutputBytes ?? this.options.maxOutputBytes, this.options.maxOutputBytes), n = Math.min(e.timeoutMs ?? this.options.defaultTimeoutMs, this.options.defaultTimeoutMs), r = this.jobs.get(e.key);
    if (r && r.state !== "settled")
      return Je(r, e, i, s, n) ? (e.input.dispose(), this.metricsValue.increment("inflightJoins"), this.addWaiter(r, e.signal)) : (e.input.dispose(), Promise.reject(this.error("invalid-config", "Codec shared job key collided with different normalized work.")));
    if (this.queued.length >= this.options.maxQueuedJobs)
      return e.input.dispose(), Promise.reject(this.error("queue-full", "Codec job queue is full.", void 0, void 0, !0));
    const a = this.createJob(e, i, s, n);
    this.jobs.set(a.key, a), this.queued.push(a), this.metricsValue.add("pendingJobs", 1), this.metricsValue.add("queuedJobs", 1), this.metricsValue.add("ownedInputBytes", a.inputByteLength);
    const c = this.addWaiter(a, e.signal);
    return this.requestPump(), c;
  }
  destroy() {
    return this.destroyPromise ? this.destroyPromise : (this.destroyPromise = this.destroyInternal(), this.destroyPromise);
  }
  release(e, i) {
    this.leases.delete(e) && this.metricsValue.add("ownedOutputBytes", -i);
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
  spawnFailed(e, i) {
    i ? this.requestPump() : (this.initializer.reset(), this.failQueued(e));
  }
  succeedJob(e, i) {
    if (e.state === "settled") {
      i.dispose();
      return;
    }
    const s = [...e.waiters].filter((n) => n.active);
    for (let n = 0; n < s.length; n += 1) {
      const r = s[n];
      if (!this.finishWaiter(e, r)) continue;
      const a = n === s.length - 1 ? i : i.clone(), c = new Ie(
        this.sourceOptions.implementation.id,
        this.sourceOptions.implementation.implementationVersion,
        e.id,
        a,
        this
      );
      this.leases.add(c), this.metricsValue.add("ownedOutputBytes", a.byteLength), r.resolve(c);
    }
    s.length === 0 && i.dispose(), this.metricsValue.increment("jobsCompleted"), this.settleJob(e);
  }
  failJob(e, i) {
    if (e.state !== "settled") {
      for (const s of [...e.waiters])
        this.finishWaiter(e, s) && s.reject(i);
      i.code === "timeout" ? this.metricsValue.increment("jobsTimedOut") : i.code !== "cancelled" && i.code !== "destroyed" && this.metricsValue.increment("jobsFailed"), this.settleJob(e);
    }
  }
  error(e, i, s, n, r = !1) {
    return new d(e, i, {
      codecId: this.sourceOptions.implementation.id,
      ...s ? { jobId: s } : {},
      ...n !== void 0 ? { cause: n } : {},
      retryable: r
    });
  }
  createJob(e, i, s, n) {
    return {
      id: `${this.sourceOptions.implementation.id}:${this.nextJob++}`,
      key: e.key,
      operation: e.operation,
      metadata: i,
      input: e.input,
      inputByteLength: e.input.byteLength,
      maxOutputBytes: s,
      timeoutMs: n,
      cancellation: new re(),
      waiters: /* @__PURE__ */ new Set(),
      state: "queued"
    };
  }
  addWaiter(e, i) {
    return new Promise((s, n) => {
      const r = { resolve: s, reject: n, signal: i, active: !0 };
      if (e.waiters.add(r), i) {
        const a = () => this.abortWaiter(e, r, i.reason);
        Object.assign(r, { onAbort: a }), this.metricsValue.add("listeners", 1), i.addEventListener("abort", a, { once: !0 });
      }
    });
  }
  abortWaiter(e, i, s) {
    this.finishWaiter(e, i) && (this.metricsValue.increment("jobsCancelled"), i.reject(this.error("cancelled", "Codec job consumer was cancelled.", e.id, s)), [...e.waiters].every((n) => !n.active) && this.cancelUnobserved(e, s));
  }
  finishWaiter(e, i) {
    return i.active ? (i.active = !1, e.waiters.delete(i), i.signal && i.onAbort && (i.signal.removeEventListener("abort", i.onAbort), this.metricsValue.add("listeners", -1)), !0) : !1;
  }
  cancelUnobserved(e, i) {
    e.state !== "settled" && (e.cancellation.abort(i), e.state === "queued" ? (this.removeQueued(e), this.settleJob(e), this.workerPool?.releaseIfUnused()) : e.state === "running-worker" && (this.settleJob(e), this.workerPool?.cancel(e)));
  }
  async pump() {
    try {
      await this.initializer.ensure();
    } catch (e) {
      this.failQueued(e instanceof d ? e : this.error("init-failed", "Codec runtime initialization failed.", void 0, e, !0));
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
    const i = this.initializer.inlineSession;
    if (!this.active || e.state !== "queued" || !i) return;
    e.state = "running-inline", this.inlineJobs.add(e), this.activeInline += 1, this.startJob(e);
    const s = e.input.move(), n = {
      jobId: e.id,
      operation: e.operation,
      input: s,
      metadata: e.metadata,
      maxOutputBytes: e.maxOutputBytes,
      signal: e.cancellation.signal
    };
    Promise.resolve().then(() => i.execute(n)).then(
      (r) => this.acceptInlineOutput(e, r),
      (r) => {
        e.state === "running-inline" && this.failJob(e, e.cancellation.signal.aborted ? this.error("cancelled", "Inline codec execution was cancelled.", e.id, e.cancellation.signal.reason) : this.error("execution-failed", "Inline codec execution failed.", e.id, r, !0));
      }
    ).finally(() => {
      this.inlineJobs.delete(e) && (this.activeInline = Math.max(0, this.activeInline - 1)), this.requestPump();
    });
  }
  acceptInlineOutput(e, i) {
    if (e.state !== "running-inline") {
      for (const s of i) s instanceof ArrayBuffer && s.byteLength > 0 && new Uint8Array(s).fill(0);
      return;
    }
    try {
      ue(i, e.maxOutputBytes), this.succeedJob(e, C.take(i));
    } catch (s) {
      this.failJob(e, s instanceof d ? s : this.error("execution-failed", "Inline codec output is invalid.", e.id, s));
    }
  }
  armTimeout(e) {
    e.timeoutHandle = this.sourceOptions.platform.schedule.schedule(() => {
      if (e.state === "settled") return;
      const i = e.state === "running-worker", s = this.error("timeout", "Codec job timed out.", e.id, void 0, !0);
      e.cancellation.abort(s), this.failJob(e, s), i && this.workerPool?.cancel(e);
    }, e.timeoutMs);
  }
  settleJob(e) {
    if (e.state === "settled") return;
    const i = e.state === "queued", s = e.state === "running-worker" || e.state === "running-inline";
    e.state = "settled", e.timeoutHandle !== void 0 && this.sourceOptions.platform.schedule.cancel(e.timeoutHandle), e.timeoutHandle = void 0, i && this.metricsValue.add("queuedJobs", -1), s && this.metricsValue.add("runningJobs", -1), this.metricsValue.add("pendingJobs", -1), this.metricsValue.add("ownedInputBytes", -e.inputByteLength), e.input.dispose(), this.jobs.get(e.key) === e && this.jobs.delete(e.key);
  }
  removeQueued(e) {
    const i = this.queued.indexOf(e);
    i >= 0 && this.queued.splice(i, 1);
  }
  failQueued(e) {
    for (const i of this.queued.splice(0)) this.failJob(i, e);
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
class p extends Error {
  constructor(i, s, n, r = {}) {
    super(`Draco ${s}: ${n}`);
    o(this, "code");
    o(this, "phase");
    o(this, "formatCode");
    o(this, "cause");
    this.code = i, this.phase = s, this.name = "DracoFormatError", this.formatCode = `draco.${i}`, this.cause = r.cause;
  }
}
class Ue {
  constructor(e, i) {
    o(this, "buffers");
    o(this, "attributeCount");
    o(this, "active", !0);
    this.buffers = e, this.attributeCount = i;
  }
  get byteLength() {
    return this.active ? this.buffers.reduce((e, i) => e + i.byteLength, 0) : 0;
  }
  copyBuffers() {
    return this.assertActive(), Object.freeze(this.buffers.map((e) => e.slice(0)));
  }
  takeBuffers() {
    this.assertActive();
    const e = this.buffers;
    return this.buffers = [], this.active = !1, Object.freeze(e);
  }
  dispose() {
    if (this.active) {
      for (const e of this.buffers) new Uint8Array(e).fill(0);
      this.buffers = [], this.active = !1;
    }
  }
  assertActive() {
    if (!this.active) throw new p("disposed", "lifecycle", "decoded primitive is disposed");
  }
}
const x = "KHR_draco_mesh_compression", We = "1.0.0", D = "1.5.7-forgeng.1", H = Object.freeze({
  maxCompressedPrimitiveBytes: 64 * 1024 * 1024,
  maxDecodedPrimitiveBytes: 256 * 1024 * 1024,
  maxTotalDecodedBytes: 256 * 1024 * 1024,
  maxExpansionRatio: 512,
  maxAttributes: 32,
  maxVertices: 5e7,
  maxIndices: 15e7
});
function le(t = {}) {
  const e = { ...H, ...t };
  for (const [i, s] of Object.entries(e))
    if (!Number.isSafeInteger(s) || s < 1) throw new RangeError(`Draco limit ${i} must be a positive safe integer.`);
  return Object.freeze(e);
}
function _e(t) {
  let e = 2166136261, i = 2654435769;
  for (const s of t)
    e = Math.imul(e ^ s, 16777619) >>> 0, i = Math.imul(i ^ s + 1, 2246822507) >>> 0;
  return `${e.toString(16).padStart(8, "0")}${i.toString(16).padStart(8, "0")}:${t.byteLength}`;
}
function Qe(t) {
  let e = 2166136261;
  for (let i = 0; i < t.length; i += 1) e = Math.imul(e ^ t.charCodeAt(i), 16777619) >>> 0;
  return e.toString(16).padStart(8, "0");
}
function Fe(t) {
  const e = le(t.limits);
  if (!(t.source instanceof Uint8Array) || t.source.byteLength < 1)
    throw new p("invalid-schema", "selection", "source must contain compressed bytes");
  if (t.mode !== 4 || !Number.isSafeInteger(t.vertexCount) || t.vertexCount < 1 || !Number.isSafeInteger(t.indexCount) || t.indexCount < 3 || t.indexCount % 3 !== 0 || ![5121, 5123, 5125].includes(t.indexComponentType) || !Array.isArray(t.attributes) || t.attributes.length < 1)
    throw new p("invalid-schema", "selection", "primitive decode layout is invalid");
  if (t.attributes.length > e.maxAttributes || t.vertexCount > e.maxVertices || t.indexCount > e.maxIndices || t.source.byteLength > e.maxCompressedPrimitiveBytes)
    throw new p("limit-exceeded", "selection", "primitive exceeds configured limits");
  let i = t.indexCount * { 5121: 1, 5123: 2, 5125: 4 }[t.indexComponentType];
  const s = /* @__PURE__ */ new Set(), n = /* @__PURE__ */ new Set();
  for (const a of t.attributes) {
    if (!/^[A-Z][A-Z0-9_]*$/.test(a.semantic) || s.has(a.semantic) || !Number.isSafeInteger(a.uniqueId) || a.uniqueId < 0 || n.has(a.uniqueId) || a.count !== t.vertexCount || !Number.isSafeInteger(a.byteLength) || a.byteLength < 1 || ![5120, 5121, 5122, 5123, 5125, 5126].includes(a.componentType) || !["SCALAR", "VEC2", "VEC3", "VEC4"].includes(a.type) || !Number.isSafeInteger(a.componentCount) || a.componentCount < 1 || a.componentCount > 4)
      throw new p("invalid-schema", "selection", "attribute decode layout is invalid");
    if (s.add(a.semantic), n.add(a.uniqueId), i += a.byteLength, !Number.isSafeInteger(i)) throw new p("limit-exceeded", "selection", "output size overflows");
  }
  if (!s.has("POSITION")) throw new p("missing-attribute", "selection", "POSITION mapping is required");
  if (i > e.maxDecodedPrimitiveBytes || i > t.source.byteLength * e.maxExpansionRatio)
    throw new p("limit-exceeded", "selection", "decode exceeds configured output limits");
  const r = JSON.stringify({
    mode: t.mode,
    vertexCount: t.vertexCount,
    indexCount: t.indexCount,
    indexComponentType: t.indexComponentType,
    attributes: t.attributes.map(({ semantic: a, uniqueId: c, componentType: l, componentCount: h, count: m, byteLength: f }) => ({
      semantic: a,
      uniqueId: c,
      componentType: l,
      componentCount: h,
      count: m,
      byteLength: f
    }))
  });
  return { outputBytes: i, layout: r };
}
function He(t) {
  return t instanceof p ? t : t instanceof d && t.code === "cancelled" ? new p("cancelled", "decode", "decode was cancelled", { cause: t }) : new p("decode-failed", "decode", "Draco execution failed", { cause: t });
}
class Ze {
  constructor(e) {
    o(this, "runtime");
    this.runtime = e;
  }
  metrics() {
    return this.runtime.metrics();
  }
  async decodePrimitive(e) {
    const { outputBytes: i, layout: s } = Fe(e), n = e.source.slice(), r = e.cacheKey ?? _e(n);
    let a;
    try {
      a = await this.runtime.execute({
        key: `${r}|${Qe(s)}`,
        operation: "draco.decode",
        input: C.take([n.buffer]),
        metadata: Object.freeze({ layout: s }),
        signal: e.signal,
        maxOutputBytes: i
      });
      const c = a.takeBuffers(), l = [
        ...e.attributes.map((h) => h.byteLength),
        e.indexCount * { 5121: 1, 5123: 2, 5125: 4 }[e.indexComponentType]
      ];
      if (c.length !== l.length || c.some((h, m) => h.byteLength !== l[m])) {
        for (const h of c) new Uint8Array(h).fill(0);
        throw new p("decode-failed", "decode", "decoder returned an invalid output layout");
      }
      return new Ue(Array.from(c), e.attributes.length);
    } catch (c) {
      throw a?.release(), He(c);
    }
  }
  destroy() {
    return this.runtime.destroy();
  }
}
const Ke = "forgeng.codec.draco", ce = `artifacts/${D}`, Ge = Object.freeze({
  worker: Object.freeze({
    kind: "worker",
    uri: `${ce}/draco-worker.mjs`,
    sha256: "cfb4e173a89e287c0dd742193f4ac02aa8797f40dddf7138d4265751676ceba9",
    byteLength: 30,
    implementationVersion: D
  }),
  wasm: Object.freeze({
    kind: "wasm",
    uri: `${ce}/draco-decoder.wasm`,
    sha256: "712db3449ae2041d6e8a224c395bda6cedb49e51322fae38b7db9beb8b381889",
    byteLength: 192593,
    implementationVersion: D
  })
});
function Ye(t, e = {}) {
  const i = e.artifacts ?? Ge;
  return new Ze(new Ne({
    implementation: Object.freeze({
      id: Ke,
      implementationVersion: D,
      worker: i.worker,
      wasm: i.wasm
    }),
    platform: t,
    mode: "worker",
    maxWorkers: e.maxWorkers ?? 2,
    maxQueuedJobs: e.maxQueuedJobs ?? 64,
    maxInputBytes: H.maxCompressedPrimitiveBytes,
    maxOutputBytes: H.maxDecodedPrimitiveBytes,
    defaultTimeoutMs: e.defaultTimeoutMs ?? 3e4,
    initializationTimeoutMs: e.initializationTimeoutMs ?? 15e3
  }));
}
const Xe = /* @__PURE__ */ new Set(["bufferView", "attributes"]), he = /* @__PURE__ */ new Map([[5120, 1], [5121, 1], [5122, 2], [5123, 2], [5125, 4], [5126, 4]]), qe = /* @__PURE__ */ new Map([["SCALAR", 1], ["VEC2", 2], ["VEC3", 3], ["VEC4", 4]]);
function b(t) {
  throw new p("invalid-schema", "schema", t);
}
function M(t) {
  throw new p("invalid-bounds", "schema", t);
}
function k(t) {
  throw new p("limit-exceeded", "schema", t);
}
function _(t, e) {
  return (!t || typeof t != "object" || Array.isArray(t)) && b(`${e} must be an object`), t;
}
function v(t, e, i = 0) {
  return (!Number.isSafeInteger(t) || t < i) && b(`${e} must be a safe integer >= ${i}`), t;
}
function fe(t, e) {
  let i = 1;
  for (const s of t)
    i *= s, Number.isSafeInteger(i) || k(`${e} overflows`);
  return i;
}
function Q(t, e, i) {
  const s = t + e;
  return Number.isSafeInteger(s) || k(`${i} overflows`), s;
}
function et(t, e, i, s, n) {
  /^[A-Z][A-Z0-9_]*$/.test(t) || b(`${n} semantic ${t} is invalid`);
  const r = v(e, `${n} ${t} unique id`), a = v(i, `${n} ${t} accessor`), c = s[a];
  c || M(`${n} ${t} accessor is out of range`);
  const l = he.get(c.componentType), h = qe.get(c.type);
  (!l || !h) && b(`${n} ${t} accessor layout is unsupported`);
  const m = v(c.count, `${n} ${t} count`, 1), f = fe([m, h, l], `${n} ${t} output`);
  return Object.freeze({
    semantic: t,
    uniqueId: r,
    accessorIndex: a,
    componentType: c.componentType,
    type: c.type,
    componentCount: h,
    count: m,
    byteLength: f
  });
}
function tt(t, e, i = {}) {
  const s = le(i), n = t.buffers ?? [], r = t.bufferViews ?? [], a = t.accessors ?? [], c = t.meshes ?? [], l = [];
  let h = 0;
  for (const [m, f] of c.entries())
    for (const [y, g] of f.primitives.entries()) {
      const J = g.extensions?.[x];
      if (J === void 0) continue;
      const u = `mesh ${m} primitive ${y}`, $ = _(J, `${u} ${x}`), P = Object.keys($).find((w) => !Xe.has(w));
      P && b(`${u} extension contains unknown field ${P}`);
      const I = v($.bufferView, `${u} bufferView`), L = r[I];
      L || M(`${u} bufferView is out of range`), (L.byteStride !== void 0 || L.target !== void 0) && b(`${u} compressed bufferView must not declare byteStride or target`);
      const N = v(L.buffer, `${u} buffer`), Z = n[N], K = e[N];
      (!Z || !K) && M(`${u} buffer is unavailable`);
      const G = v(L.byteOffset ?? 0, `${u} byteOffset`), E = v(L.byteLength, `${u} byteLength`, 1), Y = Q(G, E, `${u} compressed range`);
      (Y > Z.byteLength || Y > K.byteLength) && M(`${u} compressed range exceeds its buffer`), E > s.maxCompressedPrimitiveBytes && k(`${u} compressed input exceeds its limit`);
      const X = g.mode ?? 4;
      X !== 4 && b(`${u} mode ${X} is unsupported; Draco runtime accepts TRIANGLES only`);
      const q = _(g.attributes, `${u} attributes`), ee = _($.attributes, `${u} extension attributes`), A = Object.keys(q).sort((w, S) => w.localeCompare(S));
      A.includes("POSITION") || b(`${u} must map POSITION`), (A.length < 1 || A.length > s.maxAttributes) && k(`${u} attribute count exceeds its limit`);
      const te = Object.keys(ee).sort((w, S) => w.localeCompare(S));
      if (A.length !== te.length || A.some((w, S) => w !== te[S]))
        throw new p("missing-attribute", "schema", `${u} Draco mapping must exactly cover core primitive attributes`);
      const z = A.map((w) => et(
        w,
        ee[w],
        q[w],
        a,
        u
      ));
      new Set(z.map((w) => w.uniqueId)).size !== z.length && b(`${u} Draco attribute unique ids must be distinct`);
      const U = z[0].count;
      U > s.maxVertices && k(`${u} vertex count exceeds its limit`), z.some((w) => w.count !== U) && b(`${u} attribute counts disagree`);
      const ie = v(g.indices, `${u} indices accessor`), O = a[ie];
      O || M(`${u} indices accessor is out of range`), (O.type !== "SCALAR" || ![5121, 5123, 5125].includes(O.componentType) || O.normalized === !0) && b(`${u} indices accessor layout is invalid`);
      const R = v(O.count, `${u} index count`, 3);
      R % 3 !== 0 && b(`${u} index count must be divisible by 3`), R > s.maxIndices && k(`${u} index count exceeds its limit`);
      const se = fe([
        R,
        he.get(O.componentType)
      ], `${u} index output`);
      let V = se;
      for (const w of z) V = Q(V, w.byteLength, `${u} output`);
      (V > s.maxDecodedPrimitiveBytes || V > E * s.maxExpansionRatio) && k(`${u} decoded output exceeds its limit`), h = Q(h, V, "total Draco output"), h > s.maxTotalDecodedBytes && k("total Draco output exceeds its limit"), l.push(Object.freeze({
        meshIndex: m,
        primitiveIndex: y,
        bufferView: I,
        buffer: N,
        byteOffset: G,
        byteLength: E,
        mode: 4,
        vertexCount: U,
        indexAccessor: ie,
        indexComponentType: O.componentType,
        indexCount: R,
        indexByteLength: se,
        attributes: Object.freeze(z),
        outputByteLength: V
      }));
    }
  return l.length === 0 && b(`document declares ${x} without a compressed primitive`), Object.freeze(l);
}
function it(t) {
  if (!t) return;
  const e = t;
  return typeof e.addEventListener == "function" && typeof e.removeEventListener == "function" ? t : Object.freeze({
    get aborted() {
      return t.aborted;
    },
    get reason() {
      return t.reason;
    },
    addEventListener: () => {
    },
    removeEventListener: () => {
    }
  });
}
function st(t) {
  if (!t || t[x] === void 0) return t;
  const e = { ...t };
  return delete e[x], Object.keys(e).length ? e : void 0;
}
function nt(t, e, i) {
  const s = JSON.parse(JSON.stringify(t)), n = [];
  s.buffers ?? (s.buffers = []), s.bufferViews ?? (s.bufferViews = []), s.accessors ?? (s.accessors = []);
  for (let r = 0; r < e.length; r += 1) {
    const a = e[r], c = s.meshes[a.meshIndex].primitives[a.primitiveIndex], l = i[r];
    for (let g = 0; g < a.attributes.length; g += 1) {
      const J = a.attributes[g], u = l[g], $ = s.buffers.length, P = s.bufferViews.length;
      s.buffers.push({ byteLength: u.byteLength }), s.bufferViews.push({ buffer: $, byteLength: u.byteLength, target: 34962 });
      const I = s.accessors[J.accessorIndex];
      I.bufferView = P, I.byteOffset = 0, delete I.sparse, n.push(u);
    }
    const h = l[a.attributes.length], m = s.buffers.length, f = s.bufferViews.length;
    s.buffers.push({ byteLength: h.byteLength }), s.bufferViews.push({ buffer: m, byteLength: h.byteLength, target: 34963 });
    const y = s.accessors[a.indexAccessor];
    y.bufferView = f, y.byteOffset = 0, delete y.sparse, c.extensions = st(c.extensions), n.push(h);
  }
  return s.extensionsUsed = s.extensionsUsed?.filter((r) => r !== x), s.extensionsRequired = s.extensionsRequired?.filter((r) => r !== x), s.extensionsUsed?.length === 0 && delete s.extensionsUsed, s.extensionsRequired?.length === 0 && delete s.extensionsRequired, Object.freeze({ document: s, outputBuffers: Object.freeze(n) });
}
function ot(t) {
  const e = Object.freeze({ ...t.limits });
  return Object.freeze({
    id: "forgeng.assets.draco.gltf",
    implementationVersion: We,
    extensions: Object.freeze([x]),
    stage: "pre-buffer-validation",
    decode: async (i) => {
      const s = tt(i.document, i.buffers, e), n = t.createDecoder(), r = [];
      let a;
      try {
        const c = it(i.signal), h = (await Promise.all(s.map(async (f) => {
          const y = await n.decodePrimitive({
            source: new Uint8Array(i.buffers[f.buffer], f.byteOffset, f.byteLength),
            mode: f.mode,
            vertexCount: f.vertexCount,
            indexCount: f.indexCount,
            indexComponentType: f.indexComponentType,
            attributes: f.attributes,
            cacheKey: `${i.sourceUrl}|mesh:${f.meshIndex}|primitive:${f.primitiveIndex}`,
            signal: c,
            limits: e
          });
          return r.push(y), y;
        }))).map((f) => f.takeBuffers()), m = nt(i.document, s, h);
        return a = m.outputBuffers, Object.freeze({
          document: m.document,
          buffers: Object.freeze([...i.buffers, ...m.outputBuffers])
        });
      } catch (c) {
        for (const l of a ?? []) new Uint8Array(l).fill(0);
        throw c instanceof p ? c : new p("decode-failed", "decode", `${x} decode failed`, { cause: c });
      } finally {
        for (const c of r) c.dispose();
        await n.destroy();
      }
    }
  });
}
function at(t = {}) {
  return Ye(ke(t.platform), t);
}
export {
  Ge as DRACO_ARTIFACTS,
  ce as DRACO_ARTIFACT_ROOT,
  Ke as DRACO_CODEC_ID,
  at as createBrowserDracoDecoder,
  ot as createDracoGLTFExtension
};

