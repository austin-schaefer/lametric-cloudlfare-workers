# Counter App

Increments a counter every 5 minutes via scheduled worker and displays the current count on LaMetric devices with a random icon.

## Testing

**Local:**
```bash
curl http://localhost:8787/apps/counter
```

**Production:**
```bash
curl https://lametric-backend.austin-david-schaefer.workers.dev/apps/counter
```

## Storage

- **KV Key:** `app:counter`
- **Value:** Integer (increments on each scheduled run)

## Response Format

Single frame with counter value and random LaMetric icon:
```json
{
  "frames": [
    {"text": "#42", "icon": "i123"}
  ]
}
```
