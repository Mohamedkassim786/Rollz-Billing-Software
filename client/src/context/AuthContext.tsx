import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { User, Branch, authApi } from "../api/auth.api";

interface AuthContextType {
  user: User | null;
  branch: Branch | null;
  token: string | null;
  isLoading: boolean;
  isOwnerSetup: boolean;
  login: (token: string, user: User, branch: Branch) => void;
  logout: () => void;
  refreshAuthStatus: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [branch, setBranch] = useState<Branch | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem("rollz_auth_token"));
  const [isLoading, setIsLoading] = useState(true);
  const [isOwnerSetup, setIsOwnerSetup] = useState(true);

  const refreshAuthStatus = useCallback(async () => {
    try {
      const status = await authApi.getStatus();
      setIsOwnerSetup(status.isOwnerSetup);

      const savedToken = localStorage.getItem("rollz_auth_token");
      if (savedToken) {
        setToken(savedToken);
        const me = await authApi.getMe();
        setUser(me.user);
        setBranch(me.branch);
      } else {
        setUser(null);
        setBranch(null);
      }
    } catch {
      localStorage.removeItem("rollz_auth_token");
      setToken(null);
      setUser(null);
      setBranch(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshAuthStatus();
  }, [refreshAuthStatus]);

  const login = (newToken: string, newUser: User, newBranch: Branch) => {
    localStorage.setItem("rollz_auth_token", newToken);
    setToken(newToken);
    setUser(newUser);
    setBranch(newBranch);
    setIsOwnerSetup(true);
  };

  const logout = () => {
    localStorage.removeItem("rollz_auth_token");
    setToken(null);
    setUser(null);
    setBranch(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        branch,
        token,
        isLoading,
        isOwnerSetup,
        login,
        logout,
        refreshAuthStatus,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
