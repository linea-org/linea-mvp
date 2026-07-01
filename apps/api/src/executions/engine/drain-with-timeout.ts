/** Drains an async generator, aborting if it runs longer than timeoutMs. */
export async function drainWithTimeout<T>(
  gen: AsyncIterable<T>,
  timeoutMs: number,
): Promise<T | undefined> {
  const iter = gen[Symbol.asyncIterator]();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () =>
        reject(
          new Error(`Execution timed out after ${timeoutMs / 60_000} minutes`),
        ),
      timeoutMs,
    );
  });

  let last: T | undefined;
  try {
    while (true) {
      const result = await Promise.race([iter.next(), timeout]);
      if (result.done) return last;
      last = result.value;
    }
  } catch (err) {
    // Let the generator run its own cleanup (finally blocks) before rethrowing
    await iter.return?.();
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
