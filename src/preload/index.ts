import { contextBridge, ipcRenderer } from 'electron';

import type {
  LoadedWorkspace,
  MockMap,
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
  saveSettings: (settings: Settings) =>
    ipcRenderer.invoke('settings:save', settings) as Promise<Result<Settings>>,
  listMocks: () => ipcRenderer.invoke('mocks:list') as Promise<Result<readonly MockMap[]>>,
  saveMock: (input: SaveMockInput) =>
    ipcRenderer.invoke('mocks:save', input) as Promise<Result<MockMap>>,
};

contextBridge.exposeInMainWorld('reflect', reflect);
