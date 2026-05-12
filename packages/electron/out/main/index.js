import { ipcMain, app, BrowserWindow } from "electron";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";
import "node:fs/promises";
import { spawn } from "node:child_process";
const pipeArguments = (self, args2) => {
  switch (args2.length) {
    case 0:
      return self;
    case 1:
      return args2[0](self);
    case 2:
      return args2[1](args2[0](self));
    case 3:
      return args2[2](args2[1](args2[0](self)));
    case 4:
      return args2[3](args2[2](args2[1](args2[0](self))));
    case 5:
      return args2[4](args2[3](args2[2](args2[1](args2[0](self)))));
    case 6:
      return args2[5](args2[4](args2[3](args2[2](args2[1](args2[0](self))))));
    case 7:
      return args2[6](args2[5](args2[4](args2[3](args2[2](args2[1](args2[0](self)))))));
    case 8:
      return args2[7](args2[6](args2[5](args2[4](args2[3](args2[2](args2[1](args2[0](self))))))));
    case 9:
      return args2[8](args2[7](args2[6](args2[5](args2[4](args2[3](args2[2](args2[1](args2[0](self)))))))));
    default: {
      let ret = self;
      for (let i = 0, len = args2.length; i < len; i++) {
        ret = args2[i](ret);
      }
      return ret;
    }
  }
};
const Prototype = {
  pipe() {
    return pipeArguments(this, arguments);
  }
};
const Class$1 = /* @__PURE__ */ (function() {
  function PipeableBase() {
  }
  PipeableBase.prototype = Prototype;
  return PipeableBase;
})();
const dual = function(arity, body) {
  if (typeof arity === "function") {
    return function() {
      return arity(arguments) ? body.apply(this, arguments) : (self) => body(self, ...arguments);
    };
  }
  switch (arity) {
    case 0:
    case 1:
      throw new RangeError(`Invalid arity ${arity}`);
    case 2:
      return function(a, b) {
        if (arguments.length >= 2) {
          return body(a, b);
        }
        return function(self) {
          return body(self, a);
        };
      };
    case 3:
      return function(a, b, c) {
        if (arguments.length >= 3) {
          return body(a, b, c);
        }
        return function(self) {
          return body(self, a, b);
        };
      };
    default:
      return function() {
        if (arguments.length >= arity) {
          return body.apply(this, arguments);
        }
        const args2 = arguments;
        return function(self) {
          return body(self, ...args2);
        };
      };
  }
};
const identity = (a) => a;
const constant = (value) => () => value;
const constTrue = /* @__PURE__ */ constant(true);
const constFalse = /* @__PURE__ */ constant(false);
const constUndefined = /* @__PURE__ */ constant(void 0);
const constVoid = constUndefined;
function flow(ab, bc, cd, de, ef, fg, gh, hi, ij) {
  switch (arguments.length) {
    case 1:
      return ab;
    case 2:
      return function() {
        return bc(ab.apply(this, arguments));
      };
    case 3:
      return function() {
        return cd(bc(ab.apply(this, arguments)));
      };
    case 4:
      return function() {
        return de(cd(bc(ab.apply(this, arguments))));
      };
    case 5:
      return function() {
        return ef(de(cd(bc(ab.apply(this, arguments)))));
      };
    case 6:
      return function() {
        return fg(ef(de(cd(bc(ab.apply(this, arguments))))));
      };
    case 7:
      return function() {
        return gh(fg(ef(de(cd(bc(ab.apply(this, arguments)))))));
      };
    case 8:
      return function() {
        return hi(gh(fg(ef(de(cd(bc(ab.apply(this, arguments))))))));
      };
    case 9:
      return function() {
        return ij(hi(gh(fg(ef(de(cd(bc(ab.apply(this, arguments)))))))));
      };
  }
  return;
}
function memoize(f) {
  const cache = /* @__PURE__ */ new WeakMap();
  return (a) => {
    if (cache.has(a)) {
      return cache.get(a);
    }
    const result2 = f(a);
    cache.set(a, result2);
    return result2;
  };
}
const getAllObjectKeys = (obj) => {
  const keys2 = new Set(Reflect.ownKeys(obj));
  if (obj.constructor === Object) return keys2;
  if (obj instanceof Error) {
    keys2.delete("stack");
  }
  const proto = Object.getPrototypeOf(obj);
  let current = proto;
  while (current !== null && current !== Object.prototype) {
    const ownKeys = Reflect.ownKeys(current);
    for (let i = 0; i < ownKeys.length; i++) {
      keys2.add(ownKeys[i]);
    }
    current = Object.getPrototypeOf(current);
  }
  if (keys2.has("constructor") && typeof obj.constructor === "function" && proto === obj.constructor.prototype) {
    keys2.delete("constructor");
  }
  return keys2;
};
const byReferenceInstances = /* @__PURE__ */ new WeakSet();
function isString(input) {
  return typeof input === "string";
}
function isNumber(input) {
  return typeof input === "number";
}
function isBoolean(input) {
  return typeof input === "boolean";
}
function isSymbol(input) {
  return typeof input === "symbol";
}
function isPropertyKey(u) {
  return isString(u) || isNumber(u) || isSymbol(u);
}
function isFunction(input) {
  return typeof input === "function";
}
function isNotUndefined(input) {
  return input !== void 0;
}
function isNotNullish(input) {
  return input != null;
}
function isUnknown(_) {
  return true;
}
function isObjectKeyword(input) {
  return typeof input === "object" && input !== null || isFunction(input);
}
const hasProperty = /* @__PURE__ */ dual(2, (self, property) => isObjectKeyword(self) && property in self);
const isTagged = /* @__PURE__ */ dual(2, (self, tag2) => hasProperty(self, "_tag") && self["_tag"] === tag2);
function isIterable(input) {
  return hasProperty(input, Symbol.iterator) || isString(input);
}
const or = /* @__PURE__ */ dual(2, (self, that) => (a) => self(a) || that(a));
const symbol$1 = "~effect/interfaces/Hash";
const hash = (self) => {
  switch (typeof self) {
    case "number":
      return number$1(self);
    case "bigint":
      return string$2(self.toString(10));
    case "boolean":
      return string$2(String(self));
    case "symbol":
      return string$2(String(self));
    case "string":
      return string$2(self);
    case "undefined":
      return string$2("undefined");
    case "function":
    case "object": {
      if (self === null) {
        return string$2("null");
      } else if (self instanceof Date) {
        return string$2(self.toISOString());
      } else if (self instanceof RegExp) {
        return string$2(self.toString());
      } else {
        if (byReferenceInstances.has(self)) {
          return random(self);
        }
        if (hashCache.has(self)) {
          return hashCache.get(self);
        }
        const h = withVisitedTracking$1(self, () => {
          if (isHash(self)) {
            return self[symbol$1]();
          } else if (typeof self === "function") {
            return random(self);
          } else if (Array.isArray(self) || ArrayBuffer.isView(self)) {
            return array(self);
          } else if (self instanceof Map) {
            return hashMap(self);
          } else if (self instanceof Set) {
            return hashSet(self);
          }
          return structure(self);
        });
        hashCache.set(self, h);
        return h;
      }
    }
    default:
      throw new Error(`BUG: unhandled typeof ${typeof self} - please report an issue at https://github.com/Effect-TS/effect/issues`);
  }
};
const random = (self) => {
  if (!randomHashCache.has(self)) {
    randomHashCache.set(self, number$1(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)));
  }
  return randomHashCache.get(self);
};
const combine = /* @__PURE__ */ dual(2, (self, b) => self * 53 ^ b);
const optimize = (n) => n & 3221225471 | n >>> 1 & 1073741824;
const isHash = (u) => hasProperty(u, symbol$1);
const number$1 = (n) => {
  if (n !== n) {
    return string$2("NaN");
  }
  if (n === Infinity) {
    return string$2("Infinity");
  }
  if (n === -Infinity) {
    return string$2("-Infinity");
  }
  let h = n | 0;
  if (h !== n) {
    h ^= n * 4294967295;
  }
  while (n > 4294967295) {
    h ^= n /= 4294967295;
  }
  return optimize(h);
};
const string$2 = (str) => {
  let h = 5381, i = str.length;
  while (i) {
    h = h * 33 ^ str.charCodeAt(--i);
  }
  return optimize(h);
};
const structureKeys = (o, keys2) => {
  let h = 12289;
  for (const key of keys2) {
    h ^= combine(hash(key), hash(o[key]));
  }
  return optimize(h);
};
const structure = (o) => structureKeys(o, getAllObjectKeys(o));
const iterableWith = (seed, f) => (iter) => {
  let h = seed;
  for (const element of iter) {
    h ^= f(element);
  }
  return optimize(h);
};
const array = /* @__PURE__ */ iterableWith(6151, hash);
const hashMap = /* @__PURE__ */ iterableWith(/* @__PURE__ */ string$2("Map"), ([k, v]) => combine(hash(k), hash(v)));
const hashSet = /* @__PURE__ */ iterableWith(/* @__PURE__ */ string$2("Set"), hash);
const randomHashCache = /* @__PURE__ */ new WeakMap();
const hashCache = /* @__PURE__ */ new WeakMap();
const visitedObjects = /* @__PURE__ */ new WeakSet();
function withVisitedTracking$1(obj, fn2) {
  if (visitedObjects.has(obj)) {
    return string$2("[Circular]");
  }
  visitedObjects.add(obj);
  const result2 = fn2();
  visitedObjects.delete(obj);
  return result2;
}
const symbol = "~effect/interfaces/Equal";
function equals$1() {
  if (arguments.length === 1) {
    return (self) => compareBoth(self, arguments[0]);
  }
  return compareBoth(arguments[0], arguments[1]);
}
function compareBoth(self, that) {
  if (self === that) return true;
  if (self == null || that == null) return false;
  const selfType = typeof self;
  if (selfType !== typeof that) {
    return false;
  }
  if (selfType === "number" && self !== self && that !== that) {
    return true;
  }
  if (selfType !== "object" && selfType !== "function") {
    return false;
  }
  if (byReferenceInstances.has(self) || byReferenceInstances.has(that)) {
    return false;
  }
  return withCache(self, that, compareObjects);
}
function withVisitedTracking(self, that, fn2) {
  const hasLeft = visitedLeft.has(self);
  const hasRight = visitedRight.has(that);
  if (hasLeft && hasRight) {
    return true;
  }
  if (hasLeft || hasRight) {
    return false;
  }
  visitedLeft.add(self);
  visitedRight.add(that);
  const result2 = fn2();
  visitedLeft.delete(self);
  visitedRight.delete(that);
  return result2;
}
const visitedLeft = /* @__PURE__ */ new WeakSet();
const visitedRight = /* @__PURE__ */ new WeakSet();
function compareObjects(self, that) {
  if (hash(self) !== hash(that)) {
    return false;
  } else if (self instanceof Date) {
    if (!(that instanceof Date)) return false;
    return self.toISOString() === that.toISOString();
  } else if (self instanceof RegExp) {
    if (!(that instanceof RegExp)) return false;
    return self.toString() === that.toString();
  }
  const selfIsEqual = isEqual(self);
  const thatIsEqual = isEqual(that);
  if (selfIsEqual !== thatIsEqual) return false;
  const bothEquals = selfIsEqual && thatIsEqual;
  if (typeof self === "function" && !bothEquals) {
    return false;
  }
  return withVisitedTracking(self, that, () => {
    if (bothEquals) {
      return self[symbol](that);
    } else if (Array.isArray(self)) {
      if (!Array.isArray(that) || self.length !== that.length) {
        return false;
      }
      return compareArrays(self, that);
    } else if (ArrayBuffer.isView(self)) {
      if (!ArrayBuffer.isView(that) || self.byteLength !== that.byteLength) {
        return false;
      }
      return compareTypedArrays(self, that);
    } else if (self instanceof Map) {
      if (!(that instanceof Map) || self.size !== that.size) {
        return false;
      }
      return compareMaps(self, that);
    } else if (self instanceof Set) {
      if (!(that instanceof Set) || self.size !== that.size) {
        return false;
      }
      return compareSets(self, that);
    }
    return compareRecords(self, that);
  });
}
function withCache(self, that, f) {
  let selfMap = equalityCache.get(self);
  if (!selfMap) {
    selfMap = /* @__PURE__ */ new WeakMap();
    equalityCache.set(self, selfMap);
  } else if (selfMap.has(that)) {
    return selfMap.get(that);
  }
  const result2 = f(self, that);
  selfMap.set(that, result2);
  let thatMap = equalityCache.get(that);
  if (!thatMap) {
    thatMap = /* @__PURE__ */ new WeakMap();
    equalityCache.set(that, thatMap);
  }
  thatMap.set(self, result2);
  return result2;
}
const equalityCache = /* @__PURE__ */ new WeakMap();
function compareArrays(self, that) {
  for (let i = 0; i < self.length; i++) {
    if (!compareBoth(self[i], that[i])) {
      return false;
    }
  }
  return true;
}
function compareTypedArrays(self, that) {
  if (self.length !== that.length) {
    return false;
  }
  for (let i = 0; i < self.length; i++) {
    if (self[i] !== that[i]) {
      return false;
    }
  }
  return true;
}
function compareRecords(self, that) {
  const selfKeys = getAllObjectKeys(self);
  const thatKeys = getAllObjectKeys(that);
  if (selfKeys.size !== thatKeys.size) {
    return false;
  }
  for (const key of selfKeys) {
    if (!thatKeys.has(key) || !compareBoth(self[key], that[key])) {
      return false;
    }
  }
  return true;
}
function makeCompareMap(keyEquivalence, valueEquivalence) {
  return function compareMaps2(self, that) {
    for (const [selfKey, selfValue] of self) {
      let found = false;
      for (const [thatKey, thatValue] of that) {
        if (keyEquivalence(selfKey, thatKey) && valueEquivalence(selfValue, thatValue)) {
          found = true;
          break;
        }
      }
      if (!found) {
        return false;
      }
    }
    return true;
  };
}
const compareMaps = /* @__PURE__ */ makeCompareMap(compareBoth, compareBoth);
function makeCompareSet(equivalence) {
  return function compareSets2(self, that) {
    for (const selfValue of self) {
      let found = false;
      for (const thatValue of that) {
        if (equivalence(selfValue, thatValue)) {
          found = true;
          break;
        }
      }
      if (!found) {
        return false;
      }
    }
    return true;
  };
}
const compareSets = /* @__PURE__ */ makeCompareSet(compareBoth);
const isEqual = (u) => hasProperty(u, symbol);
const asEquivalence = () => equals$1;
const make$l = (isEquivalent) => (self, that) => self === that || isEquivalent(self, that);
const isStrictEquivalent = (x, y) => x === y;
const strictEqual = () => isStrictEquivalent;
function Tuple(elements) {
  return make$l((self, that) => {
    if (self.length !== that.length) {
      return false;
    }
    for (let i = 0; i < self.length; i++) {
      if (!elements[i](self[i], that[i])) {
        return false;
      }
    }
    return true;
  });
}
function Array_(item) {
  return make$l((self, that) => {
    if (self.length !== that.length) return false;
    for (let i = 0; i < self.length; i++) {
      if (!item(self[i], that[i])) return false;
    }
    return true;
  });
}
const isArrayNonEmpty$1 = (self) => self.length > 0;
const symbolRedactable = /* @__PURE__ */ Symbol.for("~effect/Redactable");
const isRedactable = (u) => hasProperty(u, symbolRedactable);
function redact$1(u) {
  if (isRedactable(u)) return getRedacted(u);
  return u;
}
function getRedacted(redactable) {
  return redactable[symbolRedactable](globalThis[currentFiberTypeId]?.context ?? emptyContext$1);
}
const currentFiberTypeId = "~effect/Fiber/currentFiber";
const emptyContext$1 = {
  "~effect/Context": {},
  mapUnsafe: /* @__PURE__ */ new Map(),
  pipe() {
    return pipeArguments(this, arguments);
  }
};
function format(input, options) {
  const space = options?.space ?? 0;
  const seen = /* @__PURE__ */ new WeakSet();
  const gap = !space ? "" : typeof space === "number" ? " ".repeat(space) : space;
  const ind = (d) => gap.repeat(d);
  const wrap = (v, body) => {
    const ctor = v?.constructor;
    return ctor && ctor !== Object.prototype.constructor && ctor.name ? `${ctor.name}(${body})` : body;
  };
  const ownKeys = (o) => {
    try {
      return Reflect.ownKeys(o);
    } catch {
      return ["[ownKeys threw]"];
    }
  };
  function recur2(v, d = 0) {
    if (Array.isArray(v)) {
      if (seen.has(v)) return CIRCULAR;
      seen.add(v);
      if (!gap || v.length <= 1) return `[${v.map((x) => recur2(x, d)).join(",")}]`;
      const inner = v.map((x) => recur2(x, d + 1)).join(",\n" + ind(d + 1));
      return `[
${ind(d + 1)}${inner}
${ind(d)}]`;
    }
    if (v instanceof Date) return formatDate(v);
    if (!options?.ignoreToString && hasProperty(v, "toString") && typeof v["toString"] === "function" && v["toString"] !== Object.prototype.toString && v["toString"] !== Array.prototype.toString) {
      const s = safeToString(v);
      if (v instanceof Error && v.cause) {
        return `${s} (cause: ${recur2(v.cause, d)})`;
      }
      return s;
    }
    if (typeof v === "string") return JSON.stringify(v);
    if (typeof v === "number" || v == null || typeof v === "boolean" || typeof v === "symbol") return String(v);
    if (typeof v === "bigint") return String(v) + "n";
    if (typeof v === "object" || typeof v === "function") {
      if (seen.has(v)) return CIRCULAR;
      seen.add(v);
      if (symbolRedactable in v) return format(getRedacted(v));
      if (Symbol.iterator in v) {
        return `${v.constructor.name}(${recur2(Array.from(v), d)})`;
      }
      const keys2 = ownKeys(v);
      if (!gap || keys2.length <= 1) {
        const body2 = `{${keys2.map((k) => `${formatPropertyKey(k)}:${recur2(v[k], d)}`).join(",")}}`;
        return wrap(v, body2);
      }
      const body = `{
${keys2.map((k) => `${ind(d + 1)}${formatPropertyKey(k)}: ${recur2(v[k], d + 1)}`).join(",\n")}
${ind(d)}}`;
      return wrap(v, body);
    }
    return String(v);
  }
  return recur2(input, 0);
}
const CIRCULAR = "[Circular]";
function formatPropertyKey(name) {
  return typeof name === "string" ? JSON.stringify(name) : String(name);
}
function formatPath(path) {
  return path.map((key) => `[${formatPropertyKey(key)}]`).join("");
}
function formatDate(date) {
  try {
    return date.toISOString();
  } catch {
    return "Invalid Date";
  }
}
function safeToString(input) {
  try {
    const s = input.toString();
    return typeof s === "string" ? s : String(s);
  } catch {
    return "[toString threw]";
  }
}
function formatJson(input, options) {
  let cache = [];
  const out = JSON.stringify(input, (_key, value) => typeof value === "object" && value !== null ? cache.includes(value) ? void 0 : cache.push(value) && redact$1(value) : value, options?.space);
  cache = void 0;
  return out;
}
const NodeInspectSymbol = /* @__PURE__ */ Symbol.for("nodejs.util.inspect.custom");
const toJson = (input) => {
  try {
    if (hasProperty(input, "toJSON") && isFunction(input["toJSON"]) && input["toJSON"].length === 0) {
      return input.toJSON();
    } else if (Array.isArray(input)) {
      return input.map(toJson);
    }
  } catch {
    return "[toJSON threw]";
  }
  return redact$1(input);
};
const toStringUnknown = (u, whitespace = 2) => {
  if (typeof u === "string") {
    return u;
  }
  try {
    return typeof u === "object" ? stringifyCircular(u, whitespace) : String(u);
  } catch {
    return String(u);
  }
};
const stringifyCircular = (obj, whitespace) => {
  let cache = [];
  const retVal = JSON.stringify(obj, (_key, value) => typeof value === "object" && value !== null ? cache.includes(value) ? void 0 : cache.push(value) && redact$1(value) : value, whitespace);
  cache = void 0;
  return retVal;
};
const BaseProto = {
  toJSON() {
    return toJson(this);
  },
  [NodeInspectSymbol]() {
    return this.toJSON();
  },
  toString() {
    return format(this.toJSON());
  }
};
class Class {
  /**
   * Node.js custom inspection method.
   *
   * @since 2.0.0
   */
  [NodeInspectSymbol]() {
    return this.toJSON();
  }
  /**
   * Returns a formatted string representation of this object.
   *
   * @since 2.0.0
   */
  toString() {
    return format(this.toJSON());
  }
}
class SingleShotGen {
  called = false;
  self;
  constructor(self) {
    this.self = self;
  }
  /**
   * @since 2.0.0
   */
  next(a) {
    return this.called ? {
      value: a,
      done: true
    } : (this.called = true, {
      value: this.self,
      done: false
    });
  }
  /**
   * @since 2.0.0
   */
  [Symbol.iterator]() {
    return new SingleShotGen(this.self);
  }
}
const InternalTypeId = "~effect/Utils/internal";
const standard = {
  [InternalTypeId]: (body) => {
    return body();
  }
};
const forced = {
  [InternalTypeId]: (body) => {
    try {
      return body();
    } finally {
    }
  }
};
const isNotOptimizedAway = /* @__PURE__ */ standard[InternalTypeId](() => new Error().stack)?.includes(InternalTypeId) === true;
const internalCall = isNotOptimizedAway ? standard[InternalTypeId] : forced[InternalTypeId];
const EffectTypeId = `~effect/Effect`;
const ExitTypeId = `~effect/Exit`;
const effectVariance = {
  _A: identity,
  _E: identity,
  _R: identity
};
const identifier = `${EffectTypeId}/identifier`;
const args = `${EffectTypeId}/args`;
const evaluate = `${EffectTypeId}/evaluate`;
const contA = `${EffectTypeId}/successCont`;
const contE = `${EffectTypeId}/failureCont`;
const contAll = `${EffectTypeId}/ensureCont`;
const Yield = /* @__PURE__ */ Symbol.for("effect/Effect/Yield");
const PipeInspectableProto = {
  pipe() {
    return pipeArguments(this, arguments);
  },
  toJSON() {
    return {
      ...this
    };
  },
  toString() {
    return format(this.toJSON(), {
      ignoreToString: true,
      space: 2
    });
  },
  [NodeInspectSymbol]() {
    return this.toJSON();
  }
};
const YieldableProto = {
  [Symbol.iterator]() {
    return new SingleShotGen(this);
  }
};
const YieldableErrorProto = {
  ...YieldableProto,
  pipe() {
    return pipeArguments(this, arguments);
  }
};
const EffectProto = {
  [EffectTypeId]: effectVariance,
  ...PipeInspectableProto,
  [Symbol.iterator]() {
    return new SingleShotGen(this);
  },
  asEffect() {
    return this;
  },
  toJSON() {
    return {
      _id: "Effect",
      op: this[identifier],
      ...args in this ? {
        args: this[args]
      } : void 0
    };
  }
};
const isEffect$1 = (u) => hasProperty(u, EffectTypeId);
const isExit = (u) => hasProperty(u, ExitTypeId);
const CauseTypeId = "~effect/Cause";
const CauseReasonTypeId = "~effect/Cause/Reason";
const isCause = (self) => hasProperty(self, CauseTypeId);
class CauseImpl {
  [CauseTypeId];
  reasons;
  constructor(failures) {
    this[CauseTypeId] = CauseTypeId;
    this.reasons = failures;
  }
  pipe() {
    return pipeArguments(this, arguments);
  }
  toJSON() {
    return {
      _id: "Cause",
      failures: this.reasons.map((f) => f.toJSON())
    };
  }
  toString() {
    return `Cause(${format(this.reasons)})`;
  }
  [NodeInspectSymbol]() {
    return this.toJSON();
  }
  [symbol](that) {
    return isCause(that) && this.reasons.length === that.reasons.length && this.reasons.every((e, i) => equals$1(e, that.reasons[i]));
  }
  [symbol$1]() {
    return array(this.reasons);
  }
}
const annotationsMap = /* @__PURE__ */ new WeakMap();
class ReasonBase {
  [CauseReasonTypeId];
  annotations;
  _tag;
  constructor(_tag, annotations, originalError) {
    this[CauseReasonTypeId] = CauseReasonTypeId;
    this._tag = _tag;
    if (annotations !== constEmptyAnnotations && typeof originalError === "object" && originalError !== null && annotations.size > 0) {
      const prevAnnotations = annotationsMap.get(originalError);
      if (prevAnnotations) {
        annotations = new Map([...prevAnnotations, ...annotations]);
      }
      annotationsMap.set(originalError, annotations);
    }
    this.annotations = annotations;
  }
  annotate(annotations, options) {
    if (annotations.mapUnsafe.size === 0) return this;
    const newAnnotations = new Map(this.annotations);
    annotations.mapUnsafe.forEach((value, key) => {
      if (options?.overwrite !== true && newAnnotations.has(key)) return;
      newAnnotations.set(key, value);
    });
    const self = Object.assign(Object.create(Object.getPrototypeOf(this)), this);
    self.annotations = newAnnotations;
    return self;
  }
  pipe() {
    return pipeArguments(this, arguments);
  }
  toString() {
    return format(this);
  }
  [NodeInspectSymbol]() {
    return this.toString();
  }
}
const constEmptyAnnotations = /* @__PURE__ */ new Map();
class Fail extends ReasonBase {
  error;
  constructor(error, annotations = constEmptyAnnotations) {
    super("Fail", annotations, error);
    this.error = error;
  }
  toString() {
    return `Fail(${format(this.error)})`;
  }
  toJSON() {
    return {
      _tag: "Fail",
      error: this.error
    };
  }
  [symbol](that) {
    return isFailReason(that) && equals$1(this.error, that.error) && equals$1(this.annotations, that.annotations);
  }
  [symbol$1]() {
    return combine(string$2(this._tag))(combine(hash(this.error))(hash(this.annotations)));
  }
}
const causeFromReasons = (reasons) => new CauseImpl(reasons);
const causeEmpty = /* @__PURE__ */ new CauseImpl([]);
const causeFail = (error) => new CauseImpl([new Fail(error)]);
class Die extends ReasonBase {
  defect;
  constructor(defect, annotations = constEmptyAnnotations) {
    super("Die", annotations, defect);
    this.defect = defect;
  }
  toString() {
    return `Die(${format(this.defect)})`;
  }
  toJSON() {
    return {
      _tag: "Die",
      defect: this.defect
    };
  }
  [symbol](that) {
    return isDieReason(that) && equals$1(this.defect, that.defect) && equals$1(this.annotations, that.annotations);
  }
  [symbol$1]() {
    return combine(string$2(this._tag))(combine(hash(this.defect))(hash(this.annotations)));
  }
}
const causeDie = (defect) => new CauseImpl([new Die(defect)]);
const causeAnnotate = /* @__PURE__ */ dual((args2) => isCause(args2[0]), (self, annotations, options) => {
  if (annotations.mapUnsafe.size === 0) return self;
  return new CauseImpl(self.reasons.map((f) => f.annotate(annotations, options)));
});
const isFailReason = (self) => self._tag === "Fail";
const isDieReason = (self) => self._tag === "Die";
const isInterruptReason = (self) => self._tag === "Interrupt";
function defaultEvaluate(_fiber) {
  return exitDie(`Effect.evaluate: Not implemented`);
}
const makePrimitiveProto = (options) => ({
  ...EffectProto,
  [identifier]: options.op,
  [evaluate]: options[evaluate] ?? defaultEvaluate,
  [contA]: options[contA],
  [contE]: options[contE],
  [contAll]: options[contAll]
});
const makePrimitive = (options) => {
  const Proto3 = makePrimitiveProto(options);
  return function() {
    const self = Object.create(Proto3);
    self[args] = options.single === false ? arguments : arguments[0];
    return self;
  };
};
const makeExit = (options) => {
  const Proto3 = {
    ...makePrimitiveProto(options),
    [ExitTypeId]: ExitTypeId,
    _tag: options.op,
    get [options.prop]() {
      return this[args];
    },
    toString() {
      return `${options.op}(${format(this[args])})`;
    },
    toJSON() {
      return {
        _id: "Exit",
        _tag: options.op,
        [options.prop]: this[args]
      };
    },
    [symbol](that) {
      return isExit(that) && that._tag === this._tag && equals$1(this[args], that[args]);
    },
    [symbol$1]() {
      return combine(string$2(options.op), hash(this[args]));
    }
  };
  return function(value) {
    const self = Object.create(Proto3);
    self[args] = value;
    return self;
  };
};
const exitSucceed = /* @__PURE__ */ makeExit({
  op: "Success",
  prop: "value",
  [evaluate](fiber) {
    const cont = fiber.getCont(contA);
    return cont ? cont[contA](this[args], fiber, this) : fiber.yieldWith(this);
  }
});
const StackTraceKey = {
  key: "effect/Cause/StackTrace"
};
const InterruptorStackTrace = {
  key: "effect/Cause/InterruptorStackTrace"
};
const exitFailCause = /* @__PURE__ */ makeExit({
  op: "Failure",
  prop: "cause",
  [evaluate](fiber) {
    let cause = this[args];
    let annotated = false;
    if (fiber.currentStackFrame) {
      cause = causeAnnotate(cause, {
        mapUnsafe: /* @__PURE__ */ new Map([[StackTraceKey.key, fiber.currentStackFrame]])
      });
      annotated = true;
    }
    let cont = fiber.getCont(contE);
    while (fiber.interruptible && fiber._interruptedCause && cont) {
      cont = fiber.getCont(contE);
    }
    return cont ? cont[contE](cause, fiber, annotated ? void 0 : this) : fiber.yieldWith(annotated ? this : exitFailCause(cause));
  }
});
const exitFail = (e) => exitFailCause(causeFail(e));
const exitDie = (defect) => exitFailCause(causeDie(defect));
const withFiber$1 = /* @__PURE__ */ makePrimitive({
  op: "WithFiber",
  [evaluate](fiber) {
    return this[args](fiber);
  }
});
const YieldableError = /* @__PURE__ */ (function() {
  class YieldableError2 extends globalThis.Error {
    asEffect() {
      return exitFail(this);
    }
  }
  Object.assign(YieldableError2.prototype, YieldableErrorProto);
  return YieldableError2;
})();
const Error$2 = /* @__PURE__ */ (function() {
  const plainArgsSymbol = /* @__PURE__ */ Symbol.for("effect/Data/Error/plainArgs");
  return class Base extends YieldableError {
    constructor(args2) {
      super(args2?.message, args2?.cause ? {
        cause: args2.cause
      } : void 0);
      if (args2) {
        Object.assign(this, args2);
        Object.defineProperty(this, plainArgsSymbol, {
          value: args2,
          enumerable: false
        });
      }
    }
    toJSON() {
      return {
        ...this[plainArgsSymbol],
        ...this
      };
    }
  };
})();
const TaggedError$1 = (tag2) => {
  class Base3 extends Error$2 {
    _tag = tag2;
  }
  Base3.prototype.name = tag2;
  return Base3;
};
const NoSuchElementErrorTypeId = "~effect/Cause/NoSuchElementError";
class NoSuchElementError extends (/* @__PURE__ */ TaggedError$1("NoSuchElementError")) {
  [NoSuchElementErrorTypeId] = NoSuchElementErrorTypeId;
  constructor(message) {
    super({
      message
    });
  }
}
const DoneTypeId = "~effect/Cause/Done";
const isDone$1 = (u) => hasProperty(u, DoneTypeId);
const DoneVoid = {
  [DoneTypeId]: DoneTypeId,
  _tag: "Done",
  value: void 0
};
const Done = (value) => {
  if (value === void 0) return DoneVoid;
  return {
    [DoneTypeId]: DoneTypeId,
    _tag: "Done",
    value
  };
};
const doneVoid = /* @__PURE__ */ exitFail(DoneVoid);
const done$2 = (value) => {
  if (value === void 0) return doneVoid;
  return exitFail(Done(value));
};
const TypeId$q = "~effect/data/Option";
const CommonProto$1 = {
  [TypeId$q]: {
    _A: (_) => _
  },
  ...PipeInspectableProto,
  ...YieldableProto
};
const SomeProto = /* @__PURE__ */ Object.assign(/* @__PURE__ */ Object.create(CommonProto$1), {
  _tag: "Some",
  _op: "Some",
  [symbol](that) {
    return isOption(that) && isSome$1(that) && equals$1(this.value, that.value);
  },
  [symbol$1]() {
    return combine(hash(this._tag))(hash(this.value));
  },
  toString() {
    return `some(${format(this.value)})`;
  },
  toJSON() {
    return {
      _id: "Option",
      _tag: this._tag,
      value: toJson(this.value)
    };
  },
  asEffect() {
    return exitSucceed(this.value);
  }
});
Object.defineProperty(SomeProto, "valueOrUndefined", {
  get() {
    return this.value;
  }
});
const NoneHash = /* @__PURE__ */ hash("None");
const NoneProto = /* @__PURE__ */ Object.assign(/* @__PURE__ */ Object.create(CommonProto$1), {
  _tag: "None",
  _op: "None",
  valueOrUndefined: void 0,
  [symbol](that) {
    return isOption(that) && isNone$1(that);
  },
  [symbol$1]() {
    return NoneHash;
  },
  toString() {
    return `none()`;
  },
  toJSON() {
    return {
      _id: "Option",
      _tag: this._tag
    };
  },
  asEffect() {
    return exitFail(new NoSuchElementError());
  }
});
const isOption = (input) => hasProperty(input, TypeId$q);
const isNone$1 = (fa) => fa._tag === "None";
const isSome$1 = (fa) => fa._tag === "Some";
const none$1 = /* @__PURE__ */ Object.create(NoneProto);
const some$1 = (value) => {
  const a = Object.create(SomeProto);
  a.value = value;
  return a;
};
const TypeId$p = "~effect/data/Result";
const CommonProto = {
  [TypeId$p]: {
    /* v8 ignore next 2 */
    _A: (_) => _,
    _E: (_) => _
  },
  ...PipeInspectableProto,
  ...YieldableProto
};
const SuccessProto = /* @__PURE__ */ Object.assign(/* @__PURE__ */ Object.create(CommonProto), {
  _tag: "Success",
  _op: "Success",
  [symbol](that) {
    return isResult(that) && isSuccess$1(that) && equals$1(this.success, that.success);
  },
  [symbol$1]() {
    return combine(hash(this._tag))(hash(this.success));
  },
  toString() {
    return `success(${format(this.success)})`;
  },
  toJSON() {
    return {
      _id: "Result",
      _tag: this._tag,
      value: toJson(this.success)
    };
  },
  asEffect() {
    return exitSucceed(this.success);
  }
});
const FailureProto = /* @__PURE__ */ Object.assign(/* @__PURE__ */ Object.create(CommonProto), {
  _tag: "Failure",
  _op: "Failure",
  [symbol](that) {
    return isResult(that) && isFailure$1(that) && equals$1(this.failure, that.failure);
  },
  [symbol$1]() {
    return combine(hash(this._tag))(hash(this.failure));
  },
  toString() {
    return `failure(${format(this.failure)})`;
  },
  toJSON() {
    return {
      _id: "Result",
      _tag: this._tag,
      failure: toJson(this.failure)
    };
  },
  asEffect() {
    return exitFail(this.failure);
  }
});
const isResult = (input) => hasProperty(input, TypeId$p);
const isFailure$1 = (result2) => result2._tag === "Failure";
const isSuccess$1 = (result2) => result2._tag === "Success";
const fail$7 = (failure) => {
  const a = Object.create(FailureProto);
  a.failure = failure;
  return a;
};
const succeed$6 = (success) => {
  const a = Object.create(SuccessProto);
  a.success = success;
  return a;
};
function make$k(compare) {
  return (self, that) => self === that ? 0 : compare(self, that);
}
const Number$5 = /* @__PURE__ */ make$k((self, that) => {
  if (globalThis.Number.isNaN(self) && globalThis.Number.isNaN(that)) return 0;
  if (globalThis.Number.isNaN(self)) return -1;
  if (globalThis.Number.isNaN(that)) return 1;
  return self < that ? -1 : 1;
});
const mapInput = /* @__PURE__ */ dual(2, (self, f) => make$k((b1, b2) => self(f(b1), f(b2))));
const isGreaterThan = (O) => dual(2, (self, that) => O(self, that) === 1);
const max$1 = (O) => dual(2, (self, that) => self === that || O(self, that) > -1 ? self : that);
const none = () => none$1;
const some = some$1;
const isNone = isNone$1;
const isSome = isSome$1;
const match$2 = /* @__PURE__ */ dual(2, (self, {
  onNone,
  onSome
}) => isNone(self) ? onNone() : onSome(self.value));
const getOrElse$1 = /* @__PURE__ */ dual(2, (self, onNone) => isNone(self) ? onNone() : self.value);
const fromNullishOr = (a) => a == null ? none() : some(a);
const fromUndefinedOr = (a) => a === void 0 ? none() : some(a);
const getOrUndefined = /* @__PURE__ */ getOrElse$1(constUndefined);
const map$5 = /* @__PURE__ */ dual(2, (self, f) => isNone(self) ? none() : some(f(self.value)));
const flatMap$3 = /* @__PURE__ */ dual(2, (self, f) => isNone(self) ? none() : f(self.value));
const filter = /* @__PURE__ */ dual(2, (self, predicate) => isNone(self) ? none() : predicate(self.value) ? some(self.value) : none());
const succeed$5 = succeed$6;
const fail$6 = fail$7;
const isFailure = isFailure$1;
const makeEquivalence$2 = Tuple;
const has = /* @__PURE__ */ dual(2, (self, key) => Object.hasOwn(self, key));
const map$4 = /* @__PURE__ */ dual(2, (self, f) => {
  const out = {
    ...self
  };
  for (const key of keys(self)) {
    out[key] = f(self[key], key);
  }
  return out;
});
const keys = (self) => Object.keys(self);
const isSubrecordBy = (equivalence) => dual(2, (self, that) => {
  for (const key of keys(self)) {
    if (!has(that, key) || !equivalence(self[key], that[key])) {
      return false;
    }
  }
  return true;
});
const makeEquivalence$1 = (equivalence) => {
  const is2 = isSubrecordBy(equivalence);
  return (self, that) => is2(self, that) && is2(that, self);
};
const Array$1 = globalThis.Array;
const fromIterable$1 = (collection) => Array$1.isArray(collection) ? collection : Array$1.from(collection);
const ensure = (self) => Array$1.isArray(self) ? self : [self];
const append = /* @__PURE__ */ dual(2, (self, last) => [...self, last]);
const appendAll = /* @__PURE__ */ dual(2, (self, that) => fromIterable$1(self).concat(fromIterable$1(that)));
const isArrayNonEmpty = isArrayNonEmpty$1;
const isReadonlyArrayNonEmpty = isArrayNonEmpty$1;
function isOutOfBounds(i, as2) {
  return i < 0 || i >= as2.length;
}
const getUnsafe$1 = /* @__PURE__ */ dual(2, (self, index) => {
  const i = Math.floor(index);
  if (isOutOfBounds(i, self)) {
    throw new Error(`Index out of bounds: ${i}`);
  }
  return self[i];
});
const headNonEmpty = /* @__PURE__ */ getUnsafe$1(0);
const tailNonEmpty = (self) => self.slice(1);
const unionWith = /* @__PURE__ */ dual(3, (self, that, isEquivalent) => {
  const a = fromIterable$1(self);
  const b = fromIterable$1(that);
  if (isReadonlyArrayNonEmpty(a)) {
    if (isReadonlyArrayNonEmpty(b)) {
      const dedupe = dedupeWith(isEquivalent);
      return dedupe(appendAll(a, b));
    }
    return a;
  }
  return b;
});
const union$1 = /* @__PURE__ */ dual(2, (self, that) => unionWith(self, that, asEquivalence()));
const empty$6 = () => [];
const of = (a) => [a];
const map$3 = /* @__PURE__ */ dual(2, (self, f) => self.map(f));
const makeEquivalence = Array_;
const dedupeWith = /* @__PURE__ */ dual(2, (self, isEquivalent) => {
  const input = fromIterable$1(self);
  if (isReadonlyArrayNonEmpty(input)) {
    const out = [headNonEmpty(input)];
    const rest = tailNonEmpty(input);
    for (const r of rest) {
      if (out.every((a) => !isEquivalent(r, a))) {
        out.push(r);
      }
    }
    return out;
  }
  return [];
});
const ServiceTypeId = "~effect/Context/Service";
const Service = function() {
  const prevLimit = Error.stackTraceLimit;
  Error.stackTraceLimit = 2;
  const err = new Error();
  Error.stackTraceLimit = prevLimit;
  function KeyClass() {
  }
  const self = KeyClass;
  Object.setPrototypeOf(self, ServiceProto);
  Object.defineProperty(self, "stack", {
    get() {
      return err.stack;
    }
  });
  if (arguments.length > 0) {
    self.key = arguments[0];
    if (arguments[1]?.defaultValue) {
      self[ReferenceTypeId] = ReferenceTypeId;
      self.defaultValue = arguments[1].defaultValue;
    }
    return self;
  }
  return function(key, options) {
    self.key = key;
    if (options?.make) {
      self.make = options.make;
    }
    return self;
  };
};
const ServiceProto = {
  [ServiceTypeId]: ServiceTypeId,
  ...PipeInspectableProto,
  ...YieldableProto,
  toJSON() {
    return {
      _id: "Service",
      key: this.key,
      stack: this.stack
    };
  },
  asEffect() {
    const fn2 = this.asEffect = constant(withFiber$1((fiber) => exitSucceed(get(fiber.context, this))));
    return fn2();
  },
  of(self) {
    return self;
  },
  context(self) {
    return make$j(this, self);
  },
  use(f) {
    return withFiber$1((fiber) => f(get(fiber.context, this)));
  },
  useSync(f) {
    return withFiber$1((fiber) => exitSucceed(f(get(fiber.context, this))));
  }
};
const ReferenceTypeId = "~effect/Context/Reference";
const TypeId$o = "~effect/Context";
const makeUnsafe$4 = (mapUnsafe) => {
  const self = Object.create(Proto$9);
  self.mapUnsafe = mapUnsafe;
  self.mutable = false;
  return self;
};
const Proto$9 = {
  ...PipeInspectableProto,
  [TypeId$o]: {
    _Services: (_) => _
  },
  toJSON() {
    return {
      _id: "Context",
      services: Array.from(this.mapUnsafe).map(([key, value]) => ({
        key,
        value
      }))
    };
  },
  [symbol](that) {
    if (!isContext(that) || this.mapUnsafe.size !== that.mapUnsafe.size) return false;
    for (const k of this.mapUnsafe.keys()) {
      if (!that.mapUnsafe.has(k) || !equals$1(this.mapUnsafe.get(k), that.mapUnsafe.get(k))) {
        return false;
      }
    }
    return true;
  },
  [symbol$1]() {
    return number$1(this.mapUnsafe.size);
  }
};
const isContext = (u) => hasProperty(u, TypeId$o);
const isReference = (u) => hasProperty(u, ReferenceTypeId);
const empty$5 = () => emptyContext;
const emptyContext = /* @__PURE__ */ makeUnsafe$4(/* @__PURE__ */ new Map());
const make$j = (key, service) => makeUnsafe$4(/* @__PURE__ */ new Map([[key.key, service]]));
const add = /* @__PURE__ */ dual(3, (self, key, service) => withMapUnsafe(self, (map2) => {
  map2.set(key.key, service);
}));
const getOrElse = /* @__PURE__ */ dual(3, (self, key, orElse2) => {
  if (self.mapUnsafe.has(key.key)) {
    return self.mapUnsafe.get(key.key);
  }
  return isReference(key) ? getDefaultValue(key) : orElse2();
});
const getUnsafe = /* @__PURE__ */ dual(2, (self, service) => {
  if (!self.mapUnsafe.has(service.key)) {
    if (ReferenceTypeId in service) return getDefaultValue(service);
    throw serviceNotFoundError(service);
  }
  return self.mapUnsafe.get(service.key);
});
const get = getUnsafe;
const getReferenceUnsafe = (self, service) => {
  if (!self.mapUnsafe.has(service.key)) {
    return getDefaultValue(service);
  }
  return self.mapUnsafe.get(service.key);
};
const defaultValueCacheKey = "~effect/Context/defaultValue";
const getDefaultValue = (ref) => {
  if (defaultValueCacheKey in ref) {
    return ref[defaultValueCacheKey];
  }
  return ref[defaultValueCacheKey] = ref.defaultValue();
};
const serviceNotFoundError = (service) => {
  const error = new Error(`Service not found${service.key ? `: ${String(service.key)}` : ""}`);
  if (service.stack) {
    const lines = service.stack.split("\n");
    if (lines.length > 2) {
      const afterAt = lines[2].match(/at (.*)/);
      if (afterAt) {
        error.message = error.message + ` (defined at ${afterAt[1]})`;
      }
    }
  }
  if (error.stack) {
    const lines = error.stack.split("\n");
    lines.splice(1, 3);
    error.stack = lines.join("\n");
  }
  return error;
};
const merge$2 = /* @__PURE__ */ dual(2, (self, that) => {
  if (self.mapUnsafe.size === 0) return that;
  if (that.mapUnsafe.size === 0) return self;
  return withMapUnsafe(self, (map2) => {
    that.mapUnsafe.forEach((value, key) => map2.set(key, value));
  });
});
const mergeAll$1 = (...ctxs) => {
  const map2 = /* @__PURE__ */ new Map();
  for (let i = 0; i < ctxs.length; i++) {
    ctxs[i].mapUnsafe.forEach((value, key) => {
      map2.set(key, value);
    });
  }
  return makeUnsafe$4(map2);
};
const withMapUnsafe = (self, f) => {
  if (self.mutable) {
    f(self.mapUnsafe);
    return self;
  }
  const map2 = new Map(self.mapUnsafe);
  f(map2);
  return makeUnsafe$4(map2);
};
const Reference = Service;
const TypeId$n = "~effect/time/Duration";
const bigint0$1 = /* @__PURE__ */ BigInt(0);
const bigint1e3 = /* @__PURE__ */ BigInt(1e3);
const bigint1e6 = /* @__PURE__ */ BigInt(1e6);
const DURATION_REGEXP = /^(-?\d+(?:\.\d+)?)\s+(nanos?|micros?|millis?|seconds?|minutes?|hours?|days?|weeks?)$/;
const fromInputUnsafe = (input) => {
  switch (typeof input) {
    case "number":
      return millis(input);
    case "bigint":
      return nanos(input);
    case "string": {
      const match2 = DURATION_REGEXP.exec(input);
      if (!match2) break;
      const [_, valueStr, unit] = match2;
      const value = Number(valueStr);
      switch (unit) {
        case "nano":
        case "nanos":
          return nanos(BigInt(valueStr));
        case "micro":
        case "micros":
          return micros(BigInt(valueStr));
        case "milli":
        case "millis":
          return millis(value);
        case "second":
        case "seconds":
          return seconds(value);
        case "minute":
        case "minutes":
          return minutes(value);
        case "hour":
        case "hours":
          return hours(value);
        case "day":
        case "days":
          return days(value);
        case "week":
        case "weeks":
          return weeks(value);
      }
      break;
    }
    case "object": {
      if (input === null) break;
      if (TypeId$n in input) return input;
      if (Array.isArray(input)) {
        if (input.length !== 2 || !input.every(isNumber)) {
          return invalid(input);
        }
        if (Number.isNaN(input[0]) || Number.isNaN(input[1])) {
          return zero;
        }
        if (input[0] === -Infinity || input[1] === -Infinity) {
          return negativeInfinity;
        }
        if (input[0] === Infinity || input[1] === Infinity) {
          return infinity;
        }
        return make$i(BigInt(Math.round(input[0] * 1e9)) + BigInt(Math.round(input[1])));
      }
      const obj = input;
      let millis2 = 0;
      if (obj.weeks) millis2 += obj.weeks * 6048e5;
      if (obj.days) millis2 += obj.days * 864e5;
      if (obj.hours) millis2 += obj.hours * 36e5;
      if (obj.minutes) millis2 += obj.minutes * 6e4;
      if (obj.seconds) millis2 += obj.seconds * 1e3;
      if (obj.milliseconds) millis2 += obj.milliseconds;
      if (!obj.microseconds && !obj.nanoseconds) return make$i(millis2);
      let nanos2 = BigInt(millis2) * bigint1e6;
      if (obj.microseconds) nanos2 += BigInt(obj.microseconds) * bigint1e3;
      if (obj.nanoseconds) nanos2 += BigInt(obj.nanoseconds);
      return make$i(nanos2);
    }
  }
  return invalid(input);
};
const invalid = (input) => {
  throw new Error(`Invalid Input: ${input}`);
};
const zeroDurationValue = {
  _tag: "Millis",
  millis: 0
};
const infinityDurationValue = {
  _tag: "Infinity"
};
const negativeInfinityDurationValue = {
  _tag: "NegativeInfinity"
};
const DurationProto = {
  [TypeId$n]: TypeId$n,
  [symbol$1]() {
    return structure(this.value);
  },
  [symbol](that) {
    return isDuration(that) && equals(this, that);
  },
  toString() {
    switch (this.value._tag) {
      case "Infinity":
        return "Infinity";
      case "NegativeInfinity":
        return "-Infinity";
      case "Nanos":
        return `${this.value.nanos} nanos`;
      case "Millis":
        return `${this.value.millis} millis`;
    }
  },
  toJSON() {
    switch (this.value._tag) {
      case "Millis":
        return {
          _id: "Duration",
          _tag: "Millis",
          millis: this.value.millis
        };
      case "Nanos":
        return {
          _id: "Duration",
          _tag: "Nanos",
          nanos: String(this.value.nanos)
        };
      case "Infinity":
        return {
          _id: "Duration",
          _tag: "Infinity"
        };
      case "NegativeInfinity":
        return {
          _id: "Duration",
          _tag: "NegativeInfinity"
        };
    }
  },
  [NodeInspectSymbol]() {
    return this.toJSON();
  },
  pipe() {
    return pipeArguments(this, arguments);
  }
};
const make$i = (input) => {
  const duration = Object.create(DurationProto);
  if (typeof input === "number") {
    if (isNaN(input) || input === 0 || Object.is(input, -0)) {
      duration.value = zeroDurationValue;
    } else if (!Number.isFinite(input)) {
      duration.value = input > 0 ? infinityDurationValue : negativeInfinityDurationValue;
    } else if (!Number.isInteger(input)) {
      duration.value = {
        _tag: "Nanos",
        nanos: BigInt(Math.round(input * 1e6))
      };
    } else {
      duration.value = {
        _tag: "Millis",
        millis: input
      };
    }
  } else if (input === bigint0$1) {
    duration.value = zeroDurationValue;
  } else {
    duration.value = {
      _tag: "Nanos",
      nanos: input
    };
  }
  return duration;
};
const isDuration = (u) => hasProperty(u, TypeId$n);
const zero = /* @__PURE__ */ make$i(0);
const infinity = /* @__PURE__ */ make$i(Infinity);
const negativeInfinity = /* @__PURE__ */ make$i(-Infinity);
const nanos = (nanos2) => make$i(nanos2);
const micros = (micros2) => make$i(micros2 * bigint1e3);
const millis = (millis2) => make$i(millis2);
const seconds = (seconds2) => make$i(seconds2 * 1e3);
const minutes = (minutes2) => make$i(minutes2 * 6e4);
const hours = (hours2) => make$i(hours2 * 36e5);
const days = (days2) => make$i(days2 * 864e5);
const weeks = (weeks2) => make$i(weeks2 * 6048e5);
const toMillis = (self) => match$1(self, {
  onMillis: identity,
  onNanos: (nanos2) => Number(nanos2) / 1e6,
  onInfinity: () => Infinity,
  onNegativeInfinity: () => -Infinity
});
const toNanosUnsafe = (self) => {
  switch (self.value._tag) {
    case "Infinity":
    case "NegativeInfinity":
      throw new Error("Cannot convert infinite duration to nanos");
    case "Nanos":
      return self.value.nanos;
    case "Millis":
      return BigInt(Math.round(self.value.millis * 1e6));
  }
};
const match$1 = /* @__PURE__ */ dual(2, (self, options) => {
  switch (self.value._tag) {
    case "Millis":
      return options.onMillis(self.value.millis);
    case "Nanos":
      return options.onNanos(self.value.nanos);
    case "Infinity":
      return options.onInfinity();
    case "NegativeInfinity":
      return (options.onNegativeInfinity ?? options.onInfinity)();
  }
});
const matchPair = /* @__PURE__ */ dual(3, (self, that, options) => {
  if (self.value._tag === "Infinity" || self.value._tag === "NegativeInfinity" || that.value._tag === "Infinity" || that.value._tag === "NegativeInfinity") return options.onInfinity(self, that);
  if (self.value._tag === "Millis") {
    return that.value._tag === "Millis" ? options.onMillis(self.value.millis, that.value.millis) : options.onNanos(toNanosUnsafe(self), that.value.nanos);
  } else {
    return options.onNanos(self.value.nanos, toNanosUnsafe(that));
  }
});
const Order = /* @__PURE__ */ make$k((self, that) => matchPair(self, that, {
  onMillis: (self2, that2) => self2 < that2 ? -1 : self2 > that2 ? 1 : 0,
  onNanos: (self2, that2) => self2 < that2 ? -1 : self2 > that2 ? 1 : 0,
  onInfinity: (self2, that2) => {
    if (self2.value._tag === that2.value._tag) return 0;
    if (self2.value._tag === "Infinity") return 1;
    if (self2.value._tag === "NegativeInfinity") return -1;
    if (that2.value._tag === "Infinity") return -1;
    return 1;
  }
}));
const Equivalence$2 = (self, that) => matchPair(self, that, {
  onMillis: (self2, that2) => self2 === that2,
  onNanos: (self2, that2) => self2 === that2,
  onInfinity: (self2, that2) => self2.value._tag === that2.value._tag
});
const max = /* @__PURE__ */ max$1(Order);
const sum = /* @__PURE__ */ dual(2, (self, that) => matchPair(self, that, {
  onMillis: (self2, that2) => make$i(self2 + that2),
  onNanos: (self2, that2) => make$i(self2 + that2),
  onInfinity: (self2, that2) => {
    const s = self2.value._tag;
    const t = that2.value._tag;
    if (s === "Infinity" && t === "NegativeInfinity") return zero;
    if (s === "NegativeInfinity" && t === "Infinity") return zero;
    if (s === "Infinity" || t === "Infinity") return infinity;
    if (s === "NegativeInfinity" || t === "NegativeInfinity") return negativeInfinity;
    return zero;
  }
}));
const equals = /* @__PURE__ */ dual(2, (self, that) => Equivalence$2(self, that));
const composePassthrough = /* @__PURE__ */ dual(2, (left, right) => (input) => {
  const leftOut = left(input);
  if (isFailure(leftOut)) return fail$6(input);
  const rightOut = right(leftOut.success);
  if (isFailure(rightOut)) return fail$6(input);
  return rightOut;
});
const Scheduler = /* @__PURE__ */ Reference("effect/Scheduler", {
  defaultValue: () => new MixedScheduler()
});
const setImmediate = "setImmediate" in globalThis ? (f) => {
  const timer = globalThis.setImmediate(f);
  return () => globalThis.clearImmediate(timer);
} : (f) => {
  const timer = setTimeout(f, 0);
  return () => clearTimeout(timer);
};
class PriorityBuckets {
  buckets = [];
  scheduleTask(task, priority) {
    const buckets = this.buckets;
    const len = buckets.length;
    let bucket;
    let index = 0;
    for (; index < len; index++) {
      if (buckets[index][0] > priority) break;
      bucket = buckets[index];
    }
    if (bucket && bucket[0] === priority) {
      bucket[1].push(task);
    } else if (index === len) {
      buckets.push([priority, [task]]);
    } else {
      buckets.splice(index, 0, [priority, [task]]);
    }
  }
  drain() {
    const buckets = this.buckets;
    this.buckets = [];
    return buckets;
  }
}
class MixedScheduler {
  executionMode;
  setImmediate;
  constructor(executionMode = "async", setImmediateFn = setImmediate) {
    this.executionMode = executionMode;
    this.setImmediate = setImmediateFn;
  }
  /**
   * @since 2.0.0
   */
  shouldYield(fiber) {
    return fiber.currentOpCount >= fiber.maxOpsBeforeYield;
  }
  /**
   * @since 2.0.0
   */
  makeDispatcher() {
    return new MixedSchedulerDispatcher(this.setImmediate);
  }
}
class MixedSchedulerDispatcher {
  tasks = /* @__PURE__ */ new PriorityBuckets();
  running = void 0;
  setImmediate;
  constructor(setImmediateFn = setImmediate) {
    this.setImmediate = setImmediateFn;
  }
  /**
   * @since 2.0.0
   */
  scheduleTask(task, priority) {
    this.tasks.scheduleTask(task, priority);
    if (this.running === void 0) {
      this.running = this.setImmediate(this.afterScheduled);
    }
  }
  /**
   * @since 2.0.0
   */
  afterScheduled = () => {
    this.running = void 0;
    this.runTasks();
  };
  /**
   * @since 2.0.0
   */
  runTasks() {
    const buckets = this.tasks.drain();
    for (let i = 0; i < buckets.length; i++) {
      const toRun = buckets[i][1];
      for (let j = 0; j < toRun.length; j++) {
        toRun[j]();
      }
    }
  }
  /**
   * @since 2.0.0
   */
  flush() {
    while (this.tasks.buckets.length > 0) {
      if (this.running !== void 0) {
        this.running();
        this.running = void 0;
      }
      this.runTasks();
    }
  }
}
const MaxOpsBeforeYield = /* @__PURE__ */ Reference("effect/Scheduler/MaxOpsBeforeYield", {
  defaultValue: () => 2048
});
const PreventSchedulerYield = /* @__PURE__ */ Reference("effect/Scheduler/PreventSchedulerYield", {
  defaultValue: () => false
});
const ParentSpanKey = "effect/Tracer/ParentSpan";
class ParentSpan extends (/* @__PURE__ */ Service()(ParentSpanKey)) {
}
const make$h = (options) => options;
const DisablePropagation = /* @__PURE__ */ Reference("effect/Tracer/DisablePropagation", {
  defaultValue: constFalse
});
const CurrentTraceLevel = /* @__PURE__ */ Reference("effect/Tracer/CurrentTraceLevel", {
  defaultValue: () => "Info"
});
const MinimumTraceLevel = /* @__PURE__ */ Reference("effect/Tracer/MinimumTraceLevel", {
  defaultValue: () => "All"
});
const TracerKey = "effect/Tracer";
const Tracer = /* @__PURE__ */ Reference(TracerKey, {
  defaultValue: () => make$h({
    span: (options) => new NativeSpan(options)
  })
});
class NativeSpan {
  _tag = "Span";
  spanId;
  traceId = "native";
  sampled;
  name;
  parent;
  annotations;
  links;
  startTime;
  kind;
  status;
  attributes;
  events = [];
  constructor(options) {
    this.name = options.name;
    this.parent = options.parent;
    this.annotations = options.annotations;
    this.links = options.links;
    this.startTime = options.startTime;
    this.kind = options.kind;
    this.sampled = options.sampled;
    this.status = {
      _tag: "Started",
      startTime: options.startTime
    };
    this.attributes = /* @__PURE__ */ new Map();
    this.traceId = getOrUndefined(options.parent)?.traceId ?? randomHexString(32);
    this.spanId = randomHexString(16);
  }
  end(endTime, exit2) {
    this.status = {
      _tag: "Ended",
      endTime,
      exit: exit2,
      startTime: this.status.startTime
    };
  }
  attribute(key, value) {
    this.attributes.set(key, value);
  }
  event(name, startTime, attributes) {
    this.events.push([name, startTime, attributes ?? {}]);
  }
  addLinks(links) {
    this.links.push(...links);
  }
}
const randomHexString = /* @__PURE__ */ (function() {
  const characters = "abcdef0123456789";
  const charactersLength = characters.length;
  return function(length) {
    let result2 = "";
    for (let i = 0; i < length; i++) {
      result2 += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result2;
  };
})();
const FiberRuntimeMetricsKey = "effect/observability/Metric/FiberRuntimeMetricsKey";
const CurrentConcurrency = /* @__PURE__ */ Reference("effect/References/CurrentConcurrency", {
  defaultValue: () => "unbounded"
});
const CurrentStackFrame = /* @__PURE__ */ Reference("effect/References/CurrentStackFrame", {
  defaultValue: constUndefined
});
const TracerEnabled = /* @__PURE__ */ Reference("effect/References/TracerEnabled", {
  defaultValue: constTrue
});
const TracerTimingEnabled = /* @__PURE__ */ Reference("effect/References/TracerTimingEnabled", {
  defaultValue: constTrue
});
const TracerSpanAnnotations = /* @__PURE__ */ Reference("effect/References/TracerSpanAnnotations", {
  defaultValue: () => ({})
});
const TracerSpanLinks = /* @__PURE__ */ Reference("effect/References/TracerSpanLinks", {
  defaultValue: () => []
});
const CurrentLogAnnotations$1 = /* @__PURE__ */ Reference("effect/References/CurrentLogAnnotations", {
  defaultValue: () => ({})
});
const CurrentLogLevel = /* @__PURE__ */ Reference("effect/References/CurrentLogLevel", {
  defaultValue: () => "Info"
});
const MinimumLogLevel = /* @__PURE__ */ Reference("effect/References/MinimumLogLevel", {
  defaultValue: () => "Info"
});
const CurrentLogSpans$1 = /* @__PURE__ */ Reference("effect/References/CurrentLogSpans", {
  defaultValue: () => []
});
const addSpanStackTrace = (options) => {
  if (options?.captureStackTrace === false) {
    return options;
  } else if (options?.captureStackTrace !== void 0 && typeof options.captureStackTrace !== "boolean") {
    return options;
  }
  const limit = Error.stackTraceLimit;
  Error.stackTraceLimit = 3;
  const traceError = new Error();
  Error.stackTraceLimit = limit;
  return {
    ...options,
    captureStackTrace: spanCleaner(() => traceError.stack)
  };
};
const makeStackCleaner = (line) => (stack) => {
  let cache;
  return () => {
    if (cache !== void 0) return cache;
    const trace = stack();
    if (!trace) return void 0;
    const lines = trace.split("\n");
    if (lines[line] !== void 0) {
      cache = lines[line].trim();
      return cache;
    }
  };
};
const spanCleaner = /* @__PURE__ */ makeStackCleaner(3);
const version = "dev";
class Interrupt extends ReasonBase {
  fiberId;
  constructor(fiberId, annotations = constEmptyAnnotations) {
    super("Interrupt", annotations, "Interrupted");
    this.fiberId = fiberId;
  }
  toString() {
    return `Interrupt(${this.fiberId})`;
  }
  toJSON() {
    return {
      _tag: "Interrupt",
      fiberId: this.fiberId
    };
  }
  [symbol](that) {
    return isInterruptReason(that) && this.fiberId === that.fiberId && this.annotations === that.annotations;
  }
  [symbol$1]() {
    return combine(string$2(`${this._tag}:${this.fiberId}`))(random(this.annotations));
  }
}
const causeInterrupt = (fiberId) => new CauseImpl([new Interrupt(fiberId)]);
const findFail = (self) => {
  const reason = self.reasons.find(isFailReason);
  return reason ? succeed$5(reason) : fail$6(self);
};
const findError$1 = (self) => {
  for (let i = 0; i < self.reasons.length; i++) {
    const reason = self.reasons[i];
    if (reason._tag === "Fail") {
      return succeed$5(reason.error);
    }
  }
  return fail$6(self);
};
const hasInterrupts$1 = (self) => self.reasons.some(isInterruptReason);
const causeFilterInterruptors = (self) => {
  let interruptors;
  for (let i = 0; i < self.reasons.length; i++) {
    const f = self.reasons[i];
    if (f._tag !== "Interrupt") continue;
    interruptors ??= /* @__PURE__ */ new Set();
    if (f.fiberId !== void 0) {
      interruptors.add(f.fiberId);
    }
  }
  return interruptors ? succeed$5(interruptors) : fail$6(self);
};
const hasInterruptsOnly$1 = (self) => self.reasons.length > 0 && self.reasons.every(isInterruptReason);
const causeCombine = /* @__PURE__ */ dual(2, (self, that) => {
  if (self.reasons.length === 0) {
    return that;
  } else if (that.reasons.length === 0) {
    return self;
  }
  const newCause = new CauseImpl(union$1(self.reasons, that.reasons));
  return equals$1(self, newCause) ? self : newCause;
});
const causePartition = (self) => {
  const obj = {
    Fail: [],
    Die: [],
    Interrupt: []
  };
  for (let i = 0; i < self.reasons.length; i++) {
    obj[self.reasons[i]._tag].push(self.reasons[i]);
  }
  return obj;
};
const causeSquash = (self) => {
  const partitioned = causePartition(self);
  if (partitioned.Fail.length > 0) {
    return partitioned.Fail[0].error;
  } else if (partitioned.Die.length > 0) {
    return partitioned.Die[0].defect;
  } else if (partitioned.Interrupt.length > 0) {
    return new globalThis.Error("All fibers interrupted without error");
  }
  return new globalThis.Error("Empty cause");
};
const causePrettyErrors = (self) => {
  const errors = [];
  const interrupts = [];
  if (self.reasons.length === 0) return errors;
  const prevStackLimit = Error.stackTraceLimit;
  Error.stackTraceLimit = 1;
  for (const failure of self.reasons) {
    if (failure._tag === "Interrupt") {
      interrupts.push(failure);
      continue;
    }
    errors.push(causePrettyError(failure._tag === "Die" ? failure.defect : failure.error, failure.annotations));
  }
  if (errors.length === 0) {
    const cause = new Error("The fiber was interrupted by:");
    cause.name = "InterruptCause";
    cause.stack = interruptCauseStack(cause, interrupts);
    const error = new globalThis.Error("All fibers interrupted without error", {
      cause
    });
    error.name = "InterruptError";
    error.stack = `${error.name}: ${error.message}`;
    errors.push(causePrettyError(error, interrupts[0].annotations));
  }
  Error.stackTraceLimit = prevStackLimit;
  return errors;
};
const causePrettyError = (original, annotations) => {
  const kind = typeof original;
  let error;
  if (original && kind === "object") {
    error = new globalThis.Error(causePrettyMessage(original), {
      cause: original.cause ? causePrettyError(original.cause) : void 0
    });
    if (typeof original.name === "string") {
      error.name = original.name;
    }
    if (typeof original.stack === "string") {
      error.stack = cleanErrorStack(original.stack, error, annotations);
    } else {
      const stack = `${error.name}: ${error.message}`;
      error.stack = annotations ? addStackAnnotations(stack, annotations) : stack;
    }
    for (const key of Object.keys(original)) {
      if (!(key in error)) {
        error[key] = original[key];
      }
    }
  } else {
    error = new globalThis.Error(!original ? `Unknown error: ${original}` : kind === "string" ? original : formatJson(original));
  }
  return error;
};
const causePrettyMessage = (u) => {
  if (typeof u.message === "string") {
    return u.message;
  } else if (typeof u.toString === "function" && u.toString !== Object.prototype.toString && u.toString !== Array.prototype.toString) {
    try {
      return u.toString();
    } catch {
    }
  }
  return formatJson(u);
};
const locationRegExp = /\((.*)\)/g;
const cleanErrorStack = (stack, error, annotations) => {
  const message = `${error.name}: ${error.message}`;
  const lines = (stack.startsWith(message) ? stack.slice(message.length) : stack).split("\n");
  const out = [message];
  for (let i = 1; i < lines.length; i++) {
    if (/(?:Generator\.next|~effect\/Effect)/.test(lines[i])) {
      break;
    }
    out.push(lines[i]);
  }
  return annotations ? addStackAnnotations(out.join("\n"), annotations) : out.join("\n");
};
const addStackAnnotations = (stack, annotations) => {
  const frame = annotations?.get(StackTraceKey.key);
  if (frame) {
    stack = `${stack}
${currentStackTrace(frame)}`;
  }
  return stack;
};
const interruptCauseStack = (error, interrupts) => {
  const out = [`${error.name}: ${error.message}`];
  for (const current of interrupts) {
    const fiberId = current.fiberId !== void 0 ? `#${current.fiberId}` : "unknown";
    const frame = current.annotations.get(InterruptorStackTrace.key);
    out.push(`    at fiber (${fiberId})`);
    if (frame) out.push(currentStackTrace(frame));
  }
  return out.join("\n");
};
const currentStackTrace = (frame) => {
  const out = [];
  let current = frame;
  let i = 0;
  while (current && i < 10) {
    const stack = current.stack();
    if (stack) {
      const locationMatchAll = stack.matchAll(locationRegExp);
      let match2 = false;
      for (const [, location2] of locationMatchAll) {
        match2 = true;
        out.push(`    at ${current.name} (${location2})`);
      }
      if (!match2) {
        out.push(`    at ${current.name} (${stack.replace(/^at /, "")})`);
      }
    } else {
      out.push(`    at ${current.name}`);
    }
    current = current.parent;
    i++;
  }
  return out.join("\n");
};
const causePretty = (cause) => causePrettyErrors(cause).map((e) => e.cause ? `${e.stack} {
${renderErrorCause(e.cause, "  ")}
}` : e.stack).join("\n");
const renderErrorCause = (cause, prefix) => {
  const lines = cause.stack.split("\n");
  let stack = `${prefix}[cause]: ${lines[0]}`;
  for (let i = 1, len = lines.length; i < len; i++) {
    stack += `
${prefix}${lines[i]}`;
  }
  if (cause.cause) {
    stack += ` {
${renderErrorCause(cause.cause, `${prefix}  `)}
${prefix}}`;
  }
  return stack;
};
const FiberTypeId = `~effect/Fiber/${version}`;
const fiberVariance = {
  _A: identity,
  _E: identity
};
const fiberIdStore = {
  id: 0
};
const getCurrentFiber = () => globalThis[currentFiberTypeId];
class FiberImpl {
  constructor(context2, interruptible2 = true) {
    this[FiberTypeId] = fiberVariance;
    this.setContext(context2);
    this.id = ++fiberIdStore.id;
    this.currentOpCount = 0;
    this.currentLoopCount = 0;
    this.interruptible = interruptible2;
    this._stack = [];
    this._observers = [];
    this._exit = void 0;
    this._children = void 0;
    this._interruptedCause = void 0;
    this._yielded = void 0;
  }
  [FiberTypeId];
  id;
  interruptible;
  currentOpCount;
  currentLoopCount;
  _stack;
  _observers;
  _exit;
  _currentExit;
  _children;
  _interruptedCause;
  _yielded;
  // set in setContext
  context;
  currentScheduler;
  currentTracerContext;
  currentSpan;
  currentLogLevel;
  minimumLogLevel;
  currentStackFrame;
  runtimeMetrics;
  maxOpsBeforeYield;
  currentPreventYield;
  _dispatcher = void 0;
  get currentDispatcher() {
    return this._dispatcher ??= this.currentScheduler.makeDispatcher();
  }
  getRef(ref) {
    return getReferenceUnsafe(this.context, ref);
  }
  addObserver(cb) {
    if (this._exit) {
      cb(this._exit);
      return constVoid;
    }
    this._observers.push(cb);
    return () => {
      const index = this._observers.indexOf(cb);
      if (index >= 0) {
        this._observers.splice(index, 1);
      }
    };
  }
  interruptUnsafe(fiberId, annotations) {
    if (this._exit) {
      return;
    }
    let cause = causeInterrupt(fiberId);
    if (this.currentStackFrame) {
      cause = causeAnnotate(cause, make$j(StackTraceKey, this.currentStackFrame));
    }
    if (annotations) {
      cause = causeAnnotate(cause, annotations);
    }
    this._interruptedCause = this._interruptedCause ? causeCombine(this._interruptedCause, cause) : cause;
    if (this.interruptible) {
      this.evaluate(failCause$2(this._interruptedCause));
    }
  }
  pollUnsafe() {
    return this._exit;
  }
  evaluate(effect2) {
    this.runtimeMetrics?.recordFiberStart(this.context);
    if (this._exit) {
      return;
    } else if (this._yielded !== void 0) {
      const yielded = this._yielded;
      this._yielded = void 0;
      yielded();
    }
    const exit2 = this.runLoop(effect2);
    if (exit2 === Yield) {
      return;
    }
    this._exit = exit2;
    this.runtimeMetrics?.recordFiberEnd(this.context, this._exit);
    for (let i = 0; i < this._observers.length; i++) {
      this._observers[i](exit2);
    }
    this._observers.length = 0;
  }
  runLoop(effect2) {
    const prevFiber = globalThis[currentFiberTypeId];
    globalThis[currentFiberTypeId] = this;
    let yielding = false;
    let current = effect2;
    this.currentOpCount = 0;
    const currentLoop = ++this.currentLoopCount;
    try {
      while (true) {
        this.currentOpCount++;
        if (!yielding && !this.currentPreventYield && this.currentScheduler.shouldYield(this)) {
          yielding = true;
          const prev = current;
          current = flatMap$2(yieldNow, () => prev);
        }
        current = this.currentTracerContext ? this.currentTracerContext(current, this) : current[evaluate](this);
        if (currentLoop !== this.currentLoopCount) {
          return Yield;
        } else if (current === Yield) {
          const yielded = this._yielded;
          if (ExitTypeId in yielded) {
            this._yielded = void 0;
            return yielded;
          }
          return Yield;
        }
      }
    } catch (error) {
      if (!hasProperty(current, evaluate)) {
        return exitDie(`Fiber.runLoop: Not a valid effect: ${String(current)}`);
      }
      return this.runLoop(exitDie(error));
    } finally {
      globalThis[currentFiberTypeId] = prevFiber;
    }
  }
  getCont(symbol2) {
    while (true) {
      const op = this._stack.pop();
      if (!op) return void 0;
      const cont = op[contAll] && op[contAll](this);
      if (cont) {
        cont[symbol2] = cont;
        return cont;
      }
      if (op[symbol2]) return op;
    }
  }
  yieldWith(value) {
    this._yielded = value;
    return Yield;
  }
  children() {
    return this._children ??= /* @__PURE__ */ new Set();
  }
  pipe() {
    return pipeArguments(this, arguments);
  }
  setContext(context2) {
    this.context = context2;
    const scheduler = this.getRef(Scheduler);
    if (scheduler !== this.currentScheduler) {
      this.currentScheduler = scheduler;
      this._dispatcher = void 0;
    }
    this.currentSpan = context2.mapUnsafe.get(ParentSpanKey);
    this.currentLogLevel = this.getRef(CurrentLogLevel);
    this.minimumLogLevel = this.getRef(MinimumLogLevel);
    this.currentStackFrame = context2.mapUnsafe.get(CurrentStackFrame.key);
    this.maxOpsBeforeYield = this.getRef(MaxOpsBeforeYield);
    this.currentPreventYield = this.getRef(PreventSchedulerYield);
    this.runtimeMetrics = context2.mapUnsafe.get(FiberRuntimeMetricsKey);
    const currentTracer = context2.mapUnsafe.get(TracerKey);
    this.currentTracerContext = currentTracer ? currentTracer["context"] : void 0;
  }
  get currentSpanLocal() {
    return this.currentSpan?._tag === "Span" ? this.currentSpan : void 0;
  }
}
const fiberStackAnnotations = (fiber) => {
  if (!fiber.currentStackFrame) return void 0;
  const annotations = /* @__PURE__ */ new Map();
  annotations.set(StackTraceKey.key, fiber.currentStackFrame);
  return makeUnsafe$4(annotations);
};
const fiberAwait = (self) => {
  const impl = self;
  if (impl._exit) return succeed$4(impl._exit);
  return callback((resume) => {
    if (impl._exit) return resume(succeed$4(impl._exit));
    return sync$1(self.addObserver((exit2) => resume(succeed$4(exit2))));
  });
};
const fiberAwaitAll = (self) => callback((resume) => {
  const iter = self[Symbol.iterator]();
  const exits = [];
  let cancel = void 0;
  function loop() {
    let result2 = iter.next();
    while (!result2.done) {
      if (result2.value._exit) {
        exits.push(result2.value._exit);
        result2 = iter.next();
        continue;
      }
      cancel = result2.value.addObserver((exit2) => {
        exits.push(exit2);
        loop();
      });
      return;
    }
    resume(succeed$4(exits));
  }
  loop();
  return sync$1(() => cancel?.());
});
const fiberInterrupt = (self) => withFiber$1((fiber) => fiberInterruptAs(self, fiber.id));
const fiberInterruptAs = /* @__PURE__ */ dual((args2) => hasProperty(args2[0], FiberTypeId), (self, fiberId, annotations) => withFiber$1((parent) => {
  let ann = fiberStackAnnotations(parent);
  ann = ann && annotations ? merge$2(ann, annotations) : ann ?? annotations;
  self.interruptUnsafe(fiberId, ann);
  return asVoid$1(fiberAwait(self));
}));
const fiberInterruptAll = (fibers) => withFiber$1((parent) => {
  const annotations = fiberStackAnnotations(parent);
  for (const fiber of fibers) {
    fiber.interruptUnsafe(parent.id, annotations);
  }
  return asVoid$1(fiberAwaitAll(fibers));
});
const succeed$4 = exitSucceed;
const failCause$2 = exitFailCause;
const fail$5 = exitFail;
const sync$1 = /* @__PURE__ */ makePrimitive({
  op: "Sync",
  [evaluate](fiber) {
    const value = this[args]();
    const cont = fiber.getCont(contA);
    return cont ? cont[contA](value, fiber) : fiber.yieldWith(exitSucceed(value));
  }
});
const suspend$3 = /* @__PURE__ */ makePrimitive({
  op: "Suspend",
  [evaluate](_fiber) {
    return this[args]();
  }
});
const yieldNowWith = /* @__PURE__ */ makePrimitive({
  op: "Yield",
  [evaluate](fiber) {
    let resumed = false;
    fiber.currentDispatcher.scheduleTask(() => {
      if (resumed) return;
      fiber.evaluate(exitVoid);
    }, this[args] ?? 0);
    return fiber.yieldWith(() => {
      resumed = true;
    });
  }
});
const yieldNow = /* @__PURE__ */ yieldNowWith(0);
const succeedSome$1 = (a) => succeed$4(some(a));
const succeedNone$1 = /* @__PURE__ */ succeed$4(/* @__PURE__ */ none());
const die$1 = (defect) => exitDie(defect);
const failSync = (error) => suspend$3(() => fail$5(internalCall(error)));
const void_$2 = /* @__PURE__ */ succeed$4(void 0);
const try_$1 = (options) => suspend$3(() => {
  try {
    return succeed$4(internalCall(options.try));
  } catch (err) {
    return fail$5(internalCall(() => options.catch(err)));
  }
});
const promise$1 = (evaluate2) => callbackOptions(function(resume, signal) {
  internalCall(() => evaluate2(signal)).then((a) => resume(succeed$4(a)), (e) => resume(die$1(e)));
}, evaluate2.length !== 0);
const tryPromise$1 = (options) => {
  const f = typeof options === "function" ? options : options.try;
  const catcher = typeof options === "function" ? (cause) => new UnknownError(cause, "An error occurred in Effect.tryPromise") : options.catch;
  return callbackOptions(function(resume, signal) {
    try {
      internalCall(() => f(signal)).then((a) => resume(succeed$4(a)), (e) => resume(fail$5(internalCall(() => catcher(e)))));
    } catch (err) {
      resume(fail$5(internalCall(() => catcher(err))));
    }
  }, eval.length !== 0);
};
const withFiberId = (f) => withFiber$1((fiber) => f(fiber.id));
const callbackOptions = /* @__PURE__ */ makePrimitive({
  op: "Async",
  single: false,
  [evaluate](fiber) {
    const register = internalCall(() => this[args][0].bind(fiber.currentScheduler));
    let resumed = false;
    let yielded = false;
    const controller = this[args][1] ? new AbortController() : void 0;
    const onCancel = register((effect2) => {
      if (resumed) return;
      resumed = true;
      if (yielded) {
        fiber.evaluate(effect2);
      } else {
        yielded = effect2;
      }
    }, controller?.signal);
    if (yielded !== false) return yielded;
    yielded = true;
    fiber._yielded = () => {
      resumed = true;
    };
    if (controller === void 0 && onCancel === void 0) {
      return Yield;
    }
    fiber._stack.push(asyncFinalizer(() => {
      resumed = true;
      controller?.abort();
      return onCancel ?? exitVoid;
    }));
    return Yield;
  }
});
const asyncFinalizer = /* @__PURE__ */ makePrimitive({
  op: "AsyncFinalizer",
  [contAll](fiber) {
    if (fiber.interruptible) {
      fiber.interruptible = false;
      fiber._stack.push(setInterruptibleTrue);
    }
  },
  [contE](cause, _fiber) {
    return hasInterrupts$1(cause) ? flatMap$2(this[args](), () => failCause$2(cause)) : failCause$2(cause);
  }
});
const callback = (register) => callbackOptions(register, register.length >= 2);
const gen$1 = (...args2) => suspend$3(() => fromIteratorUnsafe(args2.length === 1 ? args2[0]() : args2[1].call(args2[0].self)));
const fnUntraced$1 = (body, ...pipeables) => {
  const fn2 = pipeables.length === 0 ? function() {
    return suspend$3(() => fromIteratorUnsafe(body.apply(this, arguments)));
  } : function() {
    let effect2 = suspend$3(() => fromIteratorUnsafe(body.apply(this, arguments)));
    for (let i = 0; i < pipeables.length; i++) {
      effect2 = pipeables[i](effect2, ...arguments);
    }
    return effect2;
  };
  return defineFunctionLength(body.length, fn2);
};
const defineFunctionLength = (length, fn2) => Object.defineProperty(fn2, "length", {
  value: length,
  configurable: true
});
const fnStackCleaner = /* @__PURE__ */ makeStackCleaner(2);
const fn$1 = function() {
  const nameFirst = typeof arguments[0] === "string";
  const name = nameFirst ? arguments[0] : "Effect.fn";
  const spanOptions = nameFirst ? arguments[1] : void 0;
  const prevLimit = globalThis.Error.stackTraceLimit;
  globalThis.Error.stackTraceLimit = 2;
  const defError = new globalThis.Error();
  globalThis.Error.stackTraceLimit = prevLimit;
  if (nameFirst) {
    return (body, ...pipeables) => makeFn(name, body, defError, pipeables, nameFirst, spanOptions);
  }
  return makeFn(name, arguments[0], defError, Array.prototype.slice.call(arguments, 1), nameFirst, spanOptions);
};
const makeFn = (name, bodyOrOptions, defError, pipeables, addSpan, spanOptions) => {
  const body = typeof bodyOrOptions === "function" ? bodyOrOptions : pipeables.pop().bind(bodyOrOptions.self);
  return defineFunctionLength(body.length, function(...args2) {
    let result2 = suspend$3(() => {
      const iter = body.apply(this, arguments);
      return isEffect$1(iter) ? iter : fromIteratorUnsafe(iter);
    });
    for (let i = 0; i < pipeables.length; i++) {
      result2 = pipeables[i](result2, ...args2);
    }
    if (!isEffect$1(result2)) {
      return result2;
    }
    const prevLimit = globalThis.Error.stackTraceLimit;
    globalThis.Error.stackTraceLimit = 2;
    const callError = new globalThis.Error();
    globalThis.Error.stackTraceLimit = prevLimit;
    return updateService(addSpan ? useSpan$1(name, spanOptions, (span) => provideParentSpan(result2, span)) : result2, CurrentStackFrame, (prev) => ({
      name,
      stack: fnStackCleaner(() => callError.stack),
      parent: {
        name: `${name} (definition)`,
        stack: fnStackCleaner(() => defError.stack),
        parent: prev
      }
    }));
  });
};
const fnUntracedEager$1 = (body, ...pipeables) => defineFunctionLength(body.length, pipeables.length === 0 ? function() {
  return fromIteratorEagerUnsafe(() => body.apply(this, arguments));
} : function() {
  let effect2 = fromIteratorEagerUnsafe(() => body.apply(this, arguments));
  for (const pipeable of pipeables) {
    effect2 = pipeable(effect2);
  }
  return effect2;
});
const fromIteratorEagerUnsafe = (evaluate2) => {
  try {
    const iterator = evaluate2();
    let value = void 0;
    while (true) {
      const state = iterator.next(value);
      if (state.done) {
        return succeed$4(state.value);
      }
      const yieldable = state.value;
      const effect2 = yieldable.asEffect();
      const primitive = effect2;
      if (primitive && primitive._tag === "Success") {
        value = primitive.value;
        continue;
      } else if (primitive && primitive._tag === "Failure") {
        return effect2;
      } else {
        let isFirstExecution = true;
        return suspend$3(() => {
          if (isFirstExecution) {
            isFirstExecution = false;
            return flatMap$2(effect2, (value2) => fromIteratorUnsafe(iterator, value2));
          } else {
            return suspend$3(() => fromIteratorUnsafe(evaluate2()));
          }
        });
      }
    }
  } catch (error) {
    return die$1(error);
  }
};
const fromIteratorUnsafe = /* @__PURE__ */ makePrimitive({
  op: "Iterator",
  single: false,
  [contA](value, fiber) {
    const iter = this[args][0];
    while (true) {
      const state = iter.next(value);
      if (state.done) return succeed$4(state.value);
      const eff = state.value.asEffect();
      if (!effectIsExit(eff)) {
        fiber._stack.push(this);
        return eff;
      } else if (eff._tag === "Failure") {
        return eff;
      }
      value = eff.value;
    }
  },
  [evaluate](fiber) {
    return this[contA](this[args][1], fiber);
  }
});
const as$1 = /* @__PURE__ */ dual(2, (self, value) => {
  const b = succeed$4(value);
  return flatMap$2(self, (_) => b);
});
const asSome = (self) => map$2(self, some);
const andThen$1 = /* @__PURE__ */ dual(2, (self, f) => flatMap$2(self, (a) => isEffect$1(f) ? f : internalCall(() => f(a))));
const tap$1 = /* @__PURE__ */ dual(2, (self, f) => flatMap$2(self, (a) => as$1(isEffect$1(f) ? f : internalCall(() => f(a)), a)));
const asVoid$1 = (self) => flatMap$2(self, (_) => exitVoid);
const raceAllFirst = (all2, options) => withFiber$1((parent) => callback((resume) => {
  let done2 = false;
  const fibers = /* @__PURE__ */ new Set();
  const onExit2 = (exit2) => {
    done2 = true;
    resume(fibers.size === 0 ? exit2 : flatMap$2(uninterruptible(fiberInterruptAll(fibers)), () => exit2));
  };
  let i = 0;
  for (const effect2 of all2) {
    if (done2) break;
    const index = i++;
    const fiber = forkUnsafe$1(parent, effect2, true, true, false);
    fibers.add(fiber);
    fiber.addObserver((exit2) => {
      fibers.delete(fiber);
      const isWinner = !done2;
      onExit2(exit2);
      if (isWinner && options?.onWinner) {
        options.onWinner({
          fiber,
          index,
          parentFiber: parent
        });
      }
    });
  }
  return fiberInterruptAll(fibers);
}));
const raceFirst = /* @__PURE__ */ dual((args2) => isEffect$1(args2[1]), (self, that, options) => raceAllFirst([self, that], options));
const flatMap$2 = /* @__PURE__ */ dual(2, (self, f) => {
  const onSuccess = Object.create(OnSuccessProto);
  onSuccess[args] = self;
  onSuccess[contA] = f.length !== 1 ? (a) => f(a) : f;
  return onSuccess;
});
const OnSuccessProto = /* @__PURE__ */ makePrimitiveProto({
  op: "OnSuccess",
  [evaluate](fiber) {
    fiber._stack.push(this);
    return this[args];
  }
});
const effectIsExit = (effect2) => ExitTypeId in effect2;
const flatMapEager$1 = /* @__PURE__ */ dual(2, (self, f) => {
  if (effectIsExit(self)) {
    return self._tag === "Success" ? f(self.value) : self;
  }
  return flatMap$2(self, f);
});
const flatten$1 = (self) => flatMap$2(self, identity);
const map$2 = /* @__PURE__ */ dual(2, (self, f) => flatMap$2(self, (a) => succeed$4(internalCall(() => f(a)))));
const mapEager$1 = /* @__PURE__ */ dual(2, (self, f) => effectIsExit(self) ? exitMap(self, f) : map$2(self, f));
const mapErrorEager$1 = /* @__PURE__ */ dual(2, (self, f) => effectIsExit(self) ? exitMapError(self, f) : mapError$1(self, f));
const catchEager$1 = /* @__PURE__ */ dual(2, (self, f) => {
  if (effectIsExit(self)) {
    if (self._tag === "Success") return self;
    const error = findError$1(self.cause);
    if (isFailure(error)) return self;
    return f(error.success);
  }
  return catch_$1(self, f);
});
const exitIsSuccess = (self) => self._tag === "Success";
const exitFilterCause = (self) => self._tag === "Failure" ? succeed$5(self.cause) : fail$6(self);
const exitVoid = /* @__PURE__ */ exitSucceed(void 0);
const exitMap = /* @__PURE__ */ dual(2, (self, f) => self._tag === "Success" ? exitSucceed(f(self.value)) : self);
const exitMapError = /* @__PURE__ */ dual(2, (self, f) => {
  if (self._tag === "Success") return self;
  const error = findError$1(self.cause);
  if (isFailure(error)) return self;
  return exitFail(f(error.success));
});
const exitAsVoidAll = (exits) => {
  const failures = [];
  for (const exit2 of exits) {
    if (exit2._tag === "Failure") {
      failures.push(...exit2.cause.reasons);
    }
  }
  return failures.length === 0 ? exitVoid : exitFailCause(causeFromReasons(failures));
};
const exitGetSuccess = (self) => exitIsSuccess(self) ? some(self.value) : none();
const updateContext$1 = /* @__PURE__ */ dual(2, (self, f) => withFiber$1((fiber) => {
  const prevContext = fiber.context;
  const nextContext = f(prevContext);
  if (prevContext === nextContext) return self;
  fiber.setContext(nextContext);
  return onExitPrimitive(self, () => {
    fiber.setContext(prevContext);
    return void 0;
  });
}));
const updateService = /* @__PURE__ */ dual(3, (self, service, f) => updateContext$1(self, (s) => {
  const prev = getUnsafe(s, service);
  const next = f(prev);
  if (prev === next) return s;
  return add(s, service, next);
}));
const context$1 = () => getContext;
const getContext = /* @__PURE__ */ withFiber$1((fiber) => succeed$4(fiber.context));
const contextWith$1 = (f) => withFiber$1((fiber) => f(fiber.context));
const provideContext$1 = /* @__PURE__ */ dual(2, (self, context2) => {
  if (effectIsExit(self)) return self;
  return updateContext$1(self, merge$2(context2));
});
const provideService$1 = function() {
  if (arguments.length === 1) {
    return dual(2, (self, impl) => provideServiceImpl(self, arguments[0], impl));
  }
  return dual(3, (self, service, impl) => provideServiceImpl(self, service, impl)).apply(this, arguments);
};
const provideServiceImpl = (self, service, implementation) => updateContext$1(self, (s) => {
  const prev = s.mapUnsafe.get(service.key);
  if (prev === implementation) return s;
  return add(s, service, implementation);
});
const forever$2 = /* @__PURE__ */ dual((args2) => isEffect$1(args2[0]), (self, options) => whileLoop({
  while: constTrue,
  body: constant(options?.disableYield ? self : flatMap$2(self, (_) => yieldNow)),
  step: constVoid
}));
const catchCause$1 = /* @__PURE__ */ dual(2, (self, f) => {
  const onFailure = Object.create(OnFailureProto);
  onFailure[args] = self;
  onFailure[contE] = f.length !== 1 ? (cause) => f(cause) : f;
  return onFailure;
});
const OnFailureProto = /* @__PURE__ */ makePrimitiveProto({
  op: "OnFailure",
  [evaluate](fiber) {
    fiber._stack.push(this);
    return this[args];
  }
});
const catchCauseFilter = /* @__PURE__ */ dual(3, (self, filter2, f) => catchCause$1(self, (cause) => {
  const eb = filter2(cause);
  return isFailure(eb) ? failCause$2(eb.failure) : internalCall(() => f(eb.success, cause));
}));
const catch_$1 = /* @__PURE__ */ dual(2, (self, f) => catchCauseFilter(self, findError$1, (e) => f(e)));
const mapError$1 = /* @__PURE__ */ dual(2, (self, f) => catch_$1(self, (error) => failSync(() => f(error))));
const orDie$1 = (self) => catch_$1(self, die$1);
const ignore$1 = /* @__PURE__ */ dual((args2) => isEffect$1(args2[0]), (self, options) => {
  if (!options?.log) {
    return matchEffect$1(self, {
      onFailure: (_) => void_$2,
      onSuccess: (_) => void_$2
    });
  }
  const logEffect = logWithLevel(options.log === true ? void 0 : options.log);
  return matchCauseEffect$1(self, {
    onFailure(cause) {
      const failure = findFail(cause);
      return isFailure(failure) ? failCause$2(failure.failure) : options.message === void 0 ? logEffect(cause) : logEffect(options.message, cause);
    },
    onSuccess: (_) => void_$2
  });
});
const result$1 = (self) => matchEager(self, {
  onFailure: fail$6,
  onSuccess: succeed$5
});
const matchCauseEffect$1 = /* @__PURE__ */ dual(2, (self, options) => {
  const primitive = Object.create(OnSuccessAndFailureProto);
  primitive[args] = self;
  primitive[contA] = options.onSuccess.length !== 1 ? (a) => options.onSuccess(a) : options.onSuccess;
  primitive[contE] = options.onFailure.length !== 1 ? (cause) => options.onFailure(cause) : options.onFailure;
  return primitive;
});
const OnSuccessAndFailureProto = /* @__PURE__ */ makePrimitiveProto({
  op: "OnSuccessAndFailure",
  [evaluate](fiber) {
    fiber._stack.push(this);
    return this[args];
  }
});
const matchEffect$1 = /* @__PURE__ */ dual(2, (self, options) => matchCauseEffect$1(self, {
  onFailure: (cause) => {
    const fail2 = cause.reasons.find(isFailReason);
    return fail2 ? internalCall(() => options.onFailure(fail2.error)) : failCause$2(cause);
  },
  onSuccess: options.onSuccess
}));
const match = /* @__PURE__ */ dual(2, (self, options) => matchEffect$1(self, {
  onFailure: (error) => sync$1(() => options.onFailure(error)),
  onSuccess: (value) => sync$1(() => options.onSuccess(value))
}));
const matchEager = /* @__PURE__ */ dual(2, (self, options) => {
  if (effectIsExit(self)) {
    if (self._tag === "Success") return exitSucceed(options.onSuccess(self.value));
    const error = findError$1(self.cause);
    if (isFailure(error)) return self;
    return exitSucceed(options.onFailure(error.success));
  }
  return match(self, options);
});
const exit$1 = (self) => effectIsExit(self) ? exitSucceed(self) : exitPrimitive(self);
const exitPrimitive = /* @__PURE__ */ makePrimitive({
  op: "Exit",
  [evaluate](fiber) {
    fiber._stack.push(this);
    return this[args];
  },
  [contA](value, _, exit2) {
    return succeed$4(exit2 ?? exitSucceed(value));
  },
  [contE](cause, _, exit2) {
    return succeed$4(exit2 ?? exitFailCause(cause));
  }
});
const timeoutOption$1 = /* @__PURE__ */ dual(2, (self, duration) => raceFirst(asSome(self), as$1(sleep$1(duration), none())));
const ScopeTypeId = "~effect/Scope";
const ScopeCloseableTypeId = "~effect/Scope/Closeable";
const scopeTag = /* @__PURE__ */ Service("effect/Scope");
const scopeClose = (self, exit_) => suspend$3(() => scopeCloseUnsafe(self, exit_) ?? void_$2);
const scopeCloseUnsafe = (self, exit_) => {
  if (self.state._tag === "Closed") return;
  const closed = {
    _tag: "Closed",
    exit: exit_
  };
  if (self.state._tag === "Empty") {
    self.state = closed;
    return;
  }
  const {
    finalizers
  } = self.state;
  self.state = closed;
  if (finalizers.size === 0) {
    return;
  } else if (finalizers.size === 1) {
    return finalizers.values().next().value(exit_);
  }
  return scopeCloseFinalizers(self, finalizers, exit_);
};
const scopeCloseFinalizers = /* @__PURE__ */ fnUntraced$1(function* (self, finalizers, exit_) {
  let exits = [];
  const fibers = [];
  const arr = Array.from(finalizers.values());
  const parent = getCurrentFiber();
  for (let i = arr.length - 1; i >= 0; i--) {
    const finalizer = arr[i];
    if (self.strategy === "sequential") {
      exits.push(yield* exit$1(finalizer(exit_)));
    } else {
      fibers.push(forkUnsafe$1(parent, finalizer(exit_), true, true, "inherit"));
    }
  }
  if (fibers.length > 0) {
    exits = yield* fiberAwaitAll(fibers);
  }
  return yield* exitAsVoidAll(exits);
});
const scopeForkUnsafe = (scope, finalizerStrategy) => {
  const newScope = scopeMakeUnsafe(finalizerStrategy);
  if (scope.state._tag === "Closed") {
    newScope.state = scope.state;
    return newScope;
  }
  const key = {};
  scopeAddFinalizerUnsafe(scope, key, (exit2) => scopeClose(newScope, exit2));
  scopeAddFinalizerUnsafe(newScope, key, (_) => sync$1(() => scopeRemoveFinalizerUnsafe(scope, key)));
  return newScope;
};
const scopeAddFinalizerExit = (scope, finalizer) => {
  return suspend$3(() => {
    if (scope.state._tag === "Closed") {
      return finalizer(scope.state.exit);
    }
    scopeAddFinalizerUnsafe(scope, {}, finalizer);
    return void_$2;
  });
};
const scopeAddFinalizer = (scope, finalizer) => scopeAddFinalizerExit(scope, constant(finalizer));
const scopeAddFinalizerUnsafe = (scope, key, finalizer) => {
  if (scope.state._tag === "Empty") {
    scope.state = {
      _tag: "Open",
      finalizers: /* @__PURE__ */ new Map([[key, finalizer]])
    };
  } else if (scope.state._tag === "Open") {
    scope.state.finalizers.set(key, finalizer);
  }
};
const scopeRemoveFinalizerUnsafe = (scope, key) => {
  if (scope.state._tag === "Open") {
    scope.state.finalizers.delete(key);
  }
};
const scopeMakeUnsafe = (finalizerStrategy = "sequential") => ({
  [ScopeCloseableTypeId]: ScopeCloseableTypeId,
  [ScopeTypeId]: ScopeTypeId,
  strategy: finalizerStrategy,
  state: constScopeEmpty
});
const constScopeEmpty = {
  _tag: "Empty"
};
const provideScope = /* @__PURE__ */ provideService$1(scopeTag);
const onExitPrimitive = /* @__PURE__ */ makePrimitive({
  op: "OnExit",
  single: false,
  [evaluate](fiber) {
    fiber._stack.push(this);
    return this[args][0];
  },
  [contAll](fiber) {
    if (fiber.interruptible && this[args][2] !== true) {
      fiber._stack.push(setInterruptibleTrue);
      fiber.interruptible = false;
    }
  },
  [contA](value, _, exit2) {
    exit2 ??= exitSucceed(value);
    const eff = this[args][1](exit2);
    return eff ? flatMap$2(eff, (_2) => exit2) : exit2;
  },
  [contE](cause, _, exit2) {
    exit2 ??= exitFailCause(cause);
    const eff = this[args][1](exit2);
    return eff ? flatMap$2(eff, (_2) => exit2) : exit2;
  }
});
const onExit$2 = /* @__PURE__ */ dual(2, onExitPrimitive);
const onExitFilter = /* @__PURE__ */ dual(3, (self, filter2, f) => onExit$2(self, (exit2) => {
  const b = filter2(exit2);
  return isFailure(b) ? void_$2 : f(b.success, exit2);
}));
const onError$1 = /* @__PURE__ */ dual(2, (self, f) => onExitFilter(self, exitFilterCause, f));
const onErrorFilter = /* @__PURE__ */ dual(3, (self, filter2, f) => onExit$2(self, (exit2) => {
  if (exit2._tag !== "Failure") {
    return void_$2;
  }
  const result2 = filter2(exit2.cause);
  return isFailure(result2) ? void_$2 : f(result2.success, exit2.cause);
}));
const onInterrupt$1 = /* @__PURE__ */ dual(2, (self, finalizer) => onErrorFilter(causeFilterInterruptors, finalizer)(self));
const cachedInvalidateWithTTL = /* @__PURE__ */ dual(2, (self, ttl) => sync$1(() => {
  const ttlMillis = toMillis(fromInputUnsafe(ttl));
  const isFinite = Number.isFinite(ttlMillis);
  const latch = makeLatchUnsafe(false);
  let expiresAt = 0;
  let running = false;
  let exit2;
  const wait = flatMap$2(latch.await, () => exit2);
  return [withFiber$1((fiber) => {
    const clock = fiber.getRef(ClockRef);
    const now = isFinite ? clock.currentTimeMillisUnsafe() : 0;
    if (running || now < expiresAt) return exit2 ?? wait;
    running = true;
    latch.closeUnsafe();
    exit2 = void 0;
    return onExit$2(self, (exit_) => sync$1(() => {
      running = false;
      expiresAt = clock.currentTimeMillisUnsafe() + ttlMillis;
      exit2 = exit_;
      latch.openUnsafe();
    }));
  }), sync$1(() => {
    expiresAt = 0;
    latch.closeUnsafe();
    exit2 = void 0;
  })];
}));
const cachedWithTTL = /* @__PURE__ */ dual(2, (self, timeToLive) => map$2(cachedInvalidateWithTTL(self, timeToLive), (tuple) => tuple[0]));
const cached$1 = (self) => cachedWithTTL(self, infinity);
const uninterruptible = (self) => withFiber$1((fiber) => {
  if (!fiber.interruptible) return self;
  fiber.interruptible = false;
  fiber._stack.push(setInterruptibleTrue);
  return self;
});
const setInterruptible = /* @__PURE__ */ makePrimitive({
  op: "SetInterruptible",
  [contAll](fiber) {
    fiber.interruptible = this[args];
    if (fiber._interruptedCause && fiber.interruptible) {
      return () => failCause$2(fiber._interruptedCause);
    }
  }
});
const setInterruptibleTrue = /* @__PURE__ */ setInterruptible(true);
const setInterruptibleFalse = /* @__PURE__ */ setInterruptible(false);
const interruptible$1 = (self) => withFiber$1((fiber) => {
  if (fiber.interruptible) return self;
  fiber.interruptible = true;
  fiber._stack.push(setInterruptibleFalse);
  if (fiber._interruptedCause) return failCause$2(fiber._interruptedCause);
  return self;
});
const uninterruptibleMask$1 = (f) => withFiber$1((fiber) => {
  if (!fiber.interruptible) return f(identity);
  fiber.interruptible = false;
  fiber._stack.push(setInterruptibleTrue);
  return f(interruptible$1);
});
const all$2 = (arg, options) => {
  if (isIterable(arg)) {
    return options?.mode === "result" ? forEach(arg, result$1, options) : forEach(arg, identity, options);
  } else if (options?.discard) {
    return options.mode === "result" ? forEach(Object.values(arg), result$1, options) : forEach(Object.values(arg), identity, options);
  }
  return suspend$3(() => {
    const out = {};
    return as$1(forEach(Object.entries(arg), ([key, effect2]) => map$2(options?.mode === "result" ? result$1(effect2) : effect2, (value) => {
      out[key] = value;
    }), {
      discard: true,
      concurrency: options?.concurrency
    }), out);
  });
};
const whileLoop = /* @__PURE__ */ makePrimitive({
  op: "While",
  [contA](value, fiber) {
    this[args].step(value);
    if (this[args].while()) {
      fiber._stack.push(this);
      return this[args].body();
    }
    return exitVoid;
  },
  [evaluate](fiber) {
    if (this[args].while()) {
      fiber._stack.push(this);
      return this[args].body();
    }
    return exitVoid;
  }
});
const forEach = /* @__PURE__ */ dual((args2) => typeof args2[1] === "function", (iterable, f, options) => withFiber$1((parent) => {
  const concurrencyOption = options?.concurrency === "inherit" ? parent.getRef(CurrentConcurrency) : options?.concurrency ?? 1;
  const concurrency = concurrencyOption === "unbounded" ? Number.POSITIVE_INFINITY : Math.max(1, concurrencyOption);
  if (concurrency === 1) {
    return forEachSequential(iterable, f, options);
  }
  const items = fromIterable$1(iterable);
  let length = items.length;
  if (length === 0) {
    return options?.discard ? void_$2 : succeed$4([]);
  }
  const out = options?.discard ? void 0 : new Array(length);
  const eff = forEachConcurrent({
    f,
    out
  }, items, {
    concurrency
  });
  return eff ? as$1(eff, out) : succeed$4(out);
}));
const forEachSequential = (iterable, f, options) => suspend$3(() => {
  const out = options?.discard ? void 0 : [];
  const iterator = iterable[Symbol.iterator]();
  let state = iterator.next();
  let index = 0;
  return as$1(whileLoop({
    while: () => !state.done,
    body: () => f(state.value, index++),
    step: (b) => {
      if (out) out.push(b);
      state = iterator.next();
    }
  }), out);
});
const iterateEagerImpl = (options) => {
  const onItem = options.onItem;
  const step = options.step;
  return (state, items, opts) => {
    let index = opts?.start ?? 0;
    const end = opts?.end ?? items.length;
    const concurrency = opts?.concurrency ?? 1;
    let done2 = false;
    let parentFiber;
    let fibers;
    let resume;
    let interrupted = false;
    let terminal;
    let effect2;
    const go = () => {
      let paused = false;
      for (; !terminal && index < end; index++) {
        const item = items[index];
        const eff = effect2 ?? onItem(state, item, index);
        if (effectIsExit(eff)) {
          terminal = step(state, item, eff, index);
          if (terminal) break;
        } else if (concurrency === 1) {
          return flatMap$2(exit$1(eff), (exit2) => {
            terminal = step(state, item, exit2, index);
            index++;
            return terminal ?? go() ?? void_$2;
          });
        } else if (!parentFiber) {
          return callback((cb) => {
            parentFiber = getCurrentFiber();
            effect2 = eff;
            resume = cb;
            const result2 = go();
            if (result2) return cb(result2);
            return suspend$3(() => {
              terminal = exitVoid;
              interrupted = true;
              return fibers ? fiberInterruptAll(fibers) : void_$2;
            });
          });
        } else {
          effect2 = void 0;
          const fiber = forkUnsafe$1(parentFiber, eff, true, true, "inherit");
          if (fiber._exit) {
            terminal = step(state, item, fiber._exit, index);
            if (terminal) break;
            continue;
          }
          if (fibers) fibers.add(fiber);
          else fibers = /* @__PURE__ */ new Set([fiber]);
          const currentIndex = index;
          fiber.addObserver((exit2) => {
            fibers.delete(fiber);
            if (terminal) {
              if (!interrupted && exit2._tag === "Failure") {
                for (const reason of exit2.cause.reasons) {
                  if (reason._tag === "Interrupt") continue;
                  else if (terminal._tag === "Failure") {
                    terminal.cause.reasons.push(reason);
                  } else {
                    terminal = exitFailCause(causeFromReasons([reason]));
                  }
                }
              }
            } else {
              const result2 = step(state, item, exit2, currentIndex);
              if (result2) {
                terminal = result2._tag === "Failure" ? exitFailCause(causeFromReasons(result2.cause.reasons.slice())) : result2;
                go();
              }
            }
            if (paused) {
              const eff2 = go();
              if (eff2) resume(eff2);
            } else if (done2 && fibers.size === 0) {
              resume(terminal ?? void_$2);
            }
          });
          if (fibers.size < concurrency) continue;
          paused = true;
          index++;
          return;
        }
      }
      done2 = true;
      if (terminal) {
        if (fibers && fibers.size > 0) {
          const annotations = fiberStackAnnotations(parentFiber);
          fibers.forEach((f) => f.interruptUnsafe(parentFiber.id, annotations));
          return;
        }
        if (resume || terminal._tag === "Failure") {
          return terminal;
        }
      } else if (resume) {
        if (!fibers) {
          return exitVoid;
        } else if (fibers.size === 0) {
          resume(void_$2);
        }
      }
    };
    return go();
  };
};
const iterateEager = () => iterateEagerImpl;
const forEachConcurrent = /* @__PURE__ */ iterateEagerImpl({
  onItem(state, item, index) {
    return state.f(item, index);
  },
  step(state, _, exit2, index) {
    if (exit2._tag === "Failure") return exit2;
    else if (state.out) {
      state.out[index] = exit2.value;
    }
  }
});
const forkUnsafe$1 = (parent, effect2, immediate = false, daemon = false, uninterruptible2 = false) => {
  const interruptible2 = uninterruptible2 === "inherit" ? parent.interruptible : !uninterruptible2;
  const child = new FiberImpl(parent.context, interruptible2);
  if (immediate) {
    child.evaluate(effect2);
  } else {
    parent.currentDispatcher.scheduleTask(() => child.evaluate(effect2), 0);
  }
  if (!daemon && !child._exit) {
    parent.children().add(child);
    child.addObserver(() => parent._children.delete(child));
  }
  return child;
};
const forkIn$1 = /* @__PURE__ */ dual((args2) => isEffect$1(args2[0]), (self, scope, options) => withFiber$1((parent) => {
  const fiber = forkUnsafe$1(parent, self, options?.startImmediately, true, options?.uninterruptible);
  if (!fiber._exit) {
    if (scope.state._tag !== "Closed") {
      const key = {};
      const finalizer = () => withFiberId((interruptor) => interruptor === fiber.id ? void_$2 : fiberInterrupt(fiber));
      scopeAddFinalizerUnsafe(scope, key, finalizer);
      fiber.addObserver(() => scopeRemoveFinalizerUnsafe(scope, key));
    } else {
      fiber.interruptUnsafe(parent.id, fiberStackAnnotations(parent));
    }
  }
  return succeed$4(fiber);
}));
const runForkWith$1 = (context2) => (effect2, options) => {
  const fiber = new FiberImpl(options?.scheduler ? add(context2, Scheduler, options.scheduler) : context2, options?.uninterruptible !== true);
  fiber.evaluate(effect2);
  if (fiber._exit) return fiber;
  if (options?.signal) {
    if (options.signal.aborted) {
      fiber.interruptUnsafe();
    } else {
      const abort = () => fiber.interruptUnsafe();
      options.signal.addEventListener("abort", abort, {
        once: true
      });
      fiber.addObserver(() => options.signal.removeEventListener("abort", abort));
    }
  }
  if (options?.onFiberStart) {
    options.onFiberStart(fiber);
  }
  return fiber;
};
const fiberRunIn = /* @__PURE__ */ dual(2, (self, scope) => {
  if (self._exit) {
    return self;
  } else if (scope.state._tag === "Closed") {
    self.interruptUnsafe(self.id);
    return self;
  }
  const key = {};
  scopeAddFinalizerUnsafe(scope, key, () => fiberInterrupt(self));
  self.addObserver(() => scopeRemoveFinalizerUnsafe(scope, key));
  return self;
});
const runFork$1 = /* @__PURE__ */ runForkWith$1(/* @__PURE__ */ empty$5());
const runCallbackWith$1 = (context2) => {
  const runFork2 = runForkWith$1(context2);
  return (effect2, options) => {
    const fiber = runFork2(effect2, options);
    if (options?.onExit) {
      fiber.addObserver(options.onExit);
    }
    return (interruptor) => {
      return fiber.interruptUnsafe(interruptor);
    };
  };
};
const runCallback$1 = /* @__PURE__ */ runCallbackWith$1(/* @__PURE__ */ empty$5());
const runPromiseExitWith$1 = (context2) => {
  const runFork2 = runForkWith$1(context2);
  return (effect2, options) => {
    const fiber = runFork2(effect2, options);
    return new Promise((resolve2) => {
      fiber.addObserver((exit2) => resolve2(exit2));
    });
  };
};
const runPromiseExit$1 = /* @__PURE__ */ runPromiseExitWith$1(/* @__PURE__ */ empty$5());
const runPromiseWith$1 = (context2) => {
  const runPromiseExit2 = runPromiseExitWith$1(context2);
  return (effect2, options) => runPromiseExit2(effect2, options).then((exit2) => {
    if (exit2._tag === "Failure") {
      throw causeSquash(exit2.cause);
    }
    return exit2.value;
  });
};
const runPromise$1 = /* @__PURE__ */ runPromiseWith$1(/* @__PURE__ */ empty$5());
const runSyncExitWith$1 = (context2) => {
  const runFork2 = runForkWith$1(context2);
  return (effect2) => {
    if (effectIsExit(effect2)) return effect2;
    const scheduler = new MixedScheduler("sync");
    const fiber = runFork2(effect2, {
      scheduler
    });
    fiber.currentDispatcher?.flush();
    return fiber._exit ?? exitDie(new AsyncFiberError(fiber));
  };
};
const runSyncExit$1 = /* @__PURE__ */ runSyncExitWith$1(/* @__PURE__ */ empty$5());
const runSyncWith$1 = (context2) => {
  const runSyncExit2 = runSyncExitWith$1(context2);
  return (effect2) => {
    const exit2 = runSyncExit2(effect2);
    if (exit2._tag === "Failure") throw causeSquash(exit2.cause);
    return exit2.value;
  };
};
const runSync$1 = /* @__PURE__ */ runSyncWith$1(/* @__PURE__ */ empty$5());
const succeedTrue = /* @__PURE__ */ succeed$4(true);
const succeedFalse = /* @__PURE__ */ succeed$4(false);
class Latch {
  waiters = [];
  scheduled = false;
  isOpen;
  constructor(isOpen) {
    this.isOpen = isOpen;
  }
  scheduleUnsafe(fiber) {
    if (this.scheduled || this.waiters.length === 0) {
      return succeedTrue;
    }
    this.scheduled = true;
    fiber.currentDispatcher.scheduleTask(this.flushWaiters, 0);
    return succeedTrue;
  }
  flushWaiters = () => {
    this.scheduled = false;
    const waiters = this.waiters;
    this.waiters = [];
    for (let i = 0; i < waiters.length; i++) {
      waiters[i](exitVoid);
    }
  };
  open = /* @__PURE__ */ withFiber$1((fiber) => {
    if (this.isOpen) return succeedFalse;
    this.isOpen = true;
    return this.scheduleUnsafe(fiber);
  });
  release = /* @__PURE__ */ withFiber$1((fiber) => this.isOpen ? succeedFalse : this.scheduleUnsafe(fiber));
  openUnsafe() {
    if (this.isOpen) return false;
    this.isOpen = true;
    this.flushWaiters();
    return true;
  }
  await = /* @__PURE__ */ callback((resume) => {
    if (this.isOpen) {
      return resume(void_$2);
    }
    this.waiters.push(resume);
    return sync$1(() => {
      const index = this.waiters.indexOf(resume);
      if (index !== -1) {
        this.waiters.splice(index, 1);
      }
    });
  });
  closeUnsafe() {
    if (!this.isOpen) return false;
    this.isOpen = false;
    return true;
  }
  close = /* @__PURE__ */ sync$1(() => this.closeUnsafe());
  whenOpen = (self) => flatMap$2(this.await, () => self);
}
const makeLatchUnsafe = (open) => new Latch(open ?? false);
const withTracerEnabled$1 = /* @__PURE__ */ provideService$1(TracerEnabled);
const bigint0 = /* @__PURE__ */ BigInt(0);
const NoopSpanProto = {
  _tag: "Span",
  spanId: "noop",
  traceId: "noop",
  sampled: false,
  status: {
    _tag: "Ended",
    startTime: bigint0,
    endTime: bigint0,
    exit: exitVoid
  },
  attributes: /* @__PURE__ */ new Map(),
  links: [],
  kind: "internal",
  attribute() {
  },
  event() {
  },
  end() {
  },
  addLinks() {
  }
};
const noopSpan = (options) => Object.assign(Object.create(NoopSpanProto), options);
const filterDisablePropagation = (span) => {
  if (!span) return none();
  return get(span.annotations, DisablePropagation) ? span._tag === "Span" ? filterDisablePropagation(getOrUndefined(span.parent)) : none() : some(span);
};
const makeSpanUnsafe = (fiber, name, options) => {
  const disablePropagation = !fiber.getRef(TracerEnabled) || options?.annotations && get(options.annotations, DisablePropagation);
  const parent = options?.parent !== void 0 ? some(options.parent) : options?.root ? none() : filterDisablePropagation(fiber.currentSpan);
  let span;
  if (disablePropagation) {
    span = noopSpan({
      name,
      parent,
      annotations: add(options?.annotations ?? empty$5(), DisablePropagation, true)
    });
  } else {
    const tracer = fiber.getRef(Tracer);
    const clock = fiber.getRef(ClockRef);
    const timingEnabled = fiber.getRef(TracerTimingEnabled);
    const annotationsFromEnv = fiber.getRef(TracerSpanAnnotations);
    const linksFromEnv = fiber.getRef(TracerSpanLinks);
    const level = options?.level ?? fiber.getRef(CurrentTraceLevel);
    const links = options?.links !== void 0 ? [...linksFromEnv, ...options.links] : linksFromEnv.slice();
    span = tracer.span({
      name,
      parent,
      annotations: options?.annotations ?? empty$5(),
      links,
      startTime: timingEnabled ? clock.currentTimeNanosUnsafe() : BigInt(0),
      kind: options?.kind ?? "internal",
      root: options?.root ?? isNone(parent),
      sampled: options?.sampled ?? (isSome(parent) && parent.value.sampled === false ? false : !isLogLevelGreaterThan(fiber.getRef(MinimumTraceLevel), level))
    });
    for (const [key, value] of Object.entries(annotationsFromEnv)) {
      span.attribute(key, value);
    }
    if (options?.attributes !== void 0) {
      for (const [key, value] of Object.entries(options.attributes)) {
        span.attribute(key, value);
      }
    }
  }
  return span;
};
const provideSpanStackFrame = (name, stack) => {
  stack = typeof stack === "function" ? stack : constUndefined;
  return updateService(CurrentStackFrame, (parent) => ({
    name,
    stack,
    parent
  }));
};
const useSpan$1 = (name, ...args2) => {
  const options = args2.length === 1 ? void 0 : args2[0];
  const evaluate2 = args2[args2.length - 1];
  return withFiber$1((fiber) => {
    const span = makeSpanUnsafe(fiber, name, options);
    const clock = fiber.getRef(ClockRef);
    return onExit$2(internalCall(() => evaluate2(span)), (exit2) => sync$1(() => {
      if (span.status._tag === "Ended") return;
      span.end(clock.currentTimeNanosUnsafe(), exit2);
    }));
  });
};
const provideParentSpan = /* @__PURE__ */ provideService$1(ParentSpan);
const withParentSpan$1 = function() {
  const dataFirst = isEffect$1(arguments[0]);
  const span = dataFirst ? arguments[1] : arguments[0];
  let options = dataFirst ? arguments[2] : arguments[1];
  let provideStackFrame = identity;
  if (span._tag === "Span") {
    options = addSpanStackTrace(options);
    provideStackFrame = provideSpanStackFrame(span.name, options?.captureStackTrace);
  }
  if (dataFirst) {
    return provideParentSpan(provideStackFrame(arguments[0]), span);
  }
  return (self) => provideParentSpan(provideStackFrame(self), span);
};
const withSpan$1 = function() {
  const dataFirst = typeof arguments[0] !== "string";
  const name = dataFirst ? arguments[1] : arguments[0];
  const traceOptions = addSpanStackTrace(arguments[2]);
  if (dataFirst) {
    const self = arguments[0];
    return useSpan$1(name, arguments[2], (span) => withParentSpan$1(self, span, traceOptions));
  }
  const fnArg = typeof arguments[1] === "function" ? arguments[1] : void 0;
  const options = fnArg ? void 0 : arguments[1];
  return (self, ...args2) => useSpan$1(name, fnArg ? fnArg(...args2) : options, (span) => withParentSpan$1(self, span, traceOptions));
};
const ClockRef = /* @__PURE__ */ Reference("effect/Clock", {
  defaultValue: () => new ClockImpl()
});
const MAX_TIMER_MILLIS = 2 ** 31 - 1;
class ClockImpl {
  currentTimeMillisUnsafe() {
    return Date.now();
  }
  currentTimeMillis = /* @__PURE__ */ sync$1(() => this.currentTimeMillisUnsafe());
  currentTimeNanosUnsafe() {
    return processOrPerformanceNow();
  }
  currentTimeNanos = /* @__PURE__ */ sync$1(() => this.currentTimeNanosUnsafe());
  sleep(duration) {
    const millis2 = toMillis(duration);
    if (millis2 <= 0) return yieldNow;
    return callback((resume) => {
      if (millis2 > MAX_TIMER_MILLIS) return;
      const handle = setTimeout(() => resume(void_$2), millis2);
      return sync$1(() => clearTimeout(handle));
    });
  }
}
const performanceNowNanos = /* @__PURE__ */ (function() {
  const bigint1e62 = /* @__PURE__ */ BigInt(1e6);
  if (typeof performance === "undefined" || typeof performance.now === "undefined") {
    return () => BigInt(Date.now()) * bigint1e62;
  } else if (typeof performance.timeOrigin === "number" && performance.timeOrigin === 0) {
    return () => BigInt(Math.round(performance.now() * 1e6));
  }
  const origin = /* @__PURE__ */ BigInt(/* @__PURE__ */ Date.now()) * bigint1e62 - /* @__PURE__ */ BigInt(/* @__PURE__ */ Math.round(/* @__PURE__ */ performance.now() * 1e6));
  return () => origin + BigInt(Math.round(performance.now() * 1e6));
})();
const processOrPerformanceNow = /* @__PURE__ */ (function() {
  const processHrtime = typeof process === "object" && "hrtime" in process && typeof process.hrtime.bigint === "function" ? process.hrtime : void 0;
  if (!processHrtime) {
    return performanceNowNanos;
  }
  const origin = /* @__PURE__ */ performanceNowNanos() - /* @__PURE__ */ processHrtime.bigint();
  return () => origin + processHrtime.bigint();
})();
const clockWith = (f) => withFiber$1((fiber) => f(fiber.getRef(ClockRef)));
const sleep$1 = (duration) => clockWith((clock) => clock.sleep(fromInputUnsafe(duration)));
const TimeoutErrorTypeId = "~effect/Cause/TimeoutError";
const isTimeoutError$1 = (u) => hasProperty(u, TimeoutErrorTypeId);
const AsyncFiberErrorTypeId = "~effect/Cause/AsyncFiberError";
class AsyncFiberError extends (/* @__PURE__ */ TaggedError$1("AsyncFiberError")) {
  [AsyncFiberErrorTypeId] = AsyncFiberErrorTypeId;
  constructor(fiber) {
    super({
      message: "An asynchronous Effect was executed with Effect.runSync",
      fiber
    });
  }
}
const UnknownErrorTypeId = "~effect/Cause/UnknownError";
class UnknownError extends (/* @__PURE__ */ TaggedError$1("UnknownError")) {
  [UnknownErrorTypeId] = UnknownErrorTypeId;
  constructor(cause, message) {
    super({
      message,
      cause
    });
  }
}
const ConsoleRef = /* @__PURE__ */ Reference("effect/Console/CurrentConsole", {
  defaultValue: () => globalThis.console
});
const logLevelToOrder = (level) => {
  switch (level) {
    case "All":
      return Number.MIN_SAFE_INTEGER;
    case "Fatal":
      return 5e4;
    case "Error":
      return 4e4;
    case "Warn":
      return 3e4;
    case "Info":
      return 2e4;
    case "Debug":
      return 1e4;
    case "Trace":
      return 0;
    case "None":
      return Number.MAX_SAFE_INTEGER;
  }
};
const LogLevelOrder = /* @__PURE__ */ mapInput(Number$5, logLevelToOrder);
const isLogLevelGreaterThan = /* @__PURE__ */ isGreaterThan(LogLevelOrder);
const CurrentLoggers$1 = /* @__PURE__ */ Reference("effect/Loggers/CurrentLoggers", {
  defaultValue: () => /* @__PURE__ */ new Set([defaultLogger, tracerLogger])
});
const LogToStderr = /* @__PURE__ */ Reference("effect/Logger/LogToStderr", {
  defaultValue: constFalse
});
const LoggerTypeId = "~effect/Logger";
const LoggerProto = {
  [LoggerTypeId]: {
    _Message: identity,
    _Output: identity
  },
  pipe() {
    return pipeArguments(this, arguments);
  }
};
const loggerMake = (log) => {
  const self = Object.create(LoggerProto);
  self.log = log;
  return self;
};
const formatLabel = (key) => key.replace(/[\s="]/g, "_");
const formatLogSpan = (self, now) => {
  const label = formatLabel(self[0]);
  return `${label}=${now - self[1]}ms`;
};
const logWithLevel = (level) => (...message) => {
  let cause = void 0;
  for (let i = 0, len = message.length; i < len; i++) {
    const msg = message[i];
    if (isCause(msg)) {
      if (cause) {
        message.splice(i, 1);
      } else {
        message = message.slice(0, i).concat(message.slice(i + 1));
      }
      cause = cause ? causeFromReasons(cause.reasons.concat(msg.reasons)) : msg;
      i--;
    }
  }
  if (cause === void 0) {
    cause = causeEmpty;
  }
  return withFiber$1((fiber) => {
    const logLevel = level ?? fiber.currentLogLevel;
    if (isLogLevelGreaterThan(fiber.minimumLogLevel, logLevel)) {
      return void_$2;
    }
    const clock = fiber.getRef(ClockRef);
    const loggers = fiber.getRef(CurrentLoggers$1);
    if (loggers.size > 0) {
      const date = new Date(clock.currentTimeMillisUnsafe());
      for (const logger of loggers) {
        logger.log({
          cause,
          fiber,
          date,
          logLevel,
          message
        });
      }
    }
    return void_$2;
  });
};
const defaultDateFormat = (date) => `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}:${date.getSeconds().toString().padStart(2, "0")}.${date.getMilliseconds().toString().padStart(3, "0")}`;
const hasProcessStdout = typeof process === "object" && process !== null && typeof process.stdout === "object" && process.stdout !== null;
hasProcessStdout && process.stdout.isTTY === true;
const defaultLogger = /* @__PURE__ */ loggerMake(({
  cause,
  date,
  fiber,
  logLevel,
  message
}) => {
  const message_ = Array.isArray(message) ? message.slice() : [message];
  if (cause.reasons.length > 0) {
    message_.push(causePretty(cause));
  }
  const now = date.getTime();
  const spans = fiber.getRef(CurrentLogSpans$1);
  let spanString = "";
  for (const span of spans) {
    spanString += ` ${formatLogSpan(span, now)}`;
  }
  const annotations = fiber.getRef(CurrentLogAnnotations$1);
  if (Object.keys(annotations).length > 0) {
    message_.push(annotations);
  }
  const console = fiber.getRef(ConsoleRef);
  const log = fiber.getRef(LogToStderr) ? console.error : console.log;
  log(`[${defaultDateFormat(date)}] ${logLevel.toUpperCase()} (#${fiber.id})${spanString}:`, ...message_);
});
const tracerLogger = /* @__PURE__ */ loggerMake(({
  cause,
  fiber,
  logLevel,
  message
}) => {
  const clock = fiber.getRef(ClockRef);
  const annotations = fiber.getRef(CurrentLogAnnotations$1);
  const span = fiber.currentSpan;
  if (span === void 0 || span._tag === "ExternalSpan") return;
  const attributes = {};
  for (const [key, value] of Object.entries(annotations)) {
    attributes[key] = value;
  }
  attributes["effect.fiberId"] = fiber.id;
  attributes["effect.logLevel"] = logLevel.toUpperCase();
  if (cause.reasons.length > 0) {
    attributes["effect.cause"] = causePretty(cause);
  }
  span.event(toStringUnknown(Array.isArray(message) && message.length === 1 ? message[0] : message), clock.currentTimeNanosUnsafe(), attributes);
});
const hasInterruptsOnly = hasInterruptsOnly$1;
const squash = causeSquash;
const findError = findError$1;
const hasInterrupts = hasInterrupts$1;
const prettyErrors = causePrettyErrors;
const pretty = causePretty;
const isDone = isDone$1;
const done$1 = done$2;
const isTimeoutError = isTimeoutError$1;
const succeed$3 = exitSucceed;
const failCause$1 = exitFailCause;
const fail$4 = exitFail;
const void_$1 = exitVoid;
const isSuccess = exitIsSuccess;
const getSuccess = exitGetSuccess;
const TypeId$m = "~effect/Deferred";
const DeferredProto = {
  [TypeId$m]: {
    _A: identity,
    _E: identity
  },
  pipe() {
    return pipeArguments(this, arguments);
  }
};
const makeUnsafe$3 = () => {
  const self = Object.create(DeferredProto);
  self.resumes = void 0;
  self.effect = void 0;
  return self;
};
const _await = (self) => callback((resume) => {
  if (self.effect) return resume(self.effect);
  self.resumes ??= [];
  self.resumes.push(resume);
  return sync$1(() => {
    const index = self.resumes.indexOf(resume);
    self.resumes.splice(index, 1);
  });
});
const completeWith = /* @__PURE__ */ dual(2, (self, effect2) => sync$1(() => doneUnsafe(self, effect2)));
const done = completeWith;
const doneUnsafe = (self, effect2) => {
  if (self.effect) return false;
  self.effect = effect2;
  if (self.resumes) {
    for (let i = 0; i < self.resumes.length; i++) {
      self.resumes[i](effect2);
    }
    self.resumes = void 0;
  }
  return true;
};
const CurrentLogAnnotations = CurrentLogAnnotations$1;
const CurrentLogSpans = CurrentLogSpans$1;
const Scope = scopeTag;
const makeUnsafe$2 = scopeMakeUnsafe;
const provide$2 = provideScope;
const addFinalizerExit = scopeAddFinalizerExit;
const addFinalizer = scopeAddFinalizer;
const forkUnsafe = scopeForkUnsafe;
const close = scopeClose;
const TypeId$l = "~effect/Layer";
const MemoMapTypeId = "~effect/Layer/MemoMap";
const LayerProto = {
  [TypeId$l]: {
    _ROut: identity,
    _E: identity,
    _RIn: identity
  },
  pipe() {
    return pipeArguments(this, arguments);
  }
};
const fromBuildUnsafe = (build) => {
  const self = Object.create(LayerProto);
  self.build = build;
  return self;
};
const fromBuild = (build) => fromBuildUnsafe((memoMap, scope) => {
  const layerScope = forkUnsafe(scope);
  return onExit$2(build(memoMap, layerScope), (exit2) => exit2._tag === "Failure" ? close(layerScope, exit2) : void_$2);
});
const fromBuildMemo = (build) => {
  const self = fromBuild((memoMap, scope) => memoMap.getOrElseMemoize(self, scope, build));
  return self;
};
class MemoMapImpl {
  get [MemoMapTypeId]() {
    return MemoMapTypeId;
  }
  map = /* @__PURE__ */ new Map();
  getOrElseMemoize(layer2, scope, build) {
    if (this.map.has(layer2)) {
      const entry2 = this.map.get(layer2);
      entry2.observers++;
      return andThen$1(scopeAddFinalizerExit(scope, (exit2) => entry2.finalizer(exit2)), entry2.effect);
    }
    const layerScope = makeUnsafe$2();
    const deferred = makeUnsafe$3();
    const entry = {
      observers: 1,
      effect: _await(deferred),
      finalizer: (exit2) => suspend$3(() => {
        entry.observers--;
        if (entry.observers === 0) {
          this.map.delete(layer2);
          return close(layerScope, exit2);
        }
        return void_$2;
      })
    };
    this.map.set(layer2, entry);
    return scopeAddFinalizerExit(scope, entry.finalizer).pipe(flatMap$2(() => build(this, layerScope)), onExit$2((exit2) => {
      entry.effect = exit2;
      return done(deferred, exit2);
    }));
  }
}
const makeMemoMapUnsafe = () => new MemoMapImpl();
class CurrentMemoMap extends (/* @__PURE__ */ Service()("effect/Layer/CurrentMemoMap")) {
  static getOrCreate = /* @__PURE__ */ getOrElse(this, makeMemoMapUnsafe);
}
const buildWithMemoMap = /* @__PURE__ */ dual(3, (self, memoMap, scope) => provideService$1(map$2(self.build(memoMap, scope), add(CurrentMemoMap, memoMap)), CurrentMemoMap, memoMap));
const succeed$2 = function() {
  if (arguments.length === 1) {
    return (resource2) => succeedContext(make$j(arguments[0], resource2));
  }
  return succeedContext(make$j(arguments[0], arguments[1]));
};
const succeedContext = (context2) => fromBuildUnsafe(constant(succeed$4(context2)));
const empty$4 = /* @__PURE__ */ succeedContext(/* @__PURE__ */ empty$5());
const effect = function() {
  if (arguments.length === 1) {
    return (effect2) => effectImpl(arguments[0], effect2);
  }
  return effectImpl(arguments[0], arguments[1]);
};
const effectImpl = (service, effect2) => effectContext(map$2(effect2, (value) => make$j(service, value)));
const effectContext = (effect2) => fromBuildMemo((_, scope) => provide$2(effect2, scope));
const unwrap = (self) => {
  const service = Service("effect/Layer/unwrap");
  return flatMap$1(effect(service)(self), get(service));
};
const mergeAllEffect = (layers, memoMap, scope) => {
  const parentScope = forkUnsafe(scope, "parallel");
  return forEach(layers, (layer2) => layer2.build(memoMap, forkUnsafe(parentScope, "sequential")), {
    concurrency: layers.length
  }).pipe(map$2((context2) => mergeAll$1(...context2)));
};
const mergeAll = (...layers) => fromBuild((memoMap, scope) => mergeAllEffect(layers, memoMap, scope));
const merge$1 = /* @__PURE__ */ dual(2, (self, that) => mergeAll(self, ...Array.isArray(that) ? that : [that]));
const provideWith = (self, that, f) => fromBuild((memoMap, scope) => flatMap$2(Array.isArray(that) ? mergeAllEffect(that, memoMap, scope) : that.build(memoMap, scope), (context2) => self.build(memoMap, scope).pipe(provideContext$1(context2), map$2((merged) => f(merged, context2)))));
const provide$1 = /* @__PURE__ */ dual(2, (self, that) => provideWith(self, that, identity));
const flatMap$1 = /* @__PURE__ */ dual(2, (self, f) => fromBuild((memoMap, scope) => flatMap$2(self.build(memoMap, scope), (context2) => f(context2).build(memoMap, scope))));
const taggedEnum = () => new Proxy({}, {
  get(_target, tag2, _receiver) {
    if (tag2 === "$is") {
      return isTagged;
    } else if (tag2 === "$match") {
      return taggedMatch;
    }
    return (props) => ({
      ...props,
      _tag: tag2
    });
  }
});
function taggedMatch() {
  if (arguments.length === 1) {
    const cases2 = arguments[0];
    return function(value2) {
      return cases2[value2._tag](value2);
    };
  }
  const value = arguments[0];
  const cases = arguments[1];
  return cases[value._tag](value);
}
const TaggedError = TaggedError$1;
const Clock = ClockRef;
const Number$4 = globalThis.Number;
const parse = (s) => {
  if (s === "NaN") {
    return some(NaN);
  }
  if (s === "Infinity") {
    return some(Infinity);
  }
  if (s === "-Infinity") {
    return some(-Infinity);
  }
  if (s.trim() === "") {
    return none();
  }
  const n = Number$4(s);
  return Number$4.isNaN(n) ? none() : some(n);
};
const catchDone = /* @__PURE__ */ dual(2, (effect2, f) => catchCauseFilter(effect2, filterDoneLeftover, (l) => f(l)));
const filterDone = /* @__PURE__ */ composePassthrough(findError, (e) => isDone(e) ? succeed$5(e) : fail$6(e));
const filterDoneLeftover = /* @__PURE__ */ composePassthrough(findError, (e) => isDone(e) ? succeed$5(e.value) : fail$6(e));
const doneExitFromCause = (cause) => {
  const halt = filterDone(cause);
  return !isFailure(halt) ? succeed$3(halt.success.value) : failCause$1(halt.failure);
};
const matchEffect = /* @__PURE__ */ dual(2, (self, options) => matchCauseEffect$1(self, {
  onSuccess: options.onSuccess,
  onFailure: (cause) => {
    const halt = filterDone(cause);
    return !isFailure(halt) ? options.onDone(halt.success.value) : options.onFailure(halt.failure);
  }
}));
const TypeId$k = "~effect/Schedule";
const CurrentMetadata = /* @__PURE__ */ Reference("effect/Schedule/CurrentMetadata", {
  defaultValue: /* @__PURE__ */ constant({
    input: void 0,
    output: void 0,
    duration: zero,
    attempt: 0,
    start: 0,
    now: 0,
    elapsed: 0,
    elapsedSincePrevious: 0
  })
});
const ScheduleProto = {
  [TypeId$k]: {
    _Out: identity,
    _In: identity,
    _Env: identity
  },
  pipe() {
    return pipeArguments(this, arguments);
  }
};
const isSchedule = (u) => hasProperty(u, TypeId$k);
const fromStep = (step) => {
  const self = Object.create(ScheduleProto);
  self.step = step;
  return self;
};
const metadataFn = () => {
  let n = 0;
  let previous;
  let start;
  return (now, input) => {
    if (start === void 0) start = now;
    const elapsed = now - start;
    const elapsedSincePrevious = previous === void 0 ? 0 : now - previous;
    previous = now;
    return {
      input,
      attempt: ++n,
      start,
      now,
      elapsed,
      elapsedSincePrevious
    };
  };
};
const fromStepWithMetadata = (step) => fromStep(map$2(step, (f) => {
  const meta = metadataFn();
  return (now, input) => f(meta(now, input));
}));
const toStep = (schedule) => catchCause$1(schedule.step, (cause) => succeed$4(() => failCause$2(cause)));
const toStepWithMetadata = (schedule) => clockWith((clock) => map$2(toStep(schedule), (step) => {
  const metaFn = metadataFn();
  return (input) => suspend$3(() => {
    const now = clock.currentTimeMillisUnsafe();
    return flatMap$2(step(now, input), ([output, duration]) => {
      const meta = metaFn(now, input);
      meta.output = output;
      meta.duration = duration;
      return as$1(sleep$1(duration), meta);
    });
  });
}));
const addDelay = /* @__PURE__ */ dual(2, (self, f) => modifyDelay(self, (output, delay) => map$2(f(output), (d) => sum(fromInputUnsafe(d), fromInputUnsafe(delay)))));
const modifyDelay = /* @__PURE__ */ dual(2, (self, f) => fromStep(map$2(toStep(self), (step) => (now, input) => flatMap$2(step(now, input), ([output, delay]) => map$2(f(output, delay), (delay2) => [output, fromInputUnsafe(delay2)])))));
const passthrough$2 = (self) => fromStep(map$2(toStep(self), (step) => (now, input) => matchEffect(step(now, input), {
  onSuccess: (result2) => succeed$4([input, result2[1]]),
  onFailure: failCause$2,
  onDone: () => done$1(input)
})));
const spaced = (duration) => {
  const decoded = fromInputUnsafe(duration);
  return fromStepWithMetadata(succeed$4((meta) => succeed$4([meta.attempt - 1, decoded])));
};
const while_ = /* @__PURE__ */ dual(2, (self, predicate) => fromStep(map$2(toStep(self), (step) => {
  const meta = metadataFn();
  return (now, input) => flatMap$2(step(now, input), (result2) => {
    const [output, duration] = result2;
    const eff = predicate({
      ...meta(now, input),
      output,
      duration
    });
    return flatMap$2(isEffect$1(eff) ? eff : succeed$4(eff), (check) => check ? succeed$4(result2) : done$1(output));
  });
})));
const forever$1 = /* @__PURE__ */ spaced(zero);
const repeatOrElse = /* @__PURE__ */ dual(3, (self, schedule, orElse2) => flatMap$2(toStepWithMetadata(schedule), (step) => {
  let meta = CurrentMetadata.defaultValue();
  return catch_$1(forever$2(tap$1(flatMap$2(suspend$3(() => provideService$1(self, CurrentMetadata, meta)), step), (meta_) => sync$1(() => {
    meta = meta_;
  })), {
    disableYield: true
  }), (error) => isDone$1(error) ? succeed$4(error.value) : orElse2(error, meta.attempt === 0 ? none() : some(meta)));
}));
const retryOrElse = /* @__PURE__ */ dual(3, (self, policy2, orElse2) => flatMap$2(toStepWithMetadata(policy2), (step) => {
  let meta = CurrentMetadata.defaultValue();
  let lastError;
  const loop = catch_$1(suspend$3(() => provideService$1(self, CurrentMetadata, meta)), (error) => {
    lastError = error;
    return flatMap$2(step(error), (meta_) => {
      meta = meta_;
      return loop;
    });
  });
  return catchDone(loop, (out) => internalCall(() => orElse2(lastError, out)));
}));
const repeat$1 = /* @__PURE__ */ dual(2, (self, options) => {
  const schedule = typeof options === "function" ? options(identity) : isSchedule(options) ? options : buildFromOptions(options);
  return repeatOrElse(self, schedule, fail$5);
});
const retry$1 = /* @__PURE__ */ dual(2, (self, options) => {
  const schedule = typeof options === "function" ? options(identity) : isSchedule(options) ? options : buildFromOptions(options);
  return retryOrElse(self, schedule, fail$5);
});
const passthroughForever = /* @__PURE__ */ passthrough$2(forever$1);
const buildFromOptions = (options) => {
  let schedule = options.schedule ? passthrough$2(options.schedule) : passthroughForever;
  if (options.while) {
    schedule = while_(schedule, ({
      input
    }) => {
      const applied = options.while(input);
      return isEffect$1(applied) ? applied : succeed$4(applied);
    });
  }
  if (options.until) {
    schedule = while_(schedule, ({
      input
    }) => {
      const applied = options.until(input);
      return isEffect$1(applied) ? map$2(applied, (b) => !b) : succeed$4(!applied);
    });
  }
  if (options.times !== void 0) {
    schedule = while_(schedule, ({
      attempt
    }) => succeed$4(attempt <= options.times));
  }
  return schedule;
};
const isEffect = isEffect$1;
const all$1 = all$2;
const promise = promise$1;
const tryPromise = tryPromise$1;
const succeed$1 = succeed$4;
const succeedNone = succeedNone$1;
const succeedSome = succeedSome$1;
const suspend$2 = suspend$3;
const sync = sync$1;
const void_ = void_$2;
const gen = gen$1;
const fail$3 = fail$5;
const failCause = failCause$2;
const die = die$1;
const try_ = try_$1;
const withFiber = withFiber$1;
const flatMap = flatMap$2;
const flatten = flatten$1;
const andThen = andThen$1;
const tap = tap$1;
const result = result$1;
const exit = exit$1;
const map$1 = map$2;
const as = as$1;
const asVoid = asVoid$1;
const catch_ = catch_$1;
const catchCause = catchCause$1;
const mapError = mapError$1;
const orDie = orDie$1;
const retry = retry$1;
const ignore = ignore$1;
const timeoutOption = timeoutOption$1;
const sleep = sleep$1;
const matchCauseEffect = matchCauseEffect$1;
const context = context$1;
const contextWith = contextWith$1;
const provideContext = provideContext$1;
const updateContext = updateContext$1;
const provideService = provideService$1;
const onError = onError$1;
const onExit$1 = onExit$2;
const cached = cached$1;
const interruptible = interruptible$1;
const onInterrupt = onInterrupt$1;
const uninterruptibleMask = uninterruptibleMask$1;
const forever = forever$2;
const repeat = repeat$1;
const withTracerEnabled = withTracerEnabled$1;
const useSpan = useSpan$1;
const withSpan = withSpan$1;
const withParentSpan = withParentSpan$1;
const forkIn = forkIn$1;
const runFork = runFork$1;
const runForkWith = runForkWith$1;
const runCallbackWith = runCallbackWith$1;
const runCallback = runCallback$1;
const runPromise = runPromise$1;
const runPromiseWith = runPromiseWith$1;
const runPromiseExit = runPromiseExit$1;
const runPromiseExitWith = runPromiseExitWith$1;
const runSync = runSync$1;
const runSyncWith = runSyncWith$1;
const runSyncExit = runSyncExit$1;
const runSyncExitWith = runSyncExitWith$1;
const fnUntraced = fnUntraced$1;
const fn = fn$1;
const logDebug = /* @__PURE__ */ logWithLevel("Debug");
const annotateLogs = /* @__PURE__ */ dual((args2) => isEffect(args2[0]), (effect2, ...args2) => updateService(effect2, CurrentLogAnnotations, (annotations) => {
  const newAnnotations = {
    ...annotations
  };
  if (args2.length === 1) {
    Object.assign(newAnnotations, args2[0]);
  } else {
    newAnnotations[args2[0]] = args2[1];
  }
  return newAnnotations;
}));
const mapEager = mapEager$1;
const mapErrorEager = mapErrorEager$1;
const flatMapEager = flatMapEager$1;
const catchEager = catchEager$1;
const fnUntracedEager = fnUntracedEager$1;
function set$1(self, key, value) {
  if (key === "__proto__") {
    Object.defineProperty(self, key, {
      value,
      writable: true,
      enumerable: true,
      configurable: true
    });
  } else {
    self[key] = value;
  }
  return self;
}
function resolve(ast) {
  return ast.checks ? ast.checks[ast.checks.length - 1].annotations : ast.annotations;
}
function resolveAt(key) {
  return (ast) => resolve(ast)?.[key];
}
const resolveIdentifier = /* @__PURE__ */ resolveAt("identifier");
const getExpected = /* @__PURE__ */ memoize((ast) => {
  const identifier2 = resolveIdentifier(ast);
  if (typeof identifier2 === "string") return identifier2;
  return ast.getExpected(getExpected);
});
const escape = (string2) => string2.replace(/[/\\^$*+?.()|[\]{}]/g, "\\$&");
const redactedRegistry = /* @__PURE__ */ new WeakMap();
const TypeId$j = "~effect/data/Redacted";
const isRedacted = (u) => hasProperty(u, TypeId$j);
const make$g = (value, options) => {
  const self = Object.create(Proto$8);
  redactedRegistry.set(self, value);
  return self;
};
const Proto$8 = {
  [TypeId$j]: {
    _A: (_) => _
  },
  label: void 0,
  ...PipeInspectableProto,
  toJSON() {
    return this.toString();
  },
  toString() {
    return `<redacted${isString(this.label) ? ":" + this.label : ""}>`;
  },
  [symbol$1]() {
    return hash(redactedRegistry.get(this));
  },
  [symbol](that) {
    return isRedacted(that) && equals$1(redactedRegistry.get(this), redactedRegistry.get(that));
  }
};
const TypeId$i = "~effect/SchemaIssue/Issue";
function isIssue(u) {
  return hasProperty(u, TypeId$i);
}
let Base$1 = class Base {
  [TypeId$i] = TypeId$i;
  toString() {
    return defaultFormatter(this);
  }
};
let Filter$1 = class Filter extends Base$1 {
  _tag = "Filter";
  /**
   * The input value that caused the issue.
   */
  actual;
  /**
   * The filter that failed.
   */
  filter;
  /**
   * The issue that occurred.
   */
  issue;
  constructor(actual, filter2, issue) {
    super();
    this.actual = actual;
    this.filter = filter2;
    this.issue = issue;
  }
};
class Encoding extends Base$1 {
  _tag = "Encoding";
  /**
   * The schema that caused the issue.
   */
  ast;
  /**
   * The input value that caused the issue.
   */
  actual;
  /**
   * The issue that occurred.
   */
  issue;
  constructor(ast, actual, issue) {
    super();
    this.ast = ast;
    this.actual = actual;
    this.issue = issue;
  }
}
class Pointer extends Base$1 {
  _tag = "Pointer";
  /**
   * The path to the location in the input that caused the issue.
   */
  path;
  /**
   * The issue that occurred.
   */
  issue;
  constructor(path, issue) {
    super();
    this.path = path;
    this.issue = issue;
  }
}
class MissingKey extends Base$1 {
  _tag = "MissingKey";
  /**
   * The metadata for the issue.
   */
  annotations;
  constructor(annotations) {
    super();
    this.annotations = annotations;
  }
}
class UnexpectedKey extends Base$1 {
  _tag = "UnexpectedKey";
  /**
   * The schema that caused the issue.
   */
  ast;
  /**
   * The input value that caused the issue.
   */
  actual;
  constructor(ast, actual) {
    super();
    this.ast = ast;
    this.actual = actual;
  }
}
class Composite extends Base$1 {
  _tag = "Composite";
  /**
   * The schema that caused the issue.
   */
  ast;
  /**
   * The input value that caused the issue.
   */
  actual;
  /**
   * The issues that occurred.
   */
  issues;
  constructor(ast, actual, issues) {
    super();
    this.ast = ast;
    this.actual = actual;
    this.issues = issues;
  }
}
class InvalidType extends Base$1 {
  _tag = "InvalidType";
  /**
   * The schema that caused the issue.
   */
  ast;
  /**
   * The input value that caused the issue.
   */
  actual;
  constructor(ast, actual) {
    super();
    this.ast = ast;
    this.actual = actual;
  }
}
class InvalidValue extends Base$1 {
  _tag = "InvalidValue";
  /**
   * The value that caused the issue.
   */
  actual;
  /**
   * The metadata for the issue.
   */
  annotations;
  constructor(actual, annotations) {
    super();
    this.actual = actual;
    this.annotations = annotations;
  }
}
class AnyOf extends Base$1 {
  _tag = "AnyOf";
  /**
   * The schema that caused the issue.
   */
  ast;
  /**
   * The input value that caused the issue.
   */
  actual;
  /**
   * The issues that occurred.
   */
  issues;
  constructor(ast, actual, issues) {
    super();
    this.ast = ast;
    this.actual = actual;
    this.issues = issues;
  }
}
class OneOf extends Base$1 {
  _tag = "OneOf";
  /**
   * The schema that caused the issue.
   */
  ast;
  /**
   * The input value that caused the issue.
   */
  actual;
  /**
   * The schemas that were successful.
   */
  successes;
  constructor(ast, actual, successes) {
    super();
    this.ast = ast;
    this.actual = actual;
    this.successes = successes;
  }
}
function makeFilterIssue(input, entry) {
  if (isIssue(entry)) {
    return entry;
  }
  if (typeof entry === "string") {
    return new InvalidValue(some(input), {
      message: entry
    });
  }
  const inner = typeof entry.issue === "string" ? new InvalidValue(some(input), {
    message: entry.issue
  }) : entry.issue;
  return new Pointer(entry.path, inner);
}
function makeSingle(input, out) {
  if (out === void 0) {
    return void 0;
  }
  if (typeof out === "boolean") {
    return out ? void 0 : new InvalidValue(some(input));
  }
  return makeFilterIssue(input, out);
}
function make$f(input, ast, out) {
  if (Array.isArray(out)) {
    if (isReadonlyArrayNonEmpty(out)) {
      if (out.length === 1) {
        return makeFilterIssue(input, out[0]);
      }
      return new Composite(ast, some(input), map$3(out, (entry) => makeFilterIssue(input, entry)));
    }
    return void 0;
  }
  return makeSingle(input, out);
}
const defaultLeafHook = (issue) => {
  const message = findMessage(issue);
  if (message !== void 0) return message;
  switch (issue._tag) {
    case "InvalidType":
      return getExpectedMessage(getExpected(issue.ast), formatOption(issue.actual));
    case "InvalidValue":
      return `Invalid data ${formatOption(issue.actual)}`;
    case "MissingKey":
      return "Missing key";
    case "UnexpectedKey":
      return `Unexpected key with value ${format(issue.actual)}`;
    case "Forbidden":
      return "Forbidden operation";
    case "OneOf":
      return `Expected exactly one member to match the input ${format(issue.actual)}`;
  }
};
const defaultCheckHook = (issue) => {
  return findMessage(issue.issue) ?? findMessage(issue);
};
function getExpectedMessage(expected, actual) {
  return `Expected ${expected}, got ${actual}`;
}
function toDefaultIssues(issue, path, leafHook, checkHook) {
  switch (issue._tag) {
    case "Filter": {
      const message = checkHook(issue);
      if (message !== void 0) {
        return [{
          path,
          message
        }];
      }
      switch (issue.issue._tag) {
        case "InvalidValue":
          return [{
            path,
            message: getExpectedMessage(formatCheck(issue.filter), format(issue.actual))
          }];
        default:
          return toDefaultIssues(issue.issue, path, leafHook, checkHook);
      }
    }
    case "Encoding":
      return toDefaultIssues(issue.issue, path, leafHook, checkHook);
    case "Pointer":
      return toDefaultIssues(issue.issue, [...path, ...issue.path], leafHook, checkHook);
    case "Composite":
      return issue.issues.flatMap((issue2) => toDefaultIssues(issue2, path, leafHook, checkHook));
    case "AnyOf": {
      const message = findMessage(issue);
      if (issue.issues.length === 0) {
        if (message !== void 0) return [{
          path,
          message
        }];
        const expected = getExpectedMessage(getExpected(issue.ast), format(issue.actual));
        return [{
          path,
          message: expected
        }];
      }
      return issue.issues.flatMap((issue2) => toDefaultIssues(issue2, path, leafHook, checkHook));
    }
    default:
      return [{
        path,
        message: leafHook(issue)
      }];
  }
}
function formatCheck(check) {
  const expected = check.annotations?.expected;
  if (typeof expected === "string") return expected;
  switch (check._tag) {
    case "Filter":
      return "<filter>";
    case "FilterGroup":
      return check.checks.map((check2) => formatCheck(check2)).join(" & ");
  }
}
function makeFormatterDefault() {
  return (issue) => toDefaultIssues(issue, [], defaultLeafHook, defaultCheckHook).map(formatDefaultIssue).join("\n");
}
const defaultFormatter = /* @__PURE__ */ makeFormatterDefault();
function formatDefaultIssue(issue) {
  let out = issue.message;
  if (issue.path && issue.path.length > 0) {
    const path = formatPath(issue.path);
    out += `
  at ${path}`;
  }
  return out;
}
function findMessage(issue) {
  switch (issue._tag) {
    case "InvalidType":
    case "OneOf":
    case "Composite":
    case "AnyOf":
      return getMessageAnnotation(issue.ast.annotations);
    case "InvalidValue":
    case "Forbidden":
      return getMessageAnnotation(issue.annotations);
    case "MissingKey":
      return getMessageAnnotation(issue.annotations, "messageMissingKey");
    case "UnexpectedKey":
      return getMessageAnnotation(issue.ast.annotations, "messageUnexpectedKey");
    case "Filter":
      return getMessageAnnotation(issue.filter.annotations);
    case "Encoding":
      return findMessage(issue.issue);
  }
}
function getMessageAnnotation(annotations, type = "message") {
  const message = annotations?.[type];
  if (typeof message === "string") return message;
}
function formatOption(actual) {
  if (isNone(actual)) return "no value provided";
  return format(actual.value);
}
class Getter extends Class$1 {
  run;
  constructor(run2) {
    super();
    this.run = run2;
  }
  map(f) {
    return new Getter((oe, options) => this.run(oe, options).pipe(mapEager(map$5(f))));
  }
  compose(other) {
    if (isPassthrough(this)) {
      return other;
    }
    if (isPassthrough(other)) {
      return this;
    }
    return new Getter((oe, options) => this.run(oe, options).pipe(flatMapEager((ot) => other.run(ot, options))));
  }
}
const passthrough_$1 = /* @__PURE__ */ new Getter(succeed$1);
function isPassthrough(getter) {
  return getter.run === passthrough_$1.run;
}
function passthrough$1() {
  return passthrough_$1;
}
function transform$1(f) {
  return transformOptional(map$5(f));
}
function transformOptional(f) {
  return new Getter((oe) => succeed$1(f(oe)));
}
function withDefault$1(defaultValue) {
  return new Getter((o) => {
    const filtered = filter(o, isNotUndefined);
    return isSome(filtered) ? succeed$1(filtered) : map$1(defaultValue, some);
  });
}
function String$3() {
  return transform$1(globalThis.String);
}
function Number$3() {
  return transform$1(globalThis.Number);
}
function splitKeyValue$1(options) {
  const separator = ",";
  const keyValueSeparator = "=";
  return transform$1((input) => input.split(separator).reduce((acc, pair) => {
    const [key, value] = pair.split(keyValueSeparator);
    if (key && value) {
      acc[key] = value;
    }
    return acc;
  }, {}));
}
function joinKeyValue(options) {
  const separator = ",";
  const keyValueSeparator = "=";
  return transform$1((input) => Object.entries(input).map(([key, value]) => `${key}${keyValueSeparator}${value}`).join(separator));
}
function split(options) {
  const separator = ",";
  return transform$1((input) => input === "" ? [] : input.split(separator));
}
const TypeId$h = "~effect/SchemaTransformation/Transformation";
class Transformation {
  [TypeId$h] = TypeId$h;
  _tag = "Transformation";
  decode;
  encode;
  constructor(decode, encode) {
    this.decode = decode;
    this.encode = encode;
  }
  flip() {
    return new Transformation(this.encode, this.decode);
  }
  compose(other) {
    return new Transformation(this.decode.compose(other.decode), other.encode.compose(this.encode));
  }
}
function isTransformation(u) {
  return hasProperty(u, TypeId$h);
}
const make$e = (options) => {
  if (isTransformation(options)) {
    return options;
  }
  return new Transformation(options.decode, options.encode);
};
function transform(options) {
  return new Transformation(transform$1(options.decode), transform$1(options.encode));
}
function splitKeyValue(options) {
  return new Transformation(splitKeyValue$1(), joinKeyValue());
}
const passthrough_ = /* @__PURE__ */ new Transformation(/* @__PURE__ */ passthrough$1(), /* @__PURE__ */ passthrough$1());
function passthrough() {
  return passthrough_;
}
const numberFromString = /* @__PURE__ */ new Transformation(/* @__PURE__ */ Number$3(), /* @__PURE__ */ String$3());
const errorFromErrorJsonEncoded = (options) => transform({
  decode: (i) => {
    const err = new Error(i.message);
    if (typeof i.name === "string" && i.name !== "Error") err.name = i.name;
    if (typeof i.stack === "string") err.stack = i.stack;
    return err;
  },
  encode: (a) => {
    const e = {
      name: a.name,
      message: a.message
    };
    if (options?.includeStack && typeof a.stack === "string") {
      e.stack = a.stack;
    }
    return e;
  }
});
function makeGuard(tag2) {
  return (ast) => ast._tag === tag2;
}
const isDeclaration = /* @__PURE__ */ makeGuard("Declaration");
const isNever = /* @__PURE__ */ makeGuard("Never");
const isLiteral = /* @__PURE__ */ makeGuard("Literal");
const isUniqueSymbol = /* @__PURE__ */ makeGuard("UniqueSymbol");
const isArrays = /* @__PURE__ */ makeGuard("Arrays");
const isObjects = /* @__PURE__ */ makeGuard("Objects");
const isUnion = /* @__PURE__ */ makeGuard("Union");
class Link {
  to;
  transformation;
  constructor(to, transformation) {
    this.to = to;
    this.transformation = transformation;
  }
}
const defaultParseOptions = {};
class Context {
  isOptional;
  isMutable;
  /** Used for constructor default values (e.g. `withConstructorDefault` API) */
  defaultValue;
  annotations;
  constructor(isOptional2, isMutable, defaultValue = void 0, annotations = void 0) {
    this.isOptional = isOptional2;
    this.isMutable = isMutable;
    this.defaultValue = defaultValue;
    this.annotations = annotations;
  }
}
const TypeId$g = "~effect/Schema";
class Base2 {
  [TypeId$g] = TypeId$g;
  annotations;
  checks;
  encoding;
  context;
  constructor(annotations = void 0, checks = void 0, encoding = void 0, context2 = void 0) {
    this.annotations = annotations;
    this.checks = checks;
    this.encoding = encoding;
    this.context = context2;
  }
  toString() {
    return `<${this._tag}>`;
  }
}
class Declaration extends Base2 {
  _tag = "Declaration";
  typeParameters;
  run;
  constructor(typeParameters, run2, annotations, checks, encoding, context2) {
    super(annotations, checks, encoding, context2);
    this.typeParameters = typeParameters;
    this.run = run2;
  }
  /** @internal */
  getParser() {
    const run2 = this.run(this.typeParameters);
    return (oinput, options) => {
      if (isNone(oinput)) return succeedNone;
      return mapEager(run2(oinput.value, this, options), some);
    };
  }
  /** @internal */
  recur(recur2) {
    const tps = mapOrSame(this.typeParameters, recur2);
    return tps === this.typeParameters ? this : new Declaration(tps, this.run, this.annotations, this.checks, void 0, this.context);
  }
  /** @internal */
  getExpected() {
    const expected = this.annotations?.expected;
    if (typeof expected === "string") return expected;
    return "<Declaration>";
  }
}
let Null$1 = class Null extends Base2 {
  _tag = "Null";
  /** @internal */
  getParser() {
    return fromConst(this, null);
  }
  /** @internal */
  getExpected() {
    return "null";
  }
};
const null_ = /* @__PURE__ */ new Null$1();
let Undefined$1 = class Undefined extends Base2 {
  _tag = "Undefined";
  /** @internal */
  getParser() {
    return fromConst(this, void 0);
  }
  /** @internal */
  toCodecJson() {
    return replaceEncoding(this, [undefinedToNull]);
  }
  /** @internal */
  getExpected() {
    return "undefined";
  }
};
const undefinedToNull = /* @__PURE__ */ new Link(null_, /* @__PURE__ */ new Transformation(/* @__PURE__ */ transform$1(() => void 0), /* @__PURE__ */ transform$1(() => null)));
const undefined_ = /* @__PURE__ */ new Undefined$1();
let Any$1 = class Any extends Base2 {
  _tag = "Any";
  /** @internal */
  getParser() {
    return fromRefinement(this, isUnknown);
  }
  /** @internal */
  getExpected() {
    return "any";
  }
};
const any = /* @__PURE__ */ new Any$1();
let Unknown$1 = class Unknown extends Base2 {
  _tag = "Unknown";
  /** @internal */
  getParser() {
    return fromRefinement(this, isUnknown);
  }
  /** @internal */
  getExpected() {
    return "unknown";
  }
};
const unknown = /* @__PURE__ */ new Unknown$1();
let Literal$1 = class Literal extends Base2 {
  _tag = "Literal";
  literal;
  constructor(literal, annotations, checks, encoding, context2) {
    super(annotations, checks, encoding, context2);
    if (typeof literal === "number" && !globalThis.Number.isFinite(literal)) {
      throw new Error(`A numeric literal must be finite, got ${format(literal)}`);
    }
    this.literal = literal;
  }
  /** @internal */
  getParser() {
    return fromConst(this, this.literal);
  }
  /** @internal */
  toCodecJson() {
    return typeof this.literal === "bigint" ? literalToString(this) : this;
  }
  /** @internal */
  toCodecStringTree() {
    return typeof this.literal === "string" ? this : literalToString(this);
  }
  /** @internal */
  getExpected() {
    return typeof this.literal === "string" ? JSON.stringify(this.literal) : globalThis.String(this.literal);
  }
};
function literalToString(ast) {
  const literalAsString = globalThis.String(ast.literal);
  return replaceEncoding(ast, [new Link(new Literal$1(literalAsString), new Transformation(transform$1(() => ast.literal), transform$1(() => literalAsString)))]);
}
let String$2 = class String2 extends Base2 {
  _tag = "String";
  /** @internal */
  getParser() {
    return fromRefinement(this, isString);
  }
  /** @internal */
  getExpected() {
    return "string";
  }
};
const string$1 = /* @__PURE__ */ new String$2();
let Number$2 = class Number2 extends Base2 {
  _tag = "Number";
  /** @internal */
  getParser() {
    return fromRefinement(this, isNumber);
  }
  /** @internal */
  toCodecJson() {
    if (this.checks && (hasCheck(this.checks, "isFinite") || hasCheck(this.checks, "isInt"))) {
      return this;
    }
    return replaceEncoding(this, [numberToJson]);
  }
  /** @internal */
  toCodecStringTree() {
    if (this.checks && (hasCheck(this.checks, "isFinite") || hasCheck(this.checks, "isInt"))) {
      return replaceEncoding(this, [finiteToString]);
    }
    return replaceEncoding(this, [numberToString]);
  }
  /** @internal */
  getExpected() {
    return "number";
  }
};
function hasCheck(checks, tag2) {
  return checks.some((c) => {
    switch (c._tag) {
      case "Filter":
        return c.annotations?.meta?._tag === tag2;
      case "FilterGroup":
        return hasCheck(c.checks, tag2);
    }
  });
}
const number = /* @__PURE__ */ new Number$2();
let Boolean$1 = class Boolean extends Base2 {
  _tag = "Boolean";
  /** @internal */
  getParser() {
    return fromRefinement(this, isBoolean);
  }
  /** @internal */
  getExpected() {
    return "boolean";
  }
};
const boolean = /* @__PURE__ */ new Boolean$1();
class Arrays extends Base2 {
  _tag = "Arrays";
  isMutable;
  elements;
  rest;
  constructor(isMutable, elements, rest, annotations, checks, encoding, context2) {
    super(annotations, checks, encoding, context2);
    this.isMutable = isMutable;
    this.elements = elements;
    this.rest = rest;
    const i = elements.findIndex(isOptional);
    if (i !== -1 && (elements.slice(i + 1).some((e) => !isOptional(e)) || rest.length > 1)) {
      throw new Error("A required element cannot follow an optional element. ts(1257)");
    }
    if (rest.length > 1 && rest.slice(1).some(isOptional)) {
      throw new Error("An optional element cannot follow a rest element. ts(1266)");
    }
  }
  /** @internal */
  getParser(recur2) {
    const ast = this;
    const elements = ast.elements.map((ast2) => ({
      ast: ast2,
      parser: recur2(ast2)
    }));
    const rest = ast.rest.map((ast2) => ({
      ast: ast2,
      parser: recur2(ast2)
    }));
    const elementLen = elements.length;
    const [head, ...tail] = rest;
    const tailLen = tail.length;
    function getParser(tailThreshold, index) {
      if (index < elementLen) {
        return elements[index];
      } else if (index >= tailThreshold) {
        return tail[index - tailThreshold];
      }
      return head;
    }
    return fnUntracedEager(function* (oinput, options) {
      if (oinput._tag === "None") {
        return oinput;
      }
      const input = oinput.value;
      if (!Array.isArray(input)) {
        return yield* fail$3(new InvalidType(ast, oinput));
      }
      const len = input.length;
      const state = {
        ast,
        getParser,
        oinput,
        len,
        tailThreshold: resolveTailThreshold(len, elementLen, tailLen),
        output: new globalThis.Array(len),
        issues: void 0,
        options
      };
      const concurrency = resolveConcurrency(options?.concurrency);
      const eff = parseArray(state, input, {
        concurrency: concurrency?.concurrency,
        end: ast.rest.length === 0 ? elementLen : Math.max(len, elementLen + tailLen)
      });
      if (eff) yield* eff;
      if (ast.rest.length === 0 && len > elementLen) {
        for (let i = elementLen; i <= len - 1; i++) {
          const issue = new Pointer([i], new UnexpectedKey(ast, input[i]));
          if (options.errors === "all") {
            if (state.issues) state.issues.push(issue);
            else state.issues = [issue];
          } else {
            return yield* fail$3(new Composite(ast, oinput, [issue]));
          }
        }
      }
      if (state.issues) {
        return yield* fail$3(new Composite(ast, oinput, state.issues));
      }
      return some(state.output);
    });
  }
  /** @internal */
  recur(recur2) {
    const elements = mapOrSame(this.elements, recur2);
    const rest = mapOrSame(this.rest, recur2);
    return elements === this.elements && rest === this.rest ? this : new Arrays(this.isMutable, elements, rest, this.annotations, this.checks, void 0, this.context);
  }
  /** @internal */
  getExpected() {
    return "array";
  }
}
const parseArray = /* @__PURE__ */ iterateEager()({
  onItem(s, item, i) {
    const value = i < s.len ? some(item) : none();
    return s.getParser(s.tailThreshold, i).parser(value, s.options);
  },
  step(s, _, exit2, i) {
    if (exit2._tag === "Failure") {
      return wrapPropertyKeyIssue(s, s.ast, i, exit2);
    } else if (exit2.value._tag === "Some") {
      s.output[i] = exit2.value.value;
    } else {
      const p = s.getParser(s.tailThreshold, i);
      if (isOptional(p.ast)) return;
      const issue = new Pointer([i], new MissingKey(p.ast.context?.annotations));
      if (s.options.errors === "all") {
        if (s.issues) s.issues.push(issue);
        else s.issues = [issue];
      } else {
        return fail$4(new Composite(s.ast, s.oinput, [issue]));
      }
    }
  }
});
function resolveTailThreshold(inputLen, elementLen, tailLen) {
  return Math.max(elementLen, inputLen - tailLen);
}
const resolveConcurrency = (value) => {
  value = value === "unbounded" ? Infinity : value ?? 1;
  return value > 1 ? {
    concurrency: value
  } : void 0;
};
const wrapPropertyKeyIssue = (s, ast, key, exit2) => {
  const issueResult = findError(exit2.cause);
  if (isFailure(issueResult)) {
    return exit2;
  }
  const issue = new Pointer([key], issueResult.success);
  if (s.options.errors === "all") {
    if (s.issues) s.issues.push(issue);
    else s.issues = [issue];
  } else {
    return fail$4(new Composite(ast, s.oinput, [issue]));
  }
};
const FINITE_PATTERN = "[+-]?\\d*\\.?\\d+(?:[Ee][+-]?\\d+)?";
const isNumberStringRegExp = /* @__PURE__ */ new globalThis.RegExp(`(?:${FINITE_PATTERN}|Infinity|-Infinity|NaN)`);
function getIndexSignatureKeys(input, parameter) {
  const encoded = toEncoded(parameter);
  switch (encoded._tag) {
    case "String":
      return Object.keys(input);
    case "TemplateLiteral": {
      const regExp = getTemplateLiteralRegExp(encoded);
      return Object.keys(input).filter((k) => regExp.test(k));
    }
    case "Symbol":
      return Object.getOwnPropertySymbols(input);
    case "Number":
      return Object.keys(input).filter((k) => isNumberStringRegExp.test(k));
    case "Union":
      return [...new Set(encoded.types.flatMap((t) => getIndexSignatureKeys(input, t)))];
    default:
      return [];
  }
}
class PropertySignature {
  name;
  type;
  constructor(name, type) {
    this.name = name;
    this.type = type;
  }
}
class IndexSignature {
  parameter;
  type;
  merge;
  constructor(parameter, type, merge2) {
    this.parameter = parameter;
    this.type = type;
    this.merge = merge2;
    if (isOptional(type) && !containsUndefined(type)) {
      throw new Error("Cannot use `Schema.optionalKey` with index signatures, use `Schema.optional` instead.");
    }
  }
}
class Objects extends Base2 {
  _tag = "Objects";
  propertySignatures;
  indexSignatures;
  constructor(propertySignatures, indexSignatures, annotations, checks, encoding, context2) {
    super(annotations, checks, encoding, context2);
    this.propertySignatures = propertySignatures;
    this.indexSignatures = indexSignatures;
    const duplicates = propertySignatures.map((ps) => ps.name).filter((name, i, arr) => arr.indexOf(name) !== i);
    if (duplicates.length > 0) {
      throw new Error(`Duplicate identifiers: ${JSON.stringify(duplicates)}. ts(2300)`);
    }
  }
  /** @internal */
  getParser(recur2) {
    const ast = this;
    const expectedKeys = [];
    const expectedKeysSet = /* @__PURE__ */ new Set();
    const properties = [];
    for (const ps of ast.propertySignatures) {
      expectedKeys.push(ps.name);
      expectedKeysSet.add(ps.name);
      properties.push({
        ps,
        parser: recur2(ps.type),
        name: ps.name,
        type: ps.type
      });
    }
    const indexCount = ast.indexSignatures.length;
    if (ast.propertySignatures.length === 0 && ast.indexSignatures.length === 0) {
      return fromRefinement(ast, isNotNullish);
    }
    const parseIndexes = indexCount > 0 ? iterateEager()({
      onItem: fnUntracedEager(function* (s, [key, is2]) {
        const parserKey = recur2(indexSignatureParameterFromString(is2.parameter));
        const effKey = parserKey(some(key), s.options);
        const exitKey = effectIsExit(effKey) ? effKey : yield* exit(effKey);
        if (exitKey._tag === "Failure") {
          const eff = wrapPropertyKeyIssue(s, ast, key, exitKey);
          if (eff) yield* eff;
          return;
        }
        const value = some(s.input[key]);
        const parserValue = recur2(is2.type);
        const effValue = parserValue(value, s.options);
        const exitValue = effectIsExit(effValue) ? effValue : yield* exit(effValue);
        if (exitValue._tag === "Failure") {
          const eff = wrapPropertyKeyIssue(s, ast, key, exitValue);
          if (eff) yield* eff;
          return;
        } else if (exitKey.value._tag === "Some" && exitValue.value._tag === "Some") {
          const k2 = exitKey.value.value;
          const v2 = exitValue.value.value;
          if (is2.merge && is2.merge.decode && Object.hasOwn(s.out, k2)) {
            const [k, v] = is2.merge.decode.combine([k2, s.out[k2]], [k2, v2]);
            set$1(s.out, k, v);
          } else {
            set$1(s.out, k2, v2);
          }
        }
      }),
      step: (_s, _, exit2) => exit2._tag === "Failure" ? exit2 : void 0
    }) : void 0;
    return fnUntracedEager(function* (oinput, options) {
      if (oinput._tag === "None") {
        return oinput;
      }
      const input = oinput.value;
      if (!(typeof input === "object" && input !== null && !Array.isArray(input))) {
        return yield* fail$3(new InvalidType(ast, oinput));
      }
      const out = {};
      const state = {
        ast,
        oinput,
        input,
        out,
        issues: void 0,
        options
      };
      const errorsAllOption = options.errors === "all";
      const onExcessPropertyError = options.onExcessProperty === "error";
      const onExcessPropertyPreserve = options.onExcessProperty === "preserve";
      let inputKeys;
      if (ast.indexSignatures.length === 0 && (onExcessPropertyError || onExcessPropertyPreserve)) {
        inputKeys = Reflect.ownKeys(input);
        for (let i = 0; i < inputKeys.length; i++) {
          const key = inputKeys[i];
          if (!expectedKeysSet.has(key)) {
            if (onExcessPropertyError) {
              const issue = new Pointer([key], new UnexpectedKey(ast, input[key]));
              if (errorsAllOption) {
                if (state.issues) {
                  state.issues.push(issue);
                } else {
                  state.issues = [issue];
                }
                continue;
              } else {
                return yield* fail$3(new Composite(ast, oinput, [issue]));
              }
            } else {
              set$1(out, key, input[key]);
            }
          }
        }
      }
      const concurrency = resolveConcurrency(options?.concurrency);
      const eff = parseProperties(state, properties, concurrency);
      if (eff) yield* eff;
      if (parseIndexes) {
        const keyPairs = empty$6();
        for (let i = 0; i < indexCount; i++) {
          const is2 = ast.indexSignatures[i];
          const keys2 = getIndexSignatureKeys(input, is2.parameter);
          for (let j = 0; j < keys2.length; j++) {
            const key = keys2[j];
            keyPairs.push([key, is2]);
          }
        }
        const eff2 = parseIndexes(state, keyPairs, concurrency);
        if (eff2) yield* eff2;
      }
      if (state.issues) {
        return yield* fail$3(new Composite(ast, oinput, state.issues));
      }
      if (options.propertyOrder === "original") {
        const keys2 = (inputKeys ?? Reflect.ownKeys(input)).concat(expectedKeys);
        const preserved = {};
        for (const key of keys2) {
          if (Object.hasOwn(out, key)) {
            set$1(preserved, key, out[key]);
          }
        }
        return some(preserved);
      }
      return some(out);
    });
  }
  rebuild(recur2, flipMerge) {
    const props = mapOrSame(this.propertySignatures, (ps) => {
      const t = recur2(ps.type);
      return t === ps.type ? ps : new PropertySignature(ps.name, t);
    });
    const indexes = mapOrSame(this.indexSignatures, (is2) => {
      const p = recur2(is2.parameter);
      const t = recur2(is2.type);
      const merge2 = flipMerge ? is2.merge?.flip() : is2.merge;
      return p === is2.parameter && t === is2.type && merge2 === is2.merge ? is2 : new IndexSignature(p, t, merge2);
    });
    return props === this.propertySignatures && indexes === this.indexSignatures ? this : new Objects(props, indexes, this.annotations, this.checks, void 0, this.context);
  }
  /** @internal */
  flip(recur2) {
    return this.rebuild(recur2, true);
  }
  /** @internal */
  recur(recur2) {
    return this.rebuild(recur2, false);
  }
  /** @internal */
  getExpected() {
    if (this.propertySignatures.length === 0 && this.indexSignatures.length === 0) return "object | array";
    return "object";
  }
}
const parseProperties = /* @__PURE__ */ iterateEager()({
  onItem(s, p) {
    const value = Object.hasOwn(s.input, p.name) ? some(s.input[p.name]) : none();
    return p.parser(value, s.options);
  },
  step(s, p, exit2) {
    if (exit2._tag === "Failure") {
      return wrapPropertyKeyIssue(s, s.ast, p.name, exit2);
    } else if (exit2.value._tag === "Some") {
      set$1(s.out, p.name, exit2.value.value);
    } else if (!isOptional(p.type)) {
      const issue = new Pointer([p.name], new MissingKey(p.type.context?.annotations));
      if (s.options.errors === "all") {
        if (s.issues) s.issues.push(issue);
        else s.issues = [issue];
        return;
      } else {
        return fail$4(new Composite(s.ast, s.oinput, [issue]));
      }
    }
  }
});
function struct(fields, checks, annotations) {
  return new Objects(Reflect.ownKeys(fields).map((key) => {
    return new PropertySignature(key, fields[key].ast);
  }), [], annotations, checks);
}
function getAST(self) {
  return self.ast;
}
function union(members, mode, checks) {
  return new Union$1(members.map(getAST), mode, void 0, checks);
}
function getCandidateTypes(ast) {
  switch (ast._tag) {
    case "Null":
      return ["null"];
    case "Undefined":
    case "Void":
      return ["undefined"];
    case "String":
    case "TemplateLiteral":
      return ["string"];
    case "Number":
      return ["number"];
    case "Boolean":
      return ["boolean"];
    case "Symbol":
    case "UniqueSymbol":
      return ["symbol"];
    case "BigInt":
      return ["bigint"];
    case "Arrays":
      return ["array"];
    case "ObjectKeyword":
      return ["object", "array", "function"];
    case "Objects":
      return ast.propertySignatures.length || ast.indexSignatures.length ? ["object"] : ["object", "array"];
    case "Enum":
      return Array.from(new Set(ast.enums.map(([, v]) => typeof v)));
    case "Literal":
      return [typeof ast.literal];
    case "Union":
      return Array.from(new Set(ast.types.flatMap(getCandidateTypes)));
    default:
      return ["null", "undefined", "string", "number", "boolean", "symbol", "bigint", "object", "array", "function"];
  }
}
function collectSentinels(ast) {
  switch (ast._tag) {
    default:
      return [];
    case "Declaration": {
      const s = ast.annotations?.["~sentinels"];
      return Array.isArray(s) ? s : [];
    }
    case "Objects":
      return ast.propertySignatures.flatMap((ps) => {
        const type = ps.type;
        if (!isOptional(type)) {
          if (isLiteral(type)) {
            return [{
              key: ps.name,
              literal: type.literal
            }];
          }
          if (isUniqueSymbol(type)) {
            return [{
              key: ps.name,
              literal: type.symbol
            }];
          }
        }
        return [];
      });
    case "Arrays":
      return ast.elements.flatMap((e, i) => {
        return isLiteral(e) && !isOptional(e) ? [{
          key: i,
          literal: e.literal
        }] : [];
      });
    case "Suspend":
      return collectSentinels(ast.thunk());
  }
}
const candidateIndexCache = /* @__PURE__ */ new WeakMap();
function getIndex(types) {
  let idx = candidateIndexCache.get(types);
  if (idx) return idx;
  idx = {};
  for (const a of types) {
    const encoded = toEncoded(a);
    if (isNever(encoded)) continue;
    const types2 = getCandidateTypes(encoded);
    const sentinels = collectSentinels(encoded);
    idx.byType ??= {};
    for (const t of types2) (idx.byType[t] ??= []).push(a);
    if (sentinels.length > 0) {
      idx.bySentinel ??= /* @__PURE__ */ new Map();
      for (const {
        key,
        literal
      } of sentinels) {
        let m = idx.bySentinel.get(key);
        if (!m) idx.bySentinel.set(key, m = /* @__PURE__ */ new Map());
        let arr = m.get(literal);
        if (!arr) m.set(literal, arr = []);
        arr.push(a);
      }
    } else {
      idx.otherwise ??= {};
      for (const t of types2) (idx.otherwise[t] ??= []).push(a);
    }
  }
  candidateIndexCache.set(types, idx);
  return idx;
}
function filterLiterals(input) {
  return (ast) => {
    const encoded = toEncoded(ast);
    return encoded._tag === "Literal" ? encoded.literal === input : encoded._tag === "UniqueSymbol" ? encoded.symbol === input : true;
  };
}
function getCandidates(input, types) {
  const idx = getIndex(types);
  const runtimeType = input === null ? "null" : Array.isArray(input) ? "array" : typeof input;
  if (idx.bySentinel) {
    const base = idx.otherwise?.[runtimeType] ?? [];
    if (runtimeType === "object" || runtimeType === "array") {
      for (const [k, m] of idx.bySentinel) {
        if (Object.hasOwn(input, k)) {
          const match2 = m.get(input[k]);
          if (match2) return [...match2, ...base].filter(filterLiterals(input));
        }
      }
    }
    return base;
  }
  return (idx.byType?.[runtimeType] ?? []).filter(filterLiterals(input));
}
let Union$1 = class Union extends Base2 {
  _tag = "Union";
  types;
  mode;
  constructor(types, mode, annotations, checks, encoding, context2) {
    super(annotations, checks, encoding, context2);
    this.types = types;
    this.mode = mode;
  }
  /** @internal */
  getParser(recur2) {
    const ast = this;
    return (oinput, options) => {
      if (oinput._tag === "None") {
        return succeed$1(oinput);
      }
      const input = oinput.value;
      const candidates = getCandidates(input, ast.types);
      const state = {
        ast,
        recur: recur2,
        oinput,
        input,
        out: void 0,
        successes: [],
        issues: void 0,
        options
      };
      const concurrency = resolveConcurrency(options?.concurrency);
      const eff = parseUnion(state, candidates, concurrency);
      if (!eff) {
        return state.out ? succeed$1(state.out) : fail$3(new AnyOf(ast, input, state.issues ?? []));
      }
      return flatMap(eff, (_) => {
        return state.out ? succeed$1(state.out) : fail$3(new AnyOf(ast, input, state.issues ?? []));
      });
    };
  }
  /** @internal */
  recur(recur2) {
    const types = mapOrSame(this.types, recur2);
    return types === this.types ? this : new Union(types, this.mode, this.annotations, this.checks, void 0, this.context);
  }
  /** @internal */
  getExpected(getExpected2) {
    const expected = this.annotations?.expected;
    if (typeof expected === "string") return expected;
    if (this.types.length === 0) return "never";
    const types = this.types.map((type) => {
      const encoded = toEncoded(type);
      switch (encoded._tag) {
        case "Arrays": {
          const literals = encoded.elements.filter(isLiteral);
          if (literals.length > 0) {
            return `${formatIsMutable(encoded.isMutable)}[ ${literals.map((e) => getExpected2(e) + formatIsOptional(e.context?.isOptional)).join(", ")}, ... ]`;
          }
          break;
        }
        case "Objects": {
          const literals = encoded.propertySignatures.filter((ps) => isLiteral(ps.type));
          if (literals.length > 0) {
            return `{ ${literals.map((ps) => `${formatIsMutable(ps.type.context?.isMutable)}${formatPropertyKey(ps.name)}${formatIsOptional(ps.type.context?.isOptional)}: ${getExpected2(ps.type)}`).join(", ")}, ... }`;
          }
          break;
        }
      }
      return getExpected2(encoded);
    });
    return Array.from(new Set(types)).join(" | ");
  }
};
const parseUnion = /* @__PURE__ */ iterateEager()({
  onItem(s, ast) {
    const parser = s.recur(ast);
    return parser(s.oinput, s.options);
  },
  step(s, candidate, exit2) {
    if (exit2._tag === "Failure") {
      const issueResult = findError(exit2.cause);
      if (isFailure(issueResult)) {
        return exit2;
      }
      if (s.issues) s.issues.push(issueResult.success);
      else s.issues = [issueResult.success];
    } else {
      if (s.out && s.ast.mode === "oneOf") {
        s.successes.push(candidate);
        return fail$4(new OneOf(s.ast, s.input, s.successes));
      }
      s.out = exit2.value;
      s.successes.push(candidate);
      if (s.ast.mode === "anyOf") {
        return void_$1;
      }
    }
  }
});
const nonFiniteLiterals = /* @__PURE__ */ new Union$1([/* @__PURE__ */ new Literal$1("Infinity"), /* @__PURE__ */ new Literal$1("-Infinity"), /* @__PURE__ */ new Literal$1("NaN")], "anyOf");
const numberToJson = /* @__PURE__ */ new Link(/* @__PURE__ */ new Union$1([number, nonFiniteLiterals], "anyOf"), /* @__PURE__ */ new Transformation(/* @__PURE__ */ Number$3(), /* @__PURE__ */ transform$1((n) => globalThis.Number.isFinite(n) ? n : globalThis.String(n))));
function formatIsMutable(isMutable) {
  return isMutable ? "" : "readonly ";
}
function formatIsOptional(isOptional2) {
  return isOptional2 ? "?" : "";
}
class Filter2 extends Class$1 {
  _tag = "Filter";
  run;
  annotations;
  /**
   * Whether the parsing process should be aborted after this check has failed.
   */
  aborted;
  constructor(run2, annotations = void 0, aborted = false) {
    super();
    this.run = run2;
    this.annotations = annotations;
    this.aborted = aborted;
  }
  annotate(annotations) {
    return new Filter2(this.run, {
      ...this.annotations,
      ...annotations
    }, this.aborted);
  }
  abort() {
    return new Filter2(this.run, this.annotations, true);
  }
  and(other, annotations) {
    return new FilterGroup([this, other], annotations);
  }
}
class FilterGroup extends Class$1 {
  _tag = "FilterGroup";
  checks;
  annotations;
  constructor(checks, annotations = void 0) {
    super();
    this.checks = checks;
    this.annotations = annotations;
  }
  annotate(annotations) {
    return new FilterGroup(this.checks, {
      ...this.annotations,
      ...annotations
    });
  }
  and(other, annotations) {
    return new FilterGroup([this, other], annotations);
  }
}
function makeFilter$1(filter2, annotations, aborted = false) {
  return new Filter2((input, ast, options) => make$f(input, ast, filter2(input, ast, options)), annotations, aborted);
}
function isPattern(regExp, annotations) {
  const source = regExp.source;
  return makeFilter$1((s) => regExp.test(s), {
    expected: `a string matching the RegExp ${source}`,
    meta: {
      _tag: "isPattern",
      regExp
    },
    toArbitraryConstraint: {
      string: {
        patterns: [regExp.source]
      }
    },
    ...annotations
  });
}
function modifyOwnPropertyDescriptors(ast, f) {
  const d = Object.getOwnPropertyDescriptors(ast);
  f(d);
  return Object.create(Object.getPrototypeOf(ast), d);
}
function replaceEncoding(ast, encoding) {
  if (ast.encoding === encoding) {
    return ast;
  }
  return modifyOwnPropertyDescriptors(ast, (d) => {
    d.encoding.value = encoding;
  });
}
function replaceContext(ast, context2) {
  if (ast.context === context2) {
    return ast;
  }
  return modifyOwnPropertyDescriptors(ast, (d) => {
    d.context.value = context2;
  });
}
function annotate(ast, annotations) {
  if (ast.checks) {
    const last = ast.checks[ast.checks.length - 1];
    return replaceChecks(ast, append(ast.checks.slice(0, -1), last.annotate(annotations)));
  }
  return modifyOwnPropertyDescriptors(ast, (d) => {
    d.annotations.value = {
      ...d.annotations.value,
      ...annotations
    };
  });
}
function replaceChecks(ast, checks) {
  if (ast.checks === checks) {
    return ast;
  }
  return modifyOwnPropertyDescriptors(ast, (d) => {
    d.checks.value = checks;
  });
}
function appendChecks(ast, checks) {
  return replaceChecks(ast, ast.checks ? [...ast.checks, ...checks] : checks);
}
function updateLastLink(encoding, f) {
  const links = encoding;
  const last = links[links.length - 1];
  const to = f(last.to);
  if (to !== last.to) {
    return append(encoding.slice(0, encoding.length - 1), new Link(to, last.transformation));
  }
  return encoding;
}
function applyToLastLink(f) {
  return (ast) => ast.encoding ? replaceEncoding(ast, updateLastLink(ast.encoding, f)) : ast;
}
function appendTransformation(from, transformation, to) {
  const link2 = new Link(from, transformation);
  return replaceEncoding(to, to.encoding ? [...to.encoding, link2] : [link2]);
}
function mapOrSame(as2, f) {
  let changed = false;
  const out = new Array(as2.length);
  for (let i = 0; i < as2.length; i++) {
    const a = as2[i];
    const fa = f(a);
    if (fa !== a) {
      changed = true;
    }
    out[i] = fa;
  }
  return changed ? out : as2;
}
function annotateKey(ast, annotations) {
  const context2 = ast.context ? new Context(ast.context.isOptional, ast.context.isMutable, ast.context.defaultValue, {
    ...ast.context.annotations,
    ...annotations
  }) : new Context(false, false, void 0, annotations);
  return replaceContext(ast, context2);
}
const optionalKeyLastLink = /* @__PURE__ */ applyToLastLink(optionalKey$1);
function optionalKey$1(ast) {
  const context2 = ast.context ? ast.context.isOptional === false ? new Context(true, ast.context.isMutable, ast.context.defaultValue, ast.context.annotations) : ast.context : new Context(true, false);
  return optionalKeyLastLink(replaceContext(ast, context2));
}
function withConstructorDefault$1(ast, defaultValue) {
  const transformation = new Transformation(withDefault$1(defaultValue), passthrough$1());
  const encoding = [new Link(unknown, transformation)];
  const context2 = ast.context ? new Context(ast.context.isOptional, ast.context.isMutable, encoding, ast.context.annotations) : new Context(false, false, encoding);
  return replaceContext(ast, context2);
}
function decodeTo$1(from, to, transformation) {
  return appendTransformation(from, transformation, to);
}
function parseParameter(ast) {
  switch (ast._tag) {
    case "Literal":
      return {
        literals: isPropertyKey(ast.literal) ? [ast.literal] : [],
        parameters: []
      };
    case "UniqueSymbol":
      return {
        literals: [ast.symbol],
        parameters: []
      };
    case "String":
    case "Number":
    case "Symbol":
    case "TemplateLiteral":
      return {
        literals: [],
        parameters: [ast]
      };
    case "Union": {
      const out = {
        literals: [],
        parameters: []
      };
      for (let i = 0; i < ast.types.length; i++) {
        const parsed = parseParameter(ast.types[i]);
        out.literals = out.literals.concat(parsed.literals);
        out.parameters = out.parameters.concat(parsed.parameters);
      }
      return out;
    }
  }
  return {
    literals: [],
    parameters: []
  };
}
function record(key, value, keyValueCombiner) {
  const {
    literals,
    parameters: indexSignatures
  } = parseParameter(key);
  return new Objects(literals.map((literal) => new PropertySignature(literal, value)), indexSignatures.map((parameter) => new IndexSignature(parameter, value, keyValueCombiner)));
}
function isOptional(ast) {
  return ast.context?.isOptional ?? false;
}
const toType$1 = /* @__PURE__ */ memoize((ast) => {
  if (ast.encoding) {
    return toType$1(replaceEncoding(ast, void 0));
  }
  const out = ast;
  return out.recur?.(toType$1) ?? out;
});
const toEncoded = /* @__PURE__ */ memoize((ast) => {
  return toType$1(flip(ast));
});
function flipEncoding(ast, encoding) {
  const links = encoding;
  const len = links.length;
  const last = links[len - 1];
  const ls = [new Link(flip(replaceEncoding(ast, void 0)), links[0].transformation.flip())];
  for (let i = 1; i < len; i++) {
    ls.unshift(new Link(flip(links[i - 1].to), links[i].transformation.flip()));
  }
  const to = flip(last.to);
  if (to.encoding) {
    return replaceEncoding(to, [...to.encoding, ...ls]);
  } else {
    return replaceEncoding(to, ls);
  }
}
const flip = /* @__PURE__ */ memoize((ast) => {
  if (ast.encoding) {
    return flipEncoding(ast, ast.encoding);
  }
  const out = ast;
  return out.flip?.(flip) ?? out.recur?.(flip) ?? out;
});
function containsUndefined(ast) {
  switch (ast._tag) {
    case "Undefined":
      return true;
    case "Union":
      return ast.types.some(containsUndefined);
    default:
      return false;
  }
}
function getTemplateLiteralSource(ast, top) {
  return ast.encodedParts.map((part) => handleTemplateLiteralASTPartParens(part, getTemplateLiteralASTPartPattern(part), top)).join("");
}
const getTemplateLiteralRegExp = /* @__PURE__ */ memoize((ast) => {
  return new globalThis.RegExp(`^${getTemplateLiteralSource(ast, true)}$`);
});
function getTemplateLiteralASTPartPattern(part) {
  switch (part._tag) {
    case "Literal":
      return escape(globalThis.String(part.literal));
    case "String":
      return STRING_PATTERN;
    case "Number":
      return FINITE_PATTERN;
    case "BigInt":
      return BIGINT_PATTERN;
    case "TemplateLiteral":
      return getTemplateLiteralSource(part, false);
    case "Union":
      return part.types.map(getTemplateLiteralASTPartPattern).join("|");
  }
}
function handleTemplateLiteralASTPartParens(part, s, top) {
  if (isUnion(part)) {
    if (!top) {
      return `(?:${s})`;
    }
  } else if (!top) {
    return s;
  }
  return `(${s})`;
}
function fromConst(ast, value) {
  const succeed2 = succeedSome(value);
  return (oinput) => {
    if (oinput._tag === "None") {
      return succeedNone;
    }
    return oinput.value === value ? succeed2 : fail$3(new InvalidType(ast, oinput));
  };
}
function fromRefinement(ast, refinement) {
  return (oinput) => {
    if (oinput._tag === "None") {
      return succeedNone;
    }
    return refinement(oinput.value) ? succeed$1(oinput) : fail$3(new InvalidType(ast, oinput));
  };
}
function toCodec(f) {
  function out(ast) {
    return ast.encoding ? replaceEncoding(ast, updateLastLink(ast.encoding, out)) : f(ast);
  }
  return memoize(out);
}
const indexSignatureParameterFromString = /* @__PURE__ */ toCodec((ast) => {
  switch (ast._tag) {
    default:
      return ast;
    case "Number":
      return ast.toCodecStringTree();
    case "Union":
      return ast.recur(indexSignatureParameterFromString);
  }
});
const STRING_PATTERN = "[\\s\\S]*?";
const isStringFiniteRegExp = /* @__PURE__ */ new globalThis.RegExp(`^${FINITE_PATTERN}$`);
function isStringFinite(annotations) {
  return isPattern(isStringFiniteRegExp, {
    expected: "a string representing a finite number",
    meta: {
      _tag: "isStringFinite",
      regExp: isStringFiniteRegExp
    },
    ...annotations
  });
}
const finiteString = /* @__PURE__ */ appendChecks(string$1, [/* @__PURE__ */ isStringFinite()]);
const finiteToString = /* @__PURE__ */ new Link(finiteString, numberFromString);
const numberToString = /* @__PURE__ */ new Link(/* @__PURE__ */ new Union$1([finiteString, nonFiniteLiterals], "anyOf"), numberFromString);
const BIGINT_PATTERN = "-?\\d+";
function collectIssues(checks, value, issues, ast, options) {
  for (let i = 0; i < checks.length; i++) {
    const check = checks[i];
    if (check._tag === "FilterGroup") {
      collectIssues(check.checks, value, issues, ast, options);
    } else {
      const issue = check.run(value, ast, options);
      if (issue) {
        issues.push(new Filter$1(value, check, issue));
        if (check.aborted || options?.errors !== "all") {
          return;
        }
      }
    }
  }
}
const ClassTypeId = "~effect/Schema/Class";
const STRUCTURAL_ANNOTATION_KEY = "~structural";
function isStringTree(u) {
  const seen = /* @__PURE__ */ new Set();
  return recur2(u);
  function recur2(u2) {
    if (u2 === void 0 || typeof u2 === "string") {
      return true;
    }
    if (typeof u2 !== "object" || u2 === null) {
      return false;
    }
    if (seen.has(u2)) {
      return false;
    }
    seen.add(u2);
    if (Array.isArray(u2)) {
      return u2.every(recur2);
    }
    return Object.keys(u2).every((key) => recur2(u2[key]));
  }
}
const StringTree = /* @__PURE__ */ new Declaration([], () => (input, ast) => isStringTree(input) ? succeed$1(input) : fail$3(new InvalidType(ast, some(input))), {
  expected: "StringTree",
  toCodecStringTree: () => new Link(unknown, passthrough())
});
const unknownToStringTree = /* @__PURE__ */ new Link(StringTree, /* @__PURE__ */ passthrough());
const await_ = fiberAwait;
const interrupt = fiberInterrupt;
const runIn = fiberRunIn;
const makeUnsafe$1 = makeLatchUnsafe;
const TypeId$f = "~effect/Channel";
const ChannelProto = {
  [TypeId$f]: {
    _Env: identity,
    _InErr: identity,
    _InElem: identity,
    _OutErr: identity,
    _OutElem: identity
  },
  pipe() {
    return pipeArguments(this, arguments);
  }
};
const fromTransform = (transform2) => {
  const self = Object.create(ChannelProto);
  self.transform = (upstream, scope) => catchCause(transform2(upstream, scope), (cause) => succeed$1(failCause(cause)));
  return self;
};
const fromPull = (effect2) => fromTransform((_, __) => effect2);
const fromTransformBracket = (f) => fromTransform(fnUntraced(function* (upstream, scope) {
  const closableScope = forkUnsafe(scope);
  const onCause = (cause) => close(closableScope, doneExitFromCause(cause));
  const pull = yield* onError(f(upstream, scope, closableScope), onCause);
  return onError(pull, onCause);
}));
const toTransform = (channel) => channel.transform;
const suspend$1 = (evaluate2) => fromTransform((upstream, scope) => suspend$2(() => toTransform(evaluate2())(upstream, scope)));
const fail$2 = (error) => fromPull(succeed$1(fail$3(error)));
const onExit = /* @__PURE__ */ dual(2, (self, finalizer) => fromTransformBracket((upstream, scope, forkedScope) => addFinalizerExit(forkedScope, finalizer).pipe(andThen(toTransform(self)(upstream, scope)))));
const ensuring$1 = /* @__PURE__ */ dual(2, (self, finalizer) => onExit(self, (_) => finalizer));
const runWith = (self, f, onHalt) => suspend$2(() => {
  const scope = makeUnsafe$2();
  const makePull = toTransform(self)(done$1(), scope);
  return catchDone(flatMap(makePull, f), succeed$1).pipe(onExit$1((exit2) => close(scope, exit2)));
});
const runForEach = /* @__PURE__ */ dual(2, (self, f) => runWith(self, (pull) => forever(flatMap(pull, f), {
  disableYield: true
})));
const lambda = (f) => f;
const recurDefaults = /* @__PURE__ */ memoize((ast) => {
  switch (ast._tag) {
    case "Declaration": {
      const getLink = ast.annotations?.[ClassTypeId];
      if (isFunction(getLink)) {
        const link2 = getLink(ast.typeParameters);
        const to = recurDefaults(link2.to);
        return replaceEncoding(ast, to === link2.to ? [link2] : [new Link(to, link2.transformation)]);
      }
      return ast;
    }
    case "Objects":
    case "Arrays":
      return ast.recur((ast2) => {
        const defaultValue = ast2.context?.defaultValue;
        if (defaultValue) {
          return replaceEncoding(recurDefaults(ast2), defaultValue);
        }
        return recurDefaults(ast2);
      });
    case "Suspend":
      return ast.recur(recurDefaults);
    default:
      return ast;
  }
});
function makeEffect(schema2) {
  const ast = recurDefaults(toType$1(schema2.ast));
  const parser = run(ast);
  return (input, options) => {
    return parser(input, options?.disableChecks ? options?.parseOptions ? {
      ...options.parseOptions,
      disableChecks: true
    } : {
      disableChecks: true
    } : options?.parseOptions);
  };
}
function makeOption(schema2) {
  const parser = makeEffect(schema2);
  return (input, options) => {
    return getSuccess(runSyncExit(parser(input, options)));
  };
}
function makeUnsafe(schema2) {
  const parser = makeEffect(schema2);
  return (input, options) => {
    return runSync(mapErrorEager(parser(input, options), (issue) => new Error(issue.toString(), {
      cause: issue
    })));
  };
}
function is$1(schema2) {
  return _is(schema2.ast);
}
function _is(ast) {
  const parser = asExit(run(toType$1(ast)));
  return (input) => {
    return isSuccess(parser(input, defaultParseOptions));
  };
}
function decodeUnknownEffect$1(schema2) {
  return run(schema2.ast);
}
function run(ast) {
  const parser = recur$1(ast);
  return (input, options) => flatMapEager(parser(some(input), options ?? defaultParseOptions), (oa) => {
    if (oa._tag === "None") {
      return fail$3(new InvalidValue(oa));
    }
    return succeed$1(oa.value);
  });
}
function asExit(parser) {
  return (input, options) => runSyncExit(parser(input, options));
}
const recur$1 = /* @__PURE__ */ memoize((ast) => {
  let parser;
  const astOptions = resolve(ast)?.["parseOptions"];
  if (!ast.context && !ast.encoding && !ast.checks) {
    return (ou, options) => {
      parser ??= ast.getParser(recur$1);
      if (astOptions) {
        options = {
          ...options,
          ...astOptions
        };
      }
      return parser(ou, options);
    };
  }
  const isStructural = isArrays(ast) || isObjects(ast) || isDeclaration(ast) && ast.typeParameters.length > 0;
  return (ou, options) => {
    if (astOptions) {
      options = {
        ...options,
        ...astOptions
      };
    }
    const encoding = ast.encoding;
    let srou;
    if (encoding) {
      const links = encoding;
      const len = links.length;
      for (let i = len - 1; i >= 0; i--) {
        const link2 = links[i];
        const to = link2.to;
        const parser2 = recur$1(to);
        srou = srou ? flatMapEager(srou, (ou2) => parser2(ou2, options)) : parser2(ou, options);
        if (link2.transformation._tag === "Transformation") {
          const getter = link2.transformation.decode;
          srou = flatMapEager(srou, (ou2) => getter.run(ou2, options));
        } else {
          srou = link2.transformation.decode(srou, options);
        }
      }
      srou = mapErrorEager(srou, (issue) => new Encoding(ast, ou, issue));
    }
    parser ??= ast.getParser(recur$1);
    let sroa = srou ? flatMapEager(srou, (ou2) => parser(ou2, options)) : parser(ou, options);
    if (ast.checks && !options?.disableChecks) {
      const checks = ast.checks;
      if (options?.errors === "all" && isStructural && isSome(ou)) {
        sroa = catchEager(sroa, (issue) => {
          const issues = [];
          collectIssues(checks.filter((check) => check.annotations?.[STRUCTURAL_ANNOTATION_KEY]), ou.value, issues, ast, options);
          const out = isArrayNonEmpty(issues) ? issue._tag === "Composite" && issue.ast === ast ? new Composite(ast, issue.actual, [...issue.issues, ...issues]) : new Composite(ast, ou, [issue, ...issues]) : issue;
          return fail$3(out);
        });
      }
      sroa = flatMapEager(sroa, (oa) => {
        if (isSome(oa)) {
          const value = oa.value;
          const issues = [];
          collectIssues(checks, value, issues, ast, options);
          if (isArrayNonEmpty(issues)) {
            return fail$3(new Composite(ast, oa, issues));
          }
        }
        return succeed$1(oa);
      });
    }
    return sroa;
  };
});
const TypeId$e = "~effect/Schema/Schema";
const SchemaProto = {
  [TypeId$e]: TypeId$e,
  pipe() {
    return pipeArguments(this, arguments);
  },
  annotate(annotations) {
    return this.rebuild(annotate(this.ast, annotations));
  },
  annotateKey(annotations) {
    return this.rebuild(annotateKey(this.ast, annotations));
  },
  check(...checks) {
    return this.rebuild(appendChecks(this.ast, checks));
  }
};
function make$d(ast, options) {
  const self = Object.create(SchemaProto);
  if (options) {
    Object.assign(self, options);
  }
  self.ast = ast;
  self.rebuild = (ast2) => make$d(ast2, options);
  self.makeEffect = flow(makeEffect(self), mapErrorEager((issue) => new SchemaError(issue)));
  self.make = makeUnsafe(self);
  self.makeOption = makeOption(self);
  return self;
}
const SchemaErrorTypeId = "~effect/Schema/SchemaError";
class SchemaError {
  [SchemaErrorTypeId] = SchemaErrorTypeId;
  _tag = "SchemaError";
  name = "SchemaError";
  issue;
  constructor(issue) {
    this.issue = issue;
  }
  get message() {
    return this.issue.toString();
  }
  toString() {
    return `SchemaError(${this.message})`;
  }
}
function makeReorder(getPriority) {
  return (types) => {
    const indexMap = /* @__PURE__ */ new Map();
    for (let i = 0; i < types.length; i++) {
      indexMap.set(toEncoded(types[i]), i);
    }
    const sortedTypes = [...types].sort((a, b) => {
      a = toEncoded(a);
      b = toEncoded(b);
      const pa = getPriority(a);
      const pb = getPriority(b);
      if (pa !== pb) return pa - pb;
      return indexMap.get(a) - indexMap.get(b);
    });
    const orderChanged = sortedTypes.some((ast, index) => ast !== types[index]);
    if (!orderChanged) return types;
    return sortedTypes;
  };
}
const TypeId$d = TypeId$e;
function declareConstructor() {
  return (typeParameters, run2, annotations) => {
    return make$c(new Declaration(typeParameters.map(getAST), (typeParameters2) => run2(typeParameters2.map((ast) => make$c(ast))), annotations));
  };
}
function declare(is2, annotations) {
  return declareConstructor()([], () => (input, ast) => is2(input) ? succeed$1(input) : fail$3(new InvalidType(ast, some(input))), annotations);
}
function isSchemaError(u) {
  return hasProperty(u, SchemaErrorTypeId);
}
const is = is$1;
function decodeUnknownEffect(schema2) {
  const parser = decodeUnknownEffect$1(schema2);
  return (input, options) => {
    return mapErrorEager(parser(input, options), (issue) => new SchemaError(issue));
  };
}
const make$c = make$d;
function isSchema(u) {
  return hasProperty(u, TypeId$d) && u[TypeId$d] === TypeId$d;
}
const optionalKey = /* @__PURE__ */ lambda((schema2) => make$c(optionalKey$1(schema2.ast), {
  schema: schema2
}));
const toType = /* @__PURE__ */ lambda((schema2) => make$c(toType$1(schema2.ast), {
  schema: schema2
}));
function Literal2(literal) {
  const out = make$c(new Literal$1(literal), {
    literal,
    transform(to) {
      return out.pipe(decodeTo(Literal2(to), {
        decode: transform$1(() => to),
        encode: transform$1(() => literal)
      }));
    }
  });
  return out;
}
const Any2 = /* @__PURE__ */ make$c(any);
const Unknown2 = /* @__PURE__ */ make$c(unknown);
const Null2 = /* @__PURE__ */ make$c(null_);
const Undefined2 = /* @__PURE__ */ make$c(undefined_);
const String$1 = /* @__PURE__ */ make$c(string$1);
const Number$1 = /* @__PURE__ */ make$c(number);
const Boolean2 = /* @__PURE__ */ make$c(boolean);
function makeStruct(ast, fields) {
  return make$c(ast, {
    fields,
    mapFields(f, options) {
      const fields2 = f(this.fields);
      return makeStruct(struct(fields2, options?.unsafePreserveChecks ? this.ast.checks : void 0), fields2);
    }
  });
}
function Struct(fields) {
  return makeStruct(struct(fields, void 0), fields);
}
function Record$1(key, value, options) {
  const keyValueCombiner = void 0;
  return make$c(record(key.ast, value.ast, keyValueCombiner), {
    key,
    value
  });
}
const ArraySchema = /* @__PURE__ */ lambda((schema2) => make$c(new Arrays(false, [], [schema2.ast]), {
  schema: schema2
}));
function makeUnion(ast, members) {
  return make$c(ast, {
    members,
    mapMembers(f, options) {
      const members2 = f(this.members);
      return makeUnion(union(members2, this.ast.mode, options?.unsafePreserveChecks ? this.ast.checks : void 0), members2);
    }
  });
}
function Union2(members, options) {
  return makeUnion(union(members, "anyOf", void 0), members);
}
function Literals(literals) {
  const members = literals.map(Literal2);
  return make$c(union(members, "anyOf", void 0), {
    literals,
    members,
    mapMembers(f) {
      return Union2(f(this.members));
    },
    pick(literals2) {
      return Literals(literals2);
    },
    transform(to) {
      return Union2(members.map((member, index) => member.transform(to[index])));
    }
  });
}
const NullOr = /* @__PURE__ */ lambda((self) => Union2([self, Null2]));
const UndefinedOr = /* @__PURE__ */ lambda((self) => Union2([self, Undefined2]));
function decodeTo(to, transformation) {
  return (from) => {
    return make$c(decodeTo$1(from.ast, to.ast, transformation ? make$e(transformation) : passthrough()), {
      from,
      to
    });
  };
}
function withConstructorDefault(defaultValue) {
  return (schema2) => make$c(withConstructorDefault$1(schema2.ast, defaultValue), {
    schema: schema2
  });
}
function tag(literal) {
  return Literal2(literal).pipe(withConstructorDefault(succeed$1(literal)));
}
function TaggedStruct(value, fields) {
  return Struct({
    _tag: tag(value),
    ...fields
  });
}
function toTaggedUnion(tag2) {
  return (self) => {
    const cases = {};
    const guards = {};
    const isAnyOf = (keys2) => (value) => keys2.includes(value[tag2]);
    walk(self);
    return Object.assign(self, {
      cases,
      isAnyOf,
      guards,
      match: match2
    });
    function walk(schema2) {
      const ast = schema2.ast;
      if (isUnion(ast) && "members" in schema2 && globalThis.Array.isArray(schema2.members) && schema2.members.every(isSchema)) {
        return schema2.members.forEach(walk);
      }
      const sentinels = collectSentinels(ast);
      if (sentinels.length > 0) {
        const literal = sentinels.find((s) => s.key === tag2)?.literal;
        if (isPropertyKey(literal)) {
          cases[literal] = schema2;
          guards[literal] = is(toType(schema2));
          return;
        }
      }
      throw new globalThis.Error("No literal or unique symbol found");
    }
    function match2() {
      if (arguments.length === 1) {
        const cases3 = arguments[0];
        return function(value2) {
          return cases3[value2[tag2]](value2);
        };
      }
      const value = arguments[0];
      const cases2 = arguments[1];
      return cases2[value[tag2]](value);
    }
  };
}
function instanceOf(constructor, annotations) {
  return declare((u) => u instanceof constructor, annotations);
}
function link() {
  return (encodeTo, transformation) => {
    return new Link(encodeTo.ast, make$e(transformation));
  };
}
const makeFilter = makeFilter$1;
function isInt(annotations) {
  return makeFilter((n) => globalThis.Number.isSafeInteger(n), {
    expected: "an integer",
    meta: {
      _tag: "isInt"
    },
    toArbitraryConstraint: {
      number: {
        isInteger: true
      }
    },
    ...annotations
  });
}
const ErrorJsonEncoded = /* @__PURE__ */ Struct({
  message: String$1,
  name: /* @__PURE__ */ optionalKey(String$1),
  stack: /* @__PURE__ */ optionalKey(String$1)
});
const Error$1 = /* @__PURE__ */ instanceOf(globalThis.Error, {
  typeConstructor: {
    _tag: "Error"
  },
  generation: {
    runtime: `Schema.Error`,
    Type: `globalThis.Error`
  },
  expected: "Error",
  toCodecJson: () => link()(ErrorJsonEncoded, errorFromErrorJsonEncoded()),
  toArbitrary: () => (fc) => fc.string().map((message) => new globalThis.Error(message))
});
const defectTransformation = /* @__PURE__ */ new Transformation(/* @__PURE__ */ passthrough$1(), /* @__PURE__ */ transform$1((u) => {
  try {
    return JSON.parse(JSON.stringify(u));
  } catch {
    return format(u);
  }
}));
const Defect = /* @__PURE__ */ Union2([/* @__PURE__ */ ErrorJsonEncoded.pipe(/* @__PURE__ */ decodeTo(Error$1, /* @__PURE__ */ errorFromErrorJsonEncoded())), /* @__PURE__ */ Any2.pipe(/* @__PURE__ */ decodeTo(/* @__PURE__ */ Unknown2.annotate({
  toCodecJson: () => link()(Any2, defectTransformation),
  toArbitrary: () => (fc) => fc.json()
}), defectTransformation))]);
const Int = /* @__PURE__ */ Number$1.check(/* @__PURE__ */ isInt());
const immerable = /* @__PURE__ */ globalThis.Symbol.for("immer-draftable");
function makeClass(Inherited, identifier2, struct$1, annotations, proto) {
  const getClassSchema = getClassSchemaFactory(struct$1, identifier2, annotations);
  const ClassTypeId2 = getClassTypeId(identifier2);
  const out = class extends Inherited {
    constructor(...[input, options]) {
      input = input ?? {};
      const validated = struct$1.make(input, options);
      super({
        ...input,
        ...validated
      }, {
        ...options,
        disableChecks: true
      });
    }
    static [TypeId$d] = TypeId$d;
    get [ClassTypeId2]() {
      return ClassTypeId2;
    }
    static [immerable] = true;
    static identifier = identifier2;
    static fields = struct$1.fields;
    static get ast() {
      return getClassSchema(this).ast;
    }
    static pipe() {
      return pipeArguments(this, arguments);
    }
    static rebuild(ast) {
      return getClassSchema(this).rebuild(ast);
    }
    static make(input, options) {
      return new this(input, options);
    }
    static makeOption(input, options) {
      return makeOption(getClassSchema(this))(input ?? {}, options);
    }
    static makeEffect(input, options) {
      return mapErrorEager(makeEffect(getClassSchema(this))(input ?? {}, options), (issue) => new SchemaError(issue));
    }
    static annotate(annotations2) {
      return this.rebuild(annotate(this.ast, annotations2));
    }
    static annotateKey(annotations2) {
      return this.rebuild(annotateKey(this.ast, annotations2));
    }
    static check(...checks) {
      return this.rebuild(appendChecks(this.ast, checks));
    }
    static extend(identifier3) {
      return (newFields, annotations2) => {
        const fields = {
          ...struct$1.fields,
          ...newFields
        };
        return makeClass(this, identifier3, makeStruct(struct(fields, struct$1.ast.checks, {
          identifier: identifier3
        }), fields), annotations2, proto);
      };
    }
    static mapFields(f, options) {
      return struct$1.mapFields(f, options);
    }
  };
  if (proto !== void 0) {
    Object.assign(out.prototype, proto(identifier2));
  }
  return out;
}
function getClassTransformation(self) {
  return new Transformation(transform$1((input) => new self(input)), passthrough$1());
}
function getClassTypeId(identifier2) {
  return `~effect/Schema/Class/${identifier2}`;
}
function getClassSchemaFactory(from, identifier2, annotations) {
  let memo;
  return (self) => {
    if (memo === void 0) {
      const transformation = getClassTransformation(self);
      const to = make$c(new Declaration([from.ast], () => (input, ast) => {
        return input instanceof self || hasProperty(input, getClassTypeId(identifier2)) ? succeed$1(input) : fail$3(new InvalidType(ast, some(input)));
      }, {
        identifier: identifier2,
        [ClassTypeId]: ([from2]) => new Link(from2, transformation),
        toCodec: ([from2]) => new Link(from2.ast, transformation),
        toArbitrary: ([from2]) => () => from2.map((args2) => new self(args2)),
        toFormatter: ([from2]) => (t) => `${self.identifier}(${from2(t)})`,
        "~sentinels": collectSentinels(from.ast),
        ...annotations
      }));
      memo = from.pipe(decodeTo(to, transformation));
    }
    return memo;
  };
}
function isStruct(schema2) {
  return isSchema(schema2);
}
const ErrorClass = (identifier2) => (schema2, annotations) => {
  const struct2 = isStruct(schema2) ? schema2 : Struct(schema2);
  const self = makeClass(Error$2, identifier2, struct2, annotations, (identifier3) => ({
    name: identifier3
  }));
  return self;
};
const TaggedErrorClass = (identifier2) => {
  return (tagValue, schema2, annotations) => {
    return ErrorClass(tagValue)(isStruct(schema2) ? schema2.mapFields((fields) => ({
      _tag: tag(tagValue),
      ...fields
    }), {
      unsafePreserveChecks: true
    }) : TaggedStruct(tagValue, schema2), annotations);
  };
};
function toCodecStringTree(schema2, options) {
  return make$c(toCodecEnsureArray(serializerStringTree(schema2.ast)));
}
function getStringTreePriority(ast) {
  switch (ast._tag) {
    case "Null":
    case "Boolean":
    case "Number":
    case "BigInt":
    case "Symbol":
    case "UniqueSymbol":
      return 0;
    default:
      return 1;
  }
}
const treeReorder = /* @__PURE__ */ makeReorder(getStringTreePriority);
function serializerTree(ast, recur2, onMissingAnnotation) {
  switch (ast._tag) {
    case "Declaration": {
      const getLink = ast.annotations?.toCodecJson ?? ast.annotations?.toCodec;
      if (isFunction(getLink)) {
        const tps = isDeclaration(ast) ? ast.typeParameters.map((tp) => make$c(recur2(toEncoded(tp)))) : [];
        const link2 = getLink(tps);
        const to = recur2(link2.to);
        return replaceEncoding(ast, to === link2.to ? [link2] : [new Link(to, link2.transformation)]);
      }
      return onMissingAnnotation(ast);
    }
    case "Null":
      return replaceEncoding(ast, [nullToString]);
    case "Boolean":
      return replaceEncoding(ast, [booleanToString]);
    case "Unknown":
    case "ObjectKeyword":
      return replaceEncoding(ast, [unknownToStringTree]);
    case "Enum":
    case "Number":
    case "Literal":
    case "UniqueSymbol":
    case "Symbol":
    case "BigInt":
      return ast.toCodecStringTree();
    case "Objects": {
      if (ast.propertySignatures.some((ps) => typeof ps.name !== "string")) {
        throw new globalThis.Error("Objects property names must be strings", {
          cause: ast
        });
      }
      return ast.recur(recur2);
    }
    case "Union": {
      const sortedTypes = treeReorder(ast.types);
      if (sortedTypes !== ast.types) {
        return new Union$1(sortedTypes, ast.mode, ast.annotations, ast.checks, ast.encoding, ast.context).recur(recur2);
      }
      return ast.recur(recur2);
    }
    case "Arrays":
    case "Suspend":
      return ast.recur(recur2);
  }
  return ast;
}
const nullToString = /* @__PURE__ */ new Link(/* @__PURE__ */ new Literal$1("null"), /* @__PURE__ */ new Transformation(/* @__PURE__ */ transform$1(() => null), /* @__PURE__ */ transform$1(() => "null")));
const booleanToString = /* @__PURE__ */ new Link(/* @__PURE__ */ new Union$1([/* @__PURE__ */ new Literal$1("true"), /* @__PURE__ */ new Literal$1("false")], "anyOf"), /* @__PURE__ */ new Transformation(/* @__PURE__ */ transform$1((s) => s === "true"), /* @__PURE__ */ String$3()));
const serializerStringTree = /* @__PURE__ */ toCodec((ast) => {
  const out = serializerTree(ast, serializerStringTree, (ast2) => replaceEncoding(ast2, [unknownToUndefined]));
  if (out !== ast && isOptional(ast)) {
    return optionalKeyLastLink(out);
  }
  return out;
});
const unknownToUndefined = /* @__PURE__ */ new Link(undefined_, /* @__PURE__ */ new Transformation(/* @__PURE__ */ passthrough$1(), /* @__PURE__ */ transform$1(() => void 0)));
const SERIALIZER_ENSURE_ARRAY = "~effect/Schema/SERIALIZER_ENSURE_ARRAY";
const toCodecEnsureArray = /* @__PURE__ */ toCodec((ast) => {
  if (isUnion(ast) && ast.annotations?.[SERIALIZER_ENSURE_ARRAY]) {
    return ast;
  }
  const out = onSerializerEnsureArray(ast);
  if (isArrays(out)) {
    const ensure2 = new Union$1([out, decodeTo$1(string$1, out, new Transformation(split(), passthrough$1()))], "anyOf", {
      [SERIALIZER_ENSURE_ARRAY]: true
    });
    return isOptional(ast) ? optionalKey$1(ensure2) : ensure2;
  }
  return out;
});
function onSerializerEnsureArray(ast) {
  switch (ast._tag) {
    default:
      return ast;
    case "Declaration":
    case "Arrays":
    case "Objects":
    case "Union":
    case "Suspend":
      return ast.recur(toCodecEnsureArray);
  }
}
const TypeId$c = "~effect/Stream";
const streamVariance = {
  _R: identity,
  _E: identity,
  _A: identity
};
const StreamProto = {
  [TypeId$c]: streamVariance,
  pipe() {
    return pipeArguments(this, arguments);
  }
};
const fromChannel$1 = (channel) => {
  const self = Object.create(StreamProto);
  self.channel = channel;
  return self;
};
const TypeId$b = "~effect/Stream";
const isStream = (u) => hasProperty(u, TypeId$b);
const fromChannel = fromChannel$1;
const suspend = (stream) => fromChannel(suspend$1(() => stream().channel));
const fail$1 = (error) => fromChannel(fail$2(error));
const fromReadableStream = (options) => fromChannel(fromTransform(fnUntraced(function* (_, scope) {
  const reader = options.evaluate().getReader();
  yield* addFinalizer(scope, options.releaseLockOnEnd ? sync(() => reader.releaseLock()) : promise(() => reader.cancel()));
  return flatMap(tryPromise({
    try: () => reader.read(),
    catch: (reason) => options.onError(reason)
  }), ({
    done: done2,
    value
  }) => done2 ? done$1() : succeed$1(of(value)));
})));
const ensuring = /* @__PURE__ */ dual(2, (self, finalizer) => fromChannel(ensuring$1(self.channel, finalizer)));
const runForEachArray = /* @__PURE__ */ dual(2, (self, f) => runForEach(self.channel, f));
const toReadableStreamWith = /* @__PURE__ */ dual((args2) => isStream(args2[0]), (self, context2, options) => {
  let currentResolve = void 0;
  let fiber = void 0;
  const latch = makeUnsafe$1(false);
  return new ReadableStream({
    start(controller) {
      fiber = runFork(provideContext(runForEachArray(self, (chunk) => latch.whenOpen(sync(() => {
        latch.closeUnsafe();
        for (let i = 0; i < chunk.length; i++) {
          controller.enqueue(chunk[i]);
        }
        currentResolve();
        currentResolve = void 0;
      }))), context2));
      fiber.addObserver((exit2) => {
        if (exit2._tag === "Failure") {
          controller.error(squash(exit2.cause));
        } else {
          controller.close();
        }
      });
    },
    pull() {
      return new Promise((resolve2) => {
        currentResolve = resolve2;
        latch.openUnsafe();
      });
    },
    cancel() {
      if (!fiber) return;
      return runPromise(asVoid(interrupt(fiber)));
    }
  }, options?.strategy);
});
const toReadableStreamEffect = /* @__PURE__ */ dual((args2) => isStream(args2[0]), (self, options) => map$1(context(), (context2) => toReadableStreamWith(self, context2, options)));
const __vite_import_meta_env__ = { "BASE_URL": "/", "DEV": true, "MODE": "development", "PROD": false, "SSR": true };
function makeValue(value) {
  return {
    _tag: "Value",
    value
  };
}
function makeRecord(keys2, value) {
  return {
    _tag: "Record",
    keys: keys2,
    value
  };
}
function makeArray(length, value) {
  return {
    _tag: "Array",
    length,
    value
  };
}
const ConfigProvider = /* @__PURE__ */ Reference("effect/ConfigProvider", {
  defaultValue: () => fromEnv()
});
const Proto$7 = {
  ...PipeInspectableProto,
  toJSON() {
    return {
      _id: "ConfigProvider"
    };
  }
};
function make$b(get2, mapInput2, prefix) {
  const self = Object.create(Proto$7);
  self.get = get2;
  self.mapInput = mapInput2;
  self.prefix = prefix;
  self.load = (path) => {
    return get2(path);
  };
  return self;
}
function fromEnv(options) {
  const env = {
    ...globalThis.process.env,
    ...__vite_import_meta_env__
  };
  const trie = buildEnvTrie(env);
  return make$b((path) => succeed$1(nodeAtEnv(trie, env, path)));
}
function buildEnvTrie(env) {
  const root = {};
  for (const [name, value] of Object.entries(env)) {
    if (value === void 0) continue;
    const segments = name.split("_");
    let node = root;
    for (const seg of segments) {
      node.children ??= {};
      node = node.children[seg] ??= {};
    }
    node.value = value;
  }
  return root;
}
const NUMERIC_INDEX = /^(0|[1-9][0-9]*)$/;
function nodeAtEnv(trie, env, path) {
  const key = path.map(String).join("_");
  const leafValue = env[key];
  const trieNode = trieNodeAt(trie, path);
  const children = trieNode?.children ? Object.keys(trieNode.children) : [];
  if (children.length === 0) {
    return leafValue === void 0 ? void 0 : makeValue(leafValue);
  }
  const allNumeric = children.every((k) => NUMERIC_INDEX.test(k));
  if (allNumeric) {
    const length = Math.max(...children.map((k) => parseInt(k, 10))) + 1;
    return makeArray(length, leafValue);
  }
  return makeRecord(new Set(children), leafValue);
}
function trieNodeAt(root, path) {
  if (path.length === 0) return root;
  let node = root;
  for (const seg of path) {
    node = node?.children?.[String(seg)];
    if (!node) return void 0;
  }
  return node;
}
const TypeId$a = "~effect/Config";
class ConfigError {
  _tag = "ConfigError";
  name = "ConfigError";
  cause;
  constructor(cause) {
    this.cause = cause;
  }
  get message() {
    return this.cause.toString();
  }
  toString() {
    return `ConfigError(${this.message})`;
  }
}
const Proto$6 = {
  ...PipeInspectableProto,
  ...YieldableProto,
  [TypeId$a]: TypeId$a,
  asEffect() {
    return flatMap(ConfigProvider.asEffect(), (provider) => this.parse(provider));
  },
  toJSON() {
    return {
      _id: "Config"
    };
  }
};
function make$a(parse2) {
  const self = Object.create(Proto$6);
  self.parse = parse2;
  return self;
}
const map = /* @__PURE__ */ dual(2, (self, f) => {
  return make$a((provider) => map$1(self.parse(provider), f));
});
const orElse = /* @__PURE__ */ dual(2, (self, that) => {
  return make$a((provider) => catch_(self.parse(provider), (error) => that(error).parse(provider)));
});
function all(arg) {
  const configs = Array.isArray(arg) ? arg : Symbol.iterator in arg ? [...arg] : arg;
  if (Array.isArray(configs)) {
    return make$a((provider) => all$1(configs.map((config) => config.parse(provider))));
  } else {
    return make$a((provider) => all$1(map$4(configs, (config) => config.parse(provider))));
  }
}
function isMissingDataOnly(issue) {
  switch (issue._tag) {
    case "MissingKey":
      return true;
    case "InvalidType":
    case "InvalidValue":
      return isNone(issue.actual) || isSome(issue.actual) && issue.actual.value === void 0;
    case "OneOf":
      return issue.actual === void 0;
    case "Encoding":
      return isNone(issue.actual) || isSome(issue.actual) && issue.actual.value === void 0 ? true : isMissingDataOnly(issue.issue);
    case "Pointer":
    case "Filter":
      return isMissingDataOnly(issue.issue);
    case "UnexpectedKey":
      return false;
    case "Forbidden":
      return false;
    case "Composite":
    case "AnyOf":
      return issue.issues.every(isMissingDataOnly);
  }
}
const withDefault = /* @__PURE__ */ dual(2, (self, defaultValue) => {
  return orElse(self, (err) => {
    if (isSchemaError(err.cause)) {
      const issue = err.cause.issue;
      if (isMissingDataOnly(issue)) {
        return succeed(defaultValue);
      }
    }
    return fail(err.cause);
  });
});
const dump = /* @__PURE__ */ fnUntraced(function* (provider, path) {
  const stat = yield* provider.load(path);
  if (stat === void 0) return void 0;
  switch (stat._tag) {
    case "Value":
      return stat.value;
    case "Record": {
      if (stat.value !== void 0) return stat.value;
      const out = {};
      for (const key of stat.keys) {
        const child = yield* dump(provider, [...path, key]);
        if (child !== void 0) out[key] = child;
      }
      return out;
    }
    case "Array": {
      if (stat.value !== void 0) return stat.value;
      const out = [];
      for (let i = 0; i < stat.length; i++) {
        out.push(yield* dump(provider, [...path, i]));
      }
      return out;
    }
  }
});
const recur = /* @__PURE__ */ fnUntraced(function* (ast, provider, path) {
  switch (ast._tag) {
    case "Objects": {
      const out = {};
      for (const ps of ast.propertySignatures) {
        const name = ps.name;
        if (typeof name === "string") {
          const value = yield* recur(ps.type, provider, [...path, name]);
          if (value !== void 0) out[name] = value;
        }
      }
      if (ast.indexSignatures.length > 0) {
        const stat = yield* provider.load(path);
        if (stat && stat._tag === "Record") {
          for (const is2 of ast.indexSignatures) {
            const matches = _is(is2.parameter);
            for (const key of stat.keys) {
              if (!Object.hasOwn(out, key) && matches(key)) {
                const value = yield* recur(is2.type, provider, [...path, key]);
                if (value !== void 0) out[key] = value;
              }
            }
          }
        }
      }
      return out;
    }
    case "Arrays": {
      const stat = yield* provider.load(path);
      if (stat && stat._tag === "Value") return stat.value;
      const out = [];
      for (let i = 0; i < ast.elements.length; i++) {
        out.push(yield* recur(ast.elements[i], provider, [...path, i]));
      }
      return out;
    }
    case "Union":
      return yield* dump(provider, path);
    case "Suspend":
      return yield* recur(ast.thunk(), provider, path);
    default: {
      const stat = yield* provider.load(path);
      if (stat === void 0) return void 0;
      if (stat._tag === "Value") return stat.value;
      if (stat._tag === "Record" && stat.value !== void 0) return stat.value;
      if (stat._tag === "Array" && stat.value !== void 0) return stat.value;
      return void 0;
    }
  }
});
function schema(codec, path) {
  const codecStringTree = toCodecStringTree(codec);
  const decodeUnknownEffect2 = decodeUnknownEffect$1(codecStringTree);
  const codecStringTreeEncoded = toEncoded(codecStringTree.ast);
  const defaultPath = typeof path === "string" ? [path] : path ?? [];
  return make$a((provider) => {
    const path2 = provider.prefix ? [...provider.prefix, ...defaultPath] : defaultPath;
    return recur(codecStringTreeEncoded, provider, defaultPath).pipe(flatMapEager((tree) => decodeUnknownEffect2(tree).pipe(mapErrorEager((issue) => new SchemaError(path2.length > 0 ? new Pointer(path2, issue) : issue)))), mapErrorEager((cause) => new ConfigError(cause)));
  });
}
const Record = (key, value, options) => {
  const record2 = Record$1(key, value);
  const recordString = String$1.pipe(decodeTo(Record$1(String$1, String$1), splitKeyValue()), decodeTo(record2));
  return Union2([record2, recordString]);
};
function fail(err) {
  return make$a(() => fail$3(new ConfigError(err)));
}
function succeed(value) {
  return make$a(() => succeed$1(value));
}
function string(name) {
  return schema(String$1, name);
}
function int(name) {
  return schema(Int, name);
}
const CurrentLoggers = CurrentLoggers$1;
const make$9 = loggerMake;
const layer$3 = (loggers, options) => effect(CurrentLoggers, withFiber$1(fnUntraced$1(function* (fiber) {
  const currentLoggers = new Set(options?.mergeWithExisting === true ? fiber.getRef(CurrentLoggers$1) : []);
  for (const logger of loggers) {
    currentLoggers.add(isEffect$1(logger) ? yield* logger : logger);
  }
  return currentLoggers;
})));
const TypeId$9 = "~effect/ManagedRuntime";
const make$8 = (layer2, options) => {
  const memoMap = makeMemoMapUnsafe();
  const scope = makeUnsafe$2("parallel");
  const layerScope = forkUnsafe(scope, "sequential");
  const defaultRunOptions = {
    onFiberStart: runIn(scope)
  };
  const mergeRunOptions = (options2) => options2 ? {
    ...options2,
    onFiberStart: options2.onFiberStart ? (fiber) => {
      defaultRunOptions.onFiberStart(fiber);
      options2.onFiberStart(fiber);
    } : defaultRunOptions.onFiberStart
  } : defaultRunOptions;
  let buildFiber;
  const contextEffect = withFiber((fiber) => {
    if (!buildFiber) {
      buildFiber = runFork(tap(buildWithMemoMap(layer2, memoMap, layerScope), (context2) => sync(() => {
        self.cachedContext = context2;
      })), {
        ...defaultRunOptions,
        scheduler: fiber.currentScheduler
      });
    }
    return flatten(await_(buildFiber));
  });
  const self = {
    [TypeId$9]: TypeId$9,
    memoMap,
    scope,
    contextEffect,
    cachedContext: void 0,
    context() {
      return self.cachedContext === void 0 ? runPromise(self.contextEffect) : Promise.resolve(self.cachedContext);
    },
    dispose() {
      return runPromise(self.disposeEffect);
    },
    disposeEffect: suspend$2(() => {
      self.contextEffect = die("ManagedRuntime disposed");
      self.cachedContext = void 0;
      return close(self.scope, void_$1);
    }),
    runFork(effect2, options2) {
      return self.cachedContext === void 0 ? runFork(provide(self, effect2), mergeRunOptions(options2)) : runForkWith(self.cachedContext)(effect2, mergeRunOptions(options2));
    },
    runCallback(effect2, options2) {
      return self.cachedContext === void 0 ? runCallback(provide(self, effect2), mergeRunOptions(options2)) : runCallbackWith(self.cachedContext)(effect2, mergeRunOptions(options2));
    },
    runSyncExit(effect2) {
      return self.cachedContext === void 0 ? runSyncExit(provide(self, effect2)) : runSyncExitWith(self.cachedContext)(effect2);
    },
    runSync(effect2) {
      return self.cachedContext === void 0 ? runSync(provide(self, effect2)) : runSyncWith(self.cachedContext)(effect2);
    },
    runPromiseExit(effect2, options2) {
      return self.cachedContext === void 0 ? runPromiseExit(provide(self, effect2), mergeRunOptions(options2)) : runPromiseExitWith(self.cachedContext)(effect2, mergeRunOptions(options2));
    },
    runPromise(effect2, options2) {
      return self.cachedContext === void 0 ? runPromise(provide(self, effect2), mergeRunOptions(options2)) : runPromiseWith(self.cachedContext)(effect2, mergeRunOptions(options2));
    }
  };
  return self;
};
function provide(managed, effect2) {
  return flatMap(managed.contextEffect, (context2) => provideContext(effect2, context2));
}
const SqlClient = /* @__PURE__ */ Service("effect/sql/SqlClient");
const themeMetadataCatalog = [
  { id: "system", name: "System", description: "Use the terminal foreground, background, and ANSI palette", tone: "dark" },
  { id: "ghui", name: "GHUI", description: "Warm parchment accents on a deep slate background", tone: "dark" },
  { id: "tokyo-night", name: "Tokyo Night", description: "Cool indigo surfaces with neon editor accents", tone: "dark" },
  { id: "catppuccin", name: "Catppuccin", description: "Mocha lavender, peach, and soft pastel contrast", tone: "dark" },
  { id: "catppuccin-latte", name: "Catppuccin Latte", description: "Light frothy cream with pastel lavender and peach", tone: "light" },
  { id: "rose-pine", name: "Rose Pine", description: "Muted rose, pine, and gold on dusky violet", tone: "dark" },
  { id: "rose-pine-dawn", name: "Rose Pine Dawn", description: "Soft morning light with rose and sage accents", tone: "light" },
  { id: "gruvbox", name: "Gruvbox", description: "Retro warm earth tones with punchy semantic accents", tone: "dark" },
  { id: "gruvbox-light", name: "Gruvbox Light", description: "Warm parchment background with earthy retro colors", tone: "light" },
  { id: "nord", name: "Nord", description: "Arctic blue-gray surfaces with frosty accents", tone: "dark" },
  { id: "dracula", name: "Dracula", description: "High-contrast purple, pink, cyan, and green", tone: "dark" },
  { id: "kanagawa", name: "Kanagawa", description: "Ink-wash indigo, wave blues, and autumn accents", tone: "dark" },
  { id: "one-dark", name: "One Dark", description: "Atom-style charcoal with clean blue and green accents", tone: "dark" },
  { id: "one-light", name: "One Light", description: "Clean light surfaces with balanced blue and green accents", tone: "light" },
  { id: "monokai", name: "Monokai", description: "Classic dark olive with electric syntax colors", tone: "dark" },
  { id: "solarized-dark", name: "Solarized Dark", description: "Low-contrast blue-green base with calibrated accents", tone: "dark" },
  { id: "solarized-light", name: "Solarized Light", description: "Warm beige base with the same calibrated accent colors", tone: "light" },
  { id: "everforest", name: "Everforest", description: "Soft green-gray forest tones with warm highlights", tone: "dark" },
  { id: "vesper", name: "Vesper", description: "Minimal black surfaces with peach and aqua accents", tone: "dark" },
  { id: "vague", name: "Vague", description: "Muted low-contrast charcoal with soft editor accents", tone: "dark" },
  { id: "ayu", name: "Ayu", description: "Modern bright dark theme with blue and orange accents", tone: "dark" },
  { id: "ayu-mirage", name: "Ayu Mirage", description: "Medium-contrast blue-gray with vibrant syntax colors", tone: "dark" },
  { id: "ayu-light", name: "Ayu Light", description: "Clean light theme with crisp blue and orange accents", tone: "light" },
  { id: "github-dark-dimmed", name: "GitHub Dark Dimmed", description: "GitHub-inspired muted dark blue-gray with soft accents", tone: "dark" },
  { id: "palenight", name: "Palenight", description: "Material-inspired purple-blue with soft lavender tones", tone: "dark" },
  { id: "opencode", name: "OpenCode", description: "Charcoal panels with peach, violet, and blue highlights", tone: "dark" },
  { id: "cursor", name: "Cursor", description: "Deep charcoal base with Anysphere's signature bright blue accents", tone: "dark" }
];
const pairedThemeIds = {
  catppuccin: "catppuccin-latte",
  "catppuccin-latte": "catppuccin",
  "rose-pine": "rose-pine-dawn",
  "rose-pine-dawn": "rose-pine",
  gruvbox: "gruvbox-light",
  "gruvbox-light": "gruvbox",
  "one-dark": "one-light",
  "one-light": "one-dark",
  "solarized-dark": "solarized-light",
  "solarized-light": "solarized-dark",
  ayu: "ayu-light",
  "ayu-mirage": "ayu-light",
  "ayu-light": "ayu"
};
const isThemeId = (value) => typeof value === "string" && themeMetadataCatalog.some((theme) => theme.id === value);
const getThemeMetadata = (id) => themeMetadataCatalog.find((theme) => theme.id === id) ?? themeMetadataCatalog[0];
const themeToneForThemeId = (id) => getThemeMetadata(id).tone;
const pairedThemeId = (id, tone) => {
  const pairedId = pairedThemeIds[id];
  return pairedId && themeToneForThemeId(pairedId) === tone ? pairedId : null;
};
const filterThemeMetadata = (query, tone = "dark") => {
  const normalized = query.trim().toLowerCase();
  const matchingTone = themeMetadataCatalog.filter((theme) => theme.tone === tone);
  if (normalized.length === 0) return matchingTone;
  return matchingTone.filter((theme) => theme.id.includes(normalized) || theme.name.toLowerCase().includes(normalized) || theme.description.toLowerCase().includes(normalized));
};
const defaultDarkThemeId = "ghui";
const defaultLightThemeId = "catppuccin-latte";
const firstThemeForTone = (tone) => filterThemeMetadata("", tone)[0]?.id;
const fallbackThemeForTone = (sourceTheme, tone) => {
  if (themeToneForThemeId(sourceTheme) === tone) return sourceTheme;
  return pairedThemeId(sourceTheme, tone) ?? firstThemeForTone(tone) ?? (tone === "dark" ? defaultDarkThemeId : defaultLightThemeId);
};
const storedThemeId = (value, fallback) => isThemeId(value) ? value : fallback;
const storedThemeIdForTone = (value, tone, fallback) => {
  const id = storedThemeId(value, fallback);
  return themeToneForThemeId(id) === tone ? id : fallback;
};
const normalizeThemeConfig = (config) => {
  const fixedTheme = storedThemeId(config.theme, defaultDarkThemeId);
  if (config.themeMode !== "system") return { mode: "fixed", theme: fixedTheme };
  const darkFallback = fallbackThemeForTone(fixedTheme, "dark");
  const lightFallback = fallbackThemeForTone(fixedTheme, "light");
  return {
    mode: "system",
    darkTheme: storedThemeIdForTone(config.darkTheme, "dark", darkFallback),
    lightTheme: storedThemeIdForTone(config.lightTheme, "light", lightFallback)
  };
};
Literals(["unified", "split"]);
Literals(["none", "word"]);
const DiffWhitespaceMode = Literals(["ignore", "show"]);
Literals(["addition", "deletion", "context"]);
taggedEnum();
const pullRequestStates = ["open", "closed", "merged"];
const pullRequestQueueModes = ["authored", "review", "assigned", "mentioned", "inbox"];
const pullRequestQueueSearchQualifier = (mode, repository) => {
  const qualifiers = {
    repository: repository ? `repo:${repository}` : "author:@me",
    authored: "author:@me",
    review: "review-requested:@me",
    assigned: "assignee:@me",
    mentioned: "mentions:@me",
    inbox: "author:@me"
  };
  const qualifier = qualifiers[mode];
  return mode === "repository" && repository ? qualifier : `${qualifier} archived:false`;
};
const checkConclusions = ["success", "failure", "neutral", "skipped", "cancelled", "timed_out"];
const checkRunStatuses = ["completed", "in_progress", "queued", "pending"];
const checkRollupStatuses = ["passing", "pending", "failing", "none"];
const reviewStatuses = ["draft", "approved", "changes", "review", "none"];
const DiffCommentSide = Literals(["LEFT", "RIGHT"]);
const viewCacheKey = (view) => view._tag === "Repository" ? `repository:${view.repository}` : view.mode;
const positiveIntOr = (fallback) => (value) => Number.isFinite(value) && value > 0 ? value : fallback;
const pageSizeOr = (fallback) => (value) => Math.min(100, positiveIntOr(fallback)(value));
const defaultCachePath = () => join(process.env.XDG_CACHE_HOME ?? join(homedir(), ".cache"), "ghui", "cache.sqlite");
const resolveCachePath = () => {
  const value = process.env.GHUI_CACHE_PATH?.trim();
  if (value === "off" || value === "0" || value === "false") return null;
  return value && value.length > 0 ? value : defaultCachePath();
};
class AppConfigService extends Service()("ghui/AppConfig") {
}
const appConfig$1 = all({
  prFetchLimit: int("GHUI_PR_FETCH_LIMIT").pipe(withDefault(200), map(positiveIntOr(200))),
  prPageSize: int("GHUI_PR_PAGE_SIZE").pipe(withDefault(50), map(pageSizeOr(50))),
  cachePath: succeed(resolveCachePath()),
  prUpdatedSinceWindow: string("GHUI_PR_UPDATED_SINCE").pipe(
    withDefault("1m"),
    map((v) => {
      const valid = ["1m", "3m", "1y", "any"];
      return valid.includes(v) ? v : "1m";
    })
  )
});
const resolveAppConfig = gen(function* () {
  return yield* appConfig$1;
});
effect(AppConfigService, resolveAppConfig);
const configDirectory = () => {
  if (process.env.GHUI_CONFIG_DIR) return process.env.GHUI_CONFIG_DIR;
  if (process.env.XDG_CONFIG_HOME) return join(process.env.XDG_CONFIG_HOME, "ghui");
  if (process.platform === "win32" && process.env.APPDATA) return join(process.env.APPDATA, "ghui");
  return join(homedir(), ".config", "ghui");
};
const configPath = () => join(configDirectory(), "config.json");
const parseConfig = (text2) => {
  const value = JSON.parse(text2);
  return value && typeof value === "object" ? value : {};
};
const readStoredConfig = async () => {
  const file = Bun.file(configPath());
  return await file.exists() ? parseConfig(await file.text()) : {};
};
catchCause(
  tryPromise(async () => {
    const config = await readStoredConfig();
    return isThemeId(config.theme) ? config.theme : "ghui";
  }),
  () => succeed$1("ghui")
);
catchCause(
  tryPromise(async () => normalizeThemeConfig(await readStoredConfig())),
  () => succeed$1(normalizeThemeConfig({}))
);
catchCause(
  tryPromise(async () => {
    const config = await readStoredConfig();
    return is(DiffWhitespaceMode)(config.diffWhitespaceMode) ? config.diffWhitespaceMode : "ignore";
  }),
  () => succeed$1("ignore")
);
catchCause(
  tryPromise(async () => {
    const config = await readStoredConfig();
    return typeof config.systemThemeAutoReload === "boolean" ? config.systemThemeAutoReload : false;
  }),
  () => succeed$1(false)
);
const methodCopy = {
  squash: {
    verb: "Squash and merge",
    pastTense: "Merged",
    autoDescription: "Squash and merge automatically once GitHub requirements pass.",
    adminDescription: "Bypass merge requirements and squash with --admin.",
    cliFlag: "--squash"
  },
  merge: {
    verb: "Create a merge commit",
    pastTense: "Merged",
    autoDescription: "Create a merge commit automatically once GitHub requirements pass.",
    adminDescription: "Bypass merge requirements and create a merge commit with --admin.",
    cliFlag: "--merge"
  },
  rebase: {
    verb: "Rebase and merge",
    pastTense: "Rebased",
    autoDescription: "Rebase and merge automatically once GitHub requirements pass.",
    adminDescription: "Bypass merge requirements and rebase with --admin.",
    cliFlag: "--rebase"
  }
};
const mergeActionCliArgs = (action) => {
  if (action.kind === "disable-auto") return ["--disable-auto"];
  const methodFlag = methodCopy[action.method].cliFlag;
  if (action.kind === "now") return [methodFlag, "--delete-branch"];
  if (action.kind === "auto") return [methodFlag, "--auto", "--delete-branch"];
  return [methodFlag, "--admin", "--delete-branch"];
};
const TypeId$8 = "~effect/http/Cookies";
const CookieTypeId = "~effect/http/Cookies/Cookie";
const Proto$5 = {
  [TypeId$8]: TypeId$8,
  ...BaseProto,
  toJSON() {
    return {
      _id: "effect/Cookies",
      cookies: map$4(this.cookies, (cookie) => cookie.toJSON())
    };
  },
  pipe() {
    return pipeArguments(this, arguments);
  }
};
const fromReadonlyRecord = (cookies) => {
  const self = Object.create(Proto$5);
  self.cookies = cookies;
  return self;
};
const fromIterable = (cookies) => {
  const record2 = {};
  for (const cookie of cookies) {
    record2[cookie.name] = cookie;
  }
  return fromReadonlyRecord(record2);
};
const fromSetCookie = (headers) => {
  const arrayHeaders = typeof headers === "string" ? [headers] : headers;
  const cookies = [];
  for (const header of arrayHeaders) {
    const cookie = parseSetCookie(header.trim());
    if (cookie) {
      cookies.push(cookie);
    }
  }
  return fromIterable(cookies);
};
function parseSetCookie(header) {
  const parts = header.split(";").map((_) => _.trim()).filter((_) => _ !== "");
  if (parts.length === 0) {
    return void 0;
  }
  const firstEqual = parts[0].indexOf("=");
  if (firstEqual === -1) {
    return void 0;
  }
  const name = parts[0].slice(0, firstEqual);
  if (!fieldContentRegExp.test(name)) {
    return void 0;
  }
  const valueEncoded = parts[0].slice(firstEqual + 1);
  const value = tryDecodeURIComponent(valueEncoded);
  if (parts.length === 1) {
    return Object.assign(Object.create(CookieProto), {
      name,
      value,
      valueEncoded
    });
  }
  const options = {};
  for (let i = 1; i < parts.length; i++) {
    const part = parts[i];
    const equalIndex = part.indexOf("=");
    const key = equalIndex === -1 ? part : part.slice(0, equalIndex).trim();
    const value2 = equalIndex === -1 ? void 0 : part.slice(equalIndex + 1).trim();
    switch (key.toLowerCase()) {
      case "domain": {
        if (value2 === void 0) {
          break;
        }
        const domain = value2.trim().replace(/^\./, "");
        if (domain) {
          options.domain = domain;
        }
        break;
      }
      case "expires": {
        if (value2 === void 0) {
          break;
        }
        const date = new Date(value2);
        if (!isNaN(date.getTime())) {
          options.expires = date;
        }
        break;
      }
      case "max-age": {
        if (value2 === void 0) {
          break;
        }
        const maxAge = parseInt(value2, 10);
        if (!isNaN(maxAge)) {
          options.maxAge = seconds(maxAge);
        }
        break;
      }
      case "path": {
        if (value2 === void 0) {
          break;
        }
        if (value2[0] === "/") {
          options.path = value2;
        }
        break;
      }
      case "priority": {
        if (value2 === void 0) {
          break;
        }
        switch (value2.toLowerCase()) {
          case "low":
            options.priority = "low";
            break;
          case "medium":
            options.priority = "medium";
            break;
          case "high":
            options.priority = "high";
            break;
        }
        break;
      }
      case "httponly": {
        options.httpOnly = true;
        break;
      }
      case "secure": {
        options.secure = true;
        break;
      }
      case "partitioned": {
        options.partitioned = true;
        break;
      }
      case "samesite": {
        if (value2 === void 0) {
          break;
        }
        switch (value2.toLowerCase()) {
          case "lax":
            options.sameSite = "lax";
            break;
          case "strict":
            options.sameSite = "strict";
            break;
          case "none":
            options.sameSite = "none";
            break;
        }
        break;
      }
    }
  }
  return Object.assign(Object.create(CookieProto), {
    name,
    value,
    valueEncoded,
    options: Object.keys(options).length > 0 ? options : void 0
  });
}
const fieldContentRegExp = /^[\u0009\u0020-\u007e\u0080-\u00ff]+$/;
const CookieProto = {
  [CookieTypeId]: CookieTypeId,
  ...BaseProto,
  toJSON() {
    return {
      _id: "effect/Cookies/Cookie",
      name: this.name,
      value: this.value,
      options: this.options
    };
  }
};
const tryDecodeURIComponent = (str) => {
  try {
    return decodeURIComponent(str);
  } catch (_) {
    return str;
  }
};
const TypeId$7 = /* @__PURE__ */ Symbol.for("~effect/http/Headers");
const Proto$4 = /* @__PURE__ */ Object.create(null);
Object.defineProperties(Proto$4, {
  [TypeId$7]: {
    value: TypeId$7
  },
  [symbolRedactable]: {
    value(context2) {
      return redact(this, get(context2, CurrentRedactedNames));
    }
  },
  toJSON: {
    value() {
      return redact$1(this);
    }
  },
  [symbol]: {
    value(that) {
      return Equivalence$1(this, that);
    }
  },
  [symbol$1]: {
    value() {
      return structure(this);
    }
  },
  toString: {
    value: BaseProto.toString
  },
  [NodeInspectSymbol]: {
    value: BaseProto[NodeInspectSymbol]
  }
});
const make$7 = (input) => Object.assign(Object.create(Proto$4), input);
const Equivalence$1 = /* @__PURE__ */ makeEquivalence$1(/* @__PURE__ */ strictEqual());
const empty$3 = /* @__PURE__ */ Object.create(Proto$4);
const fromInput$1 = (input) => {
  if (input === void 0) {
    return empty$3;
  } else if (Symbol.iterator in input) {
    const out2 = Object.create(Proto$4);
    for (const [k, v] of input) {
      out2[k.toLowerCase()] = v;
    }
    return out2;
  }
  const out = Object.create(Proto$4);
  for (const [k, v] of Object.entries(input)) {
    if (Array.isArray(v)) {
      out[k.toLowerCase()] = v.join(", ");
    } else if (v !== void 0) {
      out[k.toLowerCase()] = v;
    }
  }
  return out;
};
const fromRecordUnsafe = (input) => Object.setPrototypeOf(input, Proto$4);
const set = /* @__PURE__ */ dual(3, (self, key, value) => {
  const out = make$7(self);
  out[key.toLowerCase()] = value;
  return out;
});
const setAll$1 = /* @__PURE__ */ dual(2, (self, headers) => make$7({
  ...self,
  ...fromInput$1(headers)
}));
const merge = /* @__PURE__ */ dual(2, (self, headers) => {
  const out = make$7(self);
  Object.assign(out, headers);
  return out;
});
const remove = /* @__PURE__ */ dual(2, (self, key) => {
  const out = make$7(self);
  delete out[key.toLowerCase()];
  return out;
});
const redact = /* @__PURE__ */ dual(2, (self, key) => {
  const out = {
    ...self
  };
  const modify2 = (key2) => {
    if (typeof key2 === "string") {
      const k = key2.toLowerCase();
      if (k in self) {
        out[k] = make$g(self[k]);
      }
    } else {
      for (const name in self) {
        if (key2.test(name)) {
          out[name] = make$g(self[name]);
        }
      }
    }
  };
  if (Array.isArray(key)) {
    for (let i = 0; i < key.length; i++) {
      modify2(key[i]);
    }
  } else {
    modify2(key);
  }
  return out;
});
const CurrentRedactedNames = /* @__PURE__ */ Reference("effect/Headers/CurrentRedactedNames", {
  defaultValue: () => ["authorization", "cookie", "set-cookie", "x-api-key"]
});
const TypeId$6 = "~effect/http/HttpClientError";
const isHttpClientError = (u) => hasProperty(u, TypeId$6);
class HttpClientError extends (/* @__PURE__ */ TaggedError("HttpClientError")) {
  constructor(props) {
    if ("cause" in props.reason) {
      super({
        ...props,
        cause: props.reason.cause
      });
    } else {
      super(props);
    }
  }
  /**
   * @since 4.0.0
   */
  [TypeId$6] = TypeId$6;
  /**
   * @since 4.0.0
   */
  get request() {
    return this.reason.request;
  }
  /**
   * @since 4.0.0
   */
  get response() {
    return "response" in this.reason ? this.reason.response : void 0;
  }
  get message() {
    return this.reason.message;
  }
}
const formatReason = (tag2) => tag2.endsWith("Error") ? tag2.slice(0, -5) : tag2;
const formatMessage = (reason, description, info) => description ? `${reason}: ${description} (${info})` : `${reason} error (${info})`;
class TransportError extends (/* @__PURE__ */ TaggedError("TransportError")) {
  /**
   * @since 4.0.0
   */
  get methodAndUrl() {
    return `${this.request.method} ${this.request.url}`;
  }
  /**
   * @since 4.0.0
   */
  get message() {
    return formatMessage(formatReason(this._tag), this.description, this.methodAndUrl);
  }
}
class InvalidUrlError extends (/* @__PURE__ */ TaggedError("InvalidUrlError")) {
  /**
   * @since 4.0.0
   */
  get methodAndUrl() {
    return `${this.request.method} ${this.request.url}`;
  }
  /**
   * @since 4.0.0
   */
  get message() {
    return formatMessage(formatReason(this._tag), this.description, this.methodAndUrl);
  }
}
class StatusCodeError extends (/* @__PURE__ */ TaggedError("StatusCodeError")) {
  /**
   * @since 4.0.0
   */
  get methodAndUrl() {
    return `${this.request.method} ${this.request.url}`;
  }
  /**
   * @since 4.0.0
   */
  get message() {
    const info = `${this.response.status} ${this.methodAndUrl}`;
    return formatMessage(formatReason(this._tag), this.description, info);
  }
}
class DecodeError extends (/* @__PURE__ */ TaggedError("DecodeError")) {
  /**
   * @since 4.0.0
   */
  get methodAndUrl() {
    return `${this.request.method} ${this.request.url}`;
  }
  /**
   * @since 4.0.0
   */
  get message() {
    const info = `${this.response.status} ${this.methodAndUrl}`;
    return formatMessage(formatReason(this._tag), this.description, info);
  }
}
class EmptyBodyError extends (/* @__PURE__ */ TaggedError("EmptyBodyError")) {
  /**
   * @since 4.0.0
   */
  get methodAndUrl() {
    return `${this.request.method} ${this.request.url}`;
  }
  /**
   * @since 4.0.0
   */
  get message() {
    const info = `${this.response.status} ${this.methodAndUrl}`;
    return formatMessage(formatReason(this._tag), this.description, info);
  }
}
const TypeId$5 = "~effect/http/UrlParams";
const Proto$3 = {
  ...PipeInspectableProto,
  [TypeId$5]: TypeId$5,
  [Symbol.iterator]() {
    return this.params[Symbol.iterator]();
  },
  toJSON() {
    return {
      _id: "UrlParams",
      params: Object.fromEntries(this.params)
    };
  },
  [symbol](that) {
    return Equivalence(this, that);
  },
  [symbol$1]() {
    return array(this.params.flat());
  }
};
const make$6 = (params) => {
  const self = Object.create(Proto$3);
  self.params = params;
  return self;
};
const fromInput = (input) => {
  const parsed = fromInputNested(input);
  const out = [];
  for (let i = 0; i < parsed.length; i++) {
    if (Array.isArray(parsed[i][0])) {
      const [keys2, value] = parsed[i];
      out.push([`${keys2[0]}[${keys2.slice(1).join("][")}]`, value]);
    } else {
      out.push(parsed[i]);
    }
  }
  return make$6(out);
};
const fromInputNested = (input) => {
  const entries = typeof input[Symbol.iterator] === "function" ? fromIterable$1(input) : Object.entries(input);
  const out = [];
  for (const [key, value] of entries) {
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        if (value[i] !== void 0) {
          out.push([key, String(value[i])]);
        }
      }
    } else if (typeof value === "object") {
      const nested = fromInputNested(value);
      for (const [k, v] of nested) {
        out.push([[key, ...typeof k === "string" ? [k] : k], v]);
      }
    } else if (value !== void 0) {
      out.push([key, String(value)]);
    }
  }
  return out;
};
const Equivalence = /* @__PURE__ */ make$l((a, b) => arrayEquivalence(a.params, b.params));
const arrayEquivalence = /* @__PURE__ */ makeEquivalence(/* @__PURE__ */ makeEquivalence$2([/* @__PURE__ */ strictEqual(), /* @__PURE__ */ strictEqual()]));
const empty$2 = /* @__PURE__ */ make$6([]);
const setAll = /* @__PURE__ */ dual(2, (self, input) => {
  const out = fromInput(input);
  const params = out.params;
  const keys2 = /* @__PURE__ */ new Set();
  for (let i = 0; i < params.length; i++) {
    keys2.add(params[i][0]);
  }
  for (let i = 0; i < self.params.length; i++) {
    if (keys2.has(self.params[i][0])) continue;
    params.push(self.params[i]);
  }
  return out;
});
class UrlParamsError extends (/* @__PURE__ */ TaggedError("UrlParamsError")) {
}
const makeUrl = (url, params, hash2) => {
  try {
    const urlInstance = new URL(url, baseUrl());
    for (let i = 0; i < params.params.length; i++) {
      const [key, value] = params.params[i];
      if (value !== void 0) {
        urlInstance.searchParams.append(key, value);
      }
    }
    if (hash2 !== void 0) {
      urlInstance.hash = hash2;
    }
    return succeed$5(urlInstance);
  } catch (e) {
    return fail$6(new UrlParamsError({
      cause: e
    }));
  }
};
const baseUrl = () => {
  if ("location" in globalThis && globalThis.location !== void 0 && globalThis.location.origin !== void 0 && globalThis.location.pathname !== void 0) {
    return location.origin + location.pathname;
  }
  return void 0;
};
const TypeId$4 = "~effect/http/HttpBody";
let Proto$2 = class Proto {
  [TypeId$4];
  constructor() {
    this[TypeId$4] = TypeId$4;
  }
  [NodeInspectSymbol]() {
    return this.toJSON();
  }
  toString() {
    return format(this, {
      ignoreToString: true
    });
  }
};
class Empty extends Proto$2 {
  _tag = "Empty";
  toJSON() {
    return {
      _id: "effect/HttpBody",
      _tag: "Empty"
    };
  }
}
const empty$1 = /* @__PURE__ */ new Empty();
class Uint8Array extends Proto$2 {
  _tag = "Uint8Array";
  body;
  contentType;
  contentLength;
  constructor(body, contentType, contentLength) {
    super();
    this.body = body;
    this.contentType = contentType;
    this.contentLength = contentLength;
  }
  toJSON() {
    const toString = this.contentType.startsWith("text/") || this.contentType.endsWith("json");
    return {
      _id: "effect/HttpBody",
      _tag: "Uint8Array",
      body: toString ? new TextDecoder().decode(this.body) : `Uint8Array(${this.body.length})`,
      contentType: this.contentType,
      contentLength: this.contentLength
    };
  }
}
const uint8Array = (body, contentType) => new Uint8Array(body, contentType, body.length);
const encoder = /* @__PURE__ */ new TextEncoder();
const text = (body, contentType) => uint8Array(encoder.encode(body), contentType);
const jsonUnsafe = (body, contentType) => text(JSON.stringify(body), "application/json");
const allShort = [["GET", "get"], ["POST", "post"], ["PUT", "put"], ["DELETE", "del"], ["PATCH", "patch"], ["HEAD", "head"], ["OPTIONS", "options"], ["TRACE", "trace"]];
const TypeId$3 = "~effect/http/HttpClientRequest";
const Proto$1 = {
  [TypeId$3]: TypeId$3,
  ...BaseProto,
  toJSON() {
    return {
      _id: "HttpClientRequest",
      method: this.method,
      url: this.url,
      urlParams: this.urlParams,
      hash: this.hash,
      headers: redact$1(this.headers),
      body: this.body.toJSON()
    };
  },
  pipe() {
    return pipeArguments(this, arguments);
  }
};
function makeWith$1(method, url, urlParams, hash2, headers, body) {
  const self = Object.create(Proto$1);
  self.method = method;
  self.url = url;
  self.urlParams = urlParams;
  self.hash = hash2;
  self.headers = headers;
  self.body = body;
  return self;
}
const empty = /* @__PURE__ */ makeWith$1("GET", "", empty$2, /* @__PURE__ */ none(), empty$3, empty$1);
const make$5 = (method) => (url, options) => modify(empty, {
  method,
  url,
  ...options ?? void 0
});
const post = /* @__PURE__ */ make$5("POST");
const modify = /* @__PURE__ */ dual(2, (self, options) => {
  let result2 = self;
  if (options.method) {
    result2 = setMethod(result2, options.method);
  }
  if (options.url) {
    result2 = setUrl(result2, options.url);
  }
  if (options.headers) {
    result2 = setHeaders(result2, options.headers);
  }
  if (options.urlParams) {
    result2 = setUrlParams(result2, options.urlParams);
  }
  if (options.hash) {
    result2 = setHash(result2, options.hash);
  }
  if (options.body) {
    result2 = setBody(result2, options.body);
  }
  if (options.accept) {
    result2 = accept(result2, options.accept);
  }
  if (options.acceptJson) {
    result2 = acceptJson(result2);
  }
  return result2;
});
const setMethod = /* @__PURE__ */ dual(2, (self, method) => makeWith$1(method, self.url, self.urlParams, self.hash, self.headers, self.body));
const setHeader = /* @__PURE__ */ dual(3, (self, key, value) => makeWith$1(self.method, self.url, self.urlParams, self.hash, set(self.headers, key, value), self.body));
const setHeaders = /* @__PURE__ */ dual(2, (self, input) => makeWith$1(self.method, self.url, self.urlParams, self.hash, setAll$1(self.headers, input), self.body));
const accept = /* @__PURE__ */ dual(2, (self, mediaType) => setHeader(self, "Accept", mediaType));
const acceptJson = /* @__PURE__ */ accept("application/json");
const setUrl = /* @__PURE__ */ dual(2, (self, url) => {
  if (typeof url === "string") {
    return makeWith$1(self.method, url, self.urlParams, self.hash, self.headers, self.body);
  }
  const clone = new URL(url.toString());
  const urlParams = fromInput(clone.searchParams);
  const hash2 = fromNullishOr(clone.hash === "" ? void 0 : clone.hash.slice(1));
  clone.search = "";
  clone.hash = "";
  return makeWith$1(self.method, clone.toString(), urlParams, hash2, self.headers, self.body);
});
const setUrlParams = /* @__PURE__ */ dual(2, (self, input) => makeWith$1(self.method, self.url, setAll(self.urlParams, input), self.hash, self.headers, self.body));
const setHash = /* @__PURE__ */ dual(2, (self, hash2) => makeWith$1(self.method, self.url, self.urlParams, some(hash2), self.headers, self.body));
const setBody = /* @__PURE__ */ dual(2, (self, body) => {
  let headers = self.headers;
  if (body._tag === "Empty" || body._tag === "FormData") {
    headers = remove(remove(headers, "Content-Type"), "Content-length");
  } else {
    if (body.contentType) {
      headers = set(headers, "content-type", body.contentType);
    }
    if (body.contentLength !== void 0) {
      headers = set(headers, "content-length", body.contentLength.toString());
    }
  }
  return makeWith$1(self.method, self.url, self.urlParams, self.hash, headers, body);
});
const TypeId$2 = "~effect/http/HttpIncomingMessage";
const inspect = (self, that) => {
  const contentType = self.headers["content-type"] ?? "";
  let body;
  if (contentType.includes("application/json")) {
    try {
      body = runSync(self.json);
    } catch (_) {
    }
  } else if (contentType.includes("text/") || contentType.includes("urlencoded")) {
    try {
      body = runSync(self.text);
    } catch (_) {
    }
  }
  const obj = {
    ...that,
    headers: redact$1(self.headers),
    remoteAddress: self.remoteAddress
  };
  if (body !== void 0) {
    obj.body = body;
  }
  return obj;
};
const TypeId$1 = "~effect/http/HttpClientResponse";
const fromWeb = (request, source) => new WebHttpClientResponse(request, source);
const filterStatusOk$1 = (self) => self.status >= 200 && self.status < 300 ? succeed$1(self) : fail$3(new HttpClientError({
  reason: new StatusCodeError({
    response: self,
    request: self.request,
    description: "non 2xx status code"
  })
}));
class WebHttpClientResponse extends Class {
  [TypeId$2];
  [TypeId$1];
  request;
  source;
  constructor(request, source) {
    super();
    this.request = request;
    this.source = source;
    this[TypeId$2] = TypeId$2;
    this[TypeId$1] = TypeId$1;
  }
  toJSON() {
    return inspect(this, {
      _id: "HttpClientResponse",
      request: this.request.toJSON(),
      status: this.status
    });
  }
  get status() {
    return this.source.status;
  }
  get headers() {
    return fromInput$1(this.source.headers);
  }
  cachedCookies;
  get cookies() {
    if (this.cachedCookies) {
      return this.cachedCookies;
    }
    return this.cachedCookies = fromSetCookie(this.source.headers.getSetCookie());
  }
  get remoteAddress() {
    return none();
  }
  get stream() {
    return this.source.body ? fromReadableStream({
      evaluate: () => this.source.body,
      onError: (cause) => new HttpClientError({
        reason: new DecodeError({
          request: this.request,
          response: this,
          cause
        })
      })
    }) : fail$1(new HttpClientError({
      reason: new EmptyBodyError({
        request: this.request,
        response: this,
        description: "can not create stream from empty body"
      })
    }));
  }
  get json() {
    return flatMap(this.text, (text2) => try_({
      try: () => text2 === "" ? null : JSON.parse(text2),
      catch: (cause) => new HttpClientError({
        reason: new DecodeError({
          request: this.request,
          response: this,
          cause
        })
      })
    }));
  }
  textBody;
  get text() {
    if (this.textBody) {
      return this.textBody;
    }
    this.textBody = tryPromise({
      try: () => this.source.text(),
      catch: (cause) => new HttpClientError({
        reason: new DecodeError({
          request: this.request,
          response: this,
          cause
        })
      })
    }).pipe(cached, runSync);
    this.arrayBufferBody = map$1(this.textBody, (_) => new TextEncoder().encode(_).buffer);
    return this.textBody;
  }
  get urlParamsBody() {
    return flatMap(this.text, (_) => try_({
      try: () => fromInput(new URLSearchParams(_)),
      catch: (cause) => new HttpClientError({
        reason: new DecodeError({
          request: this.request,
          response: this,
          cause
        })
      })
    }));
  }
  formDataBody;
  get formData() {
    return this.formDataBody ??= tryPromise({
      try: () => this.source.formData(),
      catch: (cause) => new HttpClientError({
        reason: new DecodeError({
          request: this.request,
          response: this,
          cause
        })
      })
    }).pipe(cached, runSync);
  }
  arrayBufferBody;
  get arrayBuffer() {
    if (this.arrayBufferBody) {
      return this.arrayBufferBody;
    }
    this.arrayBufferBody = tryPromise({
      try: () => this.source.arrayBuffer(),
      catch: (cause) => new HttpClientError({
        reason: new DecodeError({
          request: this.request,
          response: this,
          cause
        })
      })
    }).pipe(cached, runSync);
    this.textBody = map$1(this.arrayBufferBody, (_) => new TextDecoder().decode(_));
    return this.arrayBufferBody;
  }
  pipe() {
    return pipeArguments(this, arguments);
  }
}
const toHeaders = (span) => fromRecordUnsafe({
  b3: `${span.traceId}-${span.spanId}-${span.sampled ? "1" : "0"}${match$2(span.parent, {
    onNone: () => "",
    onSome: (parent) => `-${parent.spanId}`
  })}`,
  traceparent: `00-${span.traceId}-${span.spanId}-${span.sampled ? "01" : "00"}`
});
const TypeId = "~effect/http/HttpClient";
const HttpClient = /* @__PURE__ */ Service("effect/HttpClient");
const transformResponse = /* @__PURE__ */ dual(2, (self, f) => makeWith((request) => f(self.postprocess(request)), self.preprocess));
const filterStatusOk = /* @__PURE__ */ transformResponse(/* @__PURE__ */ flatMap(filterStatusOk$1));
const makeWith = (postprocess, preprocess) => {
  const self = Object.create(Proto2);
  self.preprocess = preprocess;
  self.postprocess = postprocess;
  self.execute = function(request) {
    return postprocess(preprocess(request));
  };
  return self;
};
const Proto2 = {
  [TypeId]: TypeId,
  pipe() {
    return pipeArguments(this, arguments);
  },
  ...BaseProto,
  toJSON() {
    return {
      _id: "effect/HttpClient"
    };
  },
  .../* @__PURE__ */ Object.fromEntries(/* @__PURE__ */ allShort.map(([fullMethod, method]) => [method, function(url, options) {
    return this.execute(make$5(fullMethod)(url, options));
  }]))
};
const make$4 = (f) => makeWith((effect2) => flatMap(effect2, (request) => withFiber((fiber) => {
  const scopedController = scopedRequests.get(request);
  const controller = scopedController ?? new AbortController();
  const urlResult = makeUrl(request.url, request.urlParams, getOrUndefined(request.hash));
  if (isFailure(urlResult)) {
    return fail$3(new HttpClientError({
      reason: new InvalidUrlError({
        request,
        cause: urlResult.failure
      })
    }));
  }
  const url = urlResult.success;
  const tracerDisabled = fiber.getRef(DisablePropagation) || fiber.getRef(TracerDisabledWhen)(request);
  if (tracerDisabled) {
    const effect3 = f(request, url, controller.signal, fiber);
    if (scopedController) return effect3;
    return uninterruptibleMask((restore) => matchCauseEffect(restore(effect3), {
      onSuccess(response) {
        responseRegistry.register(response, controller);
        return succeed$1(new InterruptibleResponse(response, controller));
      },
      onFailure(cause) {
        if (hasInterrupts(cause)) {
          controller.abort();
        }
        return failCause(cause);
      }
    }));
  }
  return useSpan(fiber.getRef(SpanNameGenerator)(request), {
    kind: "client"
  }, (span) => {
    span.attribute("http.request.method", request.method);
    span.attribute("server.address", url.origin);
    if (url.port !== "") {
      span.attribute("server.port", +url.port);
    }
    span.attribute("url.full", url.toString());
    span.attribute("url.path", url.pathname);
    span.attribute("url.scheme", url.protocol.slice(0, -1));
    const query = url.search.slice(1);
    if (query !== "") {
      span.attribute("url.query", query);
    }
    const redactedHeaderNames = fiber.getRef(CurrentRedactedNames);
    const redactedHeaders = redact(request.headers, redactedHeaderNames);
    for (const name in redactedHeaders) {
      span.attribute(`http.request.header.${name}`, String(redactedHeaders[name]));
    }
    request = fiber.getRef(TracerPropagationEnabled) ? setHeaders(request, toHeaders(span)) : request;
    return uninterruptibleMask((restore) => restore(f(request, url, controller.signal, fiber)).pipe(withParentSpan(span, {
      captureStackTrace: false
    }), matchCauseEffect({
      onSuccess: (response) => {
        span.attribute("http.response.status_code", response.status);
        const redactedHeaders2 = redact(response.headers, redactedHeaderNames);
        for (const name in redactedHeaders2) {
          span.attribute(`http.response.header.${name}`, String(redactedHeaders2[name]));
        }
        if (scopedController) return succeed$1(response);
        responseRegistry.register(response, controller);
        return succeed$1(new InterruptibleResponse(response, controller));
      },
      onFailure(cause) {
        if (!scopedController && hasInterrupts(cause)) {
          controller.abort();
        }
        return failCause(cause);
      }
    })));
  });
})), succeed$1);
const retryTransient = /* @__PURE__ */ dual(2, (self, options) => {
  const isOnlySchedule = isSchedule(options);
  const retryOn = isOnlySchedule ? "errors-and-responses" : options.retryOn ?? "errors-and-responses";
  const schedule = isOnlySchedule ? options : options.schedule;
  const passthroughSchedule = schedule && passthrough$2(schedule);
  const times = isOnlySchedule ? void 0 : options.times;
  return transformResponse(self, flow(retryOn === "errors-only" ? identity : repeat({
    schedule: passthroughSchedule,
    times,
    while: isTransientResponse
  }), retryOn === "response-only" ? identity : retry({
    while: isOnlySchedule || options.while === void 0 ? isTransientError : or(isTransientError, options.while),
    schedule,
    times
  })));
});
const TracerDisabledWhen = /* @__PURE__ */ Reference("effect/http/HttpClient/TracerDisabledWhen", {
  defaultValue: () => constFalse
});
const TracerPropagationEnabled = /* @__PURE__ */ Reference("effect/HttpClient/TracerPropagationEnabled", {
  defaultValue: constTrue
});
const SpanNameGenerator = /* @__PURE__ */ Reference("effect/http/HttpClient/SpanNameGenerator", {
  defaultValue: () => (request) => `http.client ${request.method}`
});
const layerMergedContext = (effect$1) => effect(HttpClient)(contextWith((context2) => map$1(effect$1, (client) => transformResponse(client, updateContext((input) => merge$2(context2, input))))));
const responseRegistry = /* @__PURE__ */ (() => {
  if ("FinalizationRegistry" in globalThis && globalThis.FinalizationRegistry) {
    const registry = /* @__PURE__ */ new FinalizationRegistry((controller) => {
      controller.abort();
    });
    return {
      register(response, controller) {
        registry.register(response, controller, response);
      },
      unregister(response) {
        registry.unregister(response);
      }
    };
  }
  const timers = /* @__PURE__ */ new Map();
  return {
    register(response, controller) {
      timers.set(response, setTimeout(() => controller.abort(), 5e3));
    },
    unregister(response) {
      const timer = timers.get(response);
      if (timer === void 0) return;
      clearTimeout(timer);
      timers.delete(response);
    }
  };
})();
const scopedRequests = /* @__PURE__ */ new WeakMap();
class InterruptibleResponse {
  original;
  controller;
  constructor(original, controller) {
    this.original = original;
    this.controller = controller;
  }
  [TypeId$1] = TypeId$1;
  [TypeId$2] = TypeId$2;
  applyInterrupt(effect2) {
    return suspend$2(() => {
      responseRegistry.unregister(this.original);
      return onInterrupt(effect2, () => sync(() => {
        this.controller.abort();
      }));
    });
  }
  get request() {
    return this.original.request;
  }
  get status() {
    return this.original.status;
  }
  get headers() {
    return this.original.headers;
  }
  get cookies() {
    return this.original.cookies;
  }
  get remoteAddress() {
    return this.original.remoteAddress;
  }
  get formData() {
    return this.applyInterrupt(this.original.formData);
  }
  get text() {
    return this.applyInterrupt(this.original.text);
  }
  get json() {
    return this.applyInterrupt(this.original.json);
  }
  get urlParamsBody() {
    return this.applyInterrupt(this.original.urlParamsBody);
  }
  get arrayBuffer() {
    return this.applyInterrupt(this.original.arrayBuffer);
  }
  get stream() {
    return suspend(() => {
      responseRegistry.unregister(this.original);
      return ensuring(this.original.stream, sync(() => {
        this.controller.abort();
      }));
    });
  }
  toJSON() {
    return this.original.toJSON();
  }
  [NodeInspectSymbol]() {
    return this.original[NodeInspectSymbol]();
  }
  pipe() {
    return pipeArguments(this, arguments);
  }
}
const isTransientError = (error) => isTimeoutError(error) || isTransientHttpError(error);
const isTransientHttpError = (error) => isHttpClientError(error) && (error.reason._tag === "TransportError" || error.reason._tag === "StatusCodeError" && isTransientResponse(error.reason.response));
const isTransientResponse = (response) => response.status === 408 || response.status === 429 || response.status === 500 || response.status === 502 || response.status === 503 || response.status === 504;
const Fetch = /* @__PURE__ */ Reference("effect/http/FetchHttpClient/Fetch", {
  defaultValue: () => globalThis.fetch
});
class RequestInit extends (/* @__PURE__ */ Service()("effect/http/FetchHttpClient/RequestInit")) {
}
const fetch = /* @__PURE__ */ make$4((request, url, signal, fiber) => {
  const fetch2 = fiber.getRef(Fetch);
  const options = fiber.context.mapUnsafe.get(RequestInit.key) ?? {};
  const headers = options.headers ? merge(fromInput$1(options.headers), request.headers) : request.headers;
  const send = (body) => map$1(tryPromise({
    try: () => fetch2(url, {
      ...options,
      method: request.method,
      headers,
      body,
      duplex: request.body._tag === "Stream" ? "half" : void 0,
      signal
    }),
    catch: (cause) => new HttpClientError({
      reason: new TransportError({
        request,
        cause
      })
    })
  }), (response) => fromWeb(request, response));
  switch (request.body._tag) {
    case "Raw":
    case "Uint8Array":
      return send(request.body.body);
    case "FormData":
      return send(request.body.formData);
    case "Stream":
      return flatMap(toReadableStreamEffect(request.body.stream), send);
  }
  return send(void 0);
});
const layer$2 = /* @__PURE__ */ layerMergedContext(/* @__PURE__ */ succeed$1(fetch));
const policy = /* @__PURE__ */ forever$1.pipe(passthrough$2, /* @__PURE__ */ addDelay((error) => {
  if (isHttpClientError(error) && error.reason._tag === "StatusCodeError" && error.reason.response.status === 429) {
    const retryAfter = fromUndefinedOr(error.reason.response.headers["retry-after"]).pipe(flatMap$3(parse), getOrElse$1(() => 5));
    return succeed$1(seconds(retryAfter));
  }
  return succeed$1(seconds(1));
}));
const make$3 = /* @__PURE__ */ fnUntraced(function* (options) {
  const services = yield* context();
  const clock = get(services, Clock);
  const scope = get(services, Scope);
  const runFork2 = runForkWith(services);
  const exportInterval = max(fromInputUnsafe(options.exportInterval), zero);
  let disabledUntil = void 0;
  const client = filterStatusOk(get(services, HttpClient)).pipe(transformResponse(provideService(TracerPropagationEnabled, false)), retryTransient({
    schedule: policy,
    times: 3
  }));
  let headers = fromRecordUnsafe({
    "user-agent": `effect-opentelemetry-${options.label}/0.0.0`
  });
  if (options.headers) {
    headers = merge(fromInput$1(options.headers), headers);
  }
  const request = post(options.url, {
    headers
  });
  let buffer = [];
  const runExport = suspend$2(() => {
    if (disabledUntil !== void 0 && clock.currentTimeMillisUnsafe() < disabledUntil) {
      return void_;
    } else if (disabledUntil !== void 0) {
      disabledUntil = void 0;
    }
    const items = buffer;
    if (options.maxBatchSize !== "disabled") {
      if (buffer.length === 0) {
        return void_;
      }
      buffer = [];
    }
    return client.execute(setBody(request, options.body(items))).pipe(asVoid, withTracerEnabled(false));
  }).pipe(catchCause((cause) => {
    if (disabledUntil !== void 0) return void_;
    disabledUntil = clock.currentTimeMillisUnsafe() + 6e4;
    buffer = [];
    return logDebug("Disabling exporter for 60 seconds", cause);
  }), annotateLogs({
    package: "@effect/opentelemetry",
    module: options.label
  }));
  yield* addFinalizer(scope, runExport.pipe(ignore, interruptible, timeoutOption(options.shutdownTimeout)));
  yield* sleep(exportInterval).pipe(andThen(runExport), forever, forkIn(scope));
  return {
    push(data) {
      if (disabledUntil !== void 0) return;
      buffer.push(data);
      if (options.maxBatchSize !== "disabled" && buffer.length >= options.maxBatchSize) {
        runIn(runFork2(runExport), scope);
      }
    }
  };
});
const make$2 = (options) => {
  const resourceAttributes = options.attributes ? entriesToAttributes(Object.entries(options.attributes)) : [];
  resourceAttributes.push({
    key: "service.name",
    value: {
      stringValue: options.serviceName
    }
  });
  if (options.serviceVersion) {
    resourceAttributes.push({
      key: "service.version",
      value: {
        stringValue: options.serviceVersion
      }
    });
  }
  return {
    attributes: resourceAttributes,
    droppedAttributesCount: 0
  };
};
const fromConfig = /* @__PURE__ */ fnUntraced(function* (options) {
  const attributes = {
    ...yield* schema(UndefinedOr(Record(String$1, String$1)), "OTEL_RESOURCE_ATTRIBUTES"),
    ...options?.attributes
  };
  const serviceName = options?.serviceName ?? attributes["service.name"] ?? (yield* schema(String$1, "OTEL_SERVICE_NAME"));
  delete attributes["service.name"];
  const serviceVersion = options?.serviceVersion ?? attributes["service.version"] ?? (yield* schema(UndefinedOr(String$1), "OTEL_SERVICE_VERSION"));
  delete attributes["service.version"];
  return make$2({
    serviceName,
    serviceVersion,
    attributes
  });
}, orDie);
const serviceNameUnsafe = (resource2) => {
  const serviceNameAttribute = resource2.attributes.find((attr) => attr.key === "service.name");
  if (!serviceNameAttribute || !serviceNameAttribute.value.stringValue) {
    throw new Error("Resource does not contain a service name");
  }
  return serviceNameAttribute.value.stringValue;
};
const entriesToAttributes = (entries) => {
  const attributes = [];
  for (const [key, value] of entries) {
    attributes.push({
      key,
      value: unknownToAttributeValue(value)
    });
  }
  return attributes;
};
const unknownToAttributeValue = (value) => {
  if (Array.isArray(value)) {
    return {
      arrayValue: {
        values: value.map(unknownToAttributeValue)
      }
    };
  }
  switch (typeof value) {
    case "string":
      return {
        stringValue: value
      };
    case "bigint":
      return {
        intValue: Number(value)
      };
    case "number":
      return Number.isInteger(value) ? {
        intValue: value
      } : {
        doubleValue: value
      };
    case "boolean":
      return {
        boolValue: value
      };
    default:
      return {
        stringValue: format(value)
      };
  }
};
class OtlpSerialization extends (/* @__PURE__ */ Service()("effect/observability/OtlpSerialization")) {
}
const layerJson = /* @__PURE__ */ succeed$2(OtlpSerialization, {
  traces: (spans) => jsonUnsafe(spans),
  metrics: (metrics) => jsonUnsafe(metrics),
  logs: (logs) => jsonUnsafe(logs)
});
const make$1 = /* @__PURE__ */ fnUntraced(function* (options) {
  const serialization = yield* OtlpSerialization;
  const otelResource = yield* fromConfig(options.resource);
  const scope = {
    name: serviceNameUnsafe(otelResource)
  };
  const exporter = yield* make$3({
    label: "OtlpLogger",
    url: options.url,
    headers: options.headers,
    maxBatchSize: options.maxBatchSize ?? 1e3,
    exportInterval: options.exportInterval ?? seconds(1),
    body: (data) => serialization.logs({
      resourceLogs: [{
        resource: otelResource,
        scopeLogs: [{
          scope,
          logRecords: data
        }]
      }]
    }),
    shutdownTimeout: options.shutdownTimeout ?? seconds(3)
  });
  const opts = {
    excludeLogSpans: options.excludeLogSpans ?? false,
    clock: yield* Clock
  };
  return make$9((options2) => {
    exporter.push(makeLogRecord(options2, opts));
  });
});
const layer$1 = (options) => layer$3([make$1(options)], {
  mergeWithExisting: options.mergeWithExisting ?? true
});
const makeLogRecord = (options, opts) => {
  const now = opts.clock.currentTimeNanosUnsafe();
  const nanosString = now.toString();
  const nowMillis = options.date.getTime();
  const attributes = entriesToAttributes(Object.entries(options.fiber.getRef(CurrentLogAnnotations)));
  attributes.push({
    key: "fiberId",
    value: {
      intValue: options.fiber.id
    }
  });
  if (!opts.excludeLogSpans) {
    for (const [label, startTime] of options.fiber.getRef(CurrentLogSpans)) {
      attributes.push({
        key: `logSpan.${label}`,
        value: {
          stringValue: `${nowMillis - startTime}ms`
        }
      });
    }
  }
  if (options.cause.reasons.length > 0) {
    attributes.push({
      key: "log.error",
      value: {
        stringValue: pretty(options.cause)
      }
    });
  }
  const message = ensure(options.message);
  const logRecord = {
    severityNumber: logLevelToSeverityNumber(options.logLevel),
    severityText: options.logLevel,
    timeUnixNano: nanosString,
    observedTimeUnixNano: nanosString,
    attributes,
    body: unknownToAttributeValue(message.length === 1 ? message[0] : message),
    droppedAttributesCount: 0
  };
  if (options.fiber.currentSpan) {
    logRecord.traceId = options.fiber.currentSpan.traceId;
    logRecord.spanId = options.fiber.currentSpan.spanId;
  }
  return logRecord;
};
const logLevelToSeverityNumber = (logLevel) => {
  switch (logLevel) {
    case "Trace":
      return ESeverityNumber.SEVERITY_NUMBER_TRACE;
    case "Debug":
      return ESeverityNumber.SEVERITY_NUMBER_DEBUG;
    case "Info":
      return ESeverityNumber.SEVERITY_NUMBER_INFO;
    case "Warn":
      return ESeverityNumber.SEVERITY_NUMBER_WARN;
    case "Error":
      return ESeverityNumber.SEVERITY_NUMBER_ERROR;
    case "Fatal":
      return ESeverityNumber.SEVERITY_NUMBER_FATAL;
    default:
      return ESeverityNumber.SEVERITY_NUMBER_UNSPECIFIED;
  }
};
const ESeverityNumber = {
  /** Unspecified. Do NOT use as default */
  SEVERITY_NUMBER_UNSPECIFIED: 0,
  SEVERITY_NUMBER_TRACE: 1,
  SEVERITY_NUMBER_DEBUG: 5,
  SEVERITY_NUMBER_INFO: 9,
  SEVERITY_NUMBER_WARN: 13,
  SEVERITY_NUMBER_ERROR: 17,
  SEVERITY_NUMBER_FATAL: 21
};
const make = /* @__PURE__ */ fnUntraced(function* (options) {
  const otelResource = yield* fromConfig(options.resource);
  const serialization = yield* OtlpSerialization;
  const scope = {
    name: serviceNameUnsafe(otelResource)
  };
  const exporter = yield* make$3({
    label: "OtlpTracer",
    url: options.url,
    headers: options.headers,
    exportInterval: options.exportInterval ?? seconds(5),
    maxBatchSize: options.maxBatchSize ?? 1e3,
    body(spans) {
      const data = {
        resourceSpans: [{
          resource: otelResource,
          scopeSpans: [{
            scope,
            spans
          }]
        }]
      };
      return serialization.traces(data);
    },
    shutdownTimeout: options.shutdownTimeout ?? seconds(3)
  });
  function exportFn(span) {
    if (!span.sampled) return;
    exporter.push(makeOtlpSpan(span));
  }
  return make$h({
    span(options2) {
      return makeSpan({
        ...options2,
        status: {
          _tag: "Started",
          startTime: options2.startTime
        },
        attributes: /* @__PURE__ */ new Map(),
        export: exportFn
      });
    },
    context: options.context ? function(primitive, fiber) {
      if (fiber.currentSpan === void 0) {
        return primitive["~effect/Effect/evaluate"](fiber);
      }
      return options.context(primitive, fiber.currentSpan);
    } : void 0
  });
});
const layer = /* @__PURE__ */ flow(make, /* @__PURE__ */ effect(Tracer));
const SpanProto = {
  _tag: "Span",
  end(endTime, exit2) {
    this.status = {
      _tag: "Ended",
      startTime: this.status.startTime,
      endTime,
      exit: exit2
    };
    this.export(this);
  },
  attribute(key, value) {
    this.attributes.set(key, value);
  },
  event(name, startTime, attributes) {
    this.events.push([name, startTime, attributes]);
  },
  addLinks(links) {
    this.links.push(...links);
  }
};
const makeSpan = (options) => {
  const self = Object.assign(Object.create(SpanProto), options);
  if (isSome(self.parent)) {
    self.traceId = self.parent.value.traceId;
  } else {
    self.traceId = generateId(32);
  }
  self.spanId = generateId(16);
  self.events = [];
  return self;
};
const generateId = (len) => {
  const chars = "0123456789abcdef";
  let result2 = "";
  for (let i = 0; i < len; i++) {
    result2 += chars[Math.floor(Math.random() * chars.length)];
  }
  return result2;
};
const makeOtlpSpan = (self) => {
  const status = self.status;
  const attributes = entriesToAttributes(self.attributes.entries());
  const events = self.events.map(([name, startTime, attributes2]) => ({
    name,
    timeUnixNano: String(startTime),
    attributes: attributes2 ? entriesToAttributes(Object.entries(attributes2)) : [],
    droppedAttributesCount: 0
  }));
  let otelStatus;
  if (status.exit._tag === "Success") {
    otelStatus = constOtelStatusSuccess;
  } else if (hasInterruptsOnly(status.exit.cause)) {
    otelStatus = {
      code: StatusCode.Ok,
      message: "Interrupted"
    };
    attributes.push({
      key: "span.label",
      value: {
        stringValue: "⚠︎ Interrupted"
      }
    }, {
      key: "status.interrupted",
      value: {
        boolValue: true
      }
    });
  } else {
    const errors = prettyErrors(status.exit.cause);
    otelStatus = {
      code: StatusCode.Error
    };
    if (errors.length > 0) {
      otelStatus.message = errors[0].message;
      for (const error of errors) {
        events.push({
          name: "exception",
          timeUnixNano: String(status.endTime),
          droppedAttributesCount: 0,
          attributes: [{
            "key": "exception.type",
            "value": {
              "stringValue": error.name
            }
          }, {
            "key": "exception.message",
            "value": {
              "stringValue": error.message
            }
          }, {
            "key": "exception.stacktrace",
            "value": {
              "stringValue": error.stack ?? "No stack trace available"
            }
          }]
        });
      }
    }
  }
  return {
    traceId: self.traceId,
    spanId: self.spanId,
    parentSpanId: match$2(self.parent, {
      onNone: () => void 0,
      onSome: (parent) => parent.spanId
    }),
    name: self.name,
    kind: SpanKind[self.kind],
    startTimeUnixNano: String(status.startTime),
    endTimeUnixNano: String(status.endTime),
    attributes,
    droppedAttributesCount: 0,
    events,
    droppedEventsCount: 0,
    status: otelStatus,
    links: self.links.map((link2) => ({
      traceId: link2.span.traceId,
      spanId: link2.span.spanId,
      attributes: entriesToAttributes(Object.entries(link2.attributes)),
      droppedAttributesCount: 0
    })),
    droppedLinksCount: 0
  };
};
const StatusCode = {
  Ok: 1,
  Error: 2
};
const SpanKind = {
  unspecified: 0,
  internal: 1,
  server: 2,
  client: 3,
  producer: 4,
  consumer: 5
};
const constOtelStatusSuccess = {
  code: StatusCode.Ok
};
const observabilityConfig = all({
  endpoint: string("GHUI_OTLP_ENDPOINT").pipe(
    withDefault(""),
    map((value) => value.trim())
  ),
  motelPort: string("GHUI_MOTEL_PORT").pipe(
    withDefault(""),
    map((value) => value.trim())
  )
});
const resource = {
  serviceName: "ghui",
  serviceVersion: "local"
};
const Observability = {
  layer: unwrap(
    gen(function* () {
      const { endpoint, motelPort } = yield* observabilityConfig;
      const baseUrl2 = endpoint || (motelPort ? `http://127.0.0.1:${motelPort}` : null);
      return baseUrl2 === null ? empty$4 : merge$1(
        layer({
          url: `${baseUrl2}/v1/traces`,
          exportInterval: "500 millis",
          shutdownTimeout: "1 second",
          resource
        }),
        layer$1({
          url: `${baseUrl2}/v1/logs`,
          exportInterval: "500 millis",
          shutdownTimeout: "1 second",
          resource
        })
      ).pipe(provide$1(layerJson), provide$1(layer$2));
    })
  )
};
const mergeCachedDetails = (fresh, cached2) => {
  if (!cached2) return fresh;
  const cachedByUrl = new Map(cached2.map((pullRequest) => [pullRequest.url, pullRequest]));
  return fresh.map((pullRequest) => {
    const cachedPullRequest = cachedByUrl.get(pullRequest.url);
    if (!cachedPullRequest?.detailLoaded || cachedPullRequest.headRefOid !== pullRequest.headRefOid) return pullRequest;
    return {
      ...pullRequest,
      body: cachedPullRequest.body,
      labels: cachedPullRequest.labels,
      additions: cachedPullRequest.additions,
      deletions: cachedPullRequest.deletions,
      changedFiles: cachedPullRequest.changedFiles,
      detailLoaded: true
    };
  });
};
class CommandError extends TaggedErrorClass()("CommandError", {
  command: String$1,
  args: ArraySchema(String$1),
  detail: String$1,
  cause: Defect
}) {
}
class RateLimitError extends TaggedErrorClass()("RateLimitError", {
  command: String$1,
  args: ArraySchema(String$1),
  detail: String$1,
  retryAfterSeconds: optionalKey(NullOr(Number$1))
}) {
}
class JsonParseError extends TaggedErrorClass()("JsonParseError", {
  command: String$1,
  args: ArraySchema(String$1),
  stdout: String$1,
  cause: Defect
}) {
}
const RATE_LIMIT_PATTERNS = [/rate limit/i, /API rate limit exceeded/i, /abuse detection/i, /secondary rate limit/i, /retry after/i];
const isRateLimitError = (stderr) => RATE_LIMIT_PATTERNS.some((pattern) => pattern.test(stderr));
const parseRetryAfterSeconds = (stderr) => {
  const match2 = stderr.match(/retry after (\d+)/i);
  return match2 ? Number(match2[1]) : null;
};
class CommandRunner extends Service()("ghui/CommandRunner") {
}
const platformOpener = () => {
  if (process.platform === "darwin") return { command: "open", prefix: [] };
  if (process.platform === "win32") return { command: "cmd", prefix: ["/c", "start", ""] };
  return { command: "xdg-open", prefix: [] };
};
class BrowserOpener extends Service()("ghui/BrowserOpener") {
  static layerNoDeps = effect(
    BrowserOpener,
    gen(function* () {
      const command = yield* CommandRunner;
      const opener = platformOpener();
      const openPullRequest = fn("BrowserOpener.openPullRequest")(function* (pullRequest) {
        yield* command.run("gh", ["pr", "view", String(pullRequest.number), "--repo", pullRequest.repository, "--web"]);
      });
      const openUrl = fn("BrowserOpener.openUrl")(function* (url) {
        yield* command.run(opener.command, [...opener.prefix, url]);
      });
      return BrowserOpener.of({ openPullRequest, openUrl });
    })
  );
}
class CacheError extends TaggedErrorClass()("CacheError", {
  operation: String$1,
  cause: Defect
}) {
}
const CheckConclusionSchema = Literals(checkConclusions);
const CheckRunStatusSchema = Literals(checkRunStatuses);
const CheckRollupStatusSchema = Literals(checkRollupStatuses);
const PullRequestStateSchema = Literals(pullRequestStates);
const ReviewStatusSchema = Literals(reviewStatuses);
const CachedPullRequestLabelSchema = Struct({
  name: String$1,
  color: NullOr(String$1)
});
const CachedCheckItemSchema = Struct({
  name: String$1,
  status: CheckRunStatusSchema,
  conclusion: NullOr(CheckConclusionSchema)
});
const CachedMergeableSchema = Literals(["mergeable", "conflicting", "unknown"]);
const CachedAssigneeSchema = Struct({ login: String$1 });
const CachedReviewRequestSchema = Struct({
  type: Literals(["user", "team"]),
  name: String$1
});
const CachedPullRequestItemSchema = Struct({
  repository: String$1,
  author: String$1,
  headRefOid: String$1,
  headRefName: optionalKey(String$1),
  number: Number$1,
  title: String$1,
  body: String$1,
  labels: ArraySchema(CachedPullRequestLabelSchema),
  additions: Number$1,
  deletions: Number$1,
  changedFiles: Number$1,
  state: PullRequestStateSchema,
  reviewStatus: ReviewStatusSchema,
  checkStatus: CheckRollupStatusSchema,
  checkSummary: NullOr(String$1),
  checks: ArraySchema(CachedCheckItemSchema),
  autoMergeEnabled: Boolean2,
  detailLoaded: Boolean2,
  createdAt: String$1,
  closedAt: NullOr(String$1),
  url: String$1,
  updatedAt: optionalKey(String$1),
  totalCommentsCount: optionalKey(Number$1),
  mergeable: optionalKey(NullOr(CachedMergeableSchema)),
  assignees: optionalKey(ArraySchema(CachedAssigneeSchema)),
  reviewRequests: optionalKey(ArraySchema(CachedReviewRequestSchema))
});
const CachedPullRequestViewSchema = Union2([
  Struct({ _tag: tag("Queue"), mode: Literals(pullRequestQueueModes), repository: NullOr(String$1) }),
  Struct({ _tag: tag("Repository"), repository: String$1 })
]);
const pullRequestCacheKey = ({ repository, number: number2 }) => `${repository}#${number2}`;
const parseDate = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};
const parseJson = (operation, json) => try_({
  try: () => JSON.parse(json),
  catch: (cause) => new CacheError({ operation, cause })
});
const decodeCached = (operation, schema2, value) => decodeUnknownEffect(schema2)(value).pipe(mapError((cause) => new CacheError({ operation, cause })));
const toCacheError = (operation, cause) => cause instanceof CacheError ? cause : new CacheError({ operation, cause });
const cachedPullRequestToDomain = (cached2) => {
  const createdAt = parseDate(cached2.createdAt);
  if (!createdAt) return null;
  const closedAt = cached2.closedAt === null ? null : parseDate(cached2.closedAt);
  if (cached2.closedAt !== null && !closedAt) return null;
  const updatedAt = cached2.updatedAt ? parseDate(cached2.updatedAt) ?? createdAt : createdAt;
  return {
    repository: cached2.repository,
    author: cached2.author,
    headRefOid: cached2.headRefOid,
    headRefName: cached2.headRefName ?? "",
    number: cached2.number,
    title: cached2.title,
    body: cached2.body,
    labels: cached2.labels,
    additions: cached2.additions,
    deletions: cached2.deletions,
    changedFiles: cached2.changedFiles,
    state: cached2.state,
    reviewStatus: cached2.reviewStatus,
    checkStatus: cached2.checkStatus,
    checkSummary: cached2.checkSummary,
    checks: cached2.checks,
    autoMergeEnabled: cached2.autoMergeEnabled,
    detailLoaded: cached2.detailLoaded,
    createdAt,
    updatedAt,
    closedAt,
    url: cached2.url,
    totalCommentsCount: cached2.totalCommentsCount ?? 0,
    mergeable: cached2.mergeable ?? null,
    assignees: cached2.assignees ? [...cached2.assignees] : [],
    reviewRequests: cached2.reviewRequests ? [...cached2.reviewRequests] : []
  };
};
const encodePullRequest = (pullRequest) => ({
  repository: pullRequest.repository,
  author: pullRequest.author,
  headRefOid: pullRequest.headRefOid,
  headRefName: pullRequest.headRefName,
  number: pullRequest.number,
  title: pullRequest.title,
  body: pullRequest.body,
  labels: pullRequest.labels,
  additions: pullRequest.additions,
  deletions: pullRequest.deletions,
  changedFiles: pullRequest.changedFiles,
  state: pullRequest.state,
  reviewStatus: pullRequest.reviewStatus,
  checkStatus: pullRequest.checkStatus,
  checkSummary: pullRequest.checkSummary,
  checks: pullRequest.checks,
  autoMergeEnabled: pullRequest.autoMergeEnabled,
  detailLoaded: pullRequest.detailLoaded,
  createdAt: pullRequest.createdAt.toISOString(),
  updatedAt: pullRequest.updatedAt.toISOString(),
  closedAt: pullRequest.closedAt?.toISOString() ?? null,
  url: pullRequest.url,
  totalCommentsCount: pullRequest.totalCommentsCount,
  mergeable: pullRequest.mergeable,
  assignees: [...pullRequest.assignees],
  reviewRequests: [...pullRequest.reviewRequests]
});
const decodePullRequestJson = (json) => gen(function* () {
  const value = yield* parseJson("decodePullRequest", json);
  const cached2 = yield* decodeCached("decodePullRequest", CachedPullRequestItemSchema, value);
  const pullRequest = cachedPullRequestToDomain(cached2);
  if (!pullRequest) return yield* new CacheError({ operation: "decodePullRequest", cause: "invalid cached date" });
  return pullRequest;
});
const decodePullRequestViewJson = (json) => gen(function* () {
  const value = yield* parseJson("decodePullRequestView", json);
  const view = yield* decodeCached("decodePullRequestView", CachedPullRequestViewSchema, value);
  return view;
});
const decodeStringArrayJson = (json) => gen(function* () {
  const value = yield* parseJson("decodeQueueKeys", json);
  return yield* decodeCached("decodeQueueKeys", ArraySchema(String$1), value);
});
const dateFromCache = (operation, value) => {
  const date = parseDate(value);
  return date ? succeed$1(date) : fail$3(new CacheError({ operation, cause: `Invalid cached date: ${value}` }));
};
gen(function* () {
  const sql = yield* SqlClient;
  yield* sql`PRAGMA synchronous = NORMAL`;
  yield* sql`PRAGMA busy_timeout = 5000`;
  yield* sql`PRAGMA foreign_keys = ON`;
  yield* sql`PRAGMA temp_store = MEMORY`;
  yield* sql`PRAGMA journal_size_limit = 16777216`;
});
({
  "001_initial_cache_schema": gen(function* () {
    const sql = yield* SqlClient;
    yield* sql`CREATE TABLE IF NOT EXISTS pull_requests (
			pr_key TEXT PRIMARY KEY,
			repository TEXT NOT NULL,
			number INTEGER NOT NULL,
			url TEXT NOT NULL,
			head_ref_oid TEXT NOT NULL,
			state TEXT NOT NULL,
			detail_loaded INTEGER NOT NULL,
			data_json TEXT NOT NULL,
			updated_at TEXT NOT NULL
		)`;
    yield* sql`CREATE INDEX IF NOT EXISTS pull_requests_repository_number_idx ON pull_requests (repository, number)`;
    yield* sql`CREATE TABLE IF NOT EXISTS queue_snapshots (
			viewer TEXT NOT NULL,
			view_key TEXT NOT NULL,
			view_json TEXT NOT NULL,
			pr_keys_json TEXT NOT NULL,
			fetched_at TEXT NOT NULL,
			end_cursor TEXT,
			has_next_page INTEGER NOT NULL,
			PRIMARY KEY (viewer, view_key)
		)`;
  })
});
const pullRequestRow = (pullRequest, updatedAt = (/* @__PURE__ */ new Date()).toISOString()) => ({
  pr_key: pullRequestCacheKey(pullRequest),
  repository: pullRequest.repository,
  number: pullRequest.number,
  url: pullRequest.url,
  head_ref_oid: pullRequest.headRefOid,
  state: pullRequest.state,
  detail_loaded: pullRequest.detailLoaded ? 1 : 0,
  data_json: JSON.stringify(encodePullRequest(pullRequest)),
  updated_at: updatedAt
});
const upsertPullRequestRowsSql = (sql, pullRequests) => {
  if (pullRequests.length === 0) return void_;
  const updatedAt = (/* @__PURE__ */ new Date()).toISOString();
  const rows = pullRequests.map((pullRequest) => pullRequestRow(pullRequest, updatedAt));
  return sql`INSERT INTO pull_requests ${sql.insert(rows)}
		ON CONFLICT(pr_key) DO UPDATE SET
			repository = excluded.repository,
			number = excluded.number,
			url = excluded.url,
			head_ref_oid = excluded.head_ref_oid,
			state = excluded.state,
			detail_loaded = excluded.detail_loaded,
			data_json = excluded.data_json,
			updated_at = excluded.updated_at`.pipe(asVoid);
};
const upsertPullRequestSql = (sql, pullRequest) => upsertPullRequestRowsSql(sql, [pullRequest]);
const readPullRequestSql = (sql, key) => gen(function* () {
  const rows = yield* sql`SELECT pr_key, data_json FROM pull_requests WHERE pr_key = ${pullRequestCacheKey(key)} LIMIT 1`;
  const row = rows[0];
  if (!row) return null;
  return yield* decodePullRequestJson(row.data_json);
});
const pruneSql = (sql) => {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1e3).toISOString();
  return gen(function* () {
    yield* sql`DELETE FROM queue_snapshots WHERE fetched_at < ${cutoff}`;
    yield* sql`DELETE FROM pull_requests
			WHERE updated_at < ${cutoff}
			AND pr_key NOT IN (
				SELECT value FROM queue_snapshots, json_each(queue_snapshots.pr_keys_json)
			)`;
  }).pipe(catch_(() => void_));
};
const liveCacheService = (sql) => {
  const readQueue = (viewer, view) => gen(function* () {
    const rows = yield* sql`SELECT view_json, pr_keys_json, fetched_at, end_cursor, has_next_page FROM queue_snapshots WHERE viewer = ${viewer} AND view_key = ${viewCacheKey(view)} LIMIT 1`;
    const snapshot = rows[0];
    if (!snapshot) return null;
    const [cachedView, prKeys, fetchedAt] = yield* all$1([
      decodePullRequestViewJson(snapshot.view_json),
      decodeStringArrayJson(snapshot.pr_keys_json),
      dateFromCache("decodeQueue", snapshot.fetched_at)
    ]);
    if (viewCacheKey(cachedView) !== viewCacheKey(view)) return null;
    if (prKeys.length === 0) {
      return {
        view,
        data: [],
        fetchedAt,
        endCursor: snapshot.end_cursor,
        hasNextPage: snapshot.has_next_page === 1
      };
    }
    const prRows = yield* sql`SELECT pr_key, data_json FROM pull_requests WHERE pr_key IN ${sql.in(prKeys)}`;
    const byKey = /* @__PURE__ */ new Map();
    for (const row of prRows) {
      const decoded = yield* decodePullRequestJson(row.data_json).pipe(catch_(() => succeed$1(null)));
      if (decoded) byKey.set(row.pr_key, decoded);
    }
    const data = prKeys.flatMap((key) => {
      const pullRequest = byKey.get(key);
      return pullRequest ? [pullRequest] : [];
    });
    return {
      view,
      data,
      fetchedAt,
      endCursor: snapshot.end_cursor,
      hasNextPage: snapshot.has_next_page === 1
    };
  }).pipe(mapError((cause) => toCacheError("readQueue", cause)));
  const writeQueue = fn("CacheService.writeQueue")(function* (viewer, load) {
    const fetchedAt = load.fetchedAt ?? /* @__PURE__ */ new Date();
    const write = gen(function* () {
      if (load.data.length > 0) {
        const keys2 = load.data.map(pullRequestCacheKey);
        const existingRows = yield* sql`SELECT pr_key, data_json FROM pull_requests WHERE pr_key IN ${sql.in(keys2)}`;
        const existing = [];
        for (const row of existingRows) {
          const decoded = yield* decodePullRequestJson(row.data_json).pipe(catch_(() => succeed$1(null)));
          if (decoded) existing.push(decoded);
        }
        yield* upsertPullRequestRowsSql(sql, mergeCachedDetails(load.data, existing));
      }
      const snapshot = {
        viewer,
        view_key: viewCacheKey(load.view),
        view_json: JSON.stringify(load.view),
        pr_keys_json: JSON.stringify(load.data.map(pullRequestCacheKey)),
        fetched_at: fetchedAt.toISOString(),
        end_cursor: load.endCursor,
        has_next_page: load.hasNextPage ? 1 : 0
      };
      yield* sql`INSERT INTO queue_snapshots ${sql.insert(snapshot)}
				ON CONFLICT(viewer, view_key) DO UPDATE SET
					view_json = excluded.view_json,
					pr_keys_json = excluded.pr_keys_json,
					fetched_at = excluded.fetched_at,
					end_cursor = excluded.end_cursor,
					has_next_page = excluded.has_next_page`;
    });
    const wrote = yield* sql.withTransaction(write).pipe(
      as(true),
      catch_(() => succeed$1(false))
    );
    if (wrote) yield* pruneSql(sql);
  });
  const readPullRequest = (key) => readPullRequestSql(sql, key).pipe(mapError((cause) => toCacheError("readPullRequest", cause)));
  const upsertPullRequest = fn("CacheService.upsertPullRequest")(function* (pullRequest) {
    yield* upsertPullRequestSql(sql, pullRequest).pipe(catch_(() => void_));
  });
  const prune = fn("CacheService.prune")(function* () {
    yield* pruneSql(sql);
  });
  return { readQueue, writeQueue, readPullRequest, upsertPullRequest, prune };
};
class CacheService extends Service()("ghui/CacheService") {
  static disabledLayer = succeed$2(
    CacheService,
    CacheService.of({
      readQueue: () => succeed$1(null),
      writeQueue: () => void_,
      readPullRequest: () => succeed$1(null),
      upsertPullRequest: () => void_,
      prune: () => void_
    })
  );
  static layerSqlite = effect(
    CacheService,
    gen(function* () {
      const sql = yield* SqlClient;
      return CacheService.of(liveCacheService(sql));
    })
  );
}
class ClipboardError extends TaggedErrorClass()("ClipboardError", {
  detail: String$1
}) {
}
class Clipboard extends Service()("ghui/Clipboard") {
  static layerNoDeps = effect(
    Clipboard,
    gen(function* () {
      const command = yield* CommandRunner;
      const clipboardCommands = process.platform === "darwin" ? [["pbcopy"]] : process.platform === "linux" ? [...process.env.WAYLAND_DISPLAY ? [["wl-copy"]] : [], ["xclip", "-selection", "clipboard"], ["xsel", "--clipboard", "--input"]] : [];
      const installHint = process.platform === "linux" ? " Install wl-clipboard, xclip, or xsel." : "";
      const unavailableDetail = `Clipboard is not available.${installHint}`;
      const copy = fn("Clipboard.copy")(function* (text2) {
        if (clipboardCommands.length === 0) {
          return yield* new ClipboardError({ detail: unavailableDetail });
        }
        let lastDetail = "";
        for (const [cmd, ...args2] of clipboardCommands) {
          const result$12 = yield* command.run(cmd, args2, { stdin: text2 }).pipe(result);
          if (result$12._tag === "Success") return;
          lastDetail = result$12.failure.detail;
        }
        return yield* new ClipboardError({ detail: lastDetail || unavailableDetail });
      });
      return Clipboard.of({ copy });
    })
  );
}
const readStream = async (stream) => {
  if (!stream) return "";
  return Bun.readableStreamToText(stream);
};
({
  layer: effect(
    CommandRunner,
    gen(function* () {
      const runProcess = fn("CommandRunner.runProcess")(
        (command, args2, stdin) => tryPromise({
          async try() {
            const proc = Bun.spawn({
              cmd: [command, ...args2],
              stdin: stdin === void 0 ? "ignore" : "pipe",
              stdout: "pipe",
              stderr: "pipe"
            });
            if (stdin !== void 0 && proc.stdin) {
              proc.stdin.write(stdin);
              proc.stdin.end();
            }
            const [exitCode, stdout, stderr] = await Promise.all([proc.exited, readStream(proc.stdout), readStream(proc.stderr)]);
            return { stdout, stderr, exitCode };
          },
          catch: (cause) => new CommandError({ command, args: [...args2], detail: `Failed to run ${command}`, cause })
        })
      );
      const run2 = fn("CommandRunner.run")(function* (command, args2, options) {
        const result2 = yield* runProcess(command, args2, options?.stdin).pipe(
          withSpan("ghui.command.runProcess", {
            attributes: {
              "process.command": command,
              "process.argv.count": args2.length
            }
          })
        );
        if (result2.exitCode !== 0) {
          const detail = result2.stderr.trim() || result2.stdout.trim() || `exit code ${result2.exitCode}`;
          if (isRateLimitError(detail)) {
            return yield* new RateLimitError({ command, args: [...args2], detail, retryAfterSeconds: parseRetryAfterSeconds(detail) });
          }
          return yield* new CommandError({ command, args: [...args2], detail, cause: detail });
        }
        return result2;
      });
      const runJson = fn("CommandRunner.runJson")(function* (command, args2) {
        const result2 = yield* run2(command, args2);
        return yield* try_({
          try: () => JSON.parse(result2.stdout),
          catch: (cause) => new JsonParseError({ command, args: [...args2], stdout: result2.stdout, cause })
        });
      });
      const runSchema = fn("CommandRunner.runSchema")(function* (schema2, command, args2) {
        const value = yield* runJson(command, args2);
        return yield* decodeUnknownEffect(schema2)(value);
      });
      return CommandRunner.of({ run: run2, runSchema });
    })
  )
});
const inboxUpdatedSinceCutoff = (window) => {
  if (window === "any") return null;
  const now = /* @__PURE__ */ new Date();
  if (window === "1m") return new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()).toISOString().slice(0, 10);
  if (window === "3m") return new Date(now.getFullYear(), now.getMonth() - 3, now.getDate()).toISOString().slice(0, 10);
  return new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()).toISOString().slice(0, 10);
};
const NullableString = NullOr(String$1);
const OptionalNullableString = optionalKey(NullableString);
const OptionalNullableNumber = optionalKey(NullOr(Number$1));
const RawCheckContextSchema = Union2([
  Struct({
    __typename: tag("CheckRun"),
    name: OptionalNullableString,
    status: OptionalNullableString,
    conclusion: OptionalNullableString
  }),
  Struct({
    __typename: tag("StatusContext"),
    context: OptionalNullableString,
    state: OptionalNullableString
  })
]).pipe(toTaggedUnion("__typename"));
const RawAuthorSchema = Struct({ login: String$1 });
const RawRepositorySchema = Struct({ nameWithOwner: String$1 });
const RawLabelSchema = Struct({
  name: String$1,
  color: OptionalNullableString
});
const RawStatusCheckRollupSchema = Struct({
  contexts: Struct({ nodes: ArraySchema(RawCheckContextSchema) })
});
const RawReviewRequestNodeSchema = Struct({
  requestedReviewer: NullOr(
    Union2([Struct({ __typename: tag("User"), login: String$1 }), Struct({ __typename: tag("Team"), slug: String$1 })]).pipe(
      toTaggedUnion("__typename")
    )
  )
});
const RawPullRequestSummaryFields = {
  number: Number$1,
  title: String$1,
  isDraft: Boolean2,
  reviewDecision: NullableString,
  autoMergeRequest: NullOr(Unknown2),
  state: String$1,
  merged: Boolean2,
  createdAt: String$1,
  updatedAt: String$1,
  closedAt: OptionalNullableString,
  url: String$1,
  author: RawAuthorSchema,
  headRefOid: String$1,
  headRefName: String$1,
  repository: RawRepositorySchema,
  totalCommentsCount: Number$1,
  mergeable: NullableString,
  assignees: Struct({ nodes: ArraySchema(Struct({ login: String$1 })) }),
  reviewRequests: Struct({ nodes: ArraySchema(RawReviewRequestNodeSchema) })
};
const RawPullRequestSummaryNodeSchema = Struct({
  ...RawPullRequestSummaryFields,
  statusCheckRollup: optionalKey(NullOr(RawStatusCheckRollupSchema))
});
const RawPullRequestNodeSchema = Struct({
  ...RawPullRequestSummaryFields,
  body: String$1,
  labels: Struct({ nodes: ArraySchema(RawLabelSchema) }),
  additions: Number$1,
  deletions: Number$1,
  changedFiles: Number$1,
  statusCheckRollup: optionalKey(NullOr(RawStatusCheckRollupSchema))
});
const PullRequestDetailResponseSchema = Struct({
  data: Struct({
    repository: NullOr(
      Struct({
        pullRequest: NullOr(RawPullRequestNodeSchema)
      })
    )
  })
});
const PageInfoSchema = Struct({
  hasNextPage: Boolean2,
  endCursor: NullableString
});
const SearchResponseSchema = (item) => Struct({
  data: Struct({
    search: Struct({
      nodes: ArraySchema(NullOr(item)),
      pageInfo: PageInfoSchema
    })
  })
});
const RepositoryPullRequestsResponseSchema = Struct({
  data: Struct({
    repository: NullOr(
      Struct({
        pullRequests: Struct({
          nodes: ArraySchema(NullOr(RawPullRequestSummaryNodeSchema)),
          pageInfo: PageInfoSchema
        })
      })
    )
  })
});
const ViewerSchema = Struct({ login: String$1 });
const RepositoryMergeMethodsResponseSchema = Struct({
  squashMergeAllowed: Boolean2,
  mergeCommitAllowed: Boolean2,
  rebaseMergeAllowed: Boolean2
});
const MergeInfoResponseSchema = Struct({
  number: Number$1,
  title: String$1,
  state: String$1,
  isDraft: Boolean2,
  mergeable: String$1,
  reviewDecision: NullableString,
  autoMergeRequest: NullOr(Unknown2),
  statusCheckRollup: ArraySchema(RawCheckContextSchema)
});
const PullRequestAdminMergeResponseSchema = Struct({
  data: Struct({
    repository: Struct({
      pullRequest: NullOr(Struct({ viewerCanMergeAsAdmin: Boolean2 }))
    })
  })
});
const PullRequestCommentSchema = Struct({
  id: optionalKey(NullOr(Union2([Number$1, String$1]))),
  node_id: OptionalNullableString,
  body: OptionalNullableString,
  html_url: OptionalNullableString,
  url: OptionalNullableString,
  created_at: OptionalNullableString,
  user: optionalKey(
    NullOr(
      Struct({
        login: OptionalNullableString
      })
    )
  ),
  path: OptionalNullableString,
  line: OptionalNullableNumber,
  original_line: OptionalNullableNumber,
  side: optionalKey(NullOr(DiffCommentSide)),
  in_reply_to_id: optionalKey(NullOr(Union2([Number$1, String$1])))
});
const PullRequestFileSchema = Struct({
  filename: String$1,
  previous_filename: OptionalNullableString,
  status: OptionalNullableString,
  patch: OptionalNullableString
});
const CommentsResponseSchema = Union2([ArraySchema(PullRequestCommentSchema), ArraySchema(ArraySchema(PullRequestCommentSchema))]);
const PullRequestFilesResponseSchema = Union2([ArraySchema(PullRequestFileSchema), ArraySchema(ArraySchema(PullRequestFileSchema))]);
const RepoLabelsResponseSchema = ArraySchema(
  Struct({
    name: String$1,
    color: String$1
  })
);
const STATUS_CHECK_FRAGMENT = `
        statusCheckRollup {
          contexts(first: 100) {
            nodes {
              __typename
              ... on CheckRun { name status conclusion }
              ... on StatusContext { context state }
            }
          }
        }`;
const SUMMARY_FIELDS_FRAGMENT = `
        number
        title
        isDraft
        reviewDecision
        autoMergeRequest { enabledAt }
        state
        merged
        createdAt
        closedAt
        url
        author { login }
        headRefOid
        headRefName
        repository { nameWithOwner }
        totalCommentsCount
        mergeable
        updatedAt
        assignees(first: 10) { nodes { login } }
        reviewRequests(first: 10) { nodes { requestedReviewer { __typename ... on User { login } ... on Team { slug } } } }${STATUS_CHECK_FRAGMENT}`;
const DETAIL_FIELDS_FRAGMENT = `
        number
        title
        body
        isDraft
        reviewDecision
        autoMergeRequest { enabledAt }
        additions
        deletions
        changedFiles
        state
        merged
        createdAt
        closedAt
        url
        author { login }
        headRefOid
        headRefName
        repository { nameWithOwner }
        labels(first: 20) { nodes { name color } }
        totalCommentsCount
        mergeable
        updatedAt
        assignees(first: 10) { nodes { login } }
        reviewRequests(first: 10) { nodes { requestedReviewer { __typename ... on User { login } ... on Team { slug } } } }${STATUS_CHECK_FRAGMENT}`;
const pullRequestSearchQuery = `
query PullRequests($searchQuery: String!, $first: Int!, $after: String) {
  search(query: $searchQuery, type: ISSUE, first: $first, after: $after) {
    nodes {
      ... on PullRequest {${DETAIL_FIELDS_FRAGMENT}
      }
    }
    pageInfo { hasNextPage endCursor }
  }
}
`;
const pullRequestDetailQuery = `
query PullRequest($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $number) {${DETAIL_FIELDS_FRAGMENT}
    }
  }
}
`;
const pullRequestSummarySearchQuery = `
query PullRequests($searchQuery: String!, $first: Int!, $after: String) {
  search(query: $searchQuery, type: ISSUE, first: $first, after: $after) {
    nodes {
      ... on PullRequest {${SUMMARY_FIELDS_FRAGMENT}
      }
    }
    pageInfo { hasNextPage endCursor }
  }
}
`;
const repositoryPullRequestsQuery = `
query RepositoryPullRequests($owner: String!, $name: String!, $first: Int!, $after: String) {
  repository(owner: $owner, name: $name) {
    pullRequests(states: OPEN, first: $first, after: $after, orderBy: { field: UPDATED_AT, direction: DESC }) {
      nodes {${SUMMARY_FIELDS_FRAGMENT}
      }
      pageInfo { hasNextPage endCursor }
    }
  }
}
`;
const InboxSearchConnectionSchema = Struct({
  nodes: ArraySchema(NullOr(RawPullRequestSummaryNodeSchema)),
  pageInfo: PageInfoSchema
});
const InboxResponseSchema = Struct({
  data: Struct({
    reviewSearch: InboxSearchConnectionSchema,
    draftsSearch: InboxSearchConnectionSchema,
    actionSearch: InboxSearchConnectionSchema,
    authoredSearch: InboxSearchConnectionSchema
  })
});
const inboxPullRequestsQuery = `
query InboxPullRequests($reviewQuery: String!, $draftsQuery: String!, $actionQuery: String!, $authoredQuery: String!, $first: Int!) {
  reviewSearch: search(query: $reviewQuery, type: ISSUE, first: $first) {
    nodes {
      ... on PullRequest {${SUMMARY_FIELDS_FRAGMENT}
      }
    }
    pageInfo { hasNextPage endCursor }
  }
  draftsSearch: search(query: $draftsQuery, type: ISSUE, first: $first) {
    nodes {
      ... on PullRequest {${SUMMARY_FIELDS_FRAGMENT}
      }
    }
    pageInfo { hasNextPage endCursor }
  }
  actionSearch: search(query: $actionQuery, type: ISSUE, first: $first) {
    nodes {
      ... on PullRequest {${SUMMARY_FIELDS_FRAGMENT}
      }
    }
    pageInfo { hasNextPage endCursor }
  }
  authoredSearch: search(query: $authoredQuery, type: ISSUE, first: $first) {
    nodes {
      ... on PullRequest {${SUMMARY_FIELDS_FRAGMENT}
      }
    }
    pageInfo { hasNextPage endCursor }
  }
}
`;
const normalizeDate = (value) => {
  if (!value || value.startsWith("0001-01-01")) return null;
  return new Date(value);
};
const getPullRequestState = (item) => item.merged ? "merged" : item.state.toLowerCase() === "open" ? "open" : "closed";
const REVIEW_STATUS_BY_DECISION = {
  APPROVED: "approved",
  CHANGES_REQUESTED: "changes",
  REVIEW_REQUIRED: "review"
};
const getReviewStatus = (item) => {
  if (item.isDraft) return "draft";
  if (item.reviewDecision) return REVIEW_STATUS_BY_DECISION[item.reviewDecision] ?? "none";
  return "none";
};
const CHECK_STATUS_BY_RAW = {
  COMPLETED: "completed",
  IN_PROGRESS: "in_progress",
  QUEUED: "queued"
};
const CHECK_CONCLUSION_BY_RAW = {
  SUCCESS: "success",
  FAILURE: "failure",
  ERROR: "failure",
  NEUTRAL: "neutral",
  SKIPPED: "skipped",
  CANCELLED: "cancelled",
  TIMED_OUT: "timed_out"
};
const normalizeCheckStatus = (raw) => raw ? CHECK_STATUS_BY_RAW[raw] ?? "pending" : "pending";
const normalizeCheckConclusion = (raw) => raw ? CHECK_CONCLUSION_BY_RAW[raw] ?? null : null;
const getContextStatus = (context2) => RawCheckContextSchema.match(context2, {
  CheckRun: (run2) => normalizeCheckStatus(run2.status),
  StatusContext: (status) => status.state === "PENDING" ? "in_progress" : "completed"
});
const STATUS_CONTEXT_CONCLUSION = {
  SUCCESS: "success",
  FAILURE: "failure",
  ERROR: "failure"
};
const getContextConclusion = (context2) => RawCheckContextSchema.match(context2, {
  CheckRun: (run2) => normalizeCheckConclusion(run2.conclusion),
  StatusContext: (status) => (status.state ? STATUS_CONTEXT_CONCLUSION[status.state] : null) ?? null
});
const STATUS_CHECKS_LIMIT = 100;
const getCheckInfoFromContexts = (contexts) => {
  const checksLimitHit = contexts.length >= STATUS_CHECKS_LIMIT;
  if (contexts.length === 0) {
    return { checkStatus: "none", checkSummary: null, checks: [], checksLimitHit: false };
  }
  let completed = 0;
  let successful = 0;
  let pending = false;
  let failing = false;
  const checks = [];
  for (const check of contexts) {
    const name = check.__typename === "CheckRun" ? check.name ?? "check" : check.context ?? "check";
    const status = getContextStatus(check);
    const conclusion = getContextConclusion(check);
    checks.push({ name, status, conclusion });
    if (status === "completed") {
      completed += 1;
    } else {
      pending = true;
    }
    if (conclusion === "success" || conclusion === "neutral" || conclusion === "skipped") {
      successful += 1;
    } else if (conclusion) {
      failing = true;
    }
  }
  if (pending) {
    return { checkStatus: "pending", checkSummary: `checks ${completed}/${contexts.length}${checksLimitHit ? "+" : ""}`, checks, checksLimitHit };
  }
  if (failing) {
    return { checkStatus: "failing", checkSummary: `checks ${successful}/${contexts.length}${checksLimitHit ? "+" : ""}`, checks, checksLimitHit };
  }
  return { checkStatus: "passing", checkSummary: `checks ${successful}/${contexts.length}${checksLimitHit ? "+" : ""}`, checks, checksLimitHit };
};
const parsePullRequestSummary = (item) => {
  const checkInfo = getCheckInfoFromContexts(item.statusCheckRollup?.contexts.nodes ?? []);
  return {
    repository: item.repository.nameWithOwner,
    author: item.author.login,
    headRefOid: item.headRefOid,
    headRefName: item.headRefName,
    number: item.number,
    title: item.title,
    body: "",
    labels: [],
    additions: 0,
    deletions: 0,
    changedFiles: 0,
    state: getPullRequestState(item),
    reviewStatus: getReviewStatus(item),
    checkStatus: checkInfo.checkStatus,
    checkSummary: checkInfo.checkSummary,
    checks: checkInfo.checks,
    autoMergeEnabled: item.autoMergeRequest !== null,
    detailLoaded: false,
    createdAt: new Date(item.createdAt),
    updatedAt: new Date(item.updatedAt),
    closedAt: normalizeDate(item.closedAt),
    url: item.url,
    totalCommentsCount: item.totalCommentsCount,
    mergeable: item.mergeable ? normalizeMergeable(item.mergeable) : null,
    assignees: item.assignees.nodes.map((a) => ({ login: a.login })),
    reviewRequests: item.reviewRequests.nodes.flatMap((n) => {
      const rv = n.requestedReviewer;
      if (!rv) return [];
      if (rv.__typename === "User") return [{ type: "user", name: rv.login }];
      return [{ type: "team", name: rv.slug }];
    })
  };
};
const parsePullRequest = (item) => {
  const checkInfo = getCheckInfoFromContexts(item.statusCheckRollup?.contexts.nodes ?? []);
  return {
    ...parsePullRequestSummary(item),
    body: item.body,
    labels: item.labels.nodes.map((label) => ({
      name: label.name,
      color: label.color ? `#${label.color}` : null
    })),
    additions: item.additions,
    deletions: item.deletions,
    changedFiles: item.changedFiles,
    checkStatus: checkInfo.checkStatus,
    checkSummary: checkInfo.checkSummary,
    checks: checkInfo.checks,
    detailLoaded: true
  };
};
const searchQuery = (mode, repository) => {
  const sort = mode === "repository" ? "sort:updated-desc" : "sort:created-desc";
  return `${pullRequestQueueSearchQualifier(mode, repository)} is:pr is:open ${sort}`;
};
const pullRequestPage = (connection, parse2) => ({
  items: connection.nodes.flatMap((node) => node ? [parse2(node)] : []),
  endCursor: connection.pageInfo.endCursor,
  hasNextPage: connection.pageInfo.hasNextPage && connection.pageInfo.endCursor !== null
});
const repositoryParts = (repository) => {
  const [owner, name] = repository.split("/");
  return owner && name ? { owner, name } : null;
};
const restCommentId = (comment) => {
  if (typeof comment.id === "number") return String(comment.id);
  if (typeof comment.id === "string" && /^\d+$/.test(comment.id)) return comment.id;
  const fromApiUrl = comment.url?.match(/\/comments\/(\d+)/)?.[1];
  if (fromApiUrl) return fromApiUrl;
  const fromHtmlUrl = comment.html_url?.match(/#(?:discussion_r|issuecomment-)(\d+)/)?.[1];
  if (fromHtmlUrl) return fromHtmlUrl;
  return null;
};
const rawCommentFields = (comment, fallbackId) => ({
  id: restCommentId(comment) ?? comment.node_id ?? fallbackId,
  author: comment.user?.login ?? "unknown",
  body: comment.body ?? "",
  createdAt: comment.created_at ? new Date(comment.created_at) : null,
  url: comment.html_url ?? comment.url ?? null
});
const parsePullRequestComment = (comment) => {
  const line = comment.line ?? comment.original_line;
  if (!comment.path || !line || comment.side !== "LEFT" && comment.side !== "RIGHT") return null;
  const inReplyTo = comment.in_reply_to_id != null ? String(comment.in_reply_to_id) : null;
  return {
    ...rawCommentFields(comment, `${comment.path}:${comment.side}:${line}:${comment.created_at ?? ""}:${comment.body ?? ""}`),
    path: comment.path,
    line,
    side: comment.side,
    inReplyTo
  };
};
const parsePullRequestComments = (response) => {
  return flattenSlurpedPages(response).flatMap((comment) => {
    const parsed = parsePullRequestComment(comment);
    return parsed ? [parsed] : [];
  });
};
const parseIssueComment = (comment) => ({
  _tag: "comment",
  ...rawCommentFields(comment, `${comment.created_at ?? ""}:${comment.body ?? ""}`)
});
const reviewCommentAsComment = (comment) => ({
  _tag: "review-comment",
  ...comment
});
const commentTime = (item) => item.createdAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
const sortComments = (items) => [...items].sort((left, right) => commentTime(left) - commentTime(right) || left.id.localeCompare(right.id));
const parseIssueComments = (response) => flattenSlurpedPages(response).map(parseIssueComment);
const flattenSlurpedPages = (response) => Array.isArray(response[0]) ? response.flat() : response;
const parsePullRequestFiles = (response) => flattenSlurpedPages(response);
const diffPath = (path) => /\s|"/.test(path) ? JSON.stringify(path) : path;
const prefixedDiffPath = (prefix, path) => diffPath(`${prefix}/${path}`);
const fileHeaderPatch = (file) => {
  const oldPath = file.previous_filename ?? file.filename;
  const newPath = file.filename;
  const oldRef = file.status === "added" ? "/dev/null" : prefixedDiffPath("a", oldPath);
  const newRef = file.status === "removed" ? "/dev/null" : prefixedDiffPath("b", newPath);
  const lines = [
    `diff --git ${prefixedDiffPath("a", oldPath)} ${prefixedDiffPath("b", newPath)}`,
    ...file.status === "renamed" && file.previous_filename ? [`rename from ${oldPath}`, `rename to ${newPath}`] : [],
    `--- ${oldRef}`,
    `+++ ${newRef}`
  ];
  if (file.patch) lines.push(file.patch.trimEnd());
  return lines.join("\n");
};
const pullRequestFilesToPatch = (files) => files.map(fileHeaderPatch).join("\n");
const fallbackCreatedComment = (input) => ({
  id: `created:${input.repository}:${input.number}:${input.path}:${input.side}:${input.line}:${Date.now()}`,
  path: input.path,
  line: input.line,
  side: input.side,
  author: "you",
  body: input.body,
  createdAt: /* @__PURE__ */ new Date(),
  url: null,
  inReplyTo: null
});
const MERGEABLE_BY_RAW = {
  MERGEABLE: "mergeable",
  CONFLICTING: "conflicting"
};
const normalizeMergeable = (value) => MERGEABLE_BY_RAW[value] ?? "unknown";
const REVIEW_EVENT_CLI_FLAG = {
  COMMENT: "--comment",
  APPROVE: "--approve",
  REQUEST_CHANGES: "--request-changes"
};
class GitHubService extends Service()("ghui/GitHubService") {
  static layerNoDeps = effect(
    GitHubService,
    gen(function* () {
      const command = yield* CommandRunner;
      const appConfig2 = yield* AppConfigService;
      const ghJson = (label, schema2, args2) => command.runSchema(schema2, "gh", args2).pipe(withSpan(`GitHubService.${label}`));
      const ghVoid = (label, args2) => command.run("gh", args2).pipe(withSpan(`GitHubService.${label}`), asVoid);
      const searchPage = (label, query, schema2, parse2) => {
        const responseSchema = SearchResponseSchema(schema2);
        return fn(`GitHubService.${label}`)(function* (input) {
          const response = yield* command.runSchema(responseSchema, "gh", [
            "api",
            "graphql",
            "-f",
            `query=${query}`,
            "-F",
            `searchQuery=${searchQuery(input.mode, input.repository)}`,
            "-F",
            `first=${input.pageSize}`,
            ...input.cursor ? ["-F", `after=${input.cursor}`] : []
          ]);
          return pullRequestPage(response.data.search, parse2);
        });
      };
      const listOpenPullRequestSearchPage = searchPage("listOpenPullRequestSearchPage", pullRequestSummarySearchQuery, RawPullRequestSummaryNodeSchema, parsePullRequestSummary);
      const listOpenPullRequestDetailsPage = searchPage("listOpenPullRequestDetailsPage", pullRequestSearchQuery, RawPullRequestNodeSchema, parsePullRequest);
      const listRepositoryPullRequestPage = fn("GitHubService.listRepositoryPullRequestPage")(function* (input) {
        if (!input.repository) return { items: [], endCursor: null, hasNextPage: false };
        const repo = repositoryParts(input.repository);
        if (!repo) {
          return yield* new CommandError({ command: "gh", args: [], detail: `Invalid repository: ${input.repository}`, cause: input.repository });
        }
        const response = yield* command.runSchema(RepositoryPullRequestsResponseSchema, "gh", [
          "api",
          "graphql",
          "-f",
          `query=${repositoryPullRequestsQuery}`,
          "-F",
          `owner=${repo.owner}`,
          "-F",
          `name=${repo.name}`,
          "-F",
          `first=${input.pageSize}`,
          ...input.cursor ? ["-F", `after=${input.cursor}`] : []
        ]);
        const connection = response.data.repository?.pullRequests;
        if (!connection) {
          return yield* new CommandError({ command: "gh", args: [], detail: `Repository not found: ${input.repository}`, cause: input.repository });
        }
        return pullRequestPage(connection, parsePullRequestSummary);
      });
      const listInboxPullRequestPage = fn("GitHubService.listInboxPullRequestPage")(function* (input) {
        const cutoff = inboxUpdatedSinceCutoff(appConfig2.prUpdatedSinceWindow);
        const updatedFilter = cutoff ? ` updated:>=${cutoff}` : "";
        const reviewQuery = `is:pr is:open user-review-requested:@me archived:false${updatedFilter} sort:updated-desc`;
        const draftsQuery = `is:pr is:open author:@me draft:true archived:false${updatedFilter} sort:updated-desc`;
        const actionQuery = `is:pr is:open author:@me review:changes-requested archived:false${updatedFilter} sort:updated-desc`;
        const authoredQuery = `is:pr is:open author:@me draft:false archived:false${updatedFilter} sort:updated-desc`;
        const response = yield* command.runSchema(InboxResponseSchema, "gh", [
          "api",
          "graphql",
          "-f",
          `query=${inboxPullRequestsQuery}`,
          "-f",
          `reviewQuery=${reviewQuery}`,
          "-f",
          `draftsQuery=${draftsQuery}`,
          "-f",
          `actionQuery=${actionQuery}`,
          "-f",
          `authoredQuery=${authoredQuery}`,
          "-F",
          `first=${Math.min(input.pageSize, 100)}`
        ]);
        const parseConnection = (connection) => connection.nodes.flatMap((n) => n ? [parsePullRequestSummary(n)] : []);
        const seen = /* @__PURE__ */ new Set();
        const items = [];
        for (const pr of [
          ...parseConnection(response.data.reviewSearch),
          ...parseConnection(response.data.draftsSearch),
          ...parseConnection(response.data.actionSearch),
          ...parseConnection(response.data.authoredSearch)
        ]) {
          if (!seen.has(pr.url)) {
            seen.add(pr.url);
            items.push(pr);
          }
        }
        return { items, endCursor: null, hasNextPage: false };
      });
      const listOpenPullRequestPage = fn("GitHubService.listOpenPullRequestPage")(function* (input) {
        const pageSize = Math.max(1, Math.min(100, input.pageSize));
        const pageInput = { ...input, pageSize };
        if (pageInput.mode === "repository" && pageInput.repository) return yield* listRepositoryPullRequestPage(pageInput);
        if (pageInput.mode === "inbox") return yield* listInboxPullRequestPage(pageInput);
        return yield* listOpenPullRequestSearchPage(pageInput);
      });
      const paginatePages = fn("GitHubService.paginatePages")(function* (mode, repository, loadPage) {
        const pullRequests = [];
        let cursor = null;
        while (pullRequests.length < appConfig2.prFetchLimit) {
          const page = yield* loadPage({ mode, repository, cursor, pageSize: Math.min(100, appConfig2.prFetchLimit - pullRequests.length) });
          pullRequests.push(...page.items);
          if (!page.hasNextPage || !page.endCursor) break;
          cursor = page.endCursor;
        }
        return pullRequests;
      });
      const listOpenPullRequests = fn("GitHubService.listOpenPullRequests")(function* (mode, repository) {
        return yield* paginatePages(mode, repository, listOpenPullRequestPage);
      });
      const listOpenPullRequestDetails = fn("GitHubService.listOpenPullRequestDetails")(function* (mode, repository) {
        return yield* paginatePages(mode, repository, listOpenPullRequestDetailsPage);
      });
      const getPullRequestDetails = fn("GitHubService.getPullRequestDetails")(function* (repository, number2) {
        const repo = repositoryParts(repository);
        if (!repo) {
          return yield* new CommandError({ command: "gh", args: [], detail: `Invalid repository: ${repository}`, cause: repository });
        }
        const response = yield* command.runSchema(PullRequestDetailResponseSchema, "gh", [
          "api",
          "graphql",
          "-f",
          `query=${pullRequestDetailQuery}`,
          "-F",
          `owner=${repo.owner}`,
          "-F",
          `name=${repo.name}`,
          "-F",
          `number=${number2}`
        ]);
        const pullRequest = response.data.repository?.pullRequest;
        if (!pullRequest) {
          return yield* new CommandError({ command: "gh", args: [], detail: `Pull request not found: ${repository}#${number2}`, cause: `${repository}#${number2}` });
        }
        return parsePullRequest(pullRequest);
      });
      const getAuthenticatedUser = () => ghJson("getAuthenticatedUser", ViewerSchema, ["api", "user"]).pipe(map$1((viewer) => viewer.login));
      const getPullRequestDiff = (repository, number2) => ghJson("getPullRequestDiff", PullRequestFilesResponseSchema, ["api", "--paginate", "--slurp", `repos/${repository}/pulls/${number2}/files`]).pipe(
        map$1((response) => pullRequestFilesToPatch(parsePullRequestFiles(response)))
      );
      const listPullRequestReviewComments = (repository, number2) => ghJson("listPullRequestReviewComments", CommentsResponseSchema, ["api", "--paginate", "--slurp", `repos/${repository}/pulls/${number2}/comments`]).pipe(
        map$1(parsePullRequestComments)
      );
      const listPullRequestComments = fn("GitHubService.listPullRequestComments")(function* (repository, number2) {
        const [issueComments, reviewComments] = yield* all$1(
          [
            ghJson("listPullRequestIssueComments", CommentsResponseSchema, ["api", "--paginate", "--slurp", `repos/${repository}/issues/${number2}/comments`]).pipe(
              map$1(parseIssueComments)
            ),
            listPullRequestReviewComments(repository, number2).pipe(map$1((comments) => comments.map(reviewCommentAsComment)))
          ],
          { concurrency: "unbounded" }
        );
        return sortComments([...issueComments, ...reviewComments]);
      });
      const getPullRequestMergeInfo = fn("GitHubService.getPullRequestMergeInfo")(function* (repository, number2) {
        const info = yield* ghJson("getPullRequestMergeInfo", MergeInfoResponseSchema, [
          "pr",
          "view",
          String(number2),
          "--repo",
          repository,
          "--json",
          "number,title,state,isDraft,mergeable,reviewDecision,autoMergeRequest,statusCheckRollup"
        ]);
        const checkInfo = getCheckInfoFromContexts(info.statusCheckRollup);
        const repo = repositoryParts(repository);
        const adminInfo = repo ? yield* ghJson("getPullRequestAdminMergeInfo", PullRequestAdminMergeResponseSchema, [
          "api",
          "graphql",
          "-F",
          `owner=${repo.owner}`,
          "-F",
          `name=${repo.name}`,
          "-F",
          `number=${number2}`,
          "-f",
          "query=query($owner: String!, $name: String!, $number: Int!) { repository(owner: $owner, name: $name) { pullRequest(number: $number) { viewerCanMergeAsAdmin } } }"
        ]) : null;
        return {
          repository,
          number: info.number,
          title: info.title,
          state: info.state.toLowerCase() === "open" ? "open" : "closed",
          isDraft: info.isDraft,
          mergeable: normalizeMergeable(info.mergeable),
          reviewStatus: getReviewStatus(info),
          checkStatus: checkInfo.checkStatus,
          checkSummary: checkInfo.checkSummary,
          autoMergeEnabled: info.autoMergeRequest !== null,
          viewerCanMergeAsAdmin: adminInfo?.data.repository.pullRequest?.viewerCanMergeAsAdmin ?? false
        };
      });
      const getRepositoryMergeMethods = fn("GitHubService.getRepositoryMergeMethods")(function* (repository) {
        const response = yield* ghJson("getRepositoryMergeMethods", RepositoryMergeMethodsResponseSchema, [
          "repo",
          "view",
          repository,
          "--json",
          "squashMergeAllowed,mergeCommitAllowed,rebaseMergeAllowed"
        ]);
        return {
          squash: response.squashMergeAllowed,
          merge: response.mergeCommitAllowed,
          rebase: response.rebaseMergeAllowed
        };
      });
      const mergePullRequest = (repository, number2, action) => ghVoid("mergePullRequest", ["pr", "merge", String(number2), "--repo", repository, ...mergeActionCliArgs(action)]);
      const closePullRequest = (repository, number2) => ghVoid("closePullRequest", ["pr", "close", String(number2), "--repo", repository]);
      const createPullRequestIssueComment = fn("GitHubService.createPullRequestIssueComment")(function* (repository, number2, body) {
        const response = yield* command.runSchema(PullRequestCommentSchema, "gh", [
          "api",
          "--method",
          "POST",
          `repos/${repository}/issues/${number2}/comments`,
          "-f",
          `body=${body}`
        ]);
        return parseIssueComment(response);
      });
      const replyToReviewComment = fn("GitHubService.replyToReviewComment")(function* (repository, number2, inReplyTo, body) {
        const response = yield* command.runSchema(PullRequestCommentSchema, "gh", [
          "api",
          "--method",
          "POST",
          `repos/${repository}/pulls/${number2}/comments/${inReplyTo}/replies`,
          "-f",
          `body=${body}`
        ]);
        const review = parsePullRequestComment(response);
        if (!review) {
          return {
            _tag: "review-comment",
            id: `reply:${inReplyTo}:${Date.now()}`,
            path: "",
            line: 0,
            side: "RIGHT",
            author: "you",
            body,
            createdAt: /* @__PURE__ */ new Date(),
            url: null,
            inReplyTo
          };
        }
        return reviewCommentAsComment({ ...review, inReplyTo: review.inReplyTo ?? inReplyTo });
      });
      const createPullRequestComment = fn("GitHubService.createPullRequestComment")(function* (input) {
        const response = yield* command.runSchema(PullRequestCommentSchema, "gh", [
          "api",
          "--method",
          "POST",
          `repos/${input.repository}/pulls/${input.number}/comments`,
          "-f",
          `body=${input.body}`,
          "-f",
          `commit_id=${input.commitId}`,
          "-f",
          `path=${input.path}`,
          "-F",
          `line=${input.line}`,
          "-f",
          `side=${input.side}`,
          ...input.startLine === void 0 ? [] : ["-F", `start_line=${input.startLine}`, "-f", `start_side=${input.startSide ?? input.side}`]
        ]);
        return parsePullRequestComment(response) ?? fallbackCreatedComment(input);
      });
      const editPullRequestIssueComment = fn("GitHubService.editPullRequestIssueComment")(function* (repository, commentId, body) {
        const response = yield* command.runSchema(PullRequestCommentSchema, "gh", [
          "api",
          "--method",
          "PATCH",
          `repos/${repository}/issues/comments/${commentId}`,
          "-f",
          `body=${body}`
        ]);
        return parseIssueComment(response);
      });
      const editReviewComment = fn("GitHubService.editReviewComment")(function* (repository, commentId, body) {
        const response = yield* command.runSchema(PullRequestCommentSchema, "gh", [
          "api",
          "--method",
          "PATCH",
          `repos/${repository}/pulls/comments/${commentId}`,
          "-f",
          `body=${body}`
        ]);
        const review = parsePullRequestComment(response);
        if (!review) {
          return {
            _tag: "review-comment",
            id: commentId,
            path: "",
            line: 0,
            side: "RIGHT",
            author: "you",
            body,
            createdAt: /* @__PURE__ */ new Date(),
            url: null,
            inReplyTo: null
          };
        }
        return reviewCommentAsComment(review);
      });
      const deletePullRequestIssueComment = (repository, commentId) => ghVoid("deletePullRequestIssueComment", ["api", "--method", "DELETE", `repos/${repository}/issues/comments/${commentId}`]);
      const deleteReviewComment = (repository, commentId) => ghVoid("deleteReviewComment", ["api", "--method", "DELETE", `repos/${repository}/pulls/comments/${commentId}`]);
      const submitPullRequestReview = (input) => ghVoid("submitPullRequestReview", ["pr", "review", String(input.number), "--repo", input.repository, REVIEW_EVENT_CLI_FLAG[input.event], "--body", input.body]);
      const toggleDraftStatus = (repository, number2, isDraft) => ghVoid("toggleDraftStatus", ["pr", "ready", String(number2), "--repo", repository, ...isDraft ? [] : ["--undo"]]);
      const listRepoLabels = (repository) => ghJson("listRepoLabels", RepoLabelsResponseSchema, ["label", "list", "--repo", repository, "--json", "name,color", "--limit", "100"]).pipe(
        map$1((labels) => labels.map((label) => ({ name: label.name, color: `#${label.color}` })))
      );
      const addPullRequestLabel = (repository, number2, label) => ghVoid("addPullRequestLabel", ["pr", "edit", String(number2), "--repo", repository, "--add-label", label]);
      const removePullRequestLabel = (repository, number2, label) => ghVoid("removePullRequestLabel", ["pr", "edit", String(number2), "--repo", repository, "--remove-label", label]);
      return GitHubService.of({
        listOpenPullRequests,
        listOpenPullRequestPage,
        listOpenPullRequestDetails,
        getPullRequestDetails,
        getAuthenticatedUser,
        getPullRequestDiff,
        listPullRequestReviewComments,
        listPullRequestComments,
        getPullRequestMergeInfo,
        getRepositoryMergeMethods,
        mergePullRequest,
        closePullRequest,
        createPullRequestComment,
        createPullRequestIssueComment,
        replyToReviewComment,
        editPullRequestIssueComment,
        editReviewComment,
        deletePullRequestIssueComment,
        deleteReviewComment,
        submitPullRequestReview,
        toggleDraftStatus,
        listRepoLabels,
        addPullRequestLabel,
        removePullRequestLabel
      });
    })
  );
}
const collectStream = (stream) => new Promise((resolve2, reject) => {
  const chunks = [];
  stream.on("data", (chunk) => chunks.push(chunk));
  stream.on("end", () => resolve2(Buffer.concat(chunks).toString("utf-8")));
  stream.on("error", reject);
});
const NodeCommandRunner = {
  layer: effect(
    CommandRunner,
    gen(function* () {
      const runProcess = fn("CommandRunner.runProcess")(
        (command, args2, stdin) => tryPromise({
          async try() {
            const proc = spawn(command, [...args2], {
              stdio: [stdin !== void 0 ? "pipe" : "ignore", "pipe", "pipe"]
            });
            if (stdin !== void 0 && proc.stdin) {
              proc.stdin.write(stdin);
              proc.stdin.end();
            }
            const [stdout, stderr, exitCode] = await Promise.all([
              collectStream(proc.stdout),
              collectStream(proc.stderr),
              new Promise((resolve2, reject) => {
                proc.on("close", (code) => resolve2(code ?? 1));
                proc.on("error", reject);
              })
            ]);
            return { stdout, stderr, exitCode };
          },
          catch: (cause) => new CommandError({ command, args: [...args2], detail: `Failed to run ${command}`, cause })
        })
      );
      const run2 = fn("CommandRunner.run")(function* (command, args2, options) {
        const result2 = yield* runProcess(command, args2, options?.stdin).pipe(
          withSpan("ghui.command.runProcess", {
            attributes: {
              "process.command": command,
              "process.argv.count": args2.length
            }
          })
        );
        if (result2.exitCode !== 0) {
          const detail = result2.stderr.trim() || result2.stdout.trim() || `exit code ${result2.exitCode}`;
          if (isRateLimitError(detail)) {
            return yield* new RateLimitError({ command, args: [...args2], detail, retryAfterSeconds: parseRetryAfterSeconds(detail) });
          }
          return yield* new CommandError({ command, args: [...args2], detail, cause: detail });
        }
        return result2;
      });
      const runJson = fn("CommandRunner.runJson")(function* (command, args2) {
        const result2 = yield* run2(command, args2);
        return yield* try_({
          try: () => JSON.parse(result2.stdout),
          catch: (cause) => new JsonParseError({ command, args: [...args2], stdout: result2.stdout, cause })
        });
      });
      const runSchema = fn("CommandRunner.runSchema")(function* (schema2, command, args2) {
        const value = yield* runJson(command, args2);
        return yield* decodeUnknownEffect(schema2)(value);
      });
      return CommandRunner.of({ run: run2, runSchema });
    })
  )
};
const makeElectronCoreLayer = (options) => {
  const configLayer = succeed$2(AppConfigService, AppConfigService.of(options.appConfig));
  const commandLayer = NodeCommandRunner.layer;
  const githubLayer = GitHubService.layerNoDeps.pipe(provide$1(commandLayer), provide$1(configLayer));
  const cacheLayer = CacheService.disabledLayer;
  const clipboardLayer = Clipboard.layerNoDeps.pipe(provide$1(commandLayer));
  const browserLayer = BrowserOpener.layerNoDeps.pipe(provide$1(commandLayer));
  const observabilityLayer = Observability.layer;
  return mergeAll(githubLayer, cacheLayer, clipboardLayer, browserLayer, commandLayer, configLayer, observabilityLayer);
};
const serializeError = (error) => {
  if (error && typeof error === "object" && "_tag" in error) {
    const tagged = error;
    return {
      _tag: tagged._tag,
      message: tagged.detail ?? tagged.message ?? String(error),
      retryAfterSeconds: tagged.retryAfterSeconds ?? void 0
    };
  }
  return { _tag: "UnknownError", message: String(error) };
};
const setupIpcHandlers = (appConfig2) => {
  const coreLayer = makeElectronCoreLayer({ appConfig: appConfig2 });
  const runtime = make$8(coreLayer);
  const handle = (channel, handler) => {
    ipcMain.handle(channel, async (_event, ...args2) => {
      try {
        const data = await runtime.runPromise(handler(...args2));
        return { success: true, data };
      } catch (error) {
        return { success: false, error: serializeError(error) };
      }
    });
  };
  handle(
    "pr:list",
    (view, cursor, pageSize) => gen(function* () {
      const github = yield* GitHubService;
      const mode = view._tag === "Repository" ? "repository" : view.mode;
      const repo = view.repository;
      return yield* github.listOpenPullRequestPage({ mode, repository: repo, cursor: cursor ?? null, pageSize: pageSize ?? 50 });
    })
  );
  handle(
    "pr:details",
    (repo, number2) => gen(function* () {
      const github = yield* GitHubService;
      return yield* github.getPullRequestDetails(repo, number2);
    })
  );
  handle(
    "pr:comments",
    (repo, number2) => gen(function* () {
      const github = yield* GitHubService;
      return yield* github.listPullRequestComments(repo, number2);
    })
  );
  handle(
    "pr:mergeInfo",
    (repo, number2) => gen(function* () {
      const github = yield* GitHubService;
      return yield* github.getPullRequestMergeInfo(repo, number2);
    })
  );
  handle(
    "pr:merge",
    (repo, number2, action) => gen(function* () {
      const github = yield* GitHubService;
      yield* github.mergePullRequest(repo, number2, action);
    })
  );
  handle(
    "pr:close",
    (repo, number2) => gen(function* () {
      const github = yield* GitHubService;
      yield* github.closePullRequest(repo, number2);
    })
  );
  handle(
    "pr:review",
    (input) => gen(function* () {
      const github = yield* GitHubService;
      yield* github.submitPullRequestReview(input);
    })
  );
  handle(
    "pr:toggleDraft",
    (repo, number2, isDraft) => gen(function* () {
      const github = yield* GitHubService;
      yield* github.toggleDraftStatus(repo, number2, isDraft);
    })
  );
  handle(
    "pr:labels:list",
    (repo) => gen(function* () {
      const github = yield* GitHubService;
      return yield* github.listRepoLabels(repo);
    })
  );
  handle(
    "pr:labels:add",
    (repo, number2, label) => gen(function* () {
      const github = yield* GitHubService;
      yield* github.addPullRequestLabel(repo, number2, label);
    })
  );
  handle(
    "pr:labels:remove",
    (repo, number2, label) => gen(function* () {
      const github = yield* GitHubService;
      yield* github.removePullRequestLabel(repo, number2, label);
    })
  );
  handle(
    "pr:mergeMethods",
    (repo) => gen(function* () {
      const github = yield* GitHubService;
      return yield* github.getRepositoryMergeMethods(repo);
    })
  );
  handle(
    "pr:issueComment:create",
    (repo, number2, body) => gen(function* () {
      const github = yield* GitHubService;
      return yield* github.createPullRequestIssueComment(repo, number2, body);
    })
  );
  handle(
    "pr:comment:create",
    (input) => gen(function* () {
      const github = yield* GitHubService;
      return yield* github.createPullRequestComment(input);
    })
  );
  handle(
    "pr:comment:edit",
    (repo, commentId, body) => gen(function* () {
      const github = yield* GitHubService;
      yield* github.editReviewComment(repo, commentId, body);
    })
  );
  handle(
    "pr:comment:delete",
    (repo, commentId) => gen(function* () {
      const github = yield* GitHubService;
      yield* github.deleteReviewComment(repo, commentId);
    })
  );
  handle(
    "clipboard:copy",
    (text2) => gen(function* () {
      const clipboard = yield* Clipboard;
      yield* clipboard.copy(text2);
    })
  );
  handle(
    "browser:open",
    (url) => gen(function* () {
      const browser = yield* BrowserOpener;
      yield* browser.openUrl(url);
    })
  );
  handle(
    "cache:readQueue",
    (viewer, view) => gen(function* () {
      const cache = yield* CacheService;
      return yield* cache.readQueue(viewer, view);
    })
  );
  handle(
    "config:get",
    () => gen(function* () {
      const config = yield* AppConfigService;
      return config;
    })
  );
  handle(
    "auth:user",
    () => gen(function* () {
      const command = yield* CommandRunner;
      const result2 = yield* command.run("gh", ["api", "user", "--jq", ".login"]);
      return result2.stdout.trim();
    })
  );
  handle(
    "auth:check",
    () => gen(function* () {
      const command = yield* CommandRunner;
      const result$12 = yield* command.run("gh", ["auth", "status"]).pipe(result);
      if (result$12._tag === "Success") return { ok: true };
      const error = result$12.failure;
      const message = error && typeof error === "object" && "detail" in error ? String(error.detail) : String(error);
      return { ok: false, error: message };
    })
  );
  return { runtime };
};
app.disableHardwareAcceleration();
const __dirname$1 = dirname(fileURLToPath(import.meta.url));
const appConfig = {
  prFetchLimit: 200,
  prPageSize: 50,
  cachePath: null,
  prUpdatedSinceWindow: "1m"
};
let mainWindow = null;
const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: join(__dirname$1, "../preload/index.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });
  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    mainWindow.loadFile(join(__dirname$1, "../renderer/index.html"));
  }
};
app.whenReady().then(() => {
  setupIpcHandlers(appConfig);
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
