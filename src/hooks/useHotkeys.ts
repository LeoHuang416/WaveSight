import { useEffect } from 'react';

interface HotkeyDef {
  combo: string;
  callback: (e: KeyboardEvent) => void;
  scoped?: boolean;
}

interface ParsedCombo { ctrl: boolean; shift: boolean; alt: boolean; meta: boolean; key: string }

const KEY_ALIASES: Record<string, string> = {
  ' ': 'space', arrowup: 'up', arrowdown: 'down', arrowleft: 'left', arrowright: 'right',
  escape: 'esc', return: 'enter', esc: 'esc', '?': '/',
};

function parseCombo(combo: string): ParsedCombo {
  const parts = combo.toLowerCase().split('+').map((p) => p.trim());
  const mods = { ctrl: false, shift: false, alt: false, meta: false };
  let key = '';
  for (const p of parts) {
    if (p === 'ctrl' || p === 'control') mods.ctrl = true;
    else if (p === 'shift') mods.shift = true;
    else if (p === 'alt' || p === 'option') mods.alt = true;
    else if (p === 'meta' || p === 'cmd' || p === 'win') mods.meta = true;
    else key = p;
  }
  return { ...mods, key };
}

function isEditable(target: EventTarget | null): boolean {
  const t = target as HTMLElement | null;
  if (!t) return false;
  if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement) return true;
  return t.isContentEditable === true;
}

/** 注册全局键盘快捷键。默认忽略输入框/文本域等可编辑元素内的按键。 */
export function useHotkeys(handlers: HotkeyDef[]) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      for (const h of handlers) {
        const { ctrl, shift, alt, meta, key } = parseCombo(h.combo);
        const k = KEY_ALIASES[e.key.toLowerCase()] ?? e.key.toLowerCase();
        const matches = k === key
          && !!e.ctrlKey === ctrl
          && !!e.shiftKey === shift
          && !!e.altKey === alt
          && !!e.metaKey === meta;
        if (!matches) continue;
        if (isEditable(e.target)) continue;
        e.preventDefault();
        h.callback(e);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handlers]);
}