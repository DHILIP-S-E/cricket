import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useLogin } from "../../api/user/hooks/useLogin";
import { useCreateUser as useRegister } from "../../api/user/hooks/useCreateUser";
import { Loader2, Lock, Mail, BarChart2 } from "lucide-react";
// ─── Franchise quick-login config ────────────────────────────────────────────
const FRANCHISES = [
    { short: "CSK", name: "Chennai Super Kings", color: "#FFCC00", bg: "#1a1500", text: "#FFCC00" },
    { short: "MI", name: "Mumbai Indians", color: "#004BA0", bg: "#00091a", text: "#5b9bd5" },
    { short: "RCB", name: "Royal Challengers", color: "#D1001C", bg: "#1a0004", text: "#ff6b7a" },
    { short: "KKR", name: "Kolkata Knight Riders", color: "#3B1F8C", bg: "#0d0516", text: "#9b7fd4" },
    { short: "DC", name: "Delhi Capitals", color: "#0066B2", bg: "#00091a", text: "#5aaee8" },
    { short: "RR", name: "Rajasthan Royals", color: "#FF69B4", bg: "#1a0010", text: "#ff9ece" },
    { short: "SRH", name: "Sunrisers Hyderabad", color: "#F7A721", bg: "#1a0e00", text: "#f7a721" },
    { short: "PBKS", name: "Punjab Kings", color: "#D71920", bg: "#1a0003", text: "#ff7070" },
    { short: "GT", name: "Gujarat Titans", color: "#1C3D6E", bg: "#040d18", text: "#6ca0dc" },
    { short: "LSG", name: "Lucknow Super Giants", color: "#6CBDE7", bg: "#03111a", text: "#6CBDE7" },
];
export function LoginView() {
    const navigate = useNavigate();
    const location = useLocation();
    const from = location.state?.from?.pathname ?? "/";
    const { mutate: login, isPending: loginPending, error: loginError } = useLogin();
    const { mutate: register, isPending: regPending, error: regError } = useRegister();
    const [mode, setMode] = useState("login");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [fullName, setFullName] = useState("");
    const [quickLoading, setQuickLoading] = useState(null);
    const isPending = loginPending || regPending;
    const error = loginError || regError;
    const handleSubmit = (e) => {
        e.preventDefault();
        if (mode === "login") {
            login({ username: email, password }, { onSuccess: () => navigate(from, { replace: true }) });
        }
        else {
            register({ email, password, full_name: fullName }, { onSuccess: () => navigate(from, { replace: true }) });
        }
    };
    const quickLogin = (franchise) => {
        setQuickLoading(franchise.short);
        login({ username: `${franchise.short.toLowerCase()}@cricket-iq.com`, password: `${franchise.short}@1234` }, {
            onSuccess: () => navigate(from, { replace: true }),
            onError: () => setQuickLoading(null),
        });
    };
    return (_jsx("div", { className: "min-h-screen bg-[#0f1117] flex items-center justify-center p-4", children: _jsxs("div", { className: "w-full max-w-md", children: [_jsxs("div", { className: "flex flex-col items-center mb-6", children: [_jsx("div", { className: "w-12 h-12 rounded-xl bg-[#238636] flex items-center justify-center mb-3 shadow-lg shadow-green-900/30", children: _jsx(BarChart2, { size: 22, className: "text-white" }) }), _jsx("h1", { className: "text-xl font-bold text-gray-100", children: "Cricket IQ" }), _jsx("p", { className: "text-xs text-gray-500 mt-1", children: "Decision Intelligence Platform" })] }), _jsxs("div", { className: "bg-[#161b22] border border-[#30363d] rounded-2xl p-5 mb-3 shadow-xl", children: [_jsxs("p", { className: "text-[10px] text-gray-500 uppercase tracking-wider font-medium mb-3 flex items-center gap-1.5", children: [_jsx("span", { className: "w-1.5 h-1.5 rounded-full bg-[#22c55e] inline-block" }), "Quick Login \u2014 Select Your Franchise"] }), _jsx("div", { className: "grid grid-cols-5 gap-2", children: FRANCHISES.map(f => (_jsx("button", { onClick: () => quickLogin(f), disabled: !!quickLoading, title: f.name, className: "relative flex flex-col items-center justify-center py-2.5 px-1 rounded-xl border transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed", style: {
                                    background: f.bg,
                                    borderColor: quickLoading === f.short ? f.color : "#30363d",
                                    boxShadow: quickLoading === f.short ? `0 0 12px ${f.color}40` : "none",
                                }, children: quickLoading === f.short ? (_jsx(Loader2, { size: 16, className: "animate-spin", style: { color: f.color } })) : (_jsx(_Fragment, { children: _jsx("span", { className: "text-sm font-black leading-none", style: { color: f.color }, children: f.short }) })) }, f.short))) }), _jsx("div", { className: "mt-3 pt-3 border-t border-[#30363d]", children: _jsxs("button", { onClick: () => {
                                    setQuickLoading("ADMIN");
                                    login({ username: "admin@cricket-iq.com", password: "Admin@1234" }, {
                                        onSuccess: () => navigate(from, { replace: true }),
                                        onError: () => setQuickLoading(null),
                                    });
                                }, disabled: !!quickLoading, className: "w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-[#30363d] text-xs text-gray-400 hover:border-[#238636] hover:text-[#22c55e] transition-all duration-150 disabled:opacity-50", children: [quickLoading === "ADMIN"
                                        ? _jsx(Loader2, { size: 12, className: "animate-spin" })
                                        : null, "Platform Admin"] }) })] }), _jsxs("div", { className: "flex items-center gap-3 mb-3", children: [_jsx("div", { className: "flex-1 h-px bg-[#30363d]" }), _jsx("span", { className: "text-[10px] text-gray-600 uppercase tracking-wider", children: "or sign in manually" }), _jsx("div", { className: "flex-1 h-px bg-[#30363d]" })] }), _jsxs("div", { className: "bg-[#161b22] border border-[#30363d] rounded-2xl shadow-xl overflow-hidden", children: [_jsx("div", { className: "flex border-b border-[#30363d]", children: ["login", "register"].map(m => (_jsx("button", { onClick: () => setMode(m), className: `flex-1 py-2.5 text-xs font-medium transition-colors ${mode === m
                                    ? "bg-[#1c2128] text-gray-100 border-b-2 border-[#238636]"
                                    : "text-gray-500 hover:text-gray-300 hover:bg-[#1c2128]"}`, children: m === "login" ? "Sign In" : "Create Account" }, m))) }), _jsxs("form", { onSubmit: handleSubmit, className: "p-5 space-y-3", children: [mode === "register" && (_jsxs("div", { children: [_jsx("label", { className: "block text-xs text-gray-400 mb-1.5 font-medium", children: "Full Name" }), _jsx("input", { type: "text", value: fullName, onChange: e => setFullName(e.target.value), placeholder: "Your name", required: true, className: "w-full bg-[#1c2128] border border-[#30363d] rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-[#238636] transition-colors" })] })), _jsxs("div", { children: [_jsx("label", { className: "block text-xs text-gray-400 mb-1.5 font-medium", children: "Email" }), _jsxs("div", { className: "relative", children: [_jsx(Mail, { size: 13, className: "absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" }), _jsx("input", { type: "email", value: email, onChange: e => setEmail(e.target.value), placeholder: "analyst@franchise.com", required: true, className: "w-full bg-[#1c2128] border border-[#30363d] rounded-lg pl-9 pr-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-[#238636] transition-colors" })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs text-gray-400 mb-1.5 font-medium", children: "Password" }), _jsxs("div", { className: "relative", children: [_jsx(Lock, { size: 13, className: "absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" }), _jsx("input", { type: "password", value: password, onChange: e => setPassword(e.target.value), placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022", required: true, minLength: 6, className: "w-full bg-[#1c2128] border border-[#30363d] rounded-lg pl-9 pr-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-[#238636] transition-colors" })] })] }), error && (_jsx("div", { className: "px-3 py-2 rounded-lg bg-red-900/20 border border-red-900/40", children: _jsx("p", { className: "text-xs text-red-400", children: error.message }) })), _jsxs("button", { type: "submit", disabled: isPending, className: "w-full bg-[#238636] hover:bg-[#2ea043] disabled:opacity-50 text-white font-medium text-sm py-2 rounded-lg transition-colors flex items-center justify-center gap-2", children: [isPending && _jsx(Loader2, { size: 13, className: "animate-spin" }), isPending
                                            ? mode === "login" ? "Signing in…" : "Creating…"
                                            : mode === "login" ? "Sign In" : "Create Account"] })] })] }), _jsxs("div", { className: "mt-4 bg-[#161b22] border border-[#30363d] rounded-xl px-4 py-3", children: [_jsx("p", { className: "text-[10px] text-gray-500 mb-1.5 font-medium uppercase tracking-wider", children: "Quick login credentials" }), _jsxs("div", { className: "grid grid-cols-2 gap-x-4 gap-y-1", children: [FRANCHISES.slice(0, 4).map(f => (_jsxs("p", { className: "text-[10px] font-mono text-gray-600", children: [_jsx("span", { style: { color: f.color }, children: f.short }), ` — ${f.short}@1234`] }, f.short))), _jsxs("p", { className: "text-[10px] font-mono text-gray-600", children: [_jsx("span", { className: "text-[#22c55e]", children: "ADMIN" }), " — Admin@1234"] })] })] }), _jsx("p", { className: "text-center text-[10px] text-gray-700 mt-4", children: "1,241 IPL matches \u00B7 295K ball records \u00B7 964 players" })] }) }));
}
