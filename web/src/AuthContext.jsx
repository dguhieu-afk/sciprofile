import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'

const AuthContext = createContext(null)
export const useAuth = () => useContext(AuthContext)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [researcher, setResearcher] = useState(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  const loadAll = useCallback(async (user) => {
    const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    setProfile(p)

    let { data: r } = await supabase.from('researchers').select('*').eq('user_id', user.id).maybeSingle()
    if (!r) {
      const name = user.user_metadata?.full_name || user.email.split('@')[0]
      const { data: created } = await supabase.from('researchers')
        .insert({ user_id: user.id, full_name: name, contact_email: user.email })
        .select().maybeSingle()
      r = created
    }
    setResearcher(r)
  }, [])

  useEffect(() => {
    if (!session) { setProfile(null); setResearcher(null); return }
    loadAll(session.user)
  }, [session, loadAll])

  const value = {
    session,
    user: session?.user ?? null,
    profile,
    researcher,
    ready,
    isAdmin: profile?.role === 'ADMIN',
    reload: () => session && loadAll(session.user),
    signOut: () => supabase.auth.signOut(),
  }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}