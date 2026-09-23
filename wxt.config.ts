import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Backlink Inspector',
    description: 'Inspect backlinks, link attributes, visibility, and plain-text mentions on the current page.',
    minimum_chrome_version: '114',
    permissions: ['activeTab', 'scripting', 'storage', 'sidePanel'],
    optional_host_permissions: ['http://*/*', 'https://*/*'],
    action: {
      default_title: 'Inspect backlinks',
    },
  },
});
