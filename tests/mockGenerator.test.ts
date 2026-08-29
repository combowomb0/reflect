import { describe, expect, it } from 'vitest';

import { generateMock, generateMockWithOptions } from '../src/shared/mockGenerator';

describe('generateMock', () => {
  it('prefers explicit examples and enum values', () => {
    expect(generateMock({ type: 'string', example: 'fixed-value' })).toBe('fixed-value');
    expect(['draft', 'published']).toContain(
      generateMock({ type: 'string', enum: ['draft', 'published'] }),
    );
  });

  it('preserves nested object and array structure', () => {
    const value = generateMock({
      type: 'object',
      properties: {
        items: {
          type: 'array',
          minItems: 2,
          items: { type: 'object', properties: { active: { type: 'boolean' } } },
        },
      },
    });

    expect(value).toMatchObject({
      items: expect.arrayContaining([{ active: expect.any(Boolean) }]),
    });
    expect((value as { items: unknown[] }).items.length).toBeGreaterThanOrEqual(2);
  });

  it('honors numeric and string constraints', () => {
    const number = generateMock({ type: 'integer', minimum: 7, maximum: 7 });
    const string = generateMock({ type: 'string', minLength: 4, maxLength: 4 });

    expect(number).toBe(7);
    expect(string).toMatch(/^[A-Za-z]{4}$/);
  });

  it('uses field-name and format heuristics for strings', () => {
    expect(generateMock({ type: 'string' }, 'email')).toContain('@');
    expect(generateMock({ type: 'string', format: 'uuid' })).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it('honors defaults and common string formats', () => {
    expect(generateMock({ type: 'string', default: 'fallback' })).toBe('fallback');
    expect(generateMock({ type: 'string', format: 'uri' })).toMatch(/^https?:\/\//);
    expect(generateMock({ type: 'string', format: 'date' })).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(generateMock({ type: 'string', format: 'date-time' })).toMatch(/T/);
  });

  it('generates supported scalar types and safely falls back for unsupported schemas', () => {
    expect(generateMock({ type: 'number', minimum: 1.5, maximum: 1.5 })).toBe(1.5);
    expect(generateMock({ type: 'string' }, 'customerId')).toMatch(/^[a-z0-9]{12}$/);
    expect(generateMock({ type: 'string' }, 'fullName')).toEqual(expect.any(String));
    expect(generateMock({ type: 'string' }, 'phoneNumber')).toEqual(expect.any(String));
    expect(
      generateMock({ type: 'array', minItems: 3, maxItems: 1, items: { type: 'string' } }),
    ).toHaveLength(1);
    expect(generateMock({ type: 'unknown' })).toBeNull();
    expect(generateMock(undefined)).toBeNull();
  });

  it('uses realistic lengths and semantic values for unconstrained business fields', () => {
    const generic = generateMock({ type: 'string', minLength: 1, maxLength: 255 });
    const title = generateMock({ type: 'string', minLength: 1, maxLength: 255 }, 'title');
    const description = generateMock(
      { type: 'string', minLength: 1, maxLength: 255 },
      'description',
    );
    const slug = generateMock({ type: 'string', minLength: 1, maxLength: 255 }, 'slug');

    if (typeof title !== 'string' || typeof description !== 'string' || typeof slug !== 'string') {
      throw new Error('Expected semantic fields to generate strings.');
    }

    expect(generic).toMatch(/^[A-Za-z]{12}$/);
    expect(title.length).toBeGreaterThan(1);
    expect(title.split(' ')).toHaveLength(3);
    expect(description.split(' ')).toHaveLength(12);
    expect(slug).toMatch(/-/);
    expect(slug.split('-')).toHaveLength(3);
  });

  it('still honors restrictive maximum string lengths', () => {
    expect(generateMock({ type: 'string', minLength: 1, maxLength: 1 }, 'title')).toMatch(/^.$/);
  });

  it('supports composition, response-only properties, maps, and optional fields', () => {
    expect(
      generateMockWithOptions(
        {
          type: 'object',
          allOf: [
            { required: ['id'], properties: { id: { type: 'integer', minimum: 1, maximum: 1 } } },
            {
              properties: {
                name: { type: 'string' },
                secret: { type: 'string', writeOnly: true },
              },
            },
          ],
        },
        { includeOptional: false, seed: 5 },
      ),
    ).toEqual({ id: 1 });
    expect(
      generateMockWithOptions(
        { type: 'object', additionalProperties: { type: 'string', minLength: 3 } },
        { seed: 5 },
      ),
    ).toMatchObject({ metadata: expect.any(String) });
  });

  it('supports deterministic alternatives, nullable values, numeric constraints, and common patterns', () => {
    const schema = { oneOf: [{ type: 'string' }, { type: 'integer', minimum: 2, maximum: 2 }] };
    expect(generateMockWithOptions(schema, { seed: 42 })).toEqual(
      generateMockWithOptions(schema, { seed: 42 }),
    );
    expect(
      generateMockWithOptions(
        { type: 'string', nullable: true },
        { nullableProbability: 1, seed: 1 },
      ),
    ).toBeNull();
    const constrainedNumber = generateMockWithOptions(
      { type: 'integer', minimum: 1, maximum: 10, exclusiveMinimum: true, multipleOf: 2 },
      { seed: 2 },
    );
    expect(constrainedNumber).toEqual(expect.any(Number));
    expect(constrainedNumber).toBeGreaterThan(1);
    expect((constrainedNumber as number) % 2).toBe(0);
    expect(generateMockWithOptions({ type: 'string', pattern: '^\\d{4}$' }, { seed: 1 })).toMatch(
      /^\d{4}$/,
    );
  });

  it('uses caller-provided field generators before built-in field-name heuristics', () => {
    expect(
      generateMockWithOptions(
        { type: 'object', properties: { tenantId: { type: 'string' } } },
        { fieldGenerators: { tenantid: () => 'tenant-fixed' }, seed: 1 },
      ),
    ).toEqual({ tenantId: 'tenant-fixed' });
  });

  it('uses the configured locale for Faker values', () => {
    const value = generateMockWithOptions(
      { type: 'object', properties: { fullName: { type: 'string' } } },
      { locale: 'ru', seed: 42 },
    );

    expect(value).toMatchObject({ fullName: expect.stringMatching(/[А-Яа-яЁё]/) });
  });

  it('generates a random useful array length within schema constraints', () => {
    const defaultArray = generateMock({ type: 'array', items: { type: 'string' } });
    const minimumArray = generateMock({ type: 'array', minItems: 5, items: { type: 'string' } });

    expect((defaultArray as unknown[]).length).toBeGreaterThanOrEqual(2);
    expect((defaultArray as unknown[]).length).toBeLessThanOrEqual(10);
    expect((minimumArray as unknown[]).length).toBeGreaterThanOrEqual(5);
    expect((minimumArray as unknown[]).length).toBeLessThanOrEqual(10);
    expect(generateMock({ type: 'array', maxItems: 2, items: { type: 'string' } })).toHaveLength(2);
    expect(
      generateMockWithOptions(
        { type: 'array', items: { type: 'string' } },
        { defaultArrayLength: 4, seed: 1 },
      ),
    ).toHaveLength(4);
  });
});
