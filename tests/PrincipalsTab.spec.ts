import { describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import PrincipalsTab from '../src/components/PrincipalsTab.vue'
import { useUsageStore } from '../src/stores/usage'
import { buildHost, forbidden, type HostOptions } from './helpers/host'

const summaryResponse = {
    principals: [
        { id: 12, type: 'user', name: 'Ada Lovelace', balance: 250.5, spend_30d: 1234.5 },
        { id: 34, type: 'group', name: 'Research', balance: null, spend_30d: 87.25 },
    ],
}

function mountTab(options: HostOptions = {}) {
    const host = buildHost({
        ...options,
        get: {
            '/usage/principals': () => summaryResponse,
            ...options.get,
        },
    })
    const wrapper = mount(PrincipalsTab, {
        props: { hostContext: host.context },
        global: { plugins: [createPinia()] },
    })
    return { wrapper, host }
}

describe('PrincipalsTab', () => {
    it('lists every principal with its balance and its 30-day spend', async () => {
        const { wrapper } = mountTab()
        await flushPromises()
        await flushPromises()
        expect(wrapper.find('[data-testid="usage-principal-row-12"]').text()).toContain(
            'Ada Lovelace',
        )
        expect(wrapper.find('[data-testid="usage-principal-row-12"]').text()).toContain('1,234.5')
        expect(wrapper.find('[data-testid="usage-principal-row-34"]').text()).toContain(
            'No credit pool',
        )
    })

    it('scopes the admin tabs to the principal that was picked', async () => {
        const { wrapper } = mountTab()
        await flushPromises()
        await flushPromises()
        await wrapper.find('[data-testid="usage-principal-select-34"]').trigger('click')
        await flushPromises()
        expect(useUsageStore().selectedPrincipalId).toBe(34)
    })

    it('marks the caller as not an admin when the API refuses the listing', async () => {
        const { wrapper } = mountTab({
            get: {
                '/usage/principals': () => {
                    throw forbidden()
                },
            },
        })
        await flushPromises()
        await flushPromises()
        expect(useUsageStore().adminDenied).toBe(true)
        expect(wrapper.find('[data-testid="usage-principals-error"]').exists()).toBe(false)
    })

    it('surfaces a failed load', async () => {
        const { wrapper } = mountTab({
            get: {
                '/usage/principals': () => {
                    throw new Error('Boom')
                },
            },
        })
        await flushPromises()
        await flushPromises()
        expect(wrapper.find('[data-testid="usage-principals-error"]').text()).toContain('Boom')
    })
})
