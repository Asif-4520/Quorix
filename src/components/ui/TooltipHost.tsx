import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Kbd } from './Kbd';

export type TooltipSide = 'top' | 'bottom' | 'left' | 'right';

export interface ParsedTooltip {
  text: string;
  shortcuts: string[];
}

const MODIFIER_KEY_PATTERN = /^(?:Ctrl|Control|Shift|Alt|Meta|Cmd|Super)$/i;

const NAMED_KEY_PATTERN =
  /^(?:Enter|Space|Esc|Escape|Tab|Del|Delete|Backspace|Insert|Home|End|PgUp|PgDn|PageUp|PageDown|Up|Down|Left|Right|ArrowUp|ArrowDown|ArrowLeft|ArrowRight|F[1-9]|F1[0-2])$/i;

const SINGLE_KEY_PATTERN = /^[A-Za-z0-9=\-[\];',./\\`+]$/;

const POINTER_ACTION_PATTERN = /^(?:Click)$/i;

function isValidShortcutCombo(part: string): boolean {
  if (NAMED_KEY_PATTERN.test(part)) {
    return true;
  }
  let tokens: string[];
  if (part.endsWith('++')) {
    const prefix = part.slice(0, -2);
    if (!prefix) return false;
    tokens = [...prefix.split('+'), '+'];
  } else {
    tokens = part.split('+');
  }
  if (tokens.length < 2 || tokens.some((token) => !token)) {
    return false;
  }
  const modifiers = tokens.slice(0, -1);
  const finalKey = tokens[tokens.length - 1];
  return (
    modifiers.every((modifier) => MODIFIER_KEY_PATTERN.test(modifier)) &&
    (NAMED_KEY_PATTERN.test(finalKey) ||
      SINGLE_KEY_PATTERN.test(finalKey) ||
      POINTER_ACTION_PATTERN.test(finalKey))
  );
}

export function parseTooltipContent(raw: string): ParsedTooltip {
  const trimmed = raw.trim();
  const match = trimmed.match(/^(.*?)\s+\(([^()]+)\)$/);
  if (!match) {
    return { text: trimmed, shortcuts: [] };
  }
  const baseText = match[1].trim();
  const inner = match[2].trim();
  if (!baseText || !inner) {
    return { text: trimmed, shortcuts: [] };
  }
  const parts = inner
    .split(/\s*\/\s*/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length > 0 && parts.every((part) => isValidShortcutCombo(part))) {
    return { text: baseText, shortcuts: parts };
  }
  return { text: trimmed, shortcuts: [] };
}

function inferPreferredSide(el: HTMLElement, rect: DOMRect): TooltipSide {
  const explicit = el.dataset.tooltipSide as TooltipSide | undefined;
  if (explicit === 'top' || explicit === 'bottom' || explicit === 'left' || explicit === 'right') {
    return explicit;
  }
  if (el.closest('aside[aria-label="Tool Windows"]') || rect.left < 52) {
    return 'right';
  }
  if (rect.top < 78) {
    return 'bottom';
  }
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  if (rect.bottom > vh - 64) {
    return 'top';
  }
  return 'top';
}

function restoreSuppressedTitle(el: HTMLElement | null): void {
  if (!el) return;
  const saved = el.dataset.quorixSavedTitle;
  if (saved !== undefined) {
    if (!el.hasAttribute('title')) {
      el.setAttribute('title', saved);
    }
    delete el.dataset.quorixSavedTitle;
  }
}

interface ActiveTooltip {
  target: HTMLElement;
  rawText: string;
  side: TooltipSide;
  anchorRect: DOMRect;
}

export const TooltipHost: React.FC = () => {
  const [active, setActive] = useState<ActiveTooltip | null>(null);
  const [coords, setCoords] = useState<{ left: number; top: number; side: TooltipSide } | null>(
    null,
  );
  const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastShownAtRef = useRef<number>(0);
  const activeTargetRef = useRef<HTMLElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const clearTimer = () => {
      if (showTimerRef.current) {
        clearTimeout(showTimerRef.current);
        showTimerRef.current = null;
      }
    };

    const dismiss = () => {
      clearTimer();
      restoreSuppressedTitle(activeTargetRef.current);
      activeTargetRef.current = null;
      setActive(null);
      setCoords(null);
    };

    const activateForElement = (el: HTMLElement) => {
      if (el === activeTargetRef.current) return;
      clearTimer();
      restoreSuppressedTitle(activeTargetRef.current);

      const raw =
        el.dataset.tooltip || el.getAttribute('title') || el.dataset.quorixSavedTitle || '';
      const trimmed = raw.trim();
      if (!trimmed) {
        activeTargetRef.current = null;
        setActive(null);
        return;
      }

      if (el.hasAttribute('title')) {
        el.dataset.quorixSavedTitle = el.getAttribute('title') || '';
        el.removeAttribute('title');
      }

      activeTargetRef.current = el;
      const warmWindow = Date.now() - lastShownAtRef.current < 420;
      const delay = warmWindow ? 55 : 240;

      showTimerRef.current = setTimeout(() => {
        if (activeTargetRef.current !== el || !el.isConnected) return;
        const freshRect = el.getBoundingClientRect();
        lastShownAtRef.current = Date.now();
        setActive({
          target: el,
          rawText: trimmed,
          side: inferPreferredSide(el, freshRect),
          anchorRect: freshRect,
        });
      }, delay);
    };

    const findTooltipTarget = (node: EventTarget | null): HTMLElement | null => {
      if (!(node instanceof Element)) return null;
      const match = node.closest<HTMLElement>('[data-tooltip], [title]');
      if (!match) return null;
      if (match.hasAttribute('data-tooltip-disabled')) return null;
      return match;
    };

    const handleMouseOver = (e: MouseEvent) => {
      const target = findTooltipTarget(e.target);
      if (!target) {
        if (activeTargetRef.current && e.target instanceof Node) {
          if (!activeTargetRef.current.contains(e.target)) {
            dismiss();
          }
        }
        return;
      }
      activateForElement(target);
    };

    const handleMouseOut = (e: MouseEvent) => {
      const current = activeTargetRef.current;
      if (!current) return;
      const related = e.relatedTarget;
      if (related instanceof Node && current.contains(related)) return;
      const nextTarget = findTooltipTarget(related);
      if (nextTarget === current) return;
      dismiss();
    };

    const handleFocusIn = (e: FocusEvent) => {
      const target = findTooltipTarget(e.target);
      if (!target) return;
      try {
        if (!target.matches(':focus-visible')) return;
      } catch {
        return;
      }
      activateForElement(target);
    };

    const handleFocusOut = (e: FocusEvent) => {
      if (!activeTargetRef.current) return;
      const related = e.relatedTarget;
      if (related instanceof Node && activeTargetRef.current.contains(related)) return;
      dismiss();
    };

    document.addEventListener('mouseover', handleMouseOver);
    document.addEventListener('mouseout', handleMouseOut);
    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('focusout', handleFocusOut);
    window.addEventListener('mousedown', dismiss, true);
    window.addEventListener('scroll', dismiss, true);
    window.addEventListener('wheel', dismiss, { passive: true, capture: true });
    window.addEventListener('keydown', dismiss, true);
    window.addEventListener('blur', dismiss);

    return () => {
      dismiss();
      document.removeEventListener('mouseover', handleMouseOver);
      document.removeEventListener('mouseout', handleMouseOut);
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('focusout', handleFocusOut);
      window.removeEventListener('mousedown', dismiss, true);
      window.removeEventListener('scroll', dismiss, true);
      window.removeEventListener('wheel', dismiss, true);
      window.removeEventListener('keydown', dismiss, true);
      window.removeEventListener('blur', dismiss);
    };
  }, []);

  useEffect(() => {
    if (!active || !tooltipRef.current) {
      setCoords(null);
      return;
    }
    const tipRect = tooltipRef.current.getBoundingClientRect();
    const { anchorRect, side: initialSide } = active;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const gap = 8;

    let finalSide = initialSide;
    if (finalSide === 'top' && anchorRect.top - tipRect.height - gap < 8) {
      finalSide = 'bottom';
    } else if (finalSide === 'bottom' && anchorRect.bottom + tipRect.height + gap > vh - 8) {
      finalSide = 'top';
    } else if (finalSide === 'right' && anchorRect.right + tipRect.width + gap > vw - 8) {
      finalSide = 'left';
    } else if (finalSide === 'left' && anchorRect.left - tipRect.width - gap < 8) {
      finalSide = 'right';
    }

    let left = anchorRect.left + anchorRect.width / 2 - tipRect.width / 2;
    let top = anchorRect.top - tipRect.height - gap;

    if (finalSide === 'bottom') {
      top = anchorRect.bottom + gap;
    } else if (finalSide === 'right') {
      left = anchorRect.right + gap;
      top = anchorRect.top + anchorRect.height / 2 - tipRect.height / 2;
    } else if (finalSide === 'left') {
      left = anchorRect.left - tipRect.width - gap;
      top = anchorRect.top + anchorRect.height / 2 - tipRect.height / 2;
    }

    left = Math.max(8, Math.min(vw - tipRect.width - 8, left));
    top = Math.max(8, Math.min(vh - tipRect.height - 8, top));

    setCoords({ left, top, side: finalSide });
  }, [active]);

  if (!active || typeof document === 'undefined') return null;

  const parsed = parseTooltipContent(active.rawText);

  return createPortal(
    <div
      ref={tooltipRef}
      role="tooltip"
      style={{
        left: coords ? `${coords.left}px` : '-9999px',
        top: coords ? `${coords.top}px` : '-9999px',
        opacity: coords ? 1 : 0,
      }}
      className="fixed z-[9999] pointer-events-none max-w-[300px] px-2.5 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text)] shadow-[0_8px_24px_rgba(0,0,0,0.38)] flex items-center gap-2 text-[11.5px] leading-snug transition-opacity duration-75"
    >
      <span className="font-medium break-words whitespace-pre-line">{parsed.text}</span>
      {parsed.shortcuts.length > 0 && (
        <span className="inline-flex items-center gap-1 shrink-0">
          {parsed.shortcuts.map((sc, idx) => (
            <span key={sc} className="inline-flex items-center gap-1">
              {idx > 0 && <span className="text-[10px] text-[var(--text-muted)]">/</span>}
              <Kbd size="xs">{sc}</Kbd>
            </span>
          ))}
        </span>
      )}
    </div>,
    document.body,
  );
};
