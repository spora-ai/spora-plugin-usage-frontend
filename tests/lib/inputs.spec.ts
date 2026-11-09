import { describe, expect, it } from 'vitest'
import { inputNumber, inputNumberOrZero } from '../../src/lib/inputs'

/**
 * An `input` event that carries a value.
 *
 * The helpers read the value off `event.target`, so the event has to have
 * been dispatched on the field for the target to be the field.
 */
function inputEvent(value: string): Event {
    const input = document.createElement('input')
    input.value = value
    const event = new Event('input')
    input.dispatchEvent(event)
    return event
}

describe('the number an operator typed', () => {
    it('reads the number the field carries', () => {
        expect(inputNumber(inputEvent('42'))).toBe(42)
        expect(inputNumber(inputEvent('-1.5'))).toBe(-1.5)
    })

    it('reports an empty field as no number at all', () => {
        expect(inputNumber(inputEvent(''))).toBeNull()
        expect(inputNumber(inputEvent('   '))).toBeNull()
    })

    it('reports a field that is not a number as no number at all', () => {
        expect(inputNumber(inputEvent('abc'))).toBeNull()
    })

    it('reads an empty field as zero when the caller asks for zero', () => {
        expect(inputNumberOrZero(inputEvent(''))).toBe(0)
    })

    it('reads a field that is not a number as zero when the caller asks for zero', () => {
        expect(inputNumberOrZero(inputEvent('abc'))).toBe(0)
    })

    it('reads the number the field carries when the caller asks for zero', () => {
        expect(inputNumberOrZero(inputEvent('7'))).toBe(7)
    })
})
