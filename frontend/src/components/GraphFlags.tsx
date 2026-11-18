import type { Graph } from '../types'
import { AlertTriangleIcon } from './icons'

export function GraphFlags({ graph }: { graph: Graph }) {
  if (!graph.truncated && !graph.cycle_detected) return null

  return (
    <div className="notice-group">
      {graph.truncated ? (
        <div className="notice notice--warning">
          <AlertTriangleIcon size={17} />
          <p>
            Depth limit reached at {graph.max_depth} hops. At least one reachable event is missing
            from this graph.
          </p>
        </div>
      ) : null}
      {graph.cycle_detected ? (
        <div className="notice notice--warning">
          <AlertTriangleIcon size={17} />
          <p>
            A directed cycle was observed in the returned subgraph. Treat the paths below as
            incomplete.
          </p>
        </div>
      ) : null}
    </div>
  )
}
