# Todo Timezone Design

**Goal:** Let a todo carry an optional IANA `timezone` (e.g. `"America/New_York"`). When set, a bare-date `dueDate` string like `"2026-07-20"` is interpreted as end-of-day in that timezone, not midnight UTC.

## Scope

- Only bare date strings (`"YYYY-MM-DD"`, no time component) are affected by `timezone`. A full ISO datetime string (e.g. `"2026-07-20T15:00:00Z"`) is always taken literally as an absolute instant, regardless of `timezone` — it's already unambiguous.
- `timezone` is persisted on the todo (not a one-time conversion hint), returned in responses, and reused on later updates.
- The `dueBefore`/`dueAfter` query filters on `GET /todos` are unchanged — they're not tied to any single todo's stored timezone, so they keep parsing as literal UTC instants.
- No new dependency. Both timezone validation and offset computation use Node's built-in `Intl` API, which ships the full IANA database via ICU — consistent with how `dependsOn` and `priority` avoided new dependencies.

## Data model

`Todo` gains one field:

- `timezone?: string` — an IANA zone name, e.g. `"America/New_York"`. Optional, mirrors how `dueDate` is optional today.

`CreateTodoDto` gains:

- `timezone?: string`, validated with a new `@IsIanaTimeZone()` custom class-validator decorator.

`UpdateTodoDto` inherits `timezone?` automatically via the existing `PartialType(CreateTodoDto)`.

## Behavior

### Resolving `dueDate`

A new helper, `TodosService.resolveDueDate(dueDate: string | undefined, timezone: string | undefined): Date | undefined`, replaces the current inline `new Date(dueDate)` calls in both `create` and `update`:

- `dueDate` is `undefined` → returns `undefined` (unchanged).
- `dueDate` matches a bare date pattern (`YYYY-MM-DD`, no time/offset) **and** `timezone` is defined → returns the UTC instant corresponding to `23:59:59.999` local time in that zone, on that calendar date.
- Otherwise (full ISO datetime string, or a bare date with no `timezone`) → returns `new Date(dueDate)`, exactly today's behavior.

This helper delegates the actual zone math to a new pure utility module, `src/todos/timezone.util.ts`:

- `isDateOnly(value: string): boolean` — true iff `value` is exactly `YYYY-MM-DD` with no time component.
- `endOfDayInZone(dateOnly: string, timeZone: string): Date` — computes the UTC instant for `23:59:59.999` local time in `timeZone` on the given calendar date, using the standard "guess as UTC, measure the zone's displayed offset via `Intl.DateTimeFormat.formatToParts`, then correct" technique. No external date/timezone library involved.

### Create

`create` calls `resolveDueDate(createTodoDto.dueDate, createTodoDto.timezone)` and stores `timezone: createTodoDto.timezone` on the new `Todo`, alongside the existing fields.

### Update

`update` handles `timezone` together with the existing `dueDate` special-casing (both are pulled out of the generic `Object.assign(todo, rest)` path, the same way `dueDate` and `dependsOn` already are):

1. If `timezone` is present in the request, it's applied to `todo.timezone` first.
2. Then, if `dueDate` is present in the request, it's resolved via `resolveDueDate(dueDate, todo.timezone)` — using the *just-updated* value from step 1 if `timezone` was included in the same request, or the previously-stored value otherwise.

This means a bare-date-only PATCH (no `timezone` in that request) reuses whatever zone was stored earlier, and a `timezone`-only PATCH (no `dueDate` in that request) just updates the stored zone with no recomputation of the existing `dueDate`.

### Unaffected

- `isOverdue` — computed from the already-resolved absolute UTC instant, same as today; no changes needed.
- `dueBefore`/`dueAfter` query filters — unchanged, per Scope above.
- `dependsOn` completion/cycle/deletion gating — untouched, no interaction with timezone.

## Validation

New `@IsIanaTimeZone()` class-validator decorator (via `registerDecorator`): a string is valid iff `new Intl.DateTimeFormat('en-US', { timeZone: value })` does not throw. Node throws `RangeError` for unknown zone names; that's caught and treated as invalid. An invalid `timezone` fails validation and produces a 400 automatically through the existing global `ValidationPipe({ whitelist: true, transform: true })`, the same as `@IsIn`/`@IsDateString` do today for `priority`/`dueDate`.

## Testing

- `src/todos/timezone.util.spec.ts` (new): unit tests for `isDateOnly` (bare date vs. full ISO datetime vs. garbage) and `endOfDayInZone` (e.g. `"2026-07-20"` + `"America/New_York"` → the correct UTC instant given EDT's UTC-4 offset; a UTC-zone case as a control; a southern-hemisphere zone to confirm sign handling).
- `src/todos/todos.service.spec.ts`: create with a bare `dueDate` + `timezone` → end-of-day-in-zone instant; create with a bare `dueDate` and no `timezone` → unchanged midnight-UTC behavior; create with a full ISO datetime + `timezone` → `timezone` ignored, literal instant used; update sets `timezone` only (existing `dueDate` untouched); update sets a bare `dueDate` without `timezone` in the same call → reuses the previously-stored zone; update changes both `timezone` and `dueDate` in the same call → new zone is the one applied.
- `test/todos.e2e-spec.ts`: reject an invalid `timezone` string (400); one happy-path test creating a todo with a bare `dueDate` + `timezone` over HTTP and asserting the returned `dueDate` reflects the zone-adjusted instant.
