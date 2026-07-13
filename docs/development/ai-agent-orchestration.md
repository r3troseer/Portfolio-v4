# AI-Assisted Development Orchestration

## 1. Purpose

This policy governs coding work delegated between the user, Codex, and Cursor Agent. It is a
development workflow, not part of the portfolio application's runtime agent architecture.
Runtime agent, retrieval, and Layer S product documentation remains under `docs/agent/`.

The workflow is designed to combine:

- strong architectural judgment and independent review from Codex;
- lower-cost, bounded implementation work from Cursor Agent;
- explicit user control over scope, risk, and publication;
- isolation that protects the user's current checkout and uncommitted work;
- measurable cost and verification records.

This policy does not expand the authority granted by the user's request. Repository rules,
Layer S boundaries, approval requirements, and public-content restrictions still apply.

## 2. Activation and authority

Hybrid delegation is task-scoped and opt-in.

- The user must authorize the hybrid workflow for the current task.
- After that authorization, Codex may route eligible bounded work to Cursor without asking for
  approval before every invocation.
- Codex must announce each delegation, its scope, and whether it is read-only or write-capable.
- Authorization ends when the workstream is completed, abandoned, or materially changes scope.
- A new task, architectural direction, sensitive-data boundary, dependency, deployment change,
  or public-content decision requires fresh user authority under the normal repository rules.

The user remains the lead pilot and final decision-maker.

## 3. Roles

### 3.1 User

The user:

- approves the task scope and hybrid delegation;
- decides architectural, product, privacy, dependency, deployment, and publication questions;
- visually approves user-facing changes where repository rules require it;
- authorizes any work beyond the default cost ceiling.

### 3.2 Codex controller and reviewer

Codex owns:

- repository inspection and problem framing;
- architectural and product decisions;
- the task contract and acceptance criteria;
- worker selection and capability tier;
- worktree creation and lifecycle;
- permission and sensitive-data boundaries;
- independent diff review and verification;
- browser, Computer Use, accessibility, performance, and visual checks where relevant;
- integration, commit, push, and PR actions only when separately authorized;
- the final report to the user.

Codex must not outsource its final judgment to the worker.

### 3.3 Cursor worker

Cursor Agent may:

- inspect task-relevant repository files;
- implement a bounded, decision-complete task;
- run explicitly permitted checks and tests;
- report changed files, results, risks, and unresolved questions.

Cursor Agent must not:

- make unresolved architectural, product, privacy, or Layer S decisions;
- add dependencies, change routes or deployment, or alter public content without prior approval;
- inspect secrets, credentials, keys, tokens, auth stores, or prohibited research internals;
- commit, push, merge, cherry-pick, open a PR, or modify Git history;
- use destructive filesystem or Git commands;
- treat its own tests or summary as final proof;
- expand the task because adjacent improvements appear useful.

## 4. Routing rubric

### 4.1 Delegate to Cursor when all gates pass

Cursor is suitable when:

- the user opted into hybrid work for the task;
- the objective and definition of done are decision-complete;
- allowed paths and forbidden actions are clear;
- the implementation is mechanical or well specified;
- acceptance can be checked through diffs, tests, builds, or explicit UI evidence;
- no secret or prohibited sensitive material is required;
- write work can run in an isolated worktree;
- the expected implementation value justifies Cursor's fixed context-loading cost.

Typical delegated work includes scoped implementation, repetitive transformations, test
additions, documentation updates, and a focused repair after Codex review.

### 4.2 Keep work in Codex when any gate fails

Codex retains:

- ambiguous requirements or architecture;
- security, privacy, Layer S, ESG, or X-RAG decisions;
- dependency, route, deployment, and public-content choices awaiting approval;
- broad investigations whose boundaries are not yet known;
- final code review, visual judgment, and production-readiness decisions;
- tiny lookups or edits where worker startup context would cost more than doing the work locally;
- recovery from suspicious, out-of-scope, or repeatedly failing worker output.

### 4.3 Ultra, Codex subagents, and Computer Use

- Use Codex Ultra or Codex subagents only after explicit user approval beyond the default budget.
- Prefer subagents for genuinely independent, read-heavy investigations. Do not give parallel
  writers overlapping files.
- Do not use Computer Use to operate the Cursor GUI when the Cursor CLI can perform the task.
- Use Computer Use only for GUI-dependent work, and use the in-app browser for real web UI
  verification when appropriate.

## 5. Capability tiers

The policy defines capabilities rather than permanently pinning model names or prices.

| Tier | Purpose | Selection principle |
|---|---|---|
| Cheap worker | Mechanical, narrow implementation | Lowest-cost Cursor model that reliably satisfies the contract |
| Strong worker | Complex but decision-complete implementation | Stronger Cursor model only when the task justifies it |
| Controller | Planning, boundaries, review, escalation | Codex at a reasoning level proportionate to risk |
| Escalation | Independent hard investigations or unusually deep reasoning | Ultra or explicit Codex subagents only with user approval |

Current models may be recorded as examples in a run log, but model names and prices are not
normative policy. Recheck current pricing and availability before changing routing defaults.

## 6. Task contract

Codex must provide one contract before every Cursor run. The contract is the worker's complete
authority boundary.

```text
Task ID:
Mode: read-only | implementation | repair

Objective:

Base commit and branch:
Worktree path, if writing:

Allowed paths:

Relevant read-only context:
- Include only necessary handoffs, decisions, plans, audits, or other ignored files.

Forbidden paths and data:
- .env files, credentials, keys, tokens, auth stores
- private-repository internals
- prohibited ESG/X-RAG or other sensitive research internals
- unrelated user or ignored files

Forbidden actions:
- no dependency, architecture, route, deployment, or public-content decisions
- no commit, push, merge, cherry-pick, PR, or history rewrite
- no destructive filesystem or Git commands
- no edits outside allowed paths

Acceptance criteria:

Required verification:

Expected result:
- summary
- changed files
- commands and checks run, with outcomes
- acceptance criteria status
- unresolved risks or blockers
- session ID, model, duration, and usage when available
```

If the worker finds that the contract is incomplete or contradictory, it must stop and report
the conflict instead of choosing a direction.

## 7. Rule and context policy

### 7.1 Source priority

For Cursor workers, `.cursor/rules/*.mdc` is the authoritative Cursor-specific expression of
repository rules. `AGENTS.md` and `CLAUDE.md` substantially duplicate those conventions for
other coding-agent surfaces.

Cursor automatically receives these rule sources. A prompt cannot remove tokens already loaded,
but it can prevent duplicate instructions from being reread or independently over-weighted.

Every Cursor contract must include this instruction:

```text
Treat .cursor/rules as the authoritative Cursor rule source. AGENTS.md and CLAUDE.md
substantially duplicate those rules. Do not reread, summarize, quote, or independently weight
duplicated material. If a genuine conflict or unique requirement appears, stop and report it
to the Codex controller before proceeding.
```

### 7.2 Parity responsibility

Before relying on this priority, Codex must confirm that relevant rules remain synchronized.
When a repository convention changes, update the mapped Cursor rule and the corresponding root
agent guidance as required by the repository working agreement.

### 7.3 Relevant `.notes` access

`.notes` is not categorically prohibited. Cursor may read task-relevant handoffs, prototypes,
plans, decisions, and audits when the contract identifies them or the work demonstrably requires
them.

Cursor must not:

- broadly ingest unrelated notes;
- edit append-only notes or logs;
- infer that an ignored path is empty because normal search omitted it;
- access secret, private, or prohibited sensitive content even if it is stored under `.notes`.

Because ignored files are not copied into a Git worktree, relevant notes normally remain in the
main checkout and are supplied as explicit, read-only absolute paths.

## 8. Session and attention policy

Use one Cursor session per bounded, PR-sized workstream.

- Start a fresh session for a new objective or materially different scope.
- Resume the session for the same implementation and its single focused repair.
- Do not keep one permanent repository session.
- Do not start a fresh session for every small correction within the same workstream.
- Checkpoint before expected compaction or when context begins to diffuse.
- Rotate to a fresh session after compaction, contradiction, scope change, repeated mistakes,
  stale assumptions, or evidence of attention loss.

Checkpoint format:

```text
Objective and current definition of done:
Decisions already made:
Allowed and forbidden paths:
Files changed:
Checks run and results:
Acceptance criteria still open:
Known risks or blockers:
Exact next action:
```

A new session receives the checkpoint, current diff summary, and task contract. It does not
receive the full old conversation unless a specific earlier exchange is essential.

## 9. Worktree policy

### 9.1 Boundary

- Read-only Cursor checks may inspect the current checkout.
- Every Cursor edit must occur in a separate sibling Git worktree and worker branch.
- Default path pattern: `../Portfolio-v4-worktrees/cursor-<task-slug>`.
- Default branch pattern: `cursor/<task-slug>`.
- Cursor must not commit or publish from the worktree.

Example creation command:

```powershell
git worktree add `
  -b cursor/<task-slug> `
  ../Portfolio-v4-worktrees/cursor-<task-slug> `
  <approved-base-commit>
```

### 9.2 Preflight

Before creation, Codex must record:

- current branch and HEAD;
- existing worktrees and branch names;
- current tracked and untracked changes;
- whether the worker depends on any uncommitted change;
- whether the chosen base includes everything the task needs.

Worktrees start from committed state. They do not include the main checkout's uncommitted edits,
ignored `.notes`, `node_modules`, local environments, or build artifacts. If required state is
missing, Codex must stop and ask rather than silently commit, copy, or discard user changes.

### 9.3 Setup and execution

Restore only existing locked dependencies required for verification, such as `npm ci` or
`uv sync`. Adding or upgrading dependencies remains separately approval-gated.

Read-only invocation pattern:

```powershell
wsl.exe -d Ubuntu-24.04 -- bash -lc "cd '<wsl-worktree-path>' && cursor-agent -p --output-format json --trust '<task-contract>'"
```

Write-capable invocation may use `--force` only after the worktree, path boundary, contract, and
permissions are established. `--trust` acknowledges the workspace; it is not a security sandbox.

### 9.4 Integration and cleanup

After the worker finishes, Codex independently reviews the uncommitted worktree diff. Cursor does
not commit it. Codex may integrate accepted work only under the user's existing Git and visual
approval rules.

Do not force-remove or clean a dirty rejected worktree. Quarantine it, report why it was rejected,
and ask before destructive cleanup. Remove a worktree only after its useful changes are safely
integrated or the user explicitly authorizes disposal.

## 10. Permissions and data boundaries

Worktrees prevent edit collisions; they are not security sandboxes. The task contract and Cursor
CLI permissions must apply least privilege.

Default prohibitions:

- read or write `.env*`, credentials, keys, certificates, tokens, browser profiles, or auth data;
- read prohibited private-repository, ESG, X-RAG, or confidential research internals;
- write outside task-approved worktree paths;
- run Git publication or history-changing commands;
- run destructive deletion commands;
- access unrelated filesystem locations or external services;
- expose ignored or local-only content in prompts, logs, commits, or responses.

Allow only the shell commands needed by the task. Codex, not Cursor, owns Git inspection and
publication. Any permission escalation requires a reason tied to an acceptance criterion.

## 11. Cost policy

The default budget per delegated workstream is:

1. one primary Cursor implementation run;
2. one focused Cursor repair run after Codex review.

After those runs, Codex must either complete the remaining work directly or ask the user before
another Cursor run, a stronger worker, Ultra, or Codex subagents.

Cost controls:

- Do not delegate microscopic questions or edits with poor context-cost amortization.
- Prefer one complete task contract over repeated steering.
- Use capability tiers instead of the strongest model by default.
- Resume only within the bounded workstream.
- Record input, cached input, output, duration, model, and request/session IDs when returned.
- Judge economy by accepted work and repair rate, not token price alone.

## 12. Run log

Store operational records under the already-gitignored `tools/agent-runs/` directory. Do not put
routine worker telemetry in `.notes/decision-log.md` or `.notes/cc-plans.md`.

Recommended filename:

```text
tools/agent-runs/YYYY-MM-DDTHHMMSSZ-<task-slug>.json
```

Each log should contain:

- task ID, objective, mode, and task contract;
- base commit, branch, and worktree path;
- Cursor session ID, request ID, model, duration, and usage;
- worker result and reported checks;
- actual changed paths found by Codex;
- Codex verification results;
- final disposition: accepted, repaired, taken over, blocked, rejected, or awaiting user review.

Logs must not contain secrets, credentials, raw private material, or prohibited research content.
They are operational evidence, not project decisions, and must never be committed.

## 13. Independent review and verification

Cursor completion is not proof of correctness. Codex must independently:

1. compare actual changed paths against the contract;
2. inspect the full diff for correctness, scope, security, and accidental deletion;
3. verify repository rules and approved architecture;
4. rerun proportionate checks rather than trusting the worker's summary;
5. use the real browser or Computer Use when behavior, responsiveness, animation, accessibility,
   or visual fidelity cannot be established statically;
6. obtain user visual confirmation before committing UI changes where required;
7. report accepted behavior, remaining risks, usage, and any unverified surface.

If the diff is suspicious or materially out of scope, do not ask the same session to explain it
away. Stop, quarantine the worktree, and inspect independently.

## 14. Failure and escalation rules

| Condition | Required response |
|---|---|
| Cursor CLI or authentication unavailable | Report the failure; Codex takes over or asks for direction |
| Contract ambiguity discovered | Worker stops; Codex resolves with the user when required |
| Forbidden path or action attempted | Stop the run, quarantine the worktree, and report |
| First implementation is incomplete | Codex issues one focused repair contract |
| Repair also fails | Codex takes over or requests approval for further spend |
| Context compaction or attention drift | Produce a checkpoint and start a fresh session |
| Required uncommitted state is absent | Stop; never silently commit or copy user changes |
| Verification disagrees with worker report | Trust observed diff/test/browser evidence, not the report |
| Visual change lacks user confirmation | Keep it uncommitted from the mainline |
| Cleanup would be destructive | Ask before removing or discarding anything |

## 15. Definition of a successful delegated workstream

A delegated workstream is successful only when:

- hybrid use was authorized for the task;
- the worker stayed within the contract and worktree;
- no prohibited data or action was exposed;
- the diff is scoped and independently reviewed;
- required verification passed or remaining gaps are explicit;
- user approvals were obtained where required;
- usage and disposition were recorded in the gitignored run log;
- no worker-created commit, push, PR, or stale process remains;
- worktree integration or quarantine status is clear.

## 16. Reference basis and refresh triggers

The workflow is based on the documented behavior of:

- Codex subagents: `https://learn.chatgpt.com/docs/agent-configuration/subagents`;
- Codex worktrees: `https://learn.chatgpt.com/docs/environments/git-worktrees`;
- Codex Computer Use: `https://learn.chatgpt.com/docs/computer-use`;
- Cursor CLI sessions and rules: `https://docs.cursor.com/en/cli/using`;
- Cursor headless mode: `https://docs.cursor.com/en/cli/headless`;
- Cursor CLI permissions: `https://docs.cursor.com/cli/reference/permissions`;
- Cursor model and usage pricing: `https://docs.cursor.com/account/pricing`.

Recheck these sources before changing default model examples, cost assumptions, authentication,
permission syntax, headless write flags, session behavior, or worktree automation. Verified local
behavior takes precedence when current tooling demonstrably differs from documentation, and the
discrepancy must be recorded in the run log.
