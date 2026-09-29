// Minimal RFC 4180 writer for the Day export.

const FORMULA_START = /^[=+\-@\t\r]/;
const E164 = /^\+\d{6,15}$/;

// Spreadsheets run a cell that starts with = + - @ as a formula, so a customer
// named `=HYPERLINK(...)` would execute when the file is opened (CSV injection).
// Free text gets a leading apostrophe, which spreadsheets show as plain text.
// A real E.164 phone number starts with "+" by design and is only digits, so
// it is left alone.
export function neutralizeFormula(value: string): string {
  if (E164.test(value)) return value;
  return FORMULA_START.test(value) ? `'${value}` : value;
}

function quote(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

export type CsvCell = string | number | null | undefined;

export function toCsvRow(cells: CsvCell[]): string {
  return cells.map((cell) => (cell == null ? "" : quote(neutralizeFormula(String(cell))))).join(",");
}

// Leading BOM so Excel opens the file as UTF-8 (names with accents or emoji);
// CRLF line endings per RFC 4180.
export function toCsv(header: string[], rows: CsvCell[][]): string {
  return `\uFEFF${[toCsvRow(header), ...rows.map(toCsvRow)].join("\r\n")}\r\n`;
}
