import { Link, useLocation } from 'react-router-dom'

const GlassNav = () => {
  const location = useLocation()
  
  const isActive = (path) => location.pathname === path

  const navItems = [
    { name: 'Home', path: '/', icon: '🏁' },
    { name: 'My Team', path: '/team', icon: '🏎️' },
    { name: 'League', path: '/league', icon: '🏆' },
    { name: 'F1 Hub', path: '/f1hub', icon: '📊' },
    { name: 'Draft', path: '/draft', icon: '📝' },
  ]

  return (
    <div className="fixed bottom-0 left-0 w-full z-[200]">
      
      {/* THE LIQUID GLASS LAYER 
         - backdrop-blur-xl: The heavy frost effect
         - backdrop-saturate-150: The "Apple" vibrancy boost
         - bg-black/30: Low opacity dark tint
         - border-t border-white/10: The subtle "edge" catch
      */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-xl backdrop-saturate-150 border-t border-white/5 shadow-[0_-4px_30px_rgba(0,0,0,0.5)]"></div>

      {/* CONTENT LAYER */}
      <div className="relative flex justify-around items-center h-20 pb-2 max-w-lg mx-auto md:max-w-none md:justify-center md:gap-12">
        {navItems.map((item) => {
           const active = isActive(item.path)
           return (
             <Link 
               key={item.name} 
               to={item.path} 
               className="group flex flex-col items-center justify-center w-16 h-full cursor-pointer transition-all duration-300"
             >
               {/* Icon Container with Glow Effect */}
               <div className={`
                 relative text-2xl transition-all duration-300 transform 
                 ${active ? 'scale-125 -translate-y-1' : 'opacity-50 group-hover:opacity-100 group-hover:scale-110'}
               `}>
                 {item.icon}
                 
                 {/* Active Glow Dot (The "Apple" Indicator) */}
                 {active && (
                   <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-1 h-1 bg-f1-red rounded-full shadow-[0_0_10px_#ff1e00]"></div>
                 )}
               </div>

               {/* Label (Optional: Scale 0 when inactive for cleaner look, or just dim) */}
               <span className={`
                 text-[9px] font-bold uppercase tracking-widest mt-1 transition-all duration-300
                 ${active ? 'text-white opacity-100' : 'text-gray-500 opacity-0 scale-0'}
               `}>
                 {item.name}
               </span>
             </Link>
           )
        })}
      </div>
    </div>
  )
}

export default GlassNav