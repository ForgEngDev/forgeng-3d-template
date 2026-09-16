var Be = Object.defineProperty;
var Ie = (i, e, t) => e in i ? Be(i, e, { enumerable: !0, configurable: !0, writable: !0, value: t }) : i[e] = t;
var o = (i, e, t) => Ie(i, typeof e != "symbol" ? e + "" : e, t);
const G = "forgeng.codec-worker/1";
class u extends Error {
  constructor(t, s, n = {}) {
    super(s);
    o(this, "code");
    o(this, "codecId");
    o(this, "jobId");
    o(this, "retryable");
    o(this, "cause");
    this.name = "CodecRuntimeError", this.code = t, this.codecId = n.codecId, this.jobId = n.jobId, this.retryable = n.retryable ?? !1, this.cause = n.cause;
  }
}
function ve(i) {
  const e = typeof document < "u" ? document.baseURI : typeof location < "u" ? location.href : void 0;
  if (!i.baseUrl && !e)
    throw new u("invalid-config", "Browser codec platform requires a baseUrl outside a document.");
  return new URL(i.baseUrl ?? e);
}
function oe(i, e) {
  if (/^(?:blob|data):/i.test(i.uri))
    throw new u("invalid-config", "Browser codec artifacts cannot use blob: or data: URLs.");
  const t = ve(e), s = new URL(i.uri, t);
  if (s.protocol !== "https:" && s.protocol !== "http:")
    throw new u("invalid-config", "Browser codec artifacts require an HTTP(S) release URL.");
  if (s.username || s.password) throw new u("invalid-config", "Browser codec artifact URLs cannot contain credentials.");
  if (!new Set(e.allowedOrigins ?? [t.origin]).has(s.origin))
    throw new u("invalid-config", "Browser codec artifact origin is not allowed by release policy.");
  return s;
}
async function Se(i, e) {
  const t = i.headers.get("content-length");
  if (t !== null && Number(t) !== e)
    throw new u("artifact-size", "Codec release response byte length does not match its descriptor.");
  if (!i.body) {
    const l = new Uint8Array(await i.arrayBuffer());
    if (l.byteLength !== e) throw new u("artifact-size", "Codec release artifact byte length is invalid.");
    return l;
  }
  const s = i.body.getReader(), n = [];
  let r = 0;
  try {
    for (; ; ) {
      const l = await s.read();
      if (l.done) break;
      if (r += l.value.byteLength, r > e)
        throw await s.cancel(), new u("artifact-size", "Codec release artifact exceeded its declared byte length.");
      n.push(l.value);
    }
  } finally {
    s.releaseLock();
  }
  if (r !== e) throw new u("artifact-size", "Codec release artifact byte length is invalid.");
  const a = new Uint8Array(r);
  let c = 0;
  for (const l of n)
    a.set(l, c), c += l.byteLength;
  return a;
}
class Me {
  constructor(e) {
    o(this, "options");
    this.options = e;
  }
  async read(e, t) {
    const s = oe(e, this.options), n = this.options.fetch ?? globalThis.fetch;
    if (typeof n != "function") throw new u("artifact-read", "Browser fetch is unavailable.");
    const r = new AbortController(), a = () => r.abort(t.reason);
    t.addEventListener("abort", a, { once: !0 });
    try {
      const c = await n(s, {
        cache: "force-cache",
        credentials: s.origin === ve(this.options).origin ? "same-origin" : "omit",
        redirect: "error",
        signal: r.signal
      });
      if (!c.ok) throw new u("artifact-read", `Codec release artifact returned HTTP ${c.status}.`);
      if (c.url && oe({ ...e, uri: c.url }, this.options).href !== s.href)
        throw new u("artifact-read", "Codec release artifact redirected away from its pinned URL.");
      return await Se(c, e.byteLength);
    } finally {
      t.removeEventListener("abort", a);
    }
  }
}
class Ve {
  constructor(e) {
    o(this, "implementation");
    this.implementation = e;
  }
  async sha256(e) {
    const t = e.slice().buffer, s = await this.implementation.subtle.digest("SHA-256", t);
    return [...new Uint8Array(s)].map((n) => n.toString(16).padStart(2, "0")).join("");
  }
}
class $e {
  constructor(e) {
    o(this, "worker");
    o(this, "messages", /* @__PURE__ */ new Map());
    o(this, "errors", /* @__PURE__ */ new Map());
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
class Ee {
  constructor(e) {
    o(this, "options");
    this.options = e;
  }
  async create(e, t) {
    if (t.aborted)
      throw new u("cancelled", "Browser codec worker creation was cancelled.", { cause: t.reason });
    if (e.descriptor.kind !== "worker") throw new u("invalid-config", "Worker factory received a non-worker artifact.");
    const s = oe(e.descriptor, this.options), n = this.options.createWorker ?? ((r, a) => new Worker(r, a));
    return new $e(n(s, {
      type: "module",
      name: `forgeng-codec-${e.descriptor.implementationVersion}`
    }));
  }
}
const je = Object.freeze({
  now: () => performance.now(),
  schedule: (i, e) => globalThis.setTimeout(i, e),
  cancel: (i) => globalThis.clearTimeout(i)
});
function Pe(i = {}) {
  const e = i.crypto ?? globalThis.crypto;
  if (!e?.subtle) throw new u("invalid-config", "Browser Web Crypto SHA-256 is unavailable.");
  return Object.freeze({
    artifacts: new Me(i),
    digest: new Ve(e),
    schedule: je,
    workers: new Ee(i)
  });
}
const he = Object.freeze({ type: "abort" });
class Re {
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
  addEventListener(e, t, s) {
    if (e === "abort") {
      if (this.abortedValue) {
        t(he);
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
          t(he);
        } catch {
        }
      this.listeners.clear();
    }
  }
}
class fe {
  constructor() {
    o(this, "inner", new Re());
  }
  get signal() {
    return this.inner;
  }
  abort(e) {
    this.inner.abort(e);
  }
}
function Ue(i) {
  if (i instanceof ArrayBuffer) return i.slice(0);
  const e = new Uint8Array(i.byteLength);
  return e.set(new Uint8Array(i.buffer, i.byteOffset, i.byteLength)), e.buffer;
}
class M {
  constructor(e, t) {
    o(this, "buffers");
    o(this, "stateValue", "owned");
    o(this, "byteLengthValue");
    o(this, "expectedLengths");
    this.buffers = e.map((s) => t ? s.slice(0) : s), this.expectedLengths = this.buffers.map((s) => s.byteLength), this.byteLengthValue = this.buffers.reduce((s, n) => s + n.byteLength, 0);
  }
  static copyOf(e) {
    return new M(e.map(Ue), !1);
  }
  /** Takes exclusive ownership. Callers must not retain or reuse the supplied buffers. */
  static take(e) {
    return new M(e, !1);
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
    return this.assertOwned("clone"), new M(this.buffers, !0);
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
      throw new u(
        "ownership-released",
        `Codec buffers cannot ${e} after ownership was ${this.stateValue}.`
      );
    if (this.buffers.some((t, s) => t.byteLength !== this.expectedLengths[s]))
      throw this.buffers = [], this.stateValue = "moved", new u("ownership-released", "Detached codec buffers cannot be reused.");
  }
}
class Je {
  constructor(e, t, s, n, r) {
    o(this, "codecId");
    o(this, "implementationVersion");
    o(this, "jobId");
    o(this, "owned");
    o(this, "owner");
    o(this, "active", !0);
    this.codecId = e, this.implementationVersion = t, this.jobId = s, this.owned = n, this.owner = r;
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
    if (!this.active) throw new u("ownership-released", "Codec result lease was already released.", {
      codecId: this.codecId,
      jobId: this.jobId
    });
  }
}
const Fe = /^[a-f0-9]{64}$/, De = /^[a-z0-9](?:[a-z0-9._/-]{0,126}[a-z0-9])?$/, Ke = /^[0-9]+\.[0-9]+\.[0-9]+(?:[-+][0-9A-Za-z.-]+)?$/;
function me(i, e) {
  if (i.kind !== "worker" && i.kind !== "wasm")
    throw new u("invalid-config", "Codec artifact kind must be worker or wasm.");
  if (!i.uri || /^(?:blob|data):/i.test(i.uri))
    throw new u("invalid-config", "Codec artifacts require a static release URI; blob: and data: are forbidden.");
  if (!Fe.test(i.sha256))
    throw new u("invalid-config", "Codec artifact SHA-256 must be 64 lowercase hexadecimal characters.");
  if (!Number.isSafeInteger(i.byteLength) || i.byteLength < 1)
    throw new u("invalid-config", "Codec artifact byteLength must be a positive safe integer.");
  if (i.implementationVersion !== e)
    throw new u(
      "implementation-version-mismatch",
      "Codec artifact implementation version does not match its runtime descriptor."
    );
}
function _e(i) {
  if (!De.test(i.id)) throw new u("invalid-config", "Codec implementation ID is invalid.");
  if (!Ke.test(i.implementationVersion))
    throw new u("invalid-config", "Codec implementation version must be an exact semantic version.");
  i.worker && me(i.worker, i.implementationVersion), i.wasm && me(i.wasm, i.implementationVersion);
}
async function pe(i, e, t, s) {
  if (t.aborted)
    throw new u("cancelled", "Codec artifact loading was cancelled.", { codecId: s, cause: t.reason });
  let n;
  try {
    n = await e.artifacts.read(i, t);
  } catch (c) {
    throw c instanceof u ? c : new u("artifact-read", "Codec release artifact could not be read.", { codecId: s, retryable: !0, cause: c });
  }
  if (t.aborted)
    throw n.fill(0), new u("cancelled", "Codec artifact loading was cancelled.", { codecId: s, cause: t.reason });
  if (n.byteLength !== i.byteLength)
    throw n.fill(0), new u("artifact-size", "Codec release artifact byte length does not match its descriptor.", { codecId: s });
  const r = n.slice();
  if (n.fill(0), (await e.digest.sha256(r)).toLowerCase() !== i.sha256)
    throw r.fill(0), new u("integrity-mismatch", "Codec release artifact SHA-256 verification failed.", { codecId: s });
  return Object.freeze({ descriptor: Object.freeze({ ...i }), bytes: r });
}
const We = Object.freeze({
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
class Xe {
  constructor() {
    o(this, "values", { ...We });
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
const E = Object.freeze({
  maxWorkers: 2,
  maxQueuedJobs: 64,
  maxInputBytes: 256 * 1024 * 1024,
  maxOutputBytes: 512 * 1024 * 1024,
  defaultTimeoutMs: 3e4,
  initializationTimeoutMs: 1e4
});
function j(i, e, t, s, n) {
  const r = e ?? t;
  if (!Number.isSafeInteger(r) || r < s || r > n)
    throw new u("invalid-config", `${i} must be a safe integer from ${s} through ${n}.`);
  return r;
}
function Ne(i) {
  const e = i.mode ?? "auto", t = e === "auto" ? i.implementation.worker && i.platform.workers ? "worker" : "inline" : e;
  if (t === "worker" && (!i.implementation.worker || !i.platform.workers))
    throw new u("invalid-config", "Worker mode requires a worker release artifact and worker factory port.");
  if (t === "inline" && !i.inline)
    throw new u("invalid-config", "Inline mode requires an explicit inline codec factory.");
  return Object.freeze({
    mode: t,
    maxWorkers: j("maxWorkers", i.maxWorkers, E.maxWorkers, 1, 8),
    maxQueuedJobs: j("maxQueuedJobs", i.maxQueuedJobs, E.maxQueuedJobs, 1, 1024),
    maxInputBytes: j("maxInputBytes", i.maxInputBytes, E.maxInputBytes, 1, 1024 * 1024 * 1024),
    maxOutputBytes: j("maxOutputBytes", i.maxOutputBytes, E.maxOutputBytes, 1, 1024 * 1024 * 1024),
    defaultTimeoutMs: j("defaultTimeoutMs", i.defaultTimeoutMs, E.defaultTimeoutMs, 1, 3e5),
    initializationTimeoutMs: j(
      "initializationTimeoutMs",
      i.initializationTimeoutMs,
      E.initializationTimeoutMs,
      1,
      6e4
    )
  });
}
function Qe(i) {
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
function He(i) {
  if (!i) return Object.freeze({});
  const e = Object.entries(i).sort(([s], [n]) => s.localeCompare(n));
  if (e.length > 64) throw new u("invalid-config", "Codec job metadata is limited to 64 fields.");
  const t = {};
  for (const [s, n] of e) {
    if (!/^[A-Za-z0-9_.-]{1,64}$/.test(s) || typeof n != "string" && typeof n != "number" && typeof n != "boolean" && n !== null || typeof n == "number" && !Number.isFinite(n) || typeof n == "string" && n.length > 1024)
      throw new u("invalid-config", "Codec job metadata is not closed, finite, and bounded.");
    t[s] = n;
  }
  return Object.freeze(t);
}
function Ge(i, e, t, s, n) {
  return i.operation === e.operation && i.inputByteLength === e.input.byteLength && i.maxOutputBytes === s && i.timeoutMs === n && JSON.stringify(i.metadata) === JSON.stringify(t);
}
function xe(i, e) {
  let t = 0;
  for (const s of i) {
    if (!(s instanceof ArrayBuffer)) throw new u("worker-protocol", "Codec output contains a non-ArrayBuffer value.");
    if (t += s.byteLength, !Number.isSafeInteger(t) || t > e)
      throw new u("result-too-large", "Codec output exceeds the configured byte limit.");
  }
  return t;
}
function Ze(i, e, t) {
  const s = (n, r) => new u(n, r, { codecId: t });
  if (!(i.input instanceof M) || i.input.state !== "owned")
    throw s("ownership-released", "Codec input must be an exclusively owned, reusable buffer wrapper.");
  if (!i.key || i.key.length > 512) throw s("invalid-config", "Codec job key must contain 1 through 512 characters.");
  if (!/^[A-Za-z0-9_.:/-]{1,128}$/.test(i.operation)) throw s("invalid-config", "Codec job operation is invalid.");
  if (i.input.byteLength > e) throw s("invalid-config", "Codec input exceeds the configured byte limit.");
  if (i.timeoutMs !== void 0 && (!Number.isSafeInteger(i.timeoutMs) || i.timeoutMs < 1))
    throw s("invalid-config", "Codec job timeout must be a positive safe integer.");
  if (i.maxOutputBytes !== void 0 && (!Number.isSafeInteger(i.maxOutputBytes) || i.maxOutputBytes < 1))
    throw s("invalid-config", "Codec output limit must be a positive safe integer.");
}
class qe {
  constructor(e, t, s, n, r, a) {
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
    this.source = e, this.options = t, this.cancellation = s, this.metrics = n, this.host = r, this.workerPool = a;
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
      this.options.mode === "worker" && e.worker ? pe(e.worker, this.source.platform, this.cancellation.signal, e.id) : Promise.resolve(void 0),
      e.wasm ? pe(e.wasm, this.source.platform, this.cancellation.signal, e.id) : Promise.resolve(void 0)
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
      throw e?.fill(0), t instanceof u ? t : this.host.error("init-failed", "Inline codec initialization failed.", void 0, t, !0);
    }
  }
  clearArtifacts() {
    const e = (this.workerArtifact?.bytes.byteLength ?? 0) + (this.wasmArtifact?.bytes.byteLength ?? 0);
    this.workerArtifact?.bytes.fill(0), this.wasmArtifact?.bytes.fill(0), this.workerArtifact = void 0, this.wasmArtifact = void 0, this.metrics.add("artifactBytes", -e);
  }
}
function Ye(i) {
  return typeof i == "object" && i !== null && !Array.isArray(i);
}
function ee(i, e) {
  const t = Object.keys(i).sort(), s = [...e].sort();
  return t.length === s.length && t.every((n, r) => n === s[r]);
}
function et(i) {
  if (!(!Ye(i) || i.protocol !== G || typeof i.type != "string")) {
    if (i.type === "ready")
      return ee(i, ["protocol", "type", "codecId", "implementationVersion"]) && typeof i.codecId == "string" && typeof i.implementationVersion == "string" ? i : void 0;
    if (i.type === "result")
      return ee(i, ["protocol", "type", "jobId", "implementationVersion", "output"]) && typeof i.jobId == "string" && typeof i.implementationVersion == "string" && Array.isArray(i.output) && i.output.every((e) => e instanceof ArrayBuffer) ? i : void 0;
    if (i.type === "error")
      return ee(i, ["protocol", "type", "jobId", "code", "message"]) && typeof i.jobId == "string" && typeof i.code == "string" && /^[a-z0-9.-]{1,64}$/.test(i.code) && typeof i.message == "string" && i.message.length <= 256 ? i : void 0;
  }
}
class tt {
  constructor(e, t, s, n, r, a) {
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
    this.options = e, this.maxWorkers = t, this.initializationTimeoutMs = s, this.metrics = n, this.host = r, this.signal = a;
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
          const t = e instanceof u ? e : this.host.error("init-failed", "Codec worker initialization failed.", void 0, e, !0);
          this.host.spawnFailed(t, this.workers.size > 0);
        }
      ));
    }
  }
  cancel(e) {
    const t = [...this.workers].find((s) => s.job === e);
    if (t) {
      try {
        t.transport.postMessage({ protocol: G, type: "cancel", jobId: e.id }, []);
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
    const c = new Promise((h, p) => {
      n.readyResolve = h, n.readyReject = p, n.readyTimeout = this.options.platform.schedule.schedule(
        () => p(this.host.error("timeout", "Codec worker initialization timed out.", void 0, void 0, !0)),
        this.initializationTimeoutMs
      );
    }), l = this.wasmArtifact?.bytes.slice().buffer;
    try {
      s.postMessage({
        protocol: G,
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
  onMessage(e, t) {
    if (e.state === "closed") return;
    const s = et(t);
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
      xe(s.output, n.maxOutputBytes), this.host.succeedJob(n, M.take(s.output)), this.idle(e);
    } catch (r) {
      this.host.failJob(n, r instanceof u ? r : this.host.error("worker-protocol", "Codec worker output is invalid.", n.id, r)), this.idle(e);
    }
  }
  onCrash(e, t) {
    if (e.state !== "closed") {
      if (this.metrics.increment("workerCrashes"), e.state === "initializing") {
        e.readyReject?.(t instanceof u ? t : this.host.error("worker-crashed", "Codec worker crashed during initialization.", void 0, t, !0));
        return;
      }
      e.job && this.host.failJob(e.job, t instanceof u ? t : this.host.error("worker-crashed", "Codec worker crashed while executing a job.", e.job.id, t, !0)), e.job = void 0, this.close(e).finally(() => this.host.requestPump());
    }
  }
  start(e, t) {
    if (!(!this.host.active || e.state !== "idle" || t.state !== "queued")) {
      t.state = "running-worker", e.state = "running", e.job = t, this.host.startJob(t);
      try {
        const s = t.input.move();
        e.transport.postMessage({
          protocol: G,
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
class it {
  constructor(e) {
    o(this, "sourceOptions");
    o(this, "options");
    o(this, "metricsValue", new Xe());
    o(this, "cancellation", new fe());
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
    this.sourceOptions = Qe(e), _e(this.sourceOptions.implementation), this.options = Ne(this.sourceOptions), this.options.mode === "worker" && (this.workerPool = new tt(
      this.sourceOptions,
      this.options.maxWorkers,
      this.options.initializationTimeoutMs,
      this.metricsValue,
      this,
      this.cancellation.signal
    )), this.initializer = new qe(
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
      Ze(e, this.options.maxInputBytes, this.sourceOptions.implementation.id), t = He(e.metadata);
    } catch (l) {
      return e.input.dispose(), Promise.reject(l);
    }
    if (!this.active)
      return e.input.dispose(), Promise.reject(this.error("destroyed", "Codec runtime has been destroyed."));
    if (e.signal?.aborted)
      return e.input.dispose(), Promise.reject(this.error("cancelled", "Codec job consumer was already cancelled.", void 0, e.signal.reason));
    const s = Math.min(e.maxOutputBytes ?? this.options.maxOutputBytes, this.options.maxOutputBytes), n = Math.min(e.timeoutMs ?? this.options.defaultTimeoutMs, this.options.defaultTimeoutMs), r = this.jobs.get(e.key);
    if (r && r.state !== "settled")
      return Ge(r, e, t, s, n) ? (e.input.dispose(), this.metricsValue.increment("inflightJoins"), this.addWaiter(r, e.signal)) : (e.input.dispose(), Promise.reject(this.error("invalid-config", "Codec shared job key collided with different normalized work.")));
    if (this.queued.length >= this.options.maxQueuedJobs)
      return e.input.dispose(), Promise.reject(this.error("queue-full", "Codec job queue is full.", void 0, void 0, !0));
    const a = this.createJob(e, t, s, n);
    this.jobs.set(a.key, a), this.queued.push(a), this.metricsValue.add("pendingJobs", 1), this.metricsValue.add("queuedJobs", 1), this.metricsValue.add("ownedInputBytes", a.inputByteLength);
    const c = this.addWaiter(a, e.signal);
    return this.requestPump(), c;
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
    const s = [...e.waiters].filter((n) => n.active);
    for (let n = 0; n < s.length; n += 1) {
      const r = s[n];
      if (!this.finishWaiter(e, r)) continue;
      const a = n === s.length - 1 ? t : t.clone(), c = new Je(
        this.sourceOptions.implementation.id,
        this.sourceOptions.implementation.implementationVersion,
        e.id,
        a,
        this
      );
      this.leases.add(c), this.metricsValue.add("ownedOutputBytes", a.byteLength), r.resolve(c);
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
  error(e, t, s, n, r = !1) {
    return new u(e, t, {
      codecId: this.sourceOptions.implementation.id,
      ...s ? { jobId: s } : {},
      ...n !== void 0 ? { cause: n } : {},
      retryable: r
    });
  }
  createJob(e, t, s, n) {
    return {
      id: `${this.sourceOptions.implementation.id}:${this.nextJob++}`,
      key: e.key,
      operation: e.operation,
      metadata: t,
      input: e.input,
      inputByteLength: e.input.byteLength,
      maxOutputBytes: s,
      timeoutMs: n,
      cancellation: new fe(),
      waiters: /* @__PURE__ */ new Set(),
      state: "queued"
    };
  }
  addWaiter(e, t) {
    return new Promise((s, n) => {
      const r = { resolve: s, reject: n, signal: t, active: !0 };
      if (e.waiters.add(r), t) {
        const a = () => this.abortWaiter(e, r, t.reason);
        Object.assign(r, { onAbort: a }), this.metricsValue.add("listeners", 1), t.addEventListener("abort", a, { once: !0 });
      }
    });
  }
  abortWaiter(e, t, s) {
    this.finishWaiter(e, t) && (this.metricsValue.increment("jobsCancelled"), t.reject(this.error("cancelled", "Codec job consumer was cancelled.", e.id, s)), [...e.waiters].every((n) => !n.active) && this.cancelUnobserved(e, s));
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
      this.failQueued(e instanceof u ? e : this.error("init-failed", "Codec runtime initialization failed.", void 0, e, !0));
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
    const s = e.input.move(), n = {
      jobId: e.id,
      operation: e.operation,
      input: s,
      metadata: e.metadata,
      maxOutputBytes: e.maxOutputBytes,
      signal: e.cancellation.signal
    };
    Promise.resolve().then(() => t.execute(n)).then(
      (r) => this.acceptInlineOutput(e, r),
      (r) => {
        e.state === "running-inline" && this.failJob(e, e.cancellation.signal.aborted ? this.error("cancelled", "Inline codec execution was cancelled.", e.id, e.cancellation.signal.reason) : this.error("execution-failed", "Inline codec execution failed.", e.id, r, !0));
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
      xe(t, e.maxOutputBytes), this.succeedJob(e, M.take(t));
    } catch (s) {
      this.failJob(e, s instanceof u ? s : this.error("execution-failed", "Inline codec output is invalid.", e.id, s));
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
class f extends Error {
  constructor(t, s, n, r = {}) {
    super(`KTX2 ${s}: ${n}`);
    o(this, "code");
    o(this, "phase");
    o(this, "formatCode");
    o(this, "cause");
    this.code = t, this.phase = s, this.name = "KTX2FormatError", this.formatCode = `ktx2.${t}`, this.cause = r.cause;
  }
}
const ke = "1.0.0", q = "2.50.0-forgeng.1", R = "image/ktx2", W = "KHR_texture_basisu", we = Object.freeze([
  171,
  75,
  84,
  88,
  32,
  50,
  48,
  187,
  13,
  10,
  26,
  10
]), O = Object.freeze({
  astc: "astc-4x4",
  bc7: "bc7",
  bc5: "bc5",
  etc2: "etc2-rgba8",
  rgba8: "rgba8"
}), A = Object.freeze({
  astcLinear: "astc-4x4-unorm",
  astcSrgb: "astc-4x4-unorm-srgb",
  bc7Linear: "bc7-rgba-unorm",
  bc7Srgb: "bc7-rgba-unorm-srgb",
  bc5Linear: "bc5-rg-unorm",
  etc2Linear: "etc2-rgba8unorm",
  etc2Srgb: "etc2-rgba8unorm-srgb",
  rgba8Linear: "rgba8unorm",
  rgba8Srgb: "rgba8unorm-srgb"
}), B = Object.freeze({
  maxInputBytes: 64 * 1024 * 1024,
  maxDimension: 16384,
  maxLevels: 15,
  maxLayers: 256,
  maxDecodedBytes: 256 * 1024 * 1024,
  maxExpansionRatio: 256
}), te = 80, ie = 24, F = 24, D = 16, _ = 163, se = 166;
function d(i, e) {
  throw new f(i, "container", e);
}
function be(i) {
  if (i?.aborted) throw new f("cancelled", "container", "decode was cancelled");
}
function P(i, e, t) {
  const s = i ?? e;
  return (!Number.isSafeInteger(s) || s <= 0) && d("limit-exceeded", `${t} must be a positive safe integer`), s;
}
function ze(i = {}) {
  const e = Object.keys(i), t = new Set(Object.keys(B)), s = e.find((n) => !t.has(n));
  return s && d("limit-exceeded", `unknown limit ${s}`), Object.freeze({
    maxInputBytes: P(i.maxInputBytes, B.maxInputBytes, "maxInputBytes"),
    maxDimension: P(i.maxDimension, B.maxDimension, "maxDimension"),
    maxLevels: P(i.maxLevels, B.maxLevels, "maxLevels"),
    maxLayers: P(i.maxLayers, B.maxLayers, "maxLayers"),
    maxDecodedBytes: P(i.maxDecodedBytes, B.maxDecodedBytes, "maxDecodedBytes"),
    maxExpansionRatio: P(i.maxExpansionRatio, B.maxExpansionRatio, "maxExpansionRatio")
  });
}
function K(i, e, t) {
  const s = i.getBigUint64(e, !0);
  return s > BigInt(Number.MAX_SAFE_INTEGER) && d("invalid-bounds", `${t} exceeds the safe integer range`), Number(s);
}
function ae(i, e, t, s) {
  (!Number.isSafeInteger(i) || !Number.isSafeInteger(e) || i < 0 || e < 0) && d("invalid-bounds", `${s} range is invalid`);
  const n = i + e;
  return (!Number.isSafeInteger(n) || n > t) && d("invalid-bounds", `${s} exceeds the container`), n;
}
function ne(i, e, t, s, n = 1) {
  if (e === 0) {
    i !== 0 && d("invalid-bounds", `${s} offset must be zero when empty`);
    return;
  }
  i % n !== 0 && d("invalid-bounds", `${s} is not ${n}-byte aligned`), ae(i, e, t, s);
}
function re(i, e) {
  return i[0] < e[1] && e[0] < i[1];
}
function ge(i) {
  let e = "";
  for (const t of i)
    (t < 32 || t > 126) && d("invalid-header", "KTX metadata text is not printable ASCII"), e += String.fromCharCode(t);
  return e;
}
function st(i) {
  let e = "";
  for (let t = 0; t < i.length; ) {
    const s = i[t++];
    let n, r, a;
    s < 128 ? (n = s, r = 0, a = 0) : s >= 194 && s <= 223 ? (n = s & 31, r = 1, a = 128) : s >= 224 && s <= 239 ? (n = s & 15, r = 2, a = 2048) : s >= 240 && s <= 244 ? (n = s & 7, r = 3, a = 65536) : d("invalid-header", "metadata key is not valid UTF-8"), t + r > i.length && d("invalid-header", "metadata key is truncated UTF-8");
    for (let c = 0; c < r; c += 1) {
      const l = i[t++];
      (l & 192) !== 128 && d("invalid-header", "metadata key has invalid UTF-8 continuation"), n = n << 6 | l & 63;
    }
    (n < a || n > 1114111 || n >= 55296 && n <= 57343 || n < 32 || n === 127) && d("invalid-header", "metadata key contains an invalid Unicode code point"), e += String.fromCodePoint(n);
  }
  return e;
}
function nt(i, e) {
  const t = [...i].map((r) => r.codePointAt(0)), s = [...e].map((r) => r.codePointAt(0)), n = Math.min(t.length, s.length);
  for (let r = 0; r < n; r += 1)
    if (t[r] !== s[r]) return t[r] - s[r];
  return t.length - s.length;
}
function rt(i, e, t) {
  if (t === 0) return Object.freeze({});
  const s = new DataView(i.buffer, i.byteOffset, i.byteLength), n = e + t, r = /* @__PURE__ */ new Set();
  let a = e, c, l, h;
  for (; a < n; ) {
    a + 4 > n && d("invalid-bounds", "key/value length is truncated");
    const p = s.getUint32(a, !0);
    a += 4, (p < 2 || a + p > n) && d("invalid-header", "key/value entry length is invalid");
    const g = i.subarray(a, a + p), w = g.indexOf(0);
    w <= 0 && d("invalid-header", "key/value entry has no terminated key");
    const m = st(g.subarray(0, w));
    r.has(m) && d("invalid-header", `duplicate metadata key ${m}`), c !== void 0 && nt(c, m) >= 0 && d("invalid-header", "metadata keys are not strictly sorted"), r.add(m), c = m;
    const y = g.subarray(w + 1), v = y[y.length - 1] === 0 ? y.length - 1 : y.length;
    m === "KTXorientation" && (l = ge(y.subarray(0, v))), m === "KTXswizzle" && (h = ge(y.subarray(0, v))), a += p;
    const k = a + 3 & -4;
    for (k > n && d("invalid-bounds", "key/value padding exceeds its section"); a < k; a += 1) i[a] !== 0 && d("invalid-header", "key/value padding is non-zero");
  }
  return a !== n && d("invalid-bounds", "key/value section has trailing bytes"), Object.freeze({ ...l ? { orientation: l } : {}, ...h ? { swizzle: h } : {} });
}
function ot(i, e, t) {
  const s = new DataView(i.buffer, i.byteOffset, i.byteLength);
  t < 4 + F + D && d("invalid-dfd", "basic descriptor is too short"), s.getUint32(e, !0) !== t && d("invalid-dfd", "dfdTotalSize does not match dfdByteLength");
  const n = s.getUint16(e + 4, !0), r = s.getUint16(e + 6, !0), a = s.getUint16(e + 8, !0), c = s.getUint16(e + 10, !0);
  (n !== 0 || r !== 0 || a !== 2) && d("invalid-dfd", "unsupported descriptor header"), (c < F + D || c % 4 !== 0 || c + 4 !== t) && d("invalid-dfd", "descriptor block size is invalid"), (c - F) % D !== 0 && d("invalid-dfd", "sample table size is invalid");
  const l = i[e + 12];
  l !== _ && l !== se && d("invalid-dfd", `unsupported color model ${l}`);
  const h = i[e + 14];
  h !== 1 && h !== 2 && d("invalid-dfd", `unsupported transfer function ${h}`);
  const p = i[e + 16] + 1, g = i[e + 17] + 1;
  (p !== 4 || g !== 4 || i[e + 18] !== 0 || i[e + 19] !== 0) && d("invalid-dfd", "Basis texture block dimensions must be 4x4x1x1");
  const w = i[e + 20];
  for (let x = 21; x < 28; x += 1)
    i[e + x] !== 0 && d("invalid-dfd", "unsupported non-zero DFD plane");
  l === _ && w !== 0 && d("invalid-dfd", "ETC1S bytesPlane0 must be zero"), l === se && w !== 0 && w !== 16 && d("invalid-dfd", "UASTC bytesPlane0 must be zero or sixteen");
  const m = [], y = (c - F) / D;
  for (let x = 0; x < y; x += 1) {
    const T = e + 4 + F + x * D;
    m.push(i[T + 3] & 15);
  }
  const v = l === _ ? /* @__PURE__ */ new Set([0, 3, 4, 15]) : /* @__PURE__ */ new Set([0, 3, 4, 5, 6]);
  (m.length < 1 || m.length > 2 || m.some((x) => !v.has(x))) && d("invalid-dfd", "Basis channel layout is invalid"), l === se && m.length !== 1 && d("invalid-dfd", "UASTC must declare exactly one DFD sample");
  const k = l === _ ? m.includes(15) : m.includes(3);
  return Object.freeze({
    colorModel: l,
    colorPrimaries: i[e + 13],
    transferFunction: h,
    flags: i[e + 15],
    texelBlockWidth: p,
    texelBlockHeight: g,
    bytesPlane0: w,
    channels: Object.freeze(m),
    hasAlpha: k
  });
}
class at {
  constructor(e, t) {
    o(this, "info");
    o(this, "source");
    o(this, "disposed", !1);
    this.info = e, this.source = t;
  }
  get byteLength() {
    return this.source.byteLength;
  }
  assertActive() {
    if (this.disposed) throw new f("disposed", "lifecycle", "container is disposed");
  }
  /** Returns an owned copy; callers never receive a view into format-owned storage. */
  copyBytes() {
    return this.assertActive(), this.source.slice();
  }
  dispose() {
    this.disposed || (this.disposed = !0, this.source.fill(0));
  }
}
function Le(i, e = {}) {
  const t = ze(e.limits);
  be(e.signal);
  const s = i instanceof Uint8Array ? i : new Uint8Array(i);
  s.byteLength > t.maxInputBytes && d("limit-exceeded", "container exceeds maxInputBytes"), s.byteLength < te + ie && d("invalid-header", "container header is truncated");
  for (let r = 0; r < we.length; r += 1)
    s[r] !== we[r] && d("invalid-identifier", "identifier bytes do not match KTX2");
  const n = s.slice();
  try {
    const r = new DataView(n.buffer), a = r.getUint32(12, !0), c = r.getUint32(16, !0), l = r.getUint32(20, !0), h = r.getUint32(24, !0), p = r.getUint32(28, !0), g = r.getUint32(32, !0), w = r.getUint32(36, !0), m = r.getUint32(40, !0), y = r.getUint32(44, !0), v = r.getUint32(48, !0), k = r.getUint32(52, !0), x = r.getUint32(56, !0), T = r.getUint32(60, !0), I = K(r, 64, "sgdByteOffset"), L = K(r, 72, "sgdByteLength");
    (a !== 0 || c !== 1) && d("invalid-header", "Basis textures require vkFormat 0 and typeSize 1"), (l === 0 || h === 0) && d("invalid-dimensions", "Basis texture width and height must be non-zero"), (l > t.maxDimension || h > t.maxDimension || p > t.maxDimension) && d("limit-exceeded", "texture dimension exceeds maxDimension"), g > t.maxLayers && d("limit-exceeded", "layerCount exceeds maxLayers"), w !== 1 && w !== 6 && d("invalid-dimensions", "faceCount must be one or six"), w === 6 && (h !== l || p !== 0) && d("invalid-dimensions", "cubemap dimensions are invalid"), m === 0 && d("invalid-header", "block-compressed KTX2 must declare levelCount");
    const ce = Math.floor(Math.log2(Math.max(l, h, Math.max(1, p)))) + 1;
    (m > ce || m > t.maxLevels) && d("limit-exceeded", "levelCount is invalid or exceeds maxLevels");
    const de = ae(te, m * ie, n.byteLength, "level index");
    (k === 0 || v < de) && d("invalid-dfd", "DFD is missing or overlaps the level index"), ne(v, k, n.byteLength, "DFD", 4), ne(x, T, n.byteLength, "key/value data", 4), ne(I, L, n.byteLength, "supercompression global data", 8);
    let z;
    y === 0 ? z = "none" : y === 1 ? z = "basis-lz" : y === 2 ? z = "zstandard" : d("invalid-supercompression", `unsupported scheme ${y}`);
    const V = ot(n, v, k), U = V.colorModel === _ ? "etc1s" : "uastc";
    U === "etc1s" && z !== "basis-lz" && d("invalid-supercompression", "ETC1S requires BasisLZ supercompression"), U === "uastc" && z === "basis-lz" && d("invalid-supercompression", "UASTC allows only none or Zstandard supercompression"), U === "uastc" && z === "none" && V.bytesPlane0 !== 16 && d("invalid-dfd", "uncompressed UASTC bytesPlane0 must be sixteen"), U === "uastc" && z === "zstandard" && V.bytesPlane0 !== 0 && d("invalid-dfd", "Zstandard UASTC bytesPlane0 must be zero"), z === "basis-lz" && L < 20 && d("invalid-supercompression", "BasisLZ global data is missing"), z !== "basis-lz" && L !== 0 && d("invalid-supercompression", "unexpected supercompression global data");
    const C = [
      [0, de, "header/index"],
      [v, v + k, "DFD"]
    ];
    T && C.push([x, x + T, "key/value data"]), L && C.push([I, I + L, "supercompression global data"]);
    for (let b = 0; b < C.length; b += 1)
      for (let S = b + 1; S < C.length; S += 1)
        re(C[b], C[S]) && d("invalid-bounds", `${C[b][2]} overlaps ${C[S][2]}`);
    const le = [], ue = [], Te = Math.max(1, g) * w;
    for (let b = 0; b < m; b += 1) {
      be(e.signal);
      const S = te + b * ie, N = K(r, S, `level ${b} byteOffset`), J = K(r, S + 8, `level ${b} byteLength`), $ = K(r, S + 16, `level ${b} uncompressedByteLength`);
      J === 0 && d("invalid-level-index", `level ${b} is empty`), ae(N, J, n.byteLength, `level ${b}`), z === "none" && J !== $ && d("invalid-level-index", `level ${b} uncompressed length must equal byte length`), z === "basis-lz" && $ !== 0 && d("invalid-level-index", `BasisLZ level ${b} uncompressed length must be zero`), z === "zstandard" && $ === 0 && d("invalid-level-index", `Zstandard level ${b} uncompressed length is zero`), $ !== 0 && $ % Te !== 0 && d("invalid-level-index", `level ${b} uncompressed length does not divide into images`);
      const Y = [N, N + J];
      for (const Q of C)
        re(Y, Q) && d("invalid-level-index", `level ${b} overlaps ${Q[2]}`);
      ue.some((Q) => re(Y, Q)) && d("invalid-level-index", `level ${b} overlaps another level`), ue.push(Y), le.push(Object.freeze({
        level: b,
        width: Math.max(1, l >> b),
        height: Math.max(1, h >> b),
        depth: Math.max(1, p >> b),
        byteOffset: N,
        byteLength: J,
        uncompressedByteLength: $
      }));
    }
    const X = rt(n, x, T), Oe = p > 0 ? "3d" : h > 0 ? "2d" : "1d", Ce = m === ce, Ae = Object.freeze({
      vkFormat: a,
      typeSize: c,
      width: l,
      height: h,
      depth: p,
      dimension: Oe,
      layerCount: g,
      faceCount: w,
      levelCount: m,
      supercompression: z,
      encoding: U,
      colorSpace: V.transferFunction === 2 ? "srgb" : "linear",
      hasAlpha: V.hasAlpha,
      completeMipChain: Ce,
      ...X.orientation ? { orientation: X.orientation } : {},
      ...X.swizzle ? { swizzle: X.swizzle } : {},
      premultipliedAlpha: (V.flags & 1) !== 0,
      levels: Object.freeze(le),
      dfd: V
    });
    return new at(Ae, n);
  } catch (r) {
    throw n.fill(0), r;
  }
}
class ct {
  constructor(e) {
    o(this, "disposed", !1);
    o(this, "owned");
    o(this, "width");
    o(this, "height");
    o(this, "encoding");
    o(this, "target");
    o(this, "compressed");
    o(this, "colorSpace");
    o(this, "semantic");
    o(this, "hasAlpha");
    o(this, "completeMipChain");
    o(this, "sampler");
    o(this, "levels");
    o(this, "byteLength");
    if (e.levels.length === 0 || e.levels.length !== e.buffers.length)
      throw new f("transcode-failed", "transcode", "transcoder returned an invalid level count");
    const t = [...e.buffers];
    try {
      for (let s = 0; s < t.length; s += 1) {
        const n = t[s];
        if (!(n instanceof ArrayBuffer) || n.byteLength !== e.levels[s].byteLength)
          throw new f("transcode-failed", "transcode", `transcoded level ${s} byte length is invalid`);
      }
    } catch (s) {
      for (const n of t) n instanceof ArrayBuffer && new Uint8Array(n).fill(0);
      throw s;
    }
    this.owned = t, this.width = e.width, this.height = e.height, this.encoding = e.encoding, this.target = e.target, this.compressed = e.compressed, this.colorSpace = e.colorSpace, this.semantic = e.semantic, this.hasAlpha = e.hasAlpha, this.completeMipChain = e.completeMipChain, this.sampler = e.sampler ? Object.freeze({ ...e.sampler }) : void 0, this.levels = Object.freeze(e.levels.map((s) => Object.freeze({ ...s }))), this.byteLength = this.owned.reduce((s, n) => s + n.byteLength, 0);
  }
  get levelCount() {
    return this.levels.length;
  }
  assertActive() {
    if (this.disposed) throw new f("disposed", "lifecycle", "decoded texture product is disposed");
  }
  /** Copies bytes so public inspection cannot mutate retained decoded data. */
  copyLevelBytes(e) {
    this.assertActive();
    const t = this.owned[e];
    if (!t) throw new RangeError(`KTX2 mip level ${e} is unavailable.`);
    return new Uint8Array(t.slice(0));
  }
  dispose() {
    if (!this.disposed) {
      this.disposed = !0;
      for (const e of this.owned) new Uint8Array(e).fill(0);
    }
  }
}
const dt = new Set(Object.values(O));
function lt(i) {
  if (!i || typeof i != "object" || !Array.isArray(i.supported))
    throw new f("unsupported-target", "selection", "capabilities must contain a supported array");
  const e = /* @__PURE__ */ new Set();
  for (const t of i.supported) {
    if (!dt.has(t))
      throw new f("unsupported-target", "selection", `unknown capability ${String(t)}`);
    if (e.has(t))
      throw new f("unsupported-target", "selection", `duplicate capability ${t}`);
    e.add(t);
  }
  return e;
}
function H(i, e, t) {
  return Object.freeze({ target: i, compressed: !0, basisFormat: t, blockWidth: 4, blockHeight: 4, bytesPerBlockOrPixel: 16, capability: e });
}
function ut(i) {
  const e = lt(i.capabilities), t = i.colorSpace === "srgb";
  if (i.semantic !== "color" && t)
    throw new f("invalid-dfd", "selection", `${i.semantic} textures must use a linear transfer function`);
  if (e.has(O.astc))
    return H(t ? A.astcSrgb : A.astcLinear, O.astc, 10);
  if (i.semantic === "normal" && e.has(O.bc5))
    return H(A.bc5Linear, O.bc5, 5);
  if (e.has(O.bc7))
    return H(t ? A.bc7Srgb : A.bc7Linear, O.bc7, 6);
  if ((i.encoding === "etc1s" || i.semantic === "color") && e.has(O.etc2))
    return H(t ? A.etc2Srgb : A.etc2Linear, O.etc2, 1);
  if (i.allowRgbaFallback !== !1 && e.has(O.rgba8))
    return Object.freeze({
      target: t ? A.rgba8Srgb : A.rgba8Linear,
      compressed: !1,
      basisFormat: 13,
      blockWidth: 1,
      blockHeight: 1,
      bytesPerBlockOrPixel: 4,
      capability: O.rgba8
    });
  throw new f("unsupported-target", "selection", "no qualified texture target is available");
}
function ht(i, e, t) {
  const s = Math.ceil(i / t.blockWidth), n = Math.ceil(e / t.blockHeight), r = s * t.bytesPerBlockOrPixel, a = r * n;
  if (!Number.isSafeInteger(a))
    throw new f("expansion-limit-exceeded", "selection", "target level byte length overflows");
  return Object.freeze({ byteLength: a, bytesPerRow: r, rowsPerImage: n });
}
function ft(i) {
  let e = 2166136261, t = 2654435769;
  for (const s of i)
    e = Math.imul(e ^ s, 16777619) >>> 0, t = Math.imul(t ^ s + 1, 2246822507) >>> 0;
  return `${e.toString(16).padStart(8, "0")}${t.toString(16).padStart(8, "0")}:${i.byteLength}`;
}
function mt(i) {
  return i instanceof f ? i : i instanceof u && i.code === "cancelled" ? new f("cancelled", "transcode", "Basis transcode was cancelled", { cause: i }) : new f("transcode-failed", "transcode", "Basis Universal execution failed", { cause: i });
}
class pt {
  constructor(e) {
    o(this, "runtime");
    this.runtime = e;
  }
  metrics() {
    return this.runtime.metrics();
  }
  async transcode(e, t) {
    e.assertActive();
    const s = e.info, n = t.semantic ?? (s.colorSpace === "srgb" ? "color" : "data");
    if (s.dimension !== "2d" || s.layerCount !== 0 || s.faceCount !== 1 || s.depth !== 0)
      throw new f("unsupported-texture-type", "transcode", "Phase 4 supports non-array 2D Basis textures; arrays, cubes and 3D are rejected");
    if (s.orientation !== void 0 && s.orientation !== "rd")
      throw new f("unsupported-texture-type", "transcode", `unsupported KTX orientation ${s.orientation}`);
    if (s.swizzle !== void 0 && s.swizzle !== "rgba")
      throw new f("unsupported-texture-type", "transcode", `unsupported KTX swizzle ${s.swizzle}`);
    const r = ut({
      capabilities: t.capabilities,
      encoding: s.encoding,
      colorSpace: s.colorSpace,
      semantic: n,
      hasAlpha: s.hasAlpha,
      allowRgbaFallback: t.allowRgbaFallback
    }), a = [];
    let c = 0;
    for (const m of s.levels) {
      const y = ht(m.width, m.height, r);
      if (c += y.byteLength, !Number.isSafeInteger(c))
        throw new f("expansion-limit-exceeded", "selection", "total output byte length overflows");
      a.push(Object.freeze({
        level: m.level,
        width: m.width,
        height: m.height,
        depth: 1,
        layer: 0,
        face: 0,
        ...y
      }));
    }
    const l = ze(t.limits);
    if (c > l.maxDecodedBytes || c > e.byteLength * l.maxExpansionRatio)
      throw new f("expansion-limit-exceeded", "selection", "transcoded output exceeds configured expansion limits");
    const h = e.copyBytes(), p = t.cacheKey ?? ft(h), g = M.copyOf([h]);
    h.fill(0);
    let w;
    try {
      w = await this.runtime.execute({
        key: `${p}|${r.target}|${n}`,
        operation: "ktx2.transcode",
        input: g,
        metadata: Object.freeze({
          target: r.target,
          basisFormat: r.basisFormat,
          levelCount: s.levelCount,
          semantic: n,
          colorSpace: s.colorSpace,
          hasAlpha: s.hasAlpha
        }),
        signal: t.signal,
        maxOutputBytes: c
      });
      const m = w.takeBuffers();
      return new ct({
        width: s.width,
        height: s.height,
        encoding: s.encoding,
        target: r.target,
        compressed: r.compressed,
        colorSpace: s.colorSpace,
        semantic: n,
        hasAlpha: s.hasAlpha,
        completeMipChain: s.completeMipChain,
        levels: a,
        buffers: m
      });
    } catch (m) {
      throw w?.release(), mt(m);
    }
  }
  destroy() {
    return this.runtime.destroy();
  }
}
const wt = "forgeng.codec.basis-universal", ye = `artifacts/${q}`, bt = Object.freeze({
  worker: Object.freeze({
    kind: "worker",
    uri: `${ye}/basis-worker.mjs`,
    sha256: "fbf6a6997edd0df76d067226326a27e562172532dad8c8cb7c11881a53004bc8",
    byteLength: 32495,
    implementationVersion: q
  }),
  wasm: Object.freeze({
    kind: "wasm",
    uri: `${ye}/basis-transcoder.wasm`,
    sha256: "7ebf8dee138bea35cf5b71f1f408de6f4997d77cf56ab6c070ab74690b753078",
    byteLength: 1014021,
    implementationVersion: q
  })
});
function gt(i, e = {}) {
  const t = e.artifacts ?? bt;
  return new pt(new it({
    implementation: Object.freeze({
      id: wt,
      implementationVersion: q,
      worker: t.worker,
      wasm: t.wasm
    }),
    platform: i,
    mode: "worker",
    maxWorkers: e.maxWorkers ?? 2,
    maxQueuedJobs: e.maxQueuedJobs ?? 64,
    maxInputBytes: B.maxInputBytes,
    maxOutputBytes: B.maxDecodedBytes,
    defaultTimeoutMs: e.defaultTimeoutMs ?? 3e4,
    initializationTimeoutMs: e.initializationTimeoutMs ?? 15e3
  }));
}
function yt(i) {
  const e = i?.semantic;
  if (e === void 0) return i?.normalMap === !0 ? "normal" : void 0;
  if (e === "color" || e === "data" || e === "normal") return e;
  throw new f("invalid-header", "container", "asset option semantic must be color, data or normal");
}
class vt {
  constructor(e) {
    o(this, "options");
    o(this, "transcoder");
    this.options = e;
  }
  async initialize(e) {
    this.transcoder = this.options.createTranscoder();
  }
  async decode(e) {
    if (!this.transcoder) throw new Error("KTX2 decoder is not initialized.");
    const t = Le(e.source.bytes, { limits: this.options.limits, signal: e.signal });
    try {
      const s = await this.transcoder.transcode(t, {
        capabilities: this.options.capabilities,
        semantic: yt(e.asset.options),
        allowRgbaFallback: e.asset.options?.allowRgbaFallback !== !1,
        limits: this.options.limits,
        signal: e.signal,
        cacheKey: `${e.source.source.uri}|${e.asset.id}`
      });
      return { value: s, byteLength: s.byteLength, dispose: () => s.dispose() };
    } finally {
      t.dispose();
    }
  }
  async destroy() {
    const e = this.transcoder;
    this.transcoder = void 0, await e?.destroy();
  }
}
function St(i) {
  const e = Object.freeze({
    capabilities: Object.freeze({ supported: Object.freeze([...i.capabilities.supported]) }),
    createTranscoder: i.createTranscoder,
    limits: i.limits ? Object.freeze({ ...i.limits }) : void 0
  });
  return Object.freeze({
    id: "forgeng.assets.ktx2.decoder",
    contractVersion: "1.0.0",
    implementationVersion: ke,
    capabilities: Object.freeze([]),
    kinds: Object.freeze([R]),
    create: () => new vt(e)
  });
}
class xt extends Error {
  constructor(t, s, n, r = `gltf.${t}`, a) {
    super(`glTF ${s}: ${n}`, a);
    o(this, "code");
    o(this, "phase");
    o(this, "formatCode");
    this.code = t, this.phase = s, this.formatCode = r;
  }
  get name() {
    return "GLTFLoadError";
  }
}
const kt = "forgeng.ktx2.gltf-textures";
class zt {
  constructor(e) {
    o(this, "disposed", !1);
    o(this, "bindings");
    o(this, "byteLength");
    const t = /* @__PURE__ */ new Map(), s = /* @__PURE__ */ new Set();
    for (const n of e) {
      if (t.has(n.textureIndex)) throw new f("transcode-failed", "transcode", "duplicate glTF texture binding");
      t.set(n.textureIndex, Object.freeze({ ...n })), s.add(n.texture);
    }
    this.bindings = t, this.byteLength = [...s].reduce((n, r) => n + r.byteLength, 0);
  }
  get textureIndices() {
    return Object.freeze([...this.bindings.keys()].sort((e, t) => e - t));
  }
  get(e) {
    if (this.disposed) throw new f("disposed", "lifecycle", "glTF KTX2 texture set is disposed");
    return this.bindings.get(e);
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = !0;
    const e = new Set([...this.bindings.values()].map((t) => t.texture));
    for (const t of e) t.dispose();
  }
}
function Z(i, e) {
  if (!i || typeof i != "object" || Array.isArray(i)) throw new f("invalid-header", "container", e);
  return i;
}
function Lt(i, e) {
  const t = Z(i, `texture ${e}`), s = Z(t.extensions, `texture ${e} extensions`), n = Z(s[W], `texture ${e} ${W}`), r = Object.keys(n);
  if (r.length !== 1 || r[0] !== "source" || !Number.isSafeInteger(n.source) || n.source < 0)
    throw new f("invalid-header", "container", `texture ${e} ${W}.source`);
  return n.source;
}
function Tt(i) {
  const e = /* @__PURE__ */ new Map(), t = (s, n, r) => {
    if (s === void 0) return;
    const a = Z(s, r).index;
    if (!Number.isSafeInteger(a)) throw new f("invalid-header", "container", `${r}.index`);
    const c = e.get(a);
    if (c && c !== n) throw new f("invalid-dfd", "selection", `texture ${a} is used with conflicting color semantics`);
    e.set(a, n);
  };
  for (const [s, n] of (i.materials ?? []).entries())
    t(n.pbrMetallicRoughness?.baseColorTexture, "color", `material ${s} baseColorTexture`), t(n.emissiveTexture, "color", `material ${s} emissiveTexture`), t(n.normalTexture, "normal", `material ${s} normalTexture`), t(n.pbrMetallicRoughness?.metallicRoughnessTexture, "data", `material ${s} metallicRoughnessTexture`), t(n.occlusionTexture, "data", `material ${s} occlusionTexture`);
  return e;
}
function Ot(i, e) {
  const t = e === void 0 ? void 0 : i.samplers?.[e], s = t?.magFilter === 9728 ? "nearest" : "linear";
  let n = "linear", r = "linear", a = !0;
  switch (t?.minFilter) {
    case 9728:
      n = "nearest", r = "nearest", a = !1;
      break;
    case 9729:
      n = "linear", r = "nearest", a = !1;
      break;
    case 9984:
      n = "nearest", r = "nearest";
      break;
    case 9985:
      n = "linear", r = "nearest";
      break;
    case 9986:
      n = "nearest", r = "linear";
      break;
  }
  const c = (l) => l === 33071 ? "clamp-to-edge" : l === 33648 ? "mirror-repeat" : "repeat";
  return Object.freeze({
    magFilter: s,
    minFilter: n,
    mipmapFilter: r,
    addressModeU: c(t?.wrapS),
    addressModeV: c(t?.wrapT),
    usesMipmaps: a
  });
}
function Ct(i, e) {
  if (/^(?:data:|https?:)/i.test(e)) return e;
  if (e.includes("\\") || e.includes("\0")) throw new f("invalid-header", "container", "KTX2 image URI is invalid");
  const t = i.split("#", 1)[0].split("?", 1)[0], s = /^(https?:\/\/[^/]+)/i.exec(t)?.[1] ?? "";
  if (e.startsWith("/")) return `${s}${e}`;
  const r = `${t.slice(0, t.lastIndexOf("/") + 1)}${e}`.split("/"), a = [];
  for (const c of r)
    c === ".." && a.length > 3 ? a.pop() : c !== "." && a.push(c);
  return a.join("/");
}
function At(i) {
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
function Bt(i, e, t, s, n, r, a) {
  const c = i.images?.[t];
  if (!c) throw new f("invalid-header", "container", `image ${t} does not exist`);
  if (c.mimeType !== void 0 && c.mimeType !== R)
    throw new f("invalid-header", "container", `image ${t} MIME must be ${R}`);
  if (c.bufferView !== void 0) {
    if (c.mimeType !== R) throw new f("invalid-header", "container", `embedded image ${t} MIME is missing`);
    const l = i.bufferViews?.[c.bufferView], h = l ? e[l.buffer] : void 0;
    if (!l || !h) throw new f("invalid-bounds", "container", `image ${t} bufferView is unavailable`);
    const p = l.byteOffset ?? 0, g = p + l.byteLength;
    if (!Number.isSafeInteger(g) || g > h.byteLength || l.byteLength > a)
      throw new f("limit-exceeded", "container", `image ${t} bufferView exceeds limits`);
    return Promise.resolve(Object.freeze({ bytes: new Uint8Array(h.slice(p, g)), contentType: R }));
  }
  if (!c.uri) throw new f("invalid-header", "container", `image ${t} has no source`);
  return n.read(Ct(s, c.uri), r, a);
}
function Mt(i) {
  const e = Object.freeze({ supported: Object.freeze([...i.capabilities.supported]) }), t = Object.freeze({ ...i.limits });
  return Object.freeze({
    id: "forgeng.assets.ktx2.gltf",
    implementationVersion: ke,
    extensions: Object.freeze([W]),
    decode: async (s) => {
      const n = At(s.signal), r = i.createTranscoder(), a = /* @__PURE__ */ new Map(), c = [];
      let l;
      try {
        const h = Tt(s.document), p = JSON.parse(JSON.stringify(s.document));
        for (const [w, m] of (s.document.textures ?? []).entries()) {
          if (m.extensions?.[W] === void 0) continue;
          const v = Lt(m, w), k = h.get(w) ?? "data", x = `${v}:${k}`;
          let T = a.get(x);
          if (!T) {
            const I = await Bt(
              s.document,
              s.buffers,
              v,
              s.sourceUrl,
              i.source,
              s.signal,
              t.maxInputBytes ?? 67108864
            );
            if (I.contentType !== void 0 && I.contentType !== R && I.contentType !== "application/octet-stream")
              throw new f("invalid-header", "container", `image ${v} source MIME is inconsistent`);
            const L = Le(I.bytes, { limits: t, signal: n });
            try {
              if (k === "color" != (L.info.colorSpace === "srgb"))
                throw new f("invalid-dfd", "selection", `texture ${w} DFD color space does not match glTF material use`);
              if (L.info.premultipliedAlpha)
                throw new f("invalid-dfd", "selection", "premultiplied alpha is not valid for core glTF materials");
              if (L.info.width % 4 !== 0 || L.info.height % 4 !== 0)
                throw new f("invalid-dimensions", "container", "KHR_texture_basisu dimensions must be multiples of four");
              T = await r.transcode(L, {
                capabilities: e,
                semantic: k,
                allowRgbaFallback: i.allowRgbaFallback,
                limits: t,
                signal: n,
                cacheKey: `${s.sourceUrl}|image:${v}|${k}`
              });
            } finally {
              L.dispose();
            }
            a.set(x, T);
          }
          c.push(Object.freeze({
            textureIndex: w,
            imageIndex: v,
            texture: T,
            sampler: Ot(s.document, m.sampler)
          })), p.textures[w].source = v;
        }
        l = new zt(c);
        const g = l;
        return Object.freeze({
          document: p,
          products: Object.freeze([{ id: kt, value: g, byteLength: g.byteLength }]),
          dispose: () => {
            g.dispose(), r.destroy();
          }
        });
      } catch (h) {
        if (l?.dispose(), !l) for (const p of new Set(a.values())) p.dispose();
        throw await r.destroy(), h instanceof f || h instanceof xt ? h : new f("transcode-failed", "transcode", "KHR_texture_basisu decode failed", { cause: h });
      }
    }
  });
}
function Vt(i = {}) {
  return gt(Pe(i.platform), i);
}
export {
  bt as KTX2_BASIS_ARTIFACTS,
  ye as KTX2_BASIS_ARTIFACT_ROOT,
  wt as KTX2_BASIS_CODEC_ID,
  Vt as createBrowserKTX2BasisTranscoder,
  St as createKTX2AssetDecoderDescriptor,
  Mt as createKTX2GLTFExtension
};

