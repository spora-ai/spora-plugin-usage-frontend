import { describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import BudgetTab from '../src/components/BudgetTab.vue'
import { useUsageStore } from '../src/stores/usage'
import { buildHost, forbidden, type HostOptions } from './helpers/host'

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
        props: { hostContext: host.context, idPrefix: 'usage' },
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

    it('says so for a principal without a credit pool', async () => {
        const { wrapper } = mountTab({
            get: { '/usage/principals/12': () => ({ ...detailResponse, balance: null }) },
        })
        await flushPromises()
        await flushPromises()
        expect(wrapper.find('[data-testid="usage-budget-balance"]').text()).toContain('No credit pool')
    })

    it('reads an emptied amount as no amount at all', async () => {
        const { wrapper, host } = mountTab()
        await flushPromises()
        await flushPromises()
        await wrapper.find('[data-testid="usage-grant-amount"]').setValue('100')
        await wrapper.find('[data-testid="usage-grant-amount"]').setValue('')
        await wrapper.find('[data-testid="usage-grant-submit"]').trigger('submit')
        await flushPromises()
        expect(host.api.put).not.toHaveBeenCalled()
        expect(
            wrapper.find<HTMLInputElement>('[data-testid="usage-grant-amount"]').element.value,
        ).toBe('')
        expect(wrapper.find('[data-testid="usage-budget-action-error"]').text()).toContain(
            'Enter an amount to grant.',
        )
    })

    it('keeps the digits of an amount the operator is typing', async () => {
        const { wrapper, host } = mountTab()
        await flushPromises()
        await flushPromises()
        const input = wrapper.find<HTMLInputElement>('[data-testid="usage-grant-amount"]')
        // An amount is typed digit by digit, and every prefix of it parses
        // to a number that is not the text: "100.50" is 100 until the last
        // digit is there. A field bound to that number would be rewritten
        // under the cursor.
        for (const prefix of ['1', '10', '100', '100.', '100.5', '100.50']) {
            await input.setValue(prefix)
            expect(input.element.value).toBe(prefix)
        }
        await wrapper.find('[data-testid="usage-grant-submit"]').trigger('submit')
        await flushPromises()
        expect(host.api.put).toHaveBeenCalledWith('/usage/principals/12/credits', {
            amount: 100.5,
            note: '',
        })
    })

    it('keeps the decimal point of an amount the operator replaced', async () => {
        const { wrapper, host } = mountTab()
        await flushPromises()
        await flushPromises()
        const input = wrapper.find<HTMLInputElement>('[data-testid="usage-grant-amount"]')
        await input.setValue('100.50')
        // The operator picks the amount and types a new one: the decimal
        // point is the operator's, not the number's.
        await input.setValue('10.')
        expect(input.element.value).toBe('10.')
        await input.setValue('10.5')
        await wrapper.find('[data-testid="usage-grant-submit"]').trigger('submit')
        await flushPromises()
        expect(host.api.put).toHaveBeenCalledWith('/usage/principals/12/credits', {
            amount: 10.5,
            note: '',
        })
    })

    it('empties the amount field once the grant went through', async () => {
        const { wrapper } = mountTab()
        await flushPromises()
        await flushPromises()
        await wrapper.find('[data-testid="usage-grant-amount"]').setValue('100.50')
        await wrapper.find('[data-testid="usage-grant-submit"]').trigger('submit')
        await flushPromises()
        expect(
            wrapper.find<HTMLInputElement>('[data-testid="usage-grant-amount"]').element.value,
        ).toBe('')
    })

    it('sends nothing when the principal is gone by the time the grant runs', async () => {
        const { wrapper, host } = mountTab()
        await flushPromises()
        await flushPromises()
        await wrapper.find('[data-testid="usage-grant-amount"]').setValue('100')
        // The panel still holds the form, but there is no principal left to
        // grant the credits to.
        useUsageStore().selectedPrincipalId = null
        await wrapper.find('[data-testid="usage-grant-submit"]').trigger('submit')
        expect(host.api.put).not.toHaveBeenCalled()
    })

    it('surfaces a failed load of the balance', async () => {
        const { wrapper } = mountTab({
            get: {
                '/usage/principals/12': () => {
                    throw new Error('Boom')
                },
            },
        })
        await flushPromises()
        await flushPromises()
        expect(wrapper.find('[data-testid="usage-budget-error"]').text()).toContain('Boom')
    })

    it('marks the caller as not an admin when the API refuses the balance', async () => {
        const { wrapper } = mountTab({
            get: {
                '/usage/principals/12': () => {
                    throw forbidden()
                },
            },
        })
        await flushPromises()
        await flushPromises()
        expect(useUsageStore().adminDenied).toBe(true)
        expect(wrapper.find('[data-testid="usage-budget-error"]').exists()).toBe(false)
    })

    it('marks the caller as not an admin when the API refuses the grant', async () => {
        const { wrapper } = mountTab({
            put: {
                '/usage/principals/12/credits': () => {
                    throw forbidden()
                },
            },
        })
        await flushPromises()
        await flushPromises()
        await wrapper.find('[data-testid="usage-grant-amount"]').setValue('100')
        await wrapper.find('[data-testid="usage-grant-submit"]').trigger('submit')
        await flushPromises()
        expect(useUsageStore().adminDenied).toBe(true)
        expect(wrapper.find('[data-testid="usage-budget-action-error"]').exists()).toBe(false)
    })
})
