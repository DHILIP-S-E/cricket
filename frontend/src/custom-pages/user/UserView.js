import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useGetUser } from "../../api/user/hooks/useGetUser";
import { useLogin } from "../../api/user/hooks/useLogin";
export function UserView() {
    const { data: user, isLoading, error } = useGetUser();
    const { logout } = useLogin();
    if (isLoading)
        return _jsx("div", { children: "Loading\u2026" });
    if (error)
        return _jsxs("div", { children: ["Error: ", error.message] });
    if (!user)
        return null;
    return (_jsxs("div", { style: { padding: 24 }, children: [_jsx("h1", { children: "Profile" }), _jsxs("p", { children: ["Email: ", user.email] }), _jsxs("p", { children: ["Name: ", user.full_name ?? "—"] }), _jsxs("p", { children: ["Active: ", user.is_active ? "Yes" : "No"] }), _jsx("button", { onClick: logout, style: { marginTop: 16 }, children: "Sign Out" })] }));
}
