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

  if (!response.ok) {
    let msg = `Request failed: ${response.status}`;
    try { const body = await response.json(); if (body.error) msg = body.error; } catch {}
    throw new Error(msg);
  }

  return response.json();
}
