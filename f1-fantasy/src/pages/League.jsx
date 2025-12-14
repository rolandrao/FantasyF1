import { useEffect, useState } from 'react'
import { supabase } from '../App'

const League = () => {
  const [teams, setTeams] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchLeagueData = async () => {
      // 1. Fetch all Teams (Ordered by Points)
      const { data: teamsData, error: teamsError } = await supabase
        .from('teams')
        .select('*')
        .order('total_points', { ascending: false })

      if (teamsError) console.error("Error fetching teams:", teamsError)

      // 2. Fetch all Draft Picks
      // FIX: Removed ', team' from 'drivers (name)' because the column doesn't exist
      const { data: picksData, error: picksError } = await supabase
        .from('draft_picks')
        .select(`
          team_id,
          driver_id,
          constructor_id,
          drivers (name), 
          constructors (name)
        `)

      if (picksError) console.error("Error fetching picks:", picksError)

      // 3. Combine Data
      const combinedData = (teamsData || []).map((team) => {
        // Find all picks belonging to this team
        const teamPicks = (picksData || []).filter(p => p.team_id === team.id)
        
        const drivers = teamPicks
            .filter(p => p.driver_id && p.drivers) // Ensure driver data exists
            .map(p => p.drivers)
        
        const constructor = teamPicks
            .find(p => p.constructor_id && p.constructors)
            ?.constructors

        return { ...team, drivers, constructor }
      })

      setTeams(combinedData)
      setLoading(false)
    }

    fetchLeagueData()
  }, [])

  if (loading) return <div className="p-10 text-white flex justify-center">Loading League Data...</div>

  return (
    <div className="min-h-screen bg-neutral-900 text-white p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        
        {/* PAGE TITLE */}
        <div className="flex items-center gap-4 mb-8">
            <h1 className="text-4xl font-extrabold italic tracking-tighter text-white">
                LEAGUE <span className="text-f1-red">STANDINGS</span>
            </h1>
            <div className="h-1 flex-grow bg-neutral-800 rounded"></div>
        </div>

        {/* LEADERBOARD TABLE */}
        <div className="bg-neutral-800 rounded-xl overflow-hidden shadow-2xl border border-neutral-700">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              
              {/* TABLE HEADER */}
              <thead className="bg-neutral-900 text-gray-400 uppercase text-xs font-bold tracking-wider">
                <tr>
                  <th className="p-5 text-center w-16">#</th>
                  <th className="p-5">Team Principal</th>
                  <th className="p-5 hidden md:table-cell">Lineup</th>
                  <th className="p-5 text-right">Points</th>
                </tr>
              </thead>

              {/* TABLE BODY */}
              <tbody className="divide-y divide-neutral-700">
                {teams.map((team, index) => {
                  let rankColor = "text-gray-400"
                  if (index === 0) rankColor = "text-yellow-400"
                  if (index === 1) rankColor = "text-gray-300"
                  if (index === 2) rankColor = "text-orange-400"

                  return (
                    <tr key={team.id} className="hover:bg-neutral-750 transition duration-150">
                      
                      {/* 1. RANK */}
                      <td className="p-5 text-center">
                        <span className={`text-2xl font-black italic ${rankColor}`}>{index + 1}</span>
                      </td>

                      {/* 2. TEAM INFO */}
                      <td className="p-5">
                        <div className="font-bold text-lg text-white">{team.team_name}</div>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-sm text-gray-400">{team.owner_name}</span>
                            {team.is_bot && (
                                <span className="text-[10px] bg-neutral-700 text-gray-300 px-1.5 py-0.5 rounded border border-neutral-600">BOT</span>
                            )}
                        </div>
                        {/* Mobile Lineup */}
                        <div className="md:hidden mt-3 space-y-1">
                            <div className="flex flex-wrap gap-1">
                                {team.drivers.map(d => (
                                    <span key={d.name} className="text-xs bg-neutral-900 px-2 py-1 rounded text-gray-300">{d.name.split(' ').pop().substring(0,3).toUpperCase()}</span>
                                ))}
                            </div>
                        </div>
                      </td>

                      {/* 3. LINEUP (Desktop) */}
                      <td className="p-5 hidden md:table-cell align-top">
                        <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                            <div>
                                <h4 className="text-[10px] uppercase text-gray-500 font-bold mb-1">Drivers</h4>
                                <div className="flex flex-wrap gap-2">
                                    {team.drivers.length > 0 ? team.drivers.map((d) => (
                                        <div key={d.name} className="text-xs bg-neutral-900 border border-neutral-700 px-2 py-1 rounded text-gray-200" title={d.name}>
                                            {/* Extract Last Name (e.g. Hamilton -> HAM) */}
                                            {d.name.split(' ').pop().substring(0,3).toUpperCase()}
                                        </div>
                                    )) : <span className="text-xs text-gray-600 italic">Drafting...</span>}
                                </div>
                            </div>
                            <div>
                                <h4 className="text-[10px] uppercase text-gray-500 font-bold mb-1">Constructor</h4>
                                {team.constructor ? (
                                    <span className="text-xs font-bold text-f1-red">{team.constructor.name}</span>
                                ) : (
                                    <span className="text-xs text-gray-600 italic">-</span>
                                )}
                            </div>
                        </div>
                      </td>

                      {/* 4. POINTS */}
                      <td className="p-5 text-right">
                        <span className="text-2xl font-mono font-bold text-white tracking-tighter">{team.total_points}</span>
                        <span className="text-xs text-gray-500 block">PTS</span>
                      </td>

                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  )
}

export default League