import express, { type Express, type Request, type Response } from 'express';
import { type Server } from 'node:http';

import type { MockStore } from './fileMockStore';
import type { Endpoint, HttpMethod, RequestLogEntry, ServerStatus } from '../shared/types';

const MAX_REQUEST_LOG_ENTRIES = 200;

/** Creates an Express application whose response lookup is refreshed on every request. */
export function createMockApp(
  endpoints: readonly Endpoint[],
  store: MockStore,
  onRequest?: (entry: RequestLogEntry) => void,
): Express {
  const app = express();

  app.use((request, response, next) => {
    const startedAt = Date.now();
    response.once('finish', () => {
      onRequest?.({
        method: request.method,
        path: request.path,
        status: response.statusCode,
        durationMs: Date.now() - startedAt,
        timestamp: new Date().toISOString(),
      });
    });
    next();
  });
  app.use(express.json());

  for (const endpoint of endpoints) {
    registerRoute(app, endpoint, store);
  }

  app.use((_request, response) => {
    response.status(404).json({ error: 'No mock route matches this request.' });
  });

  return app;
}

/** Owns the localhost HTTP listener and reports its lifecycle without exposing Node server handles. */
export class MockServer {
  private server: Server | undefined;
  private status: ServerStatus = { state: 'stopped' };
  private requestLog: RequestLogEntry[] = [];

  getStatus(): ServerStatus {
    return this.status;
  }

  /** Returns a snapshot of the bounded local request diagnostics. */
  getRequestLog(): readonly RequestLogEntry[] {
    return [...this.requestLog];
  }

  /** Records safe metadata for a completed local request. */
  recordRequest(entry: RequestLogEntry): void {
    this.requestLog.push(entry);
    if (this.requestLog.length > MAX_REQUEST_LOG_ENTRIES) {
      this.requestLog.splice(0, this.requestLog.length - MAX_REQUEST_LOG_ENTRIES);
    }
  }

  async start(app: Express, port: number): Promise<ServerStatus> {
    if (this.server) {
      return this.status;
    }

    this.status = { state: 'starting' };
    const server = app.listen(port, '127.0.0.1');
    this.server = server;

    try {
      await new Promise<void>((resolve, reject) => {
        server.once('listening', resolve);
        server.once('error', reject);
      });
      const address = server.address();
      this.status = {
        state: 'running',
        port: typeof address === 'object' && address ? address.port : port,
      };
    } catch {
      this.server = undefined;
      this.status = { state: 'error', message: 'Unable to start the local mock server.' };
    }

    return this.status;
  }

  async stop(): Promise<ServerStatus> {
    if (!this.server) {
      this.status = { state: 'stopped' };
      return this.status;
    }

    const server = this.server;
    this.status = { state: 'stopping' };

    try {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
      this.server = undefined;
      this.status = { state: 'stopped' };
    } catch {
      this.status = { state: 'error', message: 'Unable to stop the local mock server.' };
    }

    return this.status;
  }
}

function registerRoute(app: Express, endpoint: Endpoint, store: MockStore): void {
  const path = endpoint.path.replace(/\{([^}]+)\}/g, ':$1');
  const handler = async (_request: Request, response: Response): Promise<void> => {
    try {
      const mock = await store.get(endpoint.path, endpoint.method);
      if (mock) {
        const selectedResponse = selectMockResponse(mock, _request);
        response
          .status(selectedResponse.status)
          .set(selectedResponse.headers)
          .json(selectedResponse.body);
        return;
      }

      response.status(endpoint.responseStatus).json(null);
    } catch {
      response.status(500).json({ error: 'Unable to load the mock response.' });
    }
  };

  app[endpoint.method.toLowerCase() as Lowercase<HttpMethod>](path, handler);
}

function selectMockResponse(mock: import('../shared/types').MockResponse, request: Request) {
  const matched = [...(mock.variants ?? [])]
    .sort((left, right) => right.priority - left.priority)
    .find((variant) => matchesRequest(variant.match, request));
  return matched?.response ?? mock;
}

function matchesRequest(
  match: import('../shared/types').RequestMatcher,
  request: Request,
): boolean {
  return (
    matchesStringRecord(match.pathParams, request.params) &&
    matchesStringRecord(match.query, request.query) &&
    matchesHeaders(match.headers, request) &&
    (match.body === undefined || matchesBody(match.body, request.body))
  );
}

function matchesStringRecord(
  expected: Readonly<Record<string, string>> | undefined,
  actual: Record<string, unknown>,
): boolean {
  return !expected || Object.entries(expected).every(([key, value]) => actual[key] === value);
}

function matchesHeaders(
  expected: Readonly<Record<string, string>> | undefined,
  request: Request,
): boolean {
  return !expected || Object.entries(expected).every(([key, value]) => request.get(key) === value);
}

function matchesBody(expected: unknown, actual: unknown): boolean {
  if (expected === null || typeof expected !== 'object') return Object.is(expected, actual);
  if (Array.isArray(expected)) {
    return (
      Array.isArray(actual) &&
      expected.length === actual.length &&
      expected.every((value, index) => matchesBody(value, actual[index]))
    );
  }
  if (!isRecord(actual)) return false;
  return Object.entries(expected).every(([key, value]) => matchesBody(value, actual[key]));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
