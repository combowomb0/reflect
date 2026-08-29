import { Button, Empty, Layout, Space, Tabs, Tag, Typography } from 'antd';
import { useEffect } from 'react';
import type { ReactElement } from 'react';
import type { AppLocale, MockResponse } from '../../shared/types';
import { ErrorState } from './components/ErrorState';
import { GenerationControls } from './components/GenerationControls';
import { MockEditor } from './components/MockEditor';
import { MockTransfer } from './components/MockTransfer';
import { RequestLog } from './components/RequestLog';
import { RouteSidebar } from './components/RouteSidebar';
import { ServerControls } from './components/ServerControls';
import { useAppStore } from './store/useAppStore';

export function App(): ReactElement {
  const version = useAppStore((state) => state.version);
  const endpoints = useAppStore((state) => state.endpoints);
  const specs = useAppStore((state) => state.specs);
  const serverStatus = useAppStore((state) => state.serverStatus);
  const mocks = useAppStore((state) => state.mocks);
  const selected = useAppStore((state) => state.selected);
  const requestLog = useAppStore((state) => state.requestLog);
  const mockSeed = useAppStore((state) => state.mockSeed);
  const locale = useAppStore((state) => state.locale);
  const error = useAppStore((state) => state.error);
  const loading = useAppStore((state) => state.loading);
  const setVersion = useAppStore((state) => state.setVersion);
  const setServerStatus = useAppStore((state) => state.setServerStatus);
  const setRequestLog = useAppStore((state) => state.setRequestLog);
  const setSettings = useAppStore((state) => state.setSettings);
  const setLoading = useAppStore((state) => state.setLoading);
  const setError = useAppStore((state) => state.setError);
  const loadWorkspace = useAppStore((state) => state.loadWorkspace);
  const selectEndpoint = useAppStore((state) => state.selectEndpoint);
  const replaceMock = useAppStore((state) => state.replaceMock);

  useEffect(() => {
    void window.reflect.getAppVersion().then((result) => {
      if (result.ok) setVersion(result.value);
    });
    void window.reflect.getServerStatus().then((result) => {
      if (result.ok) setServerStatus(result.value);
    });
    void window.reflect.getSettings().then((result) => {
      if (result.ok) {
        setSettings(result.value);
      }
    });
    const refreshRequestLog = (): void => {
      void window.reflect.listRequestLog().then((result) => {
        if (result.ok) setRequestLog(result.value);
      });
    };
    refreshRequestLog();
    const interval = window.setInterval(refreshRequestLog, 1_000);
    return () => window.clearInterval(interval);
  }, [setRequestLog, setServerStatus, setSettings, setVersion]);

  async function openSpec(): Promise<void> {
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
  }

  async function saveMock(response: MockResponse): Promise<string | undefined> {
    if (!selected) return 'Select an endpoint before saving.';

    const result = await window.reflect.saveMock({
      path: selected.path,
      method: selected.method,
      response,
    });
    if (!result.ok) return result.error.message;

    replaceMock(result.value);
    return undefined;
  }

  async function saveMockSeed(seed: number | undefined): Promise<string | undefined> {
    const result = await window.reflect.saveMockSeed(seed);
    if (!result.ok) return result.error.message;

    setSettings(result.value);
    return undefined;
  }

  async function saveAppLocale(locale: AppLocale): Promise<string | undefined> {
    const result = await window.reflect.saveAppLocale(locale);
    if (!result.ok) return result.error.message;

    setSettings(result.value);
    return undefined;
  }

  return (
    <Layout className="app-shell">
      <Layout.Header className="app-header">
        <div>
          <Typography.Title level={3}>Reflect</Typography.Title>
          <Typography.Text type="secondary">OpenAPI mock workspace {version}</Typography.Text>
        </div>
        <Space wrap>
          <Tag color={serverStatus.state === 'running' ? 'green' : 'default'}>
            {serverStatus.state}
            {serverStatus.port ? ` :${serverStatus.port}` : ''}
          </Tag>
          <Button type="primary" loading={loading} onClick={() => void openSpec()}>
            Add specifications
          </Button>
        </Space>
      </Layout.Header>
      <Layout.Content className="app-content">
        {error ? <ErrorState message={error} onRetry={() => void openSpec()} /> : null}
        <Tabs
          items={[
            {
              key: 'routes',
              label: 'Routes',
              children:
                endpoints.length > 0 ? (
                  <div className="route-workspace">
                    <RouteSidebar
                      endpoints={endpoints}
                      selected={selected}
                      onSelect={selectEndpoint}
                    />
                    <main className="route-editor">
                      {selected ? (
                        <MockEditor
                          endpoint={selected}
                          seed={mockSeed}
                          locale={locale}
                          mockResponse={
                            mocks.find((mockMap) => mockMap.mocks[selected.path]?.[selected.method])
                              ?.mocks[selected.path]?.[selected.method]
                          }
                          onSave={saveMock}
                        />
                      ) : (
                        <Empty description="Select a route to edit its mock response." />
                      )}
                    </main>
                  </div>
                ) : (
                  <Empty
                    description={
                      specs.length > 0
                        ? 'These specifications have no supported HTTP operations.'
                        : 'Add an OpenAPI specification to start mocking.'
                    }
                  />
                ),
            },
            {
              key: 'log',
              label: 'Request log',
              children: <RequestLog entries={requestLog} />,
            },
            {
              key: 'settings',
              label: 'Settings',
              children: (
                <Space direction="vertical" size="large" className="settings-panel">
                  <ServerControls
                    hasSpecification={specs.length > 0}
                    status={serverStatus}
                    onStatusChange={setServerStatus}
                  />
                  <GenerationControls
                    seed={mockSeed}
                    locale={locale}
                    onSave={saveMockSeed}
                    onSaveLocale={saveAppLocale}
                  />
                  <MockTransfer hasSpecification={specs.length > 0} onImported={replaceMock} />
                  {specs.length > 0 ? (
                    <Space direction="vertical" size={0}>
                      <Typography.Text strong>Loaded specifications</Typography.Text>
                      {specs.map((spec) => (
                        <Typography.Text key={spec.path} type="secondary">
                          {spec.path}
                        </Typography.Text>
                      ))}
                    </Space>
                  ) : null}
                </Space>
              ),
            },
          ]}
        />
      </Layout.Content>
    </Layout>
  );
}
