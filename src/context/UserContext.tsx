import { createContext, useContext, useState, ReactNode } from "react";

interface User { email: string; username: string; }
interface UserContextType {
  user: User | null;
  setUser: (u: User | null) => void;
}

const UserContext = createContext<UserContextType>({ user: null, setUser: () => {} });

export const UserProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUserState] = useState<User | null>(() => {
    try {
      const s = localStorage.getItem("user");
      if (!s) return null;
      const p = JSON.parse(s);
      return { email: p.email || "", username: p.name || p.username || "" };
    } catch { return null; }
  });

  const setUser = (u: User | null) => {
    setUserState(u);
    if (u) {
      localStorage.setItem("user", JSON.stringify({ email: u.email, name: u.username }));
      // Keep chrome.storage in sync so background.js can read user_email for feedback API
      chrome.storage?.local?.set({ user_email: u.email, user_name: u.username });
    } else {
      localStorage.removeItem("user");
      chrome.storage?.local?.remove(["user_email", "user_name"]);
    }
  };

  return (
    <UserContext.Provider value={{ user, setUser }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => useContext(UserContext);
