import { Alert, Button, Modal, Space, Typography } from 'antd';
import { useState } from 'react';
import type { ReactElement } from 'react';

import type { MockImportPreview, MockMap } from '../../../shared/types';

interface MockTransferProps {
  readonly hasSpecification: boolean;
  readonly onImported: (mockMap: MockMap) => void;
}

/** Imports and exports complete versioned mock maps through main-process file dialogs. */
export function MockTransfer({ hasSpecification, onImported }: MockTransferProps): ReactElement {
  const [preview, setPreview] = useState<MockImportPreview>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState<string>();

  async function previewImport(): Promise<void> {
    setBusy(true);
    setError(undefined);
    setMessage(undefined);
    const result = await window.reflect.previewMockImport();
    setBusy(false);
    if (!result.ok) {
      setError(result.error.message);
    } else if (result.value) {
      setPreview(result.value);
    }
  }

  async function confirmImport(): Promise<void> {
    setBusy(true);
    const result = await window.reflect.importMocks();
    setBusy(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    onImported(result.value);
    setPreview(undefined);
    setMessage('Mock responses imported.');
  }

  async function exportMocks(): Promise<void> {
    setBusy(true);
    setError(undefined);
    setMessage(undefined);
    const result = await window.reflect.exportMocks();
    setBusy(false);
    if (!result.ok) {
      setError(result.error.message);
    } else if (result.value) {
      setMessage(`Mock responses exported to ${result.value}.`);
    }
  }

  return (
    <>
      <Space direction="vertical" size="small" className="mock-transfer">
        <Space wrap>
          <Button
            disabled={!hasSpecification || busy}
            loading={busy}
            onClick={() => void previewImport()}
          >
            Import mocks
          </Button>
          <Button
            disabled={!hasSpecification || busy}
            loading={busy}
            onClick={() => void exportMocks()}
          >
            Export mocks
          </Button>
        </Space>
        {error ? <Alert message={error} type="error" showIcon /> : null}
        {message ? <Alert message={message} type="success" showIcon /> : null}
      </Space>
      <Modal
        open={Boolean(preview)}
        title="Replace active mocks?"
        okText="Replace mocks"
        confirmLoading={busy}
        onCancel={() => setPreview(undefined)}
        onOk={() => void confirmImport()}
      >
        {preview ? (
          <Space direction="vertical">
            <Typography.Paragraph>
              Import {preview.responseCount} response{preview.responseCount === 1 ? '' : 's'} across{' '}
              {preview.routeCount} route{preview.routeCount === 1 ? '' : 's'}?
            </Typography.Paragraph>
            <Typography.Text type="secondary">Source: {preview.sourceSpecPath}</Typography.Text>
            <Typography.Text type="danger">
              This replaces all active mock responses.
            </Typography.Text>
          </Space>
        ) : null}
      </Modal>
    </>
  );
}
