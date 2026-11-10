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

const scopeResponse = {
    principals: [
        { id: 12, type: 'user', name: 'Ada Lovelace', balance: 250.5, spend_30d: 1234.5 },
        { id: 34, type: 'group', name: 'Research', balance: null, spend_30d: 87.25 },
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
            '/usage/principals': () => scopeResponse,
            '/usage/unpriced': () => ({ models: [], tools: [] }),
            '/usage/defaults': () => ({ defaults: { all: [], user: [], group: [] } }),
            ...options.get,
        },
    })
    const pinia = createPinia()
    const wrapper = mount(App, {
        props: { hostContext: host.context, idPrefix: 'usage-1' },
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
        expect(wrapper.find('[data-testid="usage-tab-limits"]').exists()).toBe(false)
        expect(wrapper.find('[data-testid="usage-tab-defaults"]').exists()).toBe(false)
        expect(wrapper.find('[data-testid="usage-tab-budget"]').exists()).toBe(false)
        expect(wrapper.find('[data-testid="usage-tab-prices"]').exists()).toBe(false)
    })

    it('offers the admin tabs to an admin', async () => {
        const { wrapper } = mountApp({ isAdmin: true })
        await flushPromises()
        for (const tab of ['overview', 'limits', 'defaults', 'budget', 'prices']) {
            expect(wrapper.find(`[data-testid="usage-tab-${tab}"]`).exists()).toBe(true)
        }
    })

    it('offers the admin the principal picker, and loads its principals', async () => {
        const { wrapper, host, pinia } = mountApp({ isAdmin: true })
        await flushPromises()
        // The picker belongs to the tabs it scopes, so the shell carries
        // none.
        expect(wrapper.find('[data-testid="usage-principal-picker"]').exists()).toBe(false)

        await wrapper.find('[data-testid="usage-tab-limits"]').trigger('click')
        await flushPromises()
        await flushPromises()

        expect(wrapper.find('[data-testid="usage-principal-picker"]').exists()).toBe(true)
        expect(host.api.get).toHaveBeenCalledWith('/usage/principals')
        expect(useUsageStore(pinia).principals).toHaveLength(2)
    })

    it('keeps the picker out of the way of a caller who cannot configure anything', async () => {
        const { wrapper, host } = mountApp({ isAdmin: false })
        await flushPromises()
        await flushPromises()

        expect(wrapper.find('[data-testid="usage-principal-picker"]').exists()).toBe(false)
        // The admin listing is not asked for: it would be refused.
        expect(host.api.get).not.toHaveBeenCalledWith('/usage/principals')
    })

    it('scopes the admin tabs from the picker, without a trip to another tab', async () => {
        const { wrapper, pinia } = mountApp({ isAdmin: true })
        await flushPromises()
        await wrapper.find('[data-testid="usage-tab-limits"]').trigger('click')
        await flushPromises()
        await flushPromises()

        await wrapper.find('[data-testid="limits-principal-toggle"]').trigger('click')
        await flushPromises()
        await wrapper.find('[data-testid="limits-principal-option-34"]').trigger('click')
        await flushPromises()

        expect(useUsageStore(pinia).selectedPrincipalId).toBe(34)
        // The picker is still on screen while the operator works on it.
        expect(wrapper.find('[data-testid="limits-principal-toggle"]').text()).toContain('Research')
    })

    it('keeps the principal across the tabs that scope to it', async () => {
        const { wrapper, pinia } = mountApp({ isAdmin: true })
        await flushPromises()
        await wrapper.find('[data-testid="usage-tab-limits"]').trigger('click')
        await flushPromises()
        await flushPromises()

        await wrapper.find('[data-testid="limits-principal-toggle"]').trigger('click')
        await flushPromises()
        await wrapper.find('[data-testid="limits-principal-option-34"]').trigger('click')
        await flushPromises()

        await wrapper.find('[data-testid="usage-tab-budget"]').trigger('click')
        await flushPromises()

        expect(useUsageStore(pinia).selectedPrincipalId).toBe(34)
        expect(wrapper.find('[data-testid="budget-principal-toggle"]').text()).toContain('Research')
    })

    it('opens the tab that was picked', async () => {
        const { wrapper } = mountApp({ isAdmin: true })
        await flushPromises()
        await wrapper.find('[data-testid="usage-tab-limits"]').trigger('click')
        await flushPromises()
        expect(wrapper.find('[data-testid="usage-panel-limits"]').exists()).toBe(true)
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
        await flushPromises()
        // A 403 is the server's answer, not a failure to retry: the admin
        // tabs disappear and the panel falls back to the Overview.
        expect(wrapper.find('[data-testid="usage-tab-limits"]').exists()).toBe(false)
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
                '/usage/prices': () => ({ prices: [] }),
                '/usage/unpriced': () => ({ models: [], tools: [] }),
            },
        })
        await flushPromises()
        for (const tab of ['limits', 'defaults', 'budget', 'prices']) {
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

    it('falls back to the Overview when the caller stops being an admin on an admin tab', async () => {
        const { wrapper, pinia } = mountApp({ isAdmin: true })
        await flushPromises()
        await wrapper.find('[data-testid="usage-tab-prices"]').trigger('click')
        await flushPromises()
        expect(wrapper.find('[data-testid="usage-panel-prices"]').exists()).toBe(true)

        // The API refuses an admin call: the admin tabs disappear, and the
        // panel has to land somewhere the caller may read.
        useUsageStore(pinia).markAdminDenied()
        await flushPromises()

        expect(wrapper.find('[data-testid="usage-panel-overview"]').exists()).toBe(true)
    })

    it('wires the panel to the tab that opened it', async () => {
        const { wrapper } = mountApp({
            isAdmin: true,
            get: {
                '/usage/prices': () => ({ prices: [] }),
                '/usage/unpriced': () => ({ models: [], tools: [] }),
            },
        })
        await flushPromises()

        const panel = wrapper.find('[role="tabpanel"]')
        expect(panel.attributes('id')).toBe('usage-1-panel-overview')
        expect(panel.attributes('aria-labelledby')).toBe('usage-1-tab-overview')

        const tab = wrapper.find('[data-testid="usage-tab-overview"]')
        expect(tab.attributes('id')).toBe('usage-1-tab-overview')
        expect(tab.attributes('aria-controls')).toBe('usage-1-panel-overview')
        expect(tab.attributes('aria-selected')).toBe('true')

        await wrapper.find('[data-testid="usage-tab-prices"]').trigger('click')
        await flushPromises()

        expect(wrapper.find('[role="tabpanel"]').attributes('id')).toBe('usage-1-panel-prices')
        expect(wrapper.find('[role="tabpanel"]').attributes('aria-labelledby')).toBe(
            'usage-1-tab-prices',
        )
        expect(wrapper.find('[data-testid="usage-tab-prices"]').attributes('aria-selected')).toBe(
            'true',
        )
        expect(wrapper.find('[data-testid="usage-tab-overview"]').attributes('aria-selected')).toBe(
            'false',
        )
    })
})
