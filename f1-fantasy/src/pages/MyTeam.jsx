import { useEffect, useState } from 'react'
import { supabase } from '../App'
import { getTeamColors, getRaceColors } from '../utils/colors.js' 

const MyTeam = () => {
  const [team, setTeam] = useState(null)
  const [roster, setRoster] = useState([])
  const [recaps, setRecaps] = useState([])
  const [loading, setLoading] = useState(true)
  
  // --- EDIT NAME STATE ---
  const [isEditing, setIsEditing] = useState(false)
  const [newName, setNewName] = useState('')
  const [renameLoading, setRenameLoading] = useState(false)

  // --- MODAL STATE ---
  const [modalType, setModalType] = useState(null)
  const [selectedItem, setSelectedItem] = useState(null)
  const [modalData, setModalData] = useState(null)
  const [modalLoading, setModalLoading] = useState(false)

  useEffect(() => {
    fetchMyTeam()
  }, [])

  const fetchMyTeam = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    
    if (user) {
      const { data: myTeam } = await supabase.from('teams').select('*').eq('user_id', user.id).single()
      
      if (myTeam) {
        setTeam(myTeam)
        setNewName(myTeam.team_name)

        // UPDATED: Fetch 'team' column from drivers
        const { data: picks } = await supabase
            .from('draft_picks')
            .select(`
                pick_number, driver_id, constructor_id,
                drivers!draft_picks_driver_id_fkey (id, name, team, constructors (name)),
                constructors!draft_picks_constructor_id_fkey (id, name)
            `)
            .eq('team_id', myTeam.id)
            .order('pick_number', { ascending: true })
        setRoster(picks || [])

        // NOTE: Ensure you have a view or table for 'team_race_recaps' 
        const { data: recapData } = await supabase
            .from('team_race_recaps')
            .select('*')
            .eq('team_id', myTeam.id)
            .order('race_date', { ascending: false })
        setRecaps(recapData || [])
      }
    }
    setLoading(false)
  }

  const handleRename = async () => {
    if (!newName.trim() || newName === team.team_name) { setIsEditing(false); return }
    setRenameLoading(true)
    const { error } = await supabase.from('teams').update({ team_name: newName }).eq('id', team.id)
    if (!error) { setTeam({ ...team, team_name: newName }); setIsEditing(false) } 
    setRenameLoading(false)
  }

  // --- STATS MODAL ---
  const openStatsModal = async (pick, type) => {
    setModalType('stats')
    setSelectedItem({ ...pick, type })
    setModalLoading(true)
    setModalData(null)

    let data, error;
    if (type === 'driver') {
        const res = await supabase.from('driver_stats_view').select('*').eq('driver_id', pick.driver_id).single()
        data = res.data; error = res.error;
    } else {
        const res = await supabase.from('constructor_stats_view').select('*').eq('constructor_id', pick.constructor_id).single()
        data = res.data; error = res.error;
    }

    setModalData(data || { total_fantasy_points: 0, total_real_points: 0, best_finish: '-', dnf_count: 0 })
    setModalLoading(false)
  }

  // --- RECAP MODAL ---
  const openRecapModal = async (race) => {
    setModalType('recap')
    setSelectedItem(race)
    setModalLoading(true)
    setModalData(null)

    const driverIds = roster.filter(p => p.driver_id).map(p => p.driver_id)
    
    const { data: driverRes } = await supabase
        .from('race_results')
        .select('points, position, session_type, drivers!race_results_driver_id_fkey(name)')
        .eq('race_id', race.race_id)
        .in('driver_id', driverIds)
        .order('session_type', { ascending: false }) 

    const constructorId = roster.find(p => p.constructor_id)?.constructor_id
    let constructorRes = []
    let constructorName = ''
    
    if (constructorId) {
        const cPick = roster.find(p => p.constructor_id)
        constructorName = cPick?.constructors?.name
        
        const { data: cDrivers } = await supabase.from('drivers').select('id').eq('constructor_id', constructorId)
        
        if (cDrivers && cDrivers.length > 0) {
            const cDriverIds = cDrivers.map(d => d.id)
            const { data: cRes } = await supabase
                .from('race_results')
                .select('points, position, session_type, drivers!race_results_driver_id_fkey(name)')
                .eq('race_id', race.race_id)
                .in('driver_id', cDriverIds)
            constructorRes = cRes || []
        }
    }

    setModalData({ drivers: driverRes || [], constructor: constructorRes, constructorName })
    setModalLoading(false)
  }

  const closeModal = () => {
    setModalType(null)
    setSelectedItem(null)
    setModalData(null)
  }

  // --- HELPER: CONSTRUCT GRADIENT STRING ---
  const constructGradient = (colors) => {
    if (!colors) return 'linear-gradient(135deg, #333 0%, #000 100%)'
    return `linear-gradient(135deg, ${colors.primary} 0%, ${colors.secondary} 100%)`;
  }

  // --- DETERMINE HEADER GRADIENT ---
  const getHeaderStyle = () => {
    if (!selectedItem) return { background: '#333' };

    let colors;
    if (modalType === 'recap') {
        colors = getRaceColors(selectedItem.race_name);
    } else if (modalType === 'stats') {
        // UPDATED: Use the 'team' property directly from the driver
        const teamName = selectedItem.type === 'driver' 
            ? (selectedItem.drivers.team || selectedItem.drivers.constructors?.name)
            : selectedItem.constructors.name;
        colors = getTeamColors(teamName);
    } else {
        colors = { primary: '#333', secondary: '#000' };
    }

    return { background: constructGradient(colors) };
  }

  if (loading) return <div className="text-white p-10 text-center animate-pulse">Loading Team HQ...</div>
  if (!team) return <div className="text-white p-10 text-center">You don't have a team yet. Go to the Draft Room!</div>

  const drivers = roster.filter(p => p.driver_id)
  const constructorPick = roster.find(p => p.constructor_id)

  return (
    <div className="min-h-screen bg-neutral-900 text-white pb-24 md:pb-10 relative">
      
      {/* --- SHARED MODAL --- */}
      {modalType && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={closeModal}>
            <div className="bg-neutral-800 w-full max-w-md rounded-2xl border border-neutral-600 shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
                
                <button onClick={closeModal} className="absolute top-4 right-4 text-white/80 hover:text-white z-10 text-xl font-bold bg-black/20 rounded-full w-8 h-8 flex items-center justify-center">✕</button>

                {/* --- CONTENT A: STATS MODAL --- */}
                {modalType === 'stats' && (
                    <>
                        <div 
                          className="p-6 text-center border-b border-neutral-700 relative"
                          style={getHeaderStyle()}
                        >
                            <div className="text-4xl mb-2 drop-shadow-md">{selectedItem.type === 'driver' ? '🏎️' : '🔧'}</div>
                            <h2 className="text-2xl font-black italic drop-shadow-md">{selectedItem.type === 'driver' ? selectedItem.drivers.name : selectedItem.constructors.name}</h2>
                            <p className="text-white/90 font-bold uppercase tracking-widest text-xs drop-shadow-sm">Season Stats</p>
                        </div>
                        <div className="p-6 grid grid-cols-2 gap-4">
                            {modalLoading ? <div className="col-span-2 text-center text-gray-500 animate-pulse">Loading...</div> : (
                                <>
                                    <div className="bg-neutral-700/50 p-3 rounded text-center border border-neutral-600">
                                        <div className="text-xs text-gray-400">TOTAL PTS</div>
                                        <div className="text-2xl font-black text-green-400">{modalData.total_fantasy_points || modalData.total_real_points}</div>
                                    </div>
                                    <div className="bg-neutral-700/50 p-3 rounded text-center border border-neutral-600">
                                        <div className="text-xs text-gray-400">REAL PTS</div>
                                        <div className="text-2xl font-black text-white">{modalData.total_real_points}</div>
                                    </div>
                                    <div className="bg-neutral-700/50 p-3 rounded text-center border border-neutral-600">
                                        <div className="text-xs text-gray-400">BEST</div>
                                        <div className="text-2xl font-bold text-yellow-500">P{modalData.best_finish}</div>
                                    </div>
                                    <div className="bg-neutral-700/50 p-3 rounded text-center border border-neutral-600">
                                        <div className="text-xs text-gray-400">{selectedItem.type === 'driver' ? 'DNFs' : 'RACES'}</div>
                                        <div className="text-2xl font-bold text-red-400">{selectedItem.type === 'driver' ? modalData.dnf_count : modalData.races_completed}</div>
                                    </div>
                                </>
                            )}
                        </div>
                    </>
                )}

                {/* --- CONTENT B: RECAP MODAL --- */}
                {modalType === 'recap' && (
                    <>
                        <div 
                          className="p-6 text-center border-b border-neutral-700"
                          style={getHeaderStyle()} 
                        >
                            <h2 className="text-2xl font-black italic drop-shadow-md">{selectedItem.race_name}</h2>
                            <p className="text-white font-bold text-lg drop-shadow-sm">{selectedItem.total_points} pts</p>
                        </div>
                        <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
                            {modalLoading ? <div className="text-center text-gray-500 animate-pulse">Loading Scorecard...</div> : (
                                <>
                                    <div>
                                        <h3 className="text-xs font-bold text-gray-400 mb-2 border-b border-neutral-700 pb-1">YOUR DRIVERS</h3>
                                        <div className="space-y-2">
                                            {modalData.drivers.map((d, i) => (
                                                <div key={i} className="flex justify-between items-center text-sm border-b border-white/5 pb-1">
                                                    <div>
                                                        <div className="font-bold">{d.drivers.name}</div>
                                                        <div className="flex gap-2 text-xs text-gray-500">
                                                            <span className="uppercase font-bold text-gray-400">{d.session_type}</span>
                                                            <span>P{d.position}</span>
                                                        </div>
                                                    </div>
                                                    <div className="font-mono font-bold text-green-400">+{d.points}</div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    {modalData.constructor && (
                                        <div>
                                            <h3 className="text-xs font-bold text-gray-400 mb-2 border-b border-neutral-700 pb-1 mt-4">YOUR CONSTRUCTOR</h3>
                                            <div className="bg-neutral-900/50 p-3 rounded border border-neutral-700">
                                                <div className="flex justify-between font-bold text-sm mb-2 text-blue-200">
                                                    <span>{modalData.constructorName}</span>
                                                    <span>{(modalData.constructor.reduce((sum, d) => sum + d.points, 0))} pts</span>
                                                </div>
                                                <div className="space-y-2 pl-2 border-l-2 border-blue-900">
                                                    {modalData.constructor.map((d, i) => (
                                                        <div key={i} className="flex justify-between text-xs text-gray-400">
                                                            <div>
                                                                <span className="text-gray-300">{d.drivers.name}</span>
                                                                <span className="mx-1 opacity-50">•</span>
                                                                <span className="uppercase text-[10px]">{d.session_type}</span>
                                                            </div>
                                                            <span>{d.points}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </>
                )}

            </div>
        </div>
      )}


      {/* --- PAGE HEADER --- */}
      <div className="bg-neutral-800 border-b border-neutral-700 p-6 md:p-10">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center md:items-start gap-4 md:gap-8 text-center md:text-left">
            <div className="w-20 h-20 md:w-24 md:h-24 rounded-full flex items-center justify-center text-3xl md:text-4xl shadow-xl border-4 border-neutral-700 bg-gradient-to-br from-f1-red to-red-900">🧢</div>
            <div className="flex-1">
                <p className="text-gray-400 font-bold uppercase tracking-widest text-xs mb-1">Team Principal: {team.owner_name}</p>
                {isEditing ? (
                    <div className="flex items-center gap-2 justify-center md:justify-start">
                        <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} className="bg-neutral-900 border border-neutral-600 text-2xl md:text-4xl font-black italic text-white px-3 py-1 rounded w-full md:w-auto" autoFocus />
                        <button onClick={handleRename} disabled={renameLoading} className="bg-green-600 hover:bg-green-500 p-2 rounded text-white">{renameLoading ? '...' : '✓'}</button>
                        <button onClick={() => { setIsEditing(false); setNewName(team.team_name) }} className="bg-neutral-600 hover:bg-neutral-500 p-2 rounded text-white">✕</button>
                    </div>
                ) : (
                    <div className="flex items-center gap-3 justify-center md:justify-start group">
                        <h1 className="text-3xl md:text-5xl font-black italic tracking-tighter">{team.team_name}</h1>
                        <button onClick={() => setIsEditing(true)} className="text-gray-500 hover:text-white transition opacity-100 md:opacity-0 md:group-hover:opacity-100">✏️</button>
                    </div>
                )}
                <p className="text-gray-500 text-sm mt-2">Season 2026 • Tier 1</p>
            </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-8">
        
        {/* DRIVERS */}
        <div>
            <h2 className="text-xl font-bold border-b border-neutral-700 pb-2 mb-4 flex items-center gap-2"><span>🏎️</span> Active Drivers</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {drivers.map((pick) => {
                    // UPDATED: Check 'team' first, then fallback to constructor name
                    const teamName = pick.drivers.team || pick.drivers.constructors?.name || 'Free Agent';
                    const colors = getTeamColors(teamName);
                    
                    return (
                        <div 
                            key={pick.pick_number} 
                            onClick={() => openStatsModal(pick, 'driver')} 
                            className="p-4 rounded-xl border border-neutral-700/30 relative overflow-hidden group hover:scale-[1.02] transition transform duration-200 cursor-pointer shadow-lg"
                            style={{ background: constructGradient(colors) }}
                        >
                            <div className="absolute top-0 right-0 bg-black/40 text-white/80 text-xs px-2 py-1 rounded-bl">Pick #{pick.pick_number}</div>
                            <div className="mt-2">
                                <div className="text-2xl font-bold">{pick.drivers.name}</div>
                                <div className="text-sm text-white/70">{teamName}</div>
                            </div>
                            <div className="mt-4 flex justify-between items-end">
                                <span className="text-xs text-white/60">View Stats</span>
                                <span className="text-white font-bold">➜</span>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>

        {/* CONSTRUCTOR */}
        <div>
            <h2 className="text-xl font-bold border-b border-neutral-700 pb-2 mb-4 flex items-center gap-2"><span>🔧</span> Constructor</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {constructorPick ? (
                    <div 
                        onClick={() => openStatsModal(constructorPick, 'constructor')} 
                        className="p-6 rounded-xl border border-neutral-700/30 relative overflow-hidden shadow-lg cursor-pointer hover:scale-[1.02] transition transform duration-200"
                        style={{ background: constructGradient(getTeamColors(constructorPick.constructors.name)) }}
                    >
                        <div className="absolute top-0 right-0 bg-black/40 text-white/80 text-xs px-3 py-1 rounded-bl font-bold">Constructor</div>
                        <div className="flex items-center gap-4">
                            <div className="text-4xl">🏁</div>
                            <div>
                                <div className="text-2xl font-black italic">{constructorPick.constructors.name}</div>
                                <div className="text-sm text-white/70">Click for Stats</div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="bg-neutral-800/50 border-2 border-dashed border-neutral-700 rounded-xl p-6 flex items-center justify-center text-gray-600 h-32">
                        <span className="text-sm font-bold">No Constructor Selected</span>
                    </div>
                )}
            </div>
        </div>

        {/* SEASON RECAP */}
        <div>
            <h2 className="text-xl font-bold border-b border-neutral-700 pb-2 mb-4 flex items-center gap-2">
                <span>📅</span> Season Recap
            </h2>
            <div className="bg-neutral-800 rounded-xl border border-neutral-700 overflow-hidden">
                {recaps.length === 0 ? (
                    <div className="p-6 text-center text-gray-500">No races completed yet.</div>
                ) : (
                    <div className="divide-y divide-neutral-700">
                        {recaps.map((race) => (
                            <div 
                                key={race.race_id} 
                                onClick={() => openRecapModal(race)}
                                className="p-4 flex justify-between items-center hover:bg-neutral-700/50 transition cursor-pointer group"
                            >
                                <div>
                                    <div className="font-bold text-lg">{race.race_name}</div>
                                    <div className="text-xs text-gray-500">{new Date(race.race_date).toLocaleDateString()}</div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="text-right">
                                        <div className="font-black text-xl text-green-400">{race.total_points}</div>
                                        <div className="text-[10px] text-gray-500 uppercase">Points</div>
                                    </div>
                                    <div className="text-gray-500 group-hover:text-white">➜</div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>

      </div>
    </div>
  )
}

export default MyTeam