import { createInterface } from "node:readline/promises";

/**
 * Asks a yes/no question at the terminal.
 *
 * @param message The question to ask, without a trailing prompt suffix.
 * @param input The stream to read the answer from.
 * @param output The stream to print the question to.
 * @returns Whether the answer was yes.
 */
export async function confirm(
  message: string,
  input: NodeJS.ReadableStream = process.stdin,
  output: NodeJS.WritableStream = process.stdout,
): Promise<boolean> {
  const readline = createInterface({ input, output });

  try {
    const answer = await readline.question(`${message} [y/N] `);
    return /^y(es)?$/i.test(answer.trim());
  } finally {
    readline.close();
  }
}
