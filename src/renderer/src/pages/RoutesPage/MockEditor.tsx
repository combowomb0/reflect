import { Alert, Button, Divider, Flex, Input, InputNumber, Space, Tag, Typography } from 'antd';
import { useEffect, useState } from 'react';
import type { FC } from 'react';

import { generateMock, generateMockWithOptions } from '../../../../shared/mockGenerator';
import { validateMockResponse } from '../../../../shared/ipcValidation';
import type { AppLocale, Endpoint, MockResponse } from '../../../../shared/types';
import { useAppStore } from '../../store/useAppStore';
import styles from './MockEditor.module.scss';

interface DraftResponse {
  readonly status: number | null;
  readonly headers: string;
  readonly body: string;
  readonly variants: string;
}

type DraftValidation =
  | { readonly ok: true; readonly value: MockResponse }
  | { readonly ok: false; readonly error: string };

export const MockEditor: FC = () => {
  const endpoint = useAppStore((state) => state.selected)!;
  const mockResponse = useAppStore((state) => {
    if (!state.selected) return undefined;
    return state.mocks.find(
      (mockMap) => mockMap.mocks[state.selected!.path]?.[state.selected!.method],
    )?.mocks[state.selected.path]?.[state.selected.method];
  });
  const seed = useAppStore((state) => state.mockSeed);
  const locale = useAppStore((state) => state.locale);
  const replaceMock = useAppStore((state) => state.replaceMock);
  const [saveError, setSaveError] = useState<string>();

  async function onSave(response: MockResponse): Promise<string | undefined> {
    const result = await window.reflect.saveMock({
      path: endpoint.path,
      method: endpoint.method,
      response,
    });
    if (!result.ok) return result.error.message;
    replaceMock(result.value);
    return undefined;
  }

  const [draft, setDraft] = useState<DraftResponse>(() =>
    toDraft(mockResponse ?? createGeneratedResponse(endpoint, seed, locale)),
  );
  const [original, setOriginal] = useState<DraftResponse>(() => ({ ...draft }));
  const [validation, setValidation] = useState<DraftValidation>(() => parseDraft(draft));
  const [validationPending, setValidationPending] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const nextDraft = toDraft(mockResponse ?? createGeneratedResponse(endpoint, seed, locale));
    setValidationPending(true);
    setDraft(nextDraft);
    setOriginal(nextDraft);
    setSaveError(undefined);
  }, [endpoint, mockResponse, seed, locale]);

  useEffect(() => {
    setValidationPending(true);
    const timeout = window.setTimeout(() => {
      setValidation(parseDraft(draft));
      setValidationPending(false);
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [draft]);

  const hasUnsavedChanges = JSON.stringify(draft) !== JSON.stringify(original);

  async function save(): Promise<void> {
    if (!validation.ok || validationPending) return;

    setSaving(true);
    setSaveError(undefined);
    const error = await onSave(validation.value);
    setSaving(false);
    setSaveError(error);
  }

  function updateDraft(update: (current: DraftResponse) => DraftResponse): void {
    setValidationPending(true);
    setDraft(update);
  }

  function resetToGenerated(): void {
    updateDraft(() => toDraft(createGeneratedResponse(endpoint, seed, locale)));
    setSaveError(undefined);
  }

  function cancel(): void {
    updateDraft(() => toDraft(mockResponse ?? createGeneratedResponse(endpoint, seed, locale)));
    setSaveError(undefined);
  }

  return (
    <div className={styles.editor} aria-label="Mock response editor">
      <Flex align="center" gap="small">
        <Tag>{endpoint.method}</Tag>
        <Typography.Title level={5} style={{ margin: 0 }}>
          {endpoint.path}
        </Typography.Title>
        {hasUnsavedChanges ? <Tag color="warning">Unsaved changes</Tag> : null}
      </Flex>
      <Divider size="medium" />
      <Flex vertical gap="middle" className={styles.stack}>
        <Space wrap>
          <Typography.Text>Status code</Typography.Text>
          <InputNumber
            min={100}
            max={599}
            aria-label="Response status code"
            value={draft.status}
            onChange={(status) => updateDraft((current) => ({ ...current, status }))}
          />
        </Space>
        <label className={styles.field}>
          <Typography.Text>Headers (JSON)</Typography.Text>
          <Input.TextArea
            aria-label="Response headers"
            rows={1}
            value={draft.headers}
            onChange={(event) =>
              updateDraft((current) => ({ ...current, headers: event.target.value }))
            }
          />
        </label>
        <div className={styles.field}>
          <Typography.Text>Response body (JSON)</Typography.Text>
          <Input.TextArea
            aria-label="Response body"
            rows={12}
            value={draft.body}
            onChange={(event) =>
              updateDraft((current) => ({ ...current, body: event.target.value }))
            }
          />
        </div>
        <label className={styles.field}>
          <Typography.Text>Conditional variants (JSON)</Typography.Text>
          <Input.TextArea
            aria-label="Conditional response variants"
            rows={4}
            placeholder={
              '[{"id":"missing","priority":100,"match":{"pathParams":{"id":"missing"}},"response":{"status":404,"headers":{},"body":null}}]'
            }
            value={draft.variants}
            onChange={(event) =>
              updateDraft((current) => ({ ...current, variants: event.target.value }))
            }
          />
          <Typography.Text type="secondary">
            Highest priority matching variant wins. Match query, headers, body, or pathParams.
          </Typography.Text>
        </label>
        {!validation.ok ? <Alert title={validation.error} type="error" showIcon /> : null}
        {saveError ? <Alert title={saveError} type="error" showIcon /> : null}
        <Space wrap>
          <Button
            type="primary"
            disabled={!validation.ok || validationPending}
            loading={saving}
            onClick={() => void save()}
          >
            Save mock
          </Button>
          <Button onClick={cancel}>Cancel changes</Button>
          <Button onClick={resetToGenerated}>Reset to generated</Button>
        </Space>
      </Flex>
    </div>
  );
};

function createGeneratedResponse(
  endpoint: Endpoint,
  seed?: number,
  locale?: AppLocale,
): MockResponse {
  return {
    status: endpoint.responseStatus,
    headers: {},
    body:
      seed === undefined && locale === undefined
        ? generateMock(endpoint.responseSchema)
        : generateMockWithOptions(endpoint.responseSchema, {
            ...(seed === undefined ? {} : { seed: deriveEndpointSeed(seed, endpoint.id) }),
            locale,
          }),
  };
}

function deriveEndpointSeed(seed: number, endpointId: string): number {
  let derived = seed;
  for (const character of endpointId) {
    derived = (derived * 31 + character.charCodeAt(0)) >>> 0;
  }
  return derived;
}

function toDraft(response: MockResponse): DraftResponse {
  return {
    status: response.status,
    headers: JSON.stringify(response.headers, null, 2),
    body: JSON.stringify(response.body, null, 2),
    variants: JSON.stringify(response.variants ?? [], null, 2),
  };
}

function parseDraft(draft: DraftResponse): DraftValidation {
  try {
    const response: unknown = {
      status: draft.status,
      headers: JSON.parse(draft.headers),
      body: JSON.parse(draft.body),
      variants: JSON.parse(draft.variants),
    };
    validateMockResponse(response);
    return { ok: true, value: response };
  } catch (error: unknown) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Enter a valid JSON mock response.',
    };
  }
}
