/**
 * UTF-8 CSV Exporter with BOM (\uFEFF)
 * Ensures Arabic text is displayed properly in Microsoft Excel and other spreadsheet editors
 * without garbled/foreign characters.
 */

export function exportToCsv(filename: string, headers: string[], rows: (string | number | undefined | null)[][]): void {
  // UTF-8 Byte Order Mark
  const BOM = '\uFEFF';

  const formatCell = (val: string | number | undefined | null): string => {
    if (val === undefined || val === null) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const headerRow = headers.map(formatCell).join(',');
  const dataRows = rows.map((row) => row.map(formatCell).join(',')).join('\r\n');

  const csvContent = BOM + headerRow + '\r\n' + dataRows;
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
