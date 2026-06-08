import { ErrorBoundary } from "./error-boundary.tsx";
import { FatalError } from "./fatal-error.tsx";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";

type RootProps = {
  /** The TUI tree to render and guard against crashes. */
  children: ReactNode;
};

/**
 * Top-level wrapper that turns any crash, whether a render error or an async failure, into the
 * {@link FatalError} screen instead of letting it paint over the live TUI. The first error wins;
 * later ones are ignored so the screen shows the original cause.
 */
export function Root({ children }: RootProps) {
  const [error, setError] = useState<unknown>(undefined);

  useEffect(() => {
    const handle = (thrown: unknown) => setError((current: unknown) => current ?? thrown);

    process.on("unhandledRejection", handle);
    process.on("uncaughtException", handle);

    return () => {
      process.off("unhandledRejection", handle);
      process.off("uncaughtException", handle);
    };
  }, []);

  if (error !== undefined) {
    return <FatalError error={error} />;
  }

  return <ErrorBoundary onError={setError}>{children}</ErrorBoundary>;
}
