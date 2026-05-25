export async function api(path, options = {}) {
  const auth = localStorage.getItem('repo_auth');

  const response = await fetch(path, {
    headers: {
      ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(auth ? { 'Authorization': `Bearer ${auth}` } : {}),
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
    throw new Error(`Request failed: ${response.status}`);
  }

  return response.json();
}
