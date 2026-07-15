import { isTargetHost } from './site'

const PANEL_PATH = 'src/sidepanel/index.html'

// Chrome exposes a single side-panel surface that, by default, stays visible on
// every tab. Scope it to the EnrichAI host by enabling it on any page of that host
// and disabling it everywhere else. Disabling the panel for a tab closes it when
// that tab is active, so the panel disappears the moment the user navigates away to
// an unrelated site (gmail.com, google.com, …) or switches to another tab.
export async function syncPanel(tabId: number, url: string | undefined): Promise<void> {
  try {
    if (isTargetHost(url)) {
      await chrome.sidePanel.setOptions({ tabId, path: PANEL_PATH, enabled: true })
    } else {
      await chrome.sidePanel.setOptions({ tabId, enabled: false })
    }
  } catch {
    // The tab may have closed between the event firing and this call resolving;
    // setOptions then rejects for the now-missing tabId. Nothing to do.
  }
}
