"""Seed the admin user.
Run after migrations: python scripts/seed_admin.py
"""

import asyncio
import os
import sys

# Add parent to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


async def main():
    from app.database import AsyncSessionLocal, engine, Base
    from app.models import User
    from app.utils.security import hash_password
    from sqlalchemy import select

    # Create tables if they don't exist (fallback)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as db:
        # Check if admin exists
        result = await db.execute(select(User).where(User.email == "admin@mira.ai"))
        if result.scalar_one_or_none():
            print("Admin user already exists")
            return

        admin = User(
            email="admin@mira.ai",
            name="Admin",
            password_hash=hash_password("admin123"),  # CHANGE IN PRODUCTION
            is_admin=True,
            is_verified=True,
            plan="enterprise",
            language="ru",
            consent_personal_data=True,
        )
        db.add(admin)
        await db.commit()
        print(f"Admin user created: admin@mira.ai (CHANGE PASSWORD!)")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
