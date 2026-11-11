import { describe, expect, it } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import SporaApp from '../src/main'
import { buildHost } from './helpers/host'

interface MountedTarget extends HTMLElement {
    __sporaApp?: { unmount: () => void }
}

const priceResponse = {
    prices: [
        {
            kind: 'model',
            provider: 'openai_compatible',
            key: 'gpt-4o',
            operation: '',
            input_price: 0.000002,
            output_price: 0.000008,
            cached_price: 0.0000005,
            call_price: 0,
        },
    ],
}

function adminHost() {
    return buildHost({
        isAdmin: true,
        get: {
            '/usage/me': () => ({ principals: [] }),
            '/usage/me/series?window=day': () => ({ window: 'day', points: [] }),
            '/usage/prices': () => priceResponse,
            '/usage/unpriced': () => ({ models: [], tools: [] }),
        },
    })
}

function click(target: HTMLElement, selector: string): void {
    const button = target.querySelector(selector)
    if (!(button instanceof HTMLElement)) {
        throw new Error(`the mounted app has no ${selector}`)
    }
    button.dispatchEvent(new Event('click', { bubbles: true }))
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

    it('gives every mount its own ids', async () => {
        const host = adminHost()
        const first = document.createElement('div') as MountedTarget
        const second = document.createElement('div') as MountedTarget
        document.body.append(first, second)

        SporaApp.mount(first, host.context)
        SporaApp.mount(second, host.context)
        await flushPromises()

        click(first, '[data-testid="usage-tab-prices"]')
        click(second, '[data-testid="usage-tab-prices"]')
        await flushPromises()
        await flushPromises()

        // The root element keeps its id in every mount — the stylesheet
        // scopes its utilities beneath it — so only the panel's own ids are
        // per mount.
        const idsOf = (target: HTMLElement) =>
            [...target.querySelectorAll('[id]')]
                .map((element) => element.id)
                .filter((id) => id !== 'spora-plugin-usage')
        const firstIds = idsOf(first)
        const secondIds = idsOf(second)
        expect(firstIds.length).toBeGreaterThan(0)
        expect(secondIds.length).toBeGreaterThan(0)
        expect(secondIds.some((id) => firstIds.includes(id))).toBe(false)

        // Every label points at a control of its own mount: the second
        // mount's label must not reach into the first one.
        for (const label of second.querySelectorAll('label[for]')) {
            const id = label.getAttribute('for') ?? ''
            expect(second.querySelector(`[id="${id}"]`)).not.toBeNull()
            expect(first.querySelector(`[id="${id}"]`)).toBeNull()
        }
    })
})
