import { Link, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../App'

const Navbar = () => {
  const location = useLocation()
  const navigate = useNavigate()
  
  // Helper to determine if a link is active
  const isActive = (path) => location.pathname === path ? 'text-f1-red' : 'text-gray-500'

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut()
    if (!error) {
      navigate('/login')
    }
  }

  return (
    <>
      {/* ==================================================================
          1. DESKTOP TOP NAV (Hidden on Mobile) 
          ================================================================== */}
      <nav className="hidden md:flex items-center justify-between px-8 py-4 bg-neutral-900 border-b border-neutral-800 sticky top-0 z-50">
        <div className="text-2xl font-black italic tracking-tighter">
          FANTASY <span className="text-f1-red">F1</span>
        </div>
        
        <div className="flex gap-8 font-bold text-sm uppercase tracking-widest items-center">
          <Link to="/" className={`hover:text-white transition ${isActive('/')}`}>Home</Link>
          <Link to="/f1hub" className={`hover:text-white transition ${isActive('/f1')}`}>F1</Link>
          <Link to="/league" className={`hover:text-white transition ${isActive('/league')}`}>League</Link>
          <Link to="/draft" className={`hover:text-white transition ${isActive('/draft')}`}>Draft Room</Link>
          <Link to="/team" className={`hover:text-white transition ${isActive('/team')}`}>My Team</Link>
          <Link to="/settings" className={`hidden md:block hover:text-white transition ${isActive('/settings')}`}>Settings</Link>

        </div>
      </nav>


      {/* ==================================================================
          2. MOBILE TOP NAV (New! - Hidden on Desktop)
          ================================================================== */}
      <nav className="md:hidden sticky top-0 z-40 bg-neutral-900 border-b border-neutral-800 p-4 flex justify-between items-center h-16">
        {/* Logo */}
        <div className="text-xl font-black italic tracking-tighter">
          FANTASY <span className="text-f1-red">F1</span>
        </div>

        {/* Conditional Logout Button - Only shows on '/team' */}
        {location.pathname === '/team' && (
          <button 
            onClick={handleLogout} 
            className="text-[10px] font-bold border border-red-600 text-red-600 px-3 py-1 rounded hover:bg-red-600 hover:text-white transition"
          >
            LOG OUT
          </button>
        )}
      </nav>


      {/* ==================================================================
          3. MOBILE BOTTOM NAV (Hidden on Desktop)
          ================================================================== */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full bg-neutral-900 border-t border-neutral-800 flex justify-between items-center px-2 py-3 z-50 pb-safe text-xs">
        
        <Link to="/" className="flex flex-col items-center gap-1 w-1/5">
          <span className={`text-2xl ${isActive('/')}`}>🏠</span>
          <span className={`font-bold uppercase scale-75 ${isActive('/')}`}>Home</span>
        </Link>

        <Link to="/f1hub" className="flex flex-col items-center gap-1 w-1/5">
          <span className={`text-2xl ${isActive('/f1hub')}`}>🏁</span>
          <span className={`font-bold uppercase scale-75 ${isActive('/f1hub')}`}>F1</span>
        </Link>

        <Link to="/league" className="flex flex-col items-center gap-1 w-1/5">
          <span className={`text-2xl ${isActive('/league')}`}>🏆</span>
          <span className={`font-bold uppercase scale-75 ${isActive('/league')}`}>League</span>
        </Link>

        <Link to="/draft" className="flex flex-col items-center gap-1 w-1/5">
           <span className={`text-2xl ${isActive('/draft')}`}>🏎️</span>
           <span className={`font-bold uppercase scale-75 ${isActive('/draft')}`}>Draft</span>
        </Link>

        <Link to="/team" className="flex flex-col items-center gap-1 w-1/5">
          <span className={`text-2xl ${isActive('/team')}`}>🧢</span>
          <span className={`font-bold uppercase scale-75 ${isActive('/team')}`}>Team</span>
        </Link>

      </nav>
    </>
  )
}

export default Navbar