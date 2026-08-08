import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import type { ImportPreview, ColumnType } from '@/types/data';

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

export async function parseFile(file: File): Promise<ImportPreview> {
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
  let text = '';
  for (const enc of ['utf-8', 'gb18030']) {
    try { text = new TextDecoder(enc).decode(buffer); break; } catch { continue; }
  }
  const firstLine = text.split('\n')[0] ?? '';
  let delimiter = ',';
  if (firstLine.split('\t').length > firstLine.split(',').length) delimiter = '\t';
  if (firstLine.split(';').length > firstLine.split(delimiter).length) delimiter = ';';

  const result = Papa.parse<Record<string, unknown>>(text, { header: true, delimiter, skipEmptyLines: true, dynamicTyping: false });
  const headers = result.meta.fields ?? [];
  return { columns: inferAllColumnTypes(headers, result.data), rows: result.data.slice(0, 20), totalRows: result.data.length, encoding: detectBOM(buffer), delimiter };
}

export async function loadFullFile(file: File, options: { hasHeader: boolean; skipRows: number; delimiter?: string }): Promise<{ headers: string[]; rows: Record<string, unknown>[]; columns: { name: string; type: ColumnType }[] }> {
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext === 'xlsx' || ext === 'xls' || ext === 'xlsm') {
    const buffer = await file.arrayBuffer();
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
      return { headers: colNames, rows: dataRows, columns: inferAllColumnTypes(colNames, dataRows) };
    }
    const headers = Object.keys(skippedRows[0] ?? {});
    return { headers, rows: skippedRows, columns: inferAllColumnTypes(headers, skippedRows) };
  }
  const buffer = await file.arrayBuffer();
  let text = '';
  for (const enc of ['utf-8', 'gb18030']) {
    try { text = new TextDecoder(enc).decode(buffer); break; } catch { continue; }
  }
  const delim = options.delimiter || ',';
  const result = Papa.parse<Record<string, unknown>>(text, { header: options.hasHeader, delimiter: delim, skipEmptyLines: true, dynamicTyping: false });
  const skippedRows = result.data.slice(options.skipRows);
  const headers = options.hasHeader ? (result.meta.fields ?? []) : Array.from({ length: Object.keys(skippedRows[0] ?? {}).length }, (_, i) => `列${i + 1}`);
  return { headers, rows: skippedRows, columns: inferAllColumnTypes(headers, skippedRows) };
}
