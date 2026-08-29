import { Card, Table, Tag, Typography } from 'antd';
import type { ReactElement } from 'react';

import type { RequestLogEntry } from '../../../shared/types';

interface RequestLogProps {
  readonly entries: readonly RequestLogEntry[];
}

/** Displays safe local mock-server request diagnostics with no request body or headers. */
export function RequestLog({ entries }: RequestLogProps): ReactElement {
  return (
    <Card size="small" title="Request log" className="request-log">
      {entries.length === 0 ? (
        <Typography.Text type="secondary">
          Requests to the running mock server appear here.
        </Typography.Text>
      ) : (
        <Table
          size="small"
          pagination={{ pageSize: 8 }}
          dataSource={[...entries].reverse()}
          rowKey={(entry) => `${entry.timestamp}-${entry.method}-${entry.path}`}
          columns={[
            {
              title: 'Time',
              dataIndex: 'timestamp',
              render: (value: string) => new Date(value).toLocaleTimeString(),
            },
            { title: 'Method', dataIndex: 'method', render: (value: string) => <Tag>{value}</Tag> },
            { title: 'Path', dataIndex: 'path' },
            { title: 'Status', dataIndex: 'status' },
            {
              title: 'Duration',
              dataIndex: 'durationMs',
              render: (value: number) => `${value} ms`,
            },
          ]}
        />
      )}
    </Card>
  );
}
