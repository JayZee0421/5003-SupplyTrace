"""The response models are also the source of the generated OpenAPI contract."""
from datetime import date, datetime
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field


class Model(BaseModel):
    model_config = ConfigDict(extra='forbid')


class Event(Model):
    event_id: int
    event_type_code: str
    event_name: str
    event_time: datetime
    status: Literal['NORMAL', 'WARNING', 'FAILED', 'COMPLETED', 'CANCELLED']
    is_exception: bool
    entity_type: str
    entity_id: int
    subject_entity: str
    location_id: int | None
    location_name: str | None
    order_id: int | None
    order_line_id: int | None
    caused_by_event_id: int | None
    causal_depth: int
    message: str | None
    current_commitment: date | None


class Timeline(Model):
    order_number: str
    count: int
    events: list[Event]


class Node(Event):
    steps: int = Field(description='Shortest hops from selected event; selected event is 0.')
    path: list[int] = Field(description='One deterministic shortest path, starting at selected event.')


class Edge(Model):
    cause_event_id: int
    effect_event_id: int
    kind: Literal['PRIMARY', 'CONTRIBUTING', 'ALTERNATIVE', 'CORRECTIVE']


class Graph(Model):
    selected_event_id: int
    max_depth: int
    count: int
    nodes: list[Node]
    edges: list[Edge]
    truncated: bool = Field(description='At least one reachable node was excluded by max_depth.')
    cycle_detected: bool = Field(description='A directed cycle was observed in the returned subgraph.')


class RootCause(Graph):
    earliest_exception_event_id: int | None = Field(description='Earliest WARNING/FAILED by event_time then ID, in returned primary chain only.')
    chain_start_event_id: int | None = Field(description='A returned node with no primary parent; null if cycle or truncated before root.')


class ImpactLine(Model):
    order_line_id: int
    line_number: int
    current_commitment: date | None
    latest_affected_event_id: int
    latest_affected_event_time: datetime
    causal_hops: int = Field(description='Shortest hops to the latest affected event, not the minimum for the line.')


class ImpactOrder(Model):
    order_id: int
    order_number: str
    customer_name: str
    lines: list[ImpactLine]


class Impact(Graph):
    affected_order_count: int
    orders: list[ImpactOrder]


class Stage(Model):
    stage_order: int
    stage: str
    sample_lines: int
    average_hours: float | None
    p90_hours: float | None


class Durations(Model):
    order_number: str | None
    order_line_id: int | None
    start_time: datetime | None
    end_time: datetime | None
    stages: list[Stage]


class ErrorDetail(Model):
    code: str
    message: str


class ErrorResponse(Model):
    error: ErrorDetail


class Health(Model):
    status: Literal['ok']
