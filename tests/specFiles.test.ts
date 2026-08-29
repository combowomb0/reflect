import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { collectSpecificationFiles } from '../src/main/specFiles';

describe('specification file selection', () => {
  it('collects supported files recursively from selected files and directories', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'reflect-spec-files-'));
    const nested = join(directory, 'nested');
    await mkdir(nested);
    const rootSpec = join(directory, 'root.yaml');
    const nestedSpec = join(nested, 'billing.json');
    await writeFile(rootSpec, 'openapi: 3.0.3', 'utf8');
    await writeFile(nestedSpec, '{"openapi":"3.0.3"}', 'utf8');
    await writeFile(join(nested, 'notes.txt'), 'ignore', 'utf8');

    await expect(collectSpecificationFiles([rootSpec, directory])).resolves.toEqual([
      nestedSpec,
      rootSpec,
    ]);
  });
});
