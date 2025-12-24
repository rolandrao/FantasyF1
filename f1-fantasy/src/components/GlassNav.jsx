import { Link, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'

const GlassNav = () => {
  const location = useLocation()

  // Define your navigation items here
  const navItems = [
    { id: 'home', label: 'Home', path: '/home', icon: '🏠' },
    { id: 'f1hub', label: 'F1 Hub', path: '/f1hub', icon: '🏁' },
    { id: 'league', label: 'League', path: '/league', icon: '👥' },
    { id: 'team', label: 'My Team', path: '/team', icon: '🧢' },
    { id: 'draft', label: 'Draft', path: '/draft', icon: '🏎️' },
    // Add Admin or Rules if needed
    // { id: 'admin', label: 'Admin', path: '/admin', icon: '⚙️' }, 
  ]

  if (location.pathname === '/') {
    return null
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 pb-6 md:pb-4 pointer-events-none flex justify-center">
      {/* The Container:
         - pointer-events-auto: Re-enables clicking (parent is none to let clicks pass through to content behind)
         - backdrop-blur: The glassy look
      */}
      <div className="pointer-events-auto bg-neutral-900/80 backdrop-blur-xl border border-white/10 shadow-2xl rounded-2xl p-1.5 flex gap-1 md:gap-2 max-w-md w-full relative">
        
        {navItems.map((item) => {
          // Check if this tab is active
          const isActive = location.pathname === item.path

          return (
            <Link
              key={item.id}
              to={item.path}
              className={`
                relative flex-1 flex flex-col items-center justify-center py-3 px-1 rounded-xl transition-colors
                ${isActive ? 'text-white' : 'text-gray-500 hover:text-gray-300'}
              `}
              // Disable browser touch highlight color on mobile
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              {/* THE SLIDING PILL 
                 We render this ONLY if the tab is active.
                 Framer Motion detects the 'layoutId' and animates it from the old position to the new one.
              */}
              {isActive && (
                <motion.div
                  layoutId="nav-pill"
                  className="absolute inset-0 bg-white/10 rounded-xl border border-white/5 shadow-inner"
                  transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                />
              )}

              {/* Icon & Label (Must be z-10 to sit on top of the pill) */}
              <span className="relative z-10 text-xl mb-0.5 transform transition-transform duration-200" style={{ transform: isActive ? 'scale(1.1)' : 'scale(1)' }}>
                {item.icon}
              </span>
              <span className="relative z-10 text-[10px] font-bold uppercase tracking-widest">
                {item.label}
              </span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

export default GlassNav