"""Database setup script.
Creates the mira database and user if they don't exist.
Run with: python scripts/setup_db.py

Requires psycopg2 (synchronous) since this runs before the async app.
"""

import subprocess
import sys
import os


def run_psql(cmd: str, user: str = "postgres", db: str = "postgres"):
    """Run a psql command."""
    psql_path = r"C:\Program Files\PostgreSQL\17\bin\psql.exe"
    result = subprocess.run(
        [psql_path, "-h", "localhost", "-U", user, "-d", db, "-c", cmd],
        capture_output=True,
        text=True,
        env={**os.environ, "PGPASSWORD": os.environ.get("PG_SUPERUSER_PASSWORD", "")},
    )
    return result


def main():
    pg_password = os.environ.get("PG_SUPERUSER_PASSWORD")
    if not pg_password:
        print("Set PG_SUPERUSER_PASSWORD environment variable to your postgres superuser password.")
        print("Example: PG_SUPERUSER_PASSWORD=mypassword python scripts/setup_db.py")
        sys.exit(1)

    print("Creating database 'mira' and user 'mira'...")

    # Create user
    result = run_psql("CREATE USER mira WITH PASSWORD 'mira';")
    if "already exists" in (result.stderr or ""):
        print("User 'mira' already exists — OK")
    elif result.returncode == 0:
        print("User 'mira' created")
    else:
        print(f"User creation: {result.stderr.strip()}")

    # Create database
    result = run_psql("CREATE DATABASE mira OWNER mira;")
    if "already exists" in (result.stderr or ""):
        print("Database 'mira' already exists — OK")
    elif result.returncode == 0:
        print("Database 'mira' created")
    else:
        print(f"Database creation: {result.stderr.strip()}")

    # Grant privileges
    run_psql("GRANT ALL PRIVILEGES ON DATABASE mira TO mira;")

    print("\nDatabase setup complete!")
    print("Now run: cd backend && .venv/Scripts/alembic upgrade head")


if __name__ == "__main__":
    main()
