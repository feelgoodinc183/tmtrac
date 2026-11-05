import React, { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';
import { Button } from './Button';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface DialogProps {
  open: boolean;
  /** Called on Esc, the close button, or a click outside, unless dismissible is false */
  onClose: () => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  /** Action buttons, shown at the bottom right */
  footer?: React.ReactNode;
  /** Error or status shown inside the dialog, above the footer */
  error?: React.ReactNode;
  /** alertdialog for confirmations and interruptions */
  role?: 'dialog' | 'alertdialog';
  /** Element to focus first; defaults to the first field or button */
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  /** When false, Esc and clicking outside do nothing and there is no close button */
  dismissible?: boolean;
  size?: 'sm' | 'md' | 'lg';
  /** system dialogs (like "signed out") sit above everything else */
  layer?: 'normal' | 'system';
  /**
   * For dialogs with steps: change this when the content is replaced, so focus moves to the new
   * step's first control instead of falling out of the dialog (which would break Esc and Tab)
   */
  focusKey?: string | number;
}

const WIDTHS = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl' };

/**
 * Accessible modal dialog: labelled for screen readers, traps Tab inside, closes on Esc,
 * focuses the first field and returns focus to where it was when it closes.
 */
export const Dialog: React.FC<DialogProps> = ({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  error,
  role = 'dialog',
  initialFocusRef,
  dismissible = true,
  size = 'sm',
  layer = 'normal',
  focusKey,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();

  const focusFirst = () => {
    const panel = panelRef.current;
    const target =
      initialFocusRef?.current ||
      panel?.querySelector<HTMLElement>('[data-autofocus]') ||
      panel?.querySelector<HTMLElement>('input:not([disabled]), select:not([disabled]), textarea:not([disabled])') ||
      panel?.querySelector<HTMLElement>(FOCUSABLE) ||
      panel;
    target?.focus();
  };

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    focusFirst();
    return () => previouslyFocused?.focus?.();
  }, [open]);

  // A new step: move focus into it (skipped on the first render, which the effect above handles)
  const firstFocusKey = useRef(true);
  useEffect(() => {
    if (firstFocusKey.current) {
      firstFocusKey.current = false;
      return;
    }
    if (open) focusFirst();
  }, [focusKey]);

  if (!open) return null;

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      if (dismissible) onClose();
      return;
    }
    if (e.key !== 'Tab' || !panelRef.current) return;
    const items = [...panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <div
      className={`fixed inset-0 ${layer === 'system' ? 'z-[10001]' : 'z-[10000]'} flex items-center justify-center bg-black/70 p-4`}
      onMouseDown={(e) => {
        if (dismissible && e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className={`w-full ${WIDTHS[size]} max-h-[90vh] overflow-y-auto outline-none rounded-container border border-line bg-surface p-5 text-ink shadow-2xl`}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id={titleId} className="text-base font-bold text-ink">
            {title}
          </h2>
          {dismissible && (
            <Button variant="ghost" icon={<X />} aria-label="Close" onClick={onClose} className="-mr-2 -mt-2" />
          )}
        </div>
        {description && (
          <div id={descId} className="mt-2 text-sm leading-relaxed text-ink-muted">
            {description}
          </div>
        )}
        {children && <div className="mt-4">{children}</div>}
        {error && (
          <div role="alert" className="mt-4 rounded-control border border-danger-ink/40 px-3 py-2 text-sm text-danger-ink">
            {error}
          </div>
        )}
        {footer && <div className="mt-5 flex flex-wrap justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
};
