#!/bin/bash
cd "$(dirname "$0")"

echo "⚠️  WARNING: This will delete ALL DATA from the database!"
echo "Database: $(echo $DATABASE_URL | sed -n 's/.*@[^/]*\/\([^?]*\).*/\1/p')"
read -p "Are you sure? Type 'yes' to continue: " confirm

if [ "$confirm" != "yes" ]; then
    echo "Aborted."
    exit 1
fi

echo "Resetting database..."
npx prisma migrate reset --force --skip-seed

echo "Regenerating Prisma Client..."
npx prisma generate

echo "✅ Database reset complete!"
