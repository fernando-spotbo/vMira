"""Clean PostgreSQL setup — generates secure passwords, creates DB + user, stores safely."""

import asyncio
import re
import secrets
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


async def main():
    import asyncpg

    # Generate secure credentials
    pg_superuser_pw = secrets.token_urlsafe(32)
    mira_db_pw = secrets.token_urlsafe(32)
    app_secret_key = secrets.token_hex(32)
    hmac_secret = secrets.token_hex(32)

    try:
        conn = await asyncpg.connect(host="localhost", port=5432, user="postgres", database="postgres")
    except Exception as e:
        print(f"Cannot connect: {e}")
        sys.exit(1)

    print("Connected to PostgreSQL")

    # Fix collation version mismatch (Windows update issue)
    try:
        await conn.execute("ALTER DATABASE template1 REFRESH COLLATION VERSION")
        print("Fixed template1 collation")
    except Exception:
        pass

    # Reset postgres superuser password
    await conn.execute(f"ALTER USER postgres WITH PASSWORD '{pg_superuser_pw}'")
    print("Reset postgres superuser password")

    # Create mira user
    exists = await conn.fetchval("SELECT 1 FROM pg_roles WHERE rolname='mira'")
    if exists:
        await conn.execute(f"ALTER USER mira WITH PASSWORD '{mira_db_pw}'")
        print("Updated user: mira")
    else:
        await conn.execute(f"CREATE USER mira WITH PASSWORD '{mira_db_pw}'")
        print("Created user: mira")

    # Drop and recreate mira database (clean start)
    # First disconnect any existing connections
    try:
        await conn.execute("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='mira' AND pid <> pg_backend_pid()")
        await conn.execute("DROP DATABASE IF EXISTS mira")
    except Exception:
        pass

    await conn.execute("CREATE DATABASE mira OWNER mira TEMPLATE template0")
    print("Created database: mira")
    await conn.execute("GRANT ALL PRIVILEGES ON DATABASE mira TO mira")
    await conn.close()

    # Build URLs
    db_url = f"postgresql+asyncpg://mira:{mira_db_pw}@localhost:5432/mira"

    # Update .env
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    env_path = os.path.join(base_dir, ".env")
    with open(env_path, "r") as f:
        content = f.read()
    content = re.sub(r"DATABASE_URL=.*", f"DATABASE_URL={db_url}", content)
    content = re.sub(r"SECRET_KEY=.*", f"SECRET_KEY={app_secret_key}", content)
    content = re.sub(r"HMAC_SECRET=.*", f"HMAC_SECRET={hmac_secret}", content)
    with open(env_path, "w") as f:
        f.write(content)

    # Update alembic.ini
    alembic_path = os.path.join(base_dir, "alembic.ini")
    with open(alembic_path, "r") as f:
        alembic_content = f.read()
    alembic_content = re.sub(r"sqlalchemy\.url = .*", f"sqlalchemy.url = {db_url}", alembic_content)
    with open(alembic_path, "w") as f:
        f.write(alembic_content)

    # Save credentials securely
    cred_path = os.path.join(base_dir, ".credentials")
    with open(cred_path, "w") as f:
        f.write("# Mira local development credentials\n")
        f.write("# DO NOT COMMIT THIS FILE\n\n")
        f.write(f"PG_SUPERUSER_PASSWORD={pg_superuser_pw}\n")
        f.write(f"MIRA_DB_PASSWORD={mira_db_pw}\n")
        f.write(f"APP_SECRET_KEY={app_secret_key}\n")
        f.write(f"HMAC_SECRET={hmac_secret}\n")

    print()
    print("All secrets generated and saved:")
    print(f"  .env          — DATABASE_URL, SECRET_KEY, HMAC_SECRET")
    print(f"  .credentials  — all passwords (DO NOT COMMIT)")
    print(f"  alembic.ini   — migration URL")
    print()
    print("Setup complete!")


if __name__ == "__main__":
    asyncio.run(main())
