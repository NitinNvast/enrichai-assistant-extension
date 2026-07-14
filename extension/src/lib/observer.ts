export function watchDom(root: Node, onChange: () => void, delayMs = 200): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined
  const debounced = () => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(onChange, delayMs)
  }
  const observer = new MutationObserver(debounced)
  observer.observe(root, { childList: true, subtree: true })
  return () => {
    if (timer) clearTimeout(timer)
    observer.disconnect()
  }
}
