import { Alert, Button } from 'antd';
import type { ReactElement } from 'react';

interface ErrorStateProps {
  readonly message: string;
  readonly onRetry?: () => void;
}

/** Shows an actionable, renderer-safe error message. */
export function ErrorState({ message, onRetry }: ErrorStateProps): ReactElement {
  return (
    <Alert
      message={message}
      type="error"
      showIcon
      action={
        onRetry ? (
          <Button size="small" onClick={onRetry}>
            Retry
          </Button>
        ) : undefined
      }
    />
  );
}
