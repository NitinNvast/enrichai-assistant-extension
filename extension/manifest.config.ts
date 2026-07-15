import { defineManifest } from '@crxjs/vite-plugin'

export default defineManifest({
  manifest_version: 3,
  name: 'EnrichAI Assistant',
  version: '1.0.0',

  description: 'Classify product attributes on the GroupBy EnrichAI application with AI.',
  action: { default_title: 'Open EnrichAI Assistant' },
  background: { service_worker: 'src/background/index.ts', type: 'module' },
  side_panel: { default_path: 'src/sidepanel/index.html' },
  content_scripts: [
    {
      matches: ['https://cc.gbiqa.groupbycloud.com/*'],
      js: ['src/content/index.ts'],
      run_at: 'document_idle',
    },
  ],
  host_permissions: ['https://cc.gbiqa.groupbycloud.com/*'],
  permissions: ['sidePanel', 'storage'],
})
