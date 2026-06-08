/** The number of spaces separating one column from the next. */
const COLUMN_GAP = "     ";

/**
 * Pads a cell with trailing spaces so it fills its column.
 *
 * @param cell The cell's text.
 * @param columnWidth The visible width to pad the cell to.
 * @returns The padded cell.
 */
function formatCell(cell: string, columnWidth: number): string {
  return cell + " ".repeat((columnWidth ?? 0) - Bun.stringWidth(cell));
}

/**
 * Formats a single row.
 *
 * @param row The row's cells.
 * @param columnWidths The visible width of each column, by index.
 * @returns The formatted row.
 */
function formatRow(row: string[], columnWidths: number[]): string {
  return row
    .map((cell, column) => formatCell(cell, columnWidths[column]))
    .join(COLUMN_GAP)
    .trimEnd();
}

/**
 * Formats a 2D array of cells as a borderless, left-aligned table with aligned columns.
 *
 * @param rows The table rows, each an array of cell strings.
 * @returns The formatted table, one row per line.
 */
export function formatTable(rows: string[][]): string {
  const columnCount = Math.max(0, ...rows.map((row) => row.length));

  const columnWidths = Array.from({ length: columnCount }, (_, column) =>
    Math.max(0, ...rows.map((row) => Bun.stringWidth(row[column] ?? ""))),
  );

  return rows.map((row) => formatRow(row, columnWidths)).join("\n");
}
