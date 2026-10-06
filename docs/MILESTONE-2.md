# Milestone 2 review decisions

- Package context from the committed tree, not mutable worktree paths. This fixes mismatch between pinned baseline and source content and eliminates filesystem symlink traversal from scanning.
- Share bounded Git blob/tree reading between context selection and validation export. Preserve conservative path, mode, binary and size checks.
- Redact structured fields before serialization. HTML-escape the already-redacted SDK content without repeating lossy text redaction over JSON. Regression checks require the decoded SDK brief to equal the complete draft.
- Apply the mock-only environment check uniformly to all commands.
- Identify the production runner as `docker` in verdict JSON. Keep the local runner in the demo module only; verify the full bundled baseline and exact patch before executing fixed compiler/test commands. No arbitrary candidate, path or test command is accepted by the demo script.
- Make fixture Git commits reproducible with a fixed author, timestamp, branch, object format and disabled hooks/signing. Keep changing TAP durations separate from deterministic baseline/context/patch identity.
- No new service integration or monetary API is enabled.
