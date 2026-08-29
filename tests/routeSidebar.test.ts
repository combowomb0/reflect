import { describe, expect, it } from 'vitest';

import { filterRoutesByName, routeName } from '../src/renderer/src/components/RouteSidebar';
import type { Endpoint } from '../src/shared/types';

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
  it('uses the visible route name for route-only search', () => {
    expect(routeName(endpoints[0]!)).toBe('List pets');
    expect(filterRoutesByName(endpoints, 'create')).toEqual([endpoints[1]]);
    expect(filterRoutesByName(endpoints, 'post')).toEqual([]);
  });
});
