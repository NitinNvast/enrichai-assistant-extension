// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { watchDom } from './observer'

const tick = (ms: number) => new Promise((r) => setTimeout(r, ms))

describe('watchDom', () => {
  it('fires the callback (debounced) when the DOM changes', async () => {
    const cb = vi.fn()
    const stop = watchDom(document.body, cb, 10)

    const div = document.createElement('div')
    document.body.appendChild(div)
    document.body.appendChild(document.createElement('span'))

    await tick(30)
    expect(cb).toHaveBeenCalledTimes(1) // two mutations collapsed into one call
    stop()
  })

  it('stops firing after disconnect', async () => {
    const cb = vi.fn()
    const stop = watchDom(document.body, cb, 10)
    stop()
    document.body.appendChild(document.createElement('div'))
    await tick(30)
    expect(cb).not.toHaveBeenCalled()
  })
})
