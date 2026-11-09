import { describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import OverviewTab from '../src/components/OverviewTab.vue'
import { buildHost, type HostOptions } from './helpers/host'

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

function mountTab(options: HostOptions = {}) {
    const host = buildHost({
        ...options,
        get: {
            '/usage/me': () => meResponse,
            '/usage/me/series?window=day': () => seriesResponse,
            '/usage/me/series?window=week': () => ({ window: 'week', points: [] }),
            ...options.get,
        },
    })
    const wrapper = mount(OverviewTab, {
        props: { hostContext: host.context },
        global: { plugins: [createPinia()] },
    })
    return { wrapper, host }
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

    it('says so when the caller has no visible principal', async () => {
        const { wrapper } = mountTab({
            get: { '/usage/me': () => ({ principals: [] }) },
        })
        await flushPromises()
        await flushPromises()
        expect(wrapper.find('[data-testid="usage-overview-no-principals"]').exists()).toBe(true)
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
