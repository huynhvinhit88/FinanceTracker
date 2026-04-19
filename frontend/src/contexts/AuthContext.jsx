import React, { createContext, useContext, useEffect, useState } from 'react';
import { db } from '../lib/db';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null); // { id: 'local' } when unlocked
  const [googleUser, setGoogleUser] = useState(() => {
    const saved = localStorage.getItem('googleUser');
    return saved ? JSON.parse(saved) : null;
  });
  const [loading, setLoading] = useState(true);
  const [hasPin, setHasPin] = useState(false);

  useEffect(() => {
    const checkPin = async () => {
      try {
        // If no Google identity on a new device, we stay locked (user is null)
        if (!googleUser) {
          setLoading(false);
          return;
        }

        const pinRecord = await db.settings.get('appLockPin');
        const pinExists = !!(pinRecord && pinRecord.value);
        setHasPin(pinExists);

        // Check if user has unlocked in this browser session
        const isUnlocked = sessionStorage.getItem('isUnlocked') === 'true';

        if (!pinExists || isUnlocked) {
          setUser({ id: 'local' });
        }
      } catch (err) {
        console.error("Failed to check PIN in DB", err);
      } finally {
        setLoading(false);
      }
    };
    checkPin();
  }, [googleUser]);

  const value = {
    user,
    googleUser,
    loading,
    hasPin,
    confirmGoogleUser: (userData) => {
      localStorage.setItem('googleUser', JSON.stringify(userData));
      setGoogleUser(userData);
    },
    unlock: async (enteredPin) => {
      const pinRecord = await db.settings.get('appLockPin');
      if (pinRecord && pinRecord.value === enteredPin) {
        sessionStorage.setItem('isUnlocked', 'true');
        setUser({ id: 'local' });
        return { error: null };
      }
      return { error: 'Incorrect PIN' };
    },
    setupPin: async (newPin) => {
      await db.settings.put({ key: 'appLockPin', value: newPin });
      sessionStorage.setItem('isUnlocked', 'true');
      setHasPin(true);
      setUser({ id: 'local' });
    },
    updatePin: async (oldPin, newPin) => {
      const pinRecord = await db.settings.get('appLockPin');
      if (pinRecord && pinRecord.value === oldPin) {
        await db.settings.put({ key: 'appLockPin', value: newPin });
        return { error: null };
      }
      return { error: 'Mã PIN hiện tại không chính xác' };
    },
    lock: () => {
      sessionStorage.removeItem('isUnlocked');
      setUser(null);
    },
    signOut: async () => {
      sessionStorage.removeItem('isUnlocked');
      localStorage.removeItem('googleUser');
      setGoogleUser(null);
      setUser(null);
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
