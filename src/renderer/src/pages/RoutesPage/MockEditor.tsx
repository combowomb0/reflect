import { Alert, Button, Divider, Flex, Form, Input, InputNumber, Tag, Typography } from 'antd';
import { useEffect, useState } from 'react';
import type { FC } from 'react';

import { generateMock, generateMockWithOptions } from '../../../../shared/mockGenerator';
import { validateMockResponse } from '../../../../shared/ipcValidation';
import type { AppLocale, Endpoint, MockResponse } from '../../../../shared/types';
import { useAppStore } from '../../store/useAppStore';
import styles from './MockEditor.module.scss';

interface MockEditorForm {
  readonly status: number | null;
  readonly headers: string;
  readonly body: string;
  readonly variants: string;
}

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
  const [form] = Form.useForm<MockEditorForm>();
  const values = Form.useWatch([], form);
  const [saveError, setSaveError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [submittable, setSubmittable] = useState(false);

  useEffect(() => {
    form
      .validateFields({ validateOnly: true })
      .then(() => setSubmittable(true))
      .catch(() => setSubmittable(false));
  }, [form, values]);

  useEffect(() => {
    const nextDraft = toDraft(mockResponse ?? createGeneratedResponse(endpoint, seed, locale));
    form.setFieldsValue(nextDraft);
    setSaveError(undefined);
  }, [endpoint, form, locale, mockResponse, seed]);

  async function save(values: MockEditorForm): Promise<void> {
    let response: MockResponse;
    try {
      response = toResponse(values);
    } catch (error: unknown) {
      setSaveError(error instanceof Error ? error.message : 'Enter a valid mock response.');
      return;
    }

    setSaving(true);
    setSaveError(undefined);
    const result = await window.reflect.saveMock({
      path: endpoint.path,
      method: endpoint.method,
      response,
    });
    if (!result.ok) {
      setSaveError(result.error.message);
      setSaving(false);
      return;
    }
    replaceMock(result.value);
    setSaving(false);
  }

  function regenerate(): void {
    form.setFieldsValue(toDraft(createGeneratedResponse(endpoint, seed, locale)));
    setSaveError(undefined);
  }

  function cancel(): void {
    const nextDraft = toDraft(mockResponse ?? createGeneratedResponse(endpoint, seed, locale));
    form.setFieldsValue(nextDraft);
    setSaveError(undefined);
  }

  return (
    <Flex flex="auto" vertical>
      <Flex align="center" gap="small">
        <Tag>{endpoint.method}</Tag>
        <Typography.Title level={5} style={{ margin: 0 }}>
          {endpoint.path}
        </Typography.Title>
      </Flex>
      <Divider size="medium" />
      <Form
        form={form}
        className={styles.editor}
        layout="vertical"
        onFinish={(values) => void save(values)}
        onFinishFailed={() => setSaveError('Fix the validation errors before saving.')}
      >
        <Form.Item
          label="Status code"
          name="status"
          rules={[
            {
              type: 'number',
              min: 100,
              max: 599,
              message: 'Status code must be between 100 and 599.',
            },
          ]}
        >
          <InputNumber min={100} max={599} aria-label="Response status code" />
        </Form.Item>
        <Form.Item
          label="Headers (JSON)"
          name="headers"
          rules={[jsonRule('Headers', validateHeaders)]}
        >
          <Input.TextArea aria-label="Response headers" rows={2} />
        </Form.Item>
        <Form.Item label="Response body (JSON)" name="body" rules={[jsonRule('Response body')]}>
          <Input.TextArea aria-label="Response body" rows={12} />
        </Form.Item>
        <Form.Item
          label="Conditional variants (JSON)"
          name="variants"
          extra="Highest priority matching variant wins. Match query, headers, body, or pathParams."
          rules={[jsonRule('Conditional variants', validateVariants)]}
        >
          <Input.TextArea aria-label="Conditional response variants" rows={4} />
        </Form.Item>
        <Divider size="middle" />
        <Flex vertical gap="medium">
          {saveError ? <Alert title={saveError} type="error" showIcon /> : null}
          <Flex gap="small">
            <Button type="primary" htmlType="submit" loading={saving} disabled={!submittable}>
              Save mock
            </Button>
            <Button onClick={cancel}>Cancel changes</Button>
            <Button onClick={regenerate}>Regenerate</Button>
          </Flex>
        </Flex>
      </Form>
    </Flex>
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

function toDraft(response: MockResponse): MockEditorForm {
  return {
    status: response.status,
    headers: JSON.stringify(response.headers, null, 2),
    body: JSON.stringify(response.body, null, 2),
    variants: JSON.stringify(response.variants ?? [], null, 2),
  };
}

function toResponse(draft: MockEditorForm): MockResponse {
  try {
    const response = {
      status: draft.status,
      headers: parseJson(draft.headers, 'Headers'),
      body: parseJson(draft.body, 'Response body'),
      variants: parseJson(draft.variants, 'Conditional variants'),
    };
    validateMockResponse(response);
    return response;
  } catch (error: unknown) {
    throw error instanceof Error ? error : new Error('Enter a valid JSON mock response.');
  }
}

function parseJson(value: unknown, label: string): unknown {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${label} is required and must contain valid JSON.`);
  }

  try {
    return JSON.parse(value);
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : 'Unknown JSON syntax error.';
    throw new Error(`${label} contains invalid JSON: ${detail}`, { cause: error });
  }
}

function jsonRule(
  label: string,
  validate?: (parsed: unknown) => string | undefined,
): { validator: (_rule: unknown, value: unknown) => Promise<void> } {
  return {
    validator: async (_rule: unknown, value: unknown): Promise<void> => {
      const parsed = parseJson(value, label);
      const error = validate?.(parsed);
      if (error) throw new Error(`${label}: ${error}`);
    },
  };
}

function validateHeaders(parsed: unknown): string | undefined {
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    Array.isArray(parsed) ||
    !Object.values(parsed).every((header) => typeof header === 'string')
  ) {
    return 'Headers must be a JSON object with string values.';
  }
  return undefined;
}

function validateVariants(parsed: unknown): string | undefined {
  return Array.isArray(parsed) ? undefined : 'Conditional variants must be a JSON array.';
}
