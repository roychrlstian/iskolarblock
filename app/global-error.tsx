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
      <body style={{ margin: 0, fontFamily: "Arial, sans-serif" }}>
        <div
          style={{
            display: "flex",
            minHeight: "100vh",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "1rem",
            padding: "1.5rem",
            textAlign: "center",
          }}
        >
          <h2 style={{ fontSize: "1.5rem", fontWeight: 600, color: "#111827" }}>
            Something went wrong
          </h2>
          <p style={{ maxWidth: "28rem", color: "#4B5563" }}>
            A critical error occurred. Please try refreshing the page.
            {error.digest && (
              <span style={{ display: "block", fontSize: "0.75rem", marginTop: "0.5rem", color: "#9CA3AF" }}>
                Error ID: {error.digest}
              </span>
            )}
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: "0.5rem",
              borderRadius: "0.5rem",
              backgroundColor: "#f97316",
              padding: "0.625rem 1.5rem",
              fontSize: "0.875rem",
              fontWeight: 500,
              color: "#ffffff",
              border: "none",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
