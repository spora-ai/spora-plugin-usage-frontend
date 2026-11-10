import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PriceRowEditor from '../src/components/PriceRowEditor.vue'
import type { UsageKnownModel, UsageKnownTool, UsagePrice } from '../src/types'

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

const KNOWN_MODELS: UsageKnownModel[] = [
    { provider: 'openai_compatible', model: 'gpt-4o' },
    { provider: 'anthropic', model: 'claude-sonnet' },
]

const KNOWN_TOOLS: UsageKnownTool[] = [
    { tool_class: 'Spora\\Tools\\MediaTool', tool_name: 'media' },
]

function mountEditor(overrides: Partial<UsagePrice> = {}, index = 0) {
    return mount(PriceRowEditor, {
        props: {
            price: { ...price, ...overrides },
            index,
            locale: 'en',
            idPrefix: 'usage',
            knownModels: KNOWN_MODELS,
            knownTools: KNOWN_TOOLS,
        },
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
        expect(changedRow(wrapper)).toEqual({ ...price, kind: 'tool', provider: '' })
    })

    it('offers the operation for a tool only', async () => {
        const wrapper = mountEditor()
        expect(wrapper.find('[data-testid="usage-price-operation-0"]').exists()).toBe(false)
        expect(wrapper.find('label[for="usage-price-operation-0"]').exists()).toBe(false)

        await wrapper.find('[data-testid="usage-price-kind-0"]').setValue('tool')

        expect(wrapper.find('[data-testid="usage-price-operation-0"]').exists()).toBe(true)
        expect(wrapper.find('label[for="usage-price-operation-0"]').exists()).toBe(true)
    })

    it('offers the call price for a tool only', async () => {
        const wrapper = mountEditor()
        expect(wrapper.find('[data-testid="usage-price-call-0"]').exists()).toBe(false)
        expect(wrapper.find('label[for="usage-price-call-0"]').exists()).toBe(false)

        await wrapper.find('[data-testid="usage-price-kind-0"]').setValue('tool')

        expect(wrapper.find('[data-testid="usage-price-call-0"]').exists()).toBe(true)
        expect(wrapper.find('label[for="usage-price-call-0"]').exists()).toBe(true)
    })

    it('offers the provider for a model only', async () => {
        // The server refuses a provider on a tool price, so the field is
        // not offered where it cannot be stored.
        const wrapper = mountEditor()
        expect(wrapper.find('[data-testid="usage-price-provider-0"]').exists()).toBe(true)

        await wrapper.find('[data-testid="usage-price-kind-0"]').setValue('tool')

        expect(wrapper.find('[data-testid="usage-price-provider-0"]').exists()).toBe(false)
    })

    it('clears the field the new kind cannot store', async () => {
        const wrapper = mountEditor()
        await wrapper.find('[data-testid="usage-price-kind-0"]').setValue('tool')
        expect(changedRow(wrapper)).toEqual({ ...price, kind: 'tool', provider: '' })

        const tool = mountEditor({ kind: 'tool', operation: 'render' })
        await tool.find('[data-testid="usage-price-kind-0"]').setValue('model')
        expect(changedRow(tool)).toEqual({ ...price, kind: 'model', operation: '' })
    })

    it('sends the provider the operator typed', async () => {
        const wrapper = mountEditor()
        await wrapper.find('[data-testid="usage-price-provider-0"]').setValue('anthropic')
        expect(changedRow(wrapper)).toEqual({ ...price, provider: 'anthropic' })
    })

    it('offers the models the installation knows', () => {
        const wrapper = mountEditor()
        const options = wrapper
            .findAll('[data-testid="usage-price-key-select-0"] option')
            .map((option) => option.text())

        expect(options).toContain('openai_compatible / gpt-4o')
        expect(options).toContain('anthropic / claude-sonnet')
        expect(options).toContain('Other…')
    })

    it('fills the row from the model that was picked', async () => {
        const wrapper = mountEditor({ provider: '', key: '' })
        const option = wrapper
            .find<HTMLSelectElement>('[data-testid="usage-price-key-select-0"]')
            .findAll('option')
            .find((candidate) => candidate.text() === 'anthropic / claude-sonnet')

        await wrapper
            .find('[data-testid="usage-price-key-select-0"]')
            .setValue(option?.element.value)

        expect(changedRow(wrapper)).toEqual({ ...price, provider: 'anthropic', key: 'claude-sonnet' })
    })

    it('offers the tools the installation knows, for a tool row', async () => {
        const wrapper = mountEditor({ kind: 'tool' })
        const options = wrapper
            .findAll('[data-testid="usage-price-key-select-0"] option')
            .map((option) => option.text())

        expect(options).toContain('media')
        expect(options).not.toContain('openai_compatible / gpt-4o')
    })

    it('fills the row with the class of the tool that was picked', async () => {
        const wrapper = mountEditor({ kind: 'tool', key: '' })
        const option = wrapper
            .find<HTMLSelectElement>('[data-testid="usage-price-key-select-0"]')
            .findAll('option')
            .find((candidate) => candidate.text() === 'media')

        await wrapper
            .find('[data-testid="usage-price-key-select-0"]')
            .setValue(option?.element.value)

        expect(changedRow(wrapper)).toEqual({
            ...price,
            kind: 'tool',
            provider: '',
            key: 'Spora\\Tools\\MediaTool',
        })
    })

    it('sends the key the operator typed', async () => {
        const wrapper = mountEditor()
        await wrapper.find('[data-testid="usage-price-key-0"]').setValue('claude-sonnet')
        expect(changedRow(wrapper)).toEqual({ ...price, key: 'claude-sonnet' })
    })

    it('always offers the free-text field, so a price for something unused can be entered', () => {
        // The dropdown is a shortcut that fills the field, not a gate in
        // front of it: a model the installation has never used still has
        // to be enterable.
        const wrapper = mountEditor()
        expect(wrapper.find('[data-testid="usage-price-key-0"]').exists()).toBe(true)
    })

    it('shows the row\'s own key in the dropdown when the installation does not know it', () => {
        // A dropdown whose value matches no option renders blank, and a
        // row that looks empty is a row whose price the operator cannot
        // see.
        const wrapper = mountEditor({ key: 'a-model-nobody-used' })
        const options = wrapper
            .find<HTMLSelectElement>('[data-testid="usage-price-key-select-0"]')
            .findAll('option')
            .map((option) => option.text())

        expect(options).toContain('a-model-nobody-used')
        expect(
            wrapper.find<HTMLSelectElement>('[data-testid="usage-price-key-select-0"]').element
                .value,
        ).not.toBe('__custom__')
    })

    it('shows the dropdown on the known option for a key the installation knows', () => {
        const wrapper = mountEditor()
        const selected = wrapper.find<HTMLSelectElement>(
            '[data-testid="usage-price-key-select-0"]',
        ).element.value
        expect(selected).not.toBe('__custom__')
    })

    it('leaves the row alone when the operator picks "Other…"', async () => {
        // "Other…" is what a key the installation does not know looks
        // like; the field below is where the operator types it.
        const wrapper = mountEditor()
        await wrapper.find('[data-testid="usage-price-key-select-0"]').setValue('__custom__')
        expect(wrapper.emitted('change')).toBeUndefined()
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

    it('keeps the digits of a price the operator is typing', async () => {
        const wrapper = mountEditor()
        const input = wrapper.find<HTMLInputElement>('[data-testid="usage-price-input-0"]')
        // A price is typed digit by digit, and every prefix of it parses to
        // a number that is not the text: "0.000002" is 0 until the last
        // digit is there. A field bound to that number would be rewritten
        // under the cursor.
        for (const prefix of ['0', '0.', '0.0', '0.00', '0.000', '0.0000', '0.00000', '0.000002']) {
            await input.setValue(prefix)
            // The price book hands the row back after every keystroke.
            const changed = wrapper.emitted('change')?.at(-1)?.[0] as UsagePrice
            await wrapper.setProps({ price: changed })
            expect(input.element.value).toBe(prefix)
        }
        const changes = wrapper.emitted('change') as UsagePrice[][]
        expect(changes[changes.length - 1]?.[0]?.input_price).toBe(0.000002)
    })

    it('keeps the digits of every price the operator is typing', async () => {
        const wrapper = mountEditor({ kind: 'tool' })
        for (const field of ['output', 'cached', 'call']) {
            const input = wrapper.find<HTMLInputElement>(`[data-testid="usage-price-${field}-0"]`)
            for (const prefix of ['0.', '0.0', '0.000006']) {
                await input.setValue(prefix)
                const changed = wrapper.emitted('change')?.at(-1)?.[0] as UsagePrice
                await wrapper.setProps({ price: changed })
                expect(input.element.value).toBe(prefix)
            }
        }
    })

    it('takes the text of a price the parent changed', async () => {
        const wrapper = mountEditor()
        await wrapper.setProps({ price: { ...price, input_price: 0.0005 } })
        expect(
            wrapper.find<HTMLInputElement>('[data-testid="usage-price-input-0"]').element.value,
        ).toBe('0.0005')
    })

    it('keeps the text the operator is typing when the parent hands the row back', async () => {
        const wrapper = mountEditor()
        await wrapper.find('[data-testid="usage-price-input-0"]').setValue('0.')
        // The parent stores what the field parses to and hands it back.
        await wrapper.setProps({ price: { ...price, input_price: 0 } })
        expect(
            wrapper.find<HTMLInputElement>('[data-testid="usage-price-input-0"]').element.value,
        ).toBe('0.')
    })

    it('names the button that removes the row', () => {
        const wrapper = mountEditor()
        expect(wrapper.find('[data-testid="usage-price-remove-0"]').attributes('aria-label')).toBe(
            'Remove price 1',
        )
        const second = mountEditor({}, 1)
        expect(second.find('[data-testid="usage-price-remove-1"]').attributes('aria-label')).toBe(
            'Remove price 2',
        )
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
