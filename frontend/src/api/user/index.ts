import { api } from "../api_base";
import type { APIResponse, PaginatedResponse } from "../../types/common/api_types";
import type { LoginCredentials, TokenResponse, User, UserCreate, UserUpdate } from "../../types/user/user_types";

export const userApi = {
  register: (data: UserCreate) =>
    api.post<APIResponse<TokenResponse>>("/auth/register", data),

  login: (credentials: LoginCredentials) => {
    const form = new URLSearchParams();
    form.append("username", credentials.username);
    form.append("password", credentials.password);
    return api.postForm<APIResponse<TokenResponse>>("/auth/login", form);
  },

  refresh: (refreshToken: string) =>
    api.post<APIResponse<TokenResponse>>("/auth/refresh", { refresh_token: refreshToken }),

  getMe: () => api.get<APIResponse<User>>("/users/me"),

  updateMe: (data: UserUpdate) => api.patch<APIResponse<User>>("/users/me", data),

  listUsers: (page = 1, size = 20) =>
    api.get<PaginatedResponse<User>>(`/users/?page=${page}&size=${size}`),
};
