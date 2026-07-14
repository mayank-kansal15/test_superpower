# Design: Todo Dependencies

## Context

The todo API (`src/todos/`) already supports `dueDate` and `priority` fields
with filter/sort on `GET /todos`. This adds a `dependsOn` relationship so a
todo can depend on one or more other todos, and can only be marked completed
once all of its dependencies are completed.

## Goals

- Add a `dependsOn` field (array of todo IDs) to todos (create, update,
  read), defaulting to an empty array when not specified.
- Reject dependency links that reference a nonexistent todo, reference the
  todo itself, or would introduce a cycle in the dependency graph.
- Block marking a todo `completed` while any of its dependencies are not
  themselves completed.
- Block deleting a todo that other todos currently depend on.

## Non-goals

- Persistence/database changes — storage stays in-memory as-is.
- New `GET /todos` query params (e.g. filtering by blocked/ready state).
- A computed response field like `isBlocked` — clients resolve completion
  state from the referenced todos' own `completed` flags.
- Cascading deletes (removing a todo automatically strips it from other
  todos' `dependsOn`).

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
  dependsOn: string[];
}
```

Like `priority`, `dependsOn` is not optional on the entity — it always has a
value, defaulting to `[]` when not supplied on create.

## DTOs

`CreateTodoDto` gains:

```ts
@IsArray()
@IsUUID('4', { each: true })
@IsOptional()
dependsOn?: string[];
```

`UpdateTodoDto` inherits this via `PartialType`. A PATCH that includes
`dependsOn` replaces the whole array, matching how every other field behaves
today (no partial add/remove semantics).

No changes to `FindTodosQueryDto` — no new filter/sort support.

## Validation rules

Enforced in `TodosService`:

- **Unknown dependency ID**: any ID in `dependsOn` that doesn't match an
  existing todo → `404 NotFoundException`.
- **Self-reference**: a todo's own ID appearing in its `dependsOn` →
  `400 BadRequestException`. Only possible on `update` (a new todo's ID
  isn't known to the client until after creation).
- **Cycle**: if resolving this update's `dependsOn` would let the
  dependency graph loop back to the todo being updated → `400
  BadRequestException`. Detected via DFS over `dependsOn` edges across all
  todos, using the *new* `dependsOn` value for the todo being updated. Only
  relevant on `update` — a brand-new todo can't yet be depended on by
  anything, so `create` only needs the existence check.
- **Duplicate IDs** within one `dependsOn` array are silently deduped
  (stored as a de-duplicated list).

## Completion gating

In `update()`: when the effective `completed` value for this todo (after
applying the PATCH) is `true`, and the effective `dependsOn` list (after
applying any `dependsOn` change in the same PATCH) contains any ID whose
todo is not `completed`, the whole update is rejected with `409
ConflictException`. The error message lists the still-incomplete dependency
IDs. Un-completing a todo, or updating unrelated fields, is unaffected.

## Deletion gating

In `remove()`: before removing a todo, scan every other todo's `dependsOn`.
If any todo still references this ID, deletion is rejected with `409
ConflictException` listing the dependent todo IDs. No cascade — the caller
must remove the dependency link(s) first (via PATCH) before the delete will
succeed.

## Where the logic lives

All new logic lives in `TodosService`, matching the existing pattern:

- `create`: default `dependsOn` to `[]`; validate referenced IDs exist.
- `update`: when `dependsOn` is present in the DTO, validate existence,
  self-reference, and cycles before assigning; when the effective
  `completed` is `true`, validate all dependencies are completed.
- `remove`: validate no other todo depends on this ID before splicing.

The controller stays a thin pass-through; no changes beyond what
`@Body() createTodoDto: CreateTodoDto` / `UpdateTodoDto` already provide.

## Testing

`todos.service.spec.ts`:
- Create with no `dependsOn` defaults to `[]`.
- Create with a valid `dependsOn` list.
- Create with an unknown dependency ID → 404.
- Update adding a valid dependency.
- Update with a self-reference → 400.
- Update creating a 2-node cycle (A→B, then B→A) → 400.
- Update creating a longer cycle (A→B→C, then C→A) → 400.
- Completing a todo with incomplete dependencies → 409.
- Completing a todo whose dependencies are all completed → succeeds.
- Deleting a todo that another todo depends on → 409.
- Deleting a todo with no dependents → succeeds.

`test/todos.e2e-spec.ts`: a smoke test chaining create → create a dependent
todo → attempt to complete it (409) → complete the dependency → complete
the dependent todo (success).

## Open questions

None — scope confirmed with user.
