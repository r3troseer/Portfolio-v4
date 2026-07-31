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
- measurable cost and verification records;
- deterministic repeated operations that do not depend on controller memory;
- atomic, independently revertible commits created only after review.

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
- deterministic contract sealing, write-set locks, and execution records;
- permission and sensitive-data boundaries;
- independent adjudication of worker and verifier findings, with full diff review when risk or
  evidence requires it;
- browser, Computer Use, accessibility, performance, and visual checks where relevant;
- integration, commit, push, and PR actions only when separately authorized;
- atomic commit boundaries and commit-gate verification;
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

### 3.4 Dedicated Cursor verifier

For production-release gate reviews, or for non-trivial delegated tasks under an approved
Codex-context-saving route, Codex may assign one independent read-only Cursor verifier after
implementation evidence exists. The verifier receives a sealed verification contract, the exact
diff or changed files, the smallest relevant evidence set, and no write paths. It performs the
detailed diff review, but does not replace Codex judgment or repository checks.

Select the verifier model from the current approved budget route. A time-bounded local routing
override may choose a Fast variant while the user is present and a standard variant while the user
is away. Record that override locally and in the sealed contract. Always verify the exact model ID
against the installed model list; never reconstruct it from memory or silently substitute a model.

Do not spend a verifier run on a microscopic change or while implementation is still moving. One
verifier may review a coherent gate or atomic unit. A repair continuation is allowed only when the
first result fails the verifier output contract, and it must resume the same session rather than
start a new agent.

Cursor/Grok has no connected Browser or Computer Use capability in this workflow. It must mark
visual and interaction evidence that requires those capabilities as unverified. Codex or the user
owns only that irreducible runtime or visual confirmation; the verifier must never claim it.

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

The policy defines capabilities rather than permanently pinning model names or prices. Worker
selection must consider both task difficulty and the current subscription budget. A stronger
model is not automatically justified by either factor alone.

| Tier | Purpose | Selection principle |
|---|---|---|
| Cheap worker | Mechanical, narrow implementation | Lowest-cost Cursor model that reliably satisfies the contract |
| Strong worker | Complex but decision-complete implementation | Stronger Cursor model only when the task justifies it |
| Controller | Planning, boundaries, review, escalation | Codex at a reasoning level proportionate to risk |
| Escalation | Independent hard investigations or unusually deep reasoning | Ultra or explicit Codex subagents only with user approval |

### 5.1 Current first-party routing examples

As of 2026-07-13, the installed Cursor CLI exposes these useful first-party routes:

| Capability | Current CLI model example | Use |
|---|---|---|
| Economical coding specialist | `composer-2.5` | Default for bounded implementation and repair |
| Strong first-party worker | `cursor-grok-4.5-medium` | Harder decision-complete work where additional reasoning may reduce repair risk |
| Highest normal first-party worker | `cursor-grok-4.5-high` | Difficult, high-value work when the task and available first-party allowance both justify it |
| Latency variant | A corresponding `-fast` model | Urgent interactive latency only, not a quality upgrade |

`composer-2.5-fast` has the same intelligence as standard Composer 2.5 at a materially higher
published token price. A `-fast` suffix must never be treated as a stronger reasoning tier. Use
it only when reduced wall-clock latency has explicit value. `auto` is useful when Cursor should
route around availability or reliability conditions, but its opaque selection makes it a poor
default for deterministic budget routing.

These names are examples, not permanent policy. Before changing routing defaults, refresh the
available IDs with `cursor-agent --list-models` and recheck current first-party pool coverage and
pricing from official Cursor sources.

### 5.2 Budget snapshot

Before the first delegated Cursor run of a working day, and after any unusually large run, Codex
must obtain or ask the user for a current Cursor dashboard snapshot containing:

- first-party model pool percentage remaining;
- third-party/API model pool percentage remaining, when shown separately;
- snapshot time;
- subscription reset time;
- whether on-demand billing is enabled.

The dashboard is the balance source of truth. The Cursor CLI currently provides model selection
and per-run telemetry, but no documented command for the remaining subscription allowance or
reset time. Per-run token totals can support accounting but cannot reconstruct the balance
reliably because pool sizes, bonus capacity, cache charging, and model pricing may change.

A snapshot older than 24 hours is stale. If a current snapshot cannot be obtained, use the
conservative lane: at most one approved `composer-2.5` standard run, no Fast variant, no strong
worker, and no automatic repair run until the balance is refreshed.

### 5.3 Budget-aware router

The default protected reserve is 15% of the first-party model pool. The default surplus window
starts 72 hours before reset. These defaults may be changed by the user for a task or billing
cycle and must be recorded in the run log. Evaluate the rows from top to bottom and use the first
matching state so near-reset rules take precedence over ordinary percentage bands.

| First-party budget state | Default route |
|---|---|
| Reset is within 24 hours and less than 15% remains | Spend the protected reserve only with explicit user approval; otherwise preserve the cutoff |
| Reset is within 24 hours and at least 15% remains | Surplus mode: prefer Grok high for suitable high-value work; keep the task bounded and independently reviewed |
| Reset is within 72 hours and at least 30% remains | Surplus mode: prefer Grok medium/high for suitable difficult or high-value queued work |
| At least 60% remains | Composer by default; Grok medium/high is allowed when task difficulty justifies it |
| 25% to 59% remains | Composer standard; Grok only when Codex explains why it is likely to prevent greater repair cost |
| 15% to 24% remains | Conservation: Composer standard only, no Fast variant, and no extra run beyond the approved ceiling |
| Less than 15% remains | Cutoff: launch no new Cursor work; Codex takes over or asks the user |
| Balance is missing or stale | Use the conservative unknown-balance lane defined above |

First-party surplus never justifies consuming the separate third-party/API pool. Budget headroom
also does not justify delegating a poor-fit task, increasing scope, adding parallel writers, or
skipping review. The objective is to use already-paid allowance intelligently, not to manufacture
work before reset.

### 5.4 Financial and workflow cutoffs

There are two distinct controls:

1. Financial cutoff: keep Cursor on-demand billing disabled unless the user explicitly approves
   paid overage. The workflow must never enable on-demand billing. If it is enabled and a run could
   cross included usage, stop and ask before launching the run.
2. Workflow cutoff: Codex must not invoke Cursor when the budget router reaches its cutoff. This
   preflight rule is enforceable from the recorded dashboard snapshot, but it cannot interrupt a
   run at an exact live balance because the CLI exposes no documented balance endpoint.

The selected model, budget lane, and reason must appear in both the task contract and run log.

## 6. Task contract

Codex must provide one contract before every Cursor run. The contract is the worker's complete
authority boundary.

```text
Task ID:
Mode: read-only | implementation | repair
State: draft | ready | running | awaiting_review | accepted | blocked | rejected | complete

Budget snapshot time:
First-party pool remaining:
Third-party/API pool remaining:
Reset time:
Protected reserve:
On-demand billing enabled: yes | no
Budget lane:
Selected model and reason:

Objective:

Base commit and branch:
Worktree path, if writing:
Worker branch, if writing:

Completed dependencies:
Blocking dependencies:

Allowed read paths:
Allowed write paths:

Relevant sealed context:
- exact path
- reason it is required
- SHA-256 at contract approval

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

Required verification identifiers:

Atomic commit units:
- unit id
- intent
- exact path envelope
- planned commit message
- whether user visual approval is required and recorded

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

The JSON representation of this contract is the execution authority. Prose prompts are rendered
from it. A worker prompt must not silently broaden paths, acceptance criteria, budget, model, or
commit units beyond the sealed contract.

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

Only `.notes/decision-log.md` and `.notes/cc-plans.md` are append-only. Other `.notes` artifacts
may be revised or consolidated under the repository working agreement, but Cursor workers remain
read-only against every `.notes` path unless a task explicitly assigns a non-append-only note as
an allowed write path.

### 7.4 Deterministic context manifest

Every delegated task receives a minimal context manifest. It lists only the files needed for the
task, why each file is needed, and its SHA-256 hash when the contract is sealed.

- Do not ask a worker to discover all plans, decisions, audits, or handoffs broadly.
- Do not include entire conversations when a current specification and checkpoint contain the
  required decisions.
- Do not reread unchanged context after a checkpoint merely because a new model turn begins.
- Re-read a context file only when its hash changes, the task changes scope, verification exposes a
  contradiction, or a named acceptance criterion requires a section not previously supplied.
- Source files under active implementation may change normally; governance, specifications,
  handoffs, and decision context are the files that must be sealed.

If a required context hash changes, preflight fails. Codex reviews the change, updates the contract
deliberately, reseals it, and explains any effect on the task. The worker must not decide that a
changed plan is close enough.

### 7.5 Career OS ownership in delegated work

Career OS notification awareness is scoped to Layer 0/public-content work. Codex performs the
direct sibling notification check once per relevant workstream, reports open items to the user,
and records only the relevant named result in the task contract. Cursor must not independently
scan the sibling Career OS workspace unless Codex explicitly authorizes that exact read because
the controller result is unavailable or stale.

This keeps the awareness boundary intact without repeating a private sibling-workspace scan in
every worker session.

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

## 9. Deterministic scripted control plane

Use the local, dependency-free PowerShell entry point:

```text
scripts/orchestration/orchestrate.ps1
```

Its task-contract schema is:

```text
scripts/orchestration/task-contract.schema.json
```

The `scripts/` directory is intentionally gitignored and local-only. Never stage, commit,
force-add, push, or otherwise publish it. Bootstrap Gate G0 verifies the local files and records
their SHA-256 hashes before delegation. Cursor worker worktrees receive sealed contracts and do
not require the control-plane files to be present or published in their branches. A fresh clone
must restore the approved local control plane separately before delegated release work can run.

Generated contracts, prompts, preflight records, Cursor output, diff audits, verification output,
and cleanup evidence live under gitignored `tools/agent-runs/<task-id>/`.

The script owns repeatable mechanics only:

- create a contract skeleton;
- seal and verify context hashes;
- record repository/worktree/model/budget preflight state;
- reject active write-set conflicts;
- create a worker worktree from the exact approved SHA;
- render the prompt from the contract;
- invoke the installed WSL Cursor CLI with explicit model and workspace;
- audit changed paths;
- run named repository checks;
- verify an atomic staged unit;
- report cleanup readiness.

The script must not automatically stage, commit, merge, cherry-pick, push, open a PR, broaden a
contract, select a more expensive model, stop unrelated processes, delete a worktree, or discard
changes. Those actions require controller judgment and the existing user approvals.

Use named verification identifiers rather than arbitrary command strings in contracts. Add a new
identifier to the local script only when repeated work genuinely requires it. This prevents a
task manifest from becoming an unreviewed shell-script transport.

Dry-run is the default for worktree creation and Cursor execution. The controller must pass the
explicit execution switch only after preflight succeeds.

### 9.1 Canonical controller commands

Never reconstruct a Cursor command from memory. Before writing or running one, confirm the current
parameters in `scripts/orchestration/orchestrate.ps1`. If a Cursor flag or model ID is relevant,
also check the installed CLI with `cursor-agent --help` and `cursor-agent --list-models`. Run the
controller dry-run first and inspect its resolved workspace, model, mode, and prompt. Only then may
the same command be repeated with `-Execute`.

The normal sealed-task sequence is:

```powershell
$Contract = "tools/agent-runs/<task-id>/contract.json"

.\scripts\orchestration\orchestrate.ps1 seal -Contract $Contract
.\scripts\orchestration\orchestrate.ps1 preflight -Contract $Contract
.\scripts\orchestration\orchestrate.ps1 prompt -Contract $Contract
.\scripts\orchestration\orchestrate.ps1 run -Contract $Contract
.\scripts\orchestration\orchestrate.ps1 run -Contract $Contract -Execute
.\scripts\orchestration\orchestrate.ps1 diff -Contract $Contract
.\scripts\orchestration\orchestrate.ps1 verify -Contract $Contract
.\scripts\orchestration\orchestrate.ps1 commit-check -Contract $Contract -CommitUnit "<unit-id>" -Message "<exact-message>"
.\scripts\orchestration\orchestrate.ps1 status -Contract $Contract -NewState complete
.\scripts\orchestration\orchestrate.ps1 cleanup-check -Contract $Contract
```

Use `verify -VerificationId <id>` when only one verification named in the contract should run.
`commit-check` checks an already staged unit but never commits it. `cleanup-check` reports readiness
but never stops a process or removes a worktree. Codex performs any separately authorized Git commit
between `commit-check` and the `complete` state transition; that Git action is intentionally not a
controller-script command.

For a new worker worktree, run `worktree -Contract $Contract` as a dry-run and repeat it with
`-Execute` only after reviewing the resolved path and branch. Do not create another worktree when
the approved programme worktree already exists.

The controller is the source of truth and raw CLI invocation is diagnostic only. Its resolved
write-capable shape is:

```text
cursor-agent -p --output-format json --trust --workspace "<wsl-worktree-path>" --model "<verified-model-id>" "<rendered-task-prompt>"
```

For a read-only task the controller adds `--mode plan`. It adds `--force` only when the sealed
contract explicitly permits force, and `--resume` only with the sealed session ID. `--trust` is a
boolean workspace acknowledgement: it never receives the task-contract path. The contract path is
passed to `orchestrate.ps1 -Contract`; the controller renders and passes the task prompt as the
final Cursor argument.

From PowerShell, these literal probes avoid host-shell expansion while checking the installed WSL
CLI. Re-run them after a Cursor CLI version change rather than treating their output as permanent:

```powershell
wsl.exe --% -d Ubuntu-24.04 -- bash -lc 'export PATH="$HOME/.local/bin:$PATH"; cursor-agent --help'
wsl.exe --% -d Ubuntu-24.04 -- bash -lc 'export PATH="$HOME/.local/bin:$PATH"; cursor-agent --version; cursor-agent --list-models'
```

## 10. Parallelism and write-set locks

Parallel work is an optimization, not a default. Run write-capable tasks concurrently only when:

- their exact allowed write paths do not overlap;
- neither depends on evidence or output from the other;
- both start from recorded approved base commits;
- their atomic integration order is fixed before launch;
- current budget and controller review capacity support both;
- no scientific measurement requires a stable, single-change baseline.

The default maximum is two active write lanes. A third writer requires explicit user approval and
a concrete reason why it reduces delivery risk or schedule rather than only increasing activity.

Preflight scans active task contracts in `ready`, `running`, and `awaiting_review` states. Any
overlapping write envelope blocks the newer task. If an implementation discovers a required write
outside its envelope, stop and amend the contract; do not treat the path as implicitly allowed.

Performance experiments that attribute a result to one change run sequentially against a frozen
integration base. Other work may continue in isolated worktrees, but it must not enter that base
until the measurement checkpoint finishes.

## 11. Worktree policy

### 11.1 Boundary

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

### 11.2 Preflight

Before creation, Codex must record:

- current branch and HEAD;
- existing worktrees and branch names;
- current tracked and untracked changes;
- whether the worker depends on any uncommitted change;
- whether the chosen base includes everything the task needs.

Worktrees start from committed state. They do not include the main checkout's uncommitted edits,
ignored `.notes`, `node_modules`, local environments, or build artifacts. If required state is
missing, Codex must stop and ask rather than silently commit, copy, or discard user changes.

### 11.3 Setup and execution

Restore only existing locked dependencies required for verification, such as `npm ci` or
`uv sync`. Adding or upgrading dependencies remains separately approval-gated.

Use the controller sequence in Section 9.1 for both read-only and write-capable tasks. Do not pass a
contract path to raw `cursor-agent`, and do not bypass the required dry-run. Write-capable
invocation may use `--force` only after the worktree, path boundary, sealed contract, and permissions
are established. `--trust` acknowledges the workspace; it is not a security sandbox.

### 11.4 Integration and cleanup

After the worker finishes, Codex independently reviews the uncommitted worktree diff. Cursor does
not commit it. Codex may integrate accepted work only under the user's existing Git and visual
approval rules.

Do not force-remove or clean a dirty rejected worktree. Quarantine it, report why it was rejected,
and ask before destructive cleanup. Remove a worktree only after its useful changes are safely
integrated or the user explicitly authorizes disposal.

## 12. Atomic commit policy

Cursor never commits. Codex creates commits only after independent review, required verification,
and any required user visual confirmation.

An atomic commit is one causally coherent, independently revertible change that leaves the
repository in a valid buildable state. Atomic does not mean one file or one issue. A contract,
adapter, renderer, canonical-content, validation, dependency, and lockfile migration may need one
larger commit when splitting it would leave an invalid intermediate state.

Before a workstream begins, its contract declares each intended commit unit, path envelope,
message, checks, and visual-approval requirement. After one unit is implemented:

1. Cursor stops and returns the diff and evidence.
2. Codex audits paths and the complete diff.
3. Codex runs the named checks independently.
4. The user visually approves UI work before a mainline commit, or the work remains uncommitted or
   on an explicitly allowed preview branch.
5. Codex stages only that unit and runs the scripted commit gate.
6. Codex commits only when separately authorized.
7. The same bounded Cursor session may resume from the clean checkpoint for the next unit.

Never accumulate several planned commit units into an intertwined diff and attempt to reconstruct
their boundaries afterward. If a unit cannot pass independently, revise the boundary before
implementation or keep the inseparable work in one declared atomic unit.

Parallel branches integrate through reviewed atomic commits in the predetermined order. Do not
merge a worker branch wholesale merely because its final tree builds.

## 13. Permissions and data boundaries

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

## 14. Cost policy

The default budget per delegated workstream is:

1. one primary Cursor implementation run;
2. one focused Cursor repair run after Codex review.

An approved read-only verifier is a review run, not an implementation or repair run. It does not
increase the allowed number of write-capable runs.

The budget-aware router in Section 5 may tighten this ceiling but never expands it. After the
permitted runs, Codex must either complete the remaining work directly or ask the user before
another Cursor run, a stronger worker, Ultra, or Codex subagents. Surplus mode permits choosing a
stronger first-party worker within the existing run count; it does not authorize additional runs.

Cost controls:

- Do not delegate microscopic questions or edits with poor context-cost amortization.
- Prefer one complete task contract over repeated steering.
- Select the model from both task difficulty and the current budget lane.
- Use standard variants by default; Fast variants buy latency, not intelligence.
- When the user explicitly prioritizes Codex context, optimize first for Codex context saved while
  preserving correctness. Cursor token totals remain budget and quota evidence, but combined token
  usage is not the primary success metric for that route.
- Protect the 15% reserve outside the approved surplus exception.
- Never consume paid on-demand usage without explicit user approval.
- Resume only within the bounded workstream.
- Record input, cached input, output, duration, model, and request/session IDs when returned.
- Refresh the dashboard balance after an unusually large run or before a run near a cutoff.
- Judge economy by accepted work and repair rate, not token price alone.

## 15. Run log

Store operational records under the already-gitignored `tools/agent-runs/` directory. Do not put
routine worker telemetry in `.notes/decision-log.md` or `.notes/cc-plans.md`.

Recommended filename:

```text
tools/agent-runs/YYYY-MM-DDTHHMMSSZ-<task-slug>.json
```

Each log should contain:

- task ID, objective, mode, and task contract;
- base commit, branch, and worktree path;
- dashboard snapshot time, reset time, pool percentages, reserve, and on-demand status;
- selected budget lane, model, and routing reason;
- Cursor session ID, request ID, model, duration, and usage;
- worker result and reported checks;
- actual changed paths found by Codex;
- context hashes and active write-set result;
- atomic commit unit and resulting commit hash when authorized;
- Codex verification results;
- final disposition: accepted, repaired, taken over, blocked, rejected, or awaiting user review.

Logs must not contain secrets, credentials, raw private material, or prohibited research content.
They are operational evidence, not project decisions, and must never be committed.

## 16. Independent review and verification

Cursor completion is not proof of correctness. Codex must:

1. compare actual changed paths against the contract;
2. review the verifier's structured findings, cited hunks, changed-path summary, and deterministic
   evidence;
3. adjudicate every claimed defect and any disagreement against source or runtime evidence;
4. inspect the full diff directly when the task touches security, privacy, architecture,
   deployment, sensitive or public content, or when findings, scope, or evidence are suspicious,
   disputed, incomplete, or failed;
5. verify repository rules and approved architecture;
6. rerun proportionate checks rather than trusting either agent's summary;
7. use the real browser or Computer Use when behavior, responsiveness, animation, accessibility,
   or visual fidelity cannot be established statically;
8. obtain user visual confirmation before committing UI changes where required;
9. report accepted behavior, remaining risks, usage, and any unverified surface.

For bounded, non-sensitive tasks under an approved Codex-context-saving route, Codex does not
duplicate the verifier's complete line-by-line diff review unless one of the full-review triggers
above applies. Codex still owns acceptance and final judgment.

If the diff is suspicious or materially out of scope, do not ask the same session to explain it
away. Stop, quarantine the worktree, and inspect independently.

### 16.1 Dedicated verifier protocol

The dedicated verifier is an evidence reviewer, not a second implementer:

1. Launch it only after the implementation diff and controller verification evidence are stable.
2. Use a new read-only verifier session, never the implementation worker session.
3. Prefer the existing programme worktree or controller checkout; read-only verification does not
   justify creating another product worktree.
4. Send only the sealed contract, exact diff or changed files, named acceptance criteria, and the
   smallest evidence required to test them. Exclude unrelated notes and repository context.
5. Require the verifier to review the complete supplied diff and distinguish `confirmed`,
   `uncertain`, and `non-issue` findings with exact evidence and cited hunks.
6. Require it to mark Browser, Computer Use, and visual confirmation as unverified unless the
   evidence was supplied from an authorized external run.
7. Require these final fields: summary, changed files, checks and outcomes, acceptance status,
   unresolved risks, and session/model/usage metadata when available.
8. Treat a successful process exit without that report as an invalid verifier result. Resume the
   same session once with a result-only correction; do not launch a second verifier.
9. Codex checks every claimed defect against source or runtime evidence and rejects false positives.
10. Codex still runs deterministic checks and owns acceptance, commits, integration, and reporting.

Use a verifier at release gates, security/data-boundary reviews, complex atomic units, or each
non-trivial delegated implementation during an approved Codex-context-saving route. Do not use it
for routine mechanical checks that the controller can settle deterministically.

## 17. Failure and escalation rules

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
| Balance is missing or older than 24 hours | Refresh it or use the conservative unknown-balance lane |
| First-party allowance is below the protected reserve | Do not launch new Cursor work unless the final-24-hour reserve exception is explicitly approved |
| A run may enter paid on-demand usage | Stop and obtain explicit user approval before launching |
| Context hash changed after approval | Stop, review the change, amend and reseal the contract |
| Active write sets overlap | Do not launch in parallel; sequence or redefine the task boundary |
| Atomic unit cannot pass independently | Stop and correct the boundary before committing |

## 18. Definition of a successful delegated workstream

A delegated workstream is successful only when:

- hybrid use was authorized for the task;
- the worker stayed within the contract and worktree;
- no prohibited data or action was exposed;
- the diff is scoped and independently reviewed;
- required verification passed or remaining gaps are explicit;
- user approvals were obtained where required;
- model selection followed the recorded budget lane and did not silently cross the reserve;
- usage and disposition were recorded in the gitignored run log;
- no worker-created commit, push, PR, or stale process remains;
- every accepted commit is atomic, independently verified, and recorded;
- worktree integration or quarantine status is clear.

## 19. Reference basis and refresh triggers

The workflow is based on the documented behavior of:

- Codex subagents: `https://learn.chatgpt.com/docs/agent-configuration/subagents`;
- Codex worktrees: `https://learn.chatgpt.com/docs/environments/git-worktrees`;
- Codex Computer Use: `https://learn.chatgpt.com/docs/computer-use`;
- Cursor CLI sessions and rules: `https://docs.cursor.com/en/cli/using`;
- Cursor headless mode: `https://docs.cursor.com/en/cli/headless`;
- Cursor CLI permissions: `https://docs.cursor.com/cli/reference/permissions`;
- Cursor model and usage pricing: `https://docs.cursor.com/account/pricing`;
- Composer 2.5 variants and pricing: `https://cursor.com/changelog/composer-2-5`;
- Cursor Grok 4.5 first-party coverage: `https://cursor.com/blog/grok-4-5`.

Recheck these sources before changing default model examples, cost assumptions, authentication,
permission syntax, headless write flags, session behavior, or worktree automation. Verified local
behavior takes precedence when current tooling demonstrably differs from documentation, and the
discrepancy must be recorded in the run log.
