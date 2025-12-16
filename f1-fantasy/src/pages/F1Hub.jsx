import { useEffect, useState } from 'react'
import { supabase } from '../App'
import { getRaceColors, getTeamColors } from '../utils/colors'
import { formatToNYTime } from '../utils/date' // <--- IMPORT THIS
import { motion, AnimatePresence } from 'framer-motion'

const F1Hub = () => {
  const [selectedSeason, setSelectedSeason] = useState(2026)
  
  const [races, setRaces] = useState([])
  const [driversStandings, setDriversStandings] = useState([])
  const [constructorsStandings, setConstructorsStandings] = useState([])
  const [expandedRaceId, setExpandedRaceId] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchSeasonData()
  }, [selectedSeason])

  const fetchSeasonData = async () => {
    setLoading(true)
    setExpandedRaceId(null)

    // 1. Fetch Schedule
    const { data: raceData } = await supabase
      .from('races')
      .select('*')
      .eq('year', selectedSeason)
      .order('date', { ascending: true })
    
    if (!raceData || raceData.length === 0) {
        setRaces([])
        setDriversStandings([])
        setConstructorsStandings([])
        setLoading(false)
        return
    }

    setRaces(raceData)

    // 2. Fetch Results
    const raceIds = raceData.map(r => r.id)
    const { data: results } = await supabase
        .from('race_results')
        .select(`
            points,
            driver_id,
            constructor_id,
            drivers (id, name, code, constructors(name)),
            constructors (id, name)
        `)
        .in('race_id', raceIds)

    // 3. Calculate Standings
    const dMap = {}
    const cMap = {}

    results.forEach(r => {
        const dId = r.driver_id
        if (!dMap[dId]) {
            dMap[dId] = { 
                id: dId, 
                name: r.drivers?.name, 
                code: r.drivers?.code, 
                team: r.drivers?.constructors?.name, 
                points: 0 
            }
        }
        dMap[dId].points += (r.points || 0)

        const cId = r.constructor_id
        if (!cMap[cId]) {
            cMap[cId] = { 
                id: cId, 
                name: r.constructors?.name, 
                points: 0 
            }
        }
        cMap[cId].points += (r.points || 0)
    })

    const sortedDrivers = Object.values(dMap).sort((a,b) => b.points - a.points).slice(0, 5)
    const sortedConstructors = Object.values(cMap).sort((a,b) => b.points - a.points).slice(0, 5)

    setDriversStandings(sortedDrivers)
    setConstructorsStandings(sortedConstructors)
    setLoading(false)
  }

  // Auto-scroll
  useEffect(() => {
    if (!loading && races.length > 0) {
      // Logic: Find first race in the future
      const nextRace = races.find(r => {
          const { raw } = formatToNYTime(r.date, r.time)
          return raw > new Date()
      })
      const targetId = nextRace ? nextRace.id : races[races.length - 1].id
      
      const element = document.getElementById(`race-${targetId}`)
      if (element) element.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [loading, races])

  return (
    <div className="min-h-screen bg-neutral-900 text-white pb-24">
      
      {/* --- HEADER --- */}
      <div className="sticky top-0 z-30 bg-neutral-900/90 backdrop-blur-md border-b border-white/10 px-4 py-4 md:px-8 flex flex-row justify-between items-center shadow-2xl">
        <h1 className="text-xl md:text-2xl font-black italic tracking-tighter flex items-center gap-2">
          <span className="text-f1-red">F1</span> HUB
        </h1>

        {/* YEAR SELECTOR */}
        <div className="relative">
            <select 
                value={selectedSeason}
                onChange={(e) => setSelectedSeason(parseInt(e.target.value))}
                className="appearance-none bg-neutral-800 border border-white/20 text-white font-bold py-2 pl-4 pr-10 rounded-lg focus:outline-none focus:border-f1-red cursor-pointer hover:bg-neutral-700 transition"
            >
                <option value={2026}>2026 Season</option>
                <option value={2025}>2025 Season</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-white">
                <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
            </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8">
        
        {/* --- LEFT COLUMN: RACE CALENDAR & RESULTS --- */}
        <div className="lg:col-span-8 space-y-4 order-2 lg:order-1">
          {loading ? (
            <div className="text-center py-20 animate-pulse text-gray-500">Loading {selectedSeason} Data...</div>
          ) : races.length === 0 ? (
             <div className="text-center py-20 text-gray-500">No data available for {selectedSeason} yet.</div> 
          ) : (
            races.map((race) => {
               // 1. USE THE UTILITY TO GET NY TIME & CHECK FUTURE STATUS
               const ny = formatToNYTime(race.date, race.time)
               const isFuture = ny.raw > new Date()

               return (
                <RaceCard 
                  key={race.id} 
                  race={race} 
                  ny={ny} // Pass the NY object down
                  isFuture={isFuture}
                  isExpanded={expandedRaceId === race.id}
                  onToggle={() => setExpandedRaceId(expandedRaceId === race.id ? null : race.id)}
                />
               )
            })
          )}
        </div>

        {/* --- RIGHT COLUMN: CHAMPIONSHIP SIDEBAR --- */}
        <div className="lg:col-span-4 order-1 lg:order-2 space-y-6">
          <div className="lg:sticky lg:top-24 space-y-6">
            
            {/* WDC PANEL */}
            <div className="bg-neutral-800/50 backdrop-blur-md rounded-xl border border-white/10 overflow-hidden shadow-lg">
              <div className="px-4 py-3 bg-white/5 border-b border-white/5 flex justify-between items-center">
                <span className="text-xs font-bold uppercase tracking-widest text-gray-400">Driver Standings</span>
                <span className="text-xs text-f1-red font-bold">{selectedSeason}</span>
              </div>
              <div className="divide-y divide-white/5">
                {driversStandings.length === 0 && <div className="p-4 text-xs text-gray-500 text-center">No points scored yet.</div>}
                {driversStandings.map((d, i) => {
                  const colors = getTeamColors(d.team)
                  return (
                    <div key={d.id} className="p-3 flex items-center gap-3 hover:bg-white/5 transition">
                      <div className={`font-mono w-6 text-center text-sm font-bold ${i===0 ? 'text-yellow-400' : 'text-gray-500'}`}>{i + 1}</div>
                      <div className="w-1 h-8 rounded-full shadow-[0_0_10px_rgba(0,0,0,0.5)]" style={{ background: colors.primary }} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold truncate flex items-center gap-2">
                            {d.name}
                            <span className="text-[10px] text-gray-500 font-mono bg-neutral-900 px-1 rounded">{d.code}</span>
                        </div>
                        <div className="text-[10px] text-gray-400 truncate">{d.team}</div>
                      </div>
                      <div className="font-mono font-bold text-sm bg-neutral-950 px-2 py-1 rounded text-green-400">{d.points}</div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* WCC PANEL */}
            <div className="bg-neutral-800/50 backdrop-blur-md rounded-xl border border-white/10 overflow-hidden shadow-lg">
              <div className="px-4 py-3 bg-white/5 border-b border-white/5 flex justify-between items-center">
                <span className="text-xs font-bold uppercase tracking-widest text-gray-400">Constructors</span>
                <span className="text-xs text-f1-red font-bold">{selectedSeason}</span>
              </div>
              <div className="divide-y divide-white/5">
                {constructorsStandings.length === 0 && <div className="p-4 text-xs text-gray-500 text-center">No points scored yet.</div>}
                {constructorsStandings.map((c, i) => {
                  const colors = getTeamColors(c.name)
                  return (
                    <div key={c.id} className="p-3 flex items-center gap-3 hover:bg-white/5 transition">
                      <div className={`font-mono w-6 text-center text-sm font-bold ${i===0 ? 'text-yellow-400' : 'text-gray-500'}`}>{i + 1}</div>
                      <div className="w-1 h-8 rounded-full shadow-[0_0_10px_rgba(0,0,0,0.5)]" style={{ background: colors.primary }} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold truncate">{c.name}</div>
                      </div>
                      <div className="font-mono font-bold text-sm bg-neutral-950 px-2 py-1 rounded text-green-400">{c.points}</div>
                    </div>
                  )
                })}
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  )
}

// --- SUB-COMPONENT: RACE CARD ---
const RaceCard = ({ race, ny, isFuture, isExpanded, onToggle }) => {
  const raceColors = getRaceColors(race.name)
  const [activeSession, setActiveSession] = useState('race')

  return (
    <div 
        id={`race-${race.id}`}
        className={`rounded-xl border overflow-hidden transition-all duration-300 relative group
        ${isFuture 
            ? 'bg-neutral-800/30 border-white/5 opacity-80 hover:opacity-100' 
            : 'bg-neutral-800 border-white/10 hover:border-white/30 shadow-lg'}`}
    >
      <div 
        onClick={!isFuture ? onToggle : undefined}
        className={`relative min-h-[100px] flex ${!isFuture ? 'cursor-pointer' : 'cursor-default'}`}
      >
        <div className="w-2 absolute top-0 bottom-0 left-0 transition-all duration-300 group-hover:w-3" style={{ background: `linear-gradient(to bottom, ${raceColors.primary}, ${raceColors.secondary})` }} />
        
        <div className="flex-1 p-4 pl-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
                <div className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Round {race.round}</div>
                {isFuture && <div className="text-[10px] font-bold uppercase bg-blue-900 text-blue-200 px-1.5 rounded">Upcoming</div>}
            </div>
            <h3 className="text-xl md:text-2xl font-black italic text-white/90">{race.name}</h3>
            <div className="flex items-center gap-2 text-sm text-gray-400 mt-1">
                {/* 2. DISPLAY NY DATE */}
                <span>{ny.date}</span>
                <span>•</span>
                <span>{race.circuit}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
             {isFuture ? (
                 <div className="text-right bg-black/20 p-2 rounded-lg border border-white/5">
                    <div className="text-[10px] uppercase text-gray-500 font-bold">Lights Out (ET)</div>
                    {/* 3. DISPLAY NY TIME */}
                    <div className="font-mono font-bold text-lg text-yellow-400">{ny.time}</div>
                 </div>
             ) : (
                 <div className={`w-8 h-8 rounded-full bg-white/5 flex items-center justify-center transition-transform duration-300 ${isExpanded ? 'rotate-180 bg-white/20' : ''}`}>
                    <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
                 </div>
             )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && !isFuture && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-white/10 bg-black/20"
          >
            <div className="flex items-center gap-1 p-2 border-b border-white/5 overflow-x-auto">
               {['Race', 'Qualifying', 'Sprint'].map(session => (
                 <button
                   key={session}
                   onClick={() => setActiveSession(session.toLowerCase())}
                   className={`
                     px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors
                     ${activeSession === session.toLowerCase() ? 'bg-white text-black shadow-lg' : 'text-gray-500 hover:text-white hover:bg-white/5'}
                   `}
                 >
                   {session}
                 </button>
               ))}
            </div>

            <div className="p-0 md:p-4">
               <SessionResultsTable raceId={race.id} sessionType={activeSession} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// --- SUB-COMPONENT: SESSION TABLE ---
const SessionResultsTable = ({ raceId, sessionType }) => {
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchResults = async () => {
      setLoading(true)
      
      const { data } = await supabase
        .from('race_results')
        .select(`
            position, 
            points, 
            status,
            time:fastest_lap_time, 
            drivers (name, code),
            constructors (name)
        `) // <--- Pull constructors directly from the result
        .eq('race_id', raceId)
        .eq('session_type', sessionType) 
        .order('position', { ascending: true })
      
      setResults(data || [])
      setLoading(false)
    }

    fetchResults()
  }, [raceId, sessionType])

  if (loading) return <div className="py-8 text-center text-xs text-gray-500 animate-pulse">Loading {sessionType} results...</div>
  
  if (results.length === 0) return <div className="py-8 text-center text-xs text-gray-500 italic">No data available for {sessionType}.</div>

  return (
    <div className="overflow-x-auto">
        <table className="w-full text-sm">
        <thead className="text-[10px] text-gray-500 uppercase font-bold bg-white/5 border-b border-white/5">
            <tr>
            <th className="text-center py-2 px-2 w-10">Pos</th>
            <th className="text-left py-2 px-2">Driver</th>
            <th className="text-right py-2 px-2 hidden md:table-cell">Team</th>
            <th className="text-right py-2 px-2">
                {sessionType === 'qualifying' ? 'Time' : 'Pts'}
            </th>
            </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
            {results.map((r) => {
            // UPDATED: Use the direct constructor name
            const colors = getTeamColors(r.constructors?.name)
            
            return (
                <tr key={r.position} className="hover:bg-white/5 transition group">
                <td className={`py-3 px-2 text-center font-mono font-bold ${r.position === 1 ? 'text-yellow-400' : 'text-gray-400'}`}>
                    {r.position}
                </td>
                <td className="py-3 px-2">
                    <div className="flex items-center gap-3">
                        {/* The Color Strip */}
                        <div className="w-1 h-8 rounded-full shadow-[0_0_8px_rgba(255,255,255,0.1)]" style={{ background: colors.primary }}></div>
                        <div>
                            <div className="font-bold flex items-center gap-2">
                                {r.drivers?.name}
                                <span className="text-[10px] text-gray-600 font-mono hidden md:inline-block">{r.drivers?.code}</span>
                            </div>
                            {/* Mobile Team Name */}
                            <div className="text-[10px] text-gray-500 uppercase md:hidden">{r.constructors?.name}</div>
                        </div>
                    </div>
                </td>
                {/* Desktop Team Name */}
                <td className="py-3 px-2 text-right hidden md:table-cell text-gray-400 text-xs uppercase tracking-wider">{r.constructors?.name}</td>
                
                <td className="py-3 px-2 text-right font-mono font-bold">
                    {sessionType === 'qualifying' ? (
                        <span className="text-white">{r.time || 'No Time'}</span>
                    ) : (
                        <span className="text-green-400">+{r.points}</span>
                    )}
                </td>
                </tr>
            )
            })}
        </tbody>
        </table>
    </div>
  )
}
export default F1Hub