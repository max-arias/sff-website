globalThis.process ??= {};
globalThis.process.env ??= {};
import { env } from "cloudflare:workers";
//#region src/server/d1.ts
function getDb() {
	return env.DB;
}
function requireDb() {
	const db = getDb();
	if (!db) throw new Error("D1 binding is unavailable. Configure the DB binding and run the local D1 database.");
	return db;
}
async function loadParts(event) {
	const parts = (await requireDb().prepare("select * from sff_parts where kind in ('case', 'gpu') order by kind, display_name").all()).results ?? [];
	return {
		cases: parts.filter((row) => row.kind === "case").map(rowToCase),
		gpus: parts.filter((row) => row.kind === "gpu").map(rowToGpu),
		source: "d1"
	};
}
async function findCaseAndGpu(event, caseId, gpuId) {
	const parts = await loadParts(event);
	return {
		casePart: parts.cases.find((part) => part.id === caseId) ?? null,
		gpuPart: parts.gpus.find((part) => part.id === gpuId) ?? null,
		source: parts.source
	};
}
async function searchCatalog(event, rawOptions) {
	return searchCatalogRows(event, rawOptions);
}
async function loadCatalogPartsByIds(event, ids) {
	const uniqueIds = [...new Set(ids.filter(Boolean))];
	if (!uniqueIds.length) return {
		source: "d1",
		parts: []
	};
	const rows = await requireDb().prepare(`select * from sff_parts where id in (${uniqueIds.map(() => "?").join(", ")})`).bind(...uniqueIds).all();
	const partsById = new Map((rows.results ?? []).map((row) => [String(row.id), rowToGenericPart(row)]));
	return {
		source: "d1",
		parts: uniqueIds.map((id) => partsById.get(id)).filter((part) => Boolean(part))
	};
}
async function loadCatalog(event, rawOptions = {}) {
	const options = clampCatalogOptions(rawOptions);
	const db = requireDb();
	const offset = (options.page - 1) * options.pageSize;
	let parts = [];
	let filteredTotal = 0;
	if (options.search) {
		const searchIds = (await searchCatalogRows(event, {
			query: options.search,
			kind: options.kind,
			sourceSheet: options.sourceSheet,
			limit: 1e3
		})).suggestions.map((suggestion) => suggestion.id);
		filteredTotal = searchIds.length;
		const pageIds = searchIds.slice(offset, offset + options.pageSize);
		if (pageIds.length) {
			const rows = await db.prepare(`select * from sff_parts where id in (${pageIds.map(() => "?").join(", ")})`).bind(...pageIds).all();
			const rowsById = new Map((rows.results ?? []).map((row) => [String(row.id), rowToGenericPart(row)]));
			parts = pageIds.map((id) => rowsById.get(id)).filter((part) => Boolean(part));
		}
	} else {
		const { where, values } = buildCatalogWhere(options);
		parts = ((await db.prepare(`select * from sff_parts ${where} order by kind, display_name limit ? offset ?`).bind(...values, options.pageSize, offset).all()).results ?? []).map(rowToGenericPart);
		const filteredRows = await db.prepare(`select count(*) as count from sff_parts ${where}`).bind(...values).all();
		filteredTotal = Number(filteredRows.results?.[0]?.count ?? 0);
	}
	const totalRows = await db.prepare("select count(*) as count from sff_parts").all();
	const byKindRows = await db.prepare("select kind, count(*) as count from sff_parts group by kind order by count desc").all();
	const bySourceRows = await db.prepare("select source_sheet, count(*) as count from sff_parts group by source_sheet order by count desc").all();
	const total = Number(totalRows.results?.[0]?.count ?? 0);
	return {
		parts,
		source: "d1",
		summary: {
			total,
			filteredTotal,
			byKind: Object.fromEntries((byKindRows.results ?? []).map((row) => [row.kind, Number(row.count)])),
			bySourceSheet: Object.fromEntries((bySourceRows.results ?? []).map((row) => [row.source_sheet, Number(row.count)]))
		},
		pagination: {
			page: options.page,
			pageSize: options.pageSize,
			pageCount: Math.max(1, Math.ceil(filteredTotal / options.pageSize))
		}
	};
}
function rowToCase(row) {
	return {
		kind: "case",
		id: String(row.id),
		sourceSheet: String(row.source_sheet),
		rowNumber: Number(row.source_row_number ?? row.row_number),
		seller: String(row.case_seller ?? row.seller ?? row.brand ?? ""),
		name: String(row.name ?? ""),
		style: String(row.case_style ?? row.style ?? ""),
		status: String(row.status ?? ""),
		gpuRiser: String(row.case_gpu_riser ?? row.gpu_riser ?? ""),
		psu: String(row.case_psu ?? row.psu ?? ""),
		dimensions: {
			lengthMm: nullableNumber(row.length_mm ?? row.case_length_mm),
			widthMm: nullableNumber(row.width_mm ?? row.case_width_mm),
			heightMm: nullableNumber(row.height_mm ?? row.case_height_mm),
			volumeL: nullableNumber(row.volume_l),
			cpuCoolerHeightMm: nullableNumber(row.case_cpu_cooler_height_mm ?? row.cpu_cooler_height_mm),
			gpuLengthMm: nullableNumber(row.case_gpu_length_mm ?? row.gpu_length_mm),
			gpuWidthMm: nullableNumber(row.case_gpu_width_mm ?? row.gpu_width_mm),
			gpuThicknessMm: nullableNumber(row.case_gpu_thickness_mm ?? row.gpu_thickness_mm),
			pcieSlots: nullableNumber(row.case_pcie_slots ?? row.pcie_slots),
			lpPcieSlots: nullableNumber(row.case_lp_pcie_slots ?? row.lp_pcie_slots)
		},
		flags: JSON.parse(String(row.flags_json ?? "[]")),
		raw: JSON.parse(String(row.raw_json ?? "{}"))
	};
}
function rowToGpu(row) {
	return {
		kind: "gpu",
		id: String(row.id),
		sourceSheet: String(row.source_sheet),
		rowNumber: Number(row.source_row_number ?? row.row_number),
		chipset: String(row.gpu_chipset ?? row.chipset ?? ""),
		model: String(row.gpu_model ?? row.model ?? ""),
		brand: String(row.gpu_brand ?? row.brand ?? ""),
		name: String(row.gpu_name ?? row.name ?? ""),
		lowProfile: booleanish(row.gpu_low_profile ?? row.low_profile),
		watercooled: booleanish(row.gpu_watercooled ?? row.watercooled),
		pciePins: String(row.gpu_pcie_pins ?? row.pcie_pins ?? ""),
		tdpW: nullableNumber(row.gpu_tdp_w ?? row.tdp_w),
		dimensions: {
			lengthMm: nullableNumber(row.length_mm),
			widthMm: nullableNumber(row.width_mm),
			thicknessMm: nullableNumber(row.thickness_mm),
			pcieSlots: nullableNumber(row.gpu_pcie_slots ?? row.pcie_slots)
		},
		flags: JSON.parse(String(row.flags_json ?? "[]")),
		raw: JSON.parse(String(row.raw_json ?? "{}"))
	};
}
function rowToGenericPart(row) {
	return {
		id: String(row.id),
		kind: String(row.kind ?? "unknown"),
		sourceSheet: String(row.source_sheet),
		rowNumber: Number(row.source_row_number ?? row.row_number),
		brand: String(row.brand ?? ""),
		name: String(row.name ?? ""),
		displayName: String(row.display_name ?? ""),
		status: String(row.status ?? ""),
		sellerUrl: String(row.seller_url ?? ""),
		productUrl: String(row.product_url ?? ""),
		specs: JSON.parse(String(row.specs_json ?? "{}")),
		dimensions: JSON.parse(String(row.dimensions_json ?? "{}")),
		flags: JSON.parse(String(row.flags_json ?? "[]")),
		raw: JSON.parse(String(row.raw_json ?? "{}")),
		links: JSON.parse(String(row.links_json ?? "{}"))
	};
}
function nullableNumber(value) {
	if (value === null || value === void 0 || value === "") return null;
	const number = Number(value);
	return Number.isFinite(number) ? number : null;
}
function booleanish(value) {
	return value === true || value === 1 || value === "1";
}
function clampCatalogOptions(options = {}) {
	return {
		page: Math.max(1, Math.floor(options.page ?? 1)),
		pageSize: Math.max(10, Math.min(100, Math.floor(options.pageSize ?? 50))),
		kind: options.kind && options.kind !== "all" ? options.kind : void 0,
		sourceSheet: options.sourceSheet && options.sourceSheet !== "all" ? options.sourceSheet : void 0,
		search: options.search?.trim() || void 0
	};
}
function rowSearchText(row) {
	return [
		row.display_name,
		row.brand,
		row.name,
		row.kind,
		row.source_sheet,
		row.status,
		row.gpu_chipset,
		row.gpu_model,
		row.case_seller,
		row.case_style
	].join(" ");
}
function fuzzyScore(text, query) {
	const haystack = text.toLowerCase();
	const needle = query.toLowerCase().trim();
	if (!needle) return 0;
	if (haystack === needle) return 1e3;
	if (haystack.startsWith(needle)) return 900 - Math.min(100, haystack.length - needle.length);
	if (haystack.includes(needle)) return 760 - Math.min(160, haystack.indexOf(needle));
	const terms = needle.split(/\s+/).filter(Boolean);
	const matchedTerms = terms.filter((term) => haystack.includes(term));
	if (matchedTerms.length === terms.length) return 520 + matchedTerms.length * 80;
	const words = haystack.split(/[^a-z0-9]+/).filter(Boolean);
	const typoMatches = terms.filter((term) => {
		const maxDistance = term.length <= 4 ? 1 : Math.max(1, Math.floor(term.length * .25));
		return words.some((word) => {
			return levenshteinDistance(word.slice(0, term.length), term) <= maxDistance;
		});
	});
	if (typoMatches.length === terms.length) return 430 + typoMatches.length * 60;
	const compactNeedle = needle.replace(/\s+/g, "");
	if (compactNeedle.length > 3) return 0;
	let cursor = 0;
	let streak = 0;
	let matchedChars = 0;
	let score = 180;
	for (const char of compactNeedle) {
		const index = haystack.indexOf(char, cursor);
		if (index === -1) return 0;
		matchedChars += 1;
		score += 12;
		if (index === cursor) {
			streak += 1;
			score += streak * 4;
		} else streak = 0;
		cursor = index + 1;
	}
	return matchedChars === compactNeedle.length ? score : 0;
}
function levenshteinDistance(a, b) {
	const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
	const current = Array.from({ length: b.length + 1 }, () => 0);
	for (let i = 1; i <= a.length; i += 1) {
		current[0] = i;
		for (let j = 1; j <= b.length; j += 1) {
			const cost = a[i - 1] === b[j - 1] ? 0 : 1;
			current[j] = Math.min((current[j - 1] ?? 0) + 1, (previous[j] ?? 0) + 1, (previous[j - 1] ?? 0) + cost);
		}
		previous.splice(0, previous.length, ...current);
	}
	return previous[b.length] ?? 0;
}
function sortSearchMatches(items, query, textFor, limit) {
	const ranked = items.map((item) => ({
		item,
		score: fuzzyScore(textFor(item), query)
	})).filter((entry) => entry.score > 0).sort((a, b) => b.score - a.score);
	return (limit ? ranked.slice(0, limit) : ranked).map((entry) => ({
		...entry.item,
		score: entry.score
	}));
}
function rowSuggestion(row) {
	const gpuTitle = [row.brand, row.name].filter(Boolean).join(" ").trim();
	const caseTitle = [
		row.case_seller,
		row.name || row.display_name,
		row.case_style
	].filter(Boolean).join(" ").trim();
	return {
		id: String(row.id),
		kind: String(row.kind),
		displayName: row.kind === "gpu" ? [gpuTitle, row.gpu_model].filter(Boolean).join(" · ") : caseTitle || String(row.display_name),
		sourceSheet: String(row.source_sheet),
		rowNumber: Number(row.source_row_number),
		score: row.score,
		match: rowSearchText(row)
	};
}
function buildCatalogWhere(options) {
	const clauses = [];
	const values = [];
	if (options.kind) {
		clauses.push("kind = ?");
		values.push(options.kind);
	}
	if (options.sourceSheet) {
		clauses.push("source_sheet = ?");
		values.push(options.sourceSheet);
	}
	if (options.search) {
		const like = `%${options.search.replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;
		clauses.push("(display_name like ? escape '\\' or brand like ? escape '\\' or name like ? escape '\\' or kind like ? escape '\\' or source_sheet like ? escape '\\' or status like ? escape '\\')");
		values.push(like, like, like, like, like, like);
	}
	return {
		where: clauses.length ? `where ${clauses.join(" and ")}` : "",
		values
	};
}
function buildCatalogFilterWhere(options) {
	const clauses = [];
	const values = [];
	if (options.kind) {
		clauses.push("kind = ?");
		values.push(options.kind);
	}
	if (options.sourceSheet) {
		clauses.push("source_sheet = ?");
		values.push(options.sourceSheet);
	}
	return {
		where: clauses.length ? `where ${clauses.join(" and ")}` : "",
		values
	};
}
async function searchCatalogRows(event, rawOptions) {
	const options = {
		query: rawOptions.query?.trim() ?? "",
		limit: Math.max(1, Math.min(1e3, Math.floor(rawOptions.limit ?? 25))),
		kind: rawOptions.kind && rawOptions.kind !== "all" ? rawOptions.kind : void 0,
		sourceSheet: rawOptions.sourceSheet && rawOptions.sourceSheet !== "all" ? rawOptions.sourceSheet : void 0
	};
	const db = requireDb();
	if (!options.query) return {
		source: "d1",
		suggestions: []
	};
	const { where, values } = buildCatalogFilterWhere(options);
	return {
		source: "d1",
		suggestions: sortSearchMatches((await db.prepare(`select id, kind, source_sheet, source_row_number, brand, name, display_name, status, gpu_chipset, gpu_model, case_seller, case_style from sff_parts ${where}`).bind(...values).all()).results ?? [], options.query, rowSearchText, options.limit).map(rowSuggestion)
	};
}
//#endregion
export { searchCatalog as a, loadParts as i, loadCatalog as n, loadCatalogPartsByIds as r, findCaseAndGpu as t };
