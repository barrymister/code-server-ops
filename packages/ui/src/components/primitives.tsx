import { forwardRef, type ButtonHTMLAttributes, type HTMLAttributes, type InputHTMLAttributes, type ReactNode, type TableHTMLAttributes, type TdHTMLAttributes, type ThHTMLAttributes } from "react";
import { cn } from "../lib/cn.js";

type ButtonVariant = "default" | "danger" | "ghost" | "outline";
type ButtonSize = "sm" | "md";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  default:
    "bg-zinc-100 text-zinc-900 hover:bg-zinc-200 disabled:bg-zinc-700 disabled:text-zinc-400",
  danger:
    "bg-red-600 text-white hover:bg-red-500 disabled:bg-red-900/40 disabled:text-red-300",
  ghost:
    "bg-transparent text-zinc-200 hover:bg-zinc-800",
  outline:
    "border border-zinc-700 bg-transparent text-zinc-100 hover:bg-zinc-800",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "h-7 px-2 text-xs",
  md: "h-9 px-3 text-sm",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "default", size = "md", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center gap-1 rounded-md font-medium transition disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400",
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className,
      )}
      {...rest}
    />
  );
});

interface CardProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  title?: ReactNode;
  action?: ReactNode;
  description?: ReactNode;
}

export function Card({ className, title, action, description, children, ...rest }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-zinc-800 bg-zinc-900/50 shadow-sm",
        className,
      )}
      {...rest}
    >
      {(title || action || description) && (
        <div className="flex items-start justify-between border-b border-zinc-800 p-4">
          <div>
            {title && <h2 className="text-base font-semibold text-zinc-50">{title}</h2>}
            {description && (
              <p className="mt-1 text-sm text-zinc-400">{description}</p>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
}

type BadgeTone = "neutral" | "green" | "red" | "amber" | "blue";

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: "bg-zinc-800 text-zinc-300",
  green: "bg-green-900/40 text-green-300",
  red: "bg-red-900/40 text-red-300",
  amber: "bg-amber-900/40 text-amber-300",
  blue: "bg-blue-900/40 text-blue-300",
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

export function Badge({ className, tone = "neutral", ...rest }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium",
        TONE_CLASSES[tone],
        className,
      )}
      {...rest}
    />
  );
}

export function Table({ className, ...rest }: TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto">
      <table
        className={cn("w-full border-collapse text-left text-sm", className)}
        {...rest}
      />
    </div>
  );
}

export function Th({ className, ...rest }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        "border-b border-zinc-800 py-2 pr-3 text-xs font-medium uppercase tracking-wide text-zinc-400",
        className,
      )}
      {...rest}
    />
  );
}

export function Td({ className, ...rest }: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={cn("border-b border-zinc-800 py-2 pr-3 align-middle text-zinc-200", className)}
      {...rest}
    />
  );
}

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}

export function Dialog({ open, onClose, title, description, children, footer }: DialogProps) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-lg border border-zinc-800 bg-zinc-900 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-zinc-800 p-4">
          <h2 className="text-base font-semibold text-zinc-50">{title}</h2>
          {description && (
            <p className="mt-1 text-sm text-zinc-400">{description}</p>
          )}
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-4">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 border-t border-zinc-800 p-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...rest }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          "h-9 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-zinc-500",
          className,
        )}
        {...rest}
      />
    );
  },
);

interface EmptyStateProps {
  title?: string;
  description?: string;
}

export function EmptyState({ title = "Nothing to show", description }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 py-8 text-center">
      <div className="text-sm font-medium text-zinc-300">{title}</div>
      {description && <div className="text-xs text-zinc-500">{description}</div>}
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-zinc-400">
      <div className="h-3 w-3 animate-spin rounded-full border-2 border-zinc-600 border-t-zinc-200" />
      {label && <span>{label}</span>}
    </div>
  );
}
