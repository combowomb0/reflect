import { describe, expect, it } from 'vitest';

import { useAppStore } from '../src/renderer/src/store/useAppStore';

describe('renderer app store', () => {
  it('loads a workspace, selects its first endpoint, and replaces only its updated mock map', () => {
    const endpoint = {
      id: 'GET /pets',
      path: '/pets',
      method: 'GET' as const,
      tags: [],
      responseStatus: 200,
    };
    const workspace = { specs: [{ path: '/tmp/pets.yaml', endpoints: [endpoint] }] };
    const initialMap = { version: 1 as const, specPath: '/tmp/pets.yaml', mocks: {} };
    const updatedMap = {
      version: 1 as const,
      specPath: '/tmp/pets.yaml',
      mocks: { '/pets': { GET: { status: 200, headers: {}, body: [] } } },
    };

    useAppStore.getState().loadWorkspace(workspace, [initialMap]);
    useAppStore.getState().replaceMock(updatedMap);

    expect(useAppStore.getState().selected).toEqual(endpoint);
    expect(useAppStore.getState().mocks).toEqual([updatedMap]);
  });
});
