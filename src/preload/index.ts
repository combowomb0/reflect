import { contextBridge, ipcRenderer } from 'electron';

import type {
  LoadedWorkspace,
  MockMap,
  MockImportPreview,
  ReflectApi,
  Result,
  SaveMockInput,
  RequestLogEntry,
  ServerStatus,
  Settings,
} from '../shared/types';

const reflect: ReflectApi = {
  getAppVersion: () => ipcRenderer.invoke('app:getVersion') as Promise<Result<string>>,
  openSpec: () => ipcRenderer.invoke('spec:open') as Promise<Result<LoadedWorkspace | undefined>>,
  startServer: (port) => ipcRenderer.invoke('server:start', port) as Promise<Result<ServerStatus>>,
  stopServer: () => ipcRenderer.invoke('server:stop') as Promise<Result<ServerStatus>>,
  getServerStatus: () => ipcRenderer.invoke('server:status') as Promise<Result<ServerStatus>>,
  listRequestLog: () =>
    ipcRenderer.invoke('server:request-log') as Promise<Result<readonly RequestLogEntry[]>>,
  getSettings: () => ipcRenderer.invoke('settings:get') as Promise<Result<Settings>>,
  saveMockSeed: (seed) =>
    ipcRenderer.invoke('settings:save-mock-seed', seed) as Promise<Result<Settings>>,
  saveAppLocale: (locale) =>
    ipcRenderer.invoke('settings:save-app-locale', locale) as Promise<Result<Settings>>,
  listMocks: () => ipcRenderer.invoke('mocks:list') as Promise<Result<readonly MockMap[]>>,
  saveMock: (input: SaveMockInput) =>
    ipcRenderer.invoke('mocks:save', input) as Promise<Result<MockMap>>,
  previewMockImport: () =>
    ipcRenderer.invoke('mocks:import-preview') as Promise<Result<MockImportPreview | undefined>>,
  importMocks: () => ipcRenderer.invoke('mocks:import') as Promise<Result<MockMap>>,
  exportMocks: () => ipcRenderer.invoke('mocks:export') as Promise<Result<string | undefined>>,
};

contextBridge.exposeInMainWorld('reflect', reflect);
