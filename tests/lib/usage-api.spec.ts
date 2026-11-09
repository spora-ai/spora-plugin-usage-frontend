import { describe, expect, it } from 'vitest'
import {
    creditsPath,
    limitsPath,
    myPrincipalsPath,
    principalPath,
    principalsPath,
    pricesPath,
    seriesPath,
    unpricedPath,
} from '../../src/lib/usage-api'

describe('the Usage paths', () => {
    it('addresses the contract\'s routes without the client\'s own /api/v1 prefix', () => {
        expect(myPrincipalsPath()).toBe('/usage/me')
        expect(principalsPath()).toBe('/usage/principals')
        expect(principalPath(12)).toBe('/usage/principals/12')
        expect(limitsPath(12)).toBe('/usage/principals/12/limits')
        expect(creditsPath(12)).toBe('/usage/principals/12/credits')
        expect(pricesPath()).toBe('/usage/prices')
        expect(unpricedPath()).toBe('/usage/unpriced')
    })

    it('carries the series window as a query parameter', () => {
        expect(seriesPath('week')).toBe('/usage/me/series?window=week')
    })
})
