"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          alignItems: "center",
          backgroundColor: "#0a0a0a",
          color: "#fafafa",
          display: "flex",
          fontFamily: "system-ui, sans-serif",
          justifyContent: "center",
          minHeight: "100dvh",
        }}
      >
        <div style={{ maxWidth: "28rem", padding: "2rem", textAlign: "center" }}>
          <h1
            style={{
              fontSize: "1.5rem",
              fontWeight: 600,
              marginBottom: "0.5rem",
            }}
          >
            Something went wrong
          </h1>
          <p
            style={{
              color: "#a1a1aa",
              fontSize: "0.875rem",
              marginBottom: "1.5rem",
            }}
          >
            {error.message || "An unexpected error occurred."}
            {error.digest ? ` (${error.digest})` : ""}
          </p>
          <button
            onClick={reset}
            style={{
              backgroundColor: "#fafafa",
              border: "none",
              borderRadius: "0.5rem",
              color: "#0a0a0a",
              cursor: "pointer",
              fontSize: "0.875rem",
              fontWeight: 500,
              padding: "0.5rem 1rem",
            }}
            type="button"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
