import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  FileSettingsStore,
  SettingsError,
  validateAppLocale,
  validateMockSeed,
  validatePort,
} from '../src/main/settings';

describe('settings', () => {
  it('uses the default port when settings have not been persisted', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'reflect-settings-'));

    await expect(new FileSettingsStore(join(directory, 'settings.json')).load()).resolves.toEqual({
      port: 31247,
    });
  });

  it('persists valid settings', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'reflect-settings-'));
    const store = new FileSettingsStore(join(directory, 'settings.json'));

    await store.save({ port: 5050, mockSeed: 42, locale: 'ru', lastSpecPath: '/tmp/openapi.yaml' });

    await expect(store.load()).resolves.toEqual({
      port: 5050,
      mockSeed: 42,
      locale: 'ru',
      lastSpecPath: '/tmp/openapi.yaml',
    });
  });

  it('validates optional Faker generation seeds', () => {
    expect(validateMockSeed(undefined)).toBeUndefined();
    expect(validateMockSeed(0)).toBe(0);
    expect(() => validateMockSeed(-1)).toThrow(SettingsError);
    expect(() => validateMockSeed(0x1_0000_0000)).toThrow(SettingsError);
  });

  it('validates supported application locales', () => {
    expect(validateAppLocale('en')).toBe('en');
    expect(validateAppLocale('ru')).toBe('ru');
    expect(() => validateAppLocale('de')).toThrow(SettingsError);
  });

  it('rejects invalid TCP ports', () => {
    expect(() => validatePort(0)).toThrow(SettingsError);
    expect(() => validatePort(65536)).toThrow(SettingsError);
    expect(() => validatePort(3000.5)).toThrow(SettingsError);
  });

  it('rejects corrupt persisted settings', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'reflect-settings-'));
    const filePath = join(directory, 'settings.json');
    await writeFile(filePath, '{ invalid json', 'utf8');

    await expect(new FileSettingsStore(filePath).load()).rejects.toBeInstanceOf(SettingsError);
  });
});
