import { useQuery } from "@tanstack/react-query";
import { userApi } from "../index";
import type { User } from "../../../types/user/user_types";

export const USER_ME_KEY = ["user", "me"] as const;

export function useGetUser() {
  return useQuery<User, Error>({
    queryKey: USER_ME_KEY,
    queryFn: async () => {
      const res = await userApi.getMe();
      if (!res.data) throw new Error("No user data");
      return res.data;
    },
  });
}
