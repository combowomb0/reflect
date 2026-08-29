import { Button, Flex, Layout, Tag, Typography } from 'antd';
import { FC, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import styles from './Header.module.scss';

export const Header: FC = () => {
  const loading = useAppStore((state) => state.loading);
  const version = useAppStore((state) => state.version);
  const hasSpecification = useAppStore((state) => !!state.specs.length);
  const status = useAppStore((state) => state.serverStatus);
  const port = useAppStore((state) => state.port);
  const setServerStatus = useAppStore((state) => state.setServerStatus);

  const setLoading = useAppStore((state) => state.setLoading);
  const setError = useAppStore((state) => state.setError);
  const loadWorkspace = useAppStore((state) => state.loadWorkspace);
  const [serverBusy, setServerBusy] = useState(false);
  const [serverError, setServerError] = useState<string>();

  const openSpec = async () => {
    setLoading(true);
    setError(undefined);

    const result = await window.reflect.openSpec();
    const workspace = result.ok ? result.value : undefined;

    if (!workspace) {
      setLoading(false);
      setError(result.ok ? undefined : result.error.message);
      return;
    }

    const mocks = await window.reflect.listMocks();

    loadWorkspace(workspace, mocks.ok ? mocks.value : []);
  };

  const toggleServer = async (): Promise<void> => {
    setServerBusy(true);
    setServerError(undefined);
    const result =
      status.state === 'running'
        ? await window.reflect.stopServer()
        : await window.reflect.startServer(port);
    setServerBusy(false);
    if (!result.ok) {
      setServerError(result.error.message);
      return;
    }
    setServerStatus(result.value);
  };

  return (
    <Layout.Header className={styles.header}>
      <Flex className={styles.header_content}>
        <Flex vertical>
          <Typography.Title level={3}>Reflect</Typography.Title>
          <Typography.Text type="secondary">OpenAPI mock workspace {version}</Typography.Text>
        </Flex>
        <Flex align="center" gap="small" wrap>
          <Tag
            color={
              status.state === 'running' ? 'green' : status.state === 'error' ? 'red' : 'default'
            }
          >
            {status.state}
          </Tag>
          <Button
            type={status.state === 'running' ? 'default' : 'primary'}
            disabled={!hasSpecification || serverBusy}
            loading={serverBusy}
            onClick={() => void toggleServer()}
          >
            {status.state === 'running' ? 'Stop server' : 'Start server'}
          </Button>
          {serverError ? <Typography.Text type="danger">{serverError}</Typography.Text> : null}
          <Button type="primary" loading={loading} onClick={openSpec}>
            Import
          </Button>
        </Flex>
      </Flex>
    </Layout.Header>
  );
};
