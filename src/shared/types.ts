/** HTTP methods supported by an OpenAPI operation and Reflect mock routes. */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

/** Supported application and mock-data locales. */
export type AppLocale = 'en' | 'ru';

/** A normalized OpenAPI operation shown in the renderer and registered by the server. */
export interface Endpoint {
  readonly id: string;
  readonly path: string;
  readonly method: HttpMethod;
  readonly summary?: string;
  readonly operationId?: string;
  readonly tags: readonly string[];
  readonly responseStatus: number;
  readonly responseSchema?: unknown;
}

/** The complete response returned by an overridden mock route. */
export interface MockResponse {
  readonly status: number;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: unknown;
  readonly variants?: readonly MockVariant[];
}

/** Request values used to select a conditional response variant. */
export interface RequestMatcher {
  readonly query?: Readonly<Record<string, string>>;
  readonly headers?: Readonly<Record<string, string>>;
  readonly body?: unknown;
  readonly pathParams?: Readonly<Record<string, string>>;
}

/** A higher-priority response returned when all configured request values match. */
export interface MockVariant {
  readonly id: string;
  readonly priority: number;
  readonly match: RequestMatcher;
  readonly response: MockResponse;
}

/** Versioned persisted overrides for one OpenAPI specification. */
export interface MockMap {
  readonly version: 1;
  readonly specPath: string;
  readonly mocks: Readonly<Partial<Record<string, Partial<Record<HttpMethod, MockResponse>>>>>;
}

/** Lifecycle state reported for the local Express server. */
export type ServerState = 'stopped' | 'starting' | 'running' | 'stopping' | 'error';

/** Safe server status passed from main to the renderer. */
export interface ServerStatus {
  readonly state: ServerState;
  readonly port?: number;
  readonly message?: string;
}

/** Safe diagnostic metadata for one request handled by the local mock server. */
export interface RequestLogEntry {
  readonly method: string;
  readonly path: string;
  readonly status: number;
  readonly durationMs: number;
  readonly timestamp: string;
}

/** Persisted application preferences. */
export interface Settings {
  readonly port: number;
  readonly mockSeed?: number;
  readonly locale?: AppLocale;
  readonly lastSpecPath?: string;
  readonly mockStorePath?: string;
}

/** The active, validated specification available to the renderer. */
export interface LoadedSpec {
  readonly path: string;
  readonly endpoints: readonly Endpoint[];
}

/** Independently loaded specifications that share one conflict-free local server. */
export interface LoadedWorkspace {
  readonly specs: readonly LoadedSpec[];
}

export interface SaveMockInput {
  readonly path: string;
  readonly method: HttpMethod;
  readonly response: MockResponse;
}

/** A serializable error intended for display in the renderer. */
export interface AppError {
  readonly code: import('./errors').AppErrorCode;
  readonly message: string;
}

/** Result returned by every preload method. */
export type Result<T> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: AppError };

/** Deliberately small API exposed by the preload process in Phase 0. */
export interface ReflectApi {
  getAppVersion(): Promise<Result<string>>;
  openSpec(): Promise<Result<LoadedWorkspace | undefined>>;
  startServer(port: number): Promise<Result<ServerStatus>>;
  stopServer(): Promise<Result<ServerStatus>>;
  getServerStatus(): Promise<Result<ServerStatus>>;
  listRequestLog(): Promise<Result<readonly RequestLogEntry[]>>;
  getSettings(): Promise<Result<Settings>>;
  saveSettings(settings: Settings): Promise<Result<Settings>>;
  listMocks(): Promise<Result<readonly MockMap[]>>;
  saveMock(input: SaveMockInput): Promise<Result<MockMap>>;
}
