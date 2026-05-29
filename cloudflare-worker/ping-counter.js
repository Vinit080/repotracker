/**
 * RepoTracker Install Counter — Cloudflare Worker
 *
 * Deployment (free Cloudflare account, ~5 minutes):
 * 1. Go to https://dash.cloudflare.com/ → Workers & Pages → Create Worker
 * 2. Paste this code, name the worker "repotracker-ping"
 * 3. Go to Settings → Variables → KV Namespace Bindings
 *    Create a KV namespace called "REPOTRACKER_COUNTS", bind as COUNTS
 * 4. Deploy. Worker URL: https://repotracker-ping.<your-account>.workers.dev
 * 5. Update PING_URL in src/constants.js to match your Worker URL + /count
 * 6. Add this to your README badge:
 *    ![Installs](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Frepotracker-ping.YOUR-ACCOUNT.workers.dev%2Fstats&query=total&label=installs&color=6366f1)
 *
 * Privacy guarantee: ONLY stores { count, versions: {}, platforms: {} }.
 * NO install IDs, NO IPs, NO timestamps, NO personal data.
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json',
    };

    // OPTIONS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    // POST /count — receive an anonymous install ping
    if (request.method === 'POST' && url.pathname === '/count') {
      try {
        const body = await request.json();
        const version  = String(body.version  || 'unknown').slice(0, 20);
        const platform = String(body.platform || 'unknown').slice(0, 20);

        // Load current stats from KV (or start fresh)
        let stats = { total: 0, versions: {}, platforms: {} };
        const raw = await env.COUNTS.get('stats');
        if (raw) stats = JSON.parse(raw);

        // Increment
        stats.total += 1;
        stats.versions[version]   = (stats.versions[version]   || 0) + 1;
        stats.platforms[platform] = (stats.platforms[platform] || 0) + 1;

        // Save back
        await env.COUNTS.put('stats', JSON.stringify(stats));

        return new Response(JSON.stringify({ ok: true, total: stats.total }), {
          status: 200, headers: cors,
        });
      } catch {
        return new Response(JSON.stringify({ ok: false }), {
          status: 400, headers: cors,
        });
      }
    }

    // GET /stats — return public stats (for shields.io badge)
    if (request.method === 'GET' && url.pathname === '/stats') {
      const raw = await env.COUNTS.get('stats');
      const stats = raw ? JSON.parse(raw) : { total: 0, versions: {}, platforms: {} };
      return new Response(JSON.stringify(stats), {
        status: 200, headers: { ...cors, 'Cache-Control': 'public, max-age=300' },
      });
    }

    // GET /badge — redirect to a shields.io badge
    if (request.method === 'GET' && url.pathname === '/badge') {
      const raw = await env.COUNTS.get('stats');
      const stats = raw ? JSON.parse(raw) : { total: 0 };
      const badgeUrl = `https://img.shields.io/badge/installs-${stats.total}-6366f1?style=flat-square`;
      return Response.redirect(badgeUrl, 302);
    }

    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404, headers: cors,
    });
  },
};
