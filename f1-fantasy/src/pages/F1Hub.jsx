import { useEffect, useState } from 'react'
import { supabase } from '../App'
import { getRaceColors, getTeamColors } from '../utils/colors'
import { motion, AnimatePresence } from 'framer-motion'

const F1Hub = () => {
  const [races, setRaces] = useState([])
  const [driversStandings, setDriversStandings] = useState([])
  const [constructorsStandings, setConstructorsStandings] = useState([])
  const [expandedRaceId, setExpandedRaceId] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchSeasonData()
  }, [])

  const fetchSeasonData = async () => {
    setLoading(true)

    // 1. Fetch Completed Races (Simulating "20 races in")
    // In a real app, filtering by date < now is good practice
    const { data: raceData } = await supabase
      .from('races')
      .select('*')
      .order('date', { ascending: false }) // Newest first is usually better for "Hubs"
    
    setRaces(raceData || [])

    // 2. Fetch Top 5 Drivers
    const { data: wdc } = await supabase
      .from('driver_stats_view')
      .select('driver_id, total_real_points, drivers(name, constructors(name))')
      .order('total_real_points', { ascending: false })
      .limit(5)

    // 3. Fetch Top 5 Constructors
    const { data: wcc } = await supabase
      .from('constructor_stats_view')
      .select('constructor_id, total_real_points, constructors(name)')
      .order('total_real_points', { ascending: false })
      .limit(5)

    setDriversStandings(wdc || [])
    setConstructorsStandings(wcc || [])
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-neutral-900 text-white pb-20">
      
      {/* --- HEADER --- */}
      <div className="sticky top-0 z-30 bg-neutral-900/90 backdrop-blur-md border-b border-white/10 px-4 py-4 md:px-8 flex justify-between items-center">
        <h1 className="text-xl md:text-2xl font-black italic tracking-tighter">
          <span className="text-f1-red">F1</span> HUB <span className="text-gray-500 text-base font-normal not-italic ml-2">Season 2026</span>
        </h1>
      </div>

      <div className="max-w-7xl mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8">
        
        {/* --- LEFT COLUMN: RACE RESULTS (Main Content) --- */}
        <div className="lg:col-span-8 space-y-4 order-2 lg:order-1">
          <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500 mb-2">Race Calendar & Results</h2>
          
          {loading ? (
            <div className="text-center py-20 animate-pulse text-gray-500">Loading Season Data...</div>
          ) : (
            races.map((race) => (
              <RaceResultCard 
                key={race.id} 
                race={race} 
                isExpanded={expandedRaceId === race.id}
                onToggle={() => setExpandedRaceId(expandedRaceId === race.id ? null : race.id)}
              />
            ))
          )}
        </div>

        {/* --- RIGHT COLUMN: CHAMPIONSHIP (Sticky Sidebar) --- */}
        <div className="lg:col-span-4 order-1 lg:order-2 space-y-6">
          
          {/* MOBILE: HORIZONTAL SCROLL / DESKTOP: STACKED */}
          <div className="lg:sticky lg:top-24 space-y-6">
            
            {/* DRIVERS STANDINGS */}
            <div className="bg-neutral-800 rounded-xl border border-white/10 overflow-hidden">
              <div className="px-4 py-3 bg-neutral-950/50 border-b border-white/5 flex justify-between items-center">
                <span className="text-xs font-bold uppercase tracking-widest text-gray-400">Drivers Top 5</span>
                <span className="text-xs text-f1-red font-bold">WDC</span>
              </div>
              <div className="divide-y divide-white/5">
                {driversStandings.map((d, i) => {
                  const colors = getTeamColors(d.drivers?.constructors?.name)
                  return (
                    <div key={d.driver_id} className="p-3 flex items-center gap-3">
                      <div className="font-mono text-gray-500 w-4 text-center text-sm">{i + 1}</div>
                      <div className="w-1 h-8 rounded-full" style={{ background: colors.primary }} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold truncate">{d.drivers?.name}</div>
                        <div className="text-[10px] text-gray-500 truncate">{d.drivers?.constructors?.name}</div>
                      </div>
                      <div className="font-mono font-bold text-sm">{d.total_real_points}</div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* CONSTRUCTORS STANDINGS */}
            <div className="bg-neutral-800 rounded-xl border border-white/10 overflow-hidden">
              <div className="px-4 py-3 bg-neutral-950/50 border-b border-white/5 flex justify-between items-center">
                <span className="text-xs font-bold uppercase tracking-widest text-gray-400">Constructors Top 5</span>
                <span className="text-xs text-f1-red font-bold">WCC</span>
              </div>
              <div className="divide-y divide-white/5">
                {constructorsStandings.map((c, i) => {
                  const colors = getTeamColors(c.constructors?.name)
                  return (
                    <div key={c.constructor_id} className="p-3 flex items-center gap-3">
                      <div className="font-mono text-gray-500 w-4 text-center text-sm">{i + 1}</div>
                      <div className="w-1 h-8 rounded-full" style={{ background: colors.primary }} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold truncate">{c.constructors?.name}</div>
                      </div>
                      <div className="font-mono font-bold text-sm">{c.total_real_points}</div>
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

// --- SUB-COMPONENT: RACE RESULT CARD ---
const RaceResultCard = ({ race, isExpanded, onToggle }) => {
  const raceColors = getRaceColors(race.name)
  // State for the tabs inside the card
  const [activeSession, setActiveSession] = useState('race') // 'race', 'qualifying', 'sprint', 'fp1', etc.
  
  return (
    <div className="bg-neutral-800 rounded-xl border border-white/5 overflow-hidden transition-all duration-300 hover:border-white/20">
      
      {/* 1. COMPACT HEADER (Always Visible) */}
      <div 
        onClick={onToggle}
        className="relative cursor-pointer min-h-[100px] flex"
      >
        {/* Color Strip */}
        <div className="w-2 absolute top-0 bottom-0 left-0" style={{ background: `linear-gradient(to bottom, ${raceColors.primary}, ${raceColors.secondary})` }} />
        
        {/* Content */}
        <div className="flex-1 p-4 pl-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">Round {race.round} • {new Date(race.date).toLocaleDateString()}</div>
            <h3 className="text-xl md:text-2xl font-black italic">{race.name}</h3>
            <p className="text-sm text-gray-400">{race.circuit}</p>
          </div>
          
          <div className="flex items-center gap-4">
             {/* Use this space to show the WINNER if race is over */}
             {new Date(race.date) < new Date() && (
               <div className="text-right hidden md:block">
                 <div className="text-[10px] uppercase text-gray-500">Winner</div>
                 <div className="font-bold">Max Verstappen</div> 
                 {/* ^ In real app, pass winner as prop or fetch it */}
               </div>
             )}
             <div className={`transition-transform duration-300 text-gray-500 ${isExpanded ? 'rotate-180' : ''}`}>▼</div>
          </div>
        </div>
      </div>

      {/* 2. EXPANDED CONTENT (Session Results) */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-white/5 bg-neutral-900/50"
          >
            {/* Session Tabs */}
            <div className="flex overflow-x-auto p-2 gap-2 border-b border-white/5 no-scrollbar">
               {['Race', 'Qualifying', 'Sprint', 'FP3', 'FP2', 'FP1'].map(session => (
                 <button
                   key={session}
                   onClick={() => setActiveSession(session.toLowerCase())}
                   className={`
                     px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-colors
                     ${activeSession === session.toLowerCase() ? 'bg-white text-black' : 'bg-neutral-800 text-gray-400 hover:text-white'}
                   `}
                 >
                   {session}
                 </button>
               ))}
            </div>

            {/* Results Table Area */}
            <div className="p-4">
               <SessionResultsTable raceId={race.id} sessionType={activeSession} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// --- SUB-COMPONENT: SESSION TABLE (Fetches data on demand) ---
const SessionResultsTable = ({ raceId, sessionType }) => {
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Mock Fetch - Replace with real Supabase query filtering by 'raceId' AND 'sessionType'
    const fetchResults = async () => {
      setLoading(true)
      // Simulate delay
      await new Promise(r => setTimeout(r, 500)) 
      
      // In reality: 
      // const { data } = await supabase.from('race_results').select(...).eq('race_id', raceId).eq('session', sessionType)
      
      // Mock Data
      setResults(Array.from({ length: 10 }).map((_, i) => ({
        pos: i + 1,
        driver: ['Verstappen', 'Norris', 'Leclerc', 'Piastri', 'Hamilton', 'Russell', 'Sainz', 'Alonso', 'Gasly', 'Tsunoda'][i],
        team: ['Red Bull', 'McLaren', 'Ferrari', 'McLaren', 'Ferrari', 'Mercedes', 'Williams', 'Aston Martin', 'Alpine', 'RB'][i],
        time: i === 0 ? '1:24:30.123' : `+${(i * 2.5).toFixed(3)}s`
      })))
      setLoading(false)
    }

    fetchResults()
  }, [raceId, sessionType])

  if (loading) return <div className="py-8 text-center text-xs text-gray-500 animate-pulse">Fetching {sessionType} data...</div>

  return (
    <table className="w-full text-sm">
      <thead className="text-xs text-gray-500 uppercase font-bold border-b border-white/10">
        <tr>
          <th className="text-left py-2 px-2 w-10">Pos</th>
          <th className="text-left py-2 px-2">Driver</th>
          <th className="text-right py-2 px-2">Time/Gap</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-white/5">
        {results.map((r) => {
           const colors = getTeamColors(r.team)
           return (
            <tr key={r.pos} className="hover:bg-white/5 transition">
              <td className="py-2 px-2 font-mono text-gray-400">{r.pos}</td>
              <td className="py-2 px-2">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-3 rounded-full" style={{ background: colors.primary }}></div>
                  <span className="font-bold">{r.driver}</span>
                  <span className="hidden md:inline text-[10px] text-gray-500 uppercase ml-1">{r.team}</span>
                </div>
              </td>
              <td className="py-2 px-2 text-right font-mono text-gray-300">{r.time}</td>
            </tr>
           )
        })}
      </tbody>
    </table>
  )
}

export default F1Hub