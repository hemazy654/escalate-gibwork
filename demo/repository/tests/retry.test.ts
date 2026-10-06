import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shouldRetry } from '../src/retry.js';

test('rate limits and server errors are retryable', () => {
  for (const status of [429, 500, 502, 503, 599]) assert.equal(shouldRetry(status), true, `status ${status}`);
});
test('client errors, successful responses and invalid upper bounds are not retried', () => {
  for (const status of [200, 301, 400, 401, 403, 404, 499, 600]) assert.equal(shouldRetry(status), false, `status ${status}`);
});
