export async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: {
      ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {})
    },
    ...options
  });

  if (response.status === 401) {
    let errData = {};
    try { errData = await response.json(); } catch (e) {}
    const err = new Error('UNAUTHORIZED');
    err.data = errData;
    throw err;
  }

  // 403 with requiresUpgrade = show the upgrade modal, not a generic error toast
  if (response.status === 403) {
    let body = {};
    try { body = await response.json(); } catch {}
    if (body.requiresUpgrade) {
      const err = new Error(body.error || 'Pro feature');
      err.requiresUpgrade = true;
      err.upgradeUrl = body.upgradeUrl || '';
      err.feature = body.feature || '';
      throw err;
    }
    throw new Error(body.error || `Forbidden (403)`);
  }

  if (!response.ok) {
    let msg = `Request failed: ${response.status}`;
    try { const body = await response.json(); if (body.error) msg = body.error; } catch {}
    throw new Error(msg);
  }

  return response.json();
}

