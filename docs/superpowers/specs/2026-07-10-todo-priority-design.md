# Design: Priority Levels for Todos

## Context

The todo API (`src/todos/`) already supports sorting and filtering by due
date (see `2026-07-10-todo-due-dates-design.md`), which explicitly deferred
priority levels. This adds a `priority` concept so users can distinguish
urgent tasks from less critical ones, with filter and sort support on
`GET /todos`.

## Goals

- Add a `priority` field (`low` | `medium` | `high`) to todos (create,
  update, read), defaulting to `medium` when not specified.
- Let `GET /todos` filter by one or more priority values.
- Let `GET /todos` sort by priority.

## Non-goals

- Persistence/database changes — storage stays in-memory as-is.
- Multi-field sort (e.g. priority then dueDate) — `sortBy` remains a single
  field, matching the existing pattern.
- Custom/user-defined priority levels beyond low/medium/high.

## Data model

`Todo` (`src/todos/todo.entity.ts`) gains one field:

```ts
export class Todo {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  createdAt: Date;
  dueDate?: Date;
  priority: 'low' | 'medium' | 'high';
}
```

Unlike `dueDate`, `priority` is not optional on the entity — it always has a
value, defaulting to `'medium'` when not supplied on create (mirroring how
`completed` defaults to `false` rather than being left undefined).

## DTOs

`CreateTodoDto` gains:

```ts
@IsIn(['low', 'medium', 'high'])
@IsOptional()
priority?: 'low' | 'medium' | 'high';
```

`UpdateTodoDto` inherits this via `PartialType`, so priority can be changed
on an existing todo the same way `completed`/`dueDate` are today.

`FindTodosQueryDto` gains:

```ts
export class FindTodosQueryDto {
  @IsIn(['dueDate', 'priority'])
  @IsOptional()
  sortBy?: 'dueDate' | 'priority';

  @IsIn(['asc', 'desc'])
  @IsOptional()
  order?: 'asc' | 'desc';

  @IsBooleanString()
  @IsOptional()
  overdue?: string;

  @IsDateString()
  @IsOptional()
  dueBefore?: string;

  @IsDateString()
  @IsOptional()
  dueAfter?: string;

  @Matches(/^(low|medium|high)(,(low|medium|high))*$/)
  @IsOptional()
  priority?: string; // comma-separated, e.g. "high,medium"
}
```

`sortBy` is extended in place rather than duplicated, since only one sort
field is supported at a time.

## API behavior

`GET /todos?priority=high,medium` returns todos whose priority matches any
value in the list (OR semantics within the filter). This combines with
`overdue`/`dueBefore`/`dueAfter` using AND semantics, same as the existing
filters.

`GET /todos?sortBy=priority&order=asc|desc`: sorts by priority rank
(`high: 3, medium: 2, low: 1`). `asc` = high→low (most urgent first),
`desc` = low→high. This is the inverse of the numeric-direction mapping
used for `dueDate` (where `asc` means smallest/earliest first) because
priority is categorical rank rather than a naturally ascending scalar —
"ascending priority" reads most naturally as "most urgent first" to users.
There are no ties to break specially since rank is a fixed 3-value scale;
equal-priority todos keep their relative (stable-sort) order.

Filtering and sorting by priority combine freely with the existing
dueDate/overdue query params (all still applied filter-then-sort, same as
today).

## Where the logic lives

Filtering, sorting, and defaulting all live in `TodosService`, matching the
existing pattern:

- `create`: default `priority` to `'medium'` when not provided.
- `update`: `Object.assign` already handles `priority` like any other field
  — no changes needed beyond the DTO.
- `findAll`: add a priority filter step (parse the comma-separated list,
  keep todos whose priority is in the set) and a `sortBy === 'priority'`
  branch alongside the existing `sortBy === 'dueDate'` branch.

The controller stays a thin pass-through; no changes beyond what
`@Query() query: FindTodosQueryDto` already provides.

## Testing

`todos.service.spec.ts`:
- Create with no priority defaults to `medium`.
- Create/update with an explicit priority.
- Filter by a single priority value.
- Filter by multiple comma-separated priority values.
- Sort by priority ascending (high→low) and descending (low→high).
- Combine priority filter/sort with existing dueDate/overdue filters.

`test/todos.e2e-spec.ts`: a smoke test hitting
`GET /todos?priority=high,medium&sortBy=priority&order=asc`.

## Open questions

None — scope confirmed with user.
