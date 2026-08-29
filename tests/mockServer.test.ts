import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { performance } from 'node:perf_hooks';
import { join } from 'node:path';
import request from 'supertest';
import { describe, it } from 'vitest';

import { FileMockStore } from '../src/main/fileMockStore';
import { createMockApp, MockServer } from '../src/main/mockServer';
import type { MockStore } from '../src/main/fileMockStore';
import type { Endpoint, MockResponse } from '../src/shared/types';

const endpoints: readonly Endpoint[] = [
  {
    id: 'GET /users/{id}',
    path: '/users/{id}',
    method: 'GET',
    tags: [],
    responseStatus: 200,
  },
  {
    id: 'POST /users/{id}',
    path: '/users/{id}',
    method: 'POST',
    tags: [],
    responseStatus: 201,
  },
];

describe('createMockApp', () => {
  it('serves the latest saved response through parameterized OpenAPI paths', async () => {
    let current: MockResponse = {
      status: 200,
      headers: { 'x-source': 'first' },
      body: { id: 'user-1' },
    };
    const store: MockStore = {
      get: async () => current,
    };
    const app = createMockApp(endpoints, store);

    await request(app)
      .get('/users/user-1')
      .expect('x-source', 'first')
      .expect(200, { id: 'user-1' });

    current = { status: 404, headers: {}, body: { error: 'missing' } };
    await request(app).get('/users/user-1').expect(404, { error: 'missing' });
  });

  it('hot-reloads a response saved to the active file store without restarting', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'reflect-hot-reload-'));
    const store = new FileMockStore(join(directory, 'mocks.json'));
    await store.save({
      version: 1,
      specPath: '/tmp/openapi.yaml',
      mocks: { '/users/{id}': { GET: { status: 200, headers: {}, body: { id: 'first' } } } },
    });
    const app = createMockApp(endpoints, store);

    await request(app).get('/users/user-1').expect(200, { id: 'first' });

    await store.upsert(
      '/users/{id}',
      'GET',
      { status: 201, headers: {}, body: { id: 'updated' } },
      '/tmp/openapi.yaml',
    );

    await request(app).get('/users/user-1').expect(201, { id: 'updated' });
  });

  it('returns a JSON 404 for unknown routes', async () => {
    const store: MockStore = { get: async () => undefined };

    await request(createMockApp(endpoints, store)).get('/unknown').expect(404, {
      error: 'No mock route matches this request.',
    });
  });

  it('records safe metadata for completed requests', async () => {
    const entries: import('../src/shared/types').RequestLogEntry[] = [];
    const store: MockStore = { get: async () => undefined };

    await request(createMockApp(endpoints, store, (entry) => entries.push(entry)))
      .get('/unknown?token=secret')
      .expect(404);

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ method: 'GET', path: '/unknown', status: 404 });
    expect(entries[0]?.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('selects the highest-priority variant matching request values', async () => {
    const store: MockStore = {
      get: async () => ({
        status: 200,
        headers: {},
        body: { state: 'default' },
        variants: [
          {
            id: 'header-match',
            priority: 10,
            match: { headers: { authorization: 'Bearer test' } },
            response: { status: 401, headers: {}, body: { state: 'unauthorized' } },
          },
          {
            id: 'path-match',
            priority: 20,
            match: { pathParams: { id: 'missing' } },
            response: { status: 404, headers: {}, body: { state: 'missing' } },
          },
          {
            id: 'request-match',
            priority: 30,
            match: { query: { mode: 'preview' }, body: { role: 'admin' } },
            response: { status: 202, headers: {}, body: { state: 'preview' } },
          },
        ],
      }),
    };
    const app = createMockApp(endpoints, store);

    await request(app)
      .get('/users/missing')
      .set('authorization', 'Bearer test')
      .expect(404, { state: 'missing' });
    await request(app)
      .get('/users/user-1')
      .set('authorization', 'Bearer test')
      .expect(401, { state: 'unauthorized' });
    await request(app).get('/users/user-1').expect(200, { state: 'default' });
    await request(app)
      .post('/users/user-1?mode=preview')
      .send({ role: 'admin', name: 'Ada' })
      .expect(202, { state: 'preview' });
  });

  it('retains only the most recent bounded request diagnostics', () => {
    const server = new MockServer();
    for (let index = 0; index < 201; index += 1) {
      server.recordRequest({
        method: 'GET',
        path: `/${index}`,
        status: 200,
        durationMs: 1,
        timestamp: new Date(0).toISOString(),
      });
    }

    const entries = server.getRequestLog();
    expect(entries).toHaveLength(200);
    expect(entries[0]?.path).toBe('/1');
  });

  it('responds consistently across repeated mock requests', async () => {
    const store: MockStore = {
      get: async () => ({ status: 200, headers: {}, body: { ok: true } }),
    };
    const app = createMockApp(endpoints, store);
    const startedAt = performance.now();

    await Promise.all(
      Array.from({ length: 25 }, () => request(app).get('/users/user-1').expect(200, { ok: true })),
    );

    expect(performance.now() - startedAt).toBeLessThan(2_000);
  });

  it('starts and stops a localhost listener', async () => {
    const store: MockStore = { get: async () => undefined };
    const server = new MockServer();

    await expect(server.start(createMockApp(endpoints, store), 0)).resolves.toMatchObject({
      state: 'running',
    });
    await expect(server.stop()).resolves.toEqual({ state: 'stopped' });
  });
});
