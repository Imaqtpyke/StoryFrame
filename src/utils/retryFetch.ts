/**
 * Retry utility with exponential backoff for handling 503 Service Unavailable,
 * 429 Too Many Requests, and network errors.
 */

export interface RetryOptions {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  onRetry?: (attempt: number, maxAttempts: number, delayMs: number, error: any) => void;
}

export async function fetchWithExponentialBackoff(
  fetchFn: () => Promise<Response>,
  options: RetryOptions = {}
): Promise<Response> {
  const maxAttempts = options.maxAttempts ?? 4;
  const initialDelayMs = options.initialDelayMs ?? 2000;
  const maxDelayMs = options.maxDelayMs ?? 30000;

  let attempt = 1;
  while (true) {
    try {
      const response = await fetchFn();
      
      // If 503 or 429, treat as retryable server error
      if ((response.status === 503 || response.status === 429 || response.status >= 500) && attempt < maxAttempts) {
        const errorText = `Server status ${response.status} (${response.statusText || 'Unavailable'})`;
        const delayMs = Math.min(initialDelayMs * Math.pow(2, attempt - 1), maxDelayMs);
        
        if (options.onRetry) {
          options.onRetry(attempt, maxAttempts, delayMs, new Error(errorText));
        }

        await new Promise((resolve) => setTimeout(resolve, delayMs));
        attempt++;
        continue;
      }

      return response;
    } catch (err: any) {
      // Network errors (TypeError) or abort errors
      const isNetworkError = err instanceof TypeError || err?.name === 'AbortError' || err?.message?.includes('network');
      if (attempt < maxAttempts) {
        const delayMs = Math.min(initialDelayMs * Math.pow(2, attempt - 1), maxDelayMs);
        
        if (options.onRetry) {
          options.onRetry(attempt, maxAttempts, delayMs, err);
        }

        await new Promise((resolve) => setTimeout(resolve, delayMs));
        attempt++;
        continue;
      }
      throw err;
    }
  }
}
