import { useQuery } from "@tanstack/react-query";
import { userApi } from "../index";
export const USER_ME_KEY = ["user", "me"];
export function useGetUser() {
    return useQuery({
        queryKey: USER_ME_KEY,
        queryFn: async () => {
            const res = await userApi.getMe();
            if (!res.data)
                throw new Error("No user data");
            return res.data;
        },
    });
}
