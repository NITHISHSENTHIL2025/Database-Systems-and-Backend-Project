const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000/api';

export async function api(path, options = {}) {
  const token = localStorage.getItem('gym_token');
  const headers = { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(options.headers || {}) };
  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  let body = null;
  try { body = await response.json(); } catch { body = null; }
  if (!response.ok) throw new Error(body?.message || 'Request failed.');
  return body;
}
