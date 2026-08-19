import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';
import { useHotkeys } from './useHotkeys';

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

function press(key: string, opts: { ctrl?: boolean; alt?: boolean; shift?: boolean; target?: HTMLElement } = {}) {
  const target = opts.target ?? document.body;
  fireEvent.keyDown(target, { key, ctrlKey: opts.ctrl ?? false, altKey: opts.alt ?? false, shiftKey: opts.shift ?? false, bubbles: true });
}

describe('useHotkeys', () => {
  it('触发组合键回调（ctrl+enter）', () => {
    const cb = vi.fn();
    renderHook(() => useHotkeys([{ combo: 'ctrl+enter', callback: cb }]));
    press('Enter', { ctrl: true });
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('缺少修饰键时不触发', () => {
    const cb = vi.fn();
    renderHook(() => useHotkeys([{ combo: 'ctrl+enter', callback: cb }]));
    press('Enter');
    press('Enter', { ctrl: false });
    expect(cb).not.toHaveBeenCalled();
  });

  it('Alt+数字导航快捷键（alt+4）', () => {
    const cb = vi.fn();
    renderHook(() => useHotkeys([{ combo: 'alt+4', callback: cb }]));
    press('4', { alt: true });
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('? 与 / 均可触发帮助快捷键', () => {
    const cb = vi.fn();
    renderHook(() => useHotkeys([{ combo: 'shift+/', callback: cb }, { combo: '/', callback: cb }]));
    press('?', { shift: true });
    press('/');
    expect(cb).toHaveBeenCalledTimes(2);
  });

  it('输入框聚焦时忽略快捷键', () => {
    const cb = vi.fn();
    renderHook(() => useHotkeys([{ combo: 'ctrl+s', callback: cb }]));
    const input = document.createElement('input');
    document.body.appendChild(input);
    press('s', { ctrl: true, target: input });
    expect(cb).not.toHaveBeenCalled();
  });

  it('卸载后移除监听', () => {
    const cb = vi.fn();
    const { unmount } = renderHook(() => useHotkeys([{ combo: 'ctrl+s', callback: cb }]));
    unmount();
    press('s', { ctrl: true });
    expect(cb).not.toHaveBeenCalled();
  });
});