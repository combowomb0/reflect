import { Button, Empty, Layout, Space, Tabs, Tag, Typography } from 'antd';
import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import type {
  AppLocale,
  Endpoint,
  LoadedSpec,
  MockMap,
  MockResponse,
  RequestLogEntry,
  ServerStatus,
} from '../../shared/types';
import { ErrorState } from './components/ErrorState';
import { GenerationControls } from './components/GenerationControls';
import { MockEditor } from './components/MockEditor';
import { MockTransfer } from './components/MockTransfer';
import { RequestLog } from './components/RequestLog';
import { RouteSidebar } from './components/RouteSidebar';
import { ServerControls } from './components/ServerControls';

type AppState = {
  readonly version?: string;
  readonly endpoints: readonly Endpoint[];
  readonly specs: readonly LoadedSpec[];
  readonly serverStatus: ServerStatus;
  readonly mocks: readonly MockMap[];
  readonly selected?: Endpoint;
  readonly requestLog: readonly RequestLogEntry[];
  readonly mockSeed?: number;
  readonly locale: AppLocale;
  readonly error?: string;
  readonly loading: boolean;
};

const initialState: AppState = {
  endpoints: [],
  specs: [],
  serverStatus: { state: 'stopped' },
  mocks: [],
  requestLog: [],
  locale: 'en',
  loading: false,
};

export function App(): ReactElement {
  const [state, setState] = useState<AppState>(initialState);

  useEffect(() => {
    void window.reflect.getAppVersion().then((result) => {
      if (result.ok) setState((current) => ({ ...current, version: result.value }));
    });
    void window.reflect.getServerStatus().then((result) => {
      if (result.ok) setState((current) => ({ ...current, serverStatus: result.value }));
    });
    void window.reflect.getSettings().then((result) => {
      if (result.ok) {
        setState((current) => ({
          ...current,
          mockSeed: result.value.mockSeed,
          locale: result.value.locale ?? 'en',
        }));
      }
    });
    const refreshRequestLog = (): void => {
      void window.reflect.listRequestLog().then((result) => {
        if (result.ok) setState((current) => ({ ...current, requestLog: result.value }));
      });
    };
    refreshRequestLog();
    const interval = window.setInterval(refreshRequestLog, 1_000);
    return () => window.clearInterval(interval);
  }, []);

  async function openSpec(): Promise<void> {
    setState((current) => ({ ...current, loading: true, error: undefined }));
    const result = await window.reflect.openSpec();
    const workspace = result.ok ? result.value : undefined;
    if (!workspace) {
      setState((current) => ({
        ...current,
        loading: false,
        error: result.ok ? undefined : result.error.message,
      }));
      return;
    }
    const mocks = await window.reflect.listMocks();
    setState((current) => ({
      ...current,
      loading: false,
      endpoints: workspace.specs.flatMap((spec) => spec.endpoints),
      specs: workspace.specs,
      mocks: mocks.ok ? mocks.value : [],
      selected: workspace.specs.flatMap((spec) => spec.endpoints)[0],
    }));
  }

  function selectEndpoint(endpoint: Endpoint): void {
    setState((current) => ({
      ...current,
      selected: endpoint,
      error: undefined,
    }));
  }

  async function saveMock(response: MockResponse): Promise<string | undefined> {
    if (!state.selected) return 'Select an endpoint before saving.';

    const result = await window.reflect.saveMock({
      path: state.selected.path,
      method: state.selected.method,
      response,
    });
    if (!result.ok) return result.error.message;

    setState((current) => ({
      ...current,
      mocks: [
        ...current.mocks.filter((mockMap) => mockMap.specPath !== result.value.specPath),
        result.value,
      ],
      error: undefined,
    }));
    return undefined;
  }

  async function saveMockSeed(seed: number | undefined): Promise<string | undefined> {
    const result = await window.reflect.saveMockSeed(seed);
    if (!result.ok) return result.error.message;

    setState((current) => ({ ...current, mockSeed: result.value.mockSeed }));
    return undefined;
  }

  async function saveAppLocale(locale: AppLocale): Promise<string | undefined> {
    const result = await window.reflect.saveAppLocale(locale);
    if (!result.ok) return result.error.message;

    setState((current) => ({ ...current, locale: result.value.locale ?? 'en' }));
    return undefined;
  }

  return (
    <Layout className="app-shell">
      <Layout.Header className="app-header">
        <div>
          <Typography.Title level={3}>Reflect</Typography.Title>
          <Typography.Text type="secondary">OpenAPI mock workspace {state.version}</Typography.Text>
        </div>
        <Space wrap>
          <Tag color={state.serverStatus.state === 'running' ? 'green' : 'default'}>
            {state.serverStatus.state}
            {state.serverStatus.port ? ` :${state.serverStatus.port}` : ''}
          </Tag>
          <Button type="primary" loading={state.loading} onClick={() => void openSpec()}>
            Add specifications
          </Button>
        </Space>
      </Layout.Header>
      <Layout.Content className="app-content">
        {state.error ? <ErrorState message={state.error} onRetry={() => void openSpec()} /> : null}
        <Tabs
          items={[
            {
              key: 'routes',
              label: 'Routes',
              children:
                state.endpoints.length > 0 ? (
                  <div className="route-workspace">
                    <RouteSidebar
                      endpoints={state.endpoints}
                      selected={state.selected}
                      onSelect={selectEndpoint}
                    />
                    <main className="route-editor">
                      {state.selected ? (
                        <MockEditor
                          endpoint={state.selected}
                          seed={state.mockSeed}
                          locale={state.locale}
                          mockResponse={
                            state.mocks.find(
                              (mockMap) =>
                                state.selected &&
                                mockMap.mocks[state.selected.path]?.[state.selected.method],
                            )?.mocks[state.selected.path]?.[state.selected.method]
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
                      state.specs.length > 0
                        ? 'These specifications have no supported HTTP operations.'
                        : 'Add an OpenAPI specification to start mocking.'
                    }
                  />
                ),
            },
            {
              key: 'log',
              label: 'Request log',
              children: <RequestLog entries={state.requestLog} />,
            },
            {
              key: 'settings',
              label: 'Settings',
              children: (
                <Space direction="vertical" size="large" className="settings-panel">
                  <ServerControls
                    hasSpecification={state.specs.length > 0}
                    status={state.serverStatus}
                    onStatusChange={(serverStatus) =>
                      setState((current) => ({ ...current, serverStatus, error: undefined }))
                    }
                  />
                  <GenerationControls
                    seed={state.mockSeed}
                    locale={state.locale}
                    onSave={saveMockSeed}
                    onSaveLocale={saveAppLocale}
                  />
                  <MockTransfer
                    hasSpecification={state.specs.length > 0}
                    onImported={(mocks) =>
                      setState((current) => ({
                        ...current,
                        mocks: [
                          ...current.mocks.filter((mockMap) => mockMap.specPath !== mocks.specPath),
                          mocks,
                        ],
                        error: undefined,
                      }))
                    }
                  />
                  {state.specs.length > 0 ? (
                    <Space direction="vertical" size={0}>
                      <Typography.Text strong>Loaded specifications</Typography.Text>
                      {state.specs.map((spec) => (
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
