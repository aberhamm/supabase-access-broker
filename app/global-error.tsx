'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isStaleActionError =
    error.message?.includes('Server Action') &&
    error.message?.includes('was not found');

  useEffect(() => {
    if (!isStaleActionError) {
      console.error(error);
    }
  }, [error, isStaleActionError]);

  if (isStaleActionError) {
    return (
      <html>
        <body>
          <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
            <h2 className="text-xl font-semibold">App updated</h2>
            <p className="text-muted-foreground max-w-sm">
              This page is out of date. Refresh to continue.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
            >
              Refresh page
            </button>
          </div>
        </body>
      </html>
    );
  }

  return (
    <html>
      <body>
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
          <h2 className="text-xl font-semibold">Something went wrong</h2>
          <p className="text-muted-foreground max-w-sm text-sm">{error.message}</p>
          <button
            onClick={reset}
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
