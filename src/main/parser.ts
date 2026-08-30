import SwaggerParser from '@apidevtools/swagger-parser';
import { access, readFile, stat } from 'node:fs/promises';
import { extname, resolve } from 'node:path';

import type { Endpoint, HttpMethod } from '../shared/types';
import { DomainError } from '../shared/errors';

const MAX_SPEC_BYTES = 10 * 1024 * 1024;
const operationMethods: readonly HttpMethod[] = [
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'HEAD',
  'OPTIONS',
];

interface OpenApiOperation {
  readonly summary?: unknown;
  readonly operationId?: unknown;
  readonly tags?: unknown;
  readonly responses?: unknown;
}

interface OpenApiPathItem {
  readonly get?: unknown;
  readonly post?: unknown;
  readonly put?: unknown;
  readonly patch?: unknown;
  readonly delete?: unknown;
  readonly head?: unknown;
  readonly options?: unknown;
}

interface OpenApiDocument {
  readonly openapi?: unknown;
  readonly paths?: unknown;
}

/** Describes an invalid or unreadable OpenAPI specification without exposing implementation details. */
export class OpenApiParseError extends DomainError {
  constructor(
    message: string,
    readonly isReusableFragment = false,
  ) {
    super('SPEC_INVALID', message);
    this.name = 'OpenApiParseError';
  }
}

/** Reads, validates, dereferences, and normalizes an OpenAPI 3.x YAML or JSON document. */
export async function parseOpenAPIFile(filePath: string): Promise<readonly Endpoint[]> {
  const resolvedPath = validateSpecPath(filePath);

  try {
    await access(resolvedPath);
    const metadata = await stat(resolvedPath);

    if (!metadata.isFile()) {
      throw new OpenApiParseError('The selected specification path is not a file.');
    }

    if (metadata.size > MAX_SPEC_BYTES) {
      throw new OpenApiParseError('The selected specification exceeds the 10 MB size limit.');
    }

    const document = (await SwaggerParser.dereference(resolvedPath)) as OpenApiDocument;

    if (typeof document.openapi !== 'string' || !document.openapi.startsWith('3.')) {
      throw new OpenApiParseError('Reflect supports OpenAPI 3.x specifications only.');
    }

    // A components-only document is a shared dependency, not a mockable API.
    if (!isRecord(document.paths)) return [];

    return normalizeEndpoints(document.paths);
  } catch (error: unknown) {
    if (error instanceof OpenApiParseError) {
      throw error;
    }

    if ((await hasOpenApiVersion(resolvedPath)) === false) {
      throw new OpenApiParseError('The file is a reusable OpenAPI fragment.', true);
    }

    throw new OpenApiParseError(
      `Unable to read or validate the OpenAPI specification: ${getErrorDetail(error)}`,
    );
  }
}

async function hasOpenApiVersion(filePath: string): Promise<boolean | undefined> {
  try {
    const source = await readFile(filePath, 'utf8');
    return /^\s*(?:"openapi"|openapi)\s*:/m.test(source) || /"openapi"\s*:/m.test(source);
  } catch {
    return undefined;
  }
}

function getErrorDetail(error: unknown): string {
  if (!(error instanceof Error) || !error.message) {
    return 'The parser did not provide additional details.';
  }

  return error.message.replace(/\s+/g, ' ').trim().slice(0, 500);
}

function validateSpecPath(filePath: string): string {
  if (!filePath.trim()) {
    throw new OpenApiParseError('A specification path is required.');
  }

  const extension = extname(filePath).toLowerCase();
  if (!['.yaml', '.yml', '.json'].includes(extension)) {
    throw new OpenApiParseError('Select an OpenAPI YAML or JSON file.');
  }

  return resolve(filePath);
}

function normalizeEndpoints(paths: Record<string, unknown>): readonly Endpoint[] {
  const endpoints: Endpoint[] = [];

  for (const [path, pathItem] of Object.entries(paths)) {
    if (!path.startsWith('/') || !isRecord(pathItem)) {
      continue;
    }

    for (const method of operationMethods) {
      const operation = (pathItem as OpenApiPathItem)[
        method.toLowerCase() as Lowercase<HttpMethod>
      ];
      if (!isRecord(operation)) {
        continue;
      }

      const response = selectSuccessResponse(operation as OpenApiOperation);
      endpoints.push({
        id: `${method} ${path}`,
        path,
        method,
        summary: asString(operation.summary),
        operationId: asString(operation.operationId),
        tags: asStrings(operation.tags),
        responseStatus: response.status,
        responseSchema: response.schema,
      });
    }
  }

  return endpoints;
}

function selectSuccessResponse(operation: OpenApiOperation): {
  readonly status: number;
  readonly schema?: unknown;
} {
  if (!isRecord(operation.responses)) {
    return { status: 200 };
  }

  const responses = Object.entries(operation.responses)
    .map(([status, response]) => ({ status: Number(status), response }))
    .filter(
      ({ status, response }) =>
        Number.isInteger(status) && status >= 200 && status < 300 && isRecord(response),
    )
    .sort((left, right) => left.status - right.status);

  const selected = responses[0];
  if (!selected || !isRecord(selected.response) || !isRecord(selected.response.content)) {
    return { status: selected?.status ?? 200 };
  }

  const content = selected.response.content;
  const jsonContent = content['application/json'] ?? Object.values(content)[0];

  return {
    status: selected.status,
    schema: isRecord(jsonContent) ? jsonContent.schema : undefined,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function asStrings(value: unknown): readonly string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}
