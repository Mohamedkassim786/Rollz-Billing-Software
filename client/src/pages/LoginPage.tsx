import React, { useState } from "react";
import { AlertCircle, Eye, EyeOff } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { authApi } from "../api/auth.api";

export const LoginPage: React.FC = () => {
  const { isOwnerSetup, login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      if (!isOwnerSetup) {
        if (password.length < 6) {
          throw new Error("Password must be at least 6 characters");
        }
        const res = await authApi.setupOwner({ username, password, displayName: displayName || username });
        login(res.token, res.user, res.branch);
      } else {
        const res = await authApi.login({ username, password });
        login(res.token, res.user, res.branch);
      }
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || err.message || "Failed to authenticate";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#EAEFF5] flex items-center justify-center p-4 sm:p-6 font-sans selection:bg-blue-100 selection:text-blue-900">
      {/* Main Login Card */}
      <div className="w-full max-w-[880px] bg-white rounded-[32px] shadow-2xl border border-slate-200/80 flex flex-col md:flex-row overflow-hidden relative">
        {/* Left Side: Gourmet Roll Image with Organic Curve */}
        <div className="w-full md:w-[44%] relative bg-slate-950 min-h-[260px] md:min-h-[580px] overflow-hidden flex items-center justify-center">
          <img
            src="/login-roll.jpg"
            alt="ROLLZ Handcrafted Wrap"
            className="w-full h-full object-cover object-center absolute inset-0 select-none pointer-events-none"
          />

          {/* Organic Curved Wave Divider (Overlaps Left Side with Pure White) */}
          <svg
            className="absolute -right-[1px] top-0 bottom-0 h-full w-16 lg:w-20 text-white pointer-events-none hidden md:block z-10"
            viewBox="0 0 60 600"
            preserveAspectRatio="none"
          >
            <path
              d="M 60 0 C 22 140, 0 310, 26 600 L 60 600 Z"
              fill="#FFFFFF"
            />
          </svg>
        </div>

        {/* Right Side: Clean Login Form */}
        <div className="w-full md:w-[56%] bg-white px-8 py-8 sm:px-12 sm:py-10 flex flex-col justify-between relative z-20">
          <div className="space-y-6">
            {/* Logo */}
            <div className="flex justify-center pt-2">
              <img
                src="/rollz-logo.png"
                alt="ROLLZ Logo"
                className="h-20 sm:h-24 w-auto object-contain hover:scale-102 transition-transform"
              />
            </div>

            {/* Welcome Back Header */}
            <div className="text-center space-y-1">
              <h1 className="text-2xl sm:text-[26px] font-black text-[#172033] tracking-tight">
                Welcome Back
              </h1>
              <p className="text-xs sm:text-[13px] text-[#64748B]">
                {!isOwnerSetup
                  ? "First-Run Initial Owner Setup — Create Master Credentials"
                  : "Sign in to your ROLLZ Restaurant POS"}
              </p>
            </div>

            {/* Error Banner */}
            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 animate-fadeIn">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                <span>{error}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {!isOwnerSetup && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#1E293B] block">
                    Owner Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Enter owner name"
                    className="w-full px-4 py-2.5 bg-[#FFFFFF] border border-[#CBD5E1] rounded-xl text-xs text-[#172033] placeholder-slate-400 focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 transition-all"
                  />
                </div>
              )}

              {/* Username Field */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#1E293B] block">
                  Username
                </label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your username"
                  className="w-full px-4 py-2.5 bg-[#FFFFFF] border border-[#CBD5E1] rounded-xl text-xs text-[#172033] placeholder-slate-400 focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 transition-all"
                />
              </div>

              {/* Password Field */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#1E293B] block">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full px-4 py-2.5 pr-11 bg-[#FFFFFF] border border-[#CBD5E1] rounded-xl text-xs text-[#172033] placeholder-slate-400 focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                    title={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4 text-slate-500" />
                    ) : (
                      <Eye className="w-4 h-4 text-slate-500" />
                    )}
                  </button>
                </div>
              </div>

              {/* Remember me & Forgot Password */}
              <div className="flex items-center justify-between text-xs pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none text-[#334155] font-medium">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded text-[#2563EB] focus:ring-[#2563EB] border-slate-300 cursor-pointer"
                  />
                  <span>Remember me</span>
                </label>

                <button
                  type="button"
                  onClick={() => alert("Please contact restaurant owner/manager to reset your password.")}
                  className="text-[#2563EB] hover:text-[#1D4ED8] font-bold text-xs transition-colors cursor-pointer"
                >
                  Forgot password?
                </button>
              </div>

              {/* Login Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 bg-[#0066FF] hover:bg-[#0052CC] text-white font-bold text-xs sm:text-sm rounded-xl shadow-sm hover:shadow transition-all active:scale-[0.99] disabled:opacity-50 cursor-pointer"
                >
                  {isLoading
                    ? "Authenticating..."
                    : !isOwnerSetup
                    ? "Create Master Account & Start"
                    : "Login"}
                </button>
              </div>
            </form>
          </div>

          {/* Bottom Brand Motto */}
          <div className="pt-6 pb-2 text-center select-none">
            <div className="text-red-600 font-black italic tracking-wider text-xs">
              ROLLZ
            </div>
            <div
              className="text-sm font-bold italic tracking-tight text-[#172033] mt-0.5"
              style={{ fontFamily: "'Brush Script MT', 'Lucida Handwriting', Georgia, cursive, sans-serif" }}
            >
              Good Food, Good Mood!
            </div>
            {/* Red brush stroke swoosh */}
            <svg
              className="w-24 h-2 mx-auto text-red-600 mt-1"
              viewBox="0 0 100 8"
              fill="none"
            >
              <path
                d="M 2 5 C 25 9, 70 1, 98 4 C 65 2, 25 7, 2 5 Z"
                fill="#DC2626"
              />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
};
