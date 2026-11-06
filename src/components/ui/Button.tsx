import React, { forwardRef } from 'react';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';
type Size = 'md' | 'lg';

type CommonProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  /** primary: the one main action; secondary: everything else; danger: destroys or ends something; ghost: low-emphasis */
  variant?: Variant;
  /** md is 40px tall (44px on phones); lg is 48px, for controls used on deck */
  size?: Size;
  icon?: React.ReactNode;
  /** Shows loadingLabel and disables the button while an action runs */
  loading?: boolean;
  loadingLabel?: string;
};

// An icon-only button must have an accessible name.
type WithLabel = CommonProps & { children: React.ReactNode };
type IconOnly = CommonProps & { children?: undefined; icon: React.ReactNode; 'aria-label': string };
export type ButtonProps = WithLabel | IconOnly;

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-on-accent hover:brightness-110',
  secondary: 'bg-raised text-ink border border-line hover:brightness-110',
  danger: 'bg-danger text-on-danger hover:brightness-110',
  ghost: 'bg-transparent text-ink hover:bg-raised',
};

const SIZES: Record<Size, { text: string; icon: string }> = {
  // 44px on phones: a scrolling dialog clips the tap-target box, so the button itself is that tall
  md: { text: 'min-h-10 max-sm:min-h-11 px-4 text-sm', icon: 'h-10 w-10 max-sm:h-11 max-sm:w-11' },
  lg: { text: 'min-h-12 px-5 text-base', icon: 'h-12 w-12' },
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', icon, loading = false, loadingLabel, className = '', children, disabled, type = 'button', ...rest },
  ref
) {
  const iconOnly = children === undefined || children === null;
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={[
        // tap-target: a 40px button still takes taps over 44 x 44
        'tap-target inline-flex items-center justify-center gap-2 rounded-control font-semibold transition-[filter,background-color] select-none',
        'disabled:cursor-not-allowed disabled:opacity-50',
        VARIANTS[variant],
        iconOnly ? SIZES[size].icon : SIZES[size].text,
        className,
      ].join(' ')}
      {...rest}
    >
      {icon && <span aria-hidden="true" className="inline-flex shrink-0 [&>svg]:h-4 [&>svg]:w-4">{icon}</span>}
      {!iconOnly && (loading && loadingLabel ? loadingLabel : children)}
    </button>
  );
});
