import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import type { AppLocale, Settings } from '../shared/types';
import { DomainError } from '../shared/errors';

const DEFAULT_PORT = 31247;

/** Raised when settings cannot be validated or persisted. */
export class SettingsError extends DomainError {
  constructor(message: string) {
    super('SETTINGS_INVALID', message);
    this.name = 'SettingsError';
  }
}

/** Validates a TCP port accepted by the local mock server. */
export function validatePort(port: unknown): number {
  if (typeof port !== 'number' || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new SettingsError('Port must be an integer between 1 and 65535.');
  }

  return port;
}

/** Validates an optional unsigned 32-bit seed accepted by Faker. */
export function validateMockSeed(seed: unknown): number | undefined {
  if (seed === undefined) return undefined;
  if (typeof seed !== 'number' || !Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) {
    throw new SettingsError('Mock seed must be an integer between 0 and 4294967295.');
  }
  return seed;
}

/** Validates an application locale supported by the renderer and mock generator. */
export function validateAppLocale(locale: unknown): AppLocale {
  if (locale === 'en' || locale === 'ru') return locale;
  throw new SettingsError('Application locale must be English or Russian.');
}

/** File-backed settings with safe defaults when no settings file exists. */
export class FileSettingsStore {
  constructor(private readonly filePath: string) {}

  async load(): Promise<Settings> {
    try {
      return parseSettings(JSON.parse(await readFile(this.filePath, 'utf8')) as unknown);
    } catch (error: unknown) {
      if (isMissingFileError(error)) {
        return { port: DEFAULT_PORT };
      }
      if (error instanceof SettingsError) {
        throw error;
      }
      throw new SettingsError('Unable to load application settings.');
    }
  }

  async save(settings: Settings): Promise<void> {
    const validated = parseSettings(settings);
    const temporaryPath = `${this.filePath}.tmp`;

    try {
      await mkdir(dirname(this.filePath), { recursive: true });
      await writeFile(temporaryPath, `${JSON.stringify(validated, null, 2)}\n`, 'utf8');
      await rename(temporaryPath, this.filePath);
    } catch {
      throw new SettingsError('Unable to save application settings.');
    }
  }
}

function parseSettings(value: unknown): Settings {
  if (!isRecord(value)) {
    throw new SettingsError('The settings file has an unsupported format.');
  }

  const lastSpecPath = value.lastSpecPath;
  const mockStorePath = value.mockStorePath;
  const mockSeed = validateMockSeed(value.mockSeed);
  const locale = value.locale === undefined ? undefined : validateAppLocale(value.locale);
  if (
    (lastSpecPath !== undefined && typeof lastSpecPath !== 'string') ||
    (mockStorePath !== undefined && typeof mockStorePath !== 'string')
  ) {
    throw new SettingsError('The settings file has an unsupported format.');
  }

  return {
    port: validatePort(value.port),
    ...(mockSeed === undefined ? {} : { mockSeed }),
    ...(locale === undefined ? {} : { locale }),
    ...(lastSpecPath === undefined ? {} : { lastSpecPath }),
    ...(mockStorePath === undefined ? {} : { mockStorePath }),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isMissingFileError(error: unknown): error is NodeJS.ErrnoException {
  return isRecord(error) && error.code === 'ENOENT';
}
