import { Empty } from 'antd';
import type { FC } from 'react';

import { useAppStore } from '../../store/useAppStore';
import { RouteSidebar } from './RouteSidebar';
import { MockEditor } from './MockEditor';
import styles from './RoutesPage.module.scss';

export const RoutesPage: FC = () => {
  const hasEndpoints = useAppStore((state) => !!state.endpoints.length);
  const hasSpecifications = useAppStore((state) => !!state.specs.length);
  const hasSelectedEndpoint = useAppStore((state) => !!state.selected);

  if (!hasEndpoints) {
    return (
      <Empty
        description={
          hasSpecifications
            ? 'These specifications have no supported HTTP operations'
            : 'Add an OpenAPI specification to start mocking'
        }
      />
    );
  }

  return (
    <div className={styles.workspace}>
      <RouteSidebar />
      <main className={styles.editor}>
        {hasSelectedEndpoint ? (
          <MockEditor />
        ) : (
          <Empty description="Select a route to edit its mock response" />
        )}
      </main>
    </div>
  );
};
