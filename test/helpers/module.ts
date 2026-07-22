import { mock } from "bun:test";

const originals = new Map<string, unknown>();

/**
 * Replaces a module for the current test. The original is restored automatically after the test by
 * `unstubAllModules` in `test/setup.ts`, so a mock set up in one test can never leak into another.
 *
 * @param specifier The module's resolved specifier, e.g. `import.meta.resolve("./layout.ts")`. Must
 *   go through `import.meta.resolve` (not a bare relative path) so the real module is looked up
 *   relative to the caller rather than this helper.
 * @param factory Returns the replacement module's exports.
 */
export async function stubModule(specifier: string, factory: () => unknown): Promise<void> {
  if (!originals.has(specifier)) {
    // Bun's `mock.module` silently no-ops when the factory returns the exact real module object by
    // reference, so a plain copy is captured here rather than the module namespace itself — otherwise
    // `unstubAllModules` couldn't restore it later.
    originals.set(specifier, { ...(await import(specifier)) });
  }

  await mock.module(specifier, factory);
}

/** Restores every module previously replaced with {@link stubModule}. */
export async function unstubAllModules(): Promise<void> {
  for (const [specifier, original] of originals.entries()) {
    await mock.module(specifier, () => original);
  }

  originals.clear();
}
