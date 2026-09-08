import * as XLSX from 'xlsx';

const normalize = (v: string) => String(v || '').replace(/\uFEFF/g, '').trim().toLowerCase().replace(/[\s_\-()\[\]{}:]/g, '');

self.onmessage = (event: MessageEvent<{ buffer: ArrayBuffer; preferredSheets: string[] }>) => {
  try {
    const { buffer, preferredSheets = [] } = event.data;
    const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array', cellDates: true, cellNF: false, cellStyles: false, cellFormula: false });
    if (!workbook.SheetNames.length) throw new Error('لا توجد أوراق داخل ملف Excel.');
    const wanted = preferredSheets.map(normalize);
    const sheetName = workbook.SheetNames.find((name) => wanted.includes(normalize(name))) || workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(worksheet, { defval: '', raw: true });
    if (!rows.length) throw new Error(`ورقة "${sheetName}" لا تحتوي على صفوف بيانات.`);
    self.postMessage({ ok: true, rows, sheetName, count: rows.length });
  } catch (error: any) {
    self.postMessage({ ok: false, error: error?.message || 'تعذر قراءة ملف Excel.' });
  }
};
