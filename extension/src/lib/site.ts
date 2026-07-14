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
