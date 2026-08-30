import { Alert, Layout, Tabs } from 'antd';
import { useEffect } from 'react';
import type { FC } from 'react';
import { RequestLogPage, RoutesPage, SettingsPage } from './pages';
import { useAppStore } from './store/useAppStore';
import { Header } from './layout';
import styles from './App.module.scss';

export const App: FC = () => {
  const error = useAppStore((state) => state.error);
  const setVersion = useAppStore((state) => state.setVersion);
  const setServerStatus = useAppStore((state) => state.setServerStatus);
  const setRequestLog = useAppStore((state) => state.setRequestLog);
  const setSettings = useAppStore((state) => state.setSettings);

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

  return (
    <Layout className={styles.shell}>
      <Header />
      <Layout.Content className={styles.content}>
        {error ? <Alert title={error} type="error" showIcon closable /> : null}
        <Tabs
          size="large"
          items={[
            {
              key: 'routes',
              label: 'Routes',
              children: <RoutesPage />,
            },
            {
              key: 'log',
              label: 'Request log',
              children: <RequestLogPage />,
            },
            {
              key: 'settings',
              label: 'Settings',
              children: <SettingsPage />,
            },
          ]}
        />
      </Layout.Content>
    </Layout>
  );
};
