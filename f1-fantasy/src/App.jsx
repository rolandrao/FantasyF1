import { useState, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom' // <-- 1. ADDED Navigate
import { createClient } from '@supabase/supabase-js'
import Login from './pages/Login'
import Home from './pages/Home'
import DraftRoom from './pages/DraftRoom'
import MyTeam from './pages/MyTeam'
import League from './pages/League'
import F1Hub from './pages/F1Hub'
import GlassNav from './components/GlassNav' 
import Navbar from './components/Navbar'
import Settings from './pages/Settings'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// 2. FIXED MOBILE AUTH SETTINGS
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: window.localStorage, 
    autoRefreshToken: true,       
    persistSession: true,         
    detectSessionInUrl: true      // <-- CHANGED TO TRUE FOR GOOGLE OAUTH!
  }
})

function App() {
  const [session, setSession] = useState(null)
  const [isInitializing, setIsInitializing] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setIsInitializing(false) 
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-neutral-900 text-white flex flex-col items-center justify-center animate-pulse">
        <div className="text-4xl mb-4">🏎️</div>
        <div className="text-gray-400 font-bold tracking-widest uppercase text-sm">Warming up the tires...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-neutral-900 text-white font-sans antialiased selection:bg-f1-red selection:text-white flex flex-col">
      
      <div className="hidden md:block sticky top-0 z-50 w-full">
        <Navbar session={session} />
      </div>

      <main className="flex-1 relative w-full overflow-x-hidden pb-24 md:pb-10">
        <Routes>
          {/* 👇 3. THE ROUTER FIX: Bounce logged-in users away from the Login page */}
          <Route path="/" element={session ? <Navigate to="/home" replace /> : <Login />} />
          
          <Route path="/home" element={<Home />} />
          <Route path="/draft" element={<DraftRoom />} />
          <Route path="/team" element={<MyTeam />} />
          <Route path="/league" element={<League />} />
          <Route path="/f1hub" element={<F1Hub />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>

      <div className="md:hidden">
        {/* 👇 Optional Polish: Only show the bottom nav bar if they are actually logged in! */}
        {session && <GlassNav />}
      </div>

    </div>
  )
}

export default App