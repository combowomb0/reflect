import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { FileMockStore, MockStoreError } from '../src/main/fileMockStore';

describe('FileMockStore', () => {
  it('persists and retrieves a route override', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'reflect-store-'));
    const store = new FileMockStore(join(directory, 'mocks.json'));

    await store.upsert(
      '/users/{id}',
      'GET',
      { status: 200, headers: {}, body: { id: 'user-1' } },
      'api.yaml',
    );

    await expect(store.get('/users/{id}', 'GET')).resolves.toEqual({
      status: 200,
      headers: {},
      body: { id: 'user-1' },
    });
  });

  it('returns undefined before a store file has been created', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'reflect-store-'));
    const store = new FileMockStore(join(directory, 'mocks.json'));

    await expect(store.load()).resolves.toBeUndefined();
  });

  it('rejects invalid persisted data', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'reflect-store-'));
    const store = new FileMockStore(join(directory, 'mocks.json'));

    await expect(
      store.save({ version: 1, specPath: '', mocks: { invalid: {} } }),
    ).rejects.toBeInstanceOf(MockStoreError);
  });

  it('backs up a corrupt mock file before recovery', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'reflect-store-'));
    const filePath = join(directory, 'mocks.json');
    const store = new FileMockStore(filePath);
    await writeFile(filePath, '{ invalid json', 'utf8');

    await expect(store.load()).rejects.toBeInstanceOf(MockStoreError);
    const backupPath = await store.backupCorruptFile();
    await store.save({ version: 1, specPath: '/tmp/openapi.yaml', mocks: {} });

    await expect(readFile(backupPath, 'utf8')).resolves.toBe('{ invalid json');
    await expect(store.load()).resolves.toEqual({
      version: 1,
      specPath: '/tmp/openapi.yaml',
      mocks: {},
    });
  });
});
