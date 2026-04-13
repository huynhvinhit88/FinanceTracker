import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { ShieldCheck, LockOpen, AlertCircle, ArrowRight } from 'lucide-react';

const Login = () => {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { hasPin, setupPin, unlock } = useAuth();

  const handlePinSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      if (!hasPin) {
        if (pin.length < 4) {
          setError('PIN must be at least 4 digits');
          return;
        }
        if (pin !== confirmPin) {
          setError('PINs do not match');
          return;
        }
        await setupPin(pin);
        navigate('/');
      } else {
        const { error: unlockError } = await unlock(pin);
        if (unlockError) {
          setError(unlockError);
          setPin('');
        } else {
          navigate('/');
        }
      }
    } catch (err) {
      setError(err.message || 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="h-16 w-16 bg-blue-100 rounded-full flex items-center justify-center">
            {hasPin ? (
              <LockOpen className="h-8 w-8 text-blue-600" />
            ) : (
              <ShieldCheck className="h-8 w-8 text-blue-600" />
            )}
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          {hasPin ? 'Unlock App' : 'Set App PIN'}
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          {hasPin 
            ? 'Enter your PIN to access your financial data' 
            : 'Secure your offline data with a new PIN'}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <form className="space-y-6" onSubmit={handlePinSubmit}>
            <div>
              <label htmlFor="pin" className="block text-sm font-medium text-gray-700">
                {hasPin ? 'PIN Code' : 'New PIN'}
              </label>
              <div className="mt-1">
                <input
                  id="pin"
                  name="pin"
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-center tracking-widest text-lg"
                  placeholder="••••"
                  maxLength={6}
                />
              </div>
            </div>

            {!hasPin && (
              <div>
                <label htmlFor="confirmPin" className="block text-sm font-medium text-gray-700">
                  Confirm PIN
                </label>
                <div className="mt-1">
                  <input
                    id="confirmPin"
                    name="confirmPin"
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={confirmPin}
                    onChange={(e) => setConfirmPin(e.target.value)}
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-center tracking-widest text-lg"
                    placeholder="••••"
                    maxLength={6}
                  />
                </div>
              </div>
            )}

            {error && (
              <div className="rounded-md bg-red-50 p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <AlertCircle className="h-5 w-5 text-red-400" aria-hidden="true" />
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">{error}</h3>
                  </div>
                </div>
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {isLoading ? 'Processing...' : hasPin ? 'Unlock' : 'Save PIN'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
