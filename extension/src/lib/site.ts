import { TARGET_HOST, TARGET_PATH_PREFIX } from '../constants'

export function isTargetPage(url: string | undefined): boolean {
  if (!url) return false
  try {
    const u = new URL(url)
    return u.host === TARGET_HOST && u.pathname.startsWith(TARGET_PATH_PREFIX)
  } catch {
    return false
  }
}

// Host-only check: true for any page on the target host, regardless of path. Used
// to scope the side panel to the whole app rather than just the enrichai route.
export function isTargetHost(url: string | undefined): boolean {
  if (!url) return false
  try {
    return new URL(url).host === TARGET_HOST
  } catch {
    return false
  }
}
