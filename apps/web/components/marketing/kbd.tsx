import { cn } from "@/lib/utils";

export const Kbd = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <kbd
    className={cn(
      "inline-flex min-w-8 items-center justify-center rounded-sm border border-border bg-secondary px-2 py-1 font-mono text-[0.8125rem] font-medium text-muted-foreground shadow-[0_1px_0_var(--border)] transition-[transform,box-shadow] duration-100 hover:translate-y-px hover:shadow-none",
      className,
    )}
  >
    {children}
  </kbd>
);
