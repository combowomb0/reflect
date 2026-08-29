import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import { validateMockResponse } from '../shared/ipcValidation';
import type { HttpMethod, MockMap, MockResponse } from '../shared/types';
import { DomainError } from '../shared/errors';

/** Raised when a persisted mock map cannot be safely loaded or saved. */
export class MockStoreError extends DomainError {
  constructor(message: string) {
    super('MOCK_STORE_FAILED', message);
    this.name = 'MockStoreError';
  }
}

/** Minimal store interface consumed by the HTTP server. */
export interface MockStore {
  get(path: string, method: HttpMethod): Promise<MockResponse | undefined>;
}

/** JSON-backed mock store with atomic writes and strict validation at its file boundary. */
export class FileMockStore implements MockStore {
  constructor(private readonly filePath: string) {}

  async load(): Promise<MockMap | undefined> {
    try {
      return await readMockMapFile(this.filePath);
    } catch (error: unknown) {
      if (isMissingFileError(error)) {
        return undefined;
      }
      throw new MockStoreError('Unable to load the persisted mock responses.');
    }
  }

  async save(mockMap: MockMap): Promise<void> {
    try {
      await writeMockMapFile(this.filePath, mockMap);
    } catch {
      throw new MockStoreError('Unable to save the mock responses.');
    }
  }

  async get(path: string, method: HttpMethod): Promise<MockResponse | undefined> {
    return (await this.load())?.mocks[path]?.[method];
  }

  async upsert(
    path: string,
    method: HttpMethod,
    response: MockResponse,
    specPath: string,
  ): Promise<MockMap> {
    const current = (await this.load()) ?? { version: 1, specPath, mocks: {} };
    const updated: MockMap = {
      ...current,
      specPath,
      mocks: {
        ...current.mocks,
        [path]: { ...current.mocks[path], [method]: response },
      },
    };

    await this.save(updated);
    return updated;
  }

  /** Moves a corrupt store aside so a valid replacement can be initialized safely. */
  async backupCorruptFile(): Promise<string> {
    const backupPath = `${this.filePath}.corrupt-${Date.now()}.json`;
    try {
      await rename(this.filePath, backupPath);
      return backupPath;
    } catch {
      throw new MockStoreError('Unable to back up the corrupt mock response file.');
    }
  }
}

/** Reads and validates a MockMap selected through a main-process file dialog. */
export async function readMockMapFile(filePath: string): Promise<MockMap> {
  try {
    return parseMockMap(JSON.parse(await readFile(filePath, 'utf8')) as unknown);
  } catch (error: unknown) {
    if (isMissingFileError(error)) throw error;
    if (error instanceof MockStoreError) throw error;
    throw new MockStoreError('Unable to load the persisted mock responses.');
  }
}

/** Atomically writes a validated MockMap to a main-process selected file path. */
export async function writeMockMapFile(filePath: string, mockMap: MockMap): Promise<void> {
  const validated = parseMockMap(mockMap);
  const temporaryPath = `${filePath}.tmp`;

  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(temporaryPath, `${JSON.stringify(validated, null, 2)}\n`, 'utf8');
  await rename(temporaryPath, filePath);
}

/** Validates the versioned MockMap JSON document format. */
export function parseMockMap(value: unknown): MockMap {
  if (
    !isRecord(value) ||
    value.version !== 1 ||
    typeof value.specPath !== 'string' ||
    !isRecord(value.mocks)
  ) {
    throw new MockStoreError('The mock file has an unsupported format.');
  }

  const mocks: Record<string, Partial<Record<HttpMethod, MockResponse>>> = {};
  for (const [path, methods] of Object.entries(value.mocks)) {
    if (!path.startsWith('/') || !isRecord(methods)) {
      throw new MockStoreError('The mock file contains an invalid route.');
    }

    mocks[path] = {};
    for (const [method, response] of Object.entries(methods)) {
      if (!isHttpMethod(method) || !isMockResponse(response)) {
        throw new MockStoreError('The mock file contains an invalid response.');
      }
      mocks[path][method] = response;
    }
  }

  return { version: 1, specPath: value.specPath, mocks };
}

function isMockResponse(value: unknown): value is MockResponse {
  try {
    validateMockResponse(value);
    return true;
  } catch {
    return false;
  }
}

function isHttpMethod(value: string): value is HttpMethod {
  return ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'].includes(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isMissingFileError(error: unknown): error is NodeJS.ErrnoException {
  return isRecord(error) && error.code === 'ENOENT';
}
