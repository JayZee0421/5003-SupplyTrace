from contextlib import contextmanager
from pathlib import Path
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool
from backend.config import Settings

SQL_DIR = Path(__file__).with_name('sql')


def load_sql(name: str) -> str:
    return (SQL_DIR / f'{name}.sql').read_text(encoding='utf-8')


class Database:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.pool = ConnectionPool(settings.database_url, min_size=0,
                                   max_size=settings.pool_size, timeout=3, open=False,
                                   kwargs={'row_factory': dict_row, 'connect_timeout': 3})

    @contextmanager
    def snapshot(self):
        with self.pool.connection() as conn:
            with conn.transaction():
                conn.execute('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY')
                conn.execute("SELECT set_config('statement_timeout', %s, true)",
                             [str(self.settings.statement_timeout_ms)])
                conn.execute("SET LOCAL TIME ZONE 'UTC'")
                conn.execute('SET LOCAL search_path = public, pg_temp')
                yield conn
