# Runbook: LLM Injection Detected

> Triggered when `safetyDetections` count spikes or a successful injection is found in production output.

## Symptoms

- Grafana alert: `generations_safety_blocked_rate > 5%`
- User report: resume output contains "ignore previous instructions" or similar
- Audit log shows `resume_generation_blocked` events from same user

## Quick triage (10 min)

```sql
-- Recent blocked generations
SELECT user_id, error, created_at
FROM generations
WHERE status='rejected_input'
  AND created_at > now() - interval '1 hour'
ORDER BY created_at DESC LIMIT 50;

-- Patterns triggered most
SELECT
  jsonb_array_elements(safety_detections)->>'severity' AS sev,
  count(*)
FROM generations
WHERE safety_detections IS NOT NULL
  AND created_at > now() - interval '1 day'
GROUP BY sev;
```

## If detection is a false positive (legitimate JD blocked)

1. Save the JD to `tests/security/false-positives/<date>.txt`
2. Adjust the pattern in `packages/ai-safety/src/input-filter.ts`
3. Add a test in `packages/ai-safety/src/input-filter.test.ts` ensuring it now passes
4. Bump severity from 'high' to 'medium' for the offending pattern
5. Deploy

## If detection is real (someone IS attempting injection)

### Immediate

```bash
# Identify the user
SELECT email, role FROM users WHERE id='<user-id>';

# Disable their account
psql $DATABASE_URL -c "UPDATE users SET deleted_at=now() WHERE id='<user-id>';"

# Or suspend (preserves data for investigation)
psql $DATABASE_URL -c "UPDATE users SET role='suspended' WHERE id='<user-id>';"
```

### Forensics

1. Pull all generations from that user (last 30 days)
2. Pull all audit events for that user
3. Pull session IP hashes — were they coming from one IP?
4. If IP shared → consider IP block at Cloudflare
5. Document in `docs/incidents/<date>-injection.md`

### If injection bypassed our filter (CRITICAL)

This means the LLM produced output that complied with injected instructions.

1. **Immediately**: disable LLM via `LLM_ENABLED=false` env, redeploy
2. Reproduce the injection in `tests/security/prompt-injection.test.ts`
3. Add regression test that catches it
4. Tighten `input-filter.ts` until test passes
5. Re-enable LLM after deploy

## Communication

If user data was leaked: **SEV-0**, follow `docs/runbooks/data-breach.md`.

If only system-prompt was leaked: **SEV-1**, internal notification + post-mortem.

If no actual harm, just attempts: **SEV-3**, log it and tune filter quietly.

---

**Author**: Rotem · **Last updated**: 2026-05-23
