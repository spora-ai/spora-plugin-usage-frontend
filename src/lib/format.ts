/**
 * The numbers and dates the panel shows.
 *
 * The locale is passed in rather than read from the environment: the plugin
 * has its own i18n instance, and a browser's locale is not the operator's
 * chosen language.
 */

/** The dash for a value the server did not send. */
const NO_VALUE = '—'

export function formatCredits(amount: number | null, locale = 'en'): string {
    if (amount === null) {
        return NO_VALUE
    }
    return new Intl.NumberFormat(locale, { maximumFractionDigits: 4 }).format(amount)
}

export function formatTokens(count: number | null, locale = 'en'): string {
    if (count === null) {
        return NO_VALUE
    }
    return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(count)
}

/**
 * A per-token price, in credits per million tokens.
 *
 * The wire carries credits per token, and `0.000002` credits per token is
 * six decimals nobody compares at a glance. The price book's own unit is
 * the per-million one, so that is what the table shows; the exact value
 * stays available on the row.
 */
export function formatPricePerMillion(creditsPerToken: number, locale = 'en'): string {
    return new Intl.NumberFormat(locale, { maximumFractionDigits: 4 }).format(
        creditsPerToken * 1_000_000,
    )
}

export function formatExactPrice(credits: number, locale = 'en'): string {
    return new Intl.NumberFormat(locale, { maximumFractionDigits: 12 }).format(credits)
}

export function formatTimestamp(iso: string, locale = 'en'): string {
    const date = new Date(iso)
    if (Number.isNaN(date.getTime())) {
        return iso
    }
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

/**
 * How much of a limit is used, as a fraction between 0 and 1.
 *
 * A cap of zero is reached by any spend at all, so the window reads as
 * spent to its cap rather than as one with room left in it.
 */
export function limitUsage(spend: number, cap: number): number {
    if (cap <= 0) {
        return 1
    }
    return Math.min(1, Math.max(0, spend / cap))
}
