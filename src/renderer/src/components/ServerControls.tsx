import { Alert, Button, InputNumber, Space, Tag, Typography } from 'antd';
import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';

import type { ServerStatus } from '../../../shared/types';

interface ServerControlsProps {
  readonly hasSpecification: boolean;
  readonly status: ServerStatus;
  readonly onStatusChange: (status: ServerStatus) => void;
}

/** Starts and stops the active mock server with a validated, persisted port preference. */
export function ServerControls({
  hasSpecification,
  status,
  onStatusChange,
}: ServerControlsProps): ReactElement {
  const [port, setPort] = useState(31247);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    void window.reflect.getSettings().then((result) => {
      if (result.ok) {
        setPort(result.value.port);
      } else {
        setError(result.error.message);
      }
      setLoadingSettings(false);
    });
  }, []);

  async function toggleServer(): Promise<void> {
    setBusy(true);
    setError(undefined);
    const result =
      status.state === 'running'
        ? await window.reflect.stopServer()
        : await window.reflect.startServer(port);
    setBusy(false);

    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    onStatusChange(result.value);
  }

  const isRunning = status.state === 'running';
  const address = isRunning && status.port ? `http://127.0.0.1:${status.port}` : undefined;
  const disabled = !hasSpecification || loadingSettings || busy;

  return (
    <Space direction="vertical" size="small" className="server-controls">
      <Space wrap>
        <Typography.Text>Port</Typography.Text>
        <InputNumber
          aria-label="Mock server port"
          min={1}
          max={65535}
          value={port}
          disabled={disabled || isRunning}
          onChange={(value) => setPort(value ?? 31247)}
        />
        <Button
          type={isRunning ? 'default' : 'primary'}
          disabled={disabled}
          loading={busy}
          onClick={() => void toggleServer()}
        >
          {isRunning ? 'Stop server' : 'Start server'}
        </Button>
        <Tag color={isRunning ? 'green' : status.state === 'error' ? 'red' : 'default'}>
          {status.state}
        </Tag>
      </Space>
      {!hasSpecification ? (
        <Typography.Text type="secondary">
          Open a specification to start the server.
        </Typography.Text>
      ) : null}
      {address ? <Typography.Text copyable>{address}</Typography.Text> : null}
      {error ? <Alert message={error} type="error" showIcon /> : null}
    </Space>
  );
}
