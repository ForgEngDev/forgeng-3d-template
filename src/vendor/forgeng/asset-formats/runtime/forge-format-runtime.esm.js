var h = Object.defineProperty;
var p = (o, e, a) => e in o ? h(o, e, { enumerable: !0, configurable: !0, writable: !0, value: a }) : o[e] = a;
var l = (o, e, a) => p(o, typeof e != "symbol" ? e + "" : e, a);
const b = Number.MAX_SAFE_INTEGER, w = 16, f = (o, e) => Math.min(b, o + Math.max(0, e));
class x {
  constructor(e) {
    l(this, "formats", /* @__PURE__ */ new Map());
    l(this, "codecs", /* @__PURE__ */ new Map());
    l(this, "targets", /* @__PURE__ */ new Set());
    l(this, "failures", []);
    this.addFormat("forgeng.assets.engine3d.gltf-decoder", "2.4.4", ["model/gltf"]);
    const a = new Set(e.flatMap((s) => (s.capabilities ?? []).map((c) => c.id)));
    (a.has("forgeng.gltf.ktx2") || a.has("forgeng.texture.ktx2.standalone")) && (this.addFormat("forgeng.assets.ktx2.decoder", "1.0.0", ["image/ktx2"]), this.addCodec("forgeng.codec.basis-universal", "2.50.0-forgeng.1")), a.has("forgeng.gltf.meshopt") && this.addCodec("forgeng.codec.meshoptimizer", "1.1.1-forgeng.1"), a.has("forgeng.gltf.draco") && this.addCodec("forgeng.codec.draco", "1.5.7-forgeng.1");
  }
  formatCompleted(e, a, s) {
    const c = this.formats.get(e) ?? this.addFormat(e, a, []);
    c.active = !0, c.operations = f(c.operations, 1), c.totalMs = f(c.totalMs, s), c.maximumMs = Math.max(c.maximumMs, s);
  }
  codecCompleted(e, a, s, c = 1) {
    const i = this.codecs.get(e) ?? this.addCodec(e, a);
    i.active = !0, i.operations = f(i.operations, 1), i.totalMs = f(i.totalMs, s), i.maximumMs = Math.max(i.maximumMs, s), i.workerQueueDepthHighWater = Math.max(i.workerQueueDepthHighWater, Math.max(0, c));
  }
  textureTargetSelected(e) {
    /^[a-z0-9][a-z0-9-]{0,63}$/.test(e) && this.targets.size < 16 && this.targets.add(e);
  }
  failure(e) {
    const a = Object.freeze({
      code: /^[a-z0-9][a-z0-9._-]{0,95}$/.test(e.code) ? e.code : "format.failure",
      stage: e.stage,
      ...e.formatId ? { formatId: e.formatId } : {},
      ...e.codecId ? { codecId: e.codecId } : {}
    });
    if (this.failures.unshift(a), this.failures.length = Math.min(this.failures.length, w), a.codecId) {
      const s = this.codecs.get(a.codecId);
      s && (s.failures = f(s.failures, 1));
    }
  }
  snapshot(e, a) {
    const s = Object.freeze([...this.formats.values()].sort((r, t) => r.id.localeCompare(t.id)).map((r) => Object.freeze({
      id: r.id,
      implementationVersion: r.implementationVersion,
      kinds: Object.freeze([...r.kinds]),
      active: r.active,
      operations: r.operations,
      totalMs: r.totalMs,
      maximumMs: r.maximumMs
    }))), c = Object.freeze([...this.codecs.values()].sort((r, t) => r.id.localeCompare(t.id)).map((r) => Object.freeze({
      id: r.id,
      implementationVersion: r.implementationVersion,
      active: r.active,
      operations: r.operations,
      totalMs: r.totalMs,
      maximumMs: r.maximumMs,
      workerQueueDepthHighWater: r.workerQueueDepthHighWater,
      failures: r.failures
    }))), i = Object.freeze([...this.targets].sort());
    return Object.freeze({
      formats: s,
      codecs: c,
      progress: Object.freeze({
        registered: e.assets.length,
        active: e.assets.filter((r) => r.state === "queued" || r.state === "loading").length,
        ready: e.assets.filter((r) => r.state === "ready").length,
        failed: e.assets.filter((r) => r.state === "failed").length,
        cancelled: a.counters.cancelled
      }),
      bytes: Object.freeze({ source: e.sourceBytes, decoded: e.decodedBytes, realized: e.realizedBytes }),
      selectedTextureTarget: i[i.length - 1] ?? null,
      selectedTextureTargets: i,
      failures: Object.freeze([...this.failures])
    });
  }
  addFormat(e, a, s) {
    const c = {
      id: e,
      implementationVersion: a,
      kinds: Object.freeze([...s]),
      active: !1,
      operations: 0,
      totalMs: 0,
      maximumMs: 0
    };
    return this.formats.set(e, c), c;
  }
  addCodec(e, a) {
    const s = {
      id: e,
      implementationVersion: a,
      kinds: Object.freeze([]),
      active: !1,
      operations: 0,
      totalMs: 0,
      maximumMs: 0,
      workerQueueDepthHighWater: 0,
      failures: 0
    };
    return this.codecs.set(e, s), s;
  }
}
const z = (o) => new Set(
  o.formats.flatMap((e) => (e.capabilities ?? []).map((a) => a.id))
);
function T(o) {
  return {
    ...o.artifactBaseUrl ? { baseUrl: o.artifactBaseUrl } : {},
    ...o.allowedOrigins ? { allowedOrigins: o.allowedOrigins } : {}
  };
}
function M(o, e) {
  if (e.textureTargets?.length) return e.textureTargets;
  let a;
  try {
    a = o.getDevice?.().features;
  } catch {
  }
  const s = [];
  return a?.has("texture-compression-astc") && s.push("astc-4x4"), a?.has("texture-compression-bc") && s.push("bc7", "bc5"), a?.has("texture-compression-etc2") && s.push("etc2-rgba8"), e.allowRgbaFallback !== !1 && s.push("rgba8"), Object.freeze(s);
}
function g(o, e) {
  const a = e.replace(/\\/g, "/").split("/"), s = a[a.length - 1];
  if (!s) throw new TypeError(`Codec artifact URI "${e}" is invalid.`);
  return `codecs/${o}/${s}`;
}
async function C(o, e) {
  const a = z(o), s = T(o.codecPolicy), c = o.codecPolicy.maxWorkers ?? 2, i = {};
  if (a.has("forgeng.gltf.ktx2") || a.has("forgeng.texture.ktx2.standalone")) {
    let t;
    const d = async () => t ?? (t = await import("../ktx2/forge-ktx2-browser.esm.js"));
    i.ktx2 = {
      loadModule: d,
      standalone: a.has("forgeng.texture.ktx2.standalone"),
      gltf: a.has("forgeng.gltf.ktx2"),
      capabilities: Object.freeze({ supported: M(e, o.codecPolicy) }),
      allowRgbaFallback: o.codecPolicy.allowRgbaFallback !== !1,
      createTranscoder: () => {
        if (!t) throw new Error("KTX2 integration module was not initialized.");
        return t.createBrowserKTX2BasisTranscoder({
          platform: s,
          maxWorkers: c,
          artifacts: Object.freeze({
            worker: Object.freeze({ ...t.KTX2_BASIS_ARTIFACTS.worker, uri: g("basis-universal", t.KTX2_BASIS_ARTIFACTS.worker.uri) }),
            wasm: Object.freeze({ ...t.KTX2_BASIS_ARTIFACTS.wasm, uri: g("basis-universal", t.KTX2_BASIS_ARTIFACTS.wasm.uri) })
          })
        });
      }
    };
  }
  if (a.has("forgeng.gltf.meshopt")) {
    let t;
    const d = async () => t ?? (t = await import("../meshopt/forge-meshopt-browser.esm.js"));
    i.meshopt = {
      loadModule: d,
      createDecoder: () => {
        if (!t) throw new Error("Meshopt integration module was not initialized.");
        return t.createBrowserMeshoptDecoder({
          platform: s,
          maxWorkers: c,
          artifacts: Object.freeze({ worker: Object.freeze({ ...t.MESHOPT_ARTIFACTS.worker, uri: g("meshoptimizer", t.MESHOPT_ARTIFACTS.worker.uri) }) })
        });
      }
    };
  }
  if (a.has("forgeng.gltf.draco")) {
    let t;
    const d = async () => t ?? (t = await import("../draco/forge-draco-browser.esm.js"));
    i.draco = {
      loadModule: d,
      createDecoder: () => {
        if (!t) throw new Error("Draco integration module was not initialized.");
        return t.createBrowserDracoDecoder({
          platform: s,
          maxWorkers: c,
          artifacts: Object.freeze({
            worker: Object.freeze({ ...t.DRACO_ARTIFACTS.worker, uri: g("draco", t.DRACO_ARTIFACTS.worker.uri) }),
            wasm: Object.freeze({ ...t.DRACO_ARTIFACTS.wasm, uri: g("draco", t.DRACO_ARTIFACTS.wasm.uri) })
          })
        });
      }
    };
  }
  const r = new x(o.formats);
  return Object.freeze({
    adapters: i,
    diagnostics: r,
    decorate: (t) => Object.freeze({
      decoders: Object.freeze(t.decoders.map((d) => O(d, r))),
      realizers: t.realizers
    }),
    decorateRuntime: (t) => Object.freeze({
      game: t.game,
      acquire: t.acquire.bind(t),
      recover: t.recover.bind(t),
      preload: t.preload.bind(t),
      createScope: t.createScope.bind(t),
      subscribeProgress: t.subscribeProgress.bind(t),
      snapshot: t.snapshot.bind(t),
      inspect: () => {
        const d = t.inspect();
        return Object.freeze({
          ...d,
          formatDiagnostics: r.snapshot(d.runtime, d.metrics)
        });
      },
      readCompatibilitySource: t.readCompatibilitySource.bind(t),
      destroy: t.destroy.bind(t)
    })
  });
}
function O(o, e) {
  return o.id !== "forgeng.assets.engine3d.gltf-decoder" && o.id !== "forgeng.assets.ktx2.decoder" ? o : Object.freeze({
    ...o,
    create: (a) => {
      const s = o.create(a);
      return {
        initialize: (c) => s.initialize(c),
        decode: async (c) => {
          const i = globalThis.performance?.now() ?? Date.now();
          try {
            const r = await s.decode(c), t = (globalThis.performance?.now() ?? Date.now()) - i;
            e.formatCompleted(o.id, o.implementationVersion, t);
            const d = r.value;
            d.target && e.textureTargetSelected(d.target);
            for (const m of d.product?.extensionVersions ?? []) {
              const n = m.split("@")[0];
              n === "forgeng.assets.meshopt.gltf" && e.codecCompleted("forgeng.codec.meshoptimizer", "1.1.1-forgeng.1", t), n === "forgeng.assets.draco.gltf" && e.codecCompleted("forgeng.codec.draco", "1.5.7-forgeng.1", t), n === "forgeng.assets.ktx2.gltf" && e.codecCompleted("forgeng.codec.basis-universal", "2.50.0-forgeng.1", t);
            }
            const u = d.getExtensionProduct?.("forgeng.ktx2.gltf-textures");
            for (const m of u?.textureIndices ?? []) {
              const n = u?.get?.(m)?.texture?.target;
              n && e.textureTargetSelected(n);
            }
            return o.id === "forgeng.assets.ktx2.decoder" && e.codecCompleted("forgeng.codec.basis-universal", "2.50.0-forgeng.1", t), r;
          } catch (r) {
            throw e.failure({
              code: typeof r?.formatCode == "string" ? r.formatCode : "format.decode-failed",
              stage: "decode",
              formatId: o.id
            }), r;
          }
        },
        destroy: () => s.destroy()
      };
    }
  });
}
export {
  C as createOfficialFormatRuntime
};

