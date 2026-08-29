import { Empty, Input, Tag } from 'antd';
import { useDeferredValue, useMemo, useState } from 'react';
import type { ReactElement } from 'react';

import type { Endpoint } from '../../../shared/types';

interface RouteSidebarProps {
  readonly endpoints: readonly Endpoint[];
  readonly selected?: Endpoint;
  readonly onSelect: (endpoint: Endpoint) => void;
}

/** Returns the concise human-readable name used in the route navigation. */
export function routeName(endpoint: Endpoint): string {
  return endpoint.summary ?? endpoint.operationId ?? endpoint.path;
}

/** Filters routes exclusively by their visible route name. */
export function filterRoutesByName(
  endpoints: readonly Endpoint[],
  query: string,
): readonly Endpoint[] {
  const normalizedQuery = query.trim().toLowerCase();
  return normalizedQuery
    ? endpoints.filter((endpoint) => routeName(endpoint).toLowerCase().includes(normalizedQuery))
    : endpoints;
}

/** Keyboard-accessible route navigation for the primary mock editing workspace. */
export function RouteSidebar({ endpoints, selected, onSelect }: RouteSidebarProps): ReactElement {
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const routes = useMemo(
    () => filterRoutesByName(endpoints, deferredQuery),
    [deferredQuery, endpoints],
  );

  return (
    <aside className="route-sidebar" aria-label="Routes">
      <Input
        allowClear
        placeholder="Search..."
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <nav className="route-list" aria-label="Available routes">
        {routes.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No matching routes" />
        ) : (
          routes.map((endpoint) => {
            const isSelected = endpoint.id === selected?.id;
            return (
              <button
                key={endpoint.id}
                type="button"
                className={`route-item${isSelected ? ' route-item-selected' : ''}`}
                aria-current={isSelected ? 'page' : undefined}
                onClick={() => onSelect(endpoint)}
              >
                <Tag className="route-method">{endpoint.method}</Tag>
                <span className="route-path">{endpoint.path}</span>
              </button>
            );
          })
        )}
      </nav>
    </aside>
  );
}
