globalThis.process ??= {};
globalThis.process.env ??= {};
import { r as __exportAll } from "./rolldown-runtime_CTVlGNzl.mjs";
import { S as createComponent, i as renderComponent, u as renderTemplate } from "./server_C1h4Dnza.mjs";
import { _ as includeBooleanAttr, a as ssrRenderClass, f as mergeProps, g as ref, h as watch, i as ssrRenderAttrs, l as computed, m as useSSRContext, n as ssrInterpolate, o as ssrRenderList, p as onMounted, r as ssrRenderAttr, s as ssrRenderStyle, u as defineComponent } from "./server-renderer_gm7rNCw2.mjs";
import "./compiler_w6KFsEAb.mjs";
import { t as checkCaseGpuCompatibility } from "./compatibility_D89vkBH-.mjs";
import { t as $$BaseLayout } from "./BaseLayout_CXdPvn_n.mjs";
//#region node_modules/fuse.js/dist/fuse.mjs
/**
* Fuse.js v7.4.2 - Lightweight fuzzy-search (http://fusejs.io)
*
* Copyright (c) 2026 Kiro Risk (http://kiro.me)
* All Rights Reserved. Apache Software License 2.0
*
* http://www.apache.org/licenses/LICENSE-2.0
*/
function isArray(value) {
	return !Array.isArray ? getTag(value) === "[object Array]" : Array.isArray(value);
}
function baseToString(value) {
	if (typeof value == "string") return value;
	if (typeof value === "bigint") return value.toString();
	const result = value + "";
	return result == "0" && 1 / value == -Infinity ? "-0" : result;
}
function toString(value) {
	return value == null ? "" : baseToString(value);
}
function isString(value) {
	return typeof value === "string";
}
function isNumber(value) {
	return typeof value === "number";
}
function isBoolean(value) {
	return value === true || value === false || isObjectLike(value) && getTag(value) == "[object Boolean]";
}
function isObject(value) {
	return typeof value === "object";
}
function isObjectLike(value) {
	return isObject(value) && value !== null;
}
function isDefined(value) {
	return value !== void 0 && value !== null;
}
function isBlank(value) {
	return !value.trim().length;
}
function getTag(value) {
	return value == null ? value === void 0 ? "[object Undefined]" : "[object Null]" : Object.prototype.toString.call(value);
}
var INCORRECT_INDEX_TYPE = "Incorrect 'index' type";
var INVALID_DOC_INDEX = "Invalid doc index: must be a non-negative integer within the bounds of the docs array";
var LOGICAL_SEARCH_INVALID_QUERY_FOR_KEY = (key) => `Invalid value for key ${key}`;
var PATTERN_LENGTH_TOO_LARGE = (max) => `Pattern length exceeds max of ${max}.`;
var MISSING_KEY_PROPERTY = (name) => `Missing ${name} property in key`;
var INVALID_KEY_WEIGHT_VALUE = (key) => `Property 'weight' in key '${key}' must be a positive integer`;
var FUSE_MATCH_TOKEN_SEARCH_UNSUPPORTED = "Fuse.match does not support useTokenSearch: token search requires corpus-level statistics (df, fieldCount) that a one-off string comparison does not have. Use new Fuse(...).search(...) instead.";
var hasOwn = Object.prototype.hasOwnProperty;
var KeyStore = class {
	constructor(keys) {
		this._keys = [];
		this._keyMap = {};
		let totalWeight = 0;
		keys.forEach((key) => {
			const obj = createKey(key);
			this._keys.push(obj);
			this._keyMap[obj.id] = obj;
			totalWeight += obj.weight;
		});
		this._keys.forEach((key) => {
			key.weight /= totalWeight;
		});
	}
	get(keyId) {
		return this._keyMap[keyId];
	}
	keys() {
		return this._keys;
	}
	toJSON() {
		return JSON.stringify(this._keys);
	}
};
function createKey(key) {
	let path = null;
	let id = null;
	let src = null;
	let weight = 1;
	let getFn = null;
	if (isString(key) || isArray(key)) {
		src = key;
		path = createKeyPath(key);
		id = createKeyId(key);
	} else {
		if (!hasOwn.call(key, "name")) throw new Error(MISSING_KEY_PROPERTY("name"));
		const name = key.name;
		src = name;
		if (hasOwn.call(key, "weight") && key.weight !== void 0) {
			weight = key.weight;
			if (weight <= 0) throw new Error(INVALID_KEY_WEIGHT_VALUE(createKeyId(name)));
		}
		path = createKeyPath(name);
		id = createKeyId(name);
		getFn = key.getFn ?? null;
	}
	return {
		path,
		id,
		weight,
		src,
		getFn
	};
}
function createKeyPath(key) {
	return isArray(key) ? key : key.split(".");
}
function createKeyId(key) {
	return isArray(key) ? key.join(".") : key;
}
function get(obj, path) {
	const list = [];
	let arr = false;
	const deepGet = (obj, path, index, arrayIndex) => {
		if (!isDefined(obj)) return;
		if (!path[index]) list.push(arrayIndex !== void 0 ? {
			v: obj,
			i: arrayIndex
		} : obj);
		else {
			const value = obj[path[index]];
			if (!isDefined(value)) return;
			if (index === path.length - 1 && (isString(value) || isNumber(value) || isBoolean(value) || typeof value === "bigint")) list.push(arrayIndex !== void 0 ? {
				v: toString(value),
				i: arrayIndex
			} : toString(value));
			else if (isArray(value)) {
				arr = true;
				for (let i = 0, len = value.length; i < len; i += 1) deepGet(value[i], path, index + 1, i);
			} else if (path.length) deepGet(value, path, index + 1, arrayIndex);
		}
	};
	deepGet(obj, isString(path) ? path.split(".") : path, 0);
	return arr ? list : list[0];
}
var MatchOptions = {
	includeMatches: false,
	findAllMatches: false,
	minMatchCharLength: 1
};
var BasicOptions = {
	isCaseSensitive: false,
	ignoreDiacritics: false,
	includeScore: false,
	keys: [],
	shouldSort: true,
	sortFn: (a, b) => a.score === b.score ? a.idx < b.idx ? -1 : 1 : a.score < b.score ? -1 : 1
};
var FuzzyOptions = {
	location: 0,
	threshold: .6,
	distance: 100
};
var AdvancedOptions = {
	useExtendedSearch: false,
	useTokenSearch: false,
	tokenize: void 0,
	tokenMatch: "any",
	getFn: get,
	ignoreLocation: false,
	ignoreFieldNorm: false,
	fieldNormWeight: 1
};
var Config = Object.freeze({
	...BasicOptions,
	...MatchOptions,
	...FuzzyOptions,
	...AdvancedOptions
});
function norm(weight = 1, mantissa = 3) {
	const cache = /* @__PURE__ */ new Map();
	const m = Math.pow(10, mantissa);
	return {
		get(value) {
			let numTokens = 1;
			let inSpace = false;
			for (let i = 0; i < value.length; i++) if (value.charCodeAt(i) === 32) {
				if (!inSpace) {
					numTokens++;
					inSpace = true;
				}
			} else inSpace = false;
			if (cache.has(numTokens)) return cache.get(numTokens);
			const n = Math.round(m / Math.pow(numTokens, .5 * weight)) / m;
			cache.set(numTokens, n);
			return n;
		},
		clear() {
			cache.clear();
		}
	};
}
var FuseIndex = class {
	constructor({ getFn = Config.getFn, fieldNormWeight = Config.fieldNormWeight } = {}) {
		this.norm = norm(fieldNormWeight, 3);
		this.getFn = getFn;
		this.isCreated = false;
		this.docs = [];
		this.keys = [];
		this._keysMap = {};
		this.setIndexRecords();
	}
	setSources(docs = []) {
		this.docs = docs;
	}
	setIndexRecords(records = []) {
		this.records = records;
	}
	setKeys(keys = []) {
		this.keys = keys;
		this._keysMap = {};
		keys.forEach((key, idx) => {
			this._keysMap[key.id] = idx;
		});
	}
	create() {
		if (this.isCreated || !this.docs.length) return;
		this.isCreated = true;
		const len = this.docs.length;
		this.records = new Array(len);
		let recordCount = 0;
		if (isString(this.docs[0])) for (let i = 0; i < len; i++) {
			const record = this._createStringRecord(this.docs[i], i);
			if (record) this.records[recordCount++] = record;
		}
		else for (let i = 0; i < len; i++) this.records[recordCount++] = this._createObjectRecord(this.docs[i], i);
		this.records.length = recordCount;
		this.norm.clear();
	}
	add(doc, docIndex) {
		if (!Number.isInteger(docIndex) || docIndex < 0) throw new Error(INVALID_DOC_INDEX);
		if (isString(doc)) {
			const record = this._createStringRecord(doc, docIndex);
			if (record) this.records.push(record);
			return record;
		}
		const record = this._createObjectRecord(doc, docIndex);
		this.records.push(record);
		return record;
	}
	removeAt(idx) {
		if (!Number.isInteger(idx) || idx < 0) throw new Error(INVALID_DOC_INDEX);
		for (let i = 0, len = this.records.length; i < len; i += 1) if (this.records[i].i === idx) {
			this.records.splice(i, 1);
			break;
		}
		for (let i = 0, len = this.records.length; i < len; i += 1) if (this.records[i].i > idx) this.records[i].i -= 1;
	}
	removeAll(indices) {
		const toRemove = /* @__PURE__ */ new Set();
		for (const v of indices) if (Number.isInteger(v) && v >= 0) toRemove.add(v);
		if (toRemove.size === 0) return;
		this.records = this.records.filter((r) => !toRemove.has(r.i));
		const sorted = Array.from(toRemove).sort((a, b) => a - b);
		for (const record of this.records) {
			let lo = 0;
			let hi = sorted.length;
			while (lo < hi) {
				const mid = lo + hi >>> 1;
				if (sorted[mid] < record.i) lo = mid + 1;
				else hi = mid;
			}
			record.i -= lo;
		}
	}
	getValueForItemAtKeyId(item, keyId) {
		return item[this._keysMap[keyId]];
	}
	size() {
		return this.records.length;
	}
	_createStringRecord(doc, docIndex) {
		if (!isDefined(doc) || isBlank(doc)) return null;
		return {
			v: doc,
			i: docIndex,
			n: this.norm.get(doc)
		};
	}
	_createObjectRecord(doc, docIndex) {
		const record = {
			i: docIndex,
			$: {}
		};
		for (let keyIndex = 0, keyLen = this.keys.length; keyIndex < keyLen; keyIndex++) {
			const key = this.keys[keyIndex];
			const value = key.getFn ? key.getFn(doc) : this.getFn(doc, key.path);
			if (!isDefined(value)) continue;
			if (isArray(value)) {
				const subRecords = [];
				for (let i = 0, len = value.length; i < len; i += 1) {
					const item = value[i];
					if (!isDefined(item)) continue;
					if (isString(item)) {
						if (!isBlank(item)) {
							const subRecord = {
								v: item,
								i,
								n: this.norm.get(item)
							};
							subRecords.push(subRecord);
						}
					} else if (isDefined(item.v)) {
						const text = isString(item.v) ? item.v : toString(item.v);
						if (!isBlank(text)) {
							const subRecord = {
								v: text,
								i: item.i,
								n: this.norm.get(text)
							};
							subRecords.push(subRecord);
						}
					}
				}
				record.$[keyIndex] = subRecords;
			} else if (isString(value) && !isBlank(value)) {
				const subRecord = {
					v: value,
					n: this.norm.get(value)
				};
				record.$[keyIndex] = subRecord;
			}
		}
		return record;
	}
	toJSON() {
		return {
			keys: this.keys.map(({ getFn, ...key }) => key),
			records: this.records
		};
	}
};
function createIndex(keys, docs, { getFn = Config.getFn, fieldNormWeight = Config.fieldNormWeight } = {}) {
	const myIndex = new FuseIndex({
		getFn,
		fieldNormWeight
	});
	myIndex.setKeys(keys.map(createKey));
	myIndex.setSources(docs);
	myIndex.create();
	return myIndex;
}
function parseIndex(data, { getFn = Config.getFn, fieldNormWeight = Config.fieldNormWeight } = {}) {
	const { keys, records } = data;
	const myIndex = new FuseIndex({
		getFn,
		fieldNormWeight
	});
	myIndex.setKeys(keys);
	myIndex.setIndexRecords(records);
	return myIndex;
}
function convertMaskToIndices(matchmask = [], minMatchCharLength = Config.minMatchCharLength) {
	const indices = [];
	let start = -1;
	let end = -1;
	let i = 0;
	for (let len = matchmask.length; i < len; i += 1) {
		const match = matchmask[i];
		if (match && start === -1) start = i;
		else if (!match && start !== -1) {
			end = i - 1;
			if (end - start + 1 >= minMatchCharLength) indices.push([start, end]);
			start = -1;
		}
	}
	if (matchmask[i - 1] && i - start >= minMatchCharLength) indices.push([start, i - 1]);
	return indices;
}
function search(text, pattern, patternAlphabet, { location = Config.location, distance = Config.distance, threshold = Config.threshold, findAllMatches = Config.findAllMatches, minMatchCharLength = Config.minMatchCharLength, includeMatches = Config.includeMatches, ignoreLocation = Config.ignoreLocation } = {}) {
	if (pattern.length > 32) throw new Error(PATTERN_LENGTH_TOO_LARGE(32));
	const patternLen = pattern.length;
	const textLen = text.length;
	const expectedLocation = Math.max(0, Math.min(location, textLen));
	let currentThreshold = threshold;
	let bestLocation = expectedLocation;
	const calcScore = (errors, currentLocation) => {
		const accuracy = errors / patternLen;
		if (ignoreLocation) return accuracy;
		const proximity = Math.abs(expectedLocation - currentLocation);
		if (!distance) return proximity ? 1 : accuracy;
		return accuracy + proximity / distance;
	};
	const computeMatches = minMatchCharLength > 1 || includeMatches;
	const matchMask = computeMatches ? Array(textLen) : [];
	let index;
	while ((index = text.indexOf(pattern, bestLocation)) > -1) {
		const score = calcScore(0, index);
		currentThreshold = Math.min(score, currentThreshold);
		bestLocation = index + patternLen;
		if (computeMatches) {
			let i = 0;
			while (i < patternLen) {
				matchMask[index + i] = 1;
				i += 1;
			}
		}
	}
	bestLocation = -1;
	let lastBitArr = [];
	let finalScore = 1;
	let bestErrors = 0;
	let binMax = patternLen + textLen;
	const mask = 1 << patternLen - 1;
	for (let i = 0; i < patternLen; i += 1) {
		let binMin = 0;
		let binMid = binMax;
		while (binMin < binMid) {
			if (calcScore(i, expectedLocation + binMid) <= currentThreshold) binMin = binMid;
			else binMax = binMid;
			binMid = Math.floor((binMax - binMin) / 2 + binMin);
		}
		binMax = binMid;
		let start = Math.max(1, expectedLocation - binMid + 1);
		const finish = findAllMatches ? textLen : Math.min(expectedLocation + binMid, textLen) + patternLen;
		const bitArr = Array(finish + 2);
		bitArr[finish + 1] = (1 << i) - 1;
		for (let j = finish; j >= start; j -= 1) {
			const currentLocation = j - 1;
			const charMatch = patternAlphabet[text[currentLocation]];
			bitArr[j] = (bitArr[j + 1] << 1 | 1) & charMatch;
			if (i) bitArr[j] |= (lastBitArr[j + 1] | lastBitArr[j]) << 1 | 1 | lastBitArr[j + 1];
			if (bitArr[j] & mask) {
				finalScore = calcScore(i, currentLocation);
				if (finalScore <= currentThreshold) {
					currentThreshold = finalScore;
					bestLocation = currentLocation;
					bestErrors = i;
					if (bestLocation <= expectedLocation) break;
					start = Math.max(1, 2 * expectedLocation - bestLocation);
				}
			}
		}
		if (calcScore(i + 1, expectedLocation) > currentThreshold) break;
		lastBitArr = bitArr;
	}
	if (computeMatches && bestLocation >= 0) {
		const matchEnd = Math.min(textLen - 1, bestLocation + patternLen - 1 + bestErrors);
		for (let k = bestLocation; k <= matchEnd; k += 1) if (patternAlphabet[text[k]]) matchMask[k] = 1;
	}
	const result = {
		isMatch: bestLocation >= 0,
		score: Math.max(.001, finalScore)
	};
	if (computeMatches) {
		const indices = convertMaskToIndices(matchMask, minMatchCharLength);
		if (!indices.length) result.isMatch = false;
		else if (includeMatches) result.indices = indices;
	}
	return result;
}
function createPatternAlphabet(pattern) {
	const mask = {};
	for (let i = 0, len = pattern.length; i < len; i += 1) {
		const char = pattern.charAt(i);
		mask[char] = (mask[char] || 0) | 1 << len - i - 1;
	}
	return mask;
}
function mergeIndices(indices) {
	if (indices.length <= 1) return indices;
	indices.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
	const merged = [indices[0]];
	for (let i = 1, len = indices.length; i < len; i += 1) {
		const last = merged[merged.length - 1];
		const curr = indices[i];
		if (curr[0] <= last[1] + 1) last[1] = Math.max(last[1], curr[1]);
		else merged.push(curr);
	}
	return merged;
}
var NON_DECOMPOSABLE_MAP = {
	"ł": "l",
	"Ł": "L",
	"đ": "d",
	"Đ": "D",
	"ø": "o",
	"Ø": "O",
	"ħ": "h",
	"Ħ": "H",
	"ŧ": "t",
	"Ŧ": "T",
	"ı": "i",
	"ß": "ss"
};
var NON_DECOMPOSABLE_RE = new RegExp("[" + Object.keys(NON_DECOMPOSABLE_MAP).join("") + "]", "g");
var stripDiacritics = typeof String.prototype.normalize === "function" ? (str) => str.normalize("NFD").replace(/[\u0300-\u036F\u0483-\u0489\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7\u06E8\u06EA-\u06ED\u0711\u0730-\u074A\u07A6-\u07B0\u07EB-\u07F3\u07FD\u0816-\u0819\u081B-\u0823\u0825-\u0827\u0829-\u082D\u0859-\u085B\u08D3-\u08E1\u08E3-\u0903\u093A-\u093C\u093E-\u094F\u0951-\u0957\u0962\u0963\u0981-\u0983\u09BC\u09BE-\u09C4\u09C7\u09C8\u09CB-\u09CD\u09D7\u09E2\u09E3\u09FE\u0A01-\u0A03\u0A3C\u0A3E-\u0A42\u0A47\u0A48\u0A4B-\u0A4D\u0A51\u0A70\u0A71\u0A75\u0A81-\u0A83\u0ABC\u0ABE-\u0AC5\u0AC7-\u0AC9\u0ACB-\u0ACD\u0AE2\u0AE3\u0AFA-\u0AFF\u0B01-\u0B03\u0B3C\u0B3E-\u0B44\u0B47\u0B48\u0B4B-\u0B4D\u0B56\u0B57\u0B62\u0B63\u0B82\u0BBE-\u0BC2\u0BC6-\u0BC8\u0BCA-\u0BCD\u0BD7\u0C00-\u0C04\u0C3E-\u0C44\u0C46-\u0C48\u0C4A-\u0C4D\u0C55\u0C56\u0C62\u0C63\u0C81-\u0C83\u0CBC\u0CBE-\u0CC4\u0CC6-\u0CC8\u0CCA-\u0CCD\u0CD5\u0CD6\u0CE2\u0CE3\u0D00-\u0D03\u0D3B\u0D3C\u0D3E-\u0D44\u0D46-\u0D48\u0D4A-\u0D4D\u0D57\u0D62\u0D63\u0D82\u0D83\u0DCA\u0DCF-\u0DD4\u0DD6\u0DD8-\u0DDF\u0DF2\u0DF3\u0E31\u0E34-\u0E3A\u0E47-\u0E4E\u0EB1\u0EB4-\u0EB9\u0EBB\u0EBC\u0EC8-\u0ECD\u0F18\u0F19\u0F35\u0F37\u0F39\u0F3E\u0F3F\u0F71-\u0F84\u0F86\u0F87\u0F8D-\u0F97\u0F99-\u0FBC\u0FC6\u102B-\u103E\u1056-\u1059\u105E-\u1060\u1062-\u1064\u1067-\u106D\u1071-\u1074\u1082-\u108D\u108F\u109A-\u109D\u135D-\u135F\u1712-\u1714\u1732-\u1734\u1752\u1753\u1772\u1773\u17B4-\u17D3\u17DD\u180B-\u180D\u1885\u1886\u18A9\u1920-\u192B\u1930-\u193B\u1A17-\u1A1B\u1A55-\u1A5E\u1A60-\u1A7C\u1A7F\u1AB0-\u1ABE\u1B00-\u1B04\u1B34-\u1B44\u1B6B-\u1B73\u1B80-\u1B82\u1BA1-\u1BAD\u1BE6-\u1BF3\u1C24-\u1C37\u1CD0-\u1CD2\u1CD4-\u1CE8\u1CED\u1CF2-\u1CF4\u1CF7-\u1CF9\u1DC0-\u1DF9\u1DFB-\u1DFF\u20D0-\u20F0\u2CEF-\u2CF1\u2D7F\u2DE0-\u2DFF\u302A-\u302F\u3099\u309A\uA66F-\uA672\uA674-\uA67D\uA69E\uA69F\uA6F0\uA6F1\uA802\uA806\uA80B\uA823-\uA827\uA880\uA881\uA8B4-\uA8C5\uA8E0-\uA8F1\uA8FF\uA926-\uA92D\uA947-\uA953\uA980-\uA983\uA9B3-\uA9C0\uA9E5\uAA29-\uAA36\uAA43\uAA4C\uAA4D\uAA7B-\uAA7D\uAAB0\uAAB2-\uAAB4\uAAB7\uAAB8\uAABE\uAABF\uAAC1\uAAEB-\uAAEF\uAAF5\uAAF6\uABE3-\uABEA\uABEC\uABED\uFB1E\uFE00-\uFE0F\uFE20-\uFE2F]/g, "").replace(NON_DECOMPOSABLE_RE, (ch) => NON_DECOMPOSABLE_MAP[ch]) : (str) => str;
var BitapSearch = class {
	constructor(pattern, { location = Config.location, threshold = Config.threshold, distance = Config.distance, includeMatches = Config.includeMatches, findAllMatches = Config.findAllMatches, minMatchCharLength = Config.minMatchCharLength, isCaseSensitive = Config.isCaseSensitive, ignoreDiacritics = Config.ignoreDiacritics, ignoreLocation = Config.ignoreLocation } = {}) {
		this.options = {
			location,
			threshold,
			distance,
			includeMatches,
			findAllMatches,
			minMatchCharLength,
			isCaseSensitive,
			ignoreDiacritics,
			ignoreLocation
		};
		pattern = isCaseSensitive ? pattern : pattern.toLowerCase();
		pattern = ignoreDiacritics ? stripDiacritics(pattern) : pattern;
		this.pattern = pattern;
		this.chunks = [];
		if (!this.pattern.length) return;
		const addChunk = (pattern, startIndex) => {
			this.chunks.push({
				pattern,
				alphabet: createPatternAlphabet(pattern),
				startIndex
			});
		};
		const len = this.pattern.length;
		if (len > 32) {
			let i = 0;
			const remainder = len % 32;
			const end = len - remainder;
			while (i < end) {
				addChunk(this.pattern.substr(i, 32), i);
				i += 32;
			}
			if (remainder) {
				const startIndex = len - 32;
				addChunk(this.pattern.substr(startIndex), startIndex);
			}
		} else addChunk(this.pattern, 0);
	}
	searchIn(text) {
		const { isCaseSensitive, ignoreDiacritics, includeMatches } = this.options;
		text = isCaseSensitive ? text : text.toLowerCase();
		text = ignoreDiacritics ? stripDiacritics(text) : text;
		if (this.pattern === text) {
			const result = {
				isMatch: true,
				score: 0
			};
			if (includeMatches) result.indices = [[0, text.length - 1]];
			return result;
		}
		const { location, distance, threshold, findAllMatches, minMatchCharLength, ignoreLocation } = this.options;
		const allIndices = [];
		let totalScore = 0;
		let hasMatches = false;
		this.chunks.forEach(({ pattern, alphabet, startIndex }) => {
			const { isMatch, score, indices } = search(text, pattern, alphabet, {
				location: location + startIndex,
				distance,
				threshold,
				findAllMatches,
				minMatchCharLength,
				includeMatches,
				ignoreLocation
			});
			if (isMatch) hasMatches = true;
			totalScore += score;
			if (isMatch && indices) allIndices.push(...indices);
		});
		const result = {
			isMatch: hasMatches,
			score: hasMatches ? totalScore / this.chunks.length : 1
		};
		if (hasMatches && includeMatches) result.indices = mergeIndices(allIndices);
		return result;
	}
};
var MULTI_MATCH_TYPES = /* @__PURE__ */ new Set(["fuzzy", "include"]);
function isInverse(type) {
	return type.startsWith("inverse");
}
var matchers = [
	{
		type: "exact",
		multiRegex: /^="(.*)"$/,
		singleRegex: /^=(.*)$/,
		create: (pattern) => ({
			type: "exact",
			search(text) {
				const isMatch = text === pattern;
				return {
					isMatch,
					score: isMatch ? 0 : 1,
					indices: [0, pattern.length - 1]
				};
			}
		})
	},
	{
		type: "include",
		multiRegex: /^'"(.*)"$/,
		singleRegex: /^'(.*)$/,
		create: (pattern) => ({
			type: "include",
			search(text) {
				let location = 0;
				let index;
				const indices = [];
				const patternLen = pattern.length;
				while ((index = text.indexOf(pattern, location)) > -1) {
					location = index + patternLen;
					indices.push([index, location - 1]);
				}
				const isMatch = !!indices.length;
				return {
					isMatch,
					score: isMatch ? 0 : 1,
					indices
				};
			}
		})
	},
	{
		type: "prefix-exact",
		multiRegex: /^\^"(.*)"$/,
		singleRegex: /^\^(.*)$/,
		create: (pattern) => ({
			type: "prefix-exact",
			search(text) {
				const isMatch = text.startsWith(pattern);
				return {
					isMatch,
					score: isMatch ? 0 : 1,
					indices: [0, pattern.length - 1]
				};
			}
		})
	},
	{
		type: "inverse-prefix-exact",
		multiRegex: /^!\^"(.*)"$/,
		singleRegex: /^!\^(.*)$/,
		create: (pattern) => ({
			type: "inverse-prefix-exact",
			search(text) {
				const isMatch = !text.startsWith(pattern);
				return {
					isMatch,
					score: isMatch ? 0 : 1,
					indices: [0, text.length - 1]
				};
			}
		})
	},
	{
		type: "inverse-suffix-exact",
		multiRegex: /^!"(.*)"\$$/,
		singleRegex: /^!(.*)\$$/,
		create: (pattern) => ({
			type: "inverse-suffix-exact",
			search(text) {
				const isMatch = !text.endsWith(pattern);
				return {
					isMatch,
					score: isMatch ? 0 : 1,
					indices: [0, text.length - 1]
				};
			}
		})
	},
	{
		type: "suffix-exact",
		multiRegex: /^"(.*)"\$$/,
		singleRegex: /^(.*)\$$/,
		create: (pattern) => ({
			type: "suffix-exact",
			search(text) {
				const isMatch = text.endsWith(pattern);
				return {
					isMatch,
					score: isMatch ? 0 : 1,
					indices: [text.length - pattern.length, text.length - 1]
				};
			}
		})
	},
	{
		type: "inverse-exact",
		multiRegex: /^!"(.*)"$/,
		singleRegex: /^!(.*)$/,
		create: (pattern) => ({
			type: "inverse-exact",
			search(text) {
				const isMatch = text.indexOf(pattern) === -1;
				return {
					isMatch,
					score: isMatch ? 0 : 1,
					indices: [0, text.length - 1]
				};
			}
		})
	},
	{
		type: "fuzzy",
		multiRegex: /^"(.*)"$/,
		singleRegex: /^(.*)$/,
		create: (pattern, options = {}) => {
			const bitap = new BitapSearch(pattern, {
				location: options.location ?? Config.location,
				threshold: options.threshold ?? Config.threshold,
				distance: options.distance ?? Config.distance,
				includeMatches: options.includeMatches ?? Config.includeMatches,
				findAllMatches: options.findAllMatches ?? Config.findAllMatches,
				minMatchCharLength: options.minMatchCharLength ?? Config.minMatchCharLength,
				isCaseSensitive: options.isCaseSensitive ?? Config.isCaseSensitive,
				ignoreDiacritics: options.ignoreDiacritics ?? Config.ignoreDiacritics,
				ignoreLocation: options.ignoreLocation ?? Config.ignoreLocation
			});
			return {
				type: "fuzzy",
				search(text) {
					return bitap.searchIn(text);
				}
			};
		}
	}
];
var matchersLen = matchers.length;
var ESCAPED_PIPE = "\0";
var OR_TOKEN = "|";
function tokenize(pattern) {
	const tokens = [];
	const len = pattern.length;
	let i = 0;
	while (i < len) {
		while (i < len && pattern[i] === " ") i++;
		if (i >= len) break;
		let j = i;
		while (j < len && pattern[j] !== " " && pattern[j] !== "\"") j++;
		if (j < len && pattern[j] === "\"") {
			j++;
			while (j < len) {
				if (pattern[j] === "\"") {
					const next = j + 1;
					if (next >= len || pattern[next] === " ") {
						j++;
						break;
					}
					if (pattern[next] === "$" && (next + 1 >= len || pattern[next + 1] === " ")) {
						j += 2;
						break;
					}
				}
				j++;
			}
			tokens.push(pattern.substring(i, j));
			i = j;
		} else {
			while (j < len && pattern[j] !== " ") j++;
			tokens.push(pattern.substring(i, j));
			i = j;
		}
	}
	return tokens;
}
function getMatch(pattern, exp) {
	const matches = pattern.match(exp);
	return matches ? matches[1] : null;
}
function parseQuery(pattern, options = {}) {
	return pattern.replace(/\\\|/g, ESCAPED_PIPE).split(OR_TOKEN).map((item) => {
		const query = tokenize(item.replace(/\u0000/g, "|").trim()).filter((item) => item && !!item.trim());
		const results = [];
		for (let i = 0, len = query.length; i < len; i += 1) {
			const queryItem = query[i];
			let found = false;
			let idx = -1;
			while (!found && ++idx < matchersLen) {
				const def = matchers[idx];
				const token = getMatch(queryItem, def.multiRegex);
				if (token) {
					results.push(def.create(token, options));
					found = true;
				}
			}
			if (found) continue;
			idx = -1;
			while (++idx < matchersLen) {
				const def = matchers[idx];
				const token = getMatch(queryItem, def.singleRegex);
				if (token) {
					results.push(def.create(token, options));
					break;
				}
			}
		}
		return results;
	});
}
var ExtendedSearch = class {
	constructor(pattern, { isCaseSensitive = Config.isCaseSensitive, ignoreDiacritics = Config.ignoreDiacritics, includeMatches = Config.includeMatches, minMatchCharLength = Config.minMatchCharLength, ignoreLocation = Config.ignoreLocation, findAllMatches = Config.findAllMatches, location = Config.location, threshold = Config.threshold, distance = Config.distance } = {}) {
		this.query = null;
		this.options = {
			isCaseSensitive,
			ignoreDiacritics,
			includeMatches,
			minMatchCharLength,
			findAllMatches,
			ignoreLocation,
			location,
			threshold,
			distance
		};
		pattern = isCaseSensitive ? pattern : pattern.toLowerCase();
		pattern = ignoreDiacritics ? stripDiacritics(pattern) : pattern;
		this.pattern = pattern;
		this.query = parseQuery(this.pattern, this.options);
	}
	static condition(_, options) {
		return options.useExtendedSearch;
	}
	searchIn(text) {
		const query = this.query;
		if (!query) return {
			isMatch: false,
			score: 1
		};
		const { includeMatches, isCaseSensitive, ignoreDiacritics } = this.options;
		text = isCaseSensitive ? text : text.toLowerCase();
		text = ignoreDiacritics ? stripDiacritics(text) : text;
		let numMatches = 0;
		const allIndices = [];
		let totalScore = 0;
		let hasInverse = false;
		for (let i = 0, qLen = query.length; i < qLen; i += 1) {
			const searchers = query[i];
			allIndices.length = 0;
			numMatches = 0;
			hasInverse = false;
			for (let j = 0, pLen = searchers.length; j < pLen; j += 1) {
				const matcher = searchers[j];
				const { isMatch, indices, score } = matcher.search(text);
				if (isMatch) {
					numMatches += 1;
					totalScore += score;
					if (isInverse(matcher.type)) hasInverse = true;
					if (includeMatches) if (MULTI_MATCH_TYPES.has(matcher.type)) allIndices.push(...indices);
					else allIndices.push(indices);
				} else {
					totalScore = 0;
					numMatches = 0;
					allIndices.length = 0;
					hasInverse = false;
					break;
				}
			}
			if (numMatches) {
				const result = {
					isMatch: true,
					score: totalScore / numMatches
				};
				if (hasInverse) result.hasInverse = true;
				if (includeMatches) result.indices = mergeIndices(allIndices);
				return result;
			}
		}
		return {
			isMatch: false,
			score: 1
		};
	}
};
var registeredSearchers = [];
function register(...args) {
	registeredSearchers.push(...args);
}
function createSearcher(pattern, options) {
	for (let i = 0, len = registeredSearchers.length; i < len; i += 1) {
		const searcherClass = registeredSearchers[i];
		if (searcherClass.condition(pattern, options)) return new searcherClass(pattern, options);
	}
	return new BitapSearch(pattern, options);
}
var LogicalOperator = {
	AND: "$and",
	OR: "$or"
};
var KeyType = {
	PATH: "$path",
	PATTERN: "$val"
};
var isExpression = (query) => !!(query[LogicalOperator.AND] || query[LogicalOperator.OR]);
var isPath = (query) => !!query[KeyType.PATH];
var isLeaf = (query) => !isArray(query) && isObject(query) && !isExpression(query);
var convertToExplicit = (query) => ({ [LogicalOperator.AND]: Object.keys(query).map((key) => ({ [key]: query[key] })) });
function parse(query, options, { auto = true } = {}) {
	const next = (query) => {
		if (isString(query)) {
			const obj = {
				keyId: null,
				pattern: query
			};
			if (auto) obj.searcher = createSearcher(query, options);
			return obj;
		}
		const keys = Object.keys(query);
		const isQueryPath = isPath(query);
		if (!isQueryPath && keys.length > 1 && !isExpression(query)) return next(convertToExplicit(query));
		if (isLeaf(query)) {
			const key = isQueryPath ? query[KeyType.PATH] : keys[0];
			const pattern = isQueryPath ? query[KeyType.PATTERN] : query[key];
			if (!isString(pattern)) throw new Error(LOGICAL_SEARCH_INVALID_QUERY_FOR_KEY(key));
			const obj = {
				keyId: createKeyId(key),
				pattern
			};
			if (auto) obj.searcher = createSearcher(pattern, options);
			return obj;
		}
		const node = {
			children: [],
			operator: keys[0]
		};
		keys.forEach((key) => {
			const value = query[key];
			if (isArray(value)) value.forEach((item) => {
				node.children.push(next(item));
			});
		});
		return node;
	};
	if (!isExpression(query)) query = convertToExplicit(query);
	return next(query);
}
function computeScoreSingle(matches, { ignoreFieldNorm = Config.ignoreFieldNorm }) {
	let totalScore = 1;
	matches.forEach(({ key, norm, score }) => {
		const weight = key ? key.weight : null;
		totalScore *= Math.pow(score === 0 && weight ? Number.EPSILON : score, (weight || 1) * (ignoreFieldNorm ? 1 : norm));
	});
	return totalScore;
}
function computeScore(results, { ignoreFieldNorm = Config.ignoreFieldNorm }) {
	results.forEach((result) => {
		result.score = computeScoreSingle(result.matches, { ignoreFieldNorm });
	});
}
var MaxHeap = class {
	constructor(limit) {
		this.limit = limit;
		this.heap = [];
	}
	get size() {
		return this.heap.length;
	}
	shouldInsert(score) {
		return this.size < this.limit || score < this.heap[0].score;
	}
	insert(item) {
		if (this.size < this.limit) {
			this.heap.push(item);
			this._bubbleUp(this.size - 1);
		} else if (item.score < this.heap[0].score) {
			this.heap[0] = item;
			this._sinkDown(0);
		}
	}
	extractSorted(sortFn) {
		return this.heap.sort(sortFn);
	}
	_bubbleUp(i) {
		const heap = this.heap;
		while (i > 0) {
			const parent = i - 1 >> 1;
			if (heap[i].score <= heap[parent].score) break;
			const tmp = heap[i];
			heap[i] = heap[parent];
			heap[parent] = tmp;
			i = parent;
		}
	}
	_sinkDown(i) {
		const heap = this.heap;
		const len = heap.length;
		let largest = i;
		do {
			i = largest;
			const left = 2 * i + 1;
			const right = 2 * i + 2;
			if (left < len && heap[left].score > heap[largest].score) largest = left;
			if (right < len && heap[right].score > heap[largest].score) largest = right;
			if (largest !== i) {
				const tmp = heap[i];
				heap[i] = heap[largest];
				heap[largest] = tmp;
			}
		} while (largest !== i);
	}
};
function formatMatches(result) {
	const matches = [];
	result.matches.forEach((match) => {
		if (!isDefined(match.indices) || !match.indices.length) return;
		const obj = {
			indices: match.indices,
			value: match.value
		};
		if (match.key) obj.key = match.key.id;
		if (match.idx > -1) obj.refIndex = match.idx;
		matches.push(obj);
	});
	return matches;
}
function format(results, docs, { includeMatches = Config.includeMatches, includeScore = Config.includeScore } = {}) {
	return results.map((result) => {
		const { idx } = result;
		const data = {
			item: docs[idx],
			refIndex: idx
		};
		if (includeMatches) data.matches = formatMatches(result);
		if (includeScore) data.score = result.score;
		return data;
	});
}
var DEFAULT_TOKEN = /[\p{L}\p{M}\p{N}_]+/gu;
var warned = /* @__PURE__ */ new WeakSet();
function warnNonGlobal(regex) {
	if (!warned.has(regex)) {
		warned.add(regex);
		console.warn(`[Fuse] tokenize regex ${regex} lacks the global flag; only the first match per text will be returned. Add the 'g' flag.`);
	}
}
function resolveTokenize(tokenize) {
	if (typeof tokenize === "function") {
		let validated = false;
		return (text) => {
			const result = tokenize(text);
			if (!validated) {
				validated = true;
				if (!Array.isArray(result) || result.some((t) => typeof t !== "string")) throw new Error(`[Fuse] tokenize function must return string[]; received ${Array.isArray(result) ? "array containing non-strings" : typeof result}.`);
			}
			return result;
		};
	}
	if (tokenize instanceof RegExp) {
		if (!tokenize.global) warnNonGlobal(tokenize);
		return (text) => text.match(tokenize) || [];
	}
	return (text) => text.match(DEFAULT_TOKEN) || [];
}
function createAnalyzer({ isCaseSensitive = false, ignoreDiacritics = false, tokenize } = {}) {
	const tokenizeFn = resolveTokenize(tokenize);
	return { tokenize(text) {
		if (!isCaseSensitive) text = text.toLowerCase();
		if (ignoreDiacritics) text = stripDiacritics(text);
		return tokenizeFn(text);
	} };
}
var TokenSearch = class {
	static condition(_, options) {
		return options.useTokenSearch;
	}
	constructor(pattern, options) {
		this.options = options;
		this.analyzer = createAnalyzer({
			isCaseSensitive: options.isCaseSensitive,
			ignoreDiacritics: options.ignoreDiacritics,
			tokenize: options.tokenize
		});
		const queryTerms = this.analyzer.tokenize(pattern);
		const { df, fieldCount } = options._invertedIndex;
		this.termSearchers = [];
		this.idfWeights = [];
		for (const term of queryTerms) {
			this.termSearchers.push(new BitapSearch(term, {
				location: options.location,
				threshold: options.threshold,
				distance: options.distance,
				includeMatches: options.includeMatches,
				findAllMatches: options.findAllMatches,
				minMatchCharLength: options.minMatchCharLength,
				isCaseSensitive: options.isCaseSensitive,
				ignoreDiacritics: options.ignoreDiacritics,
				ignoreLocation: true
			}));
			const docFreq = df.get(term) || 0;
			const idf = Math.log(1 + (fieldCount - docFreq + .5) / (docFreq + .5));
			this.idfWeights.push(idf);
		}
		this.combineAll = options.tokenMatch === "all";
		this.numTerms = this.termSearchers.length;
		this.useMask = this.numTerms <= 31;
	}
	searchIn(text) {
		if (!this.termSearchers.length) return {
			isMatch: false,
			score: 1
		};
		const allIndices = [];
		let weightedScore = 0;
		let maxPossibleScore = 0;
		let matchedCount = 0;
		let matchedMask = 0;
		const matchedTerms = this.combineAll && !this.useMask ? /* @__PURE__ */ new Set() : null;
		for (let i = 0; i < this.termSearchers.length; i++) {
			const result = this.termSearchers[i].searchIn(text);
			const idf = this.idfWeights[i];
			maxPossibleScore += idf;
			if (result.isMatch) {
				matchedCount++;
				weightedScore += idf * (1 - result.score);
				if (result.indices) allIndices.push(...result.indices);
				if (this.combineAll) if (this.useMask) matchedMask |= 1 << i;
				else matchedTerms.add(i);
			}
		}
		if (matchedCount === 0) return {
			isMatch: false,
			score: 1
		};
		const normalized = maxPossibleScore > 0 ? 1 - weightedScore / maxPossibleScore : 0;
		const searchResult = {
			isMatch: true,
			score: Math.max(.001, normalized)
		};
		if (this.options.includeMatches && allIndices.length) searchResult.indices = mergeIndices(allIndices);
		if (this.combineAll) {
			if (this.useMask) searchResult.matchedMask = matchedMask;
			else searchResult.matchedTerms = matchedTerms;
			searchResult.termCount = this.numTerms;
		}
		return searchResult;
	}
};
function addField(index, text, docIdx, analyzer) {
	const tokens = analyzer.tokenize(text);
	if (!tokens.length) return;
	index.fieldCount++;
	index.docFieldCount.set(docIdx, (index.docFieldCount.get(docIdx) || 0) + 1);
	const distinctTerms = new Set(tokens);
	let perDocTerms = index.docTermFieldHits.get(docIdx);
	if (!perDocTerms) {
		perDocTerms = /* @__PURE__ */ new Map();
		index.docTermFieldHits.set(docIdx, perDocTerms);
	}
	for (const term of distinctTerms) {
		perDocTerms.set(term, (perDocTerms.get(term) || 0) + 1);
		index.df.set(term, (index.df.get(term) || 0) + 1);
	}
}
function ingestRecord(index, record, keyCount, analyzer) {
	const { i: docIdx, v, $: fields } = record;
	if (v !== void 0) {
		addField(index, v, docIdx, analyzer);
		return;
	}
	if (!fields) return;
	for (let keyIdx = 0; keyIdx < keyCount; keyIdx++) {
		const value = fields[keyIdx];
		if (!value) continue;
		if (Array.isArray(value)) for (const sub of value) addField(index, sub.v, docIdx, analyzer);
		else addField(index, value.v, docIdx, analyzer);
	}
}
function buildInvertedIndex(records, keyCount, analyzer) {
	const index = {
		fieldCount: 0,
		df: /* @__PURE__ */ new Map(),
		docFieldCount: /* @__PURE__ */ new Map(),
		docTermFieldHits: /* @__PURE__ */ new Map()
	};
	for (const record of records) ingestRecord(index, record, keyCount, analyzer);
	return index;
}
function addToInvertedIndex(index, record, keyCount, analyzer) {
	ingestRecord(index, record, keyCount, analyzer);
}
function removeFromInvertedIndex(index, docIdx) {
	const fieldCount = index.docFieldCount.get(docIdx);
	if (fieldCount === void 0) return;
	index.fieldCount -= fieldCount;
	index.docFieldCount.delete(docIdx);
	const perDocTerms = index.docTermFieldHits.get(docIdx);
	if (!perDocTerms) return;
	for (const [term, hits] of perDocTerms) {
		const next = (index.df.get(term) || 0) - hits;
		if (next <= 0) index.df.delete(term);
		else index.df.set(term, next);
	}
	index.docTermFieldHits.delete(docIdx);
}
function removeAndShiftInvertedIndex(index, removedIndices) {
	if (removedIndices.length === 0) return;
	const sorted = Array.from(new Set(removedIndices)).sort((a, b) => a - b);
	for (const idx of sorted) removeFromInvertedIndex(index, idx);
	const shift = (oldIdx) => {
		let lo = 0;
		let hi = sorted.length;
		while (lo < hi) {
			const mid = lo + hi >>> 1;
			if (sorted[mid] < oldIdx) lo = mid + 1;
			else hi = mid;
		}
		return oldIdx - lo;
	};
	const firstRemoved = sorted[0];
	const shiftedDocFieldCount = /* @__PURE__ */ new Map();
	for (const [oldKey, count] of index.docFieldCount) shiftedDocFieldCount.set(oldKey > firstRemoved ? shift(oldKey) : oldKey, count);
	index.docFieldCount = shiftedDocFieldCount;
	const shiftedDocTermFieldHits = /* @__PURE__ */ new Map();
	for (const [oldKey, terms] of index.docTermFieldHits) shiftedDocTermFieldHits.set(oldKey > firstRemoved ? shift(oldKey) : oldKey, terms);
	index.docTermFieldHits = shiftedDocTermFieldHits;
}
var Fuse = class {
	constructor(docs, options, index) {
		this.options = {
			...Config,
			...options
		};
		if (this.options.useExtendedSearch && false);
		if (this.options.useTokenSearch && false);
		this._keyStore = new KeyStore(this.options.keys);
		this._docs = docs;
		this._myIndex = null;
		this._invertedIndex = null;
		this.setCollection(docs, index);
		this._lastQuery = null;
		this._lastSearcher = null;
	}
	_getSearcher(query) {
		if (this._lastQuery === query) return this._lastSearcher;
		const searcher = createSearcher(query, this._invertedIndex ? {
			...this.options,
			_invertedIndex: this._invertedIndex
		} : this.options);
		this._lastQuery = query;
		this._lastSearcher = searcher;
		return searcher;
	}
	setCollection(docs, index) {
		this._docs = docs;
		if (index && !(index instanceof FuseIndex)) throw new Error(INCORRECT_INDEX_TYPE);
		this._myIndex = index || createIndex(this.options.keys, this._docs, {
			getFn: this.options.getFn,
			fieldNormWeight: this.options.fieldNormWeight
		});
		if (this.options.useTokenSearch) {
			const analyzer = createAnalyzer({
				isCaseSensitive: this.options.isCaseSensitive,
				ignoreDiacritics: this.options.ignoreDiacritics,
				tokenize: this.options.tokenize
			});
			this._invertedIndex = buildInvertedIndex(this._myIndex.records, this._myIndex.keys.length, analyzer);
		}
		this._invalidateSearcherCache();
	}
	add(doc) {
		if (!isDefined(doc)) return;
		this._docs.push(doc);
		const record = this._myIndex.add(doc, this._docs.length - 1);
		if (this._invertedIndex && record) {
			const analyzer = createAnalyzer({
				isCaseSensitive: this.options.isCaseSensitive,
				ignoreDiacritics: this.options.ignoreDiacritics,
				tokenize: this.options.tokenize
			});
			addToInvertedIndex(this._invertedIndex, record, this._myIndex.keys.length, analyzer);
		}
		this._invalidateSearcherCache();
	}
	remove(predicate = () => false) {
		const results = [];
		const indicesToRemove = [];
		for (let i = 0, len = this._docs.length; i < len; i += 1) if (predicate(this._docs[i], i)) {
			results.push(this._docs[i]);
			indicesToRemove.push(i);
		}
		if (indicesToRemove.length) {
			if (this._invertedIndex) removeAndShiftInvertedIndex(this._invertedIndex, indicesToRemove);
			const toRemove = new Set(indicesToRemove);
			this._docs = this._docs.filter((_, i) => !toRemove.has(i));
			this._myIndex.removeAll(indicesToRemove);
			this._invalidateSearcherCache();
		}
		return results;
	}
	removeAt(idx) {
		if (!Number.isInteger(idx) || idx < 0 || idx >= this._docs.length) throw new Error(INVALID_DOC_INDEX);
		if (this._invertedIndex) removeAndShiftInvertedIndex(this._invertedIndex, [idx]);
		const doc = this._docs.splice(idx, 1)[0];
		this._myIndex.removeAt(idx);
		this._invalidateSearcherCache();
		return doc;
	}
	_invalidateSearcherCache() {
		this._lastQuery = null;
		this._lastSearcher = null;
	}
	getIndex() {
		return this._myIndex;
	}
	search(query, options) {
		const { limit = -1 } = options || {};
		const { includeMatches, includeScore, shouldSort, sortFn, ignoreFieldNorm } = this.options;
		if (isString(query) && !query.trim()) {
			let docs = this._docs.map((item, idx) => ({
				item,
				refIndex: idx
			}));
			if (isNumber(limit) && limit > -1) docs = docs.slice(0, limit);
			return docs;
		}
		const useHeap = isNumber(limit) && limit > 0 && isString(query);
		let results;
		if (useHeap) {
			const heap = new MaxHeap(limit);
			if (isString(this._docs[0])) this._searchStringList(query, {
				heap,
				ignoreFieldNorm
			});
			else this._searchObjectList(query, {
				heap,
				ignoreFieldNorm
			});
			results = heap.extractSorted(sortFn);
		} else {
			results = isString(query) ? isString(this._docs[0]) ? this._searchStringList(query) : this._searchObjectList(query) : this._searchLogical(query);
			computeScore(results, { ignoreFieldNorm });
			if (shouldSort) results.sort(sortFn);
			if (isNumber(limit) && limit > -1) results = results.slice(0, limit);
		}
		return format(results, this._docs, {
			includeMatches,
			includeScore
		});
	}
	_searchStringList(query, { heap, ignoreFieldNorm } = {}) {
		const searcher = this._getSearcher(query);
		const requireAllTokens = this.options.useTokenSearch && this.options.tokenMatch === "all";
		const { records } = this._myIndex;
		const results = heap ? null : [];
		records.forEach(({ v: text, i: idx, n: norm }) => {
			if (!isDefined(text)) return;
			const searchResult = searcher.searchIn(text);
			if (searchResult.isMatch) {
				const match = {
					score: searchResult.score,
					value: text,
					norm,
					indices: searchResult.indices
				};
				if (requireAllTokens) {
					match.matchedMask = searchResult.matchedMask;
					match.matchedTerms = searchResult.matchedTerms;
					match.termCount = searchResult.termCount;
				}
				const matches = [match];
				if (!requireAllTokens || this._coversAllTokens(matches)) {
					const result = {
						item: text,
						idx,
						matches
					};
					if (heap) {
						result.score = computeScoreSingle(result.matches, { ignoreFieldNorm });
						if (heap.shouldInsert(result.score)) heap.insert(result);
					} else results.push(result);
				}
			}
		});
		return results;
	}
	_searchLogical(query) {
		const expression = parse(query, this.options);
		const evaluate = (node, item, idx) => {
			if (!("children" in node)) {
				const { keyId, searcher } = node;
				let matches;
				if (keyId === null) {
					matches = [];
					this._myIndex.keys.forEach((key, keyIndex) => {
						matches.push(...this._findMatches({
							key,
							value: item[keyIndex],
							searcher
						}));
					});
				} else matches = this._findMatches({
					key: this._keyStore.get(keyId),
					value: this._myIndex.getValueForItemAtKeyId(item, keyId),
					searcher
				});
				if (matches && matches.length) return [{
					idx,
					item,
					matches
				}];
				return [];
			}
			const { children, operator } = node;
			const res = [];
			for (let i = 0, len = children.length; i < len; i += 1) {
				const child = children[i];
				const result = evaluate(child, item, idx);
				if (result.length) res.push(...result);
				else if (operator === LogicalOperator.AND) return [];
			}
			return res;
		};
		const records = this._myIndex.records;
		const resultMap = /* @__PURE__ */ new Map();
		const results = [];
		records.forEach(({ $: item, i: idx }) => {
			if (isDefined(item)) {
				const expResults = evaluate(expression, item, idx);
				if (expResults.length) {
					if (!resultMap.has(idx)) {
						resultMap.set(idx, {
							idx,
							item,
							matches: []
						});
						results.push(resultMap.get(idx));
					}
					expResults.forEach(({ matches }) => {
						resultMap.get(idx).matches.push(...matches);
					});
				}
			}
		});
		return results;
	}
	_searchObjectList(query, { heap, ignoreFieldNorm } = {}) {
		const searcher = this._getSearcher(query);
		const requireAllTokens = this.options.useTokenSearch && this.options.tokenMatch === "all";
		const { keys, records } = this._myIndex;
		const results = heap ? null : [];
		records.forEach(({ $: item, i: idx }) => {
			if (!isDefined(item)) return;
			const matches = [];
			let anyKeyFailed = false;
			let hasInverse = false;
			keys.forEach((key, keyIndex) => {
				const keyMatches = this._findMatches({
					key,
					value: item[keyIndex],
					searcher
				});
				if (keyMatches.length) {
					matches.push(...keyMatches);
					if (keyMatches[0].hasInverse) hasInverse = true;
				} else anyKeyFailed = true;
			});
			if (hasInverse && anyKeyFailed) return;
			if (matches.length && (!requireAllTokens || this._coversAllTokens(matches))) {
				const result = {
					idx,
					item,
					matches
				};
				if (heap) {
					result.score = computeScoreSingle(result.matches, { ignoreFieldNorm });
					if (heap.shouldInsert(result.score)) heap.insert(result);
				} else results.push(result);
			}
		});
		return results;
	}
	_findMatches({ key, value, searcher }) {
		if (!isDefined(value)) return [];
		const matches = [];
		if (isArray(value)) value.forEach(({ v: text, i: idx, n: norm }) => {
			if (!isDefined(text)) return;
			const searchResult = searcher.searchIn(text);
			if (searchResult.isMatch) {
				const match = {
					score: searchResult.score,
					key,
					value: text,
					idx,
					norm,
					indices: searchResult.indices,
					hasInverse: searchResult.hasInverse
				};
				if (searchResult.termCount !== void 0) {
					match.matchedMask = searchResult.matchedMask;
					match.matchedTerms = searchResult.matchedTerms;
					match.termCount = searchResult.termCount;
				}
				matches.push(match);
			}
		});
		else {
			const { v: text, n: norm } = value;
			const searchResult = searcher.searchIn(text);
			if (searchResult.isMatch) {
				const match = {
					score: searchResult.score,
					key,
					value: text,
					norm,
					indices: searchResult.indices,
					hasInverse: searchResult.hasInverse
				};
				if (searchResult.termCount !== void 0) {
					match.matchedMask = searchResult.matchedMask;
					match.matchedTerms = searchResult.matchedTerms;
					match.termCount = searchResult.termCount;
				}
				matches.push(match);
			}
		}
		return matches;
	}
	_coversAllTokens(matches) {
		const termCount = matches.length ? matches[0].termCount : void 0;
		if (termCount === void 0) return true;
		if (termCount <= 31) {
			let coverage = 0;
			for (let i = 0; i < matches.length; i++) coverage |= matches[i].matchedMask || 0;
			return coverage === 2 ** termCount - 1;
		}
		const coverage = /* @__PURE__ */ new Set();
		for (let i = 0; i < matches.length; i++) {
			const terms = matches[i].matchedTerms;
			if (terms) for (const t of terms) coverage.add(t);
		}
		return coverage.size === termCount;
	}
};
Fuse.version = "7.4.2";
Fuse.createIndex = createIndex;
Fuse.parseIndex = parseIndex;
Fuse.config = Config;
Fuse.match = function(pattern, text, options) {
	if (options && options.useTokenSearch) throw new Error(FUSE_MATCH_TOKEN_SEARCH_UNSUPPORTED);
	return createSearcher(pattern, {
		...Config,
		...options
	}).searchIn(text);
};
Fuse.parseQuery = parse;
register(ExtendedSearch);
register(TokenSearch);
Fuse.use = function(...plugins) {
	plugins.forEach((plugin) => register(plugin));
};
var entry_default = Fuse;
//#endregion
//#region \0plugin-vue:export-helper
var _plugin_vue_export_helper_default = (sfc, props) => {
	const target = sfc.__vccOpts || sfc;
	for (const [key, val] of props) target[key] = val;
	return target;
};
//#endregion
//#region src/components/BuildApp.vue
var pageSize = 25;
var _sfc_main = /*@__PURE__*/ defineComponent({
	__name: "BuildApp",
	setup(__props, { expose: __expose }) {
		__expose();
		const slotOrder = [
			{
				kind: "case",
				label: "Case",
				actionLabel: "Browse cases"
			},
			{
				kind: "gpu",
				label: "GPU",
				actionLabel: "Browse GPUs"
			},
			{
				kind: "psu",
				label: "Power supply",
				actionLabel: "View PSUs"
			},
			{
				kind: "cpu-cooler",
				label: "CPU cooler",
				actionLabel: "Browse coolers"
			},
			{
				kind: "motherboard",
				label: "Motherboard",
				actionLabel: "Browse boards"
			},
			{
				kind: "ram",
				label: "RAM",
				actionLabel: "Browse memory"
			}
		];
		const tabOrder = [
			"gpu",
			"cpu-cooler",
			"psu",
			"case",
			"motherboard",
			"ram"
		];
		const genericKinds = /* @__PURE__ */ new Set([
			"psu",
			"cpu-cooler",
			"motherboard",
			"ram"
		]);
		const selectedIds = ref({});
		const activeKind = ref("gpu");
		const search = ref("");
		const page = ref(1);
		const pending = ref(true);
		const error = ref("");
		const genericPending = ref(false);
		const genericError = ref("");
		const partsData = ref(null);
		const genericCatalog = ref(null);
		const lookupParts = ref({});
		const hydrated = ref(false);
		const cases = computed(() => partsData.value?.cases ?? []);
		const gpus = computed(() => partsData.value?.gpus ?? []);
		const partIndex = computed(() => {
			const index = /* @__PURE__ */ new Map();
			cases.value.forEach((part) => index.set(part.id, part));
			gpus.value.forEach((part) => index.set(part.id, part));
			Object.values(lookupParts.value).forEach((part) => index.set(part.id, part));
			return index;
		});
		const activeCase = computed(() => {
			const id = selectedIds.value.case;
			if (!id) return null;
			const part = partIndex.value.get(id);
			return part?.kind === "case" ? part : null;
		});
		const activeGpu = computed(() => {
			const id = selectedIds.value.gpu;
			if (!id) return null;
			const part = partIndex.value.get(id);
			return part?.kind === "gpu" ? part : null;
		});
		const compatibility = computed(() => {
			if (!activeCase.value || !activeGpu.value) return null;
			return checkCaseGpuCompatibility(activeCase.value, activeGpu.value);
		});
		const buildStatus = computed(() => compatibility.value?.verdict ?? "in-progress");
		const buildStatusLabel = computed(() => {
			if (buildStatus.value === "in-progress") return "IN PROGRESS";
			return buildStatus.value.toUpperCase();
		});
		const buildStatusCopy = computed(() => {
			if (buildStatus.value === "in-progress") return "Select a case and a GPU to evaluate fitment.";
			if (buildStatus.value === "pass") return "Known dimensions fit within the active build.";
			if (buildStatus.value === "conditional") return "This build has warnings or uncertain fitment data.";
			return "This build contains at least one known hard conflict.";
		});
		const caseFuse = computed(() => new entry_default(cases.value, {
			keys: [
				"name",
				"seller",
				"style",
				"status"
			],
			threshold: .28,
			ignoreLocation: true
		}));
		const gpuFuse = computed(() => new entry_default(gpus.value, {
			keys: [
				"brand",
				"model",
				"name",
				"chipset"
			],
			threshold: .28,
			ignoreLocation: true
		}));
		const localCaseCandidates = computed(() => {
			if (!search.value.trim()) return cases.value;
			return caseFuse.value.search(search.value.trim()).map((match) => match.item);
		});
		const localGpuCandidates = computed(() => {
			if (!search.value.trim()) return gpus.value;
			return gpuFuse.value.search(search.value.trim()).map((match) => match.item);
		});
		const totalRows = computed(() => {
			if (activeKind.value === "case") return localCaseCandidates.value.length;
			if (activeKind.value === "gpu") return localGpuCandidates.value.length;
			return genericCatalog.value?.summary.filteredTotal ?? 0;
		});
		const pageCount = computed(() => Math.max(1, Math.ceil(totalRows.value / pageSize)));
		const displayStart = computed(() => totalRows.value ? (page.value - 1) * pageSize + 1 : 0);
		const displayEnd = computed(() => Math.min(page.value * pageSize, totalRows.value));
		const selectedSlots = computed(() => slotOrder.map(({ kind }) => {
			const id = selectedIds.value[kind];
			if (!id) return {
				kind,
				id: "",
				state: "resolved",
				part: null
			};
			return {
				kind,
				id,
				state: partIndex.value.has(id) ? "resolved" : "unresolved",
				part: partIndex.value.get(id) ?? null
			};
		}));
		const buildIssues = computed(() => {
			const sections = [];
			if (activeGpu.value && compatibility.value?.issues.length) sections.push({
				kind: "gpu",
				issues: compatibility.value.issues.map((issue) => issue.message)
			});
			if (selectedIds.value.case && !activeCase.value) sections.push({
				kind: "case",
				issues: [`Selected case id "${selectedIds.value.case}" could not be loaded from the current catalog.`]
			});
			if (selectedIds.value.gpu && !activeGpu.value) sections.push({
				kind: "gpu",
				issues: [`Selected GPU id "${selectedIds.value.gpu}" could not be loaded from the current catalog.`]
			});
			slotOrder.filter(({ kind }) => genericKinds.has(kind) && selectedIds.value[kind] && !partIndex.value.get(selectedIds.value[kind] ?? "")).forEach(({ kind, label }) => {
				sections.push({
					kind,
					issues: [`Selected ${label.toLowerCase()} id "${selectedIds.value[kind]}" could not be loaded from the current catalog.`]
				});
			});
			return sections;
		});
		const candidateRows = computed(() => {
			const rows = activeKind.value === "case" ? localCaseCandidates.value.map((part) => buildCaseRow(part)) : activeKind.value === "gpu" ? localGpuCandidates.value.map((part) => buildGpuRow(part)) : (genericCatalog.value?.parts ?? []).map((part) => buildGenericRow(part));
			if (activeKind.value === "case" || activeKind.value === "gpu") {
				rows.sort((a, b) => {
					const verdictDelta = verdictRank(a.verdict) - verdictRank(b.verdict);
					if (verdictDelta !== 0) return verdictDelta;
					if (a.selected !== b.selected) return a.selected ? -1 : 1;
					return a.title.localeCompare(b.title);
				});
				const start = (page.value - 1) * pageSize;
				const end = start + pageSize;
				return rows.slice(start, end);
			}
			return rows;
		});
		const activeConstraintLabel = computed(() => {
			if (activeCase.value) return `${displayTitle(activeCase.value)}${activeCase.value.dimensions.volumeL ? ` (${formatValue(activeCase.value.dimensions.volumeL, "L")})` : ""}`;
			if (activeGpu.value) return displayTitle(activeGpu.value);
			return "No active constraints";
		});
		const constraintMeters = computed(() => {
			if (activeKind.value === "gpu" && activeCase.value) return [
				{
					label: "Length",
					value: activeCase.value.dimensions.gpuLengthMm ? `Max ${formatValue(activeCase.value.dimensions.gpuLengthMm, "mm")}` : "Unknown",
					tone: "pass",
					ratio: ratioFromLimit(activeCase.value.dimensions.gpuLengthMm, 400)
				},
				{
					label: "Thickness",
					value: activeCase.value.dimensions.gpuThicknessMm ? `Max ${formatValue(activeCase.value.dimensions.gpuThicknessMm, "mm")}` : "Unknown",
					tone: "conditional",
					ratio: ratioFromLimit(activeCase.value.dimensions.gpuThicknessMm, 90)
				},
				{
					label: "Slots",
					value: activeCase.value.dimensions.pcieSlots ? `Max ${formatValue(activeCase.value.dimensions.pcieSlots)}` : "Unknown",
					tone: "neutral",
					ratio: ratioFromLimit(activeCase.value.dimensions.pcieSlots, 4)
				}
			];
			if (activeKind.value === "case" && activeGpu.value) return [
				{
					label: "GPU length",
					value: activeGpu.value.dimensions.lengthMm ? `${formatValue(activeGpu.value.dimensions.lengthMm, "mm")} required` : "Unknown",
					tone: "pass",
					ratio: ratioFromLimit(activeGpu.value.dimensions.lengthMm, 400)
				},
				{
					label: "GPU thickness",
					value: activeGpu.value.dimensions.thicknessMm ? `${formatValue(activeGpu.value.dimensions.thicknessMm, "mm")} required` : "Unknown",
					tone: "conditional",
					ratio: ratioFromLimit(activeGpu.value.dimensions.thicknessMm, 90)
				},
				{
					label: "Slots",
					value: activeGpu.value.dimensions.pcieSlots ? `${formatValue(activeGpu.value.dimensions.pcieSlots)} required` : "Unknown",
					tone: "neutral",
					ratio: ratioFromLimit(activeGpu.value.dimensions.pcieSlots, 4)
				}
			];
			if (activeKind.value === "cpu-cooler" && activeCase.value) return [{
				label: "Cooler height",
				value: activeCase.value.dimensions.cpuCoolerHeightMm ? `Max ${formatValue(activeCase.value.dimensions.cpuCoolerHeightMm, "mm")}` : "Unknown",
				tone: "pass",
				ratio: ratioFromLimit(activeCase.value.dimensions.cpuCoolerHeightMm, 90)
			}];
			if (activeKind.value === "psu" && activeCase.value) return [{
				label: "PSU envelope",
				value: activeCase.value.psu || "Unknown",
				tone: "neutral",
				ratio: .44
			}];
			return [{
				label: "No derived constraints",
				value: "Select a case or GPU to shape this table",
				tone: "neutral",
				ratio: .28
			}];
		});
		onMounted(async () => {
			hydrateFromUrl();
			await loadParts();
			await loadLookupSelections();
			await loadGenericCatalog();
			hydrated.value = true;
		});
		watch(pageCount, (next) => {
			if (page.value > next) page.value = next;
		});
		watch(() => [
			activeKind.value,
			search.value,
			page.value,
			...slotOrder.map(({ kind }) => selectedIds.value[kind] ?? "")
		], async (_, __) => {
			if (!hydrated.value) return;
			syncUrl();
			await loadLookupSelections();
			await loadGenericCatalog();
		});
		function hydrateFromUrl() {
			if (typeof window === "undefined") return;
			const params = new URL(window.location.href).searchParams;
			const nextIds = {};
			slotOrder.forEach(({ kind }) => {
				const value = params.get(kind);
				if (value) nextIds[kind] = value;
			});
			selectedIds.value = nextIds;
			search.value = params.get("search") ?? "";
			page.value = Math.max(1, Number(params.get("page") ?? 1) || 1);
			activeKind.value = sanitizeKind(params.get("kind")) ?? inferKind(nextIds);
		}
		function syncUrl() {
			if (typeof window === "undefined") return;
			const params = new URLSearchParams();
			slotOrder.forEach(({ kind }) => {
				const value = selectedIds.value[kind];
				if (value) params.set(kind, value);
			});
			params.set("kind", activeKind.value);
			if (search.value.trim()) params.set("search", search.value.trim());
			if (page.value > 1) params.set("page", String(page.value));
			const next = `${window.location.pathname}?${params.toString()}`;
			window.history.replaceState({}, "", next);
		}
		async function loadParts() {
			pending.value = true;
			error.value = "";
			try {
				const response = await fetch("/api/parts");
				if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
				partsData.value = await response.json();
			} catch (caught) {
				error.value = caught instanceof Error ? caught.message : String(caught);
			} finally {
				pending.value = false;
			}
		}
		async function loadLookupSelections() {
			const ids = slotOrder.map(({ kind }) => selectedIds.value[kind]).filter((id) => Boolean(id)).filter((id) => !partIndex.value.has(id));
			if (!ids.length) return;
			try {
				const response = await fetch(`/api/catalog/lookup?ids=${encodeURIComponent(ids.join(","))}`);
				if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
				const payload = await response.json();
				const nextLookup = { ...lookupParts.value };
				payload.parts.forEach((part) => {
					nextLookup[part.id] = part;
				});
				lookupParts.value = nextLookup;
			} catch {}
		}
		async function loadGenericCatalog() {
			if (!genericKinds.has(activeKind.value)) {
				genericCatalog.value = null;
				genericPending.value = false;
				genericError.value = "";
				return;
			}
			genericPending.value = true;
			genericError.value = "";
			try {
				const params = new URLSearchParams({
					kind: activeKind.value,
					page: String(page.value),
					pageSize: String(pageSize)
				});
				if (search.value.trim()) params.set("search", search.value.trim());
				const response = await fetch(`/api/catalog?${params.toString()}`);
				if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
				genericCatalog.value = await response.json();
			} catch (caught) {
				genericError.value = caught instanceof Error ? caught.message : String(caught);
			} finally {
				genericPending.value = false;
			}
		}
		function inferKind(ids) {
			if (ids.case && !ids.gpu) return "gpu";
			if (ids.gpu && !ids.case) return "case";
			return "gpu";
		}
		function sanitizeKind(value) {
			if (!value) return null;
			return slotOrder.some((slot) => slot.kind === value) ? value : null;
		}
		function resetPage() {
			page.value = 1;
		}
		function changeKind(kind) {
			if (activeKind.value === kind) return;
			activeKind.value = kind;
			resetPage();
		}
		function onSearchInput(event) {
			search.value = event.target.value;
			resetPage();
		}
		function selectPart(part) {
			const kind = part.kind;
			if (!slotOrder.some((slot) => slot.kind === kind)) return;
			selectedIds.value = {
				...selectedIds.value,
				[kind]: part.id
			};
			resetPage();
		}
		function clearSlot(kind) {
			const next = { ...selectedIds.value };
			delete next[kind];
			selectedIds.value = next;
			resetPage();
		}
		function openSlot(kind) {
			changeKind(kind);
		}
		function verdictRank(verdict) {
			if (verdict === "pass") return 0;
			if (verdict === "conditional") return 1;
			if (verdict === "fail") return 2;
			return 3;
		}
		function verdictLabel(verdict) {
			if (verdict === "unscored") return "UNSCORED";
			return verdict.toUpperCase();
		}
		function verdictCopy(verdict) {
			if (verdict === "pass") return "Known fit";
			if (verdict === "conditional") return "Caution";
			if (verdict === "fail") return "Conflict";
			return "Not yet evaluated";
		}
		function slotVerdict(kind) {
			if (kind === "gpu" && activeGpu.value && compatibility.value) return compatibility.value.verdict;
			if (kind === "case" && activeCase.value) return "pass";
			if (genericKinds.has(kind) && selectedIds.value[kind]) return "conditional";
			return "unscored";
		}
		function slotNote(kind) {
			if (kind === "gpu" && compatibility.value?.issues.length) return firstIssue(compatibility.value.issues);
			if (kind === "psu" && activeCase.value?.psu) return `Constraint: ${activeCase.value.psu}`;
			if (kind === "cpu-cooler" && activeCase.value?.dimensions.cpuCoolerHeightMm) return `Constraint: max ${formatValue(activeCase.value.dimensions.cpuCoolerHeightMm, "mm")}`;
			if (genericKinds.has(kind) && selectedIds.value[kind]) return "Selection stored in the build, fitment logic for this slot lands in a later layer.";
			return "";
		}
		function displayTitle(part) {
			if (!part) return "Missing catalog record";
			if (part.kind === "case") return `${part.seller} ${part.name}`.trim();
			if (part.kind === "gpu") return `${part.brand} ${part.model || part.name}`.trim();
			return part.displayName || [part.brand, part.name].filter(Boolean).join(" ").trim() || part.id;
		}
		function displaySubtitle(part) {
			if (!part) return "";
			if (part.kind === "case") return part.dimensions.volumeL ? `${formatValue(part.dimensions.volumeL, "L")} volume` : part.style || part.sourceSheet;
			if (part.kind === "gpu") return part.chipset || `${formatValue(part.tdpW, "W")} TDP`;
			return `${part.sourceSheet} #${part.rowNumber}`;
		}
		function buildCaseRow(part) {
			const selected = selectedIds.value.case === part.id;
			const result = activeGpu.value ? checkCaseGpuCompatibility(part, activeGpu.value) : null;
			return {
				id: part.id,
				kind: "case",
				title: displayTitle(part),
				subtitle: part.style || "Case",
				details: part.status || part.sourceSheet,
				numericCells: [
					formatValue(part.dimensions.volumeL, "L"),
					formatValue(part.dimensions.gpuLengthMm, "mm"),
					formatValue(part.dimensions.gpuThicknessMm, "mm"),
					formatValue(part.dimensions.pcieSlots)
				],
				verdict: result?.verdict ?? (activeGpu.value ? "conditional" : "unscored"),
				note: result ? firstIssue(result.issues) : "Select a GPU to evaluate case-side fitment evidence.",
				selected,
				actionLabel: selected ? "Remove" : "Add",
				actionTone: selected ? "remove" : "add",
				source: part
			};
		}
		function buildGpuRow(part) {
			const selected = selectedIds.value.gpu === part.id;
			const result = activeCase.value ? checkCaseGpuCompatibility(activeCase.value, part) : null;
			const lengthCell = formatValue(part.dimensions.lengthMm, "mm");
			const thicknessCell = formatValue(part.dimensions.thicknessMm, "mm");
			const slotsCell = formatValue(part.dimensions.pcieSlots);
			return {
				id: part.id,
				kind: "gpu",
				title: displayTitle(part),
				subtitle: part.chipset || part.name || "GPU",
				details: part.pciePins || "Power connector unknown",
				numericCells: [
					lengthCell,
					thicknessCell,
					slotsCell,
					formatValue(part.tdpW, "W")
				],
				verdict: result?.verdict ?? (activeCase.value ? "conditional" : "unscored"),
				note: result ? firstIssue(result.issues) : "Select a case to expose hard fitment limits and cautionary rows.",
				selected,
				actionLabel: selected ? "Remove" : "Add",
				actionTone: selected ? "remove" : "add",
				source: part
			};
		}
		function buildGenericRow(part) {
			const selected = selectedIds.value[part.kind] === part.id;
			const specs = Object.entries(part.raw).filter(([, value]) => value.trim()).slice(0, 3).map(([key, value]) => `${key}: ${value}`).join(" / ");
			return {
				id: part.id,
				kind: part.kind,
				title: displayTitle(part),
				subtitle: part.status || part.sourceSheet,
				details: specs || "No structured fitment evidence yet for this slot.",
				numericCells: [
					part.sourceSheet,
					`#${part.rowNumber}`,
					part.status || "Catalog record",
					String(part.flags.length)
				],
				verdict: "conditional",
				note: "This slot is stored in URL state today, detailed fitment rules land in a later layer.",
				selected,
				actionLabel: selected ? "Remove" : "Add",
				actionTone: selected ? "remove" : "add",
				source: part
			};
		}
		function formatValue(value, unit = "") {
			if (value === null || value === void 0) return "—";
			return `${Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, "")}${unit}`;
		}
		function firstIssue(issues) {
			return issues[0]?.message ?? "No immediate issues in the active fitment rules.";
		}
		function ratioFromLimit(value, ceiling) {
			if (!value) return .34;
			return Math.max(.12, Math.min(.94, value / ceiling));
		}
		function systemPath() {
			if (typeof window === "undefined") return "/build";
			return `${window.location.host}${window.location.pathname}${window.location.search}`;
		}
		const __returned__ = {
			slotOrder,
			tabOrder,
			pageSize,
			genericKinds,
			selectedIds,
			activeKind,
			search,
			page,
			pending,
			error,
			genericPending,
			genericError,
			partsData,
			genericCatalog,
			lookupParts,
			hydrated,
			cases,
			gpus,
			partIndex,
			activeCase,
			activeGpu,
			compatibility,
			buildStatus,
			buildStatusLabel,
			buildStatusCopy,
			caseFuse,
			gpuFuse,
			localCaseCandidates,
			localGpuCandidates,
			totalRows,
			pageCount,
			displayStart,
			displayEnd,
			selectedSlots,
			buildIssues,
			candidateRows,
			activeConstraintLabel,
			constraintMeters,
			hydrateFromUrl,
			syncUrl,
			loadParts,
			loadLookupSelections,
			loadGenericCatalog,
			inferKind,
			sanitizeKind,
			resetPage,
			changeKind,
			onSearchInput,
			selectPart,
			clearSlot,
			openSlot,
			verdictRank,
			verdictLabel,
			verdictCopy,
			slotVerdict,
			slotNote,
			displayTitle,
			displaySubtitle,
			buildCaseRow,
			buildGpuRow,
			buildGenericRow,
			formatValue,
			firstIssue,
			ratioFromLimit,
			systemPath
		};
		Object.defineProperty(__returned__, "__isScriptSetup", {
			enumerable: false,
			value: true
		});
		return __returned__;
	}
});
function _sfc_ssrRender(_ctx, _push, _parent, _attrs, $props, $setup, $data, $options) {
	_push(`<div${ssrRenderAttrs(mergeProps({ class: "build-page" }, _attrs))} data-v-394a91c4><header class="topbar" data-v-394a91c4><div class="topbar__inner" data-v-394a91c4><div class="brand" data-v-394a91c4>SFF_DATA_LOG</div><nav class="nav" aria-label="Primary" data-v-394a91c4><a class="nav__item nav__item--active" href="/build" data-v-394a91c4><svg viewBox="0 0 24 24" aria-hidden="true" data-v-394a91c4><path d="M12 4l8 8-8 8M4 12h16" data-v-394a91c4></path></svg><span data-v-394a91c4>Builder</span></a><a class="nav__item" href="/" data-v-394a91c4><svg viewBox="0 0 24 24" aria-hidden="true" data-v-394a91c4><path d="M5 6h14v12H5zM8 10h8M8 14h5" data-v-394a91c4></path></svg><span data-v-394a91c4>Launcher</span></a></nav><div class="topbar__tools" data-v-394a91c4><button class="icon-button" type="button" aria-label="Search" data-v-394a91c4><svg viewBox="0 0 24 24" aria-hidden="true" data-v-394a91c4><circle cx="11" cy="11" r="6.5" data-v-394a91c4></circle><path d="M16 16l5 5" data-v-394a91c4></path></svg></button><button class="icon-button" type="button" aria-label="Settings" data-v-394a91c4><svg viewBox="0 0 24 24" aria-hidden="true" data-v-394a91c4><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" data-v-394a91c4></path><circle cx="12" cy="12" r="3.5" data-v-394a91c4></circle></svg></button></div></div></header><div class="system-bar" data-v-394a91c4><div class="system-bar__inner" data-v-394a91c4><div class="system-link" data-v-394a91c4><svg viewBox="0 0 24 24" aria-hidden="true" data-v-394a91c4><path d="M9.5 14.5l-2 2a3 3 0 01-4.2-4.2l3.2-3.2a3 3 0 014.2 0" data-v-394a91c4></path><path d="M14.5 9.5l2-2a3 3 0 114.2 4.2l-3.2 3.2a3 3 0 01-4.2 0" data-v-394a91c4></path><path d="M8.8 15.2l6.4-6.4" data-v-394a91c4></path></svg><span data-v-394a91c4>${ssrInterpolate($setup.systemPath())}</span></div><div class="system-state" data-v-394a91c4><span class="${ssrRenderClass(["system-state__dot", `system-state__dot--${$setup.buildStatus === "in-progress" ? "conditional" : $setup.buildStatus}`])}" data-v-394a91c4></span><span data-v-394a91c4>${ssrInterpolate($setup.buildStatus === "fail" ? "Conflict" : $setup.buildStatus === "conditional" ? "Warning" : $setup.buildStatus === "pass" ? "Clear" : "Draft")}</span><span data-v-394a91c4>v2.0.4-build</span></div></div></div><main class="workspace" data-v-394a91c4><aside class="sidebar" data-v-394a91c4><div class="sidebar__header" data-v-394a91c4><h1 data-v-394a91c4>Current Build</h1><p data-v-394a91c4> Compatibility status: <strong class="${ssrRenderClass(`text-${$setup.buildStatus === "in-progress" ? "conditional" : $setup.buildStatus}`)}" data-v-394a91c4>${ssrInterpolate($setup.buildStatusLabel)}</strong></p><span class="sidebar__summary" data-v-394a91c4>${ssrInterpolate($setup.buildStatusCopy)}</span></div><div class="slot-stack" data-v-394a91c4><!--[-->`);
	ssrRenderList($setup.selectedSlots, (slot) => {
		_push(`<article class="${ssrRenderClass([
			"slot-card",
			`slot-card--${$setup.slotVerdict(slot.kind)}`,
			{
				"slot-card--empty": !slot.id,
				"slot-card--unresolved": slot.state === "unresolved"
			}
		])}" data-v-394a91c4><div class="slot-card__top" data-v-394a91c4><span class="slot-card__label" data-v-394a91c4>${ssrInterpolate($setup.slotOrder.find((entry) => entry.kind === slot.kind)?.label)}</span>`);
		if (slot.id) _push(`<span class="${ssrRenderClass(["badge", `badge--${$setup.slotVerdict(slot.kind)}`])}" data-v-394a91c4>${ssrInterpolate($setup.verdictCopy($setup.slotVerdict(slot.kind)))}</span>`);
		else _push(`<!---->`);
		_push(`</div>`);
		if (slot.id && slot.part) {
			_push(`<!--[--><h2 data-v-394a91c4>${ssrInterpolate($setup.displayTitle(slot.part))}</h2><p class="slot-card__meta" data-v-394a91c4>${ssrInterpolate($setup.displaySubtitle(slot.part))}</p>`);
			if ($setup.slotNote(slot.kind)) _push(`<p class="slot-card__note" data-v-394a91c4>${ssrInterpolate($setup.slotNote(slot.kind))}</p>`);
			else _push(`<!---->`);
			_push(`<div class="slot-card__actions" data-v-394a91c4><button class="button button--ghost" type="button" data-v-394a91c4>Inspect</button><button class="button button--danger" type="button" data-v-394a91c4>Clear</button></div><!--]-->`);
		} else if (slot.id && slot.state === "unresolved") _push(`<!--[--><h2 data-v-394a91c4>Unresolved selection</h2><p class="slot-card__meta" data-v-394a91c4>${ssrInterpolate(slot.id)}</p><p class="slot-card__note" data-v-394a91c4>The id is still preserved in URL state, but the catalog can no longer resolve it.</p><div class="slot-card__actions" data-v-394a91c4><button class="button button--ghost" type="button" data-v-394a91c4>Review slot</button><button class="button button--danger" type="button" data-v-394a91c4>Clear</button></div><!--]-->`);
		else _push(`<!--[--><h2 data-v-394a91c4>Empty</h2><p class="slot-card__meta" data-v-394a91c4>${ssrInterpolate($setup.slotNote(slot.kind) || "No part selected yet.")}</p><div class="slot-card__actions" data-v-394a91c4><button class="button button--ghost" type="button" data-v-394a91c4>${ssrInterpolate($setup.slotOrder.find((entry) => entry.kind === slot.kind)?.actionLabel)}</button></div><!--]-->`);
		_push(`</article>`);
	});
	_push(`<!--]--></div>`);
	if ($setup.buildIssues.length) {
		_push(`<section class="issues-panel" data-v-394a91c4><h3 data-v-394a91c4>Build Issues</h3><!--[-->`);
		ssrRenderList($setup.buildIssues, (section) => {
			_push(`<div class="issues-panel__group" data-v-394a91c4><strong data-v-394a91c4>${ssrInterpolate($setup.slotOrder.find((slot) => slot.kind === section.kind)?.label)}</strong><ul data-v-394a91c4><!--[-->`);
			ssrRenderList(section.issues, (issue) => {
				_push(`<li data-v-394a91c4>${ssrInterpolate(issue)}</li>`);
			});
			_push(`<!--]--></ul></div>`);
		});
		_push(`<!--]--></section>`);
	} else _push(`<!---->`);
	_push(`</aside><section class="main-panel" data-v-394a91c4><div class="main-panel__header" data-v-394a91c4><div data-v-394a91c4><h2 data-v-394a91c4>Hardware Library</h2><p data-v-394a91c4>Active constraints: <strong data-v-394a91c4>${ssrInterpolate($setup.activeConstraintLabel)}</strong></p></div><div class="toolbar" data-v-394a91c4><label class="search-field" data-v-394a91c4><svg viewBox="0 0 24 24" aria-hidden="true" data-v-394a91c4><circle cx="11" cy="11" r="6.5" data-v-394a91c4></circle><path d="M16 16l5 5" data-v-394a91c4></path></svg><input${ssrRenderAttr("value", $setup.search)} type="search" placeholder="Search models..." data-v-394a91c4></label></div></div><div class="kind-tabs" role="tablist" aria-label="Part kinds" data-v-394a91c4><!--[-->`);
	ssrRenderList($setup.tabOrder, (kind) => {
		_push(`<button class="${ssrRenderClass(["kind-tab", { "kind-tab--active": $setup.activeKind === kind }])}" type="button" data-v-394a91c4>${ssrInterpolate(kind)}</button>`);
	});
	_push(`<!--]--></div><div class="constraint-strip" data-v-394a91c4><!--[-->`);
	ssrRenderList($setup.constraintMeters, (meter) => {
		_push(`<div class="constraint-meter" data-v-394a91c4><div class="constraint-meter__label" data-v-394a91c4><span data-v-394a91c4>${ssrInterpolate(meter.label)}</span><strong data-v-394a91c4>${ssrInterpolate(meter.value)}</strong></div><div class="constraint-meter__track" data-v-394a91c4><span class="${ssrRenderClass(["constraint-meter__fill", `constraint-meter__fill--${meter.tone}`])}" style="${ssrRenderStyle({ width: `${meter.ratio * 100}%` })}" data-v-394a91c4></span></div></div>`);
	});
	_push(`<!--]--></div>`);
	if ($setup.pending) _push(`<div class="state-box" data-v-394a91c4>Loading build data...</div>`);
	else if ($setup.error) _push(`<div class="state-box state-box--error" data-v-394a91c4>${ssrInterpolate($setup.error)}</div>`);
	else if ($setup.genericError) _push(`<div class="state-box state-box--error" data-v-394a91c4>${ssrInterpolate($setup.genericError)}</div>`);
	else {
		_push(`<div class="table-shell" data-v-394a91c4><div class="table-scroll" data-v-394a91c4><table class="parts-table" data-v-394a91c4><thead data-v-394a91c4>`);
		if ($setup.activeKind === "gpu") _push(`<tr data-v-394a91c4><th data-v-394a91c4>Status</th><th data-v-394a91c4>Model</th><th data-v-394a91c4>Length</th><th data-v-394a91c4>Thickness</th><th data-v-394a91c4>Slots</th><th data-v-394a91c4>Power</th><th data-v-394a91c4>Action</th></tr>`);
		else if ($setup.activeKind === "case") _push(`<tr data-v-394a91c4><th data-v-394a91c4>Status</th><th data-v-394a91c4>Case</th><th data-v-394a91c4>Volume</th><th data-v-394a91c4>GPU max length</th><th data-v-394a91c4>GPU max thickness</th><th data-v-394a91c4>PCIe slots</th><th data-v-394a91c4>Action</th></tr>`);
		else _push(`<tr data-v-394a91c4><th data-v-394a91c4>Status</th><th data-v-394a91c4>Part</th><th data-v-394a91c4>Source</th><th data-v-394a91c4>Row</th><th data-v-394a91c4>Status</th><th data-v-394a91c4>Flags</th><th data-v-394a91c4>Action</th></tr>`);
		_push(`</thead>`);
		if ($setup.candidateRows.length) {
			_push(`<tbody data-v-394a91c4><!--[-->`);
			ssrRenderList($setup.candidateRows, (row) => {
				_push(`<tr class="${ssrRenderClass([
					"parts-row",
					`parts-row--${row.verdict}`,
					{ "parts-row--selected": row.selected }
				])}" data-v-394a91c4><td class="status-cell" data-v-394a91c4><span class="${ssrRenderClass(["status-chip", `status-chip--${row.verdict}`])}" data-v-394a91c4>${ssrInterpolate($setup.verdictLabel(row.verdict))}</span></td><td data-v-394a91c4><div class="title-cell" data-v-394a91c4><strong data-v-394a91c4>${ssrInterpolate(row.title)}</strong><span data-v-394a91c4>${ssrInterpolate(row.subtitle)}</span><small data-v-394a91c4>${ssrInterpolate(row.note)}</small></div></td><!--[-->`);
				ssrRenderList(row.numericCells, (value) => {
					_push(`<td class="${ssrRenderClass(["mono-cell", { "mono-cell--alert": row.verdict === "fail" && value === row.numericCells[0] }])}" data-v-394a91c4>${ssrInterpolate(value)}</td>`);
				});
				_push(`<!--]--><td class="action-cell" data-v-394a91c4><button class="${ssrRenderClass(["table-button", `table-button--${row.actionTone}`])}" type="button" data-v-394a91c4>${ssrInterpolate(row.actionLabel)}</button></td></tr>`);
			});
			_push(`<!--]--></tbody>`);
		} else _push(`<!---->`);
		_push(`</table>`);
		if (!$setup.candidateRows.length && !$setup.genericPending) _push(`<div class="state-box" data-v-394a91c4>No rows match the active filters.</div>`);
		else _push(`<!---->`);
		_push(`</div><footer class="table-footer" data-v-394a91c4><span data-v-394a91c4>${ssrInterpolate($setup.displayStart)}-${ssrInterpolate($setup.displayEnd)} of ${ssrInterpolate($setup.totalRows)} rows</span><div class="pager" data-v-394a91c4><button class="button button--ghost" type="button"${includeBooleanAttr($setup.page <= 1) ? " disabled" : ""} data-v-394a91c4>Previous</button><strong data-v-394a91c4>Page ${ssrInterpolate($setup.page)} / ${ssrInterpolate($setup.pageCount)}</strong><button class="button button--ghost" type="button"${includeBooleanAttr($setup.page >= $setup.pageCount) ? " disabled" : ""} data-v-394a91c4>Next</button></div></footer></div>`);
	}
	_push(`</section></main></div>`);
}
var _sfc_setup = _sfc_main.setup;
_sfc_main.setup = (props, ctx) => {
	const ssrContext = useSSRContext();
	(ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("src/components/BuildApp.vue");
	return _sfc_setup ? _sfc_setup(props, ctx) : void 0;
};
var BuildApp_default = /*#__PURE__*/ _plugin_vue_export_helper_default(_sfc_main, [["ssrRender", _sfc_ssrRender], ["__scopeId", "data-v-394a91c4"]]);
//#endregion
//#region src/pages/build.astro
var build_exports = /* @__PURE__ */ __exportAll({
	default: () => $$Build,
	file: () => $$file,
	url: () => $$url
});
var $$Build = createComponent(($$result, $$props, $$slots) => {
	return renderTemplate`${renderComponent($$result, "BaseLayout", $$BaseLayout, {
		"title": "SFF Builder | Build",
		"description": "A replayable fitment workspace for selecting parts, inspecting constraints, and scanning pass, conditional, and fail rows."
	}, { "default": ($$result) => renderTemplate`${renderComponent($$result, "BuildApp", BuildApp_default, {
		"client:load": true,
		"client:component-hydration": "load",
		"client:component-path": "D:/dev/sff-website/src/components/BuildApp.vue",
		"client:component-export": "default"
	})}` })}`;
}, "D:/dev/sff-website/src/pages/build.astro", void 0);
var $$file = "D:/dev/sff-website/src/pages/build.astro";
var $$url = "/build";
//#endregion
//#region \0virtual:astro:page:src/pages/build@_@astro
var page = () => build_exports;
//#endregion
export { page };
