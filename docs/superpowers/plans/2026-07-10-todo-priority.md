# Todo Priority Levels Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `priority` (`low` | `medium` | `high`) field to todos, defaulting to `medium`, with filter and sort support on `GET /todos`.

**Architecture:** Follows the exact pattern already established for `dueDate`/`isOverdue` in this codebase: the entity gains a field, the create/update DTOs gain a validated optional property, `FindTodosQueryDto` gains query params, and all filtering/sorting/defaulting logic lives in `TodosService` with the controller staying a thin pass-through.

**Tech Stack:** NestJS, class-validator, class-transformer, Jest, Supertest.

## Global Constraints

- Storage stays in-memory — no persistence/database changes.
- `sortBy` remains a single-field enum (`'dueDate' | 'priority'`) — no multi-field/secondary sort.
- Priority filter (`?priority=high,medium`) uses OR semantics within itself, AND semantics with other filters (`overdue`, `dueBefore`, `dueAfter`), matching existing filter combination behavior.
- Sort direction for priority: `asc` = high→low (most urgent first), `desc` = low→high. Reference spec: `docs/superpowers/specs/2026-07-10-todo-priority-design.md`.

---

### Task 1: Add a validated `priority` field to todos, defaulting to `medium`

**Files:**
- Modify: `src/todos/todo.entity.ts`
- Modify: `src/todos/dto/create-todo.dto.ts`
- Modify: `src/todos/todos.service.ts` (`create` method, lines 14-27)
- Test: `src/todos/todos.service.spec.ts`
- Test: `test/todos.e2e-spec.ts`

**Interfaces:**
- Produces: `Todo.priority: 'low' | 'medium' | 'high'` (always defined). `CreateTodoDto.priority?: 'low' | 'medium' | 'high'` (optional, validated via `@IsIn`). `UpdateTodoDto` inherits this automatically via `PartialType(CreateTodoDto)` — no changes needed to `src/todos/dto/update-todo.dto.ts`. `TodosService.create()` defaults `priority` to `'medium'` when not provided; `TodosService.update()` already handles it via the existing `Object.assign(todo, rest)` — no changes needed there.

- [ ] **Step 1: Write the failing tests**

Add to `src/todos/todos.service.spec.ts`, after the "should create a todo without a dueDate" test (around line 76):

```ts
  it('should default priority to medium when not specified', () => {
    const todo = service.create({ title: 'No priority given' });
    expect(todo.priority).toBe('medium');
  });

  it('should create a todo with an explicit priority', () => {
    const todo = service.create({ title: 'Urgent', priority: 'high' });
    expect(todo.priority).toBe('high');
  });

  it('should update a todo priority', () => {
    const created = service.create({ title: 'Reprioritize me' });
    const updated = service.update(created.id, { priority: 'low' });
    expect(updated.priority).toBe('low');
  });
```

Add to `test/todos.e2e-spec.ts`, after the "rejects an invalid dueDate" test:

```ts
  it('rejects an invalid priority', () => {
    return request(app.getHttpServer())
      .post('/todos')
      .send({ title: 'Bad priority', priority: 'urgent' })
      .expect(400);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- todos.service.spec.ts`
Expected: FAIL — TypeScript error `Property 'priority' does not exist on type 'CreateTodoDto'` and/or `expect(todo.priority).toBe('medium')` receiving `undefined`.

- [ ] **Step 3: Add `priority` to the `Todo` entity**

In `src/todos/todo.entity.ts`:

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

- [ ] **Step 4: Add validation to `CreateTodoDto`**

In `src/todos/dto/create-todo.dto.ts`:

```ts
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateTodoDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsBoolean()
  @IsOptional()
  completed?: boolean;

  @IsDateString()
  @IsOptional()
  dueDate?: string;

  @IsIn(['low', 'medium', 'high'])
  @IsOptional()
  priority?: 'low' | 'medium' | 'high';
}
```

- [ ] **Step 5: Default `priority` in `TodosService.create`**

In `src/todos/todos.service.ts`, update the `create` method (currently lines 14-27):

```ts
  create(createTodoDto: CreateTodoDto): TodoResponse {
    const todo: Todo = {
      id: randomUUID(),
      title: createTodoDto.title,
      description: createTodoDto.description,
      completed: createTodoDto.completed ?? false,
      createdAt: new Date(),
      dueDate: createTodoDto.dueDate
        ? new Date(createTodoDto.dueDate)
        : undefined,
      priority: createTodoDto.priority ?? 'medium',
    };
    this.todos.push(todo);
    return this.toResponse(todo);
  }
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm test -- todos.service.spec.ts` and `npm run test:e2e -- todos.e2e-spec.ts`
Expected: PASS for both.

- [ ] **Step 7: Commit**

```bash
git add src/todos/todo.entity.ts src/todos/dto/create-todo.dto.ts src/todos/todos.service.ts src/todos/todos.service.spec.ts test/todos.e2e-spec.ts
git commit -m "feat: add priority field to todos, defaulting to medium"
```

---

### Task 2: Filter `GET /todos` by priority (single and multiple values)

**Files:**
- Modify: `src/todos/dto/find-todos-query.dto.ts`
- Modify: `src/todos/todos.service.ts` (`findAll` method, lines 29-63)
- Test: `src/todos/todos.service.spec.ts`

**Interfaces:**
- Consumes: `Todo.priority` (Task 1).
- Produces: `FindTodosQueryDto.priority?: string` (comma-separated, e.g. `"high,medium"`). `TodosService.findAll` filters on it before sorting.

- [ ] **Step 1: Write the failing tests**

Add to `src/todos/todos.service.spec.ts`, inside `describe('findAll with query', ...)`, after the "should combine dueAfter and dueBefore into a range" test (around line 196):

```ts
    it('should filter by a single priority value', () => {
      service.create({ title: 'Urgent', priority: 'high' });
      service.create({ title: 'Chill', priority: 'low' });
      const result = service.findAll({ priority: 'high' });
      expect(result.map((t) => t.title)).toEqual(['Urgent']);
    });

    it('should filter by multiple comma-separated priority values', () => {
      service.create({ title: 'Urgent', priority: 'high' });
      service.create({ title: 'Normal', priority: 'medium' });
      service.create({ title: 'Chill', priority: 'low' });
      const result = service.findAll({ priority: 'high,medium' });
      expect(result.map((t) => t.title)).toEqual(['Urgent', 'Normal']);
    });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- todos.service.spec.ts`
Expected: FAIL — `findAll` ignores `priority`, so both tests return all created todos instead of the filtered subset.

- [ ] **Step 3: Add `priority` to `FindTodosQueryDto`**

In `src/todos/dto/find-todos-query.dto.ts`:

```ts
import {
  IsBooleanString,
  IsDateString,
  IsIn,
  IsOptional,
  Matches,
} from 'class-validator';

export class FindTodosQueryDto {
  @IsIn(['dueDate'])
  @IsOptional()
  sortBy?: 'dueDate';

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
  priority?: string;
}
```

(`sortBy` keeps `@IsIn(['dueDate'])` for now — Task 3 extends it to `['dueDate', 'priority']`.)

- [ ] **Step 4: Add the filter in `TodosService.findAll`**

In `src/todos/todos.service.ts`, add this block right after the `dueBefore` filter (currently ending at line 50, before the `sortBy === 'dueDate'` block):

```ts
    if (query.priority) {
      const priorities = new Set(query.priority.split(','));
      result = result.filter((todo) => priorities.has(todo.priority));
    }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- todos.service.spec.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/todos/dto/find-todos-query.dto.ts src/todos/todos.service.ts src/todos/todos.service.spec.ts
git commit -m "feat: filter GET /todos by priority"
```

---

### Task 3: Sort `GET /todos` by priority

**Files:**
- Modify: `src/todos/dto/find-todos-query.dto.ts`
- Modify: `src/todos/todos.service.ts` (`findAll` method)
- Test: `src/todos/todos.service.spec.ts`

**Interfaces:**
- Consumes: `FindTodosQueryDto.priority` filter (Task 2), `Todo.priority` (Task 1).
- Produces: `FindTodosQueryDto.sortBy` extended to `'dueDate' | 'priority'`. `TodosService.findAll` sorts by priority rank when `sortBy === 'priority'`.

- [ ] **Step 1: Write the failing tests**

Add to `src/todos/todos.service.spec.ts`, inside `describe('findAll with query', ...)`, after the priority filter tests added in Task 2:

```ts
    it('should sort by priority ascending (high to low)', () => {
      service.create({ title: 'Low one', priority: 'low' });
      service.create({ title: 'High one', priority: 'high' });
      service.create({ title: 'Medium one', priority: 'medium' });
      const result = service.findAll({ sortBy: 'priority', order: 'asc' });
      expect(result.map((t) => t.title)).toEqual([
        'High one',
        'Medium one',
        'Low one',
      ]);
    });

    it('should sort by priority descending (low to high)', () => {
      service.create({ title: 'Low one', priority: 'low' });
      service.create({ title: 'High one', priority: 'high' });
      service.create({ title: 'Medium one', priority: 'medium' });
      const result = service.findAll({ sortBy: 'priority', order: 'desc' });
      expect(result.map((t) => t.title)).toEqual([
        'Low one',
        'Medium one',
        'High one',
      ]);
    });

    it('should combine a priority filter with a priority sort', () => {
      service.create({ title: 'Low one', priority: 'low' });
      service.create({ title: 'High one', priority: 'high' });
      service.create({ title: 'Medium one', priority: 'medium' });
      const result = service.findAll({
        priority: 'high,medium',
        sortBy: 'priority',
        order: 'asc',
      });
      expect(result.map((t) => t.title)).toEqual(['High one', 'Medium one']);
    });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- todos.service.spec.ts`
Expected: FAIL — no sort branch handles `sortBy: 'priority'`, so results stay in insertion order rather than priority-ranked order.

- [ ] **Step 3: Extend `sortBy` in `FindTodosQueryDto`**

In `src/todos/dto/find-todos-query.dto.ts`, change:

```ts
  @IsIn(['dueDate'])
  @IsOptional()
  sortBy?: 'dueDate';
```

to:

```ts
  @IsIn(['dueDate', 'priority'])
  @IsOptional()
  sortBy?: 'dueDate' | 'priority';
```

- [ ] **Step 4: Add the priority sort branch in `TodosService.findAll`**

In `src/todos/todos.service.ts`, add this block right after the existing `sortBy === 'dueDate'` block (currently ending at line 60, before `return result;`):

```ts
    if (query.sortBy === 'priority') {
      const rank: Record<'low' | 'medium' | 'high', number> = {
        low: 1,
        medium: 2,
        high: 3,
      };
      const direction = query.order === 'asc' ? -1 : 1;
      result = [...result].sort(
        (a, b) => direction * (rank[a.priority] - rank[b.priority]),
      );
    }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- todos.service.spec.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/todos/dto/find-todos-query.dto.ts src/todos/todos.service.ts src/todos/todos.service.spec.ts
git commit -m "feat: sort GET /todos by priority"
```

---

### Task 4: End-to-end smoke test and full verification pass

**Files:**
- Test: `test/todos.e2e-spec.ts`

**Interfaces:**
- Consumes: `GET /todos` with `priority` and `sortBy=priority` query params (Tasks 2 and 3), already wired through the controller via `@Query() query: FindTodosQueryDto` (no controller changes needed — it already passes the whole DTO through).

- [ ] **Step 1: Write the e2e test**

Add to `test/todos.e2e-spec.ts`, after the "filters todos with overdue=true" test:

```ts
  it('filters and sorts todos by priority', async () => {
    await request(app.getHttpServer())
      .post('/todos')
      .send({ title: 'Low one', priority: 'low' })
      .expect(201);
    await request(app.getHttpServer())
      .post('/todos')
      .send({ title: 'High one', priority: 'high' })
      .expect(201);
    await request(app.getHttpServer())
      .post('/todos')
      .send({ title: 'Medium one', priority: 'medium' })
      .expect(201);

    const response = await request(app.getHttpServer())
      .get('/todos')
      .query({ priority: 'high,medium', sortBy: 'priority', order: 'asc' })
      .expect(200);

    expect(response.body.map((t: { title: string }) => t.title)).toEqual([
      'High one',
      'Medium one',
    ]);
  });
```

- [ ] **Step 2: Run the e2e test**

Run: `npm run test:e2e -- todos.e2e-spec.ts`
Expected: PASS — Tasks 2 and 3 already implemented the underlying behavior; this is a smoke test confirming it works end-to-end through HTTP.

- [ ] **Step 3: Run the full test suite**

Run: `npm test && npm run test:e2e`
Expected: PASS — all unit and e2e tests, including every test added in Tasks 1-4.

- [ ] **Step 4: Commit**

```bash
git add test/todos.e2e-spec.ts
git commit -m "test: add e2e smoke test for priority filter and sort"
```

---

## Post-plan verification

After Task 4, confirm against the spec (`docs/superpowers/specs/2026-07-10-todo-priority-design.md`):
- [ ] `priority` defaults to `medium` on create.
- [ ] `priority` is settable on create and update, validated to `low`/`medium`/`high`.
- [ ] `GET /todos?priority=high` and `?priority=high,medium` both filter correctly.
- [ ] `GET /todos?sortBy=priority&order=asc` sorts high→low; `order=desc` sorts low→high.
- [ ] Priority filter/sort combine correctly with existing `dueDate`/`overdue` filters.
