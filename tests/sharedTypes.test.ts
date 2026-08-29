import { describe, expect, it } from 'vitest';

import type { LoadedWorkspace, MockMap, Result } from '../src/shared/types';

describe('shared contracts', () => {
  it('models a versioned mock map keyed by path and uppercase method', () => {
    const mockMap: MockMap = {
      version: 1,
      specPath: '/tmp/openapi.yaml',
      mocks: {
        '/users/{id}': {
          GET: { status: 200, headers: {}, body: { id: 'user-1' } },
        },
      },
    };

    expect(mockMap.mocks['/users/{id}']?.GET?.status).toBe(200);
  });

  it('uses a serializable result shape for preload APIs', () => {
    const result: Result<string> = { ok: true, value: '0.1.0' };

    expect(result).toEqual({ ok: true, value: '0.1.0' });
  });

  it('models multiple independently loaded specifications', () => {
    const workspace: LoadedWorkspace = {
      specs: [
        { path: '/tmp/base.yaml', endpoints: [] },
        { path: '/tmp/billing.yaml', endpoints: [] },
      ],
    };

    expect(workspace.specs).toHaveLength(2);
  });
});
