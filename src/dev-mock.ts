/**
 * Dev-only mock API + fixture data used by `src/dev-main.ts` to render the
 * UI without a backend. Pure data and pure functions live here so they are
 * unit-testable; the side-effecting Vue bootstrap stays in `dev-main.ts`.
 *
 * The mock answers the same paths the PHP plugin answers and keeps the
 * writes in memory, so the limit editor and the grant form can be exercised
 * end-to-end without a database. For real DB-backed testing, run the host
 * SPA + this plugin's dev server + PHP together (see
 * `spora-frontend/vite.config.ts → SPORA_PLUGIN_DEV_PORTS`).
 */
import type { PluginHostContext } from './shims'
import type {
    SeriesWindow,
    UnpricedModel,
    UnpricedTool,
    UsageLimitRow,
    UsagePrice,
    UsagePrincipal,
    UsagePrincipalSummary,
    UsageSeries,
    UsageUnpriced,
} from './types'

export const PRINCIPAL_FIXTURE: UsagePrincipal[] = [
    {
        id: 12,
        type: 'user',
        name: 'Ada Lovelace',
        balance: 250.5,
        limits: [
            {
                window: 'month',
                window_size: 1,
                unit: 'credits',
                cap: 10000,
                mode: 'hard',
                enabled: true,
                spend: 1234.5,
                remaining: 8765.5,
            },
            {
                window: 'rolling',
                window_size: 5,
                unit: 'total_tokens',
                cap: 2000000,
                mode: 'soft',
                enabled: true,
                spend: 340000,
                remaining: 1660000,
            },
        ],
    },
    {
        id: 34,
        type: 'group',
        name: 'Research',
        balance: null,
        limits: [
            {
                window: 'day',
                window_size: 1,
                unit: 'llm_calls',
                cap: 500,
                mode: 'hard',
                enabled: true,
                spend: 42,
                remaining: 458,
            },
            {
                window: 'month',
                window_size: 1,
                unit: 'credits',
                cap: 500,
                mode: 'soft',
                enabled: false,
                spend: 0,
                remaining: 500,
            },
        ],
    },
    {
        id: 56,
        type: 'user',
        name: 'Grace Hopper',
        balance: 0,
        limits: [
            {
                window: 'day',
                window_size: 1,
                unit: 'credits',
                cap: 250,
                mode: 'soft',
                enabled: true,
                spend: 0,
                remaining: 250,
            },
        ],
    },
]

export const SUMMARY_FIXTURE: UsagePrincipalSummary[] = [
    { id: 12, type: 'user', name: 'Ada Lovelace', balance: 250.5, spend_30d: 1234.5 },
    { id: 34, type: 'group', name: 'Research', balance: null, spend_30d: 87.25 },
    { id: 56, type: 'user', name: 'Grace Hopper', balance: 0, spend_30d: 0 },
]

export const PRICE_FIXTURE: UsagePrice[] = [
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
    {
        kind: 'tool',
        provider: '',
        key: String.raw`Spora\Tools\MediaTool`,
        operation: 'render',
        input_price: 0,
        output_price: 0,
        cached_price: 0,
        call_price: 0.25,
    },
]

/**
 * The calls the sandbox recorded.
 *
 * The unpriced report is derived from these against the *current* price
 * book: a model or a tool that has a price row is no longer reported as
 * free, which is what the sandbox has to show once a price is given.
 */
export const USED_FIXTURE: UsageUnpriced = {
    models: [{ provider: 'openai_compatible', model: 'internal-preview', calls: 12 }],
    tools: [{ tool_class: String.raw`Spora\Tools\WeatherTool`, tool_name: 'weather', calls: 4 }],
}

/**
 * Whether a price row covers a model.
 *
 * A model is priced on its `(provider, model)` pair, and a row with an
 * empty provider is the fallback for every provider — the rules the
 * server's price book applies.
 */
function pricesModel(price: UsagePrice, model: UnpricedModel): boolean {
    return (
        price.kind === 'model' &&
        price.key === model.model &&
        (price.provider === model.provider || price.provider === '')
    )
}

/**
 * Whether a price row covers a tool.
 *
 * A tool is priced on its class; the operation narrows a price to one
 * operation of a multi-operation tool, and the sandbox's recorded calls
 * carry no operation of their own.
 */
function pricesTool(price: UsagePrice, tool: UnpricedTool): boolean {
    return price.kind === 'tool' && price.key === tool.tool_class
}

/**
 * A day of spend, so the chart has something to draw.
 *
 * The timestamps are relative to the moment the sandbox boots: a fixed date
 * would make the chart look like it stopped moving.
 */
function seriesFixture(window: SeriesWindow): UsageSeries {
    // A week and a month are both daily buckets, so only the day window
    // steps by the hour.
    let count = 30
    let stepMs = 86_400_000
    if (window === 'day') {
        count = 24
        stepMs = 3_600_000
    } else if (window === 'week') {
        count = 7
    }
    const now = Date.now()
    const points = []
    for (let index = 0; index < count; index++) {
        const at = new Date(now - (count - 1 - index) * stepMs)
        points.push({
            at: at.toISOString(),
            credits: Math.round((Math.sin(index / 2) * 40 + 60) * 100) / 100,
            total_tokens: 1200 + index * 37,
            output_tokens: 300 + index * 11,
            llm_calls: 3 + (index % 5),
            tool_calls: index % 4,
        })
    }
    return { window, points }
}

/**
 * The mock client.
 *
 * It answers the same paths the host's client answers and keeps the writes
 * in memory, so the limit editor and the grant form can be exercised
 * end-to-end without a database.
 */
export function createMockApi(): PluginHostContext['api'] {
    const principals = PRINCIPAL_FIXTURE.map((principal) => ({
        ...principal,
        limits: principal.limits.map((limit) => ({ ...limit })),
    }))
    const summaries = SUMMARY_FIXTURE.map((summary) => ({ ...summary }))
    const prices = PRICE_FIXTURE.map((price) => ({ ...price }))

    function findPrincipal(id: number): UsagePrincipal | undefined {
        return principals.find((principal) => principal.id === id)
    }

    /**
     * The calls that are still free, against the current price book.
     */
    function unpricedAnswer(): UsageUnpriced {
        return {
            models: USED_FIXTURE.models.filter(
                (model) => !prices.some((price) => pricesModel(price, model)),
            ),
            tools: USED_FIXTURE.tools.filter(
                (tool) => !prices.some((price) => pricesTool(price, tool)),
            ),
        }
    }

    return {
        async get<T>(path: string): Promise<T> {
            if (path === '/usage/me') {
                return { principals } as unknown as T
            }
            if (path.startsWith('/usage/me/series')) {
                const span = (new URLSearchParams(path.split('?')[1]).get('window') ?? 'day') as SeriesWindow
                return seriesFixture(span) as unknown as T
            }
            if (path === '/usage/principals') {
                return { principals: summaries } as unknown as T
            }
            if (path === '/usage/prices') {
                return { prices } as unknown as T
            }
            if (path === '/usage/unpriced') {
                return unpricedAnswer() as unknown as T
            }
            const detail = /^\/usage\/principals\/(\d+)$/.exec(path)
            if (detail !== null) {
                const id = Number(detail[1])
                const principal = findPrincipal(id)
                if (principal === undefined) {
                    throw Object.assign(new Error('Principal not found.'), { status: 404 })
                }
                return {
                    principal: {
                        id: principal.id,
                        type: principal.type,
                        name: principal.name,
                    },
                    balance: principal.balance,
                    limits: principal.limits,
                    spend: { credits_30d: 1234.5, total_tokens_30d: 340000 },
                } as unknown as T
            }
            throw new Error(`Mock API has no handler for ${path}`)
        },
        async post<T>(_path: string, _body: unknown): Promise<T> {
            throw new Error('POST is not supported in the mock.')
        },
        async postForm<T>(_path: string, _body: FormData): Promise<T> {
            throw new Error('POST FormData is not supported in the mock.')
        },
        async patch<T>(_path: string, _body: unknown): Promise<T> {
            throw new Error('PATCH is not supported in the mock.')
        },
        async delete<T>(_path: string): Promise<T> {
            throw new Error('DELETE is not supported in the mock.')
        },
        async put<T>(path: string, body: unknown): Promise<T> {
            const limits = /^\/usage\/principals\/(\d+)\/limits$/.exec(path)
            if (limits !== null) {
                const principal = findPrincipal(Number(limits[1]))
                if (principal === undefined) {
                    throw Object.assign(new Error('Principal not found.'), { status: 404 })
                }
                const payload = body as { limits: UsageLimitRow[] }
                principal.limits = payload.limits.map((limit) => {
                    // A limit row is identified by its window, its size and
                    // its unit — the server keys its table the same way. The
                    // spend of the window it already knows is kept, so an
                    // edited cap is reported against what was really spent.
                    const previous = principal.limits.find(
                        (row) =>
                            row.window === limit.window &&
                            row.window_size === limit.window_size &&
                            row.unit === limit.unit,
                    )
                    const spend = previous?.spend ?? 0
                    return { ...limit, spend, remaining: limit.cap - spend }
                })
                return { limits: principal.limits } as unknown as T
            }
            const credits = /^\/usage\/principals\/(\d+)\/credits$/.exec(path)
            if (credits !== null) {
                const principal = findPrincipal(Number(credits[1]))
                if (principal === undefined) {
                    throw Object.assign(new Error('Principal not found.'), { status: 404 })
                }
                const payload = body as { amount: number }
                principal.balance = (principal.balance ?? 0) + payload.amount
                const summary = summaries.find((row) => row.id === principal.id)
                if (summary !== undefined) {
                    summary.balance = principal.balance
                }
                return { balance: principal.balance } as unknown as T
            }
            if (path === '/usage/prices') {
                const payload = body as { prices: UsagePrice[] }
                prices.length = 0
                prices.push(...payload.prices.map((price) => ({ ...price })))
                return { prices } as unknown as T
            }
            throw new Error(`Mock API has no handler for ${path}`)
        },
    }
}
