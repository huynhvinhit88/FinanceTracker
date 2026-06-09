import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { seedDefaultData } from '../lib/db';
import { processAutoRenewals } from '../lib/savingsService';

// Khởi tạo/đồng bộ danh mục mặc định + tái tục tự động sổ tiết kiệm tới hạn.
// Chạy SAU khi đã chắc chắn có phiên đăng nhập để tránh race gây nhân đôi danh mục.
const initUserData = async () => {
  try {
    await seedDefaultData();
  } catch (err) {
    console.error('Seeding default categories failed:', err);
  }
  try {
    // Tự quét và tái tục các sổ tiết kiệm bật auto_renew đã quá ngày đáo hạn.
    await processAutoRenewals();
  } catch (err) {
    console.error('Auto-renew savings failed:', err);
  }
};

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Get initial session
    const getInitialSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const currentUser = session?.user ?? null;
        setUser(currentUser);
        if (currentUser) {
          initUserData();
        }
      } catch (err) {
        console.error('Error getting initial Supabase session:', err);
      } finally {
        setLoading(false);
      }
    };

    getInitialSession();

    // 2. Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      setLoading(false);
      if (currentUser && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) {
        initUserData();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const value = {
    user,
    loading,
    signUp: async (email, password) => {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });
      return { data, error };
    },
    signIn: async (email, password) => {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      return { data, error };
    },
    signOut: async () => {
      const { error } = await supabase.auth.signOut();
      return { error };
    },
    updatePassword: async (currentPassword, newPassword) => {
      // Xác minh mật khẩu hiện tại bằng cách đăng nhập lại (Supabase không có API verify riêng)
      const email = user?.email;
      if (!email) {
        return { error: 'Không tìm thấy phiên đăng nhập. Vui lòng đăng nhập lại.' };
      }
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email,
        password: currentPassword,
      });
      if (verifyError) {
        return { error: 'Mật khẩu hiện tại không đúng.' };
      }
      // Cập nhật mật khẩu mới
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) {
        return { error: updateError.message };
      }
      return { error: null };
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
