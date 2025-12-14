import { useEffect, useState } from 'react'
import { supabase } from '../App'

const F1Hub = () => {
  const [results, setResults] = useState([])
  const [nextRace, setNextRace] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)

    // 1. Get Next Race
    const today = new Date().toISOString()
    const { data: upcoming } = await supabase
      .from('races')
      .select('*')
      .gt('date', today)
      .order('date', { ascending: true })
      .limit(1)
      .single()

    if (upcoming) setNextRace(upcoming)

    // 2. Get Results with NESTED Join (Drivers -> Constructors)
    const { data: raceData, error } = await supabase
      .from('race_results')
      .select(`
        position,
        real_points,
        fantasy_points,
        is_dnf,
        is_fastest_lap,
        drivers!race_results_driver_id_fkey (
          name,
          constructors (name) 
        )
      `)
      .order('position', { ascending: true })

    if (error) {
      console.error("Error fetching results:", error)
    } else if (raceData) {
      setResults(raceData)
    }
    
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-neutral-900 text-white pb-20 md:pb-0">

      {/* --- HEADER IMAGE / NEXT RACE --- */}
      <div className="relative h-48 md:h-64 bg-neutral-800 overflow-hidden border-b border-neutral-700">
        <div className="absolute inset-0 bg-gradient-to-t from-neutral-900 to-transparent z-10"></div>
        {/* Placeholder Pattern Background */}
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(#444 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>

        <div className="absolute bottom-4 left-4 md:left-8 z-20">
          <h1 className="text-4xl md:text-5xl font-black italic tracking-tighter">
            F1 <span className="text-f1-red">HUB</span>
          </h1>
          {nextRace && (
            <p className="text-gray-400 font-bold uppercase tracking-widest text-xs md:text-sm mt-1">
              Next Up: {nextRace.name} • {new Date(nextRace.date).toLocaleDateString()}
            </p>
          )}
        </div>
      </div>

      {/* --- MAIN CONTENT --- */}
      <div className="max-w-4xl mx-auto p-4 md:p-8 -mt-12 relative z-30">

        {/* RACE RESULTS CARD */}
        <div className="bg-neutral-800 rounded-xl border border-neutral-700 shadow-2xl overflow-hidden">
          <div className="p-4 border-b border-neutral-700 flex justify-between items-center bg-neutral-850">
            <h2 className="font-bold text-lg md:text-xl">Latest Race Results</h2>
            <span className="bg-neutral-900 text-xs font-mono px-2 py-1 rounded text-gray-400"></span>
          </div>

          {loading ? (
            <div className="p-8 text-center text-gray-500 animate-pulse">Loading Telemetry...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-neutral-900/50 text-gray-500 text-xs uppercase tracking-wider">
                    <th className="p-3 text-center w-12">Pos</th>
                    <th className="p-3">Driver</th>
                    <th className="p-3 text-center hidden md:table-cell">Team</th>
                    <th className="p-3 text-center">FIA Pts</th>
                    <th className="p-3 text-center font-bold text-white bg-white/5">Fantasy</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {results.map((r, i) => (
                    <tr
                      key={i}
                      className={`
                        border-b border-neutral-700/50 hover:bg-neutral-700/30 transition
                        ${r.is_dnf ? 'opacity-50 grayscale' : ''}
                      `}
                    >
                      {/* POSITION */}
                      <td className="p-3 text-center font-mono font-bold">
                        {r.is_dnf ? (
                          <span className="text-red-500 text-xs">DNF</span>
                        ) : (
                          <span className={i < 3 ? 'text-f1-red text-lg' : 'text-gray-400'}>{r.position}</span>
                        )}
                      </td>

                      {/* DRIVER */}
                      <td className="p-3">
                        <div className="font-bold">{r.drivers.name}</div>
                        {/* Safe check for constructor name on Mobile */}
                        <div className="text-xs text-gray-500 md:hidden">
                           {r.drivers.constructors?.name || '-'}
                        </div>
                      </td>

                      {/* TEAM (Desktop) */}
                      <td className="p-3 text-center text-gray-400 hidden md:table-cell">
                        {/* Safe check for constructor name on Desktop */}
                        {r.drivers.constructors?.name || '-'}
                      </td>

                      {/* FIA POINTS */}
                      <td className="p-3 text-center font-mono text-gray-400">
                        {r.real_points > 0 ? r.real_points : '-'}
                      </td>

                      {/* FANTASY POINTS */}
                      <td className="p-3 text-center font-mono font-bold text-green-400 bg-white/5 text-lg">
                        {r.fantasy_points}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}

export default F1Hub