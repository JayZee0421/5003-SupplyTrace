import type { EdgeKind } from '../types'

export const SERIES = {
  average: '#4f8cff',
  p90: '#d95926',
}

export const EDGE_STYLE: Record<EdgeKind, { stroke: string; dash?: string; width: number; offset: number }> = {
  PRIMARY: { stroke: '#4f8cff', width: 1.8, offset: 0 },
  CONTRIBUTING: { stroke: '#d95926', dash: '7 4', width: 1.8, offset: 3 },
  ALTERNATIVE: { stroke: '#7fb3ef', dash: '2 4', width: 2, offset: -3 },
  CORRECTIVE: { stroke: '#858b94', dash: '8 4 2 4', width: 1.6, offset: 4 },
}
