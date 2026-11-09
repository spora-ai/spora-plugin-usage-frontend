import { describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, type Pinia } from 'pinia'
import App from '../src/App.vue'
import { useUsageStore } from '../src/stores/usage'
import { buildHost, forbidden, type HostOptions } from './helpers/host'

const meResponse = {
    principals: [
        {
            id: 12,
            type: 'user',
            name: 'Ada Lovelace',
            balance: 250.5,
            limits: [
                {
                    window: 'month',
                    window_size: 1,
                    unit: 'credits',
                    cap: 10000,
                    mode: 'hard',
                    enabled: true,
                    spend: 1234.5,
                    remaining: 8765.5,
                },
            ],
        },
    ],
}

const seriesResponse = {
    window: 'day',
    points: [
        {
            at: '2026-11-09T10:00:00+00:00',
            credits: 1.25,
            total_tokens: 3400,
            output_tokens: 900,
            llm_calls: 3,
            tool_calls: 2,
        },
    ],
}

function mountApp(options: HostOptions = {}): {
    wrapper: VueWrapper
    host: ReturnType<typeof buildHost>
    pinia: Pinia
} {
    const host = buildHost({
        ...options,
        get: {
            '/usage/me': () => meResponse,
            '/usage/me/series?window=day': () => seriesResponse,
            ...options.get,
        },
    })
    const pinia = createPinia()
    const wrapper = mount(App, {
        props: { hostContext: host.context },
        global: { plugins: [pinia] },
    })
    return { wrapper, host, pinia }
}

describe('App.vue', () => {
    it('mounts the panel and opens on the Overview tab', async () => {
        const { wrapper } = mountApp()
        await flushPromises()
        expect(wrapper.find('#spora-plugin-usage').exists()).toBe(true)
        expect(wrapper.find('[data-testid="usage-panel-overview"]').exists()).toBe(true)
    })

    it('loads the caller\'s principals into the Overview tab', async () => {
        const { wrapper, host } = mountApp()
        await flushPromises()
        await flushPromises()
        expect(wrapper.find('[data-testid="usage-principal-12"]').exists()).toBe(true)
        expect(wrapper.find('[data-testid="usage-principal-balance-12"]').text()).toContain('250.5')
        expect(host.api.get).toHaveBeenCalledWith('/usage/me')
    })

    it('hides the admin tabs from a non-admin', async () => {
        const { wrapper } = mountApp({ isAdmin: false })
        await flushPromises()
        expect(wrapper.find('[data-testid="usage-tab-overview"]').exists()).toBe(true)
        expect(wrapper.find('[data-testid="usage-tab-principals"]').exists()).toBe(false)
        expect(wrapper.find('[data-testid="usage-tab-limits"]').exists()).toBe(false)
        expect(wrapper.find('[data-testid="usage-tab-budget"]').exists()).toBe(false)
        expect(wrapper.find('[data-testid="usage-tab-prices"]').exists()).toBe(false)
    })

    it('offers the admin tabs to an admin', async () => {
        const { wrapper } = mountApp({ isAdmin: true })
        await flushPromises()
        for (const tab of ['overview', 'principals', 'limits', 'budget', 'prices']) {
            expect(wrapper.find(`[data-testid="usage-tab-${tab}"]`).exists()).toBe(true)
        }
    })

    it('opens the tab that was picked', async () => {
        const { wrapper } = mountApp({
            isAdmin: true,
            get: { '/usage/principals': () => ({ principals: [] }) },
        })
        await flushPromises()
        await wrapper.find('[data-testid="usage-tab-principals"]').trigger('click')
        await flushPromises()
        expect(wrapper.find('[data-testid="usage-panel-principals"]').exists()).toBe(true)
        expect(wrapper.find('[data-testid="usage-panel-overview"]').exists()).toBe(false)
    })

    it('drops the admin tabs when the API refuses an admin call', async () => {
        const { wrapper } = mountApp({
            isAdmin: true,
            get: {
                '/usage/principals': () => {
                    throw forbidden()
                },
            },
        })
        await flushPromises()
        await wrapper.find('[data-testid="usage-tab-principals"]').trigger('click')
        await flushPromises()
        await flushPromises()
        // A 403 is the server's answer, not a failure to retry: the admin
        // tabs disappear and the panel falls back to the Overview.
        expect(wrapper.find('[data-testid="usage-tab-principals"]').exists()).toBe(false)
        expect(wrapper.find('[data-testid="usage-panel-overview"]').exists()).toBe(true)
    })

    it('keeps the panel mounted when the Overview request fails', async () => {
        const { wrapper } = mountApp({
            get: {
                '/usage/me': () => {
                    throw new Error('Boom')
                },
            },
        })
        await flushPromises()
        await flushPromises()
        expect(wrapper.find('[data-testid="usage-overview-error"]').exists()).toBe(true)
        expect(wrapper.find('[data-testid="usage-overview-error"]').text()).toContain('Boom')
    })

    it('opens every admin tab', async () => {
        const { wrapper } = mountApp({
            isAdmin: true,
            get: {
                '/usage/principals': () => ({ principals: [] }),
                '/usage/prices': () => ({ prices: [] }),
                '/usage/unpriced': () => ({ models: [], tools: [] }),
            },
        })
        await flushPromises()
        for (const tab of ['principals', 'limits', 'budget', 'prices']) {
            await wrapper.find(`[data-testid="usage-tab-${tab}"]`).trigger('click')
            await flushPromises()
            expect(wrapper.find(`[data-testid="usage-panel-${tab}"]`).exists()).toBe(true)
        }
    })

    it('keeps the overview open when the caller stops being an admin', async () => {
        const { wrapper, pinia } = mountApp({ isAdmin: true })
        await flushPromises()
        const store = useUsageStore(pinia)
        const selectTab = vi.spyOn(store, 'selectTab')
        store.markAdminDenied()
        await flushPromises()
        expect(selectTab).not.toHaveBeenCalled()
        expect(wrapper.find('[data-testid="usage-tab-prices"]').exists()).toBe(false)
        expect(wrapper.find('[data-testid="usage-panel-overview"]').exists()).toBe(true)
    })
})
