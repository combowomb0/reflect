import { describe, expect, it } from 'vitest';

import { validateMockResponse, validateSaveMockInput } from '../src/shared/ipcValidation';

describe('IPC input validation', () => {
  it('accepts a serializable mock response', () => {
    expect(
      validateSaveMockInput({
        path: '/pets/{id}',
        method: 'GET',
        response: {
          status: 200,
          headers: { 'x-source': 'reflect' },
          body: { id: 'pet-1', active: true, scores: [1, null] },
        },
      }),
    ).toEqual({
      path: '/pets/{id}',
      method: 'GET',
      response: {
        status: 200,
        headers: { 'x-source': 'reflect' },
        body: { id: 'pet-1', active: true, scores: [1, null] },
      },
    });
  });

  it.each([
    undefined,
    { path: 'pets', method: 'GET', response: {} },
    { path: '/pets', method: 'get', response: {} },
    { path: '/pets', method: 'GET', response: { status: 99, headers: {}, body: null } },
    { path: '/pets', method: 'GET', response: { status: 200, headers: { count: 1 }, body: null } },
    { path: '/pets', method: 'GET', response: { status: 200, headers: {}, body: Infinity } },
  ])('rejects malformed renderer input: %j', (input) => {
    expect(() => validateSaveMockInput(input)).toThrow();
  });

  it('rejects non-serializable response bodies before they reach persistence', () => {
    expect(() =>
      validateMockResponse({ status: 200, headers: {}, body: { createdAt: new Date() } }),
    ).toThrow();
  });

  it('rejects malformed conditional variants', () => {
    expect(() =>
      validateMockResponse({
        status: 200,
        headers: {},
        body: null,
        variants: [{ id: 'bad', priority: 1, match: { query: { page: 1 } }, response: {} }],
      }),
    ).toThrow();
  });
});
