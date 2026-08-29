import type { HttpMethod, MockResponse, SaveMockInput } from './types';

const httpMethods: readonly HttpMethod[] = [
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'HEAD',
  'OPTIONS',
];

/** Validates untrusted renderer input before it is persisted as a mock response. */
export function validateSaveMockInput(value: unknown): SaveMockInput {
  if (!isRecord(value) || !isRoutePath(value.path) || !isHttpMethod(value.method)) {
    throw new Error('Mock input must include a valid path and HTTP method.');
  }

  validateMockResponse(value.response);

  return { path: value.path, method: value.method, response: value.response };
}

/** Validates the serializable response shape used by the editor and IPC boundary. */
export function validateMockResponse(value: unknown): asserts value is MockResponse {
  if (!isMockResponse(value, 0)) {
    throw new Error('Mock input must include a valid response.');
  }
}

function isMockResponse(value: unknown, depth: number): value is MockResponse {
  return (
    isRecord(value) &&
    typeof value.status === 'number' &&
    Number.isInteger(value.status) &&
    value.status >= 100 &&
    value.status <= 599 &&
    isRecord(value.headers) &&
    Object.values(value.headers).every((header) => typeof header === 'string') &&
    'body' in value &&
    isJsonValue(value.body) &&
    (value.variants === undefined ||
      (depth < 5 &&
        Array.isArray(value.variants) &&
        value.variants.every((variant) => isMockVariant(variant, depth + 1))))
  );
}

function isMockVariant(value: unknown, depth: number): boolean {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    value.id.trim().length > 0 &&
    typeof value.priority === 'number' &&
    Number.isInteger(value.priority) &&
    isRequestMatcher(value.match) &&
    isMockResponse(value.response, depth)
  );
}

function isRequestMatcher(value: unknown): boolean {
  if (
    !isRecord(value) ||
    !Object.keys(value).every((key) => ['query', 'headers', 'body', 'pathParams'].includes(key))
  ) {
    return false;
  }
  return (
    (value.query === undefined || isStringRecord(value.query)) &&
    (value.headers === undefined || isStringRecord(value.headers)) &&
    (value.body === undefined || isJsonValue(value.body)) &&
    (value.pathParams === undefined || isStringRecord(value.pathParams))
  );
}

function isStringRecord(value: unknown): boolean {
  return isRecord(value) && Object.values(value).every((entry) => typeof entry === 'string');
}

function isRoutePath(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith('/') && !/[\r\n]/.test(value);
}

function isHttpMethod(value: unknown): value is HttpMethod {
  return typeof value === 'string' && (httpMethods as readonly string[]).includes(value);
}

function isJsonValue(value: unknown): boolean {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return true;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value);
  }
  if (Array.isArray(value)) {
    return value.every(isJsonValue);
  }
  return isJsonObject(value) && Object.values(value).every(isJsonValue);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return (
    isRecord(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
  );
}
