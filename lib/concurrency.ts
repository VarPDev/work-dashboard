/**
 * Run an async mapper over a list with a hard concurrency ceiling.
 *
 * One mention candidate costs one Jira comments call, so this is what keeps a
 * hundred candidates from turning into a hundred simultaneous requests and a
 * 429 from Jira.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (limit < 1) throw new Error(`Concurrency limit must be at least 1, got ${limit}.`);

  const results = new Array<R>(items.length);
  let next = 0;

  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const index = next;
      next += 1;
      if (index >= items.length) return;
      results[index] = await fn(items[index], index);
    }
  });

  await Promise.all(workers);
  return results;
}
