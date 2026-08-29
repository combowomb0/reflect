import { Alert, Button, InputNumber, Select, Space, Typography } from 'antd';
import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import type { AppLocale } from '../../../shared/types';

interface GenerationControlsProps {
  readonly seed?: number;
  readonly locale: AppLocale;
  readonly onSave: (seed: number | undefined) => Promise<string | undefined>;
  readonly onSaveLocale: (locale: AppLocale) => Promise<string | undefined>;
}

/** Persists the optional seed used for reproducible generated mock values. */
export function GenerationControls({
  seed,
  locale,
  onSave,
  onSaveLocale,
}: GenerationControlsProps): ReactElement {
  const [draftSeed, setDraftSeed] = useState<number | undefined>(seed);
  const [saving, setSaving] = useState(false);
  const [draftLocale, setDraftLocale] = useState(locale);
  const [error, setError] = useState<string>();

  useEffect(() => setDraftSeed(seed), [seed]);
  useEffect(() => setDraftLocale(locale), [locale]);

  async function save(): Promise<void> {
    setSaving(true);
    setError(undefined);
    setError(await onSave(draftSeed));
    setSaving(false);
  }

  async function saveLocale(): Promise<void> {
    setSaving(true);
    setError(undefined);
    setError(await onSaveLocale(draftLocale));
    setSaving(false);
  }

  return (
    <Space direction="vertical" size="small" className="generation-controls">
      <Space wrap>
        <Typography.Text>Generation seed</Typography.Text>
        <InputNumber
          aria-label="Mock generation seed"
          min={0}
          max={0xffffffff}
          precision={0}
          placeholder="Random"
          value={draftSeed}
          onChange={(value) => setDraftSeed(value ?? undefined)}
        />
        <Button
          loading={saving}
          disabled={saving || draftSeed === seed}
          onClick={() => void save()}
        >
          Save seed
        </Button>
      </Space>
      <Space wrap>
        <Typography.Text>Mock data locale</Typography.Text>
        <Select
          aria-label="Mock data locale"
          value={draftLocale}
          options={[
            { label: 'English', value: 'en' },
            { label: 'Russian', value: 'ru' },
          ]}
          onChange={(value: AppLocale) => setDraftLocale(value)}
        />
        <Button
          loading={saving}
          disabled={saving || draftLocale === locale}
          onClick={() => void saveLocale()}
        >
          Save locale
        </Button>
      </Space>
      <Typography.Text type="secondary">
        Locale is used for new and reset mock values. A seed makes those values reproducible.
      </Typography.Text>
      {error ? <Alert message={error} type="error" showIcon /> : null}
    </Space>
  );
}
