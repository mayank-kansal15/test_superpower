import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('TodosController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('creates a todo with a dueDate and reports isOverdue', async () => {
    const response = await request(app.getHttpServer())
      .post('/todos')
      .send({ title: 'Overdue task', dueDate: '2000-01-01T00:00:00.000Z' })
      .expect(201);

    expect(response.body.dueDate).toBe('2000-01-01T00:00:00.000Z');
    expect(response.body.isOverdue).toBe(true);
  });

  it('sorts todos by dueDate descending', async () => {
    await request(app.getHttpServer())
      .post('/todos')
      .send({ title: 'Early', dueDate: '2026-01-01T00:00:00.000Z' })
      .expect(201);
    await request(app.getHttpServer())
      .post('/todos')
      .send({ title: 'Late', dueDate: '2026-06-01T00:00:00.000Z' })
      .expect(201);

    const response = await request(app.getHttpServer())
      .get('/todos')
      .query({ sortBy: 'dueDate', order: 'desc' })
      .expect(200);

    expect(response.body.map((t: { title: string }) => t.title)).toEqual([
      'Late',
      'Early',
    ]);
  });

  it('filters todos with overdue=true', async () => {
    await request(app.getHttpServer())
      .post('/todos')
      .send({ title: 'Overdue', dueDate: '2000-01-01T00:00:00.000Z' })
      .expect(201);
    await request(app.getHttpServer())
      .post('/todos')
      .send({ title: 'Future', dueDate: '2999-01-01T00:00:00.000Z' })
      .expect(201);

    const response = await request(app.getHttpServer())
      .get('/todos')
      .query({ overdue: 'true' })
      .expect(200);

    expect(response.body.map((t: { title: string }) => t.title)).toEqual([
      'Overdue',
    ]);
  });

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

  it('rejects an invalid dueDate', () => {
    return request(app.getHttpServer())
      .post('/todos')
      .send({ title: 'Bad date', dueDate: 'not-a-date' })
      .expect(400);
  });

  it('rejects an invalid priority', () => {
    return request(app.getHttpServer())
      .post('/todos')
      .send({ title: 'Bad priority', priority: 'urgent' })
      .expect(400);
  });

  it('blocks completing a todo until its dependency is completed', async () => {
    const depResponse = await request(app.getHttpServer())
      .post('/todos')
      .send({ title: 'Dependency' })
      .expect(201);
    const depId = depResponse.body.id;

    const todoResponse = await request(app.getHttpServer())
      .post('/todos')
      .send({ title: 'Depends on it', dependsOn: [depId] })
      .expect(201);
    const todoId = todoResponse.body.id;

    await request(app.getHttpServer())
      .patch(`/todos/${todoId}`)
      .send({ completed: true })
      .expect(409);

    await request(app.getHttpServer())
      .patch(`/todos/${depId}`)
      .send({ completed: true })
      .expect(200);

    const completed = await request(app.getHttpServer())
      .patch(`/todos/${todoId}`)
      .send({ completed: true })
      .expect(200);

    expect(completed.body.completed).toBe(true);
  });
});
