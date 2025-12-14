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
      {/* --- DESKTOP TOP BAR (Hidden on Mobile) --- */}
      <nav className="hidden md:flex items-center justify-between px-8 py-4 bg-neutral-900 border-b border-neutral-800 sticky top-0 z-50">
        <div className="text-2xl font-black italic tracking-tighter">
          FANTASY <span className="text-f1-red">F1</span>
        </div>
        
        <div className="flex gap-8 font-bold text-sm uppercase tracking-widest items-center">
          <Link to="/" className={`hover:text-white transition ${isActive('/')}`}>Dashboard</Link>
          <Link to="/league" className={`hover:text-white transition ${isActive('/league')}`}>League</Link>
          <Link to="/draft" className={`hover:text-white transition ${isActive('/draft')}`}>Draft Room</Link>
          <Link to="/team" className={`hover:text-white transition ${isActive('/team')}`}>My Team</Link>
          
          {/* DESKTOP LOGOUT BUTTON */}
          <button 
            onClick={handleLogout} 
            className="ml-4 border border-red-600 text-red-600 hover:bg-red-600 hover:text-white px-4 py-1 rounded transition"
          >
            LOG OUT
          </button>
        </div>
      </nav>

      {/* --- MOBILE BOTTOM BAR (Hidden on Desktop) --- */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full bg-neutral-900 border-t border-neutral-800 flex justify-around items-center py-3 z-50 pb-safe">
        <Link to="/" className="flex flex-col items-center gap-1">
          <span className={`text-2xl ${isActive('/')}`}>🏠</span>
          <span className={`text-[10px] font-bold uppercase ${isActive('/')}`}>Home</span>
        </Link>
        
        <Link to="/league" className="flex flex-col items-center gap-1">
          <span className={`text-2xl ${isActive('/league')}`}>🏆</span>
          <span className={`text-[10px] font-bold uppercase ${isActive('/league')}`}>League</span>
        </Link>

        {/* Highlighted Draft Button (Center) */}
        <Link to="/draft" className="relative -top-5 bg-f1-red border-4 border-neutral-900 rounded-full w-14 h-14 flex items-center justify-center shadow-lg shadow-red-900/50">
          <span className="text-2xl text-white">🏎️</span>
        </Link>

        <Link to="/team" className="flex flex-col items-center gap-1">
          <span className={`text-2xl ${isActive('/team')}`}>🧢</span>
          <span className={`text-[10px] font-bold uppercase ${isActive('/team')}`}>Team</span>
        </Link>

        {/* MOBILE LOGOUT ICON */}
        <button onClick={handleLogout} className="flex flex-col items-center gap-1 text-gray-500">
          <span className="text-2xl">🚪</span>
          <span className="text-[10px] font-bold uppercase">Exit</span>
        </button>
      </nav>
    </>
  )
}

export default Navbar