import { useEffect, useState } from 'react'
import { supabase } from '../App'

const League = () => {
  const [standings, setStandings] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStandings()
  }, [])

  const fetchStandings = async () => {
    const { data, error } = await supabase
      .from('team_standings')
      .select('*')
      .order('total_score', { ascending: false })

    if (error) console.error('Error fetching standings:', error)
    else setStandings(data || [])
    
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-neutral-900 text-white pb-24 md:pb-10">
      
      {/* HEADER */}
      <div className="bg-neutral-800 border-b border-neutral-700 p-8 text-center">
        <h1 className="text-4xl font-black italic tracking-tighter mb-2">
          LEAGUE <span className="text-f1-red">STANDINGS</span>
        </h1>
        <p className="text-gray-400">Official Leaderboard • Season 2026</p>
      </div>

      {/* LEADERBOARD */}
      <div className="max-w-3xl mx-auto p-4 md:p-8">
        
        {loading ? (
            <div className="text-center text-gray-500 animate-pulse mt-12">Calculating Points...</div>
        ) : (
            <div className="space-y-4">
            
            {standings.map((team, index) => {
                // Top 3 Styling
                const isFirst = index === 0
                const rankColor = isFirst ? 'text-yellow-400' : index === 1 ? 'text-gray-300' : index === 2 ? 'text-amber-600' : 'text-gray-500'
                const borderClass = isFirst ? 'border-yellow-500 shadow-yellow-900/20 shadow-2xl scale-105' : 'border-neutral-700'

                return (
                    <div 
                        key={team.id} 
                        className={`
                            relative flex items-center justify-between bg-neutral-800 p-4 md:p-6 rounded-xl border-2 transition-transform
                            ${borderClass}
                        `}
                    >
                        {/* LEFT: Rank & Name */}
                        <div className="flex items-center gap-3 md:gap-6 overflow-hidden">
                            <div className={`text-3xl md:text-4xl font-black italic w-8 md:w-12 text-center shrink-0 ${rankColor}`}>
                                {index + 1}
                            </div>
                            <div className="min-w-0"> {/* min-w-0 forces truncation if needed */}
                                <h3 className="text-lg md:text-2xl font-bold leading-tight truncate">{team.team_name}</h3>
                                <p className="text-xs md:text-sm text-gray-400 uppercase tracking-widest truncate">{team.owner_name}</p>
                            </div>
                        </div>

                        {/* RIGHT: Score Breakdown (Stacked Layout) */}
                        <div className="text-right shrink-0 ml-2">
                            {/* Total Score */}
                            <div className="text-3xl md:text-5xl font-black text-white leading-none">
                                {team.total_score} <span className="text-xs md:text-sm font-normal text-gray-500">pts</span>
                            </div>
                            
                            {/* Mobile Breakdown (Now stacked nicely below score) */}
                            <div className="md:hidden text-[10px] text-gray-400 mt-1 font-mono">
                                D:<span className="text-white">{team.driver_score}</span> • C:<span className="text-white">{team.constructor_score}</span>
                            </div>

                            {/* Desktop Breakdown (Detailed) */}
                            <div className="hidden md:flex gap-3 justify-end mt-1 text-xs text-gray-500">
                                <span>Drivers: <b className="text-white">{team.driver_score}</b></span>
                                <span>•</span>
                                <span>Constructor: <b className="text-white">{team.constructor_score}</b></span>
                            </div>
                        </div>

                    </div>
                )
            })}
            </div>
        )}
      </div>
    </div>
  )
}

export default League