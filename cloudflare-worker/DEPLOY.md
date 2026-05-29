# Deploy the RepoTracker Install Counter to Cloudflare Workers

## What This Does

Receives **anonymous, opt-in** install pings from RepoTracker instances and counts them.

- `POST /count` — increment the counter (called once on first opt-in)
- `GET /stats` — return aggregate stats (powers the install count badge in the README)

**Privacy:** Only stores `{ total, versions: {}, platforms: {} }`. No IP addresses, no user IDs, no repo names, no personal information of any kind.

---

## Deploy in 5 Minutes

### 1. Create a Cloudflare Account (Free)
Go to [dash.cloudflare.com/sign-up](https://dash.cloudflare.com/sign-up) — no credit card required.

### 2. Create the Worker
1. Dashboard → **Workers & Pages** → **Create application** → **Create Worker**
2. Name it: `repotracker-ping`
3. Click **Deploy** (ignore the default code)
4. Click **Edit code** → paste the entire contents of [`ping-counter.js`](./ping-counter.js)
5. Click **Save and deploy**

### 3. Add a KV Namespace
1. Dashboard → **Workers & Pages** → **KV** → **Create namespace**
2. Name: `REPOTRACKER_COUNTS`
3. Go back to your worker → **Settings** → **Variables** → **KV Namespace Bindings**
4. Add binding: Variable name = `COUNTS`, KV namespace = `REPOTRACKER_COUNTS`
5. Click **Save**

### 4. Update Your `.env`
```bash
PING_URL=https://repotracker-ping.YOUR-SUBDOMAIN.workers.dev/count
```

> If `PING_URL` is left blank, the server silently skips the ping. Only set it if you're running your own counter instance.

### 5. Add the Badge to README *(optional)*
```markdown
![Installs](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Frepotracker-ping.YOUR-SUBDOMAIN.workers.dev%2Fstats&query=total&label=installs&color=6366f1&style=flat-square)
```

---

## Testing

```bash
# Send a test ping
curl -X POST https://repotracker-ping.YOUR-SUBDOMAIN.workers.dev/count \
  -H "Content-Type: application/json" \
  -d '{"version":"0.2.0","platform":"win32"}'

# Expected response
# {"ok":true,"total":1}

# Check stats
curl https://repotracker-ping.YOUR-SUBDOMAIN.workers.dev/stats

# Expected response
# {"total":1,"versions":{"0.2.0":1},"platforms":{"win32":1}}
```

---

## How the Opt-In Works

1. During the setup wizard, the user sees: *"Help improve RepoTracker by sending an anonymous install ping"*
2. If the user opts in, the wizard calls `POST /api/ping-optin` to save `pingOptIn: true` in local config
3. On the next server start (and only once), the server sends a single ping to `PING_URL` containing only `{ version, platform }`
4. The user can revoke opt-in at any time in **Settings → Privacy**

The ping **never** contains:
- IP address (Cloudflare does not store it in KV)
- Repository names or paths
- API keys or any credentials
- Any personally identifiable information

---

## Cost

**Free forever** on Cloudflare's free tier:
- 100,000 requests/day
- 1 GB KV storage
- No credit card required
- `*.workers.dev` subdomain included

---

## Updating the Worker

To push a new version of `ping-counter.js`:

1. Open your worker in the Cloudflare dashboard
2. Click **Edit code**
3. Paste the updated file contents
4. Click **Save and deploy**

Or use [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/):

```bash
cd cloudflare-worker
npx wrangler deploy ping-counter.js --name repotracker-ping
```
