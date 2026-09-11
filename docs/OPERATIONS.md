# Farhan AI — Operations & Incident Runbook

## 1. Database Operations & Backups

Farhan AI uses an embedded SQLite database (`data/farhan_ai.db`) running in Write-Ahead Logging (WAL) mode.

### 1.1 Creating Backups
The backup system performs atomic WAL checkpointing (`PRAGMA wal_checkpoint(TRUNCATE);`), integrity verification, and calculates SHA-256 checksums before saving backups to `data/backups/`.

You can trigger a backup programmatically or via a Node.js management script:

```bash
npx tsx -e "import { createDatabaseBackup } from './src/lib/db/backup'; createDatabaseBackup().then(b => console.log('Backup created:', b));"
```

### 1.2 Automated Backup Cron (Recommended Daily)
Add to system crontab:
```cron
# Run Farhan AI verified database backup every day at 02:00 UTC
0 2 * * * cd /opt/farhan-ai && npx tsx -e "import { createDatabaseBackup } from './src/lib/db/backup'; createDatabaseBackup({ maxRetained: 14 });" >> /var/log/farhan-backup.log 2>&1
```

### 1.3 Database Restoration Procedure
In the event of data corruption or operator recovery:
1. Stop the application process:
   ```bash
   pm2 stop farhan-ai
   ```
2. Identify the desired backup file in `data/backups/`:
   ```bash
   ls -la data/backups/
   ```
3. Run the restore utility (this automatically creates a pre-restore safety snapshot before replacing the active database):
   ```bash
   npx tsx -e "import { restoreDatabaseFromBackup } from './src/lib/db/backup'; restoreDatabaseFromBackup('data/backups/farhan_ai_backup_YYYY-MM-DD_HH-mm-ss.db').then(console.log);"
   ```
4. Restart the application process:
   ```bash
   pm2 start farhan-ai
   ```

---

## 2. Emergency STOP Procedure

If the agent performs unexpected actions or browser automation needs to be immediately terminated:

### Method 1: Emergency API STOP Trigger
Send a POST request to the emergency stop endpoint:
```bash
curl -X POST https://farhan.yourdomain.com/api/computer-control/stop \
  -H "Authorization: Bearer <YOUR_FARHAN_AUTH_TOKEN>"
```

**What Happens:**
1. All active browser contexts and Chromium instances are immediately closed.
2. All `PENDING_APPROVAL` and `EXECUTING` computer actions are transitioned to `CANCELLED`.
3. An immutable audit record `emergency_stop` is written to `audit_logs`.
4. The Central Assistant is notified that computer control has halted.

### Method 2: Process Graceful Termination
Send `SIGTERM` to the Node process:
```bash
kill -TERM <PID>
```
The application executes the graceful shutdown lifecycle, flushes WAL frames, cleans up browser sessions, and exits cleanly with code 0.

---

## 3. Audit Trail Inspection

All security-relevant actions, authentication successes/failures, approvals, and mutations are recorded in the append-only `audit_logs` table with automated secret scrubbing.

### Querying Audit Logs via API
```bash
# Query the 20 most recent audit logs
curl -s "https://farhan.yourdomain.com/api/audit?limit=20" \
  -H "Authorization: Bearer <YOUR_FARHAN_AUTH_TOKEN>" | jq .

# Filter by event type (e.g. auth failures)
curl -s "https://farhan.yourdomain.com/api/audit?eventType=auth_failure" \
  -H "Authorization: Bearer <YOUR_FARHAN_AUTH_TOKEN>" | jq .
```

---

## 4. Diagnostics & System Readiness

To verify complete system health:
```bash
curl -s https://farhan.yourdomain.com/api/ready \
  -H "Authorization: Bearer <YOUR_FARHAN_AUTH_TOKEN>" | jq .
```

**Passing Output Expectation:**
* `ready`: `true`
* `checks.database.status`: `"pass"`
* `checks.integrity.status`: `"pass"`
* `checks.migrations.status`: `"pass"`
* `checks.diskStorage.status`: `"pass"`
* HTTP Status: `200 OK`
