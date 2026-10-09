import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { IntakeResult, PrintedCaseInfo, RawSheetRow } from "../types";
import { normalizeCase, normalizeGenericPart, parseNumber } from "./sheets";

export const PRINTED_CASES_SHEET = "Printed Cases";
// Must match the header strings read by normalizeCase.
export const PRINTED_CASE_COLUMNS = [
  "Case", "Style", "Side panel", "Case material", "GPU Riser", "PSU", "Motherboard", "Radiator support",
  "Case Length (mm)", "Case Width (mm)", "Case Height (mm)", "Volume (L)", "Footprint (cm2)", "Weight (kg)",
  "CPU Cooler Height (mm)", "GPU Length (mm)", "GPU Width (mm)", "GPU Height / Thickness (mm)", "PCIe Slot", "LP PCIe Slot",
  '2.5" drive count', '3.5" drive count', '5.25" drive count',
  "40mm fan count", "60mm fan count", "80mm fan count", "92mm fan count", "120mm fan count", "140mm fan count", "180mm fan count", "200mm fan count",
  "USB-A 2.0 count", "USB-A 3.2 count", "USB-C count",
  "Radiator 120mm", "Radiator 140mm", "Radiator 200mm", "Radiator 240mm", "Radiator 280mm", "Radiator 360mm", "Radiator 420mm", "Radiator top hat",
  "3.5mm jack", "Price (USD)",
];

export interface PrintedCaseFile {
  fileName: string;
  case: Record<string, string>;
  printed: PrintedCaseInfo;
}

export function parsePrintedCaseFile(fileName: string, input: unknown): PrintedCaseFile {
  function fail(reason: string): never { throw new Error(`${fileName}: ${reason}`); }
  function object(value: unknown, field: string): Record<string, unknown> {
    if (!value || typeof value !== "object" || Array.isArray(value)) fail(`${field} must be an object`);
    return value as Record<string, unknown>;
  }
  function string(value: unknown, field: string, optional = false): string {
    if (optional && value === undefined) return "";
    if (typeof value !== "string") fail(`${field} must be a string`);
    return value;
  }
  function nonempty(value: unknown, field: string): string {
    const text = string(value, field);
    if (!text.trim()) fail(`${field} must not be empty`);
    return text;
  }
  function url(value: unknown, field: string, optional = false): string {
    const text = string(value, field, optional);
    if (optional && text === "") return text;
    try { if (new URL(text).protocol === "https:") return text; } catch { /* Invalid URL. */ }
    return fail(`${field} must be an https URL`);
  }
  const root = object(input, "file");
  const values = object(root.case, "case");
  for (const [key, value] of Object.entries(values)) {
    if (!PRINTED_CASE_COLUMNS.includes(key)) fail(`unknown case column ${key}`);
    string(value, `case.${key}`);
  }
  nonempty(values.Case, "case.Case");
  if (parseNumber(string(values["Volume (L)"] ?? "", "case.Volume (L)")) === null) fail("case.Volume (L) must be numeric");
  const info = object(root.printed, "printed");
  const files = object(info.files, "printed.files");
  const status = string(files.status, "printed.files.status");
  if (status !== "published" && status !== "on-request" && status !== "unreleased") fail("invalid printed.files.status");
  const filesUrl = url(files.url, "printed.files.url", status !== "published");
  const postedAt = string(info.postedAt, "printed.postedAt");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(postedAt)) fail("printed.postedAt must be YYYY-MM-DD");
  const images = info.images ?? [];
  if (!Array.isArray(images)) fail("printed.images must be an array");
  const reference = info.referenceBuild === undefined ? { parts: {}, notes: "" } : object(info.referenceBuild, "printed.referenceBuild");
  const parts = object(reference.parts, "printed.referenceBuild.parts");
  for (const [key, value] of Object.entries(parts)) {
    if (!["gpu", "psu", "cpu-cooler", "motherboard", "ram"].includes(key)) fail(`invalid reference build slot ${key}`);
    nonempty(value, `printed.referenceBuild.parts.${key}`);
  }
  return {
    fileName,
    case: values as Record<string, string>,
    printed: {
      creator: nonempty(info.creator, "printed.creator"),
      creatorUrl: url(info.creatorUrl, "printed.creatorUrl", true),
      sourceUrl: url(info.sourceUrl, "printed.sourceUrl"),
      postedAt,
      files: { status, url: filesUrl, license: string(files.license, "printed.files.license", true) },
      images: images.map((value, index) => {
        const image = object(value, `printed.images[${index}]`);
        return { url: url(image.url, `printed.images[${index}].url`), caption: string(image.caption, `printed.images[${index}].caption`, true) };
      }),
      referenceBuild: { parts: parts as PrintedCaseInfo["referenceBuild"]["parts"], notes: string(reference.notes, "printed.referenceBuild.notes", true) },
      printNotes: string(info.printNotes, "printed.printNotes", true),
    },
  };
}

export async function loadPrintedCases(dir = resolve("data/printed-cases")): Promise<PrintedCaseFile[]> {
  let names: string[];
  try { names = await readdir(dir); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  return Promise.all(names.filter((name) => name.endsWith(".json")).sort().map(async (fileName) => {
    const text = await readFile(resolve(dir, fileName), "utf8");
    let input: unknown;
    try { input = JSON.parse(text); }
    catch { throw new Error(`${fileName}: malformed JSON`); }
    return parsePrintedCaseFile(fileName, input);
  }));
}

export function withPrintedCases(result: IntakeResult, files: PrintedCaseFile[]): IntakeResult {
  const rows: RawSheetRow[] = files.map((file, index) => ({
    sourceSheet: PRINTED_CASES_SHEET, rowNumber: index + 1, links: {},
    values: { ...file.case, Seller: file.printed.creator, Status: file.printed.files.status === "unreleased" ? "Unavailable (files unreleased)" : "", "Release year": file.printed.postedAt.slice(0, 4) },
  }));
  return {
    ...result,
    rawRows: [...result.rawRows, ...rows],
    parts: [...result.parts, ...rows.map(normalizeGenericPart)],
    cases: [...result.cases, ...rows.map((row, index) => ({ ...normalizeCase(row), printed: files[index].printed }))],
  };
}
