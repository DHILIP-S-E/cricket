import { api } from "../api_base";
export const userApi = {
    register: (data) => api.post("/auth/register", data),
    login: (credentials) => {
        const form = new URLSearchParams();
        form.append("username", credentials.username);
        form.append("password", credentials.password);
        return api.postForm("/auth/login", form);
    },
    refresh: (refreshToken) => api.post("/auth/refresh", { refresh_token: refreshToken }),
    getMe: () => api.get("/users/me"),
    updateMe: (data) => api.patch("/users/me", data),
    listUsers: (page = 1, size = 20) => api.get(`/users/?page=${page}&size=${size}`),
};
