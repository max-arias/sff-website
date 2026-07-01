import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import ExcelJS from "exceljs";
import { SFF_INDEX_SHEET } from "../src/lib/sheets";

const sheetId = "1AddRvGWJ_f4B6UC7_IftDiVudVc8CJ8sxLUqlxVsCz4";
const workbookUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=xlsx`;
const outputPath = resolve(".data/sff-workbook-tabs.json");

function cellText(cell: ExcelJS.Cell) {
  return String(cell.text ?? "").trim();
}

function hyperlinkFromFormula(formula: string) {
  const match = formula.match(/HYPERLINK\(\s*"([^"]+)"/i);
  return match?.[1] ?? "";
}

function cellLink(cell: ExcelJS.Cell) {
  if (cell.hyperlink) return cell.hyperlink;
  const value = cell.value;
  if (value && typeof value === "object") {
    if ("hyperlink" in value && typeof value.hyperlink === "string") return value.hyperlink;
    if ("formula" in value && typeof value.formula === "string") return hyperlinkFromFormula(value.formula);
  }
  return "";
}

function countRowsAndLinks(worksheet: ExcelJS.Worksheet) {
  let dataRows = 0;
  let linkCells = 0;

  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    let hasValue = false;

    for (let columnNumber = 1; columnNumber <= worksheet.columnCount; columnNumber += 1) {
      const cell = row.getCell(columnNumber);
      if (cellText(cell)) hasValue = true;
      if (cellLink(cell)) linkCells += 1;
    }

    if (hasValue) dataRows += 1;
  }

  return { dataRows, linkCells };
}

async function main() {
  const response = await fetch(workbookUrl);
  if (!response.ok) throw new Error(`Failed to fetch SFF workbook: ${response.status} ${response.statusText}`);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await response.arrayBuffer());

  const tabs = workbook.worksheets.map((worksheet) => {
    const counts = countRowsAndLinks(worksheet);
    return {
      name: worksheet.name,
      imported: worksheet.name !== SFF_INDEX_SHEET,
      columns: worksheet.columnCount,
      rows: worksheet.rowCount,
      dataRows: counts.dataRows,
      linkCells: counts.linkCells
    };
  });

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify({ generatedAt: new Date().toISOString(), tabs }, null, 2), "utf8");

  console.table(tabs);
  console.log(`Wrote ${outputPath}`);
}

await main();
