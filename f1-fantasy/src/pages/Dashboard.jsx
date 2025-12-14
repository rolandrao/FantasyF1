import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../App'

const Home = () => {
  const [loading, setLoading] = useState(true)
  const [nextRace, setNextRace] = useState(null)
  const [standings, setStandings] = useState([])

  // --- 1. FLAG COLOR LOGIC (Updated to return raw CSS values) ---
  const getGradientStyle = (location) => {
    if (!location) return { background: 'linear-gradient(to bottom right, #262626, #171717)' } // Default Dark
    
    const loc = location.toLowerCase()
    
    // Bahrain (Red to White)
    if (loc.includes('bahrain') || loc.includes('sakhir')) {
        console.log("HERE");
        return { background: 'linear-gradient(to bottom right, #990000, #cc0000, #f2f2f2)' }
    }
    // Saudi (Green)
    if (loc.includes('saudi') || loc.includes('jeddah')) {
        return { background: 'linear-gradient(to bottom right, #006400, #008000, #004d00)' }
    }
    // Australia (Green/Gold or Blue/Red - let's do Aussie Gold/Green)
    if (loc.includes('australia') || loc.includes('melbourne')) {
        return { background: 'linear-gradient(to bottom right, #00553e, #ffcd00)' }
    }
    // Miami (Cyan/Pink)
    if (loc.includes('miami')) {
        return { background: 'linear-gradient(to bottom right, #00aeef, #ec008c)' }
    }
    // Generic Red/White (Monaco, Japan, Canada, Austria)
    if (loc.includes('monaco') || loc.includes('japan') || loc.includes('canada') || loc.includes('austria')) {
        return { background: 'linear-gradient(to bottom right, #cc0000, #ffffff)' }
    }
    // Italy (Green/White/Red)
    if (loc.includes('italy') || loc.includes('monza') || loc.includes('imola')) {
        return { background: 'linear-gradient(to bottom right, #009246, #ffffff, #ce2b37)' }
    }
    // USA (Blue/Red)
    if (loc.includes('usa') || loc.includes('austin') || loc.includes('vegas')) {
        return { background: 'linear-gradient(to bottom right, #002868, #bf0a30)' }
    }
    // UK (Blue/Red/White)
    if (loc.includes('britain') || loc.includes('silverstone')) {
        return { background: 'linear-gradient(to bottom right, #012169, #C8102E, #ffffff)' }
    }
    
    // Default Fallback
    return { background: 'linear-gradient(to bottom right, #262626, #171717)' }
  }

  useEffect(() => {
    fetchDashboard()
  }, [])

  const fetchDashboard = async () => {
    setLoading(true)
    
    // 1. Get Next Race
    const today = new Date().toISOString()
    const { data: race } = await supabase
      .from('races')
      .select('*')
      .gt('date', today)
      .order('date', { ascending: true })
      .limit(1)
      .single()
    setNextRace(race)

    // 2. Get League Standings
    const { data: teamData } = await supabase
      .from('team_standings')
      .select('*')
      .order('total_score', { ascending: false })

    setStandings(teamData || [])
    setLoading(false)
  }

  if (loading) return <div className="min-h-screen bg-neutral-900 text-white flex items-center justify-center animate-pulse">Loading Season Data...</div>

  const first = standings[0]
  const second = standings[1]
  const third = standings[2]
  const restOfThePack = standings.slice(3)

  return (
    <div className="min-h-screen bg-neutral-900 text-white pb-24 md:pb-10">
      
      {/* =========================================
          COMPONENT 1: NEXT RACE (Dynamic Style) 
         ========================================= */}
      <div 
        className="relative overflow-hidden border-b border-neutral-700 shadow-2xl transition-all duration-700"
        style={getGradientStyle(nextRace?.location)} // <--- Applied directly here
      >
        {/* Dark overlay to ensure text readability */}
        <div className="absolute inset-0 bg-black/30 backdrop-blur-[1px]"></div>
        
        {/* Pattern Overlay */}
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>

        <div className="relative z-10 p-8 md:p-12 text-center md:text-left flex flex-col md:flex-row justify-between items-center gap-6">
            <div>
                <div className="inline-block bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-[10px] md:text-xs font-bold uppercase tracking-widest text-white mb-2 border border-white/20 shadow-lg">
                    Next Grand Prix
                </div>
                {nextRace ? (
                    <>
                        <h1 className="text-4xl md:text-6xl font-black italic tracking-tighter text-white drop-shadow-lg">
                            {nextRace.name.toUpperCase()}
                        </h1>
                        <p className="text-white/90 font-bold text-lg md:text-xl mt-1 flex items-center justify-center md:justify-start gap-2">
                            <span className="drop-shadow-md">📍 {nextRace.location}</span>
                            <span className="hidden md:inline">•</span>
                            <span className="font-mono bg-black/30 px-2 rounded">
                                {new Date(nextRace.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                            </span>
                        </p>
                    </>
                ) : (
                    <h1 className="text-4xl font-black italic text-white/50">Season Complete</h1>
                )}
            </div>

            {/* Countdown Box */}
            {nextRace && (
                <div className="bg-black/40 backdrop-blur-md border border-white/10 p-4 rounded-xl text-center min-w-[120px] shadow-xl">
                    <span className="block text-3xl md:text-4xl font-black text-white">
                       {Math.ceil((new Date(nextRace.date) - new Date()) / (1000 * 60 * 60 * 24))}
                    </span>
                    <span className="text-[10px] uppercase font-bold text-white/70 tracking-widest">Days Away</span>
                </div>
            )}
        </div>
      </div>


      {/* =========================================
          COMPONENT 2: LEAGUE LEADERBOARD 
         ========================================= */}
      <div className="max-w-4xl mx-auto p-4 md:p-8 -mt-6 relative z-20">
        
        <h2 className="text-center text-xl font-black italic mb-8 flex items-center justify-center gap-2">
            <span className="text-f1-red">🏆</span> LEAGUE STANDINGS
        </h2>

        {/* --- A. THE PODIUM (Top 3) --- */}
        {standings.length > 0 && (
            <div className="flex items-end justify-center gap-2 md:gap-4 mb-8 h-48 md:h-64">
                
                {/* 2ND PLACE (Left, Silver) */}
                <div className="w-1/3 md:w-1/4 flex flex-col items-center">
                    {second && (
                        <>
                            <div className="text-center mb-2 animate-in slide-in-from-bottom-4 duration-700 delay-100">
                                <div className="font-bold text-xs md:text-sm text-gray-300 truncate w-24 md:w-32 mx-auto">{second.team_name}</div>
                                <div className="font-black text-lg md:text-2xl text-white">{second.total_score}</div>
                            </div>
                            <div className="w-full bg-gradient-to-t from-gray-500 to-gray-400 h-24 md:h-32 rounded-t-lg border-x border-t border-gray-300 relative shadow-[0_0_15px_rgba(156,163,175,0.3)]">
                                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gray-700 text-gray-300 font-bold text-xs px-2 py-0.5 rounded-full border border-gray-500">2nd</div>
                            </div>
                        </>
                    )}
                </div>

                {/* 1ST PLACE (Center, Gold) */}
                <div className="w-1/3 md:w-1/4 flex flex-col items-center z-10">
                    {first && (
                        <>
                            <div className="text-center mb-2 animate-in slide-in-from-bottom-8 duration-700">
                                <div className="text-yellow-400 text-2xl drop-shadow-md mb-1">👑</div>
                                <div className="font-bold text-sm md:text-base text-yellow-100 truncate w-28 md:w-40 mx-auto">{first.team_name}</div>
                                <div className="font-black text-2xl md:text-4xl text-white">{first.total_score}</div>
                            </div>
                            <div className="w-full bg-gradient-to-t from-yellow-600 to-yellow-400 h-32 md:h-48 rounded-t-lg border-x border-t border-yellow-200 relative shadow-[0_0_20px_rgba(250,204,21,0.4)]">
                                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-yellow-900 text-yellow-400 font-bold text-sm px-3 py-0.5 rounded-full border border-yellow-500">1st</div>
                            </div>
                        </>
                    )}
                </div>

                {/* 3RD PLACE (Right, Bronze) */}
                <div className="w-1/3 md:w-1/4 flex flex-col items-center">
                    {third && (
                        <>
                            <div className="text-center mb-2 animate-in slide-in-from-bottom-4 duration-700 delay-200">
                                <div className="font-bold text-xs md:text-sm text-orange-200 truncate w-24 md:w-32 mx-auto">{third.team_name}</div>
                                <div className="font-black text-lg md:text-2xl text-white">{third.total_score}</div>
                            </div>
                            <div className="w-full bg-gradient-to-t from-orange-700 to-orange-500 h-20 md:h-24 rounded-t-lg border-x border-t border-orange-300 relative shadow-[0_0_15px_rgba(249,115,22,0.3)]">
                                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-orange-900 text-orange-300 font-bold text-xs px-2 py-0.5 rounded-full border border-orange-500">3rd</div>
                            </div>
                        </>
                    )}
                </div>

            </div>
        )}

        {/* --- B. THE REST (4th - 6th) --- */}
        <div className="space-y-3">
            {restOfThePack.map((team, index) => (
                <div 
                    key={team.id} 
                    className="flex items-center justify-between bg-neutral-800 p-3 md:p-4 rounded-lg border border-neutral-700 hover:border-neutral-500 transition"
                >
                    <div className="flex items-center gap-4">
                        <div className="font-mono font-bold text-gray-500 w-6">#{index + 4}</div>
                        <div>
                            <div className="font-bold text-sm md:text-base text-white">{team.team_name}</div>
                            <div className="text-[10px] md:text-xs text-gray-500 uppercase">{team.owner_name}</div>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="font-bold text-white">{team.total_score} pts</div>
                    </div>
                </div>
            ))}
        </div>

      </div>
    </div>
  )
}

export default Home