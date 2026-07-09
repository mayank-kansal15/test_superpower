# Design: Due Dates for Todos

## Context

The todo API (`src/todos/`) currently supports plain CRUD with no due-date
concept — `Todo` only has `id`, `title`, `description`, `completed`, and
`createdAt`. This adds a due date to each todo, along with the ability to
sort and filter the todo list by due date, and a computed "overdue" flag.

## Goals

- Add an optional `dueDate` to todos (create, update, read).
- Compute an `isOverdue` flag on read (not stored) so it's always accurate.
- Let `GET /todos` sort by due date and filter by overdue status or a date
  range.

## Non-goals

- Priority levels, tags/categories (explicitly deferred per user).
- Persistence/database changes — storage stays in-memory as-is.
- Reminders/notifications for approaching or passed due dates.
- Restricting `dueDate` to future-only values — backdating is allowed (e.g.
  importing existing tasks), so no "must be in the future" validation.

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
}
```

`isOverdue` is **not** stored on the entity. It's computed when a todo is
returned from the service:

```
isOverdue = dueDate !== undefined && dueDate < now && !completed
```

Response shape for a todo becomes `Todo & { isOverdue: boolean }`. Todos
without a `dueDate` always have `isOverdue: false`.

## DTOs

`CreateTodoDto` and `UpdateTodoDto` (via `PartialType`) gain:

```ts
@IsDateString()
@IsOptional()
dueDate?: string;
```

`class-transformer`'s `transform: true` (already enabled globally in
`main.ts`) converts the validated ISO string to a `Date` before it reaches
the service — consistent with how `completed`/`description` are handled
today.

A new `FindTodosQueryDto` validates `GET /todos` query params:

```ts
export class FindTodosQueryDto {
  @IsIn(['dueDate'])
  @IsOptional()
  sortBy?: 'dueDate';

  @IsIn(['asc', 'desc'])
  @IsOptional()
  order?: 'asc' | 'desc'; // default 'asc' when sortBy is set

  @IsBooleanString()
  @IsOptional()
  overdue?: string; // 'true' | 'false'

  @IsDateString()
  @IsOptional()
  dueBefore?: string;

  @IsDateString()
  @IsOptional()
  dueAfter?: string;
}
```

## API behavior

`GET /todos` accepts the query params above, all combinable:

- No params: current behavior (insertion order), unchanged.
- `sortBy=dueDate&order=asc|desc`: sorts by `dueDate`. Todos without a
  `dueDate` sort to the end regardless of order.
- `overdue=true`: only todos where the computed `isOverdue` is `true`.
- `dueBefore` / `dueAfter` (ISO date strings): only todos whose `dueDate`
  falls in the given range. A todo with no `dueDate` is excluded by either
  filter.

Filters and `overdue` combine with AND semantics. Sorting is applied last,
after filtering.

## Where the logic lives

Filtering, sorting, and `isOverdue` computation all live in
`TodosService.findAll(query?: FindTodosQueryDto)`, matching the existing
pattern where the controller stays a thin pass-through to the service. The
controller adds `@Query() query: FindTodosQueryDto` to `findAll`.

`create` and `update` pass `dueDate` through like any other field —
`Object.assign` in `update` already handles this with no changes needed
beyond the DTO.

## Testing

- `todos.service.spec.ts`: cases for creating/updating with a `dueDate`,
  `isOverdue` true/false/no-date, sort asc/desc with mixed
  dated/undated todos, `overdue` filter, `dueBefore`/`dueAfter` filter,
  and combinations of the above.
- `test/app.e2e-spec.ts` (or a new `todos.e2e-spec.ts` if one doesn't
  exist): a smoke test hitting `GET /todos?sortBy=dueDate&order=desc` and
  `GET /todos?overdue=true` end-to-end.

## Open questions

None — scope confirmed with user.
