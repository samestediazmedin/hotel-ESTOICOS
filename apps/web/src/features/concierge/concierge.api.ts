/**
 * fetchCsrfToken — fetches the concierge CSRF token from the public endpoint.
 *
 * Sets the __Host-concierge-csrf cookie via credentials: 'include'.
 * The token must be sent as X-CSRF-Token header on POST /api/concierge/chat.
 */
export async function fetchCsrfToken(): Promise<string> {
  const response = await fetch('/api/public/concierge/csrf-token', {
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch CSRF token: ${response.status}`);
  }
  const data = (await response.json()) as { csrfToken: string };
  return data.csrfToken;
}
