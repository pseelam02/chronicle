const fragment = location.hash.slice(1);
if (fragment) {
  sessionStorage.setItem("chronicle-session", fragment);
  history.replaceState(null, "", location.pathname);
}
const token = sessionStorage.getItem("chronicle-session") || "";
export const auth = { Authorization: `Bearer ${token}` };
export async function api<T>(url: string, body?: unknown): Promise<T> {
  const r = await fetch(url, {
    headers: {
      ...auth,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    method: body ? "POST" : "GET",
    body: body ? JSON.stringify(body) : undefined,
  });
  const value = await r.json();
  if (!r.ok) throw Error(value.error || "Request failed");
  return value;
}
