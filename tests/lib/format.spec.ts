import { describe, expect, it } from 'vitest'
import {
    formatCredits,
    formatExactPrice,
    formatPricePerMillion,
    formatTimestamp,
    formatTokens,
    limitUsage,
} from '../../src/lib/format'

describe('formatCredits', () => {
    it('formats an amount with the locale', () => {
        expect(formatCredits(1234.5, 'en')).toBe('1,234.5')
        expect(formatCredits(1234.5, 'de')).toBe('1.234,5')
    })

    it('renders a dash for a missing amount', () => {
        expect(formatCredits(null, 'en')).toBe('—')
    })

    it('keeps the decimals a credit amount can carry', () => {
        expect(formatCredits(0.0001, 'en')).toBe('0.0001')
    })
})

describe('formatTokens', () => {
    it('formats a token count without decimals', () => {
        expect(formatTokens(340000, 'en')).toBe('340,000')
    })

    it('renders a dash for a missing count', () => {
        expect(formatTokens(null, 'en')).toBe('—')
    })
})

describe('formatPricePerMillion', () => {
    it('turns a per-token price into the per-million unit the book reads in', () => {
        expect(formatPricePerMillion(0.000002, 'en')).toBe('2')
        expect(formatPricePerMillion(0.0000005, 'en')).toBe('0.5')
    })

    it('keeps a price that is not a whole number of credits per million', () => {
        expect(formatPricePerMillion(0.0000015, 'en')).toBe('1.5')
    })
})

describe('formatExactPrice', () => {
    it('keeps every decimal the wire carries', () => {
        expect(formatExactPrice(0.0000005, 'en')).toBe('0.0000005')
    })
})

describe('formatTimestamp', () => {
    it('formats an ISO timestamp as a date and a time', () => {
        const formatted = formatTimestamp('2026-11-09T10:00:00+00:00', 'en')
        expect(formatted).toContain('2026')
        expect(formatted).not.toContain('T10:00:00')
    })

    it('falls back to the raw string when the timestamp is not a date', () => {
        expect(formatTimestamp('not a date', 'en')).toBe('not a date')
    })
})

describe('limitUsage', () => {
    it('reports the used fraction of the cap', () => {
        expect(limitUsage(25, 100)).toBe(0.25)
    })

    it('clamps a spend above the cap to one', () => {
        expect(limitUsage(150, 100)).toBe(1)
    })

    it('reports a cap of zero as a window that is spent to its cap', () => {
        expect(limitUsage(0, 0)).toBe(1)
        expect(limitUsage(10, 0)).toBe(1)
    })
})
