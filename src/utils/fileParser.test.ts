import { describe, it, expect } from 'vitest';
import { parseFile } from './fileParser';

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
});
