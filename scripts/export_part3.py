"""Capture real API responses and export an OpenAPI snapshot; no data changes."""
import argparse
import json
from pathlib import Path
from fastapi.testclient import TestClient
from backend.config import Settings
from backend.main import create_app

ROOT = Path(__file__).resolve().parents[1]
PATHS = {
    'timeline':'/api/orders/SO-SYN-000001/timeline',
    'root_cause':'/api/events/10/root-cause',
    'impact':'/api/events/3/impact',
    'stage_durations':'/api/analytics/stage-durations',
    'not_found':'/api/events/999999999/root-cause',
    'validation_error':'/api/events/0/impact',
}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--database-url',required=True)
    parser.add_argument('--base-url',help='Optionally smoke-test a running HTTP service too')
    args=parser.parse_args()
    app=create_app(Settings(database_url=args.database_url))
    output=ROOT/'docs/part3'
    schema_dir=output/'schemas'
    schema_dir.mkdir(exist_ok=True)
    with TestClient(app) as client:
        assert client.get('/health').status_code==200
        schema=client.get('/openapi.json').json()
        (output/'openapi.json').write_text(json.dumps(schema,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
        for name,value in schema['components']['schemas'].items():
            (schema_dir/f'{name}.json').write_text(json.dumps(value,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
        for name,path in PATHS.items():
            r=client.get(path)
            assert r.status_code == (404 if name=='not_found' else 422 if name=='validation_error' else 200)
            payload=json.dumps(r.json(),indent=2,ensure_ascii=False)+'\n'
            (output/'examples/real'/f'{name}.json').write_text(payload,encoding='utf-8')
            # Ready-to-serve mock snapshots use exactly the same JSON contract.
            (output/'examples/mock'/f'{name}.json').write_text(payload,encoding='utf-8')
    if args.base_url:
        import httpx
        checks = {}
        with httpx.Client(base_url=args.base_url,timeout=30) as http:
            for name,path in {'health':'/health','swagger':'/docs','openapi':'/openapi.json',**PATHS}.items():
                response = http.get(path)
                expected = 404 if name=='not_found' else 422 if name=='validation_error' else 200
                assert response.status_code==expected,(path,response.status_code)
                checks[path] = response.status_code
        (output/'HTTP_SMOKE.json').write_text(json.dumps(checks,indent=2)+'\n')
    print('Exported OpenAPI, component schemas and six validated real/mock snapshots.')


if __name__=='__main__':
    main()
