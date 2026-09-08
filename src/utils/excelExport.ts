import * as XLSX from 'xlsx';

const isTextLikeHeader = (header: string) => /رقم|هاتف|phone|member|national|invoice|id|كود|معرف/i.test(header);
const isDateHeader = (header: string) => /تاريخ|date|بداية|نهاية|انضمام/i.test(header);

export function exportToExcel(
  filename: string,
  headers: string[],
  rows: (string | number | undefined | null)[][],
  sheetName = 'البيانات',
): void {
  const normalizedRows = rows.map((row) => row.map((value, index) => {
    const header = headers[index] || '';
    if (value === undefined || value === null) return '';
    return isTextLikeHeader(header) || isDateHeader(header) ? String(value) : value;
  }));

  const data = [headers, ...normalizedRows];
  const worksheet = XLSX.utils.aoa_to_sheet(data);

  // Wider columns prevent Excel from displaying dates/numbers as ####.
  worksheet['!cols'] = headers.map((header, index) => {
    const values = [header, ...normalizedRows.map((row) => row[index] ?? '')];
    const maxLen = Math.max(0, ...values.map((value) => String(value).length));
    const base = isDateHeader(header) ? 16 : isTextLikeHeader(header) ? 18 : 14;
    return { wch: Math.min(42, Math.max(base, maxLen + 2)) };
  });
  worksheet['!views'] = [{ rightToLeft: true }];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.slice(0, 31));
  XLSX.writeFile(workbook, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`);
}
