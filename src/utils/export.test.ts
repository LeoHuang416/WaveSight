import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { WorkBook } from 'xlsx';

const { writeFileMock } = vi.hoisted(() => ({ writeFileMock: vi.fn() }));

vi.mock('xlsx', async () => {
  const actual = await vi.importActual<typeof import('xlsx')>('xlsx');
  return { ...actual, writeFile: writeFileMock };
});

vi.mock('echarts', () => {
  const init = vi.fn(() => ({
    setOption: vi.fn(),
    renderToSVGString: vi.fn(() => '<svg></svg>'),
    dispose: vi.fn(),
  }));
  return { init };
});

import { exportXLSX, exportAllDataXLSX, exportPNG, exportSVG, patchWebGLContext } from './export';

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

describe('patchWebGLContext（问题1：3D 曲面 PNG 导出）', () => {
  it('为 webgl/experimental-webgl 上下文注入 preserveDrawingBuffer: true，2d 不受影响', () => {
    const orig = HTMLCanvasElement.prototype.getContext;
    try {
      const calls: { type: string; attrs?: Record<string, unknown> }[] = [];
      HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, attrs?: Record<string, unknown>) {
        calls.push({ type, attrs });
        return null;
      } as typeof orig;
      patchWebGLContext();
      const c = document.createElement('canvas');
      c.getContext('webgl', { antialias: true });
      c.getContext('2d');
      c.getContext('experimental-webgl');
      expect(calls.find((x) => x.type === 'webgl')?.attrs).toMatchObject({ preserveDrawingBuffer: true });
      expect(calls.find((x) => x.type === 'experimental-webgl')?.attrs).toMatchObject({ preserveDrawingBuffer: true });
      expect((calls.find((x) => x.type === '2d')?.attrs as Record<string, unknown> | undefined)?.preserveDrawingBuffer).toBeUndefined();
    } finally {
      HTMLCanvasElement.prototype.getContext = orig;
    }
  });
});

describe('exportPNG（问题1：3D 图主体不再空白）', () => {
  it('2D 图走 getDataURL 导出', () => {
    const anchor = document.createElement('a');
    document.body.appendChild(anchor);
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    try {
      const getDataURL = vi.fn(() => 'data:image/png;base64,xxx');
      const inst = { getZr: () => ({ refreshImmediately: vi.fn(), painter: {} }), getDataURL, getDom: () => null };
      exportPNG(inst, 'test');
      expect(getDataURL).toHaveBeenCalledWith(expect.objectContaining({ type: 'png', pixelRatio: 2 }));
      expect(click).toHaveBeenCalled();
    } finally {
      click.mockRestore();
      document.body.removeChild(anchor);
    }
  });

  it('3D/GL 图：合成 WebGL canvas 与主 canvas 后导出 PNG', () => {
    const anchor = document.createElement('a');
    document.body.appendChild(anchor);
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const origGetContext = HTMLCanvasElement.prototype.getContext;
    const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
    try {
      const fake2d = {
        fillStyle: '', fillRect: vi.fn(), drawImage: vi.fn(),
      };
      HTMLCanvasElement.prototype.toDataURL = () => 'data:image/png;base64,composited';
      // 原型 getContext：2d 返回桩，webgl 返回 null（主 canvas 不被识别为 GL）
      HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string) {
        return type === '2d' ? fake2d : null;
      } as typeof origGetContext;

      const glCanvas = document.createElement('canvas');
      glCanvas.width = 800; glCanvas.height = 600;
      // 元素级 getContext 覆盖：GL canvas 被识别为 webgl
      glCanvas.getContext = ((type: string) => (type === 'webgl' || type === 'experimental-webgl' ? {} : null)) as typeof glCanvas.getContext;
      const mainCanvas = document.createElement('canvas');
      mainCanvas.width = 800; mainCanvas.height = 600;
      const dom = document.createElement('div');
      dom.appendChild(mainCanvas);
      dom.appendChild(glCanvas);
      const getDataURL = vi.fn(() => 'data:image/png;base64,should-not-be-used');
      const inst = {
        getZr: () => ({ refreshImmediately: vi.fn() }),
        getDataURL,
        getDom: () => dom,
      };
      exportPNG(inst, 'surface3d');
      // GL 路径不应调用 getDataURL（合成导出）
      expect(getDataURL).not.toHaveBeenCalled();
      expect(fake2d.drawImage).toHaveBeenCalled();
      expect(click).toHaveBeenCalled();
    } finally {
      click.mockRestore();
      HTMLCanvasElement.prototype.getContext = origGetContext;
      HTMLCanvasElement.prototype.toDataURL = origToDataURL;
      document.body.removeChild(anchor);
    }
  });
});

describe('exportSVG', () => {
  it('非 3D 图可导出 SVG 并返回 true', () => {
    const anchor = document.createElement('a');
    document.body.appendChild(anchor);
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    try {
      const inst = { getOption: () => ({ series: [{ type: 'bar', data: [1, 2] }] }) };
      const ok = exportSVG(inst, 'bar-chart');
      expect(ok).toBe(true);
      expect(click).toHaveBeenCalled();
    } finally {
      click.mockRestore();
      document.body.removeChild(anchor);
    }
  });
});