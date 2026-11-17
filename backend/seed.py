import asyncio
from app.core.database import AsyncSessionLocal
from app.services.seed_data import seed_database

async def main():
    async with AsyncSessionLocal() as session:
        result = await seed_database(session)
        print("Seed result:", result)

if __name__ == "__main__":
    asyncio.run(main())
