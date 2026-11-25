import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Impact } from '../types'
import { findOrderNumber, lookupOrderNumber } from './orderLookup'

function impactWith(orderId: number, orderNumber: string): Impact {
  return {
    selected_event_id: 1,
    max_depth: 0,
    count: 1,
    nodes: [],
    edges: [],
    truncated: false,
    cycle_detected: false,
    affected_order_count: 1,
    orders: [
      {
        order_id: orderId,
        order_number: orderNumber,
        customer_name: 'Synthetic customer',
        lines: [],
      },
    ],
  }
}

describe('findOrderNumber', () => {
  it('returns and caches the matching order number', () => {
    expect(findOrderNumber(impactWith(9101, 'SO-LOOKUP-9101'), 9101)).toBe('SO-LOOKUP-9101')
    expect(findOrderNumber(impactWith(9101, 'SO-LOOKUP-9101'), 9999)).toBeNull()
  })
})

describe('lookupOrderNumber', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('uses a depth-0 impact lookup and reuses the cache', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(impactWith(9102, 'SO-LOOKUP-9102')), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(lookupOrderNumber(57, 9102)).resolves.toBe('SO-LOOKUP-9102')
    await expect(lookupOrderNumber(57, 9102)).resolves.toBe('SO-LOOKUP-9102')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(String(fetchMock.mock.calls[0][0])).toContain('max_depth=0')
  })
})
