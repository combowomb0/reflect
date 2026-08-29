import type { AppError } from './types';

/** Stable error codes that can be safely handled by the renderer. */
export type AppErrorCode =
  | 'REQUEST_FAILED'
  | 'SPEC_INVALID'
  | 'MOCK_STORE_FAILED'
  | 'SETTINGS_INVALID'
  | 'SERVER_START_FAILED';

/** An expected application failure with a safe renderer-facing message. */
export class DomainError extends Error {
  constructor(
    readonly code: AppErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}

/** Converts unknown main-process failures into the serializable IPC error contract. */
export function toAppError(error: unknown): AppError {
  if (error instanceof DomainError) {
    return { code: error.code, message: error.message };
  }
  return { code: 'REQUEST_FAILED', message: 'The requested action could not be completed.' };
}
