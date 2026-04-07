import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Lấy thông tin user hiện tại nếu đã đăng nhập từ trước
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user || null);
      setLoading(false);
    };

    getSession();

    // Lắng nghe các thay đổi về trạng thái auth (Login/Logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user || null);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const value = {
    user,
    loading,
    signInWithGoogle: async () => {
      return await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          // You may want to define a specific redirect depending on environment
          // redirectTo: window.location.origin
        }
      });
    },
    signInWithEmail: async (email, password) => {
      return await supabase.auth.signInWithPassword({ email, password });
    },
    signUp: async (email, password, displayName) => {
      const { data, error } = await supabase.auth.signUp({ 
        email, 
        password,
        options: {
          data: {
            display_name: displayName,
          }
        }
      });
      return { data, error };
    },
    signOut: async () => {
      return await supabase.auth.signOut();
    }
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
};
