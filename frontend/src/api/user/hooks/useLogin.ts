import { useMutation } from "../../../lib/query";
import { useAuth } from "../../../context/AuthContext";
import type { LoginCredentials } from "../../../types/user/user_types";
import { userApi } from "../index";

export function useLogin() {
  const { setTokens, logout } = useAuth();

  const loginMutation = useMutation({
    mutationFn: (credentials: LoginCredentials) => userApi.login(credentials),
    onSuccess: (res) => {
      if (res.data) {
        setTokens(res.data.access_token, res.data.refresh_token);
      }
    },
  });

  return { ...loginMutation, logout };
}
