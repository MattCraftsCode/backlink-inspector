import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  manifest: {
    name: 'Backlink Inspector',
    description: 'Inspect backlinks, link attributes, visibility, and plain-text mentions on the current page.',
    minimum_chrome_version: '114',
    permissions: ['scripting', 'storage', 'sidePanel'],
    host_permissions: ['http://*/*', 'https://*/*'],
    action: {
      default_title: 'Inspect backlinks',
      default_icon: {
        16: 'icon-16.png',
        32: 'icon-32.png',
      },
    },
  },
});
