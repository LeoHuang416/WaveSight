import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { WorkBook } from 'xlsx';

const { writeFileMock } = vi.hoisted(() => ({ writeFileMock: vi.fn() }));

vi.mock('xlsx', async () => {
  const actual = await vi.importActual<typeof import('xlsx')>('xlsx');
  return { ...actual, writeFile: writeFileMock };
});

import { exportXLSX, exportAllDataXLSX } from './export';

beforeEach(() => writeFileMock.mockClear());

describe('exportXLSX', () => {
  it('生成包含表头与数据的 .xlsx 工作簿', async () => {
    exportXLSX(['a', 'b'], [[1, 'x'], [2, 'y']], 'test');
    expect(writeFileMock).toHaveBeenCalledTimes(1);
    const [wb, filename] = writeFileMock.mock.calls[0] as [WorkBook, string];
    expect(filename).toBe('test.xlsx');
    const ws = wb.Sheets[wb.SheetNames[0]]!;
    const aoa = (await import('xlsx')).utils.sheet_to_json(ws, { header: 1, defval: '' });
    expect(aoa).toEqual([['a', 'b'], [1, 'x'], [2, 'y']]);
    expect(wb.SheetNames).toContain('Sheet1');
  });

  it('导出全部数据为多 sheet 工作簿', () => {
    exportAllDataXLSX({
      datasets: [{ name: 'ds1', columns: [{ name: 'x' }], rows: [{ x: 1 }] }],
      charts: [{ title: 'c1', chartType: 'bar' }],
      history: [{ action: 'run', type: 'descriptive' }],
    });
    const [wb] = writeFileMock.mock.calls[0] as [WorkBook, string];
    expect(wb.SheetNames).toEqual(['数据集1', '图表', '历史记录']);
  });
});