"use client";

export default function MarketingError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto flex min-h-[calc(100dvh-8rem)] max-w-md items-center justify-center px-4 text-center">
      <div>
        <h1 className="mb-2 font-semibold text-xl">Something went wrong</h1>
        <p className="mb-6 text-muted-foreground text-sm">
          {error.message || "An unexpected error occurred."}
          {error.digest ? ` (${error.digest})` : ""}
        </p>
        <button
          className="rounded-lg bg-primary px-4 py-2 font-medium text-primary-foreground text-sm hover:bg-primary/90"
          onClick={reset}
          type="button"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
