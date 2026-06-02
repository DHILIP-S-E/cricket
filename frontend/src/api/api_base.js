const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api/v1";
// Access token lives in memory only — never localStorage — to protect against XSS
let _accessToken = null;
export const tokenStore = {
    get: () => _accessToken,
    set: (token) => {
        _accessToken = token;
    },
    clear: () => {
        _accessToken = null;
    },
};
class ApiError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}
async function request(endpoint, options = {}) {
    const token = tokenStore.get();
    const headers = {
        "Content-Type": "application/json",
        ...options.headers,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
    const res = await fetch(`${API_URL}${endpoint}`, { ...options, headers });
    if (!res.ok) {
        const body = await res.json().catch(() => ({ detail: "Request failed" }));
        throw new ApiError(res.status, body.detail ?? body.message ?? "Request failed");
    }
    return res.json();
}
export const api = {
    get: (url) => request(url),
    post: (url, body) => request(url, { method: "POST", body: JSON.stringify(body) }),
    patch: (url, body) => request(url, { method: "PATCH", body: JSON.stringify(body) }),
    delete: (url) => request(url, { method: "DELETE" }),
    postForm: (url, form) => request(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: form.toString(),
    }),
};
export { API_URL };
