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
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

function App() {
  const [session, setSession] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

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