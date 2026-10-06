/** Whether an HTTP response should be retried by our API client. */
export function shouldRetry(status: number): boolean {
  // Only rate limits (429) and server failures (500–599) are retryable.
  return status >= 400;
}
