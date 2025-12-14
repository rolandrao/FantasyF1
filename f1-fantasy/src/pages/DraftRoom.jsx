import { useEffect, useState } from 'react'
import { supabase } from '../App'

const DraftRoom = () => {
  // --- STATE MANAGEMENT ---
  const [currentPick, setCurrentPick] = useState(null)
  const [upcomingPicks, setUpcomingPicks] = useState([])
  const [allRosters, setAllRosters] = useState([])
  const [myPicks, setMyPicks] = useState([]) 
  const [availableDrivers, setAvailableDrivers] = useState([])
  const [availableConstructors, setAvailableConstructors] = useState([])
  
  // User States
  const [myTeamId, setMyTeamId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState({ show: false, message: '', type: 'error' })

  // --- INITIAL LOAD & POLLING ---
  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: team } = await supabase.from('teams').select('id').eq('user_id', user.id).single()
        if (team) setMyTeamId(team.id)
      }
      refreshDraftState()
    }
    init()
    const interval = setInterval(refreshDraftState, 3000)
    return () => clearInterval(interval)
  }, [])

  // --- HELPER: TOAST ---
  const showToast = (message, type = 'error') => {
    setToast({ show: true, message, type })
    setTimeout(() => setToast({ ...toast, show: false }), 3000)
  }

  // --- HELPER: ABBREVIATION (e.g. "Max Verstappen" -> "VER") ---
  const getAbbr = (name) => {
    if (!name) return ''
    const parts = name.split(' ')
    const target = parts.length > 1 ? parts[parts.length - 1] : parts[0]
    return target.substring(0, 3).toUpperCase()
  }

  // --- CORE LOGIC: REFRESH STATE ---
  const refreshDraftState = async () => {
    const { data: picks } = await supabase
      .from('draft_picks')
      .select(`
        pick_number, driver_id, constructor_id, picked_at,
        teams (id, team_name, owner_name, is_bot),
        drivers (name), constructors (name)
      `)
      .order('pick_number', { ascending: true })

    if (!picks) return

    if (myTeamId) {
        const mine = picks.filter(p => p.teams.id === myTeamId && (p.driver_id || p.constructor_id))
        setMyPicks(mine)
    }

    // Process Rosters
    const rosterMap = {}
    picks.forEach(p => {
        const tId = p.teams.id
        if (!rosterMap[tId]) {
            rosterMap[tId] = { id: tId, owner: p.teams.owner_name, drivers: [], constructor: null }
        }
        if (p.drivers) rosterMap[tId].drivers.push(p.drivers.name)
        if (p.constructors) rosterMap[tId].constructor = p.constructors.name
    })
    setAllRosters(Object.values(rosterMap).sort((a, b) => a.owner.localeCompare(b.owner)))

    const nextUp = picks.find(p => !p.driver_id && !p.constructor_id)
    setCurrentPick(nextUp || null)

    if (nextUp) {
      const idx = picks.indexOf(nextUp)
      setUpcomingPicks(picks.slice(idx, idx + 6))
    } else {
      setUpcomingPicks([])
    }

    const takenDrivers = picks.map(p => p.driver_id).filter(Boolean)
    const takenConstructors = picks.map(p => p.constructor_id).filter(Boolean)

    const { data: drivers } = await supabase.from('drivers').select('*')
    const { data: constructors } = await supabase.from('constructors').select('*')

    setAvailableDrivers((drivers || []).filter(d => !takenDrivers.includes(d.id)))
    setAvailableConstructors((constructors || []).filter(c => !takenConstructors.includes(c.id)))
  }

  // --- ACTIONS ---
  const handleDraft = async (item, type) => {
    if (!currentPick || currentPick.teams.id !== myTeamId) return showToast("Not your turn!", "error")
    
    // Validate limits
    const driverCount = myPicks.filter(p => p.driver_id).length
    const constructorCount = myPicks.filter(p => p.constructor_id).length
    if (type === 'driver' && driverCount >= 3) return showToast("Max 3 Drivers!", "error")
    if (type === 'constructor' && constructorCount >= 1) return showToast("Max 1 Constructor!", "error")

    // eslint-disable-next-line no-restricted-globals
    if (!confirm(`Draft ${item.name}?`)) return
    submitPick(item.id, type)
  }

  const simulateBotPick = async () => {
    setLoading(true)
    const { data: botPicks } = await supabase.from('draft_picks').select('driver_id, constructor_id').eq('team_id', currentPick.teams.id)
    const dCount = botPicks.filter(p => p.driver_id).length
    const cCount = botPicks.filter(p => p.constructor_id).length

    let pickType = '', item = null
    if (dCount < 3 && availableDrivers.length > 0) { pickType = 'driver'; item = availableDrivers[0] }
    else if (cCount < 1 && availableConstructors.length > 0) { pickType = 'constructor'; item = availableConstructors[0] }

    if (!item) { showToast("No moves left!", "error"); setLoading(false); return }
    await submitPick(item.id, pickType)
    setLoading(false)
  }

  const submitPick = async (itemId, type) => {
    setLoading(true)
    const col = type === 'driver' ? 'driver_id' : 'constructor_id'
    const { error } = await supabase.from('draft_picks').update({ [col]: itemId, picked_at: new Date() }).eq('pick_number', currentPick.pick_number)
    if (!error) { showToast("Pick Confirmed!", "success"); await refreshDraftState() }
    setLoading(false)
  }

  const isMyTurn = currentPick && myTeamId && currentPick.teams.id === myTeamId
  const isBotTurn = currentPick && currentPick.teams.is_bot

  return (
    <div className="min-h-screen bg-neutral-900 text-white p-4 md:p-6 relative">
      {/* TOAST */}
      {toast.show && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 px-4 py-3 rounded-lg z-[100] font-bold text-white animate-bounce ${toast.type === 'error' ? 'bg-red-600' : 'bg-green-600'}`}>
          {toast.message}
        </div>
      )}

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* --- LEFT SIDEBAR --- */}
        <div className="lg:col-span-1 space-y-4 md:space-y-6">
          <div className="lg:sticky lg:top-24 space-y-4 md:space-y-6"> 
              
              {/* 1. ON THE CLOCK */}
              <div className={`p-4 rounded-xl border-4 ${isMyTurn ? 'border-green-500 bg-green-900/20' : 'border-neutral-700 bg-neutral-800'}`}>
                <div className="flex justify-between items-center lg:block">
                    <div>
                        <h2 className="text-xs uppercase text-gray-400 font-bold mb-1">On The Clock</h2>
                        {currentPick ? (
                          <div>
                            <div className="text-3xl font-bold">#{currentPick.pick_number}</div>
                            <div className="text-lg text-f1-red font-bold truncate">{currentPick.teams.owner_name}</div>
                          </div>
                        ) : <div className="text-xl font-bold text-green-500">COMPLETE</div>}
                    </div>
                    <div>
                        {isMyTurn && <div className="bg-green-600 px-3 py-1 rounded font-bold animate-pulse text-xs">YOUR TURN</div>}
                        {isBotTurn && <button onClick={simulateBotPick} disabled={loading} className="bg-blue-600 px-3 py-1 rounded font-bold text-xs shadow-lg">Force Bot</button>}
                    </div>
                </div>
              </div>

              {/* 2. LEAGUE ROSTERS (VISIBLE ON MOBILE NOW) */}
              <div className="bg-neutral-800 p-3 rounded-xl border border-neutral-700 shadow-inner">
                <h3 className="text-xs font-bold text-gray-400 mb-2 border-b border-neutral-700 pb-2">League Rosters</h3>
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                  {allRosters.map(team => (
                    <div key={team.id} className="bg-neutral-900/40 p-2 rounded border border-neutral-800">
                        {/* Owner Name */}
                        <div className="flex justify-between items-baseline mb-1">
                            <span className={`font-bold text-xs truncate ${team.id === myTeamId ? 'text-white' : 'text-gray-400'}`}>
                                {team.owner}
                            </span>
                        </div>
                        
                        {/* The Grid: 3 Drivers + 1 Constructor */}
                        <div className="flex gap-1">
                            {/* Drivers (Red Borders) */}
                            {[0, 1, 2].map(i => (
                                <div key={`d-${i}`} className="flex-1 h-6 flex items-center justify-center bg-neutral-800 border-b-2 border-f1-red rounded-t text-[10px] font-mono font-bold text-white tracking-wider">
                                    {team.drivers[i] ? getAbbr(team.drivers[i]) : ''}
                                </div>
                            ))}
                            
                            {/* Constructor (Blue Border) - Slightly Wider */}
                            <div className="flex-[1.2] h-6 flex items-center justify-center bg-neutral-800 border-b-2 border-blue-500 rounded-t text-[10px] font-mono font-bold text-blue-200 tracking-wider">
                                {team.constructor ? getAbbr(team.constructor) : ''}
                            </div>
                        </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 3. UPCOMING PICKS */}
              <div className="bg-neutral-800 p-3 rounded-xl border border-neutral-700">
                <h3 className="text-xs font-bold text-gray-400 mb-2 border-b border-neutral-700 pb-2">Coming Up</h3>
                <div className="space-y-1 max-h-[150px] overflow-y-auto">
                  {upcomingPicks.map((p) => (
                    <div key={p.pick_number} className={`flex justify-between text-xs p-1 px-2 rounded ${p.pick_number === currentPick?.pick_number ? 'bg-neutral-700 font-bold text-white' : 'text-gray-500'}`}>
                      <span>#{p.pick_number}</span>
                      <span className="truncate">{p.teams.owner_name}</span>
                    </div>
                  ))}
                </div>
              </div>
          </div>
        </div>

        {/* --- RIGHT CONTENT: MARKET --- */}
        <div className="lg:col-span-3 space-y-6 pb-20 md:pb-0">
            {/* Drivers */}
            <div>
                <div className="flex items-center gap-2 mb-2 sticky top-0 bg-neutral-900 py-2 z-10 border-b border-neutral-800">
                    <span className="text-xl">🏎️</span>
                    <h2 className="text-xl font-bold">Drivers</h2>
                    <span className="bg-neutral-800 text-gray-400 text-xs px-2 py-1 rounded-full">{availableDrivers.length}</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    {availableDrivers.map((item) => (
                        <button key={item.id} disabled={!isMyTurn || loading} onClick={() => handleDraft(item, 'driver')} className={`flex items-center justify-between p-3 rounded border text-left ${!isMyTurn ? 'bg-neutral-800 border-neutral-700 opacity-50' : 'bg-neutral-800 border-neutral-600 hover:border-red-600 hover:bg-neutral-750'}`}>
                            <div><div className="font-bold text-sm text-white">{item.name}</div><div className="text-xs text-gray-400">{item.team}</div></div>
                            {isMyTurn && <div className="text-f1-red font-bold">➜</div>}
                        </button>
                    ))}
                </div>
            </div>
            {/* Constructors */}
            <div>
                <div className="flex items-center gap-2 mb-2 sticky top-0 bg-neutral-900 py-2 z-10 border-b border-neutral-800">
                    <span className="text-xl">🔧</span>
                    <h2 className="text-xl font-bold">Constructors</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    {availableConstructors.map((item) => (
                        <button key={item.id} disabled={!isMyTurn || loading} onClick={() => handleDraft(item, 'constructor')} className={`flex items-center justify-between p-3 rounded border text-left ${!isMyTurn ? 'bg-neutral-800 border-neutral-700 opacity-50' : 'bg-neutral-800 border-neutral-600 hover:border-blue-500 hover:bg-neutral-750'}`}>
                            <div><div className="font-bold text-sm text-white">{item.name}</div><div className="text-xs text-gray-400">Team</div></div>
                            {isMyTurn && <div className="text-blue-500 font-bold">➜</div>}
                        </button>
                    ))}
                </div>
            </div>
        </div>
      </div>
    </div>
  )
}
export default DraftRoom