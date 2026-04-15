"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled error:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <h2 className="text-2xl font-semibold text-gray-900">
        Something went wrong
      </h2>
      <p className="max-w-md text-gray-600">
        An unexpected error occurred. Please try again or contact support if the
        problem persists.
      </p>
      <button
        onClick={reset}
        className="mt-2 rounded-lg bg-orange-500 px-6 py-2.5 text-sm font-medium text-white hover:bg-orange-600 transition-colors"
      >
        Try again
      </button>
    </div>
  );
}
