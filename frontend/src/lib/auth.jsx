import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api, json } from './api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,setUser]=useState(undefined);
  useEffect(()=>{ api('/auth/me').then(r=>setUser(r.user)).catch(()=>setUser(null)); },[]);
  const value=useMemo(()=>({
    user, loading:user===undefined,
    async quickLogin(loginKey) {
      const result=await api('/auth/quick-login',json('POST',{loginKey}));
      if (result.user) setUser(result.user);
      return result;
    },
    async login(loginKey,password) {
      const result=await api('/auth/login',json('POST',{loginKey,password}));
      setUser(result.user); return result.user;
    },
    async register(payload) {
      const result=await api('/auth/register',json('POST',payload));
      setUser(result.user); return result.user;
    },
    async logout() { await api('/auth/logout',{method:'POST'}).catch(()=>{}); setUser(null); },
    refresh() { return api('/auth/me').then(r=>{setUser(r.user);return r.user}); }
  }),[user]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(){ return useContext(AuthContext); }
