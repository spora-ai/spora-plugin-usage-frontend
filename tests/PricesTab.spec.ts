import { describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import PricesTab from '../src/components/PricesTab.vue'
import { useUsageStore } from '../src/stores/usage'
import { buildHost, forbidden, type HostOptions } from './helpers/host'

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
    const pinia = createPinia()
    const wrapper = mount(PricesTab, {
        props: { hostContext: host.context },
        global: { plugins: [pinia] },
    })
    return { wrapper, host, pinia }
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

    it('adds a price the operator asked for', async () => {
        const { wrapper, host } = mountTab()
        await flushPromises()
        await flushPromises()
        await wrapper.find('[data-testid="usage-prices-add"]').trigger('click')
        await wrapper.find('[data-testid="usage-prices-save"]').trigger('click')
        await flushPromises()
        const [, body] = host.api.put.mock.calls[0] as [string, { prices: unknown[] }]
        expect(body.prices).toHaveLength(2)
        expect(body.prices[1]).toEqual({
            kind: 'model',
            provider: '',
            key: '',
            operation: '',
            input_price: 0,
            output_price: 0,
            cached_price: 0,
            call_price: 0,
        })
    })

    it('leaves the other rows alone when one of them is edited', async () => {
        const { wrapper, host } = mountTab()
        await flushPromises()
        await flushPromises()
        await wrapper.find('[data-testid="usage-prices-add"]').trigger('click')
        await wrapper.find('[data-testid="usage-price-input-0"]').setValue('0.000004')
        await wrapper.find('[data-testid="usage-prices-save"]').trigger('click')
        await flushPromises()
        const [, body] = host.api.put.mock.calls[0] as [string, { prices: { input_price: number }[] }]
        expect(body.prices[0]?.input_price).toBe(0.000004)
        expect(body.prices[1]?.input_price).toBe(0)
    })

    it('shows no prices when the server sent none', async () => {
        const { wrapper } = mountTab({
            get: { '/usage/prices': () => ({ prices: undefined }) },
        })
        await flushPromises()
        await flushPromises()
        expect(wrapper.findAll('[data-testid^="usage-price-editor-"]')).toHaveLength(0)
    })

    it('shows no unpriced model or tool when the server sent none', async () => {
        const { wrapper } = mountTab({
            get: { '/usage/unpriced': () => ({}) },
        })
        await flushPromises()
        await flushPromises()
        expect(wrapper.find('[data-testid="usage-unpriced-empty"]').exists()).toBe(true)
    })

    it('says so for a model that was used without a provider', async () => {
        const { wrapper } = mountTab({
            get: {
                '/usage/unpriced': () => ({
                    models: [{ provider: '', model: 'internal-preview', calls: 12 }],
                    tools: [],
                }),
            },
        })
        await flushPromises()
        await flushPromises()
        expect(wrapper.find('[data-testid="usage-unpriced-model-0"]').text()).toContain(
            'Any provider',
        )
    })

    it('surfaces a failed load of the prices', async () => {
        const { wrapper } = mountTab({
            get: {
                '/usage/prices': () => {
                    throw new Error('Boom')
                },
            },
        })
        await flushPromises()
        await flushPromises()
        expect(wrapper.find('[data-testid="usage-prices-error"]').text()).toContain('Boom')
    })

    it('marks the caller as not an admin when the API refuses the prices', async () => {
        const { wrapper, pinia } = mountTab({
            get: {
                '/usage/prices': () => {
                    throw forbidden()
                },
            },
        })
        await flushPromises()
        await flushPromises()
        expect(useUsageStore(pinia).adminDenied).toBe(true)
        expect(wrapper.find('[data-testid="usage-prices-error"]').exists()).toBe(false)
    })

    it('surfaces a failed save of the prices', async () => {
        const { wrapper } = mountTab({
            put: {
                '/usage/prices': () => {
                    throw new Error('Boom')
                },
            },
        })
        await flushPromises()
        await flushPromises()
        await wrapper.find('[data-testid="usage-prices-save"]').trigger('click')
        await flushPromises()
        expect(wrapper.find('[data-testid="usage-prices-save-error"]').text()).toContain('Boom')
    })

    it('marks the caller as not an admin when the API refuses the save', async () => {
        const { wrapper, pinia } = mountTab({
            put: {
                '/usage/prices': () => {
                    throw forbidden()
                },
            },
        })
        await flushPromises()
        await flushPromises()
        await wrapper.find('[data-testid="usage-prices-save"]').trigger('click')
        await flushPromises()
        expect(useUsageStore(pinia).adminDenied).toBe(true)
        expect(wrapper.find('[data-testid="usage-prices-save-error"]').exists()).toBe(false)
    })

    it('shows the save as running until the server has answered', async () => {
        let release: () => void = () => {}
        const pending = new Promise<void>((resolve) => {
            release = resolve
        })
        const { wrapper } = mountTab({
            put: { '/usage/prices': () => pending.then(() => priceResponse) },
        })
        await flushPromises()
        await flushPromises()
        await wrapper.find('[data-testid="usage-prices-save"]').trigger('click')
        expect(wrapper.find('[data-testid="usage-prices-save"]').text()).toBe('Saving…')
        release()
        await flushPromises()
        expect(wrapper.find('[data-testid="usage-prices-save"]').text()).toBe('Save prices')
    })

    it('shows no prices when the server answered the save without any', async () => {
        const { wrapper } = mountTab({
            put: { '/usage/prices': () => ({}) },
        })
        await flushPromises()
        await flushPromises()
        await wrapper.find('[data-testid="usage-prices-save"]').trigger('click')
        await flushPromises()
        expect(wrapper.findAll('[data-testid^="usage-price-editor-"]')).toHaveLength(0)
    })
})
