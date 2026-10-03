import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState
} from 'react';

import {
  api,
  json
} from './api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined);

  useEffect(() => {
    api('/auth/me')
      .then(result => setUser(result.user))
      .catch(() => setUser(null));
  }, []);

  const value = useMemo(
    () => ({
      user,

      loading: user === undefined,

      async login(loginKey) {
        const result = await api(
          '/auth/login',
          json('POST', { loginKey })
        );

        setUser(result.user);
        return result.user;
      },

      async requestRegistration(payload) {
        return api(
          '/auth/register/request',
          json('POST', payload)
        );
      },

      async verifyRegistration(payload) {
        const result = await api(
          '/auth/register/verify',
          json('POST', payload)
        );

        setUser(result.user);
        return result;
      },

      async logout() {
        await api('/auth/logout', {
          method: 'POST'
        }).catch(() => {});

        setUser(null);
      },

      refresh() {
        return api('/auth/me').then(result => {
          setUser(result.user);
          return result.user;
        });
      }
    }),
    [user]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
