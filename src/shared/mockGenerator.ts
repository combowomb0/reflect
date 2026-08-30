import Ajv from 'ajv';
import { Faker, en, faker, ru } from '@faker-js/faker';

import type { AppLocale } from './types';

interface Schema {
  readonly example?: unknown;
  readonly default?: unknown;
  readonly const?: unknown;
  readonly enum?: unknown;
  readonly nullable?: unknown;
  readonly type?: unknown;
  readonly format?: unknown;
  readonly pattern?: unknown;
  readonly minimum?: unknown;
  readonly maximum?: unknown;
  readonly exclusiveMinimum?: unknown;
  readonly exclusiveMaximum?: unknown;
  readonly multipleOf?: unknown;
  readonly minLength?: unknown;
  readonly maxLength?: unknown;
  readonly minItems?: unknown;
  readonly maxItems?: unknown;
  readonly uniqueItems?: unknown;
  readonly items?: unknown;
  readonly required?: unknown;
  readonly properties?: unknown;
  readonly additionalProperties?: unknown;
  readonly readOnly?: unknown;
  readonly writeOnly?: unknown;
  readonly allOf?: unknown;
  readonly oneOf?: unknown;
  readonly anyOf?: unknown;
}

/** Custom field-level rule applied after explicit schema values and before name heuristics. */
export type MockFieldGenerator = (schema: unknown, fieldName: string) => unknown | undefined;

/** Controls deterministic and optional-field behavior for mock generation. */
export interface MockGenerationOptions {
  readonly seed?: number;
  readonly locale?: AppLocale;
  readonly defaultArrayLength?: number;
  readonly includeOptional?: boolean;
  readonly optionalPropertyProbability?: number;
  readonly nullableProbability?: number;
  readonly fieldGenerators?: Readonly<Record<string, MockFieldGenerator>>;
  readonly attempts?: number;
}

interface GenerationContext {
  readonly faker: Faker;
  readonly includeOptional: boolean;
  readonly optionalPropertyProbability: number;
  readonly nullableProbability: number;
  readonly defaultArrayLength?: number;
  readonly fieldGenerators: Readonly<Record<string, MockFieldGenerator>>;
}

/** Generates a representative value with default non-deterministic generation settings. */
export function generateMock(schema: unknown, fieldName = '', depth = 0): unknown {
  return generateValue(schema, fieldName, depth, defaultContext());
}

/** Generates a schema-validated mock value with optional deterministic and field-rule settings. */
export function generateMockWithOptions(
  schema: unknown,
  options: MockGenerationOptions = {},
): unknown {
  const context = createContext(options);
  const validate = createValidator(schema);
  const attempts = Math.max(1, Math.min(options.attempts ?? 3, 10));
  let value: unknown = null;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    value = generateValue(schema, '', 0, context);
    if (!validate || validate(value)) return value;
  }

  return value;
}

function defaultContext(): GenerationContext {
  return {
    faker,
    includeOptional: true,
    optionalPropertyProbability: 1,
    nullableProbability: 0.2,
    defaultArrayLength: undefined,
    fieldGenerators: {},
  };
}

function createContext(options: MockGenerationOptions): GenerationContext {
  const seededFaker =
    options.seed === undefined && options.locale !== 'ru'
      ? faker
      : new Faker({ locale: options.locale === 'ru' ? [ru, en] : [en] });
  if (options.seed !== undefined) seededFaker.seed(options.seed);

  return {
    faker: seededFaker,
    includeOptional: options.includeOptional ?? true,
    optionalPropertyProbability: clampProbability(options.optionalPropertyProbability ?? 1),
    nullableProbability: clampProbability(options.nullableProbability ?? 0.2),
    defaultArrayLength:
      options.defaultArrayLength === undefined
        ? undefined
        : clampArrayLength(options.defaultArrayLength),
    fieldGenerators: options.fieldGenerators ?? {},
  };
}

function generateValue(
  schema: unknown,
  fieldName: string,
  depth: number,
  context: GenerationContext,
): unknown {
  if (!isRecord(schema) || depth > 12) return null;

  const normalized = schema as Schema;
  if ('example' in normalized) return normalized.example;
  if ('default' in normalized) return normalized.default;
  if ('const' in normalized) return normalized.const;

  const composed = mergeAllOf(normalized);
  if (composed !== normalized) return generateValue(composed, fieldName, depth, context);
  const alternatives = normalized.oneOf ?? normalized.anyOf;
  if (Array.isArray(alternatives) && alternatives.length > 0) {
    return generateValue(
      context.faker.helpers.arrayElement(alternatives),
      fieldName,
      depth + 1,
      context,
    );
  }
  if (Array.isArray(normalized.enum) && normalized.enum.length > 0) {
    return context.faker.helpers.arrayElement(normalized.enum);
  }
  if (
    normalized.nullable === true &&
    context.faker.number.float({ min: 0, max: 1 }) < context.nullableProbability
  ) {
    return null;
  }

  const customGenerator =
    context.fieldGenerators[fieldName] ?? context.fieldGenerators[fieldName.toLowerCase()];
  const customValue = customGenerator?.(schema, fieldName);
  if (customValue !== undefined) return customValue;

  switch (normalized.type) {
    case 'object':
      return generateObject(normalized, depth, context);
    case 'array':
      return generateArray(normalized, fieldName, depth, context);
    case 'integer':
      return generateNumber(normalized, true, context);
    case 'number':
      return generateNumber(normalized, false, context);
    case 'boolean':
      return context.faker.datatype.boolean();
    case 'string':
      return generateString(normalized, fieldName, context);
    default:
      return isRecord(normalized.properties) ? generateObject(normalized, depth, context) : null;
  }
}

function mergeAllOf(schema: Schema): Schema {
  if (!Array.isArray(schema.allOf) || schema.allOf.length === 0) return schema;
  const schemas = [schema, ...schema.allOf.filter(isRecord)];
  const properties = Object.assign(
    {},
    ...schemas.map((item) => (isRecord(item.properties) ? item.properties : {})),
  );
  const required = [
    ...new Set(schemas.flatMap((item) => (Array.isArray(item.required) ? item.required : []))),
  ];
  const merged = Object.assign({}, ...schemas, { properties, required });
  delete merged.allOf;
  return merged;
}

function generateObject(
  schema: Schema,
  depth: number,
  context: GenerationContext,
): Record<string, unknown> {
  const properties = isRecord(schema.properties) ? schema.properties : {};
  const required = new Set(
    Array.isArray(schema.required)
      ? schema.required.filter((property): property is string => typeof property === 'string')
      : [],
  );
  const value: Record<string, unknown> = {};

  for (const [name, property] of Object.entries(properties)) {
    const propertySchema = isRecord(property) ? (property as Schema) : undefined;
    if (propertySchema?.writeOnly === true) continue;
    if (
      !required.has(name) &&
      (!context.includeOptional ||
        context.faker.number.float({ min: 0, max: 1 }) > context.optionalPropertyProbability)
    ) {
      continue;
    }
    value[name] = generateValue(property, name, depth + 1, context);
  }

  if (schema.additionalProperties === true || isRecord(schema.additionalProperties)) {
    const additionalSchema =
      schema.additionalProperties === true ? { type: 'string' } : schema.additionalProperties;
    value.metadata = generateValue(additionalSchema, 'metadata', depth + 1, context);
  }
  return value;
}

function generateArray(
  schema: Schema,
  fieldName: string,
  depth: number,
  context: GenerationContext,
): unknown[] {
  const minimum = asNonNegativeInteger(schema.minItems) ?? 1;
  const maximum = asNonNegativeInteger(schema.maxItems);
  const count = selectArrayLength(minimum, maximum, context);
  const values: unknown[] = [];
  const seen = new Set<string>();

  while (values.length < count) {
    let value = generateValue(schema.items, fieldName, depth + 1, context);
    if (schema.uniqueItems === true) {
      for (let attempt = 0; attempt < 5 && seen.has(JSON.stringify(value)); attempt += 1) {
        value = generateValue(schema.items, fieldName, depth + 1, context);
      }
      seen.add(JSON.stringify(value));
    }
    values.push(value);
  }
  return values;
}

function generateNumber(schema: Schema, integer: boolean, context: GenerationContext): number {
  const step = integer ? 1 : 0.01;
  let minimum = asFiniteNumber(schema.minimum) ?? 0;
  let maximum = asFiniteNumber(schema.maximum) ?? minimum + 1000;
  if (schema.exclusiveMinimum === true) minimum += step;
  if (schema.exclusiveMaximum === true) maximum -= step;
  if (typeof schema.exclusiveMinimum === 'number')
    minimum = Math.max(minimum, schema.exclusiveMinimum + step);
  if (typeof schema.exclusiveMaximum === 'number')
    maximum = Math.min(maximum, schema.exclusiveMaximum - step);
  maximum = Math.max(minimum, maximum);

  const multipleOf = asPositiveNumber(schema.multipleOf);
  if (multipleOf) {
    const lowerFactor = Math.ceil(minimum / multipleOf);
    const upperFactor = Math.floor(maximum / multipleOf);
    if (lowerFactor <= upperFactor) {
      return context.faker.number.int({ min: lowerFactor, max: upperFactor }) * multipleOf;
    }
  }
  if (integer) {
    return context.faker.number.int({ min: Math.ceil(minimum), max: Math.floor(maximum) });
  }
  return context.faker.number.float({ min: minimum, max: maximum, fractionDigits: 2 });
}

function generateString(schema: Schema, fieldName: string, context: GenerationContext): string {
  const format = typeof schema.format === 'string' ? schema.format : '';
  const field = fieldName.toLowerCase();
  const patternValue = generatePatternValue(schema, context);
  if (patternValue) return patternValue;

  if (format === 'uuid')
    return useCandidateOrFallback(context.faker.string.uuid(), schema, field, context);
  if (format === 'email' || field.includes('email')) {
    return useCandidateOrFallback(context.faker.internet.email(), schema, field, context);
  }
  if (format === 'uri' || format === 'url' || field.includes('url')) {
    return useCandidateOrFallback(context.faker.internet.url(), schema, field, context);
  }
  if (format === 'date') {
    return useCandidateOrFallback(
      context.faker.date.recent().toISOString().slice(0, 10),
      schema,
      field,
      context,
    );
  }
  if (format === 'date-time') {
    return useCandidateOrFallback(
      context.faker.date.recent().toISOString(),
      schema,
      field,
      context,
    );
  }
  if (field === 'id' || field.endsWith('id')) {
    return useCandidateOrFallback(
      context.faker.string.alphanumeric({ length: 12, casing: 'lower' }),
      schema,
      field,
      context,
    );
  }
  if (field.includes('title') || field.includes('subject') || field.includes('headline')) {
    return useCandidateOrFallback(context.faker.lorem.words(3), schema, field, context);
  }
  if (field.includes('description') || field.includes('summary') || field.includes('comment')) {
    return useCandidateOrFallback(context.faker.lorem.words(12), schema, field, context);
  }
  if (field.includes('slug')) {
    return useCandidateOrFallback(
      context.faker.lorem.words(3).replaceAll(' ', '-').toLowerCase(),
      schema,
      field,
      context,
    );
  }
  if (field.includes('firstname') || field.includes('first_name')) {
    return useCandidateOrFallback(context.faker.person.firstName(), schema, field, context);
  }
  if (field.includes('lastname') || field.includes('last_name')) {
    return useCandidateOrFallback(context.faker.person.lastName(), schema, field, context);
  }
  if (field.includes('name'))
    return useCandidateOrFallback(context.faker.person.fullName(), schema, field, context);
  if (field.includes('phone'))
    return useCandidateOrFallback(context.faker.phone.number(), schema, field, context);
  if (field.includes('company'))
    return useCandidateOrFallback(context.faker.company.name(), schema, field, context);
  if (field.includes('city'))
    return useCandidateOrFallback(context.faker.location.city(), schema, field, context);
  if (field.includes('country'))
    return useCandidateOrFallback(context.faker.location.country(), schema, field, context);
  if (field.includes('category'))
    return useCandidateOrFallback(context.faker.commerce.department(), schema, field, context);
  return generateConstrainedString(schema, field, context);
}

function generatePatternValue(schema: Schema, context: GenerationContext): string | undefined {
  if (typeof schema.pattern !== 'string') return undefined;
  const uppercaseCode = schema.pattern.match(/^\^\[A-Z\]\{(\d+)\}[-_]\\d\{(\d+)\}\$$/);
  const digits = schema.pattern.match(/^\^\\d\{(\d+)\}\$$/);
  const slug = /^\^?\[a-z0-9-\]\+\$?$/.test(schema.pattern);
  const candidate = uppercaseCode
    ? `${context.faker.string.alpha({ length: Number(uppercaseCode[1]), casing: 'upper' })}-${context.faker.string.numeric(Number(uppercaseCode[2]))}`
    : digits
      ? context.faker.string.numeric(Number(digits[1]))
      : slug
        ? context.faker.lorem.words(3).replaceAll(' ', '-').toLowerCase()
        : undefined;
  return candidate &&
    isWithinStringConstraints(candidate, schema) &&
    new RegExp(schema.pattern).test(candidate)
    ? candidate
    : undefined;
}

function useCandidateOrFallback(
  candidate: string,
  schema: Schema,
  fieldName: string,
  context: GenerationContext,
): string {
  return isWithinStringConstraints(candidate, schema)
    ? candidate
    : generateConstrainedString(schema, fieldName, context);
}

function generateConstrainedString(
  schema: Schema,
  fieldName: string,
  context: GenerationContext,
): string {
  const minimum = asNonNegativeInteger(schema.minLength) ?? 8;
  const maximum = asNonNegativeInteger(schema.maxLength) ?? Math.max(minimum, 24);
  const length = Math.max(
    1,
    Math.min(Math.max(minimum, preferredStringLength(fieldName)), maximum),
  );
  return context.faker.string.alpha({ length, casing: 'mixed' });
}

function preferredStringLength(fieldName: string): number {
  if (
    fieldName.includes('title') ||
    fieldName.includes('subject') ||
    fieldName.includes('headline')
  )
    return 24;
  if (
    fieldName.includes('description') ||
    fieldName.includes('summary') ||
    fieldName.includes('comment')
  )
    return 72;
  return 12;
}

function isWithinStringConstraints(value: string, schema: Schema): boolean {
  const minimum = asNonNegativeInteger(schema.minLength);
  const maximum = asNonNegativeInteger(schema.maxLength);
  return (
    (minimum === undefined || value.length >= minimum) &&
    (maximum === undefined || value.length <= maximum)
  );
}

function createValidator(schema: unknown): ((value: unknown) => boolean) | undefined {
  if (!isRecord(schema)) return undefined;
  try {
    return new Ajv({ strict: false, validateFormats: false }).compile(schema);
  } catch {
    return undefined;
  }
}

function clampProbability(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(value, 1)) : 1;
}

function clampArrayLength(value: number): number {
  return Number.isInteger(value) && value >= 0 ? Math.min(value, 100) : 3;
}

function selectArrayLength(
  minimum: number,
  maximum: number | undefined,
  context: GenerationContext,
): number {
  if (maximum !== undefined && maximum < minimum) return maximum;
  if (context.defaultArrayLength !== undefined) {
    return maximum === undefined
      ? Math.max(minimum, context.defaultArrayLength)
      : Math.max(minimum, Math.min(context.defaultArrayLength, maximum));
  }

  const lower = Math.max(minimum, 2);
  const upper = Math.min(maximum ?? 10, 10);
  if (lower <= upper) return context.faker.number.int({ min: lower, max: upper });
  return minimum > 10 ? minimum : (maximum ?? minimum);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asFiniteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function asPositiveNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined;
}

function asNonNegativeInteger(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : undefined;
}
