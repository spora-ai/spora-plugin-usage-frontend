import { describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import PrincipalScope from '../src/components/PrincipalScope.vue'
import { useUsageStore } from '../src/stores/usage'

const SUMMARIES = [
    { id: 12, type: 'user', name: 'Ada Lovelace', balance: 250.5, spend_30d: 1234.5 },
    { id: 34, type: 'group', name: 'Research', balance: null, spend_30d: 87.25 },
] as const

function mountScope(principals: readonly unknown[] = SUMMARIES) {
    const pinia = createPinia()
    const wrapper = mount(PrincipalScope, {
        props: { idPrefix: 'usage-1' },
        global: { plugins: [pinia] },
    })
    useUsageStore(pinia).setPrincipals(principals as never)
    return { wrapper, pinia }
}

describe('PrincipalScope', () => {
    it('asks for a principal when none is chosen', () => {
        const { wrapper } = mountScope()
        expect(wrapper.find('[data-testid="usage-1-scope-toggle"]').text()).toContain(
            'Choose a principal',
        )
    })

    it('names the chosen principal on the toggle', async () => {
        const { wrapper, pinia } = mountScope()
        useUsageStore(pinia).selectPrincipal(12)
        await flushPromises()
        expect(wrapper.find('[data-testid="usage-1-scope-toggle"]').text()).toContain(
            'Ada Lovelace',
        )
    })

    it('keeps the menu closed until it is asked for', async () => {
        const { wrapper } = mountScope()
        expect(wrapper.find('[data-testid="usage-1-scope-menu"]').exists()).toBe(false)
        await wrapper.find('[data-testid="usage-1-scope-toggle"]').trigger('click')
        expect(wrapper.find('[data-testid="usage-1-scope-menu"]').exists()).toBe(true)
    })

    it('lists every principal with its balance and its 30-day spend', async () => {
        const { wrapper } = mountScope()
        await wrapper.find('[data-testid="usage-1-scope-toggle"]').trigger('click')
        await flushPromises()

        const ada = wrapper.find('[data-testid="usage-1-scope-option-12"]')
        expect(ada.text()).toContain('Ada Lovelace')
        expect(ada.text()).toContain('1,234.5')
        expect(ada.text()).toContain('250.5')

        const research = wrapper.find('[data-testid="usage-1-scope-option-34"]')
        expect(research.text()).toContain('Research')
        expect(research.text()).toContain('No credit pool')
    })

    it('scopes the admin tabs to the principal that was picked', async () => {
        const { wrapper, pinia } = mountScope()
        await wrapper.find('[data-testid="usage-1-scope-toggle"]').trigger('click')
        await flushPromises()
        await wrapper.find('[data-testid="usage-1-scope-option-34"]').trigger('click')
        await flushPromises()

        expect(useUsageStore(pinia).selectedPrincipalId).toBe(34)
        // The menu closes on a choice, so the operator sees the scope they
        // just picked rather than a list over the panel.
        expect(wrapper.find('[data-testid="usage-1-scope-menu"]').exists()).toBe(false)
    })

    it('marks the principal that is in scope', async () => {
        const { wrapper, pinia } = mountScope()
        useUsageStore(pinia).selectPrincipal(34)
        await wrapper.find('[data-testid="usage-1-scope-toggle"]').trigger('click')
        await flushPromises()

        expect(
            wrapper.find('[data-testid="usage-1-scope-option-34"]').attributes('aria-current'),
        ).toBe('true')
        expect(
            wrapper.find('[data-testid="usage-1-scope-option-12"]').attributes('aria-current'),
        ).toBeUndefined()
    })

    it('says so when the installation has no principals', async () => {
        const { wrapper } = mountScope([])
        await wrapper.find('[data-testid="usage-1-scope-toggle"]').trigger('click')
        await flushPromises()
        expect(wrapper.find('[data-testid="usage-1-scope-empty"]').exists()).toBe(true)
    })
})
