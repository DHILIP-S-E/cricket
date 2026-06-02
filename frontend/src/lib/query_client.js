import { QueryClient } from "@tanstack/react-query";
export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 60000,
            retry: (failureCount, error) => {
                // Don't retry on 401/403/404
                if (error instanceof Error && /401|403|404/.test(error.message))
                    return false;
                return failureCount < 2;
            },
        },
        mutations: {
            retry: false,
        },
    },
});
