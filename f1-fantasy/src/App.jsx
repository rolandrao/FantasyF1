import { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { createClient } from '@supabase/supabase-js'

// Import Pages
import Dashboard from './pages/Dashboard'
import MyTeam from './pages/MyTeam'
import League from './pages/League'
import F1Hub from './pages/F1Hub'
import DraftRoom from './pages/DraftRoom'
import Login from './pages/Login'
import Navbar from './components/Navbar'

// Environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY
export const supabase = createClient(supabaseUrl, supabaseKey)

function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true) // <--- NEW: Loading state

  const hideNavbarRoutes = ['/login']

  const shouldShowNavbar = !hideNavbarRoutes.includes(location.pathname)

  useEffect(() => {
    // 1. Check active session on startup
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false) // Stop loading once we know the result
    })

    // 2. Listen for changes (this catches the Magic Link redirect!)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setLoading(false) // Stop loading if auth state changes
    })

    return () => subscription.unsubscribe()
  }, [])

  // 3. SHOW LOADING SCREEN instead of redirecting immediately
  if (loading) {
    return (
      <div style={{ 
        height: '100vh', 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        backgroundColor: '#1e1e1e', 
        color: 'white' 
      }}>
        Loading F1 Fantasy...
      </div>
    )
  }

  return (
    <Router>
      <div className="app-container" style={{ fontFamily: 'Arial, sans-serif' }}>
        {shouldShowNavbar && <Navbar session={session} />}
        
        
        <div style={{ padding: '20px' }}>
          <Routes>
            <Route path="/login" element={!session ? <Login /> : <Navigate to="/" />} />
            
            {/* Protected Routes */}
            <Route path="/" element={session ? <Dashboard /> : <Navigate to="/login" />} />
            <Route path="/team" element={session ? <MyTeam /> : <Navigate to="/login" />} />
            <Route path="/league" element={session ? <League /> : <Navigate to="/login" />} />
            <Route path="/f1hub" element={session ? <F1Hub /> : <Navigate to="/login" />} />
            <Route path="/draft" element={session ? <DraftRoom /> : <Navigate to="/login" />} />
          </Routes>
        </div>
      </div>
    </Router>
  )
}

export default App

