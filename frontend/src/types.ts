export type EventStatus = 'NORMAL' | 'WARNING' | 'FAILED' | 'COMPLETED' | 'CANCELLED'

export type EdgeKind = 'PRIMARY' | 'CONTRIBUTING' | 'ALTERNATIVE' | 'CORRECTIVE'

export interface EventRecord {
  event_id: number
  event_type_code: string
  event_name: string
  event_time: string
  status: EventStatus
  is_exception: boolean
  entity_type: string
  entity_id: number
  subject_entity: string
  location_id: number | null
  location_name: string | null
  order_id: number | null
  order_line_id: number | null
  caused_by_event_id: number | null
  causal_depth: number
  message: string | null
  current_commitment: string | null
}

export interface Timeline {
  order_number: string
  count: number
  events: EventRecord[]
}

export interface GraphNode extends EventRecord {
  steps: number
  path: number[]
}

export interface GraphEdge {
  cause_event_id: number
  effect_event_id: number
  kind: EdgeKind
}

export interface Graph {
  selected_event_id: number
  max_depth: number
  count: number
  nodes: GraphNode[]
  edges: GraphEdge[]
  truncated: boolean
  cycle_detected: boolean
}

export interface RootCause extends Graph {
  earliest_exception_event_id: number | null
  chain_start_event_id: number | null
}

export interface ImpactLine {
  order_line_id: number
  line_number: number
  current_commitment: string | null
  latest_affected_event_id: number
  latest_affected_event_time: string
  causal_hops: number
}

export interface ImpactOrder {
  order_id: number
  order_number: string
  customer_name: string
  lines: ImpactLine[]
}

export interface Impact extends Graph {
  affected_order_count: number
  orders: ImpactOrder[]
}

export interface Stage {
  stage_order: number
  stage: string
  sample_lines: number
  average_hours: number | null
  p90_hours: number | null
}

export interface Durations {
  order_number: string | null
  order_line_id: number | null
  start_time: string | null
  end_time: string | null
  stages: Stage[]
}

export interface DurationFilters {
  orderNumber: string
  orderLineId: string
  startTime: string
  endTime: string
}

export interface Health {
  status: 'ok'
}
