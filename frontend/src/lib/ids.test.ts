import { describe, expect, it } from 'vitest'
import { parsePositiveInt } from './ids'

describe('parsePositiveInt', () => {
  it('parses positive, safe integers and trims whitespace', () => {
    expect(parsePositiveInt('10')).toBe(10)
    expect(parsePositiveInt(' 42 ')).toBe(42)
    expect(parsePositiveInt('1')).toBe(1)
    expect(parsePositiveInt(String(Number.MAX_SAFE_INTEGER))).toBe(Number.MAX_SAFE_INTEGER)
  })

  it('rejects zero, negatives, decimals and non-numeric input', () => {
    for (const value of ['0', '-1', '1.5', '1e3', 'abc', '', '   ', '#10']) {
      expect(parsePositiveInt(value)).toBeNull()
    }
  })

  it('rejects values above the JavaScript safe-integer range', () => {
    expect(parsePositiveInt('9007199254740992')).toBeNull()
  })

  it('rejects null and undefined', () => {
    expect(parsePositiveInt(null)).toBeNull()
    expect(parsePositiveInt(undefined)).toBeNull()
  })
})
