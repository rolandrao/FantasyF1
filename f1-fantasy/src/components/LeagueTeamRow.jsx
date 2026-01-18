import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { getTeamColors } from '../utils/colors'
import F1TopDownCar from './F1TopDownCar'

const LeagueTeamRow = ({ team, rank, isExpanded, onToggle }) => {
  return (
    <div onClick={onToggle} className="bg-neutral-800 rounded-xl border border-white/5 overflow-hidden transition-all hover:bg-neutral-750 cursor-pointer group">
      
      {/* 1. ROW HEADER */}
      <div className="p-4 flex items-center gap-4 relative overflow-hidden">
        <div className={`w-8 h-8 md:w-10 md:h-10 flex items-center justify-center rounded-lg font-mono font-black text-lg md:text-xl shrink-0 z-10 ${rank === 1 ? 'bg-yellow-400 text-black shadow-[0_0_15px_rgba(250,204,21,0.4)]' : rank === 2 ? 'bg-gray-300 text-black' : rank === 3 ? 'bg-orange-700 text-white' : 'bg-white/5 text-gray-500'}`}>{rank}</div>
        <div className="flex-1 min-w-0 z-10">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-white truncate text-base md:text-lg">{team.team_name}</h3>
            {team.is_bot && <span className="text-[10px] bg-blue-900 text-blue-200 px-1.5 rounded font-bold">BOT</span>}
          </div>
          <div className="text-xs text-gray-400 truncate font-bold uppercase tracking-wider">{team.owner_name}</div>
        </div>
        <div className="text-right z-10">
           <div className="font-mono font-black text-white text-xl md:text-2xl tracking-tighter">{team.points}</div>
           <div className="text-[10px] text-gray-500 uppercase font-bold">PTS</div>
        </div>
        <div className={`transition-transform duration-300 z-10 ${isExpanded ? 'rotate-180' : ''}`}><svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg></div>
        <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-current to-transparent opacity-10 pointer-events-none" style={{ color: team.color }} />
      </div>

      {/* 2. EXPANDED GARAGE VIEW */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="bg-black border-t border-white/5">
            <div className="p-4 md:p-6 space-y-6">
                
                {/* --- GARAGE --- */}
                <div className="rounded-xl overflow-hidden border border-white/10 shadow-2xl bg-[#151515]">
                    {/* CONSTRUCTOR BANNER */}
                    <div className="py-2 px-4 text-center font-black italic tracking-tighter uppercase text-lg md:text-xl shadow-lg relative overflow-hidden" style={{ backgroundColor: team.color, color: team.color === '#ffffff' ? 'black' : 'white' }}>
                         <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-black/50 to-transparent"></div>
                         <span className="relative z-10 flex items-center justify-center gap-2">
                             <span className="opacity-50 text-sm">///</span> {team.constructor ? team.constructor.name : 'NO CONSTRUCTOR'} <span className="opacity-50 text-sm">///</span>
                         </span>
                    </div>

                    {/* THE 3 BAYS */}
                    <div className="grid grid-cols-3 divide-x divide-white/10 relative h-[250px] overflow-hidden">
                        {/* Floor Texture */}
                         <div className="absolute inset-0 opacity-10 pointer-events-none" 
                              style={{ backgroundImage: 'linear-gradient(#333 1px, transparent 1px), linear-gradient(90deg, #333 1px, transparent 1px)', backgroundSize: '40px 40px' }}>
                        </div>

                        {[0, 1, 2].map((i) => {
                            const driver = team.drivers[i]
                            const color = driver ? getTeamColors(driver.team).primary : '#333'
                            
                            // Determine Status Flags
                            const isStolen = driver?.isStolen === true
                            const isSwapped = driver?.isSwapped === true

                            return (
                                <div key={i} className="relative flex flex-col justify-end items-center group overflow-hidden">
                                    {/* Spotlight - Dynamic based on status */}
                                    <div 
                                        className="absolute top-0 left-0 right-0 h-[80%] opacity-20 pointer-events-none transition-all duration-500" 
                                        style={{ 
                                            background: `radial-gradient(circle at 50% 0%, ${isStolen ? '#a855f7' : isSwapped ? '#ef4444' : color}, transparent 100%)`,
                                            opacity: (isStolen || isSwapped) ? 0.4 : 0.2 
                                        }} 
                                    />

                                    {/* Status Indicator Badge */}
                                    {isStolen && (
                                        <div className="absolute top-4 z-20 animate-pulse">
                                            <div className="bg-purple-600 text-white text-[10px] md:text-xs font-black italic uppercase px-2 py-1 rounded shadow-[0_0_15px_rgba(168,85,247,0.6)] border border-purple-400">
                                                ★ STOLEN ASSET
                                            </div>
                                        </div>
                                    )}
                                    {isSwapped && (
                                        <div className="absolute top-4 z-20">
                                            <div className="bg-red-600/90 text-white text-[10px] md:text-xs font-black italic uppercase px-2 py-1 rounded border border-red-500/50">
                                                ⇄ SWAPPED
                                            </div>
                                        </div>
                                    )}

                                    {/* THE CSS CAR */}
                                    <div className="relative z-10 mb-8 w-full h-full flex items-center justify-center">
                                        {driver ? (
                                            <F1TopDownCar 
                                                color={color} 
                                                code={driver.code} 
                                                delay={i * 0.3} // Sequence delay
                                            />
                                        ) : (
                                            <div className="text-gray-700 text-xs font-mono uppercase border border-dashed border-gray-800 p-4 rounded">Bay Empty</div>
                                        )}
                                    </div>
                                    
                                    {/* Name Plate */}
                                    {driver && (
                                        <div className={`absolute bottom-2 z-20 flex flex-col items-center gap-0.5 w-full px-2`}>
                                            <div className={`
                                                font-mono text-[10px] md:text-xs uppercase tracking-widest px-2 py-0.5 rounded border 
                                                ${isStolen 
                                                    ? 'bg-purple-900/90 border-purple-500 text-purple-100 shadow-[0_0_10px_rgba(168,85,247,0.4)]' 
                                                    : isSwapped
                                                        ? 'bg-red-900/90 border-red-500 text-red-100'
                                                        : 'bg-black/80 border-white/10 text-gray-500'
                                                }
                                            `}>
                                                {driver.name.split(' ').pop()}
                                            </div>
                                            
                                            {/* Sub-label for context (optional) */}
                                            {isStolen && <div className="text-[8px] font-bold text-purple-400 uppercase">From {driver.stolenFrom || 'Rival'}</div>}
                                            {isSwapped && <div className="text-[8px] font-bold text-red-400 uppercase">From {driver.swappedFrom || 'Attacker'}</div>}
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </div>

                {/* --- CHIPS --- */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className={`p-4 rounded-xl border flex items-center justify-between gap-4 transition-all relative overflow-hidden ${team.chips.sc.status === 'available' ? 'bg-green-950/20 border-green-500/50 shadow-[0_0_20px_rgba(34,197,94,0.1)]' : 'bg-neutral-900 border-white/5 opacity-50 grayscale'}`}>
                        <div className="relative z-10">
                            <div className={`font-black italic uppercase tracking-tighter text-lg ${team.chips.sc.status === 'available' ? 'text-green-400 drop-shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'text-gray-500'}`}>SAFETY CAR</div>
                            <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mt-1">{team.chips.sc.status === 'available' ? 'Ready to Deploy' : `Deployed: ${team.chips.sc.raceName}`}</div>
                        </div>
                        {team.chips.sc.status === 'used' && <div className="relative z-10 font-mono font-black text-2xl text-green-500">+{team.chips.sc.points}</div>}
                    </div>

                    <div className={`p-4 rounded-xl border flex items-center justify-between gap-4 transition-all relative overflow-hidden ${team.chips.steal.status === 'available' ? 'bg-purple-950/20 border-purple-500/50 shadow-[0_0_20px_rgba(168,85,247,0.1)]' : 'bg-neutral-900 border-white/5 opacity-50 grayscale'}`}>
                        <div className="relative z-10 w-full">
                            <div className={`font-black italic uppercase tracking-tighter text-lg ${team.chips.steal.status === 'available' ? 'text-purple-400 drop-shadow-[0_0_8px_rgba(168,85,247,0.6)]' : 'text-gray-500'}`}>STEAL DRIVER</div>
                            <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mt-1 leading-snug">{team.chips.steal.status === 'available' ? 'Ready to Deploy' : team.chips.steal.narrative}</div>
                        </div>
                    </div>
                </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default LeagueTeamRow