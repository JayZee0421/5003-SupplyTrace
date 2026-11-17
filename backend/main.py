from contextlib import asynccontextmanager
from datetime import datetime
from typing import Annotated
import logging
import psycopg
from psycopg_pool import PoolTimeout
from fastapi import FastAPI, Depends, HTTPException, Query, Path, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from backend.config import Settings
from backend.db import Database
from backend import contracts as models, service

logger = logging.getLogger(__name__)
PositiveID = Annotated[int, Path(gt=0, le=9223372036854775807)]
Depth = Annotated[int, Query(ge=0, le=64, description='Maximum hops, including depth 0 for the selected event only.')]


def get_conn(request: Request):
    with request.app.state.database.snapshot() as conn:
        yield conn


Connection = Annotated[psycopg.Connection, Depends(get_conn)]


def error_response(status, code, message):
    return JSONResponse(status_code=status, content={'error': {'code': code, 'message': message}})


def create_app(settings: Settings | None = None):
    settings = settings or Settings()
    database = Database(settings)

    @asynccontextmanager
    async def lifespan(app):
        database.pool.open(wait=False)
        yield
        database.pool.close()

    errors = {code: {'model': models.ErrorResponse} for code in (404, 422, 500, 503, 504)}
    app = FastAPI(title='SupplyTrace API', version='1.0.0', lifespan=lifespan,
                  description='订单时间线、主链根因、全因果影响和环节耗时。时间为 UTC；耗时单位为小时。',
                  responses=errors)
    app.state.database = database
    app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins,
                       allow_methods=['GET'], allow_headers=['*'], allow_credentials=False)

    @app.exception_handler(StarletteHTTPException)
    async def http_error(request, exc):
        return error_response(exc.status_code, {404: 'NOT_FOUND', 422: 'VALIDATION_ERROR'}.get(exc.status_code, 'HTTP_ERROR'), str(exc.detail))

    @app.exception_handler(RequestValidationError)
    async def validation_error(request, exc):
        return error_response(422, 'VALIDATION_ERROR', 'Invalid request parameters')

    @app.exception_handler(psycopg.errors.QueryCanceled)
    async def query_timeout(request, exc):
        return error_response(504, 'QUERY_TIMEOUT', 'Database query exceeded time limit')

    @app.exception_handler(PoolTimeout)
    @app.exception_handler(psycopg.OperationalError)
    async def database_unavailable(request, exc):
        return error_response(503, 'DATABASE_UNAVAILABLE', 'Database is temporarily unavailable')

    @app.exception_handler(Exception)
    async def internal_error(request, exc):
        logger.error('Unhandled API error: %s', type(exc).__name__)
        return error_response(500, 'INTERNAL_ERROR', 'An internal error occurred')

    @app.get('/health', response_model=models.Health, tags=['Health'])
    def health(conn: Connection):
        conn.execute('SELECT 1')
        return {'status': 'ok'}

    @app.get('/api/orders/{order_number}/timeline', response_model=models.Timeline, tags=['Orders'])
    def timeline(order_number: Annotated[str, Path(min_length=1, max_length=100)], conn: Connection):
        return service.timeline(conn, order_number)

    @app.get('/api/events/{event_id}/root-cause', response_model=models.RootCause, tags=['Events'])
    def root_cause(event_id: PositiveID, conn: Connection, max_depth: Depth = 64):
        return service.root_cause(conn, event_id, max_depth)

    @app.get('/api/events/{event_id}/impact', response_model=models.Impact, tags=['Events'])
    def impact(event_id: PositiveID, conn: Connection, max_depth: Depth = 64):
        return service.impact(conn, event_id, max_depth)

    @app.get('/api/analytics/stage-durations', response_model=models.Durations, tags=['Analytics'])
    def durations(conn: Connection, order_number: Annotated[str | None, Query(min_length=1, max_length=100)] = None,
                  order_line_id: Annotated[int | None, Query(gt=0, le=9223372036854775807)] = None,
                  start_time: datetime | None = None, end_time: datetime | None = None):
        for value in (start_time, end_time):
            if value is not None and value.utcoffset() is None:
                raise HTTPException(422, 'Times must include a timezone')
        if start_time is not None and end_time is not None and start_time >= end_time:
            raise HTTPException(422, 'start_time must precede end_time')
        return service.stage_durations(conn, dict(order_number=order_number, order_line_id=order_line_id,
                                                  start_time=start_time, end_time=end_time))

    return app


app = create_app()
