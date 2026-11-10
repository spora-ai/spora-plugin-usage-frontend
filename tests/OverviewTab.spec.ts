import { describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import OverviewTab from '../src/components/OverviewTab.vue'
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
        {
            id: 34,
            type: 'group',
            name: 'Research',
            balance: null,
            limits: [],
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

const listingResponse = {
    principals: [
        { id: 12, type: 'user', name: 'Ada Lovelace', balance: 250.5, spend_30d: 1234.5 },
        { id: 34, type: 'group', name: 'Research', balance: null, spend_30d: 87.25 },
        { id: 56, type: 'user', name: 'Grace Hopper', balance: 0, spend_30d: 0 },
    ],
}

const unpricedResponse = {
    models: [{ provider: 'openai_compatible', model: 'internal-preview', calls: 12 }],
    tools: [{ tool_class: 'Spora\\Tools\\WeatherTool', tool_name: 'weather', calls: 4 }],
    not_billed: {
        models: [
            { provider: 'anthropic', model: 'claude-sonnet', calls: 3, tokens: 340000 },
            { provider: '', model: 'a-local-model', calls: 1, tokens: 10 },
        ],
        tools: [{ tool_class: 'Spora\\Tools\\EchoTool', tool_name: 'echo', calls: 2 }],
    },
}

function mountTab(options: HostOptions = {}) {
    const host = buildHost({
        ...options,
        get: {
            '/usage/me': () => meResponse,
            '/usage/me/series?window=day': () => seriesResponse,
            '/usage/me/series?window=week': () => ({ window: 'week', points: [] }),
            '/usage/principals': () => listingResponse,
            '/usage/unpriced': () => unpricedResponse,
            ...options.get,
        },
    })
    const pinia = createPinia()
    const wrapper = mount(OverviewTab, {
        props: { hostContext: host.context },
        global: { plugins: [pinia] },
    })
    return { wrapper, host, pinia }
}

describe('OverviewTab', () => {
    it('shows each visible principal with its balance and its limits', async () => {
        const { wrapper } = mountTab()
        await flushPromises()
        await flushPromises()
        expect(wrapper.find('[data-testid="usage-principal-12"]').text()).toContain('Ada Lovelace')
        expect(wrapper.find('[data-testid="usage-principal-balance-12"]').text()).toContain('250.5')
        expect(wrapper.find('[data-testid="usage-principal-12"]').text()).toContain('8,765.5')
    })

    it('says a principal without a pool has no credit pool', async () => {
        const { wrapper } = mountTab()
        await flushPromises()
        await flushPromises()
        expect(wrapper.find('[data-testid="usage-principal-balance-34"]').text()).toContain(
            'No credit pool',
        )
    })

    it('draws the spend series and totals it', async () => {
        const { wrapper } = mountTab()
        await flushPromises()
        await flushPromises()
        expect(wrapper.find('[data-testid="usage-spend-chart"]').exists()).toBe(true)
        expect(wrapper.find('[data-testid="usage-spend-total-credits"]').text()).toContain('1.25')
        expect(wrapper.find('[data-testid="usage-spend-total-tokens"]').text()).toContain('3,400')
    })

    it('asks for another window when the window is switched', async () => {
        const { wrapper, host } = mountTab()
        await flushPromises()
        await flushPromises()
        await wrapper.find('[data-testid="usage-series-window-week"]').trigger('click')
        await flushPromises()
        await flushPromises()
        expect(host.api.get).toHaveBeenCalledWith('/usage/me/series?window=week')
        expect(wrapper.find('[data-testid="usage-spend-empty"]').exists()).toBe(true)
    })

    it('marks the window the chart shows as pressed', async () => {
        const { wrapper } = mountTab()
        await flushPromises()
        await flushPromises()
        expect(
            wrapper.find('[data-testid="usage-series-window-day"]').attributes('aria-pressed'),
        ).toBe('true')
        expect(
            wrapper.find('[data-testid="usage-series-window-week"]').attributes('aria-pressed'),
        ).toBe('false')

        await wrapper.find('[data-testid="usage-series-window-week"]').trigger('click')
        await flushPromises()

        expect(
            wrapper.find('[data-testid="usage-series-window-day"]').attributes('aria-pressed'),
        ).toBe('false')
        expect(
            wrapper.find('[data-testid="usage-series-window-week"]').attributes('aria-pressed'),
        ).toBe('true')
    })

    it('shows the window that was asked for last, whatever order the answers come in', async () => {
        const pending = new Map<string, (value: unknown) => void>()
        const { wrapper } = mountTab({
            get: {
                '/usage/me/series?window=day': () => seriesResponse,
                '/usage/me/series?window=week': () => new Promise((resolve) => {
                    pending.set('week', resolve)
                }),
                '/usage/me/series?window=month': () => new Promise((resolve) => {
                    pending.set('month', resolve)
                }),
            },
        })
        await flushPromises()
        await flushPromises()
        await wrapper.find('[data-testid="usage-series-window-week"]').trigger('click')
        await flushPromises()
        await wrapper.find('[data-testid="usage-series-window-month"]').trigger('click')
        await flushPromises()

        // The month answers first, the week answers afterwards.
        pending.get('month')?.({ window: 'month', points: [] })
        await flushPromises()
        await flushPromises()
        expect(wrapper.find('[data-testid="usage-series-loading"]').exists()).toBe(false)
        expect(wrapper.find('[data-testid="usage-spend-empty"]').exists()).toBe(true)

        pending.get('week')?.({
            window: 'week',
            points: [
                {
                    at: '2026-11-09T10:00:00+00:00',
                    credits: 99,
                    total_tokens: 1,
                    output_tokens: 1,
                    llm_calls: 1,
                    tool_calls: 1,
                },
            ],
        })
        await flushPromises()
        await flushPromises()
        // The week is the window the operator passed over: its answer is
        // dropped, and the chart keeps showing the month.
        expect(wrapper.find('[data-testid="usage-spend-total-credits"]').exists()).toBe(false)
        expect(wrapper.find('[data-testid="usage-spend-empty"]').exists()).toBe(true)
    })

    it('keeps the spinner up while a newer window is still loading', async () => {
        const pending = new Map<string, (value: unknown) => void>()
        const { wrapper } = mountTab({
            get: {
                '/usage/me/series?window=day': () => new Promise((resolve) => {
                    pending.set('day', resolve)
                }),
                '/usage/me/series?window=week': () => new Promise((resolve) => {
                    pending.set('week', resolve)
                }),
            },
        })
        await flushPromises()
        await wrapper.find('[data-testid="usage-series-window-week"]').trigger('click')
        await flushPromises()

        // The day answers while the week is still in flight.
        pending.get('day')?.(seriesResponse)
        await flushPromises()
        await flushPromises()
        expect(wrapper.find('[data-testid="usage-series-loading"]').exists()).toBe(true)

        pending.get('week')?.({ window: 'week', points: [] })
        await flushPromises()
        await flushPromises()
        expect(wrapper.find('[data-testid="usage-series-loading"]').exists()).toBe(false)
    })

    it('drops the failure of a window the operator passed over', async () => {
        const pending = new Map<string, (reason: unknown) => void>()
        const { wrapper } = mountTab({
            get: {
                '/usage/me/series?window=day': () => new Promise((_resolve, reject) => {
                    pending.set('day', reject)
                }),
                '/usage/me/series?window=week': () => ({ window: 'week', points: [] }),
            },
        })
        await flushPromises()
        await wrapper.find('[data-testid="usage-series-window-week"]').trigger('click')
        await flushPromises()
        await flushPromises()

        pending.get('day')?.(new Error('Boom'))
        await flushPromises()
        await flushPromises()

        expect(wrapper.find('[data-testid="usage-series-error"]').exists()).toBe(false)
    })

    it('surfaces the failure of the window it asked for', async () => {
        const { wrapper } = mountTab({
            get: {
                '/usage/me/series?window=day': () => {
                    throw new Error('Boom')
                },
            },
        })
        await flushPromises()
        await flushPromises()
        expect(wrapper.find('[data-testid="usage-series-error"]').text()).toContain('Boom')
    })

    it('says so when the caller has no visible principal', async () => {
        const { wrapper } = mountTab({
            get: { '/usage/me': () => ({ principals: [] }) },
        })
        await flushPromises()
        await flushPromises()
        expect(wrapper.find('[data-testid="usage-overview-no-principals"]').exists()).toBe(true)
    })

    it('says so when the server sent no principal listing at all', async () => {
        const { wrapper } = mountTab({
            get: { '/usage/me': () => ({}) },
        })
        await flushPromises()
        await flushPromises()
        expect(wrapper.find('[data-testid="usage-overview-no-principals"]').exists()).toBe(true)
    })

    it('draws no bar when the server sent no series', async () => {
        const { wrapper } = mountTab({
            get: { '/usage/me/series?window=day': () => ({ window: 'day' }) },
        })
        await flushPromises()
        await flushPromises()
        expect(wrapper.find('[data-testid="usage-spend-empty"]').exists()).toBe(true)
    })

    it('surfaces a failed load', async () => {
        const { wrapper } = mountTab({
            get: {
                '/usage/me': () => {
                    throw new Error('Boom')
                },
            },
        })
        await flushPromises()
        await flushPromises()
        expect(wrapper.find('[data-testid="usage-overview-error"]').text()).toContain('Boom')
    })
})

describe('OverviewTab as an admin', () => {
    it('shows the whole installation next to the caller\'s own usage', async () => {
        const { wrapper } = mountTab({ isAdmin: true })
        await flushPromises()
        await flushPromises()

        expect(wrapper.find('[data-testid="usage-install"]').exists()).toBe(true)
        // Both faces say which they are.
        expect(wrapper.find('[data-testid="usage-install"]').text()).toContain('This installation')
        expect(wrapper.find('[data-testid="usage-own"]').text()).toContain('Your usage')
    })

    it('shows what the installation spent in the last 30 days', async () => {
        const { wrapper } = mountTab({ isAdmin: true })
        await flushPromises()
        await flushPromises()
        expect(wrapper.find('[data-testid="usage-install-total-spend"]').text()).toContain(
            '1,321.75',
        )
        expect(wrapper.find('[data-testid="usage-install-principals"]').text()).toContain('3')
    })

    it('shows the principals that spent the most', async () => {
        const { wrapper } = mountTab({ isAdmin: true })
        await flushPromises()
        await flushPromises()

        const ada = wrapper.find('[data-testid="usage-install-spender-12"]')
        expect(ada.text()).toContain('Ada Lovelace')
        expect(ada.text()).toContain('1,234.5')
        // The list is about the money that left the installation.
        expect(wrapper.find('[data-testid="usage-install-spender-56"]').exists()).toBe(false)
    })

    it('shows the credit pools that are empty', async () => {
        const { wrapper } = mountTab({ isAdmin: true })
        await flushPromises()
        await flushPromises()

        // A principal without a pool and a principal whose pool ran dry.
        expect(wrapper.find('[data-testid="usage-install-empty-pool-34"]').text()).toContain(
            'No credit pool',
        )
        expect(wrapper.find('[data-testid="usage-install-empty-pool-56"]').text()).toContain(
            'Grace Hopper',
        )
    })

    it('shows the models and tools that are used and cost nothing', async () => {
        const { wrapper } = mountTab({ isAdmin: true })
        await flushPromises()
        await flushPromises()

        expect(wrapper.find('[data-testid="usage-install-unpriced-model-0"]').text()).toContain(
            'internal-preview',
        )
        expect(wrapper.find('[data-testid="usage-install-unpriced-tool-0"]').text()).toContain(
            'weather',
        )
    })

    it('shows the calls that had a price and were not billed', async () => {
        const { wrapper } = mountTab({ isAdmin: true })
        await flushPromises()
        await flushPromises()

        // The principal ran these with their own configuration, so the
        // installation did not pay for them.
        expect(wrapper.find('[data-testid="usage-install-not-billed-model-0"]').text()).toContain(
            'claude-sonnet',
        )
        expect(wrapper.find('[data-testid="usage-install-not-billed-tool-0"]').text()).toContain(
            'echo',
        )
        // A price row with an empty provider prices every provider, so
        // the model is named without one.
        expect(wrapper.find('[data-testid="usage-install-not-billed-model-1"]').text()).toContain(
            'Any provider',
        )
    })

    it('says so when every call was billed', async () => {
        const { wrapper } = mountTab({
            isAdmin: true,
            get: { '/usage/unpriced': () => ({ models: [], tools: [] }) },
        })
        await flushPromises()
        await flushPromises()

        expect(wrapper.find('[data-testid="usage-install-not-billed-empty"]').exists()).toBe(true)
    })

    it('shows the caller\'s own principals as well', async () => {
        const { wrapper } = mountTab({ isAdmin: true })
        await flushPromises()
        await flushPromises()
        expect(wrapper.find('[data-testid="usage-principal-12"]').text()).toContain('Ada Lovelace')
    })

    it('shows no install-wide face to a caller who cannot see it', async () => {
        const { wrapper, host } = mountTab({ isAdmin: false })
        await flushPromises()
        await flushPromises()
        expect(wrapper.find('[data-testid="usage-install"]').exists()).toBe(false)
        // The admin listing is not asked for: it would be refused.
        expect(host.api.get).not.toHaveBeenCalledWith('/usage/principals')
    })

    it('shows the loading state while the installation is on its way', async () => {
        const { wrapper } = mountTab({
            isAdmin: true,
            get: { '/usage/principals': () => new Promise(() => {}) },
        })
        await flushPromises()
        expect(wrapper.find('[data-testid="usage-install-loading"]').exists()).toBe(true)
    })

    it('surfaces a failed load of the installation', async () => {
        const { wrapper } = mountTab({
            isAdmin: true,
            get: {
                '/usage/principals': () => {
                    throw new Error('Boom')
                },
            },
        })
        await flushPromises()
        await flushPromises()
        expect(wrapper.find('[data-testid="usage-install-error"]').text()).toContain('Boom')
    })

    it('surfaces a failed load of the unpriced report', async () => {
        const { wrapper } = mountTab({
            isAdmin: true,
            get: {
                '/usage/unpriced': () => {
                    throw new Error('Boom')
                },
            },
        })
        await flushPromises()
        await flushPromises()
        expect(wrapper.find('[data-testid="usage-install-error"]').text()).toContain('Boom')
    })

    it('marks the caller as not an admin when the API refuses the listing', async () => {
        const { wrapper, pinia } = mountTab({
            isAdmin: true,
            get: {
                '/usage/principals': () => {
                    throw forbidden()
                },
            },
        })
        await flushPromises()
        await flushPromises()
        // A 403 is the server's answer, not a failure to retry.
        expect(useUsageStore(pinia).adminDenied).toBe(true)
        expect(wrapper.find('[data-testid="usage-install-error"]').exists()).toBe(false)
        expect(wrapper.find('[data-testid="usage-install"]').exists()).toBe(false)
    })

    it('marks the caller as not an admin when the API refuses the unpriced report', async () => {
        const { wrapper, pinia } = mountTab({
            isAdmin: true,
            get: {
                '/usage/unpriced': () => {
                    throw forbidden()
                },
            },
        })
        await flushPromises()
        await flushPromises()
        expect(useUsageStore(pinia).adminDenied).toBe(true)
        expect(wrapper.find('[data-testid="usage-install-error"]').exists()).toBe(false)
    })

    it('says so for a model that was used without a provider', async () => {
        const { wrapper } = mountTab({
            isAdmin: true,
            get: {
                '/usage/unpriced': () => ({
                    models: [{ provider: '', model: 'internal-preview', calls: 12 }],
                    tools: [],
                }),
            },
        })
        await flushPromises()
        await flushPromises()
        expect(wrapper.find('[data-testid="usage-install-unpriced-model-0"]').text()).toContain(
            'Any provider',
        )
    })

    it('says so when nothing was spent', async () => {
        const { wrapper } = mountTab({
            isAdmin: true,
            get: {
                '/usage/principals': () => ({
                    principals: [
                        { id: 12, type: 'user', name: 'Ada Lovelace', balance: 10, spend_30d: 0 },
                    ],
                }),
            },
        })
        await flushPromises()
        await flushPromises()
        expect(wrapper.find('[data-testid="usage-install-no-spenders"]').exists()).toBe(true)
    })

    it('says so when every principal has credits', async () => {
        const { wrapper } = mountTab({
            isAdmin: true,
            get: {
                '/usage/principals': () => ({
                    principals: [
                        { id: 12, type: 'user', name: 'Ada Lovelace', balance: 10, spend_30d: 5 },
                    ],
                }),
            },
        })
        await flushPromises()
        await flushPromises()
        expect(wrapper.find('[data-testid="usage-install-no-empty-pools"]').exists()).toBe(true)
    })

    it('says so when everything that was used has a price', async () => {
        const { wrapper } = mountTab({
            isAdmin: true,
            get: { '/usage/unpriced': () => ({ models: [], tools: [] }) },
        })
        await flushPromises()
        await flushPromises()
        expect(wrapper.find('[data-testid="usage-install-unpriced-empty"]').exists()).toBe(true)
    })

    it('reads a report the server sent without its rows', async () => {
        const { wrapper } = mountTab({
            isAdmin: true,
            get: { '/usage/unpriced': () => ({}) },
        })
        await flushPromises()
        await flushPromises()
        expect(wrapper.find('[data-testid="usage-install-unpriced-empty"]').exists()).toBe(true)
    })
})
