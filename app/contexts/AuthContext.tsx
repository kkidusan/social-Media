"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { db } from "../firebase";
import { doc, getDoc } from "firebase/firestore";

interface UserType {
  email: string;
  role: string;
  userId: string;
  customUserId: string;
  firstName?: string;
  lastName?: string;
}

interface AuthContextType {
  user: UserType | null;
  loading: boolean;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  logout: async () => {},
  checkAuth: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserType | null>(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/verify', {
        credentials: 'include',
        headers: {
          'Cache-Control': 'no-cache',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        const { email, userId } = data;

        // Fetch additional user data from Firestore
        const userDocRef = doc(db, "useraccount", userId);
        const userDocSnap = await getDoc(userDocRef);

        let customUserId = "";
        let role = "user";
        let firstName = "";
        let lastName = "";

        if (userDocSnap.exists()) {
          const firestoreData = userDocSnap.data();
          customUserId = firestoreData.customUserId || "";
          role = firestoreData.role || "user";
          firstName = firestoreData.firstName || "";
          lastName = firestoreData.lastName || "";
        } else {
          console.warn("No Firestore document found for user:", userId);
        }

        const updatedUser = {
          email,
          userId,
          customUserId,
          role,
          firstName,
          lastName,
        };

        setUser(prevUser => {
          if (JSON.stringify(prevUser) !== JSON.stringify(updatedUser)) {
            return updatedUser;
          }
          return prevUser;
        });
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error("Auth check failed:", error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
      });
      setUser(null);
      await checkAuth();
    } catch (error) {
      console.error("Logout failed:", error);
      throw error;
    }
  };

  useEffect(() => {
    checkAuth();

    const handleFocus = () => checkAuth();
    window.addEventListener('focus', handleFocus);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkAuth();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const interval = setInterval(checkAuth, 30 * 1000);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(interval);
    };
  }, [checkAuth]);

  return (
    <AuthContext.Provider value={{ user, loading, logout, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);