import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {
        ignored: [
          '**/*.json',
          '**/users_cloud_db.json',
          '**/invite_codes_db.json',
          '**/*_db.json',
          '**/data/**',
          '**/.system_generated/**',
          '**/*.log',
          '**/*.zip',
          '**/.restore_points/**',
          '**/.backups/**',
        ],
      },
    },
  };
});
