"""
Seed one user account per active IPL franchise for quick demo login.
Run once: DATABASE_URL=... python db/seed_franchise_users.py
"""
import os, sys, psycopg2, uuid
from passlib.context import CryptContext

DB_URL = os.environ.get("DATABASE_URL")
if not DB_URL:
    print("ERROR: DATABASE_URL not set", file=sys.stderr); sys.exit(1)

pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Active IPL franchises only (not defunct ones)
FRANCHISES = [
    ("Chennai Super Kings",    "CSK"),
    ("Mumbai Indians",          "MI"),
    ("Royal Challengers Bengaluru", "RCB"),
    ("Kolkata Knight Riders",  "KKR"),
    ("Delhi Capitals",         "DC"),
    ("Rajasthan Royals",       "RR"),
    ("Sunrisers Hyderabad",    "SRH"),
    ("Punjab Kings",           "PBKS"),
    ("Gujarat Titans",         "GT"),
    ("Lucknow Super Giants",   "LSG"),
]

conn = psycopg2.connect(DB_URL)
cur  = conn.cursor()

created = 0
for name, short in FRANCHISES:
    # Get franchise ID
    cur.execute("SELECT id FROM franchises WHERE short_name = %s LIMIT 1", (short,))
    row = cur.fetchone()
    if not row:
        print(f"  SKIP {short} — not in DB")
        continue
    franchise_id = row[0]

    email    = f"{short.lower()}@cricket-iq.com"
    password = f"{short}@1234"  # e.g. CSK@1234
    hashed   = pwd.hash(password)

    cur.execute("SELECT id FROM users WHERE email = %s", (email,))
    if cur.fetchone():
        print(f"  EXISTS {short} ({email})")
        continue

    cur.execute("""
        INSERT INTO users (email, hashed_password, full_name, is_active, is_superuser, role, franchise_id)
        VALUES (%s, %s, %s, true, false, 'Head Analyst', %s)
    """, (email, hashed, f"{name} Analyst", franchise_id))
    created += 1
    print(f"  CREATED {short:5s}  {email:30s}  pass: {password}")

# Super admin
cur.execute("SELECT id FROM users WHERE email = 'admin@cricket-iq.com'")
if not cur.fetchone():
    cur.execute("""
        INSERT INTO users (email, hashed_password, full_name, is_active, is_superuser, role)
        VALUES (%s, %s, 'Platform Admin', true, true, 'Super Admin')
    """, ("admin@cricket-iq.com", pwd.hash("Admin@1234")))
    print(f"  CREATED admin  admin@cricket-iq.com  pass: Admin@1234")
    created += 1

conn.commit()
conn.close()
print(f"\nDone. {created} accounts created.")
