export async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 4
): Promise<T> {
  let lastErr: unknown
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (err: any) {
      const status: number = err?.status ?? err?.response?.status ?? 0
      if (status !== 429 && (status < 500 || status > 599)) throw err
      lastErr = err
      const delay = Math.min(1_000 * 2 ** attempt + Math.random() * 500, 30_000)
      await new Promise<void>((r) => setTimeout(r, delay))
    }
  }
  throw lastErr
}
