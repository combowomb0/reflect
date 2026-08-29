import { Empty, Card, Table, Tag } from 'antd';
import { FC } from 'react';

import { useAppStore } from '../../store/useAppStore';

export const RequestLogPage: FC = () => {
  const requestLog = useAppStore((state) => state.requestLog);

  if (!requestLog.length) {
    return <Empty description="Requests to the running mock server appear here" />;
  }

  return (
    <Card size="small">
      <Table
        size="small"
        pagination={{ pageSize: 8 }}
        dataSource={[...requestLog].reverse()}
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
    </Card>
  );
};
