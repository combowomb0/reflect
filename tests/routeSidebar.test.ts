import { describe, expect, it } from 'vitest';

import type { Endpoint } from '../src/shared/types';
import { routeName, filterRoutesByName } from '../src/renderer/src/pages/RoutesPage/RouteSidebar';

const endpoints: readonly Endpoint[] = [
  {
    id: 'GET /pets',
    path: '/pets',
    method: 'GET',
    summary: 'List pets',
    tags: [],
    responseStatus: 200,
  },
  {
    id: 'POST /pets',
    path: '/pets',
    method: 'POST',
    operationId: 'createPet',
    tags: [],
    responseStatus: 201,
  },
];

describe('route sidebar', () => {
  it('searches route summaries, operation IDs, paths, and HTTP methods', () => {
    expect(routeName(endpoints[0]!)).toBe('List pets');
    expect(filterRoutesByName(endpoints, 'create')).toEqual([endpoints[1]]);
    expect(filterRoutesByName(endpoints, '/pets')).toEqual(endpoints);
    expect(filterRoutesByName(endpoints, 'post')).toEqual([endpoints[1]]);
    expect(filterRoutesByName(endpoints, 'get')).toEqual([endpoints[0]]);
  });
});
