import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import LimitRowEditor from '../src/components/LimitRowEditor.vue'
import type { UsageLimitDraft } from '../src/types'

const limit: UsageLimitDraft = {
    window: 'month',
    window_size: 1,
    unit: 'credits',
    cap: 10000,
    mode: 'hard',
    enabled: true,
    spend: 1234.5,
    remaining: 8765.5,
}

function mountEditor(overrides: Partial<UsageLimitDraft> = {}, index = 0) {
    return mount(LimitRowEditor, {
        props: { limit: { ...limit, ...overrides }, index, locale: 'en', idPrefix: 'usage' },
    })
}

function changedRow(wrapper: ReturnType<typeof mountEditor>): UsageLimitDraft {
    const changes = wrapper.emitted('change')
    expect(changes).toHaveLength(1)
    return changes?.[0]?.[0] as UsageLimitDraft
}

describe('LimitRowEditor', () => {
    it('shows the figures the server computed', () => {
        const wrapper = mountEditor()
        expect(wrapper.find('[data-testid="usage-limit-figures-0"]').text()).toContain('1,234.5')
        expect(wrapper.find('[data-testid="usage-limit-figures-0"]').text()).toContain('8,765.5')
    })

    it('hands the whole row back when the operator typed a cap', async () => {
        const wrapper = mountEditor()
        await wrapper.find('[data-testid="usage-limit-cap-0"]').setValue('500')
        expect(changedRow(wrapper)).toEqual({ ...limit, cap: 500 })
    })

    it('sends zero for a cap the operator cleared', async () => {
        const wrapper = mountEditor()
        await wrapper.find('[data-testid="usage-limit-cap-0"]').setValue('')
        expect(changedRow(wrapper)).toEqual({ ...limit, cap: 0 })
    })

    it('keeps the digits of a cap the operator is typing', async () => {
        const wrapper = mountEditor()
        const input = wrapper.find<HTMLInputElement>('[data-testid="usage-limit-cap-0"]')
        // A cap is typed digit by digit, and every prefix of it parses to a
        // number that is not the text: "100.50" is 100 until the last digit
        // is there. A field bound to that number would be rewritten under
        // the cursor.
        for (const prefix of ['1', '10', '100', '100.', '100.5', '100.50']) {
            await input.setValue(prefix)
            // The limits tab hands the row back after every keystroke.
            const changed = wrapper.emitted('change')?.at(-1)?.[0] as UsageLimitDraft
            await wrapper.setProps({ limit: changed })
            expect(input.element.value).toBe(prefix)
        }
        const changes = wrapper.emitted('change') as UsageLimitDraft[][]
        expect(changes[changes.length - 1]?.[0]?.cap).toBe(100.5)
    })

    it('takes the text of a cap the parent changed', async () => {
        const wrapper = mountEditor()
        await wrapper.setProps({ limit: { ...limit, cap: 42.5 } })
        expect(
            wrapper.find<HTMLInputElement>('[data-testid="usage-limit-cap-0"]').element.value,
        ).toBe('42.5')
    })

    it('changes the unit of the row', async () => {
        const wrapper = mountEditor()
        await wrapper.find('[data-testid="usage-limit-unit-0"]').setValue('output_tokens')
        expect(changedRow(wrapper)).toEqual({ ...limit, unit: 'output_tokens' })
    })

    it('changes the mode of the row', async () => {
        const wrapper = mountEditor()
        await wrapper.find('[data-testid="usage-limit-mode-0"]').setValue('soft')
        expect(changedRow(wrapper)).toEqual({ ...limit, mode: 'soft' })
    })

    it('turns the row off', async () => {
        const wrapper = mountEditor()
        await wrapper.find('[data-testid="usage-limit-enabled-0"]').setValue(false)
        expect(changedRow(wrapper)).toEqual({ ...limit, enabled: false })
    })

    it('changes the window of the row', async () => {
        const wrapper = mountEditor()
        await wrapper.find('[data-testid="usage-limit-window-0"]').setValue('week')
        expect(changedRow(wrapper)).toEqual({ ...limit, window: 'week' })
    })

    it('offers the window size only for a rolling window', async () => {
        const wrapper = mountEditor()
        expect(wrapper.find('[data-testid="usage-limit-window-size-0"]').exists()).toBe(false)
        expect(wrapper.find('label[for="usage-limit-window-size-0"]').exists()).toBe(false)

        await wrapper.find('[data-testid="usage-limit-window-0"]').setValue('rolling')
        expect(wrapper.find('[data-testid="usage-limit-window-size-0"]').exists()).toBe(true)
        expect(wrapper.find('label[for="usage-limit-window-size-0"]').exists()).toBe(true)

        await wrapper.find('[data-testid="usage-limit-window-0"]').setValue('month')
        expect(wrapper.find('[data-testid="usage-limit-window-size-0"]').exists()).toBe(false)
        expect(wrapper.find('label[for="usage-limit-window-size-0"]').exists()).toBe(false)
    })

    it('sends the window size of a rolling row', async () => {
        const wrapper = mountEditor({ window: 'rolling', window_size: 24 })
        await wrapper.find('[data-testid="usage-limit-window-size-0"]').setValue('6')
        expect(changedRow(wrapper)).toEqual({ ...limit, window: 'rolling', window_size: 6 })
    })

    it('sends one hour for a rolling row whose size was cleared', async () => {
        const wrapper = mountEditor({ window: 'rolling', window_size: 24 })
        await wrapper.find('[data-testid="usage-limit-window-size-0"]').setValue('')
        expect(changedRow(wrapper)).toEqual({ ...limit, window: 'rolling', window_size: 1 })
    })

    it('removes the row', async () => {
        const wrapper = mountEditor()
        await wrapper.find('[data-testid="usage-limit-remove-0"]').trigger('click')
        expect(wrapper.emitted('remove')).toHaveLength(1)
    })

    it('names the button that removes the row', () => {
        const wrapper = mountEditor()
        expect(wrapper.find('[data-testid="usage-limit-remove-0"]').attributes('aria-label')).toBe(
            'Remove limit 1',
        )
        const second = mountEditor({}, 1)
        expect(second.find('[data-testid="usage-limit-remove-1"]').attributes('aria-label')).toBe(
            'Remove limit 2',
        )
    })

    it('follows the row its parent hands over', async () => {
        const wrapper = mountEditor()
        await wrapper.setProps({ limit: { ...limit, cap: 42 } })
        expect(
            wrapper.find<HTMLInputElement>('[data-testid="usage-limit-cap-0"]').element.value,
        ).toBe('42')
    })

    it('does not touch the row of its parent when it hands one back', async () => {
        const wrapper = mountEditor()
        await wrapper.find('[data-testid="usage-limit-cap-0"]').setValue('500')
        expect(changedRow(wrapper)).not.toBe(limit)
        expect(limit.cap).toBe(10000)
    })
})
