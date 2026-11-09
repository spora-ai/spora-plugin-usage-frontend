import { describe, expect, it } from 'vitest'
import { isForbidden, messageOf, statusOf } from '../../src/lib/errors'

describe('a failed request', () => {
    it('reads the status the host\'s client attached', () => {
        expect(statusOf(Object.assign(new Error('Not found'), { status: 404 }))).toBe(404)
    })

    it('has no status for a value that is not an object at all', () => {
        expect(statusOf('Boom')).toBeNull()
        expect(statusOf(undefined)).toBeNull()
    })

    it('has no status for null', () => {
        expect(statusOf(null)).toBeNull()
    })

    it('has no status for a status that is not a number', () => {
        expect(statusOf({ status: '404' })).toBeNull()
        expect(statusOf({})).toBeNull()
    })

    it('knows a refusal by the host is a 403', () => {
        expect(isForbidden(Object.assign(new Error('Forbidden'), { status: 403 }))).toBe(true)
        expect(isForbidden(Object.assign(new Error('Not found'), { status: 404 }))).toBe(false)
        expect(isForbidden(new Error('Boom'))).toBe(false)
    })

    it('reads the message of an error that is not an Error', () => {
        expect(messageOf(new Error('Boom'))).toBe('Boom')
        expect(messageOf('Boom')).toBe('Boom')
        expect(messageOf(null)).toBe('null')
    })
})
