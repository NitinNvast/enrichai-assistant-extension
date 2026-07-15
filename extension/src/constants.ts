export const TARGET_HOST = 'cc.gbiqa.groupbycloud.com'
export const TARGET_PATH_PREFIX = '/enrich/enrichai/'

export const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:8000'

// Strips a leading type marker like "[T]" from the URL attributeName.
export const ATTR_TYPE_PREFIX = /^\[[A-Za-z]\]\s*/
