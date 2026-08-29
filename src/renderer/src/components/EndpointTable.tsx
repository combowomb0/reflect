import { Empty, Input, InputNumber, Select, Space, Table, Tag } from 'antd';
import { useDeferredValue, useMemo, useState } from 'react';
import type { ReactElement } from 'react';

import type { Endpoint, HttpMethod } from '../../../shared/types';

interface EndpointTableProps {
  readonly endpoints: readonly Endpoint[];
  readonly selected?: Endpoint;
  readonly onSelect: (endpoint: Endpoint) => void;
}

interface EndpointFilters {
  readonly query: string;
  readonly methods: readonly HttpMethod[];
  readonly tags: readonly string[];
  readonly responseStatus?: number;
}

const httpMethods: readonly HttpMethod[] = [
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'HEAD',
  'OPTIONS',
];

/** Filters endpoints by their searchable contract metadata. */
export function filterEndpoints(
  endpoints: readonly Endpoint[],
  filters: EndpointFilters,
): readonly Endpoint[] {
  const query = filters.query.trim().toLowerCase();
  return endpoints.filter((endpoint) => {
    const matchesQuery =
      !query ||
      endpoint.path.toLowerCase().includes(query) ||
      endpoint.operationId?.toLowerCase().includes(query) ||
      endpoint.summary?.toLowerCase().includes(query);
    const matchesMethod = filters.methods.length === 0 || filters.methods.includes(endpoint.method);
    const matchesTags =
      filters.tags.length === 0 || filters.tags.some((tag) => endpoint.tags.includes(tag));
    const matchesStatus =
      filters.responseStatus === undefined || endpoint.responseStatus === filters.responseStatus;
    return matchesQuery && matchesMethod && matchesTags && matchesStatus;
  });
}

/** Displays endpoint contract metadata with local filters that do not change selected state. */
export function EndpointTable({ endpoints, selected, onSelect }: EndpointTableProps): ReactElement {
  const [filters, setFilters] = useState<EndpointFilters>({ query: '', methods: [], tags: [] });
  const deferredFilters = useDeferredValue(filters);
  const tags = useMemo(
    () => [...new Set(endpoints.flatMap((endpoint) => endpoint.tags))].sort(),
    [endpoints],
  );
  const filteredEndpoints = useMemo(
    () => filterEndpoints(endpoints, deferredFilters),
    [deferredFilters, endpoints],
  );

  return (
    <Space direction="vertical" size="middle" className="endpoint-table">
      <Space wrap>
        <Input
          aria-label="Search endpoints"
          allowClear
          placeholder="Search path or operation"
          value={filters.query}
          onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))}
        />
        <Select
          aria-label="Filter HTTP methods"
          mode="multiple"
          allowClear
          placeholder="Methods"
          options={httpMethods.map((method) => ({ label: method, value: method }))}
          value={[...filters.methods]}
          onChange={(methods: HttpMethod[]) => setFilters((current) => ({ ...current, methods }))}
        />
        <Select
          aria-label="Filter tags"
          mode="multiple"
          allowClear
          placeholder="Tags"
          options={tags.map((tag) => ({ label: tag, value: tag }))}
          value={[...filters.tags]}
          onChange={(selectedTags: string[]) =>
            setFilters((current) => ({ ...current, tags: selectedTags }))
          }
        />
        <InputNumber
          aria-label="Filter response status"
          min={100}
          max={599}
          placeholder="Status"
          value={filters.responseStatus}
          onChange={(responseStatus) =>
            setFilters((current) => ({
              ...current,
              ...(responseStatus === null ? { responseStatus: undefined } : { responseStatus }),
            }))
          }
        />
      </Space>
      <Table
        dataSource={filteredEndpoints}
        pagination={{ pageSize: 8 }}
        rowKey="id"
        rowClassName={(endpoint) => (endpoint.id === selected?.id ? 'selected-endpoint' : '')}
        onRow={(endpoint) => ({
          tabIndex: 0,
          onClick: () => onSelect(endpoint),
          onKeyDown: (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              onSelect(endpoint);
            }
          },
          'aria-label': `Select ${endpoint.method} ${endpoint.path}`,
        })}
        locale={{
          emptyText: (
            <Empty
              description="No endpoints match these filters."
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          ),
        }}
        columns={[
          {
            title: 'Method',
            dataIndex: 'method',
            width: 100,
            render: (method: string) => <Tag>{method}</Tag>,
          },
          { title: 'Path', dataIndex: 'path' },
          { title: 'Operation ID', dataIndex: 'operationId' },
          { title: 'Summary', dataIndex: 'summary' },
          { title: 'Status', dataIndex: 'responseStatus', width: 90 },
        ]}
      />
    </Space>
  );
}
