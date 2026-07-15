import { TARGET_HOST } from '../constants'

// Chrome only injects declared content scripts on a fresh document load — never
// into tabs that are already open when the extension installs, updates, or reloads
// (e.g. after a rebuild during development). Those tabs keep running the previous,
// now-orphaned content script (chrome.runtime is invalidated, so it tears itself
// down) until the page is reloaded by hand — which is why detection and the side
// panel stop working until a manual refresh.
//
// Reloading the affected tabs programmatically forces Chrome to re-inject a fresh
// content script, so detection comes back on its own. We reload rather than call
// chrome.scripting.executeScript because crxjs rewrites the content-script path in
// the built extension and MV3 caches the already-evaluated module — both make
// dynamic re-injection unreliable — whereas a reload is the robust equivalent of
// the manual refresh it replaces.
export async function reloadTargetHostTabs(): Promise<void> {
  const tabs = await chrome.tabs.query({ url: `https://${TARGET_HOST}/*` })
  await Promise.all(
    tabs.map((tab) =>
      tab.id === undefined ? undefined : chrome.tabs.reload(tab.id).catch(() => {}),
    ),
  )
}
