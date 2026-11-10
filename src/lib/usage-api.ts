/**
 * The Usage API's paths.
 *
 * The host's client is rooted at `/api/v1`, so the contract's
 * `/api/v1/usage/...` is `/usage/...` from the plugin's side. The paths
 * live in one module so a change to the contract's base path is one edit
 * rather than one per tab.
 */
import type { SeriesWindow } from '../types'

export const USAGE_PATH = '/usage'

export function myPrincipalsPath(): string {
    return `${USAGE_PATH}/me`
}

export function seriesPath(window: SeriesWindow): string {
    return `${USAGE_PATH}/me/series?window=${window}`
}

export function principalsPath(): string {
    return `${USAGE_PATH}/principals`
}

export function principalPath(id: number): string {
    return `${USAGE_PATH}/principals/${id}`
}

export function limitsPath(id: number): string {
    return `${principalPath(id)}/limits`
}

export function creditsPath(id: number): string {
    return `${principalPath(id)}/credits`
}

export function pricesPath(): string {
    return `${USAGE_PATH}/prices`
}

/**
 * The default limit sets.
 *
 * The same path for the read and for the write: the body tells them
 * apart.
 */
export function defaultsPath(): string {
    return `${USAGE_PATH}/defaults`
}

export function unpricedPath(): string {
    return `${USAGE_PATH}/unpriced`
}
