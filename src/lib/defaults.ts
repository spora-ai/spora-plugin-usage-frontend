/**
 * The default limit sets, and which of them governs a principal.
 *
 * The rule the server applies is a *replacement*, not a merge: a
 * principal of type `user` is held to the `user` set when there is one,
 * and to the `all` set otherwise; a principal of type `group` does the
 * same with the `group` set. The panel has to say the same thing the
 * server does, or it names a default that does not govern the principal
 * the operator is looking at.
 */
import type { DefaultLimitScope, PrincipalType, UsageDefaultLimits } from '../types'

/**
 * The three sets, with a scope the server left out read as an empty set.
 *
 * The server sends all three, but a panel that reads a missing scope as
 * "no default for this type" would claim a principal is unlimited on the
 * strength of an answer that did not arrive.
 */
export function toDefaultLimits(sets: Partial<UsageDefaultLimits> | undefined): UsageDefaultLimits {
    return {
        all: sets?.all ?? [],
        user: sets?.user ?? [],
        group: sets?.group ?? [],
    }
}

/**
 * Whether a set holds a row that is switched on.
 *
 * The server filters the disabled rows out before it decides which set
 * governs, so a set whose rows are all off does not stand in for the
 * general one — and a panel that counted it would name a default the
 * server never applies.
 */
function hasEnabledRow(rows: UsageDefaultLimits[DefaultLimitScope]): boolean {
    return rows.some((row) => row.enabled)
}

/**
 * The default set that governs a principal, or `null` when none does.
 *
 * `null` is the case the feature exists to prevent: nobody configured the
 * principal and nobody configured a default, so the principal may spend
 * without limit.
 *
 * A principal whose type the panel cannot place is read as a user, which
 * is what the server assumes for a principal it cannot type either.
 */
export function resolveDefaultScope(
    type: PrincipalType | null,
    defaults: UsageDefaultLimits,
): DefaultLimitScope | null {
    const scope: DefaultLimitScope = type === 'group' ? 'group' : 'user'
    if (hasEnabledRow(defaults[scope])) {
        return scope
    }
    if (hasEnabledRow(defaults.all)) {
        return 'all'
    }
    return null
}
