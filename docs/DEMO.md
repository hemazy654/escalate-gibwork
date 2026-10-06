# ESCALATE: 2–3 minute recording

## Prepare (before recording)

Install Node.js 22+ and Git. Run `npm ci` once to install dependencies, then `npm run demo`. No Docker, wallet, API key or paid service is required. The demo compiles the CLI, runs real tests on a disposable Git repository, invokes all three CLI commands, checks its own results and saves inspectable JSON artifacts in `.escalate/demo/`.

The bug, historical attempt report, human submission and diagnostic canary are bundled fixtures. The initial failing tests, SDK-backed retrieval, patch application, compilation and passing tests are executed for real. The local demo runner has **no isolation** and accepts only the bundled repository contents and exact patch. It is not a fallback for arbitrary submissions; production `escalate review` still requires Docker.

Open these files in a terminal/editor before recording:

- `demo/repository/src/retry.ts` and `demo/repository/tests/retry.test.ts`
- `demo/failure.json`
- `demo/solution.patch`
- After running: `.escalate/demo/bounty.json` and `.escalate/demo/validation.json`

## Recording script (~2:30)

| Time | On screen | Narration |
| --- | --- | --- |
| 0:00–0:20 | Show the five-line retry function and two tests. | “Our API client retries every response from 400 upward. That wastes requests on authentication and client errors. It should retry only 429 and server errors from 500 to 599.” |
| 0:20–0:40 | Show `demo/failure.json` with the three attempt summaries. | “An agent raises the threshold, then overfits special cases, then misses the upper bound. These are plausible recorded failures in our fixture. ESCALATE accepts this failure evidence from an agent or CI.” |
| 0:40–1:05 | Run `npm run demo`. Show stages 1 and 2. | “The actual baseline tests fail. Diagnose finds three consecutive failed attempts and recommends escalation.” |
| 1:05–1:30 | Show stages 3–4, then the bounty JSON. | “ESCALATE selects committed source and test context, redacts the synthetic API key, preserves failed attempts and pins a reproducible Git baseline. It prepares the official Gibwork SDK's bounty input with a proposed reward. This is a local draft; nothing is published or funded.” |
| 1:30–1:50 | Show stage 5, the mock submission and `demo/solution.patch`. | “A human proposes an inclusive server-error range plus rate limits. Review retrieves this mock submission through the real official SDK's request path with an offline transport. The local patch and submission have the same SHA-256 digest.” |
| 1:50–2:15 | Show stage 6 and `.escalate/demo/validation.json`, especially `before`, `after`, `runner`, `isolation`. | “The candidate is applied to a fresh snapshot, compiled and tested: FAIL becomes PASS. This recording uses our trusted local demo runner: isolation is explicitly none. Production validation separately passed actual network-disabled Docker, resource limits and isolation probes.” |
| 2:15–2:30 | Return to the PASS stage and baseline/digest. | “The maintainer has evidence to review, then the agent can continue with the validated fix. PASS is advisory. ESCALATE never pays, approves, merges or resumes an agent automatically.” |

The demo may take around 10–30 seconds depending on the machine; narrate the failure report while it runs. Pause or scroll after completion to follow the stages. Every run recreates the same baseline and context/patch digests. Temporary checkouts are removed, the original checkout is unchanged, and artifacts are refreshed.

## Reviewer commands

```sh
npm ci
npm run demo
# Pure machine-readable story (no npm banners):
npm run --silent demo -- --json
# Inspect artifacts:
cat .escalate/demo/bounty.json
cat .escalate/demo/validation.json
# Independently show SDK-backed fixture retrieval:
node dist/cli.js review retry-policy-task --fixtures demo/submissions.json
```

JSON output includes real test output with variable timing; baseline, context digest, patch digest and submission IDs are deterministic. Do not imply that a bounty exists on Gibwork or a payment occurred. Source canaries are plainly synthetic; they are not usable credentials.

For real submissions, use the documented Docker review path from the README. There is no `--demo-runner` or unsafe host-execution switch on `escalate review`.

## Exact final recording checklist

### Before recording

- [ ] Use Node 22+ and Git; open a terminal in the repository root.
- [ ] Run `npm ci` before capture so install logs do not consume the video.
- [ ] Hide personal terminal prompts, home-directory paths, browser profiles, notifications and unrelated tabs.
- [ ] Close Phantom/wallet tabs and never run `verify:phantom`, `verify:live:phantom`, `verify:live` in live mode or `inspect:prepared --rpc` for this recording.
- [ ] Open the buggy function, tests and three-attempt fixture listed above.
- [ ] Confirm final checks passed. Docker integration is verified separately; no Docker installation is needed for this video.

### Record approximately 2:30

- [ ] 0:00–0:20: show the genuine bug and unchanged acceptance tests.
- [ ] 0:20–0:40: show the three synthetic attempt summaries and label them as fixture history.
- [ ] 0:40–1:05: run exactly `npm run demo`; show baseline FAIL and escalation detection.
- [ ] 1:05–1:30: show bounded tracked context, `[REDACTED]`, pinned baseline and local bounty draft; say “not published or funded.”
- [ ] 1:30–1:50: show the mock SDK submission and associated patch digest; say “offline transport.”
- [ ] 1:50–2:15: show real PASS and the explicit `isolation: none` label. State production Docker isolation was verified separately.
- [ ] 2:15–2:30: say “One real SDK 0.2.0 authenticated discovery read also returned HTTP 200. Funding and transaction signing remain disabled. The maintainer reviews the result before the agent continues.” Do not make a fresh live request.

### Review and attach

- [ ] Every simulated/live distinction is audible or visible; no claim of a real funded task, live participant or automatic agent resume.
- [ ] No wallet public address, signature, session URL/token, authorization header, private evidence or personal path is visible.
- [ ] If terminal output shows a local absolute artifact path, crop/blur only that personal portion while retaining stage/verdict information.
- [ ] Capture optional terminal FAIL→PASS and redacted-draft screenshots with honest captions; retain the local-runner label.
- [ ] Watch the complete exported 2–3 minute video, check audio/readability, then upload and verify viewer access.
- [ ] Add the real repository/video links to the submission form; use the copy in [SUBMISSION.md](SUBMISSION.md).

The recording uses only the offline demo. Do not upload `.escalate/` or a raw live-auth evidence file. The public live-read result is documented in [LIVE-READONLY.md](LIVE-READONLY.md), and the current safety design is in [SECURITY.md](../SECURITY.md).
