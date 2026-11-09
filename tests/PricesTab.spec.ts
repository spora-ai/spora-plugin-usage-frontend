import { describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import PricesTab from '../src/components/PricesTab.vue'
import { buildHost, type HostOptions } from './helpers/host'

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

const unpricedResponse = {
    models: [{ provider: 'openai_compatible', model: 'internal-preview', calls: 12 }],
    tools: [{ tool_class: 'Spora\\Tools\\WeatherTool', tool_name: 'weather', calls: 4 }],
}

function mountTab(options: HostOptions = {}) {
    const host = buildHost({
        ...options,
        get: {
            '/usage/prices': () => priceResponse,
            '/usage/unpriced': () => unpricedResponse,
            ...options.get,
        },
        put: {
            '/usage/prices': () => priceResponse,
            ...options.put,
        },
    })
    const wrapper = mount(PricesTab, {
        props: { hostContext: host.context },
        global: { plugins: [createPinia()] },
    })
    return { wrapper, host }
}

describe('PricesTab', () => {
    it('shows the price book and what is used for nothing yet', async () => {
        const { wrapper } = mountTab()
        await flushPromises()
        await flushPromises()
        expect(
            wrapper.find<HTMLInputElement>('[data-testid="usage-price-key-0"]').element.value,
        ).toBe('gpt-4o')
        expect(wrapper.find('[data-testid="usage-unpriced-model-0"]').text()).toContain(
            'internal-preview',
        )
        expect(wrapper.find('[data-testid="usage-unpriced-tool-0"]').text()).toContain('weather')
    })

    it('shows a token price in the unit the book reads in', async () => {
        const { wrapper } = mountTab()
        await flushPromises()
        await flushPromises()
        // 0.000002 credits per token is 2 credits per million tokens.
        expect(
            wrapper.find<HTMLInputElement>('[data-testid="usage-price-input-0"]').element.value,
        ).toBe('0.000002')
        expect(wrapper.find('[data-testid="usage-price-input-million-0"]').text()).toBe('2')
    })

    it('saves the whole price book', async () => {
        const { wrapper, host } = mountTab()
        await flushPromises()
        await flushPromises()
        await wrapper.find('[data-testid="usage-prices-save"]').trigger('click')
        await flushPromises()
        const [path, body] = host.api.put.mock.calls[0] as [string, { prices: unknown[] }]
        expect(path).toBe('/usage/prices')
        expect(body.prices).toHaveLength(1)
    })

    it('sends a price the operator changed', async () => {
        const { wrapper, host } = mountTab()
        await flushPromises()
        await flushPromises()
        await wrapper.find('[data-testid="usage-price-input-0"]').setValue('0.000004')
        await wrapper.find('[data-testid="usage-prices-save"]').trigger('click')
        await flushPromises()
        const [, body] = host.api.put.mock.calls[0] as [string, { prices: { input_price: number }[] }]
        expect(body.prices[0]?.input_price).toBe(0.000004)
    })

    it('drops a price the operator removed', async () => {
        const { wrapper, host } = mountTab()
        await flushPromises()
        await flushPromises()
        await wrapper.find('[data-testid="usage-price-remove-0"]').trigger('click')
        await wrapper.find('[data-testid="usage-prices-save"]').trigger('click')
        await flushPromises()
        const [, body] = host.api.put.mock.calls[0] as [string, { prices: unknown[] }]
        expect(body.prices).toEqual([])
    })

    it('says so when nothing is unpriced', async () => {
        const { wrapper } = mountTab({
            get: { '/usage/unpriced': () => ({ models: [], tools: [] }) },
        })
        await flushPromises()
        await flushPromises()
        expect(wrapper.find('[data-testid="usage-unpriced-empty"]').exists()).toBe(true)
    })
})
