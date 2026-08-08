import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import type { ImportPreview, ColumnType } from '@/types/data';

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB
const TEXT_ENCODINGS = ['utf-8', 'gb18030', 'gbk', 'big5', 'shift_jis', 'windows-1252'] as const;

export interface ImportProgress {
  phase: 'reading' | 'parsing' | 'saving';
  loaded: number;
  total: number;
}

function detectBOM(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return 'utf-8-bom';
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return 'utf-16le';
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return 'utf-16be';
  return 'utf-8';
}

function inferColumnType(values: unknown[]): ColumnType {
  const nonEmpty = values.filter((v) => v !== null && v !== undefined && v !== '');
  if (nonEmpty.length === 0) return 'numeric';
  const numericCount = nonEmpty.filter((v) => { const n = Number(v); return !isNaN(n) && String(v).trim() !== ''; }).length;
  return numericCount / nonEmpty.length >= 0.7 ? 'numeric' : 'categorical';
}

function inferAllColumnTypes(headers: string[], rows: Record<string, unknown>[]): { name: string; type: ColumnType }[] {
  return headers.map((header) => {
    const values = rows.map((row) => row[header]);
    return { name: header, type: inferColumnType(values) };
  });
}

/** Decode text with proper encoding fallback. Uses { fatal: true } to ensure fallback works. */
function decodeText(buffer: ArrayBuffer): { text: string; encoding: string } {
  // Try detected encoding first, then fallback list
  const bomEncoding = detectBOM(buffer);
  const encodings = [bomEncoding, ...TEXT_ENCODINGS.filter((e) => e !== bomEncoding)];

  for (const enc of encodings) {
    try {
      const text = new TextDecoder(enc, { fatal: true }).decode(buffer);
      return { text, encoding: enc };
    } catch {
      continue;
    }
  }
  // Last resort: use utf-8 without fatal
  return { text: new TextDecoder('utf-8').decode(buffer), encoding: 'utf-8 (fallback)' };
}

export function validateFileSize(file: File): { valid: boolean; message?: string } {
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, message: `文件过大 (${(file.size / 1024 / 1024).toFixed(1)} MB)，最大支持 100 MB。请拆分文件后重试。` };
  }
  if (file.size > 50 * 1024 * 1024) {
    return { valid: true, message: `文件较大 (${(file.size / 1024 / 1024).toFixed(1)} MB)，导入可能需要一些时间。` };
  }
  return { valid: true };
}

export async function parseFile(file: File): Promise<ImportPreview> {
  const sizeResult = validateFileSize(file);
  if (!sizeResult.valid) throw new Error(sizeResult.message);

  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext === 'xlsx' || ext === 'xls' || ext === 'xlsm') return parseExcel(file);
  if (ext === 'json') return parseJSON(file);
  return parseTextFile(file);
}

async function parseExcel(file: File): Promise<ImportPreview> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
  const headers = Object.keys(jsonData[0] ?? {});
  return { columns: inferAllColumnTypes(headers, jsonData), rows: jsonData.slice(0, 20), totalRows: jsonData.length, encoding: 'utf-8', delimiter: '' };
}

async function parseJSON(file: File): Promise<ImportPreview> {
  const text = await file.text();
  const arr = JSON.parse(text);
  const array = Array.isArray(arr) ? arr : [arr];
  const headers = Object.keys(array[0] ?? {});
  return { columns: inferAllColumnTypes(headers, array), rows: array.slice(0, 20), totalRows: array.length, encoding: 'utf-8', delimiter: '' };
}

async function parseTextFile(file: File): Promise<ImportPreview> {
  const buffer = await file.arrayBuffer();
  const { text, encoding } = decodeText(buffer);

  const firstLine = text.split('\n')[0] ?? '';
  let delimiter = ',';
  if (firstLine.split('\t').length > firstLine.split(',').length) delimiter = '\t';
  if (firstLine.split(';').length > firstLine.split(delimiter).length) delimiter = ';';

  const result = Papa.parse<Record<string, unknown>>(text, { header: true, delimiter, skipEmptyLines: true, dynamicTyping: false, preview: 20 });
  const headers = result.meta.fields ?? [];
  // totalRows: estimate data rows (exclude header line from count)
  const estimatedTotalRows = Math.max(0, countTotalRows(text, delimiter) - 1);
  return { columns: inferAllColumnTypes(headers, result.data), rows: result.data.slice(0, 20), totalRows: estimatedTotalRows, encoding, delimiter };
}

/** Estimate total rows without parsing everything */
function countTotalRows(text: string, delimiter: string): number {
  // Skip empty lines
  const lines = text.split('\n').filter((l) => l.trim().length > 0);
  // Estimate based on first 100 lines average
  const sampleSize = Math.min(100, lines.length);
  if (sampleSize === 0) return 0;
  const sampleCols = lines.slice(0, sampleSize).map((l) => l.split(delimiter).length);
  const avgCols = sampleCols.reduce((a, b) => a + b, 0) / sampleSize;
  // Filter out lines with significantly different column counts (likely malformed)
  return lines.filter((l) => {
    const cols = l.split(delimiter).length;
    return cols >= avgCols * 0.5 && cols <= avgCols * 1.5;
  }).length;
}

export async function loadFullFile(
  file: File,
  options: { hasHeader: boolean; skipRows: number; delimiter?: string },
  onProgress?: (progress: ImportProgress) => void
): Promise<{ headers: string[]; rows: Record<string, unknown>[]; columns: { name: string; type: ColumnType }[] }> {
  const sizeResult = validateFileSize(file);
  if (!sizeResult.valid) throw new Error(sizeResult.message);

  const ext = file.name.split('.').pop()?.toLowerCase();

  // Excel path
  if (ext === 'xlsx' || ext === 'xls' || ext === 'xlsm') {
    onProgress?.({ phase: 'reading', loaded: 0, total: file.size });
    const buffer = await file.arrayBuffer();
    onProgress?.({ phase: 'parsing', loaded: file.size, total: file.size });
    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
    const skippedRows = jsonRows.slice(options.skipRows);
    if (!options.hasHeader) {
      const colNames = Array.from({ length: Object.keys(skippedRows[0] ?? {}).length }, (_, i) => `列${i + 1}`);
      const dataRows = skippedRows.map((row) => {
        const newRow: Record<string, unknown> = {};
        Object.values(row).forEach((val, i) => { newRow[colNames[i]] = val; });
        return newRow;
      });
      onProgress?.({ phase: 'saving', loaded: dataRows.length, total: dataRows.length });
      return { headers: colNames, rows: dataRows, columns: inferAllColumnTypes(colNames, dataRows) };
    }
    const headers = Object.keys(skippedRows[0] ?? {});
    onProgress?.({ phase: 'saving', loaded: skippedRows.length, total: skippedRows.length });
    return { headers, rows: skippedRows, columns: inferAllColumnTypes(headers, skippedRows) };
  }

  // Text file path (CSV/TSV/TXT)
  onProgress?.({ phase: 'reading', loaded: 0, total: file.size });
  const buffer = await file.arrayBuffer();
  onProgress?.({ phase: 'reading', loaded: file.size, total: file.size });

  const { text } = decodeText(buffer);
  const delim = options.delimiter || ',';

  onProgress?.({ phase: 'parsing', loaded: 0, total: text.length });

  // Use PapaParse with chunking for large files, regular parse for small ones
  if (text.length > 5 * 1024 * 1024) {
    // Large file: use chunked parsing
    return new Promise((resolve, reject) => {
      const allRows: Record<string, unknown>[] = [];
      let headers: string[] = [];
      let headerRowConsumed = false;

      Papa.parse<Record<string, unknown>>(text, {
        header: false,
        delimiter: delim,
        skipEmptyLines: true,
        dynamicTyping: false,
        chunk: (results, parser) => {
          const data = results.data as Record<string, unknown>[];
          if (!headerRowConsumed) {
            // First chunk: extract headers if needed
            if (options.hasHeader) {
              headers = data[0] ? Object.keys(data[0]).filter((k) => k.trim() !== '') : [];
              // Re-parse with header: this is tricky... let's just handle it inline
              if (headers.length === 0 && data[0]) {
                // PapaParse with header:false gives arrays, need to extract
                const firstRow = data[0];
                headers = Object.keys(firstRow);
              }
              allRows.push(...data.slice(1));
            } else {
              headers = Array.from({ length: Object.keys(data[0] ?? {}).length }, (_, i) => `列${i + 1}`);
              allRows.push(...data);
            }
            headerRowConsumed = true;
          } else {
            allRows.push(...data);
          }

          const progress = Math.min(text.length, (allRows.length / 1000) * 5000 * 100);
          onProgress?.({ phase: 'parsing', loaded: progress, total: text.length });

          // Prevent memory overload: pause if too many rows accumulated
          if (allRows.length > 200000) {
            parser.abort();
            reject(new Error('文件行数超过 200,000 行限制，请拆分文件后重试。'));
          }
        },
        complete: () => {
          const skippedRows = allRows.slice(options.skipRows);
          // Re-parse with proper headers if needed
          if (options.hasHeader && headers.length === 0) {
            // Fallback: try to get headers from the first row
            const headerRow = allRows[0];
            if (headerRow) {
              headers = Object.keys(headerRow).filter((k) => k.trim() !== '');
            }
          }
          if (!options.hasHeader && headers.length === 0) {
            headers = Array.from({ length: Object.keys(skippedRows[0] ?? {}).length }, (_, i) => `列${i + 1}`);
          }
          onProgress?.({ phase: 'saving', loaded: skippedRows.length, total: skippedRows.length });
          resolve({ headers, rows: skippedRows, columns: inferAllColumnTypes(headers, skippedRows) });
        },
        error: (err) => {
          reject(new Error(`文件解析失败: ${err.message}`));
        },
      });
    });
  }

  // Small file: synchronous parse
  const result = Papa.parse<Record<string, unknown>>(text, {
    header: options.hasHeader,
    delimiter: delim,
    skipEmptyLines: true,
    dynamicTyping: false,
  });
  const skippedRows = result.data.slice(options.skipRows);
  const headers = options.hasHeader
    ? (result.meta.fields ?? [])
    : Array.from({ length: Object.keys(skippedRows[0] ?? {}).length }, (_, i) => `列${i + 1}`);
  onProgress?.({ phase: 'saving', loaded: skippedRows.length, total: skippedRows.length });
  return { headers, rows: skippedRows, columns: inferAllColumnTypes(headers, skippedRows) };
}
