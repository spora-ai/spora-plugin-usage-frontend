import { describe, expect, it } from 'vitest'
import { createMockApi, DEFAULTS_FIXTURE, PRICE_FIXTURE } from '../src/dev-mock'
import type {
    UsageDefaultLimits,
    UsageLimit,
    UsagePrice,
    UsagePrincipalSummary,
    UsageUnpriced,
} from '../src/types'

describe('the dev mock', () => {
    it('answers for every principal the listing names', async () => {
        const api = createMockApi()
        const listing = await api.get<{ principals: UsagePrincipalSummary[] }>('/usage/principals')
        expect(listing.principals.length).toBeGreaterThan(0)
        for (const summary of listing.principals) {
            const detail = await api.get<{ principal: { id: number } }>(
                `/usage/principals/${summary.id}`,
            )
            expect(detail.principal.id).toBe(summary.id)
        }
    })

    it('keeps the spend of a window when its cap is edited', async () => {
        const api = createMockApi()
        await api.put('/usage/principals/12/limits', {
            limits: [
                {
                    window: 'month',
                    window_size: 1,
                    unit: 'credits',
                    cap: 500,
                    mode: 'hard',
                    enabled: true,
                },
            ],
        })
        const detail = await api.get<{ limits: UsageLimit[] }>('/usage/principals/12')
        expect(detail.limits[0]?.spend).toBe(1234.5)
        expect(detail.limits[0]?.remaining).toBe(-734.5)
    })

    it('starts a window the server has not seen at no spend', async () => {
        const api = createMockApi()
        await api.put('/usage/principals/12/limits', {
            limits: [
                {
                    window: 'day',
                    window_size: 1,
                    unit: 'credits',
                    cap: 500,
                    mode: 'hard',
                    enabled: true,
                },
            ],
        })
        const detail = await api.get<{ limits: UsageLimit[] }>('/usage/principals/12')
        expect(detail.limits[0]?.spend).toBe(0)
        expect(detail.limits[0]?.remaining).toBe(500)
    })

    it('reports a model as unpriced while it has no price', async () => {
        const api = createMockApi()
        const unpriced = await api.get<UsageUnpriced>('/usage/unpriced')
        expect(unpriced.models.map((model) => model.model)).toEqual(['internal-preview'])
        expect(unpriced.tools.map((tool) => tool.tool_name)).toEqual(['weather'])
    })

    it('drops a model from the unpriced report once it has a price', async () => {
        const api = createMockApi()
        const priced: UsagePrice = {
            kind: 'model',
            provider: 'openai_compatible',
            key: 'internal-preview',
            operation: '',
            input_price: 0.000001,
            output_price: 0.000002,
            cached_price: 0,
            call_price: 0,
        }
        await api.put('/usage/prices', { prices: [...PRICE_FIXTURE, priced] })

        const unpriced = await api.get<UsageUnpriced>('/usage/unpriced')
        expect(unpriced.models).toEqual([])
        expect(unpriced.tools.map((tool) => tool.tool_name)).toEqual(['weather'])
    })

    it('prices a model on a row without a provider', async () => {
        const api = createMockApi()
        const priced: UsagePrice = {
            kind: 'model',
            provider: '',
            key: 'internal-preview',
            operation: '',
            input_price: 0.000001,
            output_price: 0.000002,
            cached_price: 0,
            call_price: 0,
        }
        await api.put('/usage/prices', { prices: [...PRICE_FIXTURE, priced] })

        const unpriced = await api.get<UsageUnpriced>('/usage/unpriced')
        expect(unpriced.models).toEqual([])
    })

    it('drops a tool from the unpriced report once its class has a price', async () => {
        const api = createMockApi()
        const priced: UsagePrice = {
            kind: 'tool',
            provider: '',
            key: String.raw`Spora\Tools\WeatherTool`,
            operation: '',
            input_price: 0,
            output_price: 0,
            cached_price: 0,
            call_price: 0.25,
        }
        await api.put('/usage/prices', { prices: [...PRICE_FIXTURE, priced] })

        const unpriced = await api.get<UsageUnpriced>('/usage/unpriced')
        expect(unpriced.tools).toEqual([])
    })

    it('answers with the default limits of every scope', async () => {
        const api = createMockApi()
        const answer = await api.get<{ defaults: UsageDefaultLimits }>('/usage/defaults')
        expect(answer.defaults.all).toHaveLength(DEFAULTS_FIXTURE.all.length)
        expect(answer.defaults.user).toHaveLength(DEFAULTS_FIXTURE.user.length)
        expect(answer.defaults.group).toHaveLength(DEFAULTS_FIXTURE.group.length)
    })

    it('keeps a default the sandbox was given', async () => {
        const api = createMockApi()
        const row = {
            window: 'day',
            window_size: 1,
            unit: 'credits',
            cap: 50,
            mode: 'soft',
            enabled: true,
        }
        await api.put('/usage/defaults', { defaults: { user: [row] } })

        const answer = await api.get<{ defaults: UsageDefaultLimits }>('/usage/defaults')
        expect(answer.defaults.user).toHaveLength(1)
        expect(answer.defaults.user[0]?.cap).toBe(50)
    })

    it('leaves a scope the payload does not carry alone', async () => {
        const api = createMockApi()
        await api.put('/usage/defaults', { defaults: { user: [] } })

        const answer = await api.get<{ defaults: UsageDefaultLimits }>('/usage/defaults')
        expect(answer.defaults.user).toHaveLength(0)
        expect(answer.defaults.all).toHaveLength(DEFAULTS_FIXTURE.all.length)
        expect(answer.defaults.group).toHaveLength(DEFAULTS_FIXTURE.group.length)
    })
})
