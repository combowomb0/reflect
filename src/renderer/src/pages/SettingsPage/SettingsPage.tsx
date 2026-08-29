import { Alert, Button, Card, Col, Flex, Form, InputNumber, Row, Select, Typography } from 'antd';
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
  const [form] = Form.useForm<SettingsFormValues>();
  const [saving, setSaving] = useState(false);
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

  return (
    <Row gutter={16}>
      <Col span="10">
        <Card>
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
          </Form>
        </Card>
      </Col>
      {!!specs.length && (
        <Col span="14">
          <Card title="Loaded specifications">
            <Flex vertical gap="small">
              {specs.map((spec) => (
                <Typography.Text key={spec.path} type="secondary">
                  {spec.path}
                </Typography.Text>
              ))}
            </Flex>
          </Card>
        </Col>
      )}
    </Row>
  );
};
