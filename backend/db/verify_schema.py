"""Verify the schema was applied correctly."""
import os
import sys
import psycopg2

DB_URL = os.environ.get("DATABASE_URL")
if not DB_URL:
    print("ERROR: DATABASE_URL environment variable is not set.", file=sys.stderr)
    sys.exit(1)

conn = psycopg2.connect(DB_URL)
cur = conn.cursor()

cur.execute("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")
tables = [r[0] for r in cur.fetchall()]
print(f"\n{len(tables)} tables created:\n")
for t in tables:
    print(f"  {t}")

cur.execute("SELECT typname FROM pg_type WHERE typtype='e' ORDER BY typname")
enums = [r[0] for r in cur.fetchall()]
print(f"\n{len(enums)} enum types:\n")
for e in enums:
    print(f"  {e}")

cur.execute("SELECT version FROM schema_migrations")
versions = cur.fetchall()
print(f"\nSchema migrations: {versions}")

conn.close()
