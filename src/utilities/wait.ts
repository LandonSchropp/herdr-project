/**
 * Resolves after the given delay. A non-positive delay resolves on the next tick.
 *
 * @param milliseconds The number of milliseconds to wait before resolving.
 * @returns A promise that resolves once the delay has elapsed.
 */
export function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
