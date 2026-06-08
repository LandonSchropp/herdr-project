/**
 * Compares two strings for alphabetical ordering, suitable as an `Array#sort` comparator. Ordering
 * follows the user's locale.
 *
 * @param a The first string to compare.
 * @param b The second string to compare.
 * @returns A negative number when `a` sorts first, positive when `b` sorts first, zero when equal.
 */
export function compareStrings(a: string, b: string): number {
  return a.localeCompare(b);
}
