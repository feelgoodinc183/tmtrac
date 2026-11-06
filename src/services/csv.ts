// Writing CSV files people open in Excel, Numbers or Sailwave.

/** A cell: always quoted, quotes doubled, so commas, quotes and line breaks stay inside it */
export function csvCell(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value);
  return `"${s.replace(/"/g, '""')}"`;
}

/**
 * A cell holding text someone typed (a boat or skipper name, a sail number). A spreadsheet runs a
 * cell starting with = + - @ as a formula, so such text gets a leading apostrophe, which the
 * spreadsheet shows as plain text.
 */
export function csvTextCell(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value);
  return csvCell(/^[=+\-@\t\r]/.test(s) ? `'${s}` : s);
}

/** Rows of ready-made cells, with the line ending spreadsheets expect */
export function csvRows(rows: string[][]): string {
  return rows.map((r) => r.join(',')).join('\r\n') + '\r\n';
}

/** The file to download. The byte-order mark makes Excel read accented and non-Latin names correctly. */
export function csvBlob(text: string): Blob {
  return new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' });
}
