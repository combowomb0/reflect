/// <reference types="vite/client" />

import type { ReflectApi } from '../../shared/types';

declare global {
  interface Window {
    reflect: ReflectApi;
  }
}

export {};
