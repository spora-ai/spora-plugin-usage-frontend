/**
 * Reading a failed request.
 *
 * The host's client throws an `ApiError` carrying the HTTP status; the
 * plugin's shim types a rejection as `unknown`, so the status is read by
 * shape rather than by a class the plugin does not have.
 */
export function statusOf(error: unknown): number | null {
    if (typeof error !== 'object' || error === null) {
        return null
    }
    const status = (error as { status?: unknown }).status
    return typeof status === 'number' ? status : null
}

/**
 * Whether the server refused the request because the caller is not an admin.
 *
 * A 403 is an answer, not a failure to retry: the admin gate is on the
 * server, and a retry would be refused the same way.
 */
export function isForbidden(error: unknown): boolean {
    return statusOf(error) === 403
}

export function messageOf(error: unknown): string {
    return error instanceof Error ? error.message : String(error)
}
