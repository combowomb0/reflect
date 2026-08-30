import { Empty, Input, Tag, Typography } from 'antd';
import { useDeferredValue, useMemo, useState } from 'react';
import type { FC } from 'react';

import type { Endpoint } from '../../../../shared/types';
import { useAppStore } from '../../store/useAppStore';
import styles from './RouteSidebar.module.scss';

export const RouteSidebar: FC = () => {
  const endpoints = useAppStore((state) => state.endpoints);
  const selected = useAppStore((state) => state.selected);
  const onSelect = useAppStore((state) => state.selectEndpoint);
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);

  const routes = useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toLowerCase();
    if (!normalizedQuery) return endpoints;

    const routeName = (endpoint: Endpoint) => {
      return endpoint.summary ?? endpoint.operationId ?? endpoint.path;
    };

    return endpoints.filter((endpoint) =>
      [routeName(endpoint), endpoint.summary, endpoint.operationId, endpoint.path, endpoint.method]
        .filter((value): value is string => Boolean(value))
        .some((value) => value.toLowerCase().includes(normalizedQuery)),
    );
  }, [deferredQuery, endpoints]);

  return (
    <aside className={styles.sidebar} aria-label="Routes">
      <Input
        allowClear
        placeholder="Search..."
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <nav className={styles.list} aria-label="Available routes">
        {routes.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No matching routes" />
        ) : (
          routes.map((endpoint) => {
            const isSelected = endpoint.id === selected?.id;
            return (
              <button
                key={endpoint.id}
                type="button"
                className={`${styles.item}${isSelected ? ` ${styles.selected}` : ''}`}
                aria-current={isSelected ? 'page' : undefined}
                onClick={() => onSelect(endpoint)}
              >
                <Tag className={styles.method}>{endpoint.method}</Tag>
                <Typography.Text ellipsis title={endpoint.path}>
                  {endpoint.path}
                </Typography.Text>
              </button>
            );
          })
        )}
      </nav>
    </aside>
  );
};
