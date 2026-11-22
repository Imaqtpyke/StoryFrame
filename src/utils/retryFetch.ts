/**
 * Retry utility with exponential backoff for handling 503 Service Unavailable,
 * 429 Too Many Requests, and transient network errors without triggering blind retry storms.
 */

export interface RetryOptions {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  maxRateLimitWaitMs?: number;
  signal?: AbortSignal;
  onRetry?: (attempt: number, maxAttempts: number, delayMs: number, error: any) => void;
}

/**
 * Sleeps for `delayMs` while rejecting immediately if `signal` aborts.
 */
export function abortableSleep(delayMs: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) {
    return Promise.reject(new DOMException('Generation request was cancelled by user.', 'AbortError'));
  }
  if (delayMs <= 0) return Promise.resolve();

  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      resolve();
    }, delayMs);

    const onAbort = () => {
      clearTimeout(timer);
      cleanup();
      reject(new DOMException('Generation request was cancelled by user.', 'AbortError'));
    };

    const cleanup = () => {
      if (signal) {
        signal.removeEventListener('abort', onAbort);
      }
    };

    if (signal) {
      signal.addEventListener('abort', onAbort, { once: true });
    }
  });
}

/**
 * Parses Google / HTTP retry delay hints (Retry-After header, RetryInfo.retryDelay, or message text)
 * and returns a wait duration in milliseconds, or null if none was supplied.
 */
export function parseRetryAfterMs(response?: Pick<Response, 'headers'>, bodyText?: string): number | null {
  try {
    const headerVal = response?.headers?.get?.('retry-after')?.trim();
    if (headerVal) {
      const asSeconds = Number(headerVal);
      if (Number.isFinite(asSeconds) && asSeconds > 0) {
        return Math.ceil(asSeconds * 1000);
      }
      const asDate = Date.parse(headerVal);
      if (Number.isFinite(asDate) && asDate > Date.now()) {
        return Math.ceil(asDate - Date.now());
      }
    }
  } catch {
    // Ignore header parse failure
  }

  if (!bodyText) return null;

  // Match protobuf Duration strings like "42s", "12.4s", "1m5s" in RetryInfo JSON
  const durationJsonMatch = bodyText.match(/"retryDelay"\s*:\s*"(?:(\d+)m)?(\d+(?:\.\d+)?)s"/i);
  if (durationJsonMatch) {
    const mins = durationJsonMatch[1] ? parseFloat(durationJsonMatch[1]) : 0;
    const secs = durationJsonMatch[2] ? parseFloat(durationJsonMatch[2]) : 0;
    const totalMs = Math.ceil((mins * 60 + secs) * 1000);
    if (totalMs > 0) return totalMs;
  }

  // Match plain English hints like "Please retry in 38.4s" or "try again in 15 seconds"
  const textMatch = bodyText.match(/(?:retry|try again)\s+in\s+(\d+(?:\.\d+)?)\s*(?:s|sec|seconds?)\b/i);
  if (textMatch) {
    const secs = parseFloat(textMatch[1]);
    if (Number.isFinite(secs) && secs > 0) {
      return Math.ceil(secs * 1000);
    }
  }

  return null;
}

/**
 * Detects non-retryable 429 quota blocks (limit: 0 or daily/monthly exhaustion)
 * where retrying inside a short window will always fail.
 */
export function isNonRetryableQuotaExhaustion(status: number, bodyText: string): boolean {
  if (status !== 429 || !bodyText) return false;
  if (/\blimit:\s*0\b/i.test(bodyText)) return true;
  if (/"quotaValue"\s*:\s*"?0"?/i.test(bodyText)) return true;
  if (/(?:GenerateRequestsPerDay|RequestsPerDay|TokensPerDay|PerDayPerProject|daily quota|per[- ]day limit|PerMonth)/i.test(bodyText)) {
    return true;
  }
  return false;
}

export async function fetchWithExponentialBackoff(
  fetchFn: () => Promise<Response>,
  options: RetryOptions = {}
): Promise<Response> {
  const maxAttempts = options.maxAttempts ?? 4;
  const initialDelayMs = options.initialDelayMs ?? 2000;
  const maxDelayMs = options.maxDelayMs ?? 30000;
  const maxRateLimitWaitMs = options.maxRateLimitWaitMs ?? 65000;

  let attempt = 1;
  while (true) {
    if (options.signal?.aborted) {
      throw new DOMException('Generation request was cancelled by user.', 'AbortError');
    }

    try {
      const response = await fetchFn();

      if (response.status === 429) {
        const bodyText = await response.clone().text().catch(() => '');

        // Do not burn retries on hard billing/tier blocks (limit: 0) or daily RPD exhaustion
        if (isNonRetryableQuotaExhaustion(429, bodyText)) {
          return response;
        }

        // For transient 429s, cap total attempts at max 3 (or caller maxAttempts if smaller)
        const rateLimitMaxAttempts = Math.min(maxAttempts, 3);
        if (attempt >= rateLimitMaxAttempts) {
          return response;
        }

        const hintedDelayMs = parseRetryAfterMs(response, bodyText);
        if (hintedDelayMs !== null && hintedDelayMs > maxRateLimitWaitMs) {
          return response;
        }

        const fallbackDelayMs = Math.min(initialDelayMs * Math.pow(2, attempt - 1), maxDelayMs);
        const delayMs =
          hintedDelayMs !== null
            ? Math.min(Math.max(hintedDelayMs + 1000, fallbackDelayMs), maxRateLimitWaitMs)
            : fallbackDelayMs;

        if (options.onRetry) {
          options.onRetry(
            attempt,
            rateLimitMaxAttempts,
            delayMs,
            new Error(`Server status 429 (${response.statusText || 'Rate Limited'})`)
          );
        }

        await abortableSleep(delayMs, options.signal);
        attempt++;
        continue;
      }

      // If 503 or 5xx, retry with exponential backoff
      if ((response.status === 503 || response.status >= 500) && attempt < maxAttempts) {
        const errorText = `Server status ${response.status} (${response.statusText || 'Unavailable'})`;
        const delayMs = Math.min(initialDelayMs * Math.pow(2, attempt - 1), maxDelayMs);

        if (options.onRetry) {
          options.onRetry(attempt, maxAttempts, delayMs, new Error(errorText));
        }

        await abortableSleep(delayMs, options.signal);
        attempt++;
        continue;
      }

      return response;
    } catch (err: any) {
      // Never retry user-cancelled requests
      if (err?.name === 'AbortError' || options.signal?.aborted) {
        throw err;
      }
      if (attempt < maxAttempts) {
        const delayMs = Math.min(initialDelayMs * Math.pow(2, attempt - 1), maxDelayMs);

        if (options.onRetry) {
          options.onRetry(attempt, maxAttempts, delayMs, err);
        }

        await abortableSleep(delayMs, options.signal);
        attempt++;
        continue;
      }
      throw err;
    }
  }
}
