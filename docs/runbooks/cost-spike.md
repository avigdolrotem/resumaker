# Runbook: Cost Spike

> Triggered by AWS Budget alert or Anthropic billing alert.

## Symptoms

- Email from AWS Budgets at 50/80/100/120% threshold
- Anthropic dashboard shows daily cost >$50
- Cost Anomaly Detection notification

## Quick triage (5 min)

```bash
# Are we under attack?
psql $DATABASE_URL -c "
  SELECT count(*), date_trunc('hour', created_at) AS h
  FROM generations
  WHERE created_at > now() - interval '24 hours'
  GROUP BY h ORDER BY h DESC LIMIT 12;
"

# Top users by generation count today
psql $DATABASE_URL -c "
  SELECT user_id, count(*), sum(prompt_tokens+completion_tokens) AS tokens
  FROM generations WHERE created_at > now() - interval '1 day'
  GROUP BY user_id ORDER BY tokens DESC LIMIT 10;
"
```

## Most likely causes (in order)

1. **Single user runaway** — bug in their integration, hitting `/api/resumes/generate` in a loop
2. **Rate limiter down** (Redis outage) — fail-open behavior letting through normal traffic
3. **Bot attack** — scraper hitting public endpoints
4. **NAT gateway egress** — sudden Anthropic traffic spike from new feature

## Mitigation by cause

### Single user runaway

```bash
# Ban the user temporarily
psql $DATABASE_URL -c "UPDATE users SET role='suspended' WHERE id='<id>';"
# Add a check in route: `if (user.role === 'suspended') reject`
```

### Rate limiter / Redis down

```bash
# Check Redis health
kubectl exec -n resumaker redis-0 -- redis-cli ping
# Restart if dead
kubectl rollout restart statefulset/redis -n resumaker
```

### Bot attack

Cloudflare: Security → Bot Fight Mode → Toggle "Super Bot Fight" (paid).
Or temporary: under-attack mode (Security → Settings).

### Disable LLM entirely (panic button)

```bash
kubectl set env deployment/web LLM_ENABLED=false -n resumaker
kubectl rollout restart deployment/web -n resumaker
```

This sends 503 to all generate requests. Re-enable when root cause known.

## Permanent fixes

After mitigation, file follow-ups for:

- Global rate limit (per-IP, beyond per-user)
- Circuit breaker on Anthropic spend (env: `ANTHROPIC_DAILY_BUDGET_USD`)
- Block known-bad IPs at Cloudflare WAF
- Alert on `generations_per_hour > 100` (Grafana)

## When to wake people up

- > $100/day = page on-call
- > $500/day = also notify Rotem
- Auth bypass / data leak = SEV-0, all-hands

---

**Author**: Rotem · **Last updated**: 2026-05-23
