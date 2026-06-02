"""Apply a SQL migration file to the database."""
import os
import sys
import psycopg2

DB_URL = os.environ.get("DATABASE_URL")
if not DB_URL:
    print("ERROR: DATABASE_URL environment variable is not set.", file=sys.stderr)
    sys.exit(1)

def apply(path: str) -> None:
    with open(path, "r", encoding="utf-8") as f:
        sql = f.read()

    conn = psycopg2.connect(DB_URL)
    conn.autocommit = False
    try:
        with conn.cursor() as cur:
            cur.execute(sql)
        conn.commit()
        print(f"Migration applied: {path}")
    except Exception as e:
        conn.rollback()
        print(f"FAILED: {e}", file=sys.stderr)
        sys.exit(1)
    finally:
        conn.close()

if __name__ == "__main__":
    apply(sys.argv[1])
