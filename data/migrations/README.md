# Migrations

One-way schema migrations. Apply in numerical order to bring an existing DB
forward. `schema.sql` is the source of truth for fresh installs; this directory
exists for already-deployed databases that need to evolve.

Each migration is idempotent (`IF NOT EXISTS` / `IF EXISTS` guards) so it's safe
to re-run.

## Apply

```bash
source apps/admin/.env.local
for f in data/migrations/0*.sql; do
  echo "== applying $f =="
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f"
done
```

## When to add one

When you change `data/schema.sql` in a way that would break an existing DB
(adding columns, indexes, constraints; new tables; renames). For pure additions
to fresh installs you still update `schema.sql` so a clean clone sees the new
shape.
