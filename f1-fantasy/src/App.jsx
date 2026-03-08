import { useState, useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
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

// 1. HARDCODE MOBILE AUTH SETTINGS
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: window.localStorage, // Forces saving to the device's local storage
    autoRefreshToken: true,       // Automatically refreshes the token in the background
    persistSession: true,         // Keeps them logged in when the app is closed
    detectSessionInUrl: false     // Set to false to avoid URL parsing conflicts unless using Magic Links
  }
})

function App() {
  const [session, setSession] = useState(null)
  
  // 2. ADD INITIALIZING STATE
  const [isInitializing, setIsInitializing] = useState(true)

  useEffect(() => {
    // 3. CHECK FOR SESSION ON BOOT
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setIsInitializing(false) // Turn off the loading screen once we have an answer
    })

    // Listen for logins/logouts
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  // 4. SHOW LOADING SCREEN WHILE WARMING UP
  if (isInitializing) {
    return (
      <div className="min-h-screen bg-neutral-900 text-white flex flex-col items-center justify-center animate-pulse">
        <div className="text-4xl mb-4">🏎️</div>
        <div className="text-gray-400 font-bold tracking-widest uppercase text-sm">Warming up the tires...</div>
      </div>
    )
  }

  return (
    // CHANGE 1: Removed 'md:flex-row'. We want a vertical stack (Nav on top, Content below).
    <div className="min-h-screen bg-neutral-900 text-white font-sans antialiased selection:bg-f1-red selection:text-white flex flex-col">
      
      {/* =====================================================
          DESKTOP NAVIGATION (Horizontal Top Bar)
          - Removed 'h-screen' (which forced it to be a tall sidebar)
          - Added 'w-full' to ensure it stretches across the top
         ===================================================== */}
      <div className="hidden md:block sticky top-0 z-50 w-full">
        <Navbar session={session} />
      </div>

      {/* =====================================================
          MAIN CONTENT AREA
         ===================================================== */}
      <main className="flex-1 relative w-full overflow-x-hidden pb-24 md:pb-10">
        <Routes>
          <Route path="/home" element={<Home />} />
          <Route path="/" element={<Login />} />
          <Route path="/draft" element={<DraftRoom />} />
          <Route path="/team" element={<MyTeam />} />
          <Route path="/league" element={<League />} />
          <Route path="/f1hub" element={<F1Hub />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>

      {/* =====================================================
          MOBILE NAVIGATION (Bottom Glass)
         ===================================================== */}
      <div className="md:hidden">
        <GlassNav />
      </div>

    </div>
  )
}

export default App