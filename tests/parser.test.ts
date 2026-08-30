import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { performance } from 'node:perf_hooks';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { OpenApiParseError, parseOpenAPIFile } from '../src/main/parser';

const petsFixture = join(dirname(fileURLToPath(import.meta.url)), 'fixtures/pets.yaml');

describe('parseOpenAPIFile', () => {
  it('validates and normalizes OpenAPI operations', async () => {
    await expect(parseOpenAPIFile(petsFixture)).resolves.toEqual([
      expect.objectContaining({
        id: 'GET /pets',
        method: 'GET',
        path: '/pets',
        summary: 'List pets',
        operationId: 'listPets',
        tags: ['pets'],
        responseStatus: 200,
      }),
      expect.objectContaining({ id: 'POST /pets', method: 'POST', responseStatus: 201 }),
      expect.objectContaining({ id: 'GET /pets/{petId}', method: 'GET', responseStatus: 200 }),
    ]);
  });

  it('rejects unsupported file extensions before parsing', async () => {
    await expect(parseOpenAPIFile('/tmp/openapi.txt')).rejects.toEqual(
      new OpenApiParseError('Select an OpenAPI YAML or JSON file.'),
    );
  });

  it('rejects missing files and non-OpenAPI 3 specifications', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'reflect-parser-'));
    const unsupportedSpec = join(directory, 'unsupported.json');
    await writeFile(
      unsupportedSpec,
      JSON.stringify({ swagger: '2.0', info: {}, paths: {} }),
      'utf8',
    );

    await expect(parseOpenAPIFile(join(directory, 'missing.yaml'))).rejects.toBeInstanceOf(
      OpenApiParseError,
    );
    await expect(parseOpenAPIFile(unsupportedSpec)).rejects.toEqual(
      new OpenApiParseError('Reflect supports OpenAPI 3.x specifications only.'),
    );
  });

  it('returns no endpoints for a reusable OpenAPI document without routes', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'reflect-parser-'));
    const componentsFile = join(directory, 'components.openapi.yaml');
    await writeFile(
      componentsFile,
      [
        'openapi: 3.0.3',
        'info:',
        '  title: Shared components',
        '  version: 1.0.0',
        'paths:',
        'components:',
        '  schemas:',
        '    Pet:',
        '      type: object',
      ].join('\n'),
      'utf8',
    );

    await expect(parseOpenAPIFile(componentsFile)).resolves.toEqual([]);
  });

  it('marks a shared schema fragment so directory imports can ignore it', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'reflect-parser-'));
    const fragmentFile = join(directory, 'shared.yaml');
    await writeFile(fragmentFile, 'Pet:\n  type: object\n', 'utf8');

    await expect(parseOpenAPIFile(fragmentFile)).rejects.toMatchObject({
      isReusableFragment: true,
      message: 'The file is a reusable OpenAPI fragment.',
    });
  });

  it('normalizes a large specification within a practical local load budget', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'reflect-parser-'));
    const filePath = join(directory, 'large.json');
    const paths = Object.fromEntries(
      Array.from({ length: 500 }, (_, index) => [
        `/resources/${index}`,
        { get: { responses: { '200': { description: 'OK' } } } },
      ]),
    );
    await writeFile(
      filePath,
      JSON.stringify({ openapi: '3.0.3', info: { title: 'Large', version: '1' }, paths }),
      'utf8',
    );

    const startedAt = performance.now();
    const endpoints = await parseOpenAPIFile(filePath);

    expect(endpoints).toHaveLength(500);
    expect(performance.now() - startedAt).toBeLessThan(2_000);
  });
});
