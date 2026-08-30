import {
  Alert,
  Button,
  Card,
  Empty,
  Flex,
  Form,
  InputNumber,
  Modal,
  Select,
  Typography,
} from 'antd';
import { useEffect, useState } from 'react';
import type { FC } from 'react';

import { useAppStore } from '../../store/useAppStore';

interface SettingsFormValues {
  readonly port: number;
  readonly mockSeed?: number;
  readonly locale: 'en' | 'ru';
}

export const SettingsPage: FC = () => {
  const specs = useAppStore((state) => state.specs);
  const port = useAppStore((state) => state.port);
  const mockSeed = useAppStore((state) => state.mockSeed);
  const locale = useAppStore((state) => state.locale);
  const setSettings = useAppStore((state) => state.setSettings);
  const replaceMocks = useAppStore((state) => state.replaceMocks);
  const [modal, contextHolder] = Modal.useModal();
  const [form] = Form.useForm<SettingsFormValues>();
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    form.setFieldsValue({ port, mockSeed, locale });
  }, [form, locale, mockSeed, port]);

  async function save(values: SettingsFormValues): Promise<void> {
    setSaving(true);
    setError(undefined);
    const result = await window.reflect.saveSettings(values);
    if (result.ok) {
      setSettings(result.value);
    } else {
      setError(result.error.message);
    }
    setSaving(false);
  }

  async function regenerateMocks(): Promise<void> {
    const confirmed = await modal.confirm({
      title: 'Regenerate all mocks?',
      content: 'All manually saved mock responses for loaded specifications will be replaced.',
      okText: 'Regenerate',
    });

    if (!confirmed) return;

    setRegenerating(true);
    setError(undefined);
    const result = await window.reflect.regenerateMocks();
    if (result.ok) {
      replaceMocks(result.value);
    } else {
      setError(result.error.message);
    }
    setRegenerating(false);
  }

  return (
    <Flex gap="medium">
      <Flex flex="0.5" vertical gap="medium">
        <Card title="Settings">
          <Form
            form={form}
            layout="horizontal"
            labelCol={{ span: 6 }}
            wrapperCol={{ span: 18 }}
            onFinish={(values) => void save(values)}
          >
            <Form.Item
              label="Mock server port"
              name="port"
              rules={[{ required: true, message: 'Enter a port.' }]}
            >
              <InputNumber min={1} max={65535} precision={0} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item label="Generation seed" name="mockSeed">
              <InputNumber
                min={0}
                max={0xffffffff}
                precision={0}
                placeholder="Random"
                style={{ width: '100%' }}
              />
            </Form.Item>
            <Form.Item label="Mock data locale" name="locale">
              <Select
                options={[
                  { label: 'English', value: 'en' },
                  { label: 'Russian', value: 'ru' },
                ]}
              />
            </Form.Item>
            <Form.Item label={null}>
              <Button type="primary" htmlType="submit" loading={saving}>
                Save settings
              </Button>
            </Form.Item>
            {error ? <Alert title={error} type="error" showIcon /> : null}
            {contextHolder}
          </Form>
        </Card>
        <Card title="Mock data">
          <Typography.Paragraph type="secondary">
            Replace all saved mock responses for loaded specifications using the current generation
            settings.
          </Typography.Paragraph>
          <Button
            danger
            loading={regenerating}
            disabled={!specs.length}
            onClick={() => void regenerateMocks()}
          >
            Regenerate mocks
          </Button>
        </Card>
      </Flex>
      <Flex flex="0.5" vertical gap="medium">
        <Card title="Loaded specifications">
          {specs.length ? (
            <Flex vertical gap="small">
              {specs.map((spec) => (
                <Typography.Text key={spec.path} type="secondary">
                  {spec.path}
                </Typography.Text>
              ))}
            </Flex>
          ) : (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="Import an OpenAPI specification to get started"
            />
          )}
        </Card>
      </Flex>
    </Flex>
  );
};
