import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PriceRowEditor from '../src/components/PriceRowEditor.vue'
import type { UsagePrice } from '../src/types'

const price: UsagePrice = {
    kind: 'model',
    provider: 'openai_compatible',
    key: 'gpt-4o',
    operation: '',
    input_price: 0.000002,
    output_price: 0.000008,
    cached_price: 0.0000005,
    call_price: 0,
}

function mountEditor(overrides: Partial<UsagePrice> = {}) {
    return mount(PriceRowEditor, {
        props: { price: { ...price, ...overrides }, index: 0, locale: 'en' },
    })
}

function changedRow(wrapper: ReturnType<typeof mountEditor>): UsagePrice {
    const changes = wrapper.emitted('change')
    expect(changes).toHaveLength(1)
    return changes?.[0]?.[0] as UsagePrice
}

describe('PriceRowEditor', () => {
    it('shows the price per million tokens under the price per token', () => {
        const wrapper = mountEditor()
        expect(wrapper.find('[data-testid="usage-price-input-million-0"]').text()).toBe('2')
    })

    it('changes the kind of the row', async () => {
        const wrapper = mountEditor()
        await wrapper.find('[data-testid="usage-price-kind-0"]').setValue('tool')
        expect(changedRow(wrapper)).toEqual({ ...price, kind: 'tool' })
    })

    it('offers the operation for a tool only', async () => {
        const wrapper = mountEditor()
        expect(wrapper.find('[data-testid="usage-price-operation-0"]').exists()).toBe(false)
        expect(wrapper.find('label[for="usage-price-operation-0"]').exists()).toBe(false)
        expect(wrapper.text()).toContain('Not applicable')

        await wrapper.find('[data-testid="usage-price-kind-0"]').setValue('tool')

        expect(wrapper.find('[data-testid="usage-price-operation-0"]').exists()).toBe(true)
        expect(wrapper.find('label[for="usage-price-operation-0"]').exists()).toBe(true)
        expect(wrapper.text()).not.toContain('Not applicable')
    })

    it('offers the call price for a tool only', async () => {
        const wrapper = mountEditor()
        expect(wrapper.find('[data-testid="usage-price-call-0"]').exists()).toBe(false)
        expect(wrapper.find('label[for="usage-price-call-0"]').exists()).toBe(false)

        await wrapper.find('[data-testid="usage-price-kind-0"]').setValue('tool')

        expect(wrapper.find('[data-testid="usage-price-call-0"]').exists()).toBe(true)
        expect(wrapper.find('label[for="usage-price-call-0"]').exists()).toBe(true)
    })

    it('sends the provider the operator typed', async () => {
        const wrapper = mountEditor()
        await wrapper.find('[data-testid="usage-price-provider-0"]').setValue('anthropic')
        expect(changedRow(wrapper)).toEqual({ ...price, provider: 'anthropic' })
    })

    it('sends the key the operator typed', async () => {
        const wrapper = mountEditor()
        await wrapper.find('[data-testid="usage-price-key-0"]').setValue('claude-sonnet')
        expect(changedRow(wrapper)).toEqual({ ...price, key: 'claude-sonnet' })
    })

    it('sends the operation the operator typed', async () => {
        const wrapper = mountEditor({ kind: 'tool' })
        await wrapper.find('[data-testid="usage-price-operation-0"]').setValue('weather.run')
        expect(changedRow(wrapper)).toEqual({ ...price, kind: 'tool', operation: 'weather.run' })
    })

    it('sends the input price the operator typed', async () => {
        const wrapper = mountEditor()
        await wrapper.find('[data-testid="usage-price-input-0"]').setValue('0.000004')
        expect(changedRow(wrapper)).toEqual({ ...price, input_price: 0.000004 })
    })

    it('sends the output price the operator typed', async () => {
        const wrapper = mountEditor()
        await wrapper.find('[data-testid="usage-price-output-0"]').setValue('0.000016')
        expect(changedRow(wrapper)).toEqual({ ...price, output_price: 0.000016 })
    })

    it('sends the cached price the operator typed', async () => {
        const wrapper = mountEditor()
        await wrapper.find('[data-testid="usage-price-cached-0"]').setValue('0.000001')
        expect(changedRow(wrapper)).toEqual({ ...price, cached_price: 0.000001 })
    })

    it('sends the call price the operator typed', async () => {
        const wrapper = mountEditor({ kind: 'tool' })
        await wrapper.find('[data-testid="usage-price-call-0"]').setValue('0.25')
        expect(changedRow(wrapper)).toEqual({ ...price, kind: 'tool', call_price: 0.25 })
    })

    it('sends zero for a price the operator cleared', async () => {
        const wrapper = mountEditor()
        await wrapper.find('[data-testid="usage-price-input-0"]').setValue('')
        expect(changedRow(wrapper)).toEqual({ ...price, input_price: 0 })
    })

    it('removes the row', async () => {
        const wrapper = mountEditor()
        await wrapper.find('[data-testid="usage-price-remove-0"]').trigger('click')
        expect(wrapper.emitted('remove')).toHaveLength(1)
    })

    it('follows the row its parent hands over', async () => {
        const wrapper = mountEditor()
        await wrapper.setProps({ price: { ...price, key: 'claude-sonnet' } })
        expect(
            wrapper.find<HTMLInputElement>('[data-testid="usage-price-key-0"]').element.value,
        ).toBe('claude-sonnet')
    })

    it('does not touch the row of its parent when it hands one back', async () => {
        const wrapper = mountEditor()
        await wrapper.find('[data-testid="usage-price-key-0"]').setValue('claude-sonnet')
        expect(changedRow(wrapper)).not.toBe(price)
        expect(price.key).toBe('gpt-4o')
    })
})
