import { describe, expect, it } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import SporaApp from '../src/main'
import { buildHost } from './helpers/host'

interface MountedTarget extends HTMLElement {
    __sporaApp?: { unmount: () => void }
}

describe('the mount contract', () => {
    it('mounts the panel into the target the host hands over', async () => {
        const host = buildHost({
            get: {
                '/usage/me': () => ({ principals: [] }),
                '/usage/me/series?window=day': () => ({ window: 'day', points: [] }),
            },
        })
        const target = document.createElement('div') as MountedTarget
        document.body.appendChild(target)

        SporaApp.mount(target, host.context)
        await flushPromises()

        expect(target.querySelector('#spora-plugin-usage')).not.toBeNull()
    })

    it('keeps a back-reference so unmount finds the app it mounted', () => {
        const host = buildHost()
        const target = document.createElement('div') as MountedTarget

        SporaApp.mount(target, host.context)

        expect(target.__sporaApp).toBeDefined()
    })

    it('unmounts the app and drops the back-reference', () => {
        const host = buildHost()
        const target = document.createElement('div') as MountedTarget

        SporaApp.mount(target, host.context)
        SporaApp.unmount(target)

        expect(target.__sporaApp).toBeUndefined()
        expect(target.querySelector('#spora-plugin-usage')).toBeNull()
    })

    it('survives an unmount that finds nothing to unmount', () => {
        const target = document.createElement('div') as MountedTarget
        expect(() => SporaApp.unmount(target)).not.toThrow()
    })

    it('installs itself on the global the host looks up', () => {
        expect(window.SporaAppUsage).toBe(SporaApp)
    })
})
