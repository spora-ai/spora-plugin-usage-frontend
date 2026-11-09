/**
 * The wire shapes of the Usage API.
 *
 * The host's typed client unwraps the `{ data: T }` envelope, so a response
 * type here is the *inner* shape and nothing more — there is no `body.data`
 * to unwrap on the plugin side.
 */

export type PrincipalType = 'user' | 'group'

export type LimitWindow = 'hour' | 'day' | 'week' | 'month' | 'rolling' | 'total'

export type LimitUnit = 'credits' | 'total_tokens' | 'output_tokens' | 'llm_calls' | 'tool_calls'

export type LimitMode = 'hard' | 'soft'

export type PriceKind = 'model' | 'tool'

export type SeriesWindow = 'day' | 'week' | 'month'

export type UsageTab = 'overview' | 'principals' | 'limits' | 'budget' | 'prices'

/**
 * The fields of a limit row that the server stores.
 *
 * The body of `PUT /usage/principals/{id}/limits` is a list of these: the
 * server replaces the whole set, so the payload carries every limit and
 * nothing else — the spend figures the server computed are not the
 * client's to send back.
 *
 * `cap` is a number and never a null: the server's column is
 * `DECIMAL(20,8) NOT NULL` and a null cap in the payload is a 400. A limit
 * without a cap is a limit that is not there — the row leaves the payload
 * instead of losing its number.
 */
export interface UsageLimitRow {
    window: LimitWindow
    /** Hours. Only the `rolling` window reads it. */
    window_size: number
    unit: LimitUnit
    cap: number
    mode: LimitMode
    enabled: boolean
}

/**
 * One limit row as the server reports it.
 *
 * `spend` and `remaining` are the server's own figures: `remaining` is the
 * cap minus the spend, and it goes negative when a window overshoots its
 * cap — the size of the overshoot is what the number is for.
 */
export interface UsageLimit extends UsageLimitRow {
    spend: number
    remaining: number
}

/**
 * One limit row as the editor holds it.
 *
 * The figures are the ones the server last reported, and they are null for
 * a row the server has not seen: the server computes the spend per window,
 * not per row, so a row the operator has just added carries no figure until
 * the save comes back.
 */
export interface UsageLimitDraft extends UsageLimitRow {
    spend: number | null
    remaining: number | null
}

/** A principal as the caller's own overview sees it. */
export interface UsagePrincipal {
    id: number
    type: PrincipalType
    name: string
    balance: number | null
    limits: UsageLimit[]
}

/** A principal as the admin listing sees it: no limits, a 30-day spend. */
export interface UsagePrincipalSummary {
    id: number
    type: PrincipalType
    name: string
    balance: number | null
    spend_30d: number
}

export interface UsagePrincipalRef {
    id: number
    type: PrincipalType
    name: string
}

export interface UsageSpend {
    credits_30d: number
    total_tokens_30d: number
}

/** Everything the admin tabs need about one principal. */
export interface UsagePrincipalDetail {
    principal: UsagePrincipalRef
    balance: number | null
    limits: UsageLimit[]
    spend: UsageSpend
}

export interface UsageSeriesPoint {
    at: string
    credits: number
    total_tokens: number
    output_tokens: number
    llm_calls: number
    tool_calls: number
}

export interface UsageSeries {
    window: SeriesWindow
    points: UsageSeriesPoint[]
}

/** One row of the price book. */
export interface UsagePrice {
    kind: PriceKind
    /** Empty means "any provider". */
    provider: string
    /** The model name, or the tool's class FQCN. */
    key: string
    /** Empty means "any operation"; tools only. */
    operation: string
    input_price: number
    output_price: number
    cached_price: number
    call_price: number
}

/** A model that was used and has no price row: it cost nothing, silently. */
export interface UnpricedModel {
    provider: string
    model: string
    calls: number
}

/** A tool that was used and has no price row. */
export interface UnpricedTool {
    tool_class: string
    tool_name: string
    calls: number
}

export interface UsageUnpriced {
    models: UnpricedModel[]
    tools: UnpricedTool[]
}

/** The rows the server answers a limit save with. */
export interface UsageLimitsResponse {
    limits: UsageLimitRow[]
}

export interface UsageBalanceResponse {
    balance: number | null
}

export interface UsagePricesResponse {
    prices: UsagePrice[]
}
