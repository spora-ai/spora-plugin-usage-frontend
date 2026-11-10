import { describe, expect, it } from 'vitest'
import { resolveDefaultScope, toDefaultLimits } from '../../src/lib/defaults'
import type { UsageDefaultLimits, UsageLimitRow } from '../../src/types'

function row(overrides: Partial<UsageLimitRow> = {}): UsageLimitRow {
    return {
        window: 'month',
        window_size: 1,
        unit: 'credits',
        cap: 100,
        mode: 'hard',
        enabled: true,
        ...overrides,
    }
}

function sets(overrides: Partial<UsageDefaultLimits> = {}): UsageDefaultLimits {
    return {
        all: [],
        user: [],
        group: [],
        ...overrides,
    }
}

describe('the default limits', () => {
    it('holds a user to the user set', () => {
        expect(resolveDefaultScope('user', sets({ all: [row()], user: [row()] }))).toBe('user')
    })

    it('holds a group to the group set', () => {
        expect(resolveDefaultScope('group', sets({ all: [row()], group: [row()] }))).toBe('group')
    })

    it('falls back to the general set when the type has none', () => {
        expect(resolveDefaultScope('user', sets({ all: [row()] }))).toBe('all')
        expect(resolveDefaultScope('group', sets({ all: [row()] }))).toBe('all')
    })

    it('lets the general set stand in for a type that has none of its own', () => {
        // The user set does not govern a group, so a group falls back to
        // the general set even though a user set is configured.
        expect(resolveDefaultScope('group', sets({ all: [row()], user: [row()] }))).toBe('all')
    })

    it('does not let a set of switched-off rows stand in for the general one', () => {
        // The server filters the disabled rows out before it decides, so
        // a set whose rows are all off does not govern anybody.
        const defaults = sets({ all: [row()], user: [row({ enabled: false })] })
        expect(resolveDefaultScope('user', defaults)).toBe('all')
    })

    it('holds nobody when no set is configured', () => {
        expect(resolveDefaultScope('user', sets())).toBeNull()
        expect(resolveDefaultScope('group', sets())).toBeNull()
    })

    it('reads a principal it cannot place as a user', () => {
        // The server assumes a user for a principal it cannot type either.
        expect(resolveDefaultScope(null, sets({ user: [row()] }))).toBe('user')
        expect(resolveDefaultScope(null, sets())).toBeNull()
    })

    it('reads a scope the server left out as an empty set', () => {
        expect(toDefaultLimits({ all: [row()] })).toEqual({
            all: [row()],
            user: [],
            group: [],
        })
    })

    it('reads an answer that carries no sets as three empty ones', () => {
        expect(toDefaultLimits(undefined)).toEqual({ all: [], user: [], group: [] })
    })
})
