import { describe, it, expect } from 'vitest';
import { parseFile, loadFullFile, validateFileSize } from './fileParser';

function makeCSVFile(content: string, name = 'test.csv'): File {
  return new File([content], name, { type: 'text/csv' });
}

describe('parseFile', () => {
  it('parses simple CSV', async () => {
    const file = makeCSVFile('a,b,c\n1,2,3\n4,5,6');
    const preview = await parseFile(file);
    expect(preview.columns).toHaveLength(3);
    expect(preview.totalRows).toBe(2);
    expect(preview.columns[0].type).toBe('numeric');
    expect(preview.columns[1].type).toBe('numeric');
  });

  it('detects categorical columns', async () => {
    const file = makeCSVFile('name,score\nAlice,90\nBob,85\nCharlie,92');
    const preview = await parseFile(file);
    const nameCol = preview.columns.find((c) => c.name === 'name');
    expect(nameCol?.type).toBe('categorical');
  });

  it('parses TSV with tab delimiter', async () => {
    const file = makeCSVFile('a\tb\n1\t2\n3\t4', 'test.tsv');
    const preview = await parseFile(file);
    expect(preview.columns).toHaveLength(2);
    expect(preview.delimiter).toBe('\t');
  });

  it('handles missing values in preview', async () => {
    const file = makeCSVFile('a,b\n1,\n,2');
    const preview = await parseFile(file);
    expect(preview.totalRows).toBe(2);
  });

  it('parses JSON file', async () => {
    const json = JSON.stringify([{ x: 1, y: 'a' }, { x: 2, y: 'b' }]);
    const file = new File([json], 'test.json', { type: 'application/json' });
    const preview = await parseFile(file);
    expect(preview.columns).toHaveLength(2);
    expect(preview.totalRows).toBe(2);
  });

  it('loads full CSV file', async () => {
    const file = makeCSVFile('a,b,c\n1,2,3\n4,5,6\n7,8,9');
    const result = await loadFullFile(file, { hasHeader: true, skipRows: 0, delimiter: ',' });
    expect(result.headers).toEqual(['a', 'b', 'c']);
    expect(result.rows).toHaveLength(3);
    expect(result.columns).toHaveLength(3);
  });

  it('loadFullFile without header generates column names', async () => {
    const file = makeCSVFile('1,2,3\n4,5,6');
    const result = await loadFullFile(file, { hasHeader: false, skipRows: 0, delimiter: ',' });
    expect(result.headers).toHaveLength(3);
    expect(result.headers[0]).toMatch(/列\d+/);
    expect(result.rows).toHaveLength(2);
  });

  it('loadFullFile supports skipRows', async () => {
    const file = makeCSVFile('a,b\nskip1,skip2\n1,2\n3,4');
    const result = await loadFullFile(file, { hasHeader: true, skipRows: 1, delimiter: ',' });
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].a).toBe('1');
  });

  it('loadFullFile reports progress', async () => {
    const file = makeCSVFile('x,y\n1,2\n3,4\n5,6');
    const progressSteps: string[] = [];
    await loadFullFile(file, { hasHeader: true, skipRows: 0, delimiter: ',' }, (p) => {
      progressSteps.push(p.phase);
    });
    expect(progressSteps.length).toBeGreaterThan(0);
    expect(progressSteps).toContain('reading');
    expect(progressSteps).toContain('saving');
  });

  it('loadFullFile with TSV delimiter', async () => {
    const file = makeCSVFile('a\tb\n1\t2\n3\t4', 'test.tsv');
    const result = await loadFullFile(file, { hasHeader: true, skipRows: 0, delimiter: '\t' });
    expect(result.headers).toEqual(['a', 'b']);
    expect(result.rows).toHaveLength(2);
  });

  it('loadFullFile large file (>5MB) keeps real column names', async () => {
    // Each data row is ~130 chars → 43,000 rows ≈ 5.6MB → triggers the chunked path
    const line = 'Alice,90,' + 'x'.repeat(120) + '\n';
    const big = 'name,score,extra\n' + line.repeat(43000);
    const file = makeCSVFile(big, 'big.csv');
    const result = await loadFullFile(file, { hasHeader: true, skipRows: 0, delimiter: ',' });
    expect(result.headers).toEqual(['name', 'score', 'extra']);
    expect(result.rows).toHaveLength(43000);
    expect(result.rows[0].name).toBe('Alice');
    expect(result.rows[0].score).toBe('90');
  });

  it('loadFullFile large file (>5MB) without header generates column names', async () => {
    const line = '10,20,' + 'y'.repeat(120) + '\n';
    const big = line.repeat(43000);
    const file = makeCSVFile(big, 'big.csv');
    const result = await loadFullFile(file, { hasHeader: false, skipRows: 0, delimiter: ',' });
    expect(result.headers).toHaveLength(3);
    expect(result.headers[0]).toMatch(/列\d+/);
    expect(result.rows).toHaveLength(43000);
    expect(result.rows[0][result.headers[0]]).toBe('10');
  });

  it('loadFullFile large file (>5MB) supports skipRows', async () => {
    const line = 'Alice,90,' + 'x'.repeat(120) + '\n';
    const big = 'name,score,extra\n' + line.repeat(43000);
    const file = makeCSVFile(big, 'big.csv');
    const result = await loadFullFile(file, { hasHeader: true, skipRows: 10, delimiter: ',' });
    expect(result.rows).toHaveLength(42990);
    expect(result.headers).toEqual(['name', 'score', 'extra']);
  });
});

describe('validateFileSize', () => {
  it('accepts small files', () => {
    const file = new File(['small'], 'small.csv', { type: 'text/csv' });
    expect(validateFileSize(file).valid).toBe(true);
  });

  it('warns for large files', () => {
    // Create a large mock by using a big enough size
    const file = new File(['x'.repeat(100)], 'large.csv');
    Object.defineProperty(file, 'size', { value: 60 * 1024 * 1024 });
    const result = validateFileSize(file);
    expect(result.valid).toBe(true);
    expect(result.message).toBeDefined();
  });

  it('rejects files over 100MB', () => {
    const file = new File(['x'.repeat(100)], 'huge.csv');
    Object.defineProperty(file, 'size', { value: 120 * 1024 * 1024 });
    expect(validateFileSize(file).valid).toBe(false);
  });
});
