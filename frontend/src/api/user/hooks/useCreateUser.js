import { useMutation } from "@tanstack/react-query";
import { useAuth } from "../../../context/AuthContext";
import { userApi } from "../index";
export function useCreateUser() {
    const { setTokens } = useAuth();
    return useMutation({
        mutationFn: (data) => userApi.register(data),
        onSuccess: (res) => {
            if (res.data) {
                setTokens(res.data.access_token, res.data.refresh_token);
            }
        },
    });
}
