# Vendored Skill References

These are read at runtime by `lib/claude.ts` and injected as cached prompt context for analysis generation. They are vendored copies of the marketing skills in `~/.claude/skills/` so Vercel can read them in production.

## Sync

When the source skills change, re-run:

```bash
cp ~/.claude/skills/brunson-funnel-architect/references/{funnel-types,linchpin-framework,hook-story-offer,dream-100-playbook}.md skill-refs/brunson/
cp ~/.claude/skills/hormozi-offer-architect/references/{grand-slam-checklist,value-equation}.md skill-refs/hormozi/
```

`am-context.md` has no upstream source — edit it here.

## What each framework loads

| Framework | Files loaded |
|---|---|
| `brunson-funnel` | `brunson/funnel-types.md`, `brunson/linchpin-framework.md`, `brunson/hook-story-offer.md` |
| `hormozi-grand-slam` | `hormozi/grand-slam-checklist.md`, `hormozi/value-equation.md` |
| `dream-100` | `brunson/dream-100-playbook.md` |
| `challenger-recommendation` | All of the above |
