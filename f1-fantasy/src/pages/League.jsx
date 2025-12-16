import { useEffect, useState } from 'react'
import { supabase } from '../App'
import { getTeamColors } from '../utils/colors'
import { motion, AnimatePresence } from 'framer-motion'

const League = () => {
  const [standings, setStandings] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedTeamId, setExpandedTeamId] = useState(null)
  
  // Future-proofing: State for "Eras" if you want to view history later
  // const [selectedEra, setSelectedEra] = useState('current') 

  useEffect(() => {
    fetchLeagueData()
  }, [])

  const fetchLeagueData = async () => {
    setLoading(true)

    // 1. Fetch Basic Team Info
    const { data: teams } = await supabase.from('teams').select('id, team_name, owner_name, is_bot')
    
    // 2. Fetch Calculated Points from our SQL View
    const { data: points } = await supabase.from('view_team_points_total').select('*')
    
    // 3. Fetch Active Rosters (To display driver codes)
    const { data: picks } = await supabase
      .from('draft_picks')
      .select(`
        team_id, 
        drivers(code, name, team), 
        constructors(name)
      `)

    // 4. Merge Data
    const merged = teams.map(t => {
      const tPoints = points.find(p => p.team_id === t.id)?.total_points || 0
      const tRoster = picks.filter(p => p.team_id === t.id)
      
      const drivers = tRoster.filter(r => r.drivers).map(r => r.drivers)
      const constructor = tRoster.find(r => r.constructors)?.constructors

      return {
        ...t,
        points: tPoints,
        drivers,
        constructor,
        // Determine "Primary Color" based on their Constructor
        color: getTeamColors(constructor?.name).primary 
      }
    })

    // 5. Sort by Points (Desc)
    setStandings(merged.sort((a, b) => b.points - a.points))
    setLoading(false)
  }

  // --- RENDER HELPERS ---
  const getPodiumHeight = (rank) => {
    if (rank === 1) return 'h-40 md:h-52' // P1
    if (rank === 2) return 'h-32 md:h-40' // P2
    return 'h-24 md:h-32' // P3
  }

  if (loading) return <div className="min-h-screen bg-neutral-900 text-white flex items-center justify-center animate-pulse">Loading Championship Data...</div>

  return (
    <div className="min-h-screen bg-neutral-900 text-white pb-24">
      
      {/* HEADER */}
      <div className="p-6 md:p-10 border-b border-white/10 bg-gradient-to-b from-neutral-800 to-neutral-900">
        <div className="max-w-5xl mx-auto text-center md:text-left">
          <h1 className="text-3xl md:text-5xl font-black italic tracking-tighter mb-2">
            LEAGUE <span className="text-f1-red">STANDINGS</span>
          </h1>
          <p className="text-gray-400 text-sm md:text-base font-bold uppercase tracking-widest">
            Season 2026 • Era 1
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 mt-4">
        
        {/* --- THE PODIUM (TOP 3) --- */}
        <div className="flex justify-center items-end gap-2 md:gap-6 mb-12">
          {/* P2 */}
          {standings[1] && <PodiumCard team={standings[1]} rank={2} height={getPodiumHeight(2)} />}
          
          {/* P1 */}
          {standings[0] && <PodiumCard team={standings[0]} rank={1} height={getPodiumHeight(1)} />}
          
          {/* P3 */}
          {standings[2] && <PodiumCard team={standings[2]} rank={3} height={getPodiumHeight(3)} />}
        </div>


        {/* --- THE LIST (REST OF PACK) --- */}
        <div className="space-y-3">
          {standings.slice(3).map((team, index) => (
             <TeamRow 
               key={team.id} 
               team={team} 
               rank={index + 4} 
               isExpanded={expandedTeamId === team.id}
               onToggle={() => setExpandedTeamId(expandedTeamId === team.id ? null : team.id)}
             />
          ))}
        </div>

      </div>
    </div>
  )
}

// --- SUB-COMPONENT: PODIUM CARD ---
const PodiumCard = ({ team, rank, height }) => {
  return (
    <div className={`flex flex-col items-center w-1/3 md:w-48 group`}>
      {/* Avatar/Icon */}
      <div className="mb-3 relative">
        <div className={`w-12 h-12 md:w-20 md:h-20 rounded-full border-4 flex items-center justify-center bg-neutral-800 shadow-2xl z-10 relative
          ${rank === 1 ? 'border-yellow-400 text-yellow-400' : rank === 2 ? 'border-gray-300 text-gray-300' : 'border-orange-700 text-orange-700'}
        `}>
           <span className="text-xl md:text-3xl font-black">{rank}</span>
        </div>
        {/* Glow Effect */}
        <div className="absolute inset-0 rounded-full blur-xl opacity-30" style={{ background: team.color }}></div>
      </div>

      {/* Bar */}
      <div className={`${height} w-full rounded-t-xl bg-neutral-800 border-x border-t border-white/10 relative overflow-hidden flex flex-col justify-end p-2 md:p-4 text-center transition-all group-hover:-translate-y-2`}>
        {/* Team Color Gradient Overlay */}
        <div className="absolute inset-0 opacity-10 bg-gradient-to-t from-current to-transparent" style={{ color: team.color }} />
        
        <div className="relative z-10">
          <div className="text-[10px] md:text-xs font-bold uppercase tracking-widest text-gray-400 mb-1 truncate">
            {team.owner_name}
          </div>
          <div className="font-black italic text-sm md:text-xl truncate leading-tight mb-1">
            {team.team_name}
          </div>
          <div className="text-f1-red font-mono font-bold text-lg md:text-2xl">
            {team.points}
          </div>
        </div>
      </div>
    </div>
  )
}

// --- SUB-COMPONENT: TEAM LIST ROW ---
const TeamRow = ({ team, rank, isExpanded, onToggle }) => {
  return (
    <div 
      onClick={onToggle}
      className="bg-neutral-800 rounded-xl border border-white/5 overflow-hidden transition-all hover:bg-neutral-750 cursor-pointer group"
    >
      <div className="p-4 flex items-center gap-4">
        {/* Rank */}
        <div className="font-mono text-gray-500 font-bold w-6 text-center">{rank}</div>
        
        {/* Team Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-white truncate">{team.team_name}</h3>
            {team.is_bot && <span className="text-[10px] bg-blue-900 text-blue-200 px-1.5 rounded font-bold">BOT</span>}
          </div>
          <div className="text-xs text-gray-400 truncate">{team.owner_name}</div>
        </div>

        {/* Desktop: Mini Roster Pills */}
        <div className="hidden md:flex items-center gap-2">
           {team.drivers.map(d => (
             <span key={d.code} className="text-[10px] font-bold bg-neutral-900 text-gray-400 px-1.5 py-0.5 rounded border border-white/5">{d.code}</span>
           ))}
           {team.constructor && (
             <span className="text-[10px] font-bold bg-neutral-900 text-blue-200 px-1.5 py-0.5 rounded border border-blue-900/30">{team.constructor.name.substring(0,3).toUpperCase()}</span>
           )}
        </div>

        {/* Points */}
        <div className="text-right">
           <div className="font-mono font-bold text-green-400 text-lg">{team.points}</div>
           <div className="text-[10px] text-gray-500 uppercase">PTS</div>
        </div>

        {/* Arrow */}
        <div className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
           <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
        </div>
      </div>

      {/* EXPANDED GARAGE VIEW */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div 
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="overflow-hidden bg-black/20"
          >
            <div className="p-4 pt-0 grid grid-cols-2 md:grid-cols-4 gap-3">
              {team.drivers.map(d => (
                <div key={d.code} className="bg-neutral-800 p-2 rounded border-l-2 border-white/10 flex items-center gap-3">
                   <div className="w-8 h-8 rounded-full bg-neutral-700 flex items-center justify-center text-sm">🏎️</div>
                   <div className="min-w-0">
                      <div className="text-xs font-bold truncate">{d.name}</div>
                      <div className="text-[10px] text-gray-500">{d.team}</div>
                   </div>
                </div>
              ))}
              {team.constructor && (
                <div className="bg-neutral-800 p-2 rounded border-l-2 border-blue-500 flex items-center gap-3">
                   <div className="w-8 h-8 rounded-full bg-neutral-700 flex items-center justify-center text-sm">🔧</div>
                   <div className="min-w-0">
                      <div className="text-xs font-bold truncate">{team.constructor.name}</div>
                      <div className="text-[10px] text-gray-500">Constructor</div>
                   </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default League