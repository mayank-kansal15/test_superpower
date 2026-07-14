# Project Instructions

## Implementation plan detail level (overrides `superpowers:writing-plans`)

The `writing-plans` skill's defaults ("complete code in every step", full
test code, full implementation code) produce plans that duplicate the exact
code that gets written to the actual files a few minutes later — this wastes
a large number of tokens for no benefit in this project. In this repo, plans
must use **prose + signatures only: no fenced code blocks for tests or
implementation.**

When generating a plan under `docs/superpowers/plans/`:

- **Files** and **Interfaces** blocks stay as the skill defines them — exact
  file paths, and exact function/method signatures (name, params, return
  type). Keep these; they're cheap and they're what stops later tasks from
  drifting (e.g. a method called `resolveDependsOn` in Task 1 must stay
  `resolveDependsOn` everywhere it's referenced later).
- **"Write the failing test(s)" steps:** list each test as one line — what
  scenario it sets up and what it asserts — not the test code itself.
  Example: `should throw NotFoundException when dependsOn contains an
  unknown id` instead of a full `it(...) { ... }` block.
- **"Implement X" steps:** describe the logic as a short bullet list against
  the exact signature from the Interfaces block — what the function must do,
  which edge cases it must handle, what it calls/throws — not the function
  body. Example: "validate `id` exists via `findTodoOrThrow`; dedupe the
  input array; throw `NotFoundException` if any id doesn't resolve" instead
  of the implementation.
- **"Run tests" steps:** keep the exact command and the one-line expected
  result (e.g. `FAIL — dependsOn is undefined`). These are cheap and worth
  keeping verbatim.
- **"Commit" steps:** keep the exact `git add` / `git commit` commands and
  message. Also cheap, worth keeping verbatim.
- Never include a fenced code block containing test or implementation code
  anywhere in the plan document.

This relaxes the skill's "No Placeholders" rule from "show the code" to "be
precise in prose": vague filler like "add appropriate error handling" or
"handle edge cases" (without saying which ones) is still a plan failure —
just describe the exact behavior in words instead of pasting the code that
implements it.

This applies to plan *authoring* (`writing-plans`) and to plan *execution*
(`executing-plans` — see below, subagent-driven execution is not used in
this repo): the executing agent implements each task from its signature +
prose description, following this codebase's existing patterns and
conventions, rather than transcribing code from the plan.

Existing plans under `docs/superpowers/plans/` were written before this rule
and don't need to be rewritten.

## Execution mode (overrides Execution Handoff in `superpowers:writing-plans`)

After a plan is saved, `writing-plans` normally stops and asks whether to
execute it via subagent-driven-development or inline execution. In this
repo, skip that question — **always execute plans inline, using
`superpowers:executing-plans`.** Never use `superpowers:subagent-driven-development`.

Because there's no per-task subagent that needs a self-contained,
zero-context task description, inline execution needs even less scaffolding
in the plan than the "prose + signatures only" rule above already provides
— don't add extra context, background, or code back into tasks to compensate
for there being no subagent. The same plan (prose + exact signatures + exact
commands) is sufficient input for inline execution.
