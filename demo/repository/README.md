# API client retry policy
Retry HTTP 429 and 500–599. Do not retry other HTTP responses.
The implementation currently retries client errors and invalid upper bounds.
Run the TypeScript compiler, then `node --test build/tests/retry.test.js`.
