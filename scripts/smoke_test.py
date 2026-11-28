"""Smoke-test the running SupplyTrace Docker services without modifying data."""
import sys
import urllib.error
import urllib.request

BASE_URL = "http://127.0.0.1:8002"
FRONTEND_URL = "http://127.0.0.1:5174"

CHECKS = {
    "/health": 200,
    "/docs": 200,
    "/openapi.json": 200,
    "/api/orders/SO-SYN-000001/timeline": 200,
    "/api/events/10/root-cause": 200,
    "/api/events/3/impact": 200,
    "/api/analytics/stage-durations": 200,
    "/api/events/999999999/root-cause": 404,
    "/api/events/0/impact": 422,
}


def check(url, expected):
    try:
        with urllib.request.urlopen(url, timeout=30) as response:
            actual = response.status
    except urllib.error.HTTPError as exc:
        actual = exc.code
    except Exception as exc:
        print(f"FAIL {url}: {exc}")
        return False

    passed = actual == expected
    print(f"{'PASS' if passed else 'FAIL'} {url}: {actual} (expected {expected})")
    return passed


def main():
    results = [check(BASE_URL + path, expected) for path, expected in CHECKS.items()]
    results.append(check(FRONTEND_URL + "/", 200))

    passed = sum(results)
    total = len(results)
    print(f"\nSupplyTrace Smoke Test: {passed}/{total} passed")
    return 0 if passed == total else 1


if __name__ == "__main__":
    sys.exit(main())
