import { fetchImpact } from '../api/client'
import type { Impact } from '../types'

const orderNumberByOrderId = new Map<number, string>()

/** Finds the order number for an order id in a returned impact graph. */
export function findOrderNumber(impact: Impact, orderId: number): string | null {
  const order = impact.orders.find((candidate) => candidate.order_id === orderId)
  if (!order) return null
  orderNumberByOrderId.set(orderId, order.order_number)
  return order.order_number
}

/**
 * Resolves the order number for an event that has only an order_id. The impact
 * endpoint at depth 0 returns the source event's order without walking the
 * downstream graph, so this costs one small request and needs no backend
 * contract change.
 */
export async function lookupOrderNumber(
  eventId: number,
  orderId: number,
  signal?: AbortSignal,
): Promise<string | null> {
  const cached = orderNumberByOrderId.get(orderId)
  if (cached) return cached

  const impact = await fetchImpact(eventId, signal, 0)
  return findOrderNumber(impact, orderId)
}
