export async function api(path, options = {}) {
  const auth = localStorage.getItem('repo_auth');
  
  const response = await fetch(path, {
    headers: {
      'Content-Type': 'application/json',
      ...(auth ? { 'Authorization': `Bearer ${auth}` } : {}),
      ...(options.headers || {})
    },
    ...options
  });

  if (response.status === 401) {
    throw new Error('UNAUTHORIZED');
  }

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return response.json();
}
