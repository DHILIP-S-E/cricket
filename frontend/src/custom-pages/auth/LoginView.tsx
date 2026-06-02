import { type FormEvent, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useLogin } from "../../api/user/hooks/useLogin";
import { useCreateUser as useRegister } from "../../api/user/hooks/useCreateUser";
import { Loader2, Lock, Mail, Activity, Sparkles, Cpu } from "lucide-react";
import { TiltCard } from "../../components/ui";

const FRANCHISES = [
  { short: "CSK", name: "Chennai Super Kings",      color: "#FFCC00", bg: "#1a1500", text: "#FFCC00" },
  { short: "MI",  name: "Mumbai Indians",            color: "#004BA0", bg: "#00091a", text: "#5b9bd5" },
  { short: "RCB", name: "Royal Challengers",         color: "#D1001C", bg: "#1a0004", text: "#ff6b7a" },
  { short: "KKR", name: "Kolkata Knight Riders",     color: "#3B1F8C", bg: "#0d0516", text: "#9b7fd4" },
  { short: "DC",  name: "Delhi Capitals",            color: "#0066B2", bg: "#00091a", text: "#5aaee8" },
  { short: "RR",  name: "Rajasthan Royals",          color: "#FF69B4", bg: "#1a0010", text: "#ff9ece" },
  { short: "SRH", name: "Sunrisers Hyderabad",       color: "#F7A721", bg: "#1a0e00", text: "#f7a721" },
  { short: "PBKS", name: "Punjab Kings",             color: "#D71920", bg: "#1a0003", text: "#ff7070" },
  { short: "GT",  name: "Gujarat Titans",            color: "#1C3D6E", bg: "#040d18", text: "#6ca0dc" },
  { short: "LSG", name: "Lucknow Super Giants",      color: "#6CBDE7", bg: "#03111a", text: "#6CBDE7" },
];

export function LoginView() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? "/";

  const { mutate: login, isPending: loginPending, error: loginError } = useLogin();
  const { mutate: register, isPending: regPending, error: regError } = useRegister();

  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [quickLoading, setQuickLoading] = useState<string | null>(null);

  const isPending = loginPending || regPending;
  const error = loginError || regError;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (mode === "login") {
      login({ username: email, password }, { onSuccess: () => navigate(from, { replace: true }) });
    } else {
      register({ email, password, full_name: fullName }, { onSuccess: () => navigate(from, { replace: true }) });
    }
  };

  const quickLogin = (franchise: typeof FRANCHISES[0]) => {
    setQuickLoading(franchise.short);
    login(
      { username: `${franchise.short.toLowerCase()}@cricket-iq.com`, password: `${franchise.short}@1234` },
      {
        onSuccess: () => navigate(from, { replace: true }),
        onError: () => setQuickLoading(null),
      }
    );
  };

  return (
    <div
      className="min-h-screen bg-[#080a10] bg-cover bg-center flex items-center justify-center p-4 relative overflow-hidden"
      style={{
        backgroundImage: "radial-gradient(circle at center, rgba(8, 10, 16, 0.88) 20%, #080a10 100%), url('/stadium_neon_bg.png')",
      }}
    >
      {/* Visual neon backdrops */}
      <div className="absolute top-1/4 left-1/4 w-[350px] h-[350px] bg-emerald-500/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[350px] h-[350px] bg-blue-500/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-md z-10 flex flex-col space-y-6">
        
        {/* Header Logo Brand */}
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center mb-3 shadow-lg shadow-emerald-500/20">
            <Activity size={22} className="text-white" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight bg-gradient-to-r from-emerald-400 via-teal-300 to-blue-400 bg-clip-text text-transparent text-glow-green">
            CRICKET IQ
          </h1>
          <p className="text-xs text-gray-500 mt-1 uppercase tracking-wider font-semibold">T20 Decision Intelligence Platform</p>
        </div>

        {/* Central interactive 3D TiltCard panel */}
        <TiltCard maxTilt={8} showShine={true} className="p-6 glass-card border-[#22c55e]/20 shadow-2xl relative overflow-hidden">
          
          {/* Quick Franchise Login Grid */}
          <div className="space-y-3">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-bold flex items-center gap-1.5">
              <Sparkles size={11} className="text-emerald-400 animate-pulse" />
              <span>Select Your Franchise</span>
            </p>

            <div className="grid grid-cols-5 gap-2">
              {FRANCHISES.map(f => (
                <button
                  key={f.short}
                  onClick={() => quickLogin(f)}
                  disabled={!!quickLoading}
                  title={f.name}
                  className="relative flex flex-col items-center justify-center py-2.5 px-1 rounded-xl border border-gray-800 transition-all duration-200 hover:-translate-y-1 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed group"
                  style={{
                    background: f.bg,
                  }}
                >
                  {/* Subtle color highlight hover border */}
                  <div
                    className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 border pointer-events-none"
                    style={{ borderColor: f.color, boxShadow: `0 0 10px ${f.color}40` }}
                  />
                  {quickLoading === f.short ? (
                    <Loader2 size={16} className="animate-spin" style={{ color: f.color }} />
                  ) : (
                    <span
                      className="text-xs font-black transition-colors duration-200"
                      style={{ color: f.color }}
                    >
                      {f.short}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Admin quick login button */}
            <div className="pt-2">
              <button
                onClick={() => {
                  setQuickLoading("ADMIN");
                  login(
                    { username: "admin@cricket-iq.com", password: "Admin@1234" },
                    {
                      onSuccess: () => navigate(from, { replace: true }),
                      onError: () => setQuickLoading(null),
                    }
                  );
                }}
                disabled={!!quickLoading}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-[#30363d] hover:border-emerald-500/50 hover:bg-emerald-950/20 text-xs text-gray-400 hover:text-emerald-400 font-semibold transition-all duration-150 disabled:opacity-50"
              >
                {quickLoading === "ADMIN" && <Loader2 size={12} className="animate-spin text-emerald-400" />}
                <Cpu size={12} className="text-gray-500" />
                <span>Sign in as Platform Admin</span>
              </button>
            </div>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px bg-gray-800" />
            <span className="text-[9px] text-gray-600 uppercase tracking-wider font-bold">or authenticate manually</span>
            <div className="flex-1 h-px bg-gray-800" />
          </div>

          {/* Switcher & Form container */}
          <div className="space-y-4">
            <div className="flex bg-[#121620]/60 p-1 rounded-lg border border-gray-800/80">
              {(["login", "register"] as const).map(m => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded transition-colors ${
                    mode === m
                      ? "bg-[#1c2128] text-emerald-400 border border-emerald-500/20 shadow-md shadow-black/30"
                      : "text-gray-500 hover:text-gray-300"
                  }`}
                >
                  {m === "login" ? "Sign In" : "Register"}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              {mode === "register" && (
                <div>
                  <label className="block text-[10px] text-gray-500 uppercase tracking-wider font-semibold mb-1">Full Name</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    placeholder="Your Full Name"
                    required
                    className="w-full bg-[#121620] border border-gray-800/80 rounded-lg px-3 py-2 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition-all"
                  />
                </div>
              )}

              <div>
                <label className="block text-[10px] text-gray-500 uppercase tracking-wider font-semibold mb-1">Email</label>
                <div className="relative">
                  <Mail size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="analyst@franchise.com"
                    required
                    className="w-full bg-[#121620] border border-gray-800/80 rounded-lg pl-8 pr-3 py-2 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] text-gray-500 uppercase tracking-wider font-semibold mb-1">Password</label>
                <div className="relative">
                  <Lock size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                    className="w-full bg-[#121620] border border-gray-800/80 rounded-lg pl-8 pr-3 py-2 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition-all"
                  />
                </div>
              </div>

              {error && (
                <div className="px-3 py-2 rounded-lg bg-red-950/20 border border-red-900/30">
                  <p className="text-[11px] text-red-400">{error.message}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={isPending}
                className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:brightness-110 disabled:opacity-50 text-white font-bold text-xs py-2 rounded-lg shadow-lg shadow-emerald-500/10 transition-all flex items-center justify-center gap-2"
              >
                {isPending && <Loader2 size={13} className="animate-spin" />}
                {isPending
                  ? mode === "login" ? "Authenticating…" : "Creating Account…"
                  : mode === "login" ? "Sign In" : "Create Account"
                }
              </button>
            </form>
          </div>
        </TiltCard>

        {/* Credentials guide panel */}
        <div className="bg-[#121620]/60 border border-gray-900 rounded-xl px-4 py-3 text-center">
          <p className="text-[9px] text-gray-500 mb-1.5 font-bold uppercase tracking-wider">Quick login credentials</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            {FRANCHISES.slice(0, 4).map(f => (
              <p key={f.short} className="text-[10px] font-mono text-gray-600">
                <span style={{ color: f.color }}>{f.short}</span>
                {` : ${f.short}@1234`}
              </p>
            ))}
            <p className="text-[10px] font-mono text-gray-600 col-span-2 mt-1 pt-1 border-t border-gray-800/40">
              <span className="text-emerald-400">ADMIN</span>{" : Admin@1234"}
            </p>
          </div>
        </div>

        <p className="text-center text-[10px] text-gray-700">
          1,241 IPL matches · 295K ball records · 964 players
        </p>
      </div>
    </div>
  );
}
