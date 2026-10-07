import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'geolocation=(), microphone=(), payment=(), camera=(self)'
};

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3001,
    host: '0.0.0.0',
    headers: securityHeaders
  },
  preview: {
    host: '127.0.0.1',
    port: 4174,
    headers: securityHeaders
  }
});
