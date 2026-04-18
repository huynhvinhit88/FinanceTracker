import React, { createContext, useContext, useEffect, useState } from 'react';
import { db } from '../lib/db';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null); // { id: 'local' } when unlocked
  const [loading, setLoading] = useState(true);
  const [hasPin, setHasPin] = useState(false);

  useEffect(() => {
    const checkPin = async () => {
      try {
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
  }, []);

  const value = {
    user,
    loading,
    hasPin,
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
    signOut: async () => {
      sessionStorage.removeItem('isUnlocked');
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
