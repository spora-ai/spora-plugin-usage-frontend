/**
 * The numbers an operator typed into a field.
 *
 * A number input hands back a string, and an empty field is not a zero:
 * `inputNumber` reports it as null and `inputNumberOrZero` reads it as
 * zero, so the caller says what an unfilled field means.
 */
export function inputNumber(event: Event): number | null {
    const raw = (event.target as HTMLInputElement).value
    if (raw.trim() === '') {
        return null
    }
    const parsed = Number(raw)
    return Number.isFinite(parsed) ? parsed : null
}

/** The number an input carries, with an empty field reading as zero. */
export function inputNumberOrZero(event: Event): number {
    return inputNumber(event) ?? 0
}
