import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
} from 'react';
import { registerPushToken } from '@/lib/push';
import { supabase } from '@/lib/supabase';
import type {
  Forening, MembershipWithForening, Profile, ViewRole,
} from '@/lib/types';

const ACTIVE_KEY = 'levla.activeForeningId';

type AuthState = {
  loading: boolean;              // resolving the initial session
  dataLoading: boolean;          // fetching profile/memberships after an auth change
  session: Session | null;
  profile: Profile | null;
  memberships: MembershipWithForening[];
  kommunIds: string[];
  activeForeningId: string | null;
  activeMembership: MembershipWithForening | null;
  activeForening: Forening | null;
  actAsForening: Forening | null;
  isKommunAdmin: boolean;
  /** Which app surface the user should see right now. null => must join a förening. */
  role: ViewRole | null;

  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string, displayName: string) => Promise<{ error?: string; needsConfirm?: boolean }>;
  signOut: () => Promise<void>;
  joinForeningByCode: (code: string) => Promise<{ error?: string }>;
  setActiveForeningId: (id: string) => void;
  refresh: () => Promise<void>;
  openForeningAsLeader: (f: Forening) => void;
  exitForeningAsLeader: () => void;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [memberships, setMemberships] = useState<MembershipWithForening[]>([]);
  const [kommunIds, setKommunIds] = useState<string[]>([]);
  const [activeForeningId, setActiveForeningIdState] = useState<string | null>(null);
  const [actAsForening, setActAsForening] = useState<Forening | null>(null);

  // Load the persisted active-förening choice once.
  useEffect(() => {
    AsyncStorage.getItem(ACTIVE_KEY).then((v) => {
      if (v) setActiveForeningIdState(v);
    });
  }, []);

  const loadUserData = useCallback(async (userId: string) => {
    setDataLoading(true);
    try {
      const [{ data: prof }, { data: mem }, { data: ka }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
        supabase.from('membership').select('*, forening:forening_id(*)').eq('user_id', userId),
        supabase.from('kommun_admin').select('kommun_id').eq('user_id', userId),
      ]);
      setProfile((prof as Profile) ?? null);
      setMemberships((mem as MembershipWithForening[]) ?? []);
      setKommunIds(((ka as { kommun_id: string }[]) ?? []).map((r) => r.kommun_id));
    } finally {
      setDataLoading(false);
    }
  }, []);

  // Bootstrap session + subscribe to auth changes.
  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);
      if (data.session?.user) {
        // Never hang startup on the network — cap the initial load at 6s.
        await Promise.race([
          loadUserData(data.session.user.id).catch(() => {}),
          new Promise<void>((r) => setTimeout(r, 6000)),
        ]);
      }
      if (active) setLoading(false);
    }).catch(() => {
      if (active) setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, s) => {
      setSession(s);
      if (s?.user) {
        await loadUserData(s.user.id);
      } else {
        setProfile(null);
        setMemberships([]);
        setKommunIds([]);
      }
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [loadUserData]);

  // Register this device for push once a user is signed in (no-op in Expo Go).
  useEffect(() => {
    const uid = session?.user?.id;
    if (uid) registerPushToken(uid);
  }, [session?.user?.id]);

  // Keep a valid active förening once memberships are known.
  useEffect(() => {
    if (memberships.length === 0) return;
    const stillValid = activeForeningId && memberships.some((m) => m.forening_id === activeForeningId);
    if (!stillValid) {
      const first = memberships[0].forening_id;
      setActiveForeningIdState(first);
      AsyncStorage.setItem(ACTIVE_KEY, first);
    }
  }, [memberships, activeForeningId]);

  const setActiveForeningId = useCallback((id: string) => {
    setActiveForeningIdState(id);
    AsyncStorage.setItem(ACTIVE_KEY, id);
  }, []);

  const refresh = useCallback(async () => {
    if (session?.user) await loadUserData(session.user.id);
  }, [session, loadUserData]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    return error ? { error: error.message } : {};
  }, []);

  const signUp = useCallback(async (email: string, password: string, displayName: string) => {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { display_name: displayName.trim() } },
    });
    if (error) return { error: error.message };
    // If email confirmation is on, there is no session yet.
    return { needsConfirm: !data.session };
  }, []);

  const signOut = useCallback(async () => {
    setActAsForening(null);
    await supabase.auth.signOut();
  }, []);

  const joinForeningByCode = useCallback(async (code: string) => {
    const { error } = await supabase.rpc('join_forening_by_code', { p_code: code.trim() });
    if (error) return { error: error.message };
    await refresh();
    return {};
  }, [refresh]);

  const activeMembership = useMemo(
    () => memberships.find((m) => m.forening_id === activeForeningId) ?? memberships[0] ?? null,
    [memberships, activeForeningId],
  );

  const isKommunAdmin = kommunIds.length > 0;

  const activeForening = useMemo(
    () => actAsForening ?? activeMembership?.forening ?? null,
    [actAsForening, activeMembership],
  );

  const role: ViewRole | null = useMemo(() => {
    if (actAsForening) return 'ledare';
    if (activeMembership) return activeMembership.role;
    if (isKommunAdmin) return 'kommun';
    return null;
  }, [actAsForening, activeMembership, isKommunAdmin]);

  const openForeningAsLeader = useCallback((f: Forening) => setActAsForening(f), []);
  const exitForeningAsLeader = useCallback(() => setActAsForening(null), []);

  const value: AuthState = {
    loading,
    dataLoading,
    session,
    profile,
    memberships,
    kommunIds,
    activeForeningId: activeForening?.id ?? null,
    activeMembership,
    activeForening,
    actAsForening,
    isKommunAdmin,
    role,
    signIn,
    signUp,
    signOut,
    joinForeningByCode,
    setActiveForeningId,
    refresh,
    openForeningAsLeader,
    exitForeningAsLeader,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth måste användas inuti <AuthProvider>');
  return ctx;
}
