export const API_URL = "http://localhost:3001/api";

export async function fetchApi(endpoint: string, options: RequestInit = {}) {
  const token = localStorage.getItem("qd_token");
  
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || "An API error occurred");
  }

  // Not all responses have body (like 204 No Content or some 200/201s without return)
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}
