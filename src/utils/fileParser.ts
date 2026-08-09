import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import type { ImportPreview, ColumnType, ColumnRole } from '@/types/data';

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB
const TEXT_ENCODINGS = ['utf-8', 'gb18030', 'gbk', 'big5', 'shift_jis', 'windows-1252'] as const;

export interface ImportProgress {
  phase: 'reading' | 'parsing' | 'saving';
  loaded: number;
  total: number;
}

// ---- Column role detection heuristics ----

/** Lowercase name for matching */
function norm(name: string): string {
  return name.toLowerCase().replace(/[\s_-]/g, '').replace(/[()（）]/g, '');
}

const IV_PATTERNS = [
  'group', 'treatment', 'condition', 'time', 'temp', 'temperature',
  'conc', 'concentration', 'dose', 'factor', 'category', 'type', 'method',
  'solvent', 'catalyst', 'substrate', 'reagent', 'ph', 'pressure',
  'humidity', 'speed', 'feed', 'ratio', 'loading', 'scanrate', 'scan',
  'cycle', 'step', 'stage', 'level', 'mode', 'atmosphere', 'gas',
];

const DV_PATTERNS = [
  'yield', 'response', 'activity', 'rate', 'result', 'value', 'measure',
  'output', 'score', 'selectivity', 'conversion', 'purity', 'absorbance',
  'intensity', 'count', 'mass', 'volume', 'area', 'height', 'amount',
  'efficiency', 'performance', 'removal', 'degradation', 'adsorption',
  'capacity', 'content', 'recovery', 'signal', 'peak', 'current',
  'potential', 'resistance', 'conductivity', 'viscosity', 'density',
  'weight', 'percentage', 'ratio_yield',
];

const META_PATTERNS = [
  'id', 'sample', 'run', 'batch', 'replicate', 'date', 'time',
  'note', 'comment', 'operator', 'instrument', 'file', 'plate',
  'well', 'entry', 'number', 'trial', 'repeat', 'index', 'row',
  'column', 'code', 'label', 'name_sample',
];

function detectBOM(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return 'utf-8-bom';
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return 'utf-16le';
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return 'utf-16be';
  return 'utf-8';
}

/** Match column name against keyword list */
function matchPattern(name: string, patterns: string[]): boolean {
  const n = norm(name);
  return patterns.some((p) => n.includes(p) || p.includes(n));
}

function inferColumnType(values: unknown[]): ColumnType {
  const nonEmpty = values.filter((v) => v !== null && v !== undefined && v !== '');
  if (nonEmpty.length === 0) return 'numeric';
  const numericCount = nonEmpty.filter((v) => { const n = Number(v); return !isNaN(n) && String(v).trim() !== ''; }).length;
  return numericCount / nonEmpty.length >= 0.7 ? 'numeric' : 'categorical';
}

/** Infer the semantic role of a column in experimental context */
function inferColumnRole(name: string, colType: ColumnType, values: unknown[]): ColumnRole {
  // Check by name first (strong signal)
  if (matchPattern(name, META_PATTERNS)) return 'metadata';
  if (matchPattern(name, IV_PATTERNS)) return 'independent';
  if (matchPattern(name, DV_PATTERNS)) return 'dependent';

  // Check by data pattern
  const nonEmpty = values.filter((v) => v !== null && v !== undefined && v !== '');
  const uniqueValues = new Set(nonEmpty.map((v) => String(v)));

  // High uniqueness → metadata/identifier
  if (nonEmpty.length > 0 && uniqueValues.size / nonEmpty.length > 0.9) return 'metadata';

  // Categorical with few unique values → likely independent variable
  if (colType === 'categorical' && uniqueValues.size >= 2 && uniqueValues.size <= 10) return 'independent';

  // Numeric → likely dependent variable (measurement)
  if (colType === 'numeric') return 'dependent';

  return 'unknown';
}

/** Check if a column is likely irrelevant (all same, all null, mostly null) */
function isIrrelevant(values: unknown[]): boolean {
  const nonEmpty = values.filter((v) => v !== null && v !== undefined && v !== '');
  if (nonEmpty.length === 0) return true; // all null
  if (new Set(nonEmpty.map((v) => String(v))).size === 1) return true; // constant value
  return false;
}

/** Detect parallel experiment grouping column */
function detectExperimentGroup(headers: string[], rows: Record<string, unknown>[]): string | undefined {
  for (const h of headers) {
    const n = norm(h);
    // Group / batch / experiment identifiers
    if (n.includes('experiment') || n.includes('exp') || n.includes('batch') || n.includes('run')
      || n === 'group' || n.includes('group') || n.includes('组') || n.includes('处理')
      || n.includes('treatment') || n.includes('condition')) {
      const values = rows.map((r) => String(r[h] ?? ''));
      const unique = new Set(values);
      // Must have 2-20 groups
      if (unique.size >= 2 && unique.size <= 20) return h;
    }
  }
  return undefined;
}

function inferAllColumnTypes(headers: string[], rows: Record<string, unknown>[]): { name: string; type: ColumnType; role: ColumnRole }[] {
  return headers.map((header) => {
    const values = rows.map((row) => row[header]);
    const colType = inferColumnType(values);
    const role = inferColumnRole(header, colType, values);
    return { name: header, type: colType, role };
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

function buildPreview(headers: string[], allRows: Record<string, unknown>[], totalRows: number, encoding: string, delimiter: string): ImportPreview {
  const columns = inferAllColumnTypes(headers, allRows);
  const irrelevantColumns = headers.filter((h) => {
    const values = allRows.map((r) => r[h]);
    return isIrrelevant(values);
  });
  const experimentGroupCol = detectExperimentGroup(headers, allRows);

  return {
    columns,
    rows: allRows.slice(0, 20),
    totalRows,
    encoding,
    delimiter,
    experimentGroupCol,
    irrelevantColumns: irrelevantColumns.length > 0 ? irrelevantColumns : undefined,
  };
}

async function parseExcel(file: File): Promise<ImportPreview> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
  const headers = Object.keys(jsonData[0] ?? {});
  return buildPreview(headers, jsonData, jsonData.length, 'utf-8', '');
}

async function parseJSON(file: File): Promise<ImportPreview> {
  const text = await file.text();
  const arr = JSON.parse(text);
  const array = Array.isArray(arr) ? arr : [arr];
  const headers = Object.keys(array[0] ?? {});
  return buildPreview(headers, array, array.length, 'utf-8', '');
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
  const estimatedTotalRows = Math.max(0, countTotalRows(text, delimiter) - 1);
  return buildPreview(headers, result.data, estimatedTotalRows, encoding, delimiter);
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
): Promise<{ headers: string[]; rows: Record<string, unknown>[]; columns: { name: string; type: ColumnType; role: ColumnRole }[]; experimentGroupCol?: string }> {
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
      return { headers: colNames, rows: dataRows, columns: inferAllColumnTypes(colNames, dataRows), experimentGroupCol: detectExperimentGroup(colNames, dataRows) };
    }
    const headers = Object.keys(skippedRows[0] ?? {});
    onProgress?.({ phase: 'saving', loaded: skippedRows.length, total: skippedRows.length });
    return { headers, rows: skippedRows, columns: inferAllColumnTypes(headers, skippedRows), experimentGroupCol: detectExperimentGroup(headers, skippedRows) };
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
        chunk: (results: { data: unknown[] }, parser: { abort: () => void }) => {
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
        error: (err: { message: string }) => {
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
  return { headers, rows: skippedRows, columns: inferAllColumnTypes(headers, skippedRows), experimentGroupCol: detectExperimentGroup(headers, skippedRows) };
}
