import { useMutation } from "../../../lib/query";
import { useAuth } from "../../../context/AuthContext";
import type { UserCreate } from "../../../types/user/user_types";
import { userApi } from "../index";

export function useCreateUser() {
  const { setTokens } = useAuth();

  return useMutation({
    mutationFn: (data: UserCreate) => userApi.register(data),
    onSuccess: (res) => {
      if (res.data) {
        setTokens(res.data.access_token, res.data.refresh_token);
      }
    },
  });
}
