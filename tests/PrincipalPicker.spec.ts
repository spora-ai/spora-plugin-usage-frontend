import { describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import PrincipalPicker from '../src/components/PrincipalPicker.vue'
import { useUsageStore } from '../src/stores/usage'
import { buildHost, forbidden, type HostOptions } from './helpers/host'

const LISTING = {
    principals: [
        { id: 12, type: 'user', name: 'Ada Lovelace', balance: 250.5, spend_30d: 1234.5 },
        { id: 34, type: 'group', name: 'Research', balance: null, spend_30d: 87.25 },
    ],
}

function mountPicker(options: HostOptions = {}, listing: unknown = LISTING) {
    const host = buildHost({
        isAdmin: true,
        ...options,
        get: {
            '/usage/principals': () => listing,
            ...options.get,
        },
    })
    const pinia = createPinia()
    const wrapper = mount(PrincipalPicker, {
        props: { hostContext: host.context, idPrefix: 'limits' },
        global: { plugins: [pinia] },
    })
    return { wrapper, host, pinia }
}

describe('PrincipalPicker', () => {
    it('asks for a principal when none is chosen', async () => {
        const { wrapper } = mountPicker()
        await flushPromises()
        expect(wrapper.find('[data-testid="limits-principal-toggle"]').text()).toContain(
            'Choose a principal',
        )
    })

    it('names the chosen principal on the toggle', async () => {
        const { wrapper, pinia } = mountPicker()
        await flushPromises()
        useUsageStore(pinia).selectPrincipal(12)
        await flushPromises()
        expect(wrapper.find('[data-testid="limits-principal-toggle"]').text()).toContain(
            'Ada Lovelace',
        )
    })

    it('keeps the menu closed until it is asked for', async () => {
        const { wrapper } = mountPicker()
        await flushPromises()
        expect(wrapper.find('[data-testid="limits-principal-menu"]').exists()).toBe(false)
        await wrapper.find('[data-testid="limits-principal-toggle"]').trigger('click')
        expect(wrapper.find('[data-testid="limits-principal-menu"]').exists()).toBe(true)
    })

    it('lists every principal with its balance and its 30-day spend', async () => {
        const { wrapper } = mountPicker()
        await flushPromises()
        await wrapper.find('[data-testid="limits-principal-toggle"]').trigger('click')
        await flushPromises()

        const ada = wrapper.find('[data-testid="limits-principal-option-12"]')
        expect(ada.text()).toContain('Ada Lovelace')
        expect(ada.text()).toContain('1,234.5')
        expect(ada.text()).toContain('250.5')

        const research = wrapper.find('[data-testid="limits-principal-option-34"]')
        expect(research.text()).toContain('Research')
        expect(research.text()).toContain('No credit pool')
    })

    it('scopes the admin tabs to the principal that was picked', async () => {
        const { wrapper, pinia } = mountPicker()
        await flushPromises()
        await wrapper.find('[data-testid="limits-principal-toggle"]').trigger('click')
        await flushPromises()
        await wrapper.find('[data-testid="limits-principal-option-34"]').trigger('click')
        await flushPromises()

        expect(useUsageStore(pinia).selectedPrincipalId).toBe(34)
        // The menu closes on a choice, so the operator sees the scope they
        // just picked rather than a list over the panel.
        expect(wrapper.find('[data-testid="limits-principal-menu"]').exists()).toBe(false)
    })

    it('marks the principal that is in scope', async () => {
        const { wrapper, pinia } = mountPicker()
        await flushPromises()
        useUsageStore(pinia).selectPrincipal(34)
        await wrapper.find('[data-testid="limits-principal-toggle"]').trigger('click')
        await flushPromises()

        expect(
            wrapper.find('[data-testid="limits-principal-option-34"]').attributes('aria-current'),
        ).toBe('true')
        expect(
            wrapper.find('[data-testid="limits-principal-option-12"]').attributes('aria-current'),
        ).toBeUndefined()
    })

    it('says so when the installation has no principals', async () => {
        const { wrapper } = mountPicker({}, { principals: [] })
        await flushPromises()
        await wrapper.find('[data-testid="limits-principal-toggle"]').trigger('click')
        await flushPromises()
        expect(wrapper.find('[data-testid="limits-principal-empty"]').exists()).toBe(true)
    })

    it('loads the principal listing itself', async () => {
        const { wrapper, host, pinia } = mountPicker()
        await flushPromises()
        expect(host.api.get).toHaveBeenCalledWith('/usage/principals')
        expect(useUsageStore(pinia).principals).toHaveLength(2)
        expect(wrapper.find('[data-testid="usage-principal-picker"]').exists()).toBe(true)
    })

    it('offers nothing to a caller who cannot configure anything', async () => {
        const { wrapper, host } = mountPicker({ isAdmin: false })
        await flushPromises()
        expect(wrapper.find('[data-testid="usage-principal-picker"]').exists()).toBe(false)
        // The admin listing is not asked for: it would be refused.
        expect(host.api.get).not.toHaveBeenCalledWith('/usage/principals')
    })

    it('shows the loading state while the listing is on its way', async () => {
        const { wrapper } = mountPicker({}, new Promise(() => {}))
        await flushPromises()
        expect(wrapper.find('[data-testid="limits-principal-loading"]').exists()).toBe(true)
    })

    it('surfaces a failed load of the listing', async () => {
        const { wrapper } = mountPicker({
            get: {
                '/usage/principals': () => {
                    throw new Error('Boom')
                },
            },
        })
        await flushPromises()
        expect(wrapper.find('[data-testid="limits-principal-error"]').text()).toContain('Boom')
    })

    it('marks the caller as not an admin when the API refuses the listing', async () => {
        const { wrapper, pinia } = mountPicker({
            get: {
                '/usage/principals': () => {
                    throw forbidden()
                },
            },
        })
        await flushPromises()
        // A 403 is the server's answer, not a failure to retry.
        expect(useUsageStore(pinia).adminDenied).toBe(true)
        expect(wrapper.find('[data-testid="limits-principal-error"]').exists()).toBe(false)
    })

    it('asks for the listing only once, however many pickers open', async () => {
        const { host, pinia } = mountPicker()
        await flushPromises()
        const second = mount(PrincipalPicker, {
            props: { hostContext: host.context, idPrefix: 'budget' },
            global: { plugins: [pinia] },
        })
        await flushPromises()

        expect(host.api.get.mock.calls.filter((call) => call[0] === '/usage/principals')).toHaveLength(
            1,
        )
        expect(second.find('[data-testid="budget-principal-toggle"]').exists()).toBe(true)
    })

    it('reads the listing the store already holds', async () => {
        const { host, pinia } = mountPicker()
        await flushPromises()
        const second = mount(PrincipalPicker, {
            props: { hostContext: host.context, idPrefix: 'budget' },
            global: { plugins: [pinia] },
        })
        await flushPromises()
        await second.find('[data-testid="budget-principal-toggle"]').trigger('click')
        await flushPromises()

        expect(second.find('[data-testid="budget-principal-option-12"]').text()).toContain(
            'Ada Lovelace',
        )
    })

    it('reads a listing the server sent without a principal list', async () => {
        const { wrapper } = mountPicker({}, {})
        await flushPromises()
        await wrapper.find('[data-testid="limits-principal-toggle"]').trigger('click')
        await flushPromises()
        expect(wrapper.find('[data-testid="limits-principal-empty"]').exists()).toBe(true)
    })
})
