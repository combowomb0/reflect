import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { app, dialog, ipcMain } from 'electron';

import { FileMockStore, MockStoreError, type MockStore } from './fileMockStore';
import { createMockApp, MockServer } from './mockServer';
import { OpenApiParseError, parseOpenAPIFile } from './parser';
import { collectSpecificationFiles } from './specFiles';
import { FileSettingsStore, validateAppLocale, validateMockSeed, validatePort } from './settings';
import { generateMock, generateMockWithOptions } from '../shared/mockGenerator';
import { validateSaveMockInput } from '../shared/ipcValidation';
import { DomainError, toAppError } from '../shared/errors';
import type {
  Endpoint,
  LoadedSpec,
  LoadedWorkspace,
  MockMap,
  Result,
  ServerStatus,
} from '../shared/types';

const activeSpecs = new Map<string, { readonly spec: LoadedSpec; readonly store: FileMockStore }>();
const mockServer = new MockServer();
const settingsStore = new FileSettingsStore(join(app.getPath('userData'), 'settings.json'));

/** Registers the typed, allow-listed renderer IPC surface. */
export function registerIpcHandlers(): void {
  ipcMain.handle('spec:open', async (): Promise<Result<LoadedWorkspace | undefined>> => {
    try {
      if (mockServer.getStatus().state === 'running') {
        throw new DomainError(
          'REQUEST_FAILED',
          'Stop the local server before loading another specification.',
        );
      }
      const selection = await dialog.showOpenDialog({
        // Explicitly include both modes because Electron does not guarantee a default
        // file-selection mode when `properties` is supplied.
        properties: ['openFile', 'openDirectory', 'multiSelections'],
        filters: [{ name: 'OpenAPI', extensions: ['yaml', 'yml', 'json'] }],
      });
      if (selection.canceled || selection.filePaths.length === 0) {
        return { ok: true, value: undefined };
      }

      const paths = await collectSpecificationFiles(selection.filePaths);
      if (paths.length === 0) {
        throw new DomainError('SPEC_INVALID', 'No YAML or JSON specification files were found.');
      }
      const specs = (
        await Promise.all(
          paths.map(async (path) => {
            try {
              return { path, endpoints: await parseOpenAPIFile(path) };
            } catch (error: unknown) {
              if (
                error instanceof OpenApiParseError &&
                (error.isReusableFragment ||
                  error.message === 'Reflect supports OpenAPI 3.x specifications only.')
              ) {
                return undefined;
              }
              throw error;
            }
          }),
        )
      ).filter((spec): spec is LoadedSpec => spec !== undefined && spec.endpoints.length > 0);
      if (specs.length === 0) {
        throw new DomainError('SPEC_INVALID', 'No OpenAPI 3.x specifications were found.');
      }
      validateWorkspaceConflicts(specs);

      const settings = await settingsStore.load();
      const contexts = await Promise.all(
        specs.map(async (spec) => ({
          spec,
          store: await initializeMockStore(spec, settings.mockSeed, settings.locale),
        })),
      );
      for (const context of contexts) {
        activeSpecs.set(context.spec.path, context);
      }
      const lastContext = contexts.at(-1)!;
      await settingsStore.save({ ...settings, lastSpecPath: lastContext.spec.path });
      return {
        ok: true,
        value: { specs: [...activeSpecs.values()].map((context) => context.spec) },
      };
    } catch (error: unknown) {
      return failure(error);
    }
  });

  ipcMain.handle('server:start', async (_event, port: unknown): Promise<Result<ServerStatus>> => {
    try {
      if (activeSpecs.size === 0) {
        throw new Error('Open an API specification before starting the server.');
      }
      const validPort = validatePort(port);
      const status = await mockServer.start(
        createMockApp(getActiveEndpoints(), getWorkspaceStore(), (entry) =>
          mockServer.recordRequest(entry),
        ),
        validPort,
      );
      if (status.state === 'error') {
        return {
          ok: false,
          error: {
            code: 'SERVER_START_FAILED',
            message: status.message ?? 'Unable to start server.',
          },
        };
      }
      const settings = await settingsStore.load();
      await settingsStore.save({ ...settings, port: validPort });
      return { ok: true, value: status };
    } catch (error: unknown) {
      return failure(error);
    }
  });

  ipcMain.handle('server:stop', async (): Promise<Result<ServerStatus>> => {
    try {
      return { ok: true, value: await mockServer.stop() };
    } catch (error: unknown) {
      return failure(error);
    }
  });
  ipcMain.handle('server:status', (): Result<ServerStatus> => ({
    ok: true,
    value: mockServer.getStatus(),
  }));
  ipcMain.handle(
    'server:request-log',
    (): Result<readonly import('../shared/types').RequestLogEntry[]> => ({
      ok: true,
      value: mockServer.getRequestLog(),
    }),
  );
  ipcMain.handle('settings:get', async (): Promise<Result<import('../shared/types').Settings>> => {
    try {
      return { ok: true, value: await settingsStore.load() };
    } catch (error: unknown) {
      return failure(error);
    }
  });
  ipcMain.handle('settings:save', async (_event, value: unknown) => {
    try {
      if (!isRecord(value)) throw new Error('Settings must be an object.');
      const settings = await settingsStore.load();
      const updated = {
        ...settings,
        port: validatePort(value.port),
        ...(value.mockSeed === undefined
          ? { mockSeed: undefined }
          : { mockSeed: validateMockSeed(value.mockSeed) }),
        locale: validateAppLocale(value.locale),
      };
      await settingsStore.save(updated);
      return { ok: true, value: await settingsStore.load() };
    } catch (error: unknown) {
      return failure(error);
    }
  });
  ipcMain.handle('mocks:list', async (): Promise<Result<readonly MockMap[]>> => {
    try {
      return {
        ok: true,
        value: (
          await Promise.all([...activeSpecs.values()].map((context) => context.store.load()))
        ).filter((mockMap): mockMap is MockMap => mockMap !== undefined),
      };
    } catch (error: unknown) {
      return failure(error);
    }
  });
  ipcMain.handle('mocks:save', async (_event, input: unknown): Promise<Result<MockMap>> => {
    try {
      if (activeSpecs.size === 0) {
        throw new Error('Open an API specification before saving mocks.');
      }
      const validInput = validateSaveMockInput(input);
      const context = [...activeSpecs.values()].find((candidate) =>
        candidate.spec.endpoints.some(
          (endpoint) => endpoint.path === validInput.path && endpoint.method === validInput.method,
        ),
      );
      if (!context) {
        throw new Error('Mock response does not match the active specification.');
      }
      return {
        ok: true,
        value: await context.store.upsert(
          validInput.path,
          validInput.method,
          validInput.response,
          context.spec.path,
        ),
      };
    } catch (error: unknown) {
      return failure(error);
    }
  });
  ipcMain.handle('mocks:regenerate', async (): Promise<Result<readonly MockMap[]>> => {
    try {
      if (activeSpecs.size === 0) {
        throw new DomainError(
          'REQUEST_FAILED',
          'Open an API specification before regenerating mocks.',
        );
      }

      const settings = await settingsStore.load();
      const mockMaps = [...activeSpecs.values()].map(({ spec }) =>
        createInitialMockMap(spec.path, spec.endpoints, settings.mockSeed, settings.locale),
      );
      await Promise.all(
        [...activeSpecs.values()].map((context, index) => context.store.save(mockMaps[index]!)),
      );
      return { ok: true, value: mockMaps };
    } catch (error: unknown) {
      return failure(error);
    }
  });
}

function createInitialMockMap(
  specPath: string,
  endpoints: readonly Endpoint[],
  mockSeed?: number,
  locale?: import('../shared/types').AppLocale,
): MockMap {
  const mocks: Record<string, Partial<MockMap['mocks'][string]>> = {};
  for (const endpoint of endpoints) {
    const methods = mocks[endpoint.path] ?? (mocks[endpoint.path] = {});
    methods[endpoint.method] = {
      status: endpoint.responseStatus,
      headers: {},
      body:
        mockSeed === undefined && locale === undefined
          ? generateMock(endpoint.responseSchema)
          : generateMockWithOptions(endpoint.responseSchema, {
              ...(mockSeed === undefined
                ? {}
                : { seed: deriveEndpointSeed(mockSeed, endpoint.id) }),
              locale,
            }),
    };
  }

  return {
    version: 1 as const,
    specPath,
    mocks,
  };
}

async function initializeMockStore(
  spec: LoadedSpec,
  mockSeed?: number,
  locale?: import('../shared/types').AppLocale,
): Promise<FileMockStore> {
  const store = new FileMockStore(
    join(app.getPath('userData'), `${hashPath(spec.path)}.mocks.json`),
  );
  let mockMap: MockMap | undefined;
  try {
    mockMap = await store.load();
  } catch (error: unknown) {
    if (!(error instanceof MockStoreError)) throw error;
    await store.backupCorruptFile();
  }
  if (!mockMap) {
    await store.save(createInitialMockMap(spec.path, spec.endpoints, mockSeed, locale));
  }
  return store;
}

function deriveEndpointSeed(seed: number, endpointId: string): number {
  let derived = seed;
  for (const character of endpointId) {
    derived = (derived * 31 + character.charCodeAt(0)) >>> 0;
  }
  return derived;
}

function validateWorkspaceConflicts(specs: readonly LoadedSpec[]): void {
  const selectedPaths = new Set(specs.map((spec) => spec.path));
  const routes = new Set(
    [...activeSpecs.values()]
      .filter((context) => !selectedPaths.has(context.spec.path))
      .flatMap((context) => context.spec.endpoints)
      .map((endpoint) => `${endpoint.method} ${endpoint.path}`),
  );

  for (const spec of specs) {
    for (const endpoint of spec.endpoints) {
      const route = `${endpoint.method} ${endpoint.path}`;
      if (routes.has(route)) {
        throw new DomainError(
          'SPEC_INVALID',
          `The specification conflicts with an existing route: ${route}.`,
        );
      }
      routes.add(route);
    }
  }
}

function hashPath(path: string): string {
  return createHash('sha256').update(path).digest('hex').slice(0, 16);
}

function getActiveEndpoints(): readonly Endpoint[] {
  return [...activeSpecs.values()].flatMap((context) => context.spec.endpoints);
}

function getWorkspaceStore(): MockStore {
  return {
    async get(path, method) {
      const context = [...activeSpecs.values()].find((candidate) =>
        candidate.spec.endpoints.some(
          (endpoint) => endpoint.path === path && endpoint.method === method,
        ),
      );
      return context?.store.get(path, method);
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function failure(error: unknown): Result<never> {
  if (error instanceof DomainError) {
    return { ok: false, error: toAppError(error) };
  }
  if (error instanceof Error && error.message) {
    return {
      ok: false,
      error: {
        code: 'REQUEST_FAILED',
        message: `The requested action could not be completed: ${error.message.replace(/\s+/g, ' ').slice(0, 500)}`,
      },
    };
  }
  return { ok: false, error: toAppError(error) };
}
