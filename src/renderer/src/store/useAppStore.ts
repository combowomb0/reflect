import { create } from 'zustand';

import type {
  AppLocale,
  Endpoint,
  LoadedWorkspace,
  MockMap,
  RequestLogEntry,
  ServerStatus,
} from '../../../shared/types';

interface AppStore {
  readonly version?: string;
  readonly endpoints: readonly Endpoint[];
  readonly specs: LoadedWorkspace['specs'];
  readonly serverStatus: ServerStatus;
  readonly mocks: readonly MockMap[];
  readonly selected?: Endpoint;
  readonly requestLog: readonly RequestLogEntry[];
  readonly mockSeed?: number;
  readonly locale: AppLocale;
  readonly error?: string;
  readonly loading: boolean;
  setVersion: (version: string) => void;
  setServerStatus: (status: ServerStatus) => void;
  setRequestLog: (entries: readonly RequestLogEntry[]) => void;
  setSettings: (settings: { readonly mockSeed?: number; readonly locale?: AppLocale }) => void;
  setLoading: (loading: boolean) => void;
  setError: (error?: string) => void;
  loadWorkspace: (workspace: LoadedWorkspace, mocks: readonly MockMap[]) => void;
  selectEndpoint: (endpoint: Endpoint) => void;
  replaceMock: (mockMap: MockMap) => void;
}

/** Renderer-only UI state. Main process data remains the persistent source of truth. */
export const useAppStore = create<AppStore>((set) => ({
  endpoints: [],
  specs: [],
  serverStatus: { state: 'stopped' },
  mocks: [],
  requestLog: [],
  locale: 'en',
  loading: false,
  setVersion: (version) => set({ version }),
  setServerStatus: (serverStatus) => set({ serverStatus, error: undefined }),
  setRequestLog: (requestLog) => set({ requestLog }),
  setSettings: (settings) => set({ mockSeed: settings.mockSeed, locale: settings.locale ?? 'en' }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  loadWorkspace: (workspace, mocks) => {
    const endpoints = workspace.specs.flatMap((spec) => spec.endpoints);
    set({ endpoints, specs: workspace.specs, mocks, selected: endpoints[0], loading: false });
  },
  selectEndpoint: (selected) => set({ selected, error: undefined }),
  replaceMock: (mockMap) =>
    set((state) => ({
      mocks: [...state.mocks.filter((current) => current.specPath !== mockMap.specPath), mockMap],
      error: undefined,
    })),
}));
