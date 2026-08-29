import { defineConfig } from 'electron-vite';
import react from '@vitejs/plugin-react';
import reactCompiler from 'babel-plugin-react-compiler';

export default defineConfig({
  main: { build: { externalizeDeps: true } },
  preload: { build: { externalizeDeps: true } },
  renderer: { plugins: [react({ babel: { plugins: [reactCompiler] } })] },
});
