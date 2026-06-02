import { type FormEvent, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useLogin } from "../../api/user/hooks/useLogin";
import { useCreateUser as useRegister } from "../../api/user/hooks/useCreateUser";
import { Loader2, Lock, Mail, Activity, Sparkles, Cpu, Sun, Moon } from "lucide-react";
import { TiltCard } from "../../components/ui";
import { useTheme, type Franchise } from "../../context/ThemeContext";

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

  const { franchise: currentTheme, setFranchise, colorMode, toggleColorMode } = useTheme();

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
    
    // Automatically set franchise theme based on email if matched
    const emailLower = email.toLowerCase();
    const matched = FRANCHISES.find(f => emailLower.startsWith(f.short.toLowerCase() + "@"));
    if (matched) {
      setFranchise(matched.short as Franchise);
    } else {
      setFranchise("IPL_GOLD");
    }

    if (mode === "login") {
      login({ username: email, password }, { onSuccess: () => navigate(from, { replace: true }) });
    } else {
      register({ email, password, full_name: fullName }, { onSuccess: () => navigate(from, { replace: true }) });
    }
  };

  const quickLogin = (franchise: typeof FRANCHISES[0]) => {
    setQuickLoading(franchise.short);
    setFranchise(franchise.short as Franchise); // Set active theme
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
      className="min-h-screen bg-surface flex items-center justify-center p-4 relative overflow-hidden transition-colors duration-300"
      style={{
        backgroundImage: colorMode === "dark" 
          ? "radial-gradient(circle at center, rgba(8, 10, 16, 0.9) 20%, #080a10 100%), url('/stadium_neon_bg.png')"
          : "radial-gradient(circle at center, rgba(244, 246, 250, 0.9) 20%, #f4f6fa 100%), url('/stadium_neon_bg.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {/* Dynamic Background Lights */}
      <div className="absolute top-1/4 left-1/4 w-[350px] h-[350px] bg-brand/5 rounded-full blur-[100px] pointer-events-none transition-all duration-300" />
      <div className="absolute bottom-1/4 right-1/4 w-[350px] h-[350px] bg-brand/5 rounded-full blur-[100px] pointer-events-none transition-all duration-300" />

      {/* Floating Day/Night switch on login page */}
      <div className="absolute top-4 right-4 z-20">
        <button
          onClick={toggleColorMode}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-card border border-surface-border text-text-secondary hover:text-text-primary hover:bg-surface-elevated transition-all text-xs font-semibold shadow-md"
        >
          {colorMode === "dark" ? (
            <>
              <Sun size={14} className="text-amber-500" />
              <span>Day Match</span>
            </>
          ) : (
            <>
              <Moon size={14} className="text-indigo-600" />
              <span>Night Match</span>
            </>
          )}
        </button>
      </div>

      <div className="w-full max-w-md z-10 flex flex-col space-y-6">
        
        {/* Header Logo Brand */}
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 rounded-xl bg-brand flex items-center justify-center mb-3 shadow-lg shadow-brand/20 animate-pulse-slow">
            <Activity size={22} className="text-white" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-text-primary">
            CRICKET IQ
          </h1>
          <p className="text-xs text-text-secondary mt-1 uppercase tracking-wider font-semibold">T20 Decision Intelligence Platform</p>
        </div>

        {/* Central interactive 3D TiltCard panel */}
        <TiltCard maxTilt={6} showShine={true} className="p-6 glass-card border-surface-border shadow-2xl relative overflow-hidden">
          
          {/* Quick Franchise Login Grid */}
          <div className="space-y-3">
            <p className="text-[10px] text-text-secondary uppercase tracking-wider font-bold flex items-center gap-1.5">
              <Sparkles size={11} className="text-brand animate-pulse" />
              <span>Select Your Franchise Theme</span>
            </p>

            <div className="grid grid-cols-5 gap-2">
              {FRANCHISES.map(f => (
                <button
                  key={f.short}
                  onClick={() => quickLogin(f)}
                  disabled={!!quickLoading}
                  title={f.name}
                  className="relative flex flex-col items-center justify-center py-2.5 px-1 rounded-xl border border-surface-border bg-surface-elevated transition-all duration-200 hover:-translate-y-0.5 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed group overflow-hidden"
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
                  setFranchise("IPL_GOLD");
                  login(
                    { username: "admin@cricket-iq.com", password: "Admin@1234" },
                    {
                      onSuccess: () => navigate(from, { replace: true }),
                      onError: () => setQuickLoading(null),
                    }
                  );
                }}
                disabled={!!quickLoading}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-surface-border hover:border-brand/50 hover:bg-brand-muted/20 text-xs text-text-secondary hover:text-brand font-semibold transition-all duration-150 disabled:opacity-50"
              >
                {quickLoading === "ADMIN" && <Loader2 size={12} className="animate-spin text-brand" />}
                <Cpu size={12} className="text-text-tertiary" />
                <span>Sign in as Platform Admin</span>
              </button>
            </div>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px bg-surface-border" />
            <span className="text-[9px] text-text-secondary uppercase tracking-wider font-bold">or authenticate manually</span>
            <div className="flex-1 h-px bg-surface-border" />
          </div>

          {/* Switcher & Form container */}
          <div className="space-y-4">
            <div className="flex bg-surface p-1 rounded-lg border border-surface-border">
              {(["login", "register"] as const).map(m => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded transition-colors ${
                    mode === m
                      ? "bg-surface-elevated text-brand border border-brand/20 shadow-md shadow-black/10"
                      : "text-text-secondary hover:text-text-primary"
                  }`}
                >
                  {m === "login" ? "Sign In" : "Register"}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              {mode === "register" && (
                <div>
                  <label className="block text-[10px] text-text-secondary uppercase tracking-wider font-semibold mb-1">Full Name</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    placeholder="Your Full Name"
                    required
                    className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2 text-xs text-text-primary placeholder-text-tertiary focus:outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/30 transition-all"
                  />
                </div>
              )}

              <div>
                <label className="block text-[10px] text-text-secondary uppercase tracking-wider font-semibold mb-1">Email</label>
                <div className="relative">
                  <Mail size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="analyst@franchise.com"
                    required
                    className="w-full bg-surface border border-surface-border rounded-lg pl-8 pr-3 py-2 text-xs text-text-primary placeholder-text-tertiary focus:outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/30 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] text-text-secondary uppercase tracking-wider font-semibold mb-1">Password</label>
                <div className="relative">
                  <Lock size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                    className="w-full bg-surface border border-surface-border rounded-lg pl-8 pr-3 py-2 text-xs text-text-primary placeholder-text-tertiary focus:outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/30 transition-all"
                  />
                </div>
              </div>

              {error && (
                <div className="px-3 py-2 rounded-lg bg-red-950/10 border border-red-900/30">
                  <p className="text-[11px] text-red-500 font-semibold">{error.message}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={isPending}
                className="w-full bg-brand text-white font-bold text-xs py-2.5 rounded-lg shadow-lg shadow-brand/10 hover:bg-brand-hover hover:shadow-brand/20 transition-all flex items-center justify-center gap-2"
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
        <div className="bg-surface-card border border-surface-border rounded-xl px-4 py-3 text-center">
          <p className="text-[9px] text-text-secondary mb-1.5 font-bold uppercase tracking-wider">Quick login credentials</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            {FRANCHISES.slice(0, 4).map(f => (
              <p key={f.short} className="text-[10px] font-mono text-text-secondary">
                <span className="font-bold" style={{ color: f.color }}>{f.short}</span>
                {` : ${f.short}@1234`}
              </p>
            ))}
            <p className="text-[10px] font-mono text-text-secondary col-span-2 mt-1 pt-1 border-t border-surface-border">
              <span className="text-brand font-bold">ADMIN</span>{" : Admin@1234"}
            </p>
          </div>
        </div>

        <p className="text-center text-[10px] text-text-secondary">
          1,241 IPL matches · 295K ball records · 964 players
        </p>
      </div>
    </div>
  );
}
