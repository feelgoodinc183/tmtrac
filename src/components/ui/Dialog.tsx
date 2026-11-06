import React, { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';
import { Button } from './Button';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface DialogFrameProps {
  /** Called on Esc (unless dismissible is false), and on a click outside when closeOnBackdrop is set */
  onClose: () => void;
  /** id of the element holding the dialog's visible title */
  labelledBy?: string;
  /** Accessible name, for a dialog without a visible title */
  label?: string;
  describedBy?: string;
  /** alertdialog for confirmations and interruptions */
  role?: 'dialog' | 'alertdialog';
  /** Element to focus first; otherwise an element marked data-autofocus, then see initialFocus */
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  /**
   * 'first-field' focuses the first field (or else the first button); 'container' focuses the
   * dialog itself, for large dialogs whose first control is Close or sits far down the content
   */
  initialFocus?: 'first-field' | 'container';
  /** When false, Esc does nothing */
  dismissible?: boolean;
  /** Close when the backdrop around the panel is clicked */
  closeOnBackdrop?: boolean;
  /** Classes for the full-screen backdrop: position, layer, colour, padding */
  overlayClassName: string;
  overlayId?: string;
  /** Classes for the panel that holds the content */
  className?: string;
  id?: string;
  /**
   * For dialogs with steps: change this when the content is replaced, so focus moves to the new
   * step's first control instead of falling out of the dialog (which would break Esc and Tab)
   */
  focusKey?: string | number;
  children?: React.ReactNode;
}

/**
 * The accessible part of a modal dialog, with no layout of its own: labelled for screen readers,
 * traps Tab inside, closes on Esc (only the top one when a dialog opens over another), moves focus
 * in when it opens and returns it to where it was when it closes. Render it only while the dialog
 * is open. Dialogs with their own header and layout use this; simple ones use Dialog.
 */
export const DialogFrame: React.FC<DialogFrameProps> = ({
  onClose,
  labelledBy,
  label,
  describedBy,
  role = 'dialog',
  initialFocusRef,
  initialFocus = 'first-field',
  dismissible = true,
  closeOnBackdrop = false,
  overlayClassName,
  overlayId,
  className = '',
  id,
  focusKey,
  children,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);

  const focusFirst = () => {
    const panel = panelRef.current;
    // First match that is actually shown (fields hidden at this screen size are skipped)
    const firstVisible = (selector: string) =>
      [...(panel?.querySelectorAll<HTMLElement>(selector) ?? [])].find((el) => el.getClientRects().length > 0);
    const target =
      initialFocusRef?.current ||
      firstVisible('[data-autofocus]') ||
      (initialFocus === 'first-field'
        ? firstVisible('input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled])') ||
          firstVisible(FOCUSABLE)
        : null) ||
      panel;
    target?.focus();
  };

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    focusFirst();
    return () => previouslyFocused?.focus?.();
  }, []);

  // A new step: move focus into it (skipped on the first render, which the effect above handles)
  const firstFocusKey = useRef(true);
  useEffect(() => {
    if (firstFocusKey.current) {
      firstFocusKey.current = false;
      return;
    }
    focusFirst();
  }, [focusKey]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    // Stopped here so a dialog underneath this one does not react to the same key
    if (e.key === 'Escape') {
      e.stopPropagation();
      if (dismissible) onClose();
      return;
    }
    if (e.key !== 'Tab' || !panelRef.current) return;
    e.stopPropagation();
    const items = [...panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.getClientRects().length > 0);
    if (items.length === 0) {
      e.preventDefault();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || active === panelRef.current)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (active === last || !panelRef.current.contains(active))) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <div
      id={overlayId}
      className={overlayClassName}
      onMouseDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (closeOnBackdrop) onClose();
        // Otherwise keep focus inside the dialog
        else e.preventDefault();
      }}
    >
      <div
        ref={panelRef}
        id={id}
        role={role}
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-label={labelledBy ? undefined : label}
        aria-describedby={describedBy}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className={`outline-none ${className}`}
      >
        {children}
      </div>
    </div>
  );
};

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
  /** See DialogFrameProps.focusKey */
  focusKey?: string | number;
}

const WIDTHS = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl' };

/**
 * Accessible modal dialog with the standard layout: title, optional description, content, error
 * and footer actions. Built on DialogFrame.
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
  const titleId = useId();
  const descId = useId();

  if (!open) return null;

  return (
    <DialogFrame
      onClose={onClose}
      labelledBy={titleId}
      describedBy={description ? descId : undefined}
      role={role}
      initialFocusRef={initialFocusRef}
      dismissible={dismissible}
      closeOnBackdrop={dismissible}
      focusKey={focusKey}
      overlayClassName={`fixed inset-0 ${layer === 'system' ? 'z-[10001]' : 'z-[10000]'} flex items-center justify-center bg-black/70 p-4`}
      className={`w-full ${WIDTHS[size]} max-h-[90vh] overflow-y-auto rounded-container border border-line bg-surface p-5 text-ink shadow-2xl`}
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
    </DialogFrame>
  );
};
