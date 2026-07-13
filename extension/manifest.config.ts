import { defineManifest } from '@crxjs/vite-plugin'

export default defineManifest({
  manifest_version: 3,
  name: 'AI Page Summarizer',
  version: '0.1.0',
  description: 'Summarize the current web page with AI.',
  action: { default_title: 'Summarize this page' },
  background: { service_worker: 'src/background/index.ts', type: 'module' },
  side_panel: { default_path: 'src/sidepanel/index.html' },
  permissions: ['activeTab', 'scripting', 'sidePanel', 'storage'],
})
