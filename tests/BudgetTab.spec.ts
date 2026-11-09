import { describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import BudgetTab from '../src/components/BudgetTab.vue'
import { useUsageStore } from '../src/stores/usage'
import { buildHost, type HostOptions } from './helpers/host'

const detailResponse = {
    principal: { id: 12, type: 'user', name: 'Ada Lovelace' },
    balance: 250.5,
    limits: [],
    spend: { credits_30d: 1234.5, total_tokens_30d: 340000 },
}

function mountTab(options: HostOptions = {}, selectedPrincipalId: number | null = 12) {
    const host = buildHost({
        ...options,
        get: {
            '/usage/principals/12': () => detailResponse,
            ...options.get,
        },
        put: {
            '/usage/principals/12/credits': () => ({ balance: 350.5 }),
            ...options.put,
        },
    })
    const pinia = createPinia()
    setActivePinia(pinia)
    if (selectedPrincipalId !== null) {
        useUsageStore().selectedPrincipalId = selectedPrincipalId
    }
    const wrapper = mount(BudgetTab, {
        props: { hostContext: host.context },
        global: { plugins: [pinia] },
    })
    return { wrapper, host }
}

describe('BudgetTab', () => {
    it('asks for a principal before it shows a balance', async () => {
        const { wrapper, host } = mountTab({}, null)
        await flushPromises()
        expect(wrapper.find('[data-testid="usage-budget-no-principal"]').exists()).toBe(true)
        expect(host.api.get).not.toHaveBeenCalled()
    })

    it('shows the balance of the selected principal', async () => {
        const { wrapper } = mountTab()
        await flushPromises()
        await flushPromises()
        expect(wrapper.find('[data-testid="usage-budget-principal"]').text()).toContain(
            'Ada Lovelace',
        )
        expect(wrapper.find('[data-testid="usage-budget-balance"]').text()).toContain('250.5')
    })

    it('grants credits and shows the balance the server answered with', async () => {
        const { wrapper, host } = mountTab()
        await flushPromises()
        await flushPromises()
        await wrapper.find('[data-testid="usage-grant-amount"]').setValue('100')
        await wrapper.find('[data-testid="usage-grant-note"]').setValue('Monthly top-up')
        await wrapper.find('[data-testid="usage-grant-submit"]').trigger('submit')
        await flushPromises()
        expect(host.api.put).toHaveBeenCalledWith('/usage/principals/12/credits', {
            amount: 100,
            note: 'Monthly top-up',
        })
        expect(wrapper.find('[data-testid="usage-budget-balance"]').text()).toContain('350.5')
        expect(wrapper.find('[data-testid="usage-grant-done"]').exists()).toBe(true)
    })

    it('refuses a grant without an amount', async () => {
        const { wrapper, host } = mountTab()
        await flushPromises()
        await flushPromises()
        await wrapper.find('[data-testid="usage-grant-submit"]').trigger('submit')
        await flushPromises()
        expect(host.api.put).not.toHaveBeenCalled()
        expect(wrapper.find('[data-testid="usage-budget-action-error"]').text()).toContain(
            'Enter an amount to grant.',
        )
    })

    it('surfaces a failed grant without blanking the balance', async () => {
        const { wrapper } = mountTab({
            put: {
                '/usage/principals/12/credits': () => {
                    throw new Error('Boom')
                },
            },
        })
        await flushPromises()
        await flushPromises()
        await wrapper.find('[data-testid="usage-grant-amount"]').setValue('100')
        await wrapper.find('[data-testid="usage-grant-submit"]').trigger('submit')
        await flushPromises()
        expect(wrapper.find('[data-testid="usage-budget-action-error"]').text()).toContain('Boom')
        expect(wrapper.find('[data-testid="usage-budget-balance"]').text()).toContain('250.5')
    })
})
