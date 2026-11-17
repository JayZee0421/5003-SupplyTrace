from contextlib import contextmanager
import pytest
import psycopg
from psycopg_pool import PoolTimeout
from fastapi.testclient import TestClient
from backend.main import create_app, get_conn
from backend.service import has_cycle, shortest_paths


def edge(a, b, kind='PRIMARY'):
    return dict(cause_event_id=a, effect_event_id=b, kind=kind)


def test_diamond_paths_and_duplicate_edges():
    edges = [edge(1, 3), edge(1, 2), edge(2, 4), edge(3, 4), edge(1, 2, 'CONTRIBUTING')]
    assert shortest_paths(1, {1, 2, 3, 4}, edges)[4] == [1, 2, 4]
    assert not has_cycle({1, 2, 3, 4}, edges)
    assert has_cycle({1, 2, 3, 4}, edges + [edge(4, 1)])
    assert has_cycle({1}, [edge(1, 1)])


def test_large_cycle_detection_is_iterative():
    ids = set(range(3000))
    edges = [edge(i, i+1) for i in range(2999)]
    assert not has_cycle(ids, edges)
    assert has_cycle(ids, edges + [edge(2999, 0)])


@pytest.fixture
def client():
    app = create_app()
    app.dependency_overrides[get_conn] = lambda: None
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c


@pytest.mark.parametrize('url', [
    '/api/events/0/impact', '/api/events/-1/root-cause', '/api/events/abc/impact',
    '/api/events/9223372036854775808/impact', '/api/events/1/impact?max_depth=65',
    '/api/events/1/root-cause?max_depth=-1', '/api/analytics/stage-durations?order_line_id=0',
    '/api/analytics/stage-durations?start_time=2026-01-01T00:00:00',
    '/api/analytics/stage-durations?start_time=2026-02-01T00:00:00Z&end_time=2026-01-01T00:00:00Z',
])
def test_validation(client, url):
    response = client.get(url)
    assert response.status_code == 422
    assert set(response.json()) == {'error'}


@pytest.mark.parametrize('exc,status,code', [
    (PoolTimeout('secret connection string'), 503, 'DATABASE_UNAVAILABLE'),
    (psycopg.OperationalError('secret password'), 503, 'DATABASE_UNAVAILABLE'),
    (psycopg.errors.QueryCanceled('internal SQL'), 504, 'QUERY_TIMEOUT'),
    (RuntimeError('internal traceback'), 500, 'INTERNAL_ERROR'),
])
def test_error_redaction(exc, status, code):
    app = create_app()
    def failing():
        raise exc
    app.dependency_overrides[get_conn] = failing
    with TestClient(app, raise_server_exceptions=False) as client:
        r = client.get('/health')
    assert r.status_code == status
    assert r.json()['error']['code'] == code
    assert str(exc) not in r.text


def test_swagger_and_cors(client):
    assert client.get('/docs').status_code == 200
    schema = client.get('/openapi.json').json()
    assert schema['paths']['/api/events/{event_id}/impact']['get']['responses']['200']['content']['application/json']['schema']['$ref'].endswith('/Impact')
    allowed = client.options('/health', headers={'Origin': 'http://localhost:5173', 'Access-Control-Request-Method': 'GET'})
    assert allowed.headers['access-control-allow-origin'] == 'http://localhost:5173'
    assert 'access-control-allow-origin' not in client.options('/health', headers={
        'Origin': 'https://untrusted.example', 'Access-Control-Request-Method': 'GET'}).headers
