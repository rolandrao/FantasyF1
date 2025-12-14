import { useEffect, useState } from 'react'
import { supabase } from '../App'
import { getRaceColors, getTeamColors } from '../utils/colors'

const Home = () => {
  const [nextRace, setNextRace] = useState(null)
  const [schedule, setSchedule] = useState([])
  const [leagueStandings, setLeagueStandings] = useState([])
  const [wdc, setWdc] = useState([])
  const [wcc, setWcc] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAllData()
  }, [])

  const fetchAllData = async () => {
    setLoading(true)

    // --- 1. GET UPCOMING RACES ---
    const today = new Date().toISOString()
    const { data: raceData } = await supabase
      .from('races')
      .select('*')
      .gte('date', today)
      .order('date', { ascending: true })
      .limit(6)

    if (raceData && raceData.length > 0) {
        setNextRace(raceData[0])
        setSchedule(raceData.slice(1))
    }

    // --- 2. GET STATS (Real AND Fantasy) ---
    // Fetch both columns so we can use them for different panels
    
    // A. Driver Stats
    const { data: driverStats } = await supabase
      .from('driver_stats_view')
      .select('driver_id, total_real_points, total_fantasy_points')

    // B. Constructor Stats
    const { data: constructorStats } = await supabase
      .from('constructor_stats_view')
      .select('constructor_id, total_real_points, total_fantasy_points')

    // --- 3. GET MAPPING INFO (Names & Colors) ---
    const { data: allDrivers } = await supabase
      .from('drivers')
      .select('id, name, constructors (name)')
    
    const { data: allConstructors } = await supabase
      .from('constructors')
      .select('id, name')

    // --- 4. CALCULATE LEAGUE STANDINGS (*** FANTASY POINTS ***) ---
    const { data: teams } = await supabase
      .from('teams')
      .select('id, team_name, owner_name')
    
    const { data: picks } = await supabase
      .from('draft_picks')
      .select('team_id, driver_id, constructor_id')

    if (teams && picks && driverStats && constructorStats) {
        const calculatedStandings = teams.map(team => {
            // Find picks for this team
            const teamPicks = picks.filter(p => p.team_id === team.id)
            
            let totalFantasy = 0
            
            teamPicks.forEach(pick => {
                // Driver Fantasy Points
                if (pick.driver_id) {
                    const stat = driverStats.find(s => s.driver_id === pick.driver_id)
                    if (stat) totalFantasy += (stat.total_fantasy_points || 0)
                }
                // Constructor Fantasy Points
                if (pick.constructor_id) {
                    const stat = constructorStats.find(s => s.constructor_id === pick.constructor_id)
                    if (stat) totalFantasy += (stat.total_fantasy_points || 0)
                }
            })

            return { ...team, total_points: totalFantasy }
        })

        // Sort by Fantasy Points (High to Low)
        calculatedStandings.sort((a, b) => b.total_points - a.total_points)
        setLeagueStandings(calculatedStandings)
    }

    // --- 5. FORMAT REAL WORLD PANELS (*** REAL POINTS ***) ---
    
    // WDC: Driver Real Points
    if (driverStats && allDrivers) {
        const formattedWdc = driverStats
            .map(stat => {
                const driver = allDrivers.find(d => d.id === stat.driver_id)
                return {
                    id: stat.driver_id,
                    name: driver?.name || 'Unknown',
                    team: driver?.constructors?.name,
                    points: stat.total_real_points // <--- REAL POINTS
                }
            })
            .sort((a,b) => b.points - a.points)
            .slice(0, 10)
        setWdc(formattedWdc)
    }

    // WCC: Constructor Real Points
    if (constructorStats && allConstructors) {
        const formattedWcc = constructorStats
            .map(stat => {
                const constructor = allConstructors.find(c => c.id === stat.constructor_id)
                return {
                    id: stat.constructor_id,
                    name: constructor?.name || 'Unknown',
                    points: stat.total_real_points // <--- REAL POINTS
                }
            })
            .sort((a,b) => b.points - a.points)
            .slice(0, 10)
        setWcc(formattedWcc)
    }

    setLoading(false)
  }

  const getGradient = (colors, angle = '135deg') => {
    return `linear-gradient(${angle}, ${colors.primary} 0%, ${colors.secondary} 100%)`
  }

  if (loading) return <div className="min-h-screen bg-neutral-900 text-white flex items-center justify-center animate-pulse">Loading Dashboard...</div>

  // Podium Logic
  const first = leagueStandings[0]
  const second = leagueStandings[1]
  const third = leagueStandings[2]

  return (
    <div className="min-h-screen bg-neutral-900 text-white pb-12">
      
      {/* --- HERO BANNER (Next Race) --- */}
      {nextRace && (
        <div className="bg-neutral-800 border-b border-neutral-700 p-8 md:p-12 mb-8 relative overflow-hidden group">
            <div 
                className="absolute inset-0 opacity-10 group-hover:opacity-20 transition duration-500"
                style={{ background: getGradient(getRaceColors(nextRace.name)) }}
            ></div>

            <div className="max-w-7xl mx-auto relative z-10 flex flex-col md:flex-row justify-between items-center gap-6">
                <div className="text-center md:text-left">
                    <div className="text-sm font-bold text-red-500 tracking-widest uppercase mb-2">Next Grand Prix</div>
                    <h1 className="text-4xl md:text-6xl font-black italic tracking-tighter text-white drop-shadow-lg">{nextRace.name}</h1>
                    <p className="text-xl text-gray-300 mt-2 font-semibold">{nextRace.circuit}</p>
                </div>
                
                <div className="text-center md:text-right">
                    <div className="bg-white/10 backdrop-blur-md border border-white/20 px-6 py-3 rounded-lg">
                        <div className="text-xs text-gray-400 uppercase font-bold mb-1">Race Day</div>
                        <div className="text-2xl font-mono font-bold">
                            {new Date(nextRace.date).toLocaleDateString(undefined, { weekday: 'short', month: 'long', day: 'numeric' })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* --- MAIN GRID CONTENT --- */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 grid grid-cols-1 lg:grid-cols-4 gap-8">

        {/* --- SECTION 1: UPCOMING (Left) --- */}
        <div className="lg:col-span-1 space-y-4 order-3 lg:order-1">
          <h2 className="text-xl font-bold border-b border-neutral-700 pb-2 flex items-center gap-2">
            <span>📅</span> Schedule
          </h2>
          
          {schedule.length === 0 ? (
            <div className="text-gray-500 italic text-sm">Check back later for more races.</div>
          ) : (
            <div className="space-y-4">
              {schedule.map((race) => {
                const colors = getRaceColors(race.name)
                return (
                  <div 
                    key={race.id} 
                    className="relative overflow-hidden rounded-xl border border-neutral-700 bg-neutral-800 shadow-lg group hover:scale-[1.02] transition duration-200"
                  >
                    <div className="absolute left-0 top-0 bottom-0 w-2" style={{ background: getGradient(colors, 'to bottom') }}></div>
                    <div className="p-4 pl-6">
                      <div className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-1">
                        {new Date(race.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </div>
                      <div className="font-bold text-lg leading-tight mb-1">{race.name}</div>
                      <div className="text-xs text-gray-500">{race.circuit}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* --- SECTION 2: LEAGUE STANDINGS (Middle) --- */}
        <div className="lg:col-span-2 order-1 lg:order-2">
          <h2 className="text-xl font-bold border-b border-neutral-700 pb-2 flex items-center gap-2 mb-6">
            <span>🏆</span> League Standings
          </h2>

          {/* PODIUM */}
          {leagueStandings.length >= 3 && (
            <div className="flex justify-center items-end gap-2 md:gap-4 mb-10 h-48">
              {/* 2nd Place */}
              <div className="flex flex-col items-center w-1/3">
                <div className="text-center mb-2">
                  <div className="text-sm font-bold truncate w-full max-w-[80px] md:max-w-[100px]">{second.team_name}</div>
                  <div className="text-xs text-gray-400">{second.total_points} pts</div>
                </div>
                <div className="w-full bg-neutral-700 h-24 rounded-t-lg border-t-4 border-gray-400 flex items-center justify-center text-2xl font-black text-gray-400 shadow-xl">2</div>
              </div>

              {/* 1st Place */}
              <div className="flex flex-col items-center w-1/3 z-10">
                <div className="text-center mb-2">
                  <div className="text-xs text-yellow-500 font-bold mb-1">👑 LEADER</div>
                  <div className="text-lg font-black truncate w-full max-w-[100px] md:max-w-[140px]">{first.team_name}</div>
                  <div className="text-sm text-green-400 font-bold">{first.total_points} pts</div>
                </div>
                <div className="w-full bg-gradient-to-b from-yellow-600 to-yellow-800 h-32 rounded-t-lg border-t-4 border-yellow-400 flex items-center justify-center text-4xl font-black text-white shadow-xl shadow-yellow-900/20">1</div>
              </div>

              {/* 3rd Place */}
              <div className="flex flex-col items-center w-1/3">
                <div className="text-center mb-2">
                  <div className="text-sm font-bold truncate w-full max-w-[80px] md:max-w-[100px]">{third.team_name}</div>
                  <div className="text-xs text-gray-400">{third.total_points} pts</div>
                </div>
                <div className="w-full bg-neutral-800 h-16 rounded-t-lg border-t-4 border-amber-700 flex items-center justify-center text-2xl font-black text-amber-800 shadow-xl">3</div>
              </div>
            </div>
          )}

          {/* TABLE */}
          <div className="bg-neutral-800 rounded-xl border border-neutral-700 overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead className="bg-neutral-900 text-gray-500 uppercase text-xs">
                <tr>
                  <th className="px-4 py-3">Pos</th>
                  <th className="px-4 py-3">Team</th>
                  <th className="px-4 py-3 text-right">Points</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-700">
                {leagueStandings.map((team, index) => (
                  <tr key={team.id} className={`hover:bg-neutral-700/50 ${index < 3 ? 'bg-neutral-800/50 font-semibold' : ''}`}>
                    <td className="px-4 py-3 w-12 text-gray-500">{index + 1}</td>
                    <td className="px-4 py-3">
                      <div className="truncate max-w-[150px] md:max-w-none">{team.team_name}</div>
                      <div className="text-[10px] text-gray-500 uppercase">{team.owner_name}</div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-green-400">{team.total_points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* --- SECTION 3: REAL WORLD STATS (Right) --- */}
        <div className="lg:col-span-1 space-y-8 order-2 lg:order-3">
          
          {/* WDC PANEL */}
          <div className="bg-neutral-800 rounded-xl border border-neutral-700 overflow-hidden shadow-lg">
            <div className="bg-neutral-900 p-3 border-b border-neutral-700 flex justify-between items-center">
              <span className="font-bold text-sm text-gray-300">🏎️ Driver's Championship</span>
            </div>
            {/* If empty, show fallback message */}
            {wdc.length === 0 ? (
                <div className="p-4 text-xs text-gray-500 text-center">No driver data available.</div>
            ) : (
                <div className="divide-y divide-neutral-700">
                {wdc.map((driver, index) => {
                    const colors = getTeamColors(driver.team); // driver.team is set in our fetch logic now
                    return (
                    <div key={driver.id} className="p-3 flex items-center justify-between text-sm hover:bg-neutral-700/30">
                        <div className="flex items-center gap-3">
                        <span className={`font-mono w-4 text-center ${index === 0 ? 'text-yellow-400 font-bold' : 'text-gray-500'}`}>{index + 1}</span>
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: colors.primary }}></div>
                        <div className="truncate max-w-[100px]">{driver.name}</div>
                        </div>
                        <div className="font-bold">{driver.points}</div>
                    </div>
                    )
                })}
                </div>
            )}
          </div>

          {/* WCC PANEL */}
          <div className="bg-neutral-800 rounded-xl border border-neutral-700 overflow-hidden shadow-lg">
            <div className="bg-neutral-900 p-3 border-b border-neutral-700 flex justify-between items-center">
              <span className="font-bold text-sm text-gray-300">🔧 Constructor's Champ.</span>
            </div>
            {wcc.length === 0 ? (
                <div className="p-4 text-xs text-gray-500 text-center">No constructor data available.</div>
            ) : (
                <div className="divide-y divide-neutral-700">
                {wcc.map((constructor, index) => {
                    const colors = getTeamColors(constructor.name);
                    return (
                    <div key={constructor.id} className="p-3 flex items-center justify-between text-sm hover:bg-neutral-700/30">
                        <div className="flex items-center gap-3">
                        <span className={`font-mono w-4 text-center ${index === 0 ? 'text-yellow-400 font-bold' : 'text-gray-500'}`}>{index + 1}</span>
                        <div className="w-1 h-6 rounded-sm flex-shrink-0" style={{ background: getGradient(colors, 'to bottom') }}></div>
                        <div className="truncate max-w-[100px]">{constructor.name}</div>
                        </div>
                        <div className="font-bold">{constructor.points}</div>
                    </div>
                    )
                })}
                </div>
            )}
          </div>

        </div>

      </div>
    </div>
  )
}

export default Home