import { describe, expect, it } from 'vitest';

import { DomainError, toAppError } from '../src/shared/errors';

describe('renderer-safe domain errors', () => {
  it('preserves expected error codes and messages', () => {
    expect(toAppError(new DomainError('SPEC_INVALID', 'Select an OpenAPI file.'))).toEqual({
      code: 'SPEC_INVALID',
      message: 'Select an OpenAPI file.',
    });
  });

  it('does not expose unexpected error details', () => {
    expect(toAppError(new Error('database password: secret'))).toEqual({
      code: 'REQUEST_FAILED',
      message: 'The requested action could not be completed.',
    });
  });
});
