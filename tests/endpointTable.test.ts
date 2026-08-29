import { describe, expect, it } from 'vitest';
import { performance } from 'node:perf_hooks';

import { filterEndpoints } from '../src/renderer/src/components/EndpointTable';
import type { Endpoint } from '../src/shared/types';

const endpoints: readonly Endpoint[] = [
  {
    id: 'GET /pets',
    path: '/pets',
    method: 'GET',
    operationId: 'listPets',
    summary: 'List pets',
    tags: ['pets'],
    responseStatus: 200,
  },
  {
    id: 'POST /pets',
    path: '/pets',
    method: 'POST',
    operationId: 'createPet',
    tags: ['pets', 'write'],
    responseStatus: 201,
  },
  {
    id: 'GET /users',
    path: '/users',
    method: 'GET',
    operationId: 'listUsers',
    tags: ['users'],
    responseStatus: 200,
  },
];

describe('endpoint filters', () => {
  it('filters by path or operation ID', () => {
    expect(filterEndpoints(endpoints, { query: 'createpet', methods: [], tags: [] })).toEqual([
      endpoints[1],
    ]);
  });

  it('combines method, tag, and status filters', () => {
    expect(
      filterEndpoints(endpoints, {
        query: '',
        methods: ['POST'],
        tags: ['write'],
        responseStatus: 201,
      }),
    ).toEqual([endpoints[1]]);
  });

  it('filters a large endpoint collection without reprocessing unrelated results', () => {
    const largeEndpointList: Endpoint[] = Array.from({ length: 5_000 }, (_, index) => ({
      id: `GET /resources/${index}`,
      path: `/resources/${index}`,
      method: 'GET',
      operationId: `getResource${index}`,
      tags: index % 2 === 0 ? ['even'] : ['odd'],
      responseStatus: 200,
    }));
    const startedAt = performance.now();
    const result = filterEndpoints(largeEndpointList, {
      query: 'resource4999',
      methods: ['GET'],
      tags: ['odd'],
    });

    expect(result).toHaveLength(1);
    expect(performance.now() - startedAt).toBeLessThan(500);
  });
});
