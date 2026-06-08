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

/**
 * Selects the singular or plural form of a noun based on a count. A count of exactly one yields the
 * singular form; every other count yields the plural form.
 *
 * @param count The quantity the noun refers to.
 * @param singular The singular form of the noun.
 * @param plural The plural form of the noun. Defaults to the singular form with an `s` appended.
 * @returns The singular form when `count` is one, otherwise the plural form.
 */
export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return count === 1 ? singular : plural;
}
