import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../App'

const Dashboard = () => {
  const [nextRace, setNextRace] = useState(null)
  const [leaderboard, setLeaderboard] = useState([])
  const [loading, setLoading] = useState(true)
  const [myTeamId, setMyTeamId] = useState(null)

  useEffect(() => {
    const fetchData = async () => {
      // 1. Get Current User (to highlight your team)
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user) {
        const { data: myTeam } = await supabase.from('teams').select('id').eq('user_id', user.id).single()
        if (myTeam) setMyTeamId(myTeam.id)
      }

      // 2. Get Next Upcoming Race
      const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD
      const { data: raceData } = await supabase
        .from('races')
        .select('*')
        .gte('date', today)
        .order('date', { ascending: true })
        .limit(1)
        .single()

      if (raceData) setNextRace(raceData)

      // 3. Get Top 5 Teams for Leaderboard
      const { data: teamsData } = await supabase
        .from('teams')
        .select('id, team_name, owner_name, total_points')
        .order('total_points', { ascending: false })
        .limit(5)

      if (teamsData) setLeaderboard(teamsData)
      
      setLoading(false)
    }
    fetchData()
  }, [])

  if (loading) return <div className="min-h-screen bg-neutral-900 flex items-center justify-center text-white">Loading Paddock...</div>

  // Helper to format date nicely (e.g., "Mar 02")
  const formatDate = (dateStr) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  // Helper to get day name (e.g., "Sunday")
  const getDayName = (dateStr) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', { weekday: 'long' })
  }

  return (
    <div className="min-h-screen bg-neutral-900 text-white p-4 pb-24 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* --- SECTION 1: HERO (NEXT RACE) --- */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-f1-red to-red-900 shadow-2xl border border-red-800">
          {/* Background Pattern */}
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-white opacity-5 rounded-full blur-3xl"></div>
          
          <div className="p-6 md:p-10 relative z-10">
            <div className="flex justify-between items-start">
                <div>
                    <h2 className="text-red-200 font-bold tracking-widest text-xs uppercase mb-1">Upcoming Grand Prix</h2>
                    <h1 className="text-3xl md:text-5xl font-black italic uppercase tracking-tighter text-white mb-2">
                        {nextRace ? nextRace.name.replace('Grand Prix', '') : 'Season Over'}
                    </h1>
                    <div className="flex items-center gap-2 text-red-100 font-medium">
                        <span className="text-xl">📍</span>
                        <span>{nextRace ? nextRace.circuit : 'TBA'}</span>
                    </div>
                </div>
                
                {/* Date Badge */}
                {nextRace && (
                    <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-3 text-center min-w-[80px]">
                        <span className="block text-xs uppercase text-red-200 font-bold">{getDayName(nextRace.date)}</span>
                        <span className="block text-3xl font-black text-white">{formatDate(nextRace.date).split(' ')[1]}</span>
                        <span className="block text-xs uppercase text-white font-bold">{formatDate(nextRace.date).split(' ')[0]}</span>
                    </div>
                )}
            </div>

            {/* Countdown / Status Bar */}
            <div className="mt-8 flex flex-wrap gap-3">
                <div className="bg-black/30 px-4 py-2 rounded-lg backdrop-blur-sm border border-white/10">
                    <span className="text-xs text-gray-300 uppercase font-bold mr-2">Round</span>
                    <span className="font-mono font-bold text-white">{nextRace?.round_number || '-'}</span>
                </div>
                {nextRace?.is_sprint && (
                    <div className="bg-yellow-500/20 px-4 py-2 rounded-lg border border-yellow-500/50 flex items-center gap-2">
                        <span className="text-yellow-500 text-xs font-bold uppercase">⚡ Sprint Weekend</span>
                    </div>
                )}
            </div>
          </div>
        </div>

        {/* --- SECTION 2: LEADERBOARD PREVIEW --- */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* LEADERBOARD CARD */}
            <div className="lg:col-span-2 bg-neutral-800 rounded-2xl border border-neutral-700 overflow-hidden shadow-lg">
                <div className="p-5 border-b border-neutral-700 flex justify-between items-center">
                    <h3 className="font-bold text-lg flex items-center gap-2">
                        <span>🏆</span> Top Standings
                    </h3>
                    <Link to="/league" className="text-xs font-bold text-gray-400 hover:text-white uppercase tracking-wider">View All</Link>
                </div>
                
                <div className="divide-y divide-neutral-700/50">
                    {leaderboard.map((team, index) => {
                        const isMe = team.id === myTeamId
                        return (
                            <div key={team.id} className={`p-4 flex items-center justify-between ${isMe ? 'bg-white/5' : ''}`}>
                                <div className="flex items-center gap-4">
                                    <span className={`font-black text-xl w-6 text-center italic ${index === 0 ? 'text-yellow-400' : 'text-gray-500'}`}>
                                        {index + 1}
                                    </span>
                                    <div>
                                        <div className={`font-bold text-sm md:text-base ${isMe ? 'text-f1-red' : 'text-white'}`}>
                                            {team.team_name} {isMe && '(You)'}
                                        </div>
                                        <div className="text-xs text-gray-400">{team.owner_name}</div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className="block font-mono font-bold text-lg">{team.total_points}</span>
                                    <span className="block text-[10px] text-gray-500 uppercase font-bold">PTS</span>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* --- QUICK LINKS (Mobile Friendly Grid) --- */}
            <div className="grid grid-cols-2 lg:grid-cols-1 gap-4">
                <Link to="/team" className="bg-neutral-800 p-6 rounded-2xl border border-neutral-700 hover:border-gray-500 transition group">
                    <div className="text-3xl mb-2 group-hover:scale-110 transition duration-300">🧢</div>
                    <div className="font-bold text-white">My Team</div>
                    <div className="text-xs text-gray-400 mt-1">Manage your driver lineup</div>
                </Link>

                <Link to="/draft" className="bg-neutral-800 p-6 rounded-2xl border border-neutral-700 hover:border-f1-red transition group">
                    <div className="text-3xl mb-2 group-hover:scale-110 transition duration-300">🏎️</div>
                    <div className="font-bold text-white">Draft Room</div>
                    <div className="text-xs text-gray-400 mt-1">View draft history</div>
                </Link>
            </div>
            
        </div>
      </div>
    </div>
  )
}

export default Dashboard