import { useEffect, useState } from 'react'
import { supabase } from '../App'

const DraftRoom = () => {
  // --- STATE MANAGEMENT ---
  const [currentPick, setCurrentPick] = useState(null)
  const [upcomingPicks, setUpcomingPicks] = useState([])
  const [recentPicks, setRecentPicks] = useState([]) 
  const [myPicks, setMyPicks] = useState([]) 
  const [availableDrivers, setAvailableDrivers] = useState([])
  const [availableConstructors, setAvailableConstructors] = useState([])
  
  // User States
  const [myTeamId, setMyTeamId] = useState(null)
  const [loading, setLoading] = useState(false)
  
  // Custom Toast Notification State
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

  // --- HELPER: TOAST NOTIFICATION ---
  const showToast = (message, type = 'error') => {
    setToast({ show: true, message, type })
    setTimeout(() => setToast({ ...toast, show: false }), 3000)
  }

  // --- CORE LOGIC: REFRESH STATE ---
  const refreshDraftState = async () => {
    // 1. Fetch picks with joined data
    const { data: picks } = await supabase
      .from('draft_picks')
      .select(`
        pick_number, 
        driver_id, 
        constructor_id,
        picked_at,
        teams (id, team_name, owner_name, is_bot),
        drivers (name),
        constructors (name)
      `)
      .order('pick_number', { ascending: true })

    if (!picks) return

    // 2. Filter My Picks
    if (myTeamId) {
        const mine = picks.filter(p => p.teams.id === myTeamId && (p.driver_id || p.constructor_id))
        setMyPicks(mine)
    }

    // 3. Determine Current, Upcoming, Recent
    const nextUp = picks.find(p => !p.driver_id && !p.constructor_id)
    setCurrentPick(nextUp || null)

    if (nextUp) {
      const idx = picks.indexOf(nextUp)
      setUpcomingPicks(picks.slice(idx, idx + 6))
    } else {
      setUpcomingPicks([])
    }

    // Recent History (Last 3)
    const history = picks
        .filter(p => p.driver_id || p.constructor_id)
        .sort((a, b) => b.pick_number - a.pick_number)
        .slice(0, 3)
    setRecentPicks(history)

    // 4. Determine Available Players
    const takenDrivers = picks.map(p => p.driver_id).filter(Boolean)
    const takenConstructors = picks.map(p => p.constructor_id).filter(Boolean)

    const { data: drivers } = await supabase.from('drivers').select('*')
    const { data: constructors } = await supabase.from('constructors').select('*')

    setAvailableDrivers((drivers || []).filter(d => !takenDrivers.includes(d.id)))
    setAvailableConstructors((constructors || []).filter(c => !takenConstructors.includes(c.id)))
  }

  // --- VALIDATION ---
  const validatePick = (teamPicks, type) => {
    const driverCount = teamPicks.filter(p => p.driver_id).length
    const constructorCount = teamPicks.filter(p => p.constructor_id).length

    if (type === 'driver' && driverCount >= 3) return "You already have 3 Drivers! (Max 3)"
    if (type === 'constructor' && constructorCount >= 1) return "You already have a Constructor! (Max 1)"
    return null
  }

  // --- ACTION: HUMAN DRAFT ---
  const handleDraft = async (item, type) => {
    if (!currentPick) return
    if (currentPick.teams.id !== myTeamId) return showToast("It's not your turn!", "error")
    
    const error = validatePick(myPicks, type)
    if (error) return showToast(error, "error")

    // eslint-disable-next-line no-restricted-globals
    if (!confirm(`Draft ${item.name}?`)) return
    
    submitPick(item.id, type)
  }

  // --- ACTION: BOT SIMULATION ---
  const simulateBotPick = async () => {
    setLoading(true)
    
    const { data: botPicks } = await supabase
        .from('draft_picks')
        .select('driver_id, constructor_id')
        .eq('team_id', currentPick.teams.id)

    const driverCount = botPicks.filter(p => p.driver_id).length
    const constructorCount = botPicks.filter(p => p.constructor_id).length

    let pickType = ''
    let itemToPick = null

    const needsDriver = driverCount < 3
    const needsConstructor = constructorCount < 1

    if (needsDriver && availableDrivers.length > 0) {
        pickType = 'driver'
        itemToPick = availableDrivers[0]
    } else if (needsConstructor && availableConstructors.length > 0) {
        pickType = 'constructor'
        itemToPick = availableConstructors[0]
    }

    if (!itemToPick) {
        showToast("Bot has no valid moves left!", "error")
        setLoading(false)
        return
    }

    await submitPick(itemToPick.id, pickType)
    setLoading(false)
  }

  // --- DATABASE WRITE ---
  const submitPick = async (itemId, type) => {
    setLoading(true)
    const updateColumn = type === 'driver' ? 'driver_id' : 'constructor_id'
    
    const { error } = await supabase
      .from('draft_picks')
      .update({ [updateColumn]: itemId, picked_at: new Date() })
      .eq('pick_number', currentPick.pick_number)

    if (error) showToast(error.message, "error")
    else {
        showToast("Draft Pick Confirmed!", "success")
        await refreshDraftState()
    }
    
    setLoading(false)
  }

  const isMyTurn = currentPick && myTeamId && currentPick.teams.id === myTeamId
  const isBotTurn = currentPick && currentPick.teams.is_bot

  return (
    <div className="min-h-screen bg-neutral-900 text-white p-4 md:p-6 relative">
      
      {/* TOAST NOTIFICATION */}
      {toast.show && (
        <div className={`fixed top-4 left-4 right-4 md:left-1/2 md:right-auto md:-translate-x-1/2 px-4 py-3 rounded-lg shadow-2xl z-[100] font-bold text-white text-center animate-bounce ${toast.type === 'error' ? 'bg-red-600' : 'bg-green-600'}`}>
          {toast.type === 'error' ? '⚠️' : '✅'} {toast.message}
        </div>
      )}

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* --- LEFT SIDEBAR (Sticky on Desktop) --- */}
        <div className="lg:col-span-1 space-y-4 md:space-y-6">
          <div className="lg:sticky lg:top-24 space-y-4 md:space-y-6"> 
              
              {/* 1. ON THE CLOCK */}
              <div className={`p-4 md:p-6 rounded-xl border-2 md:border-4 ${isMyTurn ? 'border-green-500 bg-green-900/20' : 'border-neutral-700 bg-neutral-800'}`}>
                <div className="flex justify-between items-center lg:block">
                    <div>
                        <h2 className="text-xs md:text-sm uppercase text-gray-400 font-bold mb-1 md:mb-2">On The Clock</h2>
                        {currentPick ? (
                          <div>
                            <div className="text-2xl md:text-4xl font-bold md:mb-1">#{currentPick.pick_number}</div>
                            <div className="text-lg md:text-xl text-f1-red font-bold truncate max-w-[150px] md:max-w-none">{currentPick.teams.team_name}</div>
                            <div className="text-xs md:text-sm text-gray-400">{currentPick.teams.owner_name}</div>
                          </div>
                        ) : <div className="text-xl font-bold text-green-500">COMPLETE</div>}
                    </div>
                    
                    {/* Action Button */}
                    <div>
                        {isMyTurn && <div className="bg-green-600 px-4 py-2 rounded font-bold animate-pulse text-sm">YOUR TURN</div>}
                        {isBotTurn && (
                            <button onClick={simulateBotPick} disabled={loading} className="bg-blue-600 hover:bg-blue-500 px-3 py-2 rounded font-bold text-xs md:text-sm shadow-lg text-white">
                                {loading ? "..." : "Force Bot"}
                            </button>
                        )}
                    </div>
                </div>
              </div>

              {/* 2. MY ROSTER */}
              <div className="bg-neutral-800 p-3 md:p-4 rounded-xl border border-neutral-700">
                <h3 className="text-gray-400 font-bold text-xs md:text-sm mb-2 border-b border-neutral-700 pb-2">My Roster</h3>
                <div className="flex gap-4">
                    <div className="flex-1 text-center bg-neutral-900 rounded p-1">
                        <span className="block text-xs text-gray-500">Drivers</span>
                        <span className={`font-mono font-bold ${myPicks.filter(p => p.driver_id).length === 3 ? 'text-green-500' : 'text-white'}`}>
                            {myPicks.filter(p => p.driver_id).length}/3
                        </span>
                    </div>
                    <div className="flex-1 text-center bg-neutral-900 rounded p-1">
                         <span className="block text-xs text-gray-500">Const.</span>
                        <span className={`font-mono font-bold ${myPicks.filter(p => p.constructor_id).length === 1 ? 'text-green-500' : 'text-white'}`}>
                            {myPicks.filter(p => p.constructor_id).length}/1
                        </span>
                    </div>
                </div>
              </div>

              {/* 3. RECENT PICKS */}
              <div className="bg-neutral-800 p-3 md:p-4 rounded-xl border border-neutral-700 shadow-inner hidden md:block">
                <h3 className="text-sm font-bold text-gray-400 mb-3 border-b border-neutral-700 pb-2">Recent Picks</h3>
                <div className="space-y-3">
                  {recentPicks.map((p) => {
                    const pickedName = p.drivers ? p.drivers.name : p.constructors ? p.constructors.name : 'Unknown'
                    return (
                        <div key={p.pick_number} className="text-xs md:text-sm bg-neutral-900/50 p-2 rounded border-l-2 border-neutral-600">
                            <span className="text-gray-500 mr-2">#{p.pick_number} {p.teams.owner_name}:</span>
                            <span className="text-white font-bold">{pickedName}</span>
                        </div>
                    )
                  })}
                </div>
              </div>

              {/* 4. UPCOMING PICKS (RESTORED) */}
              <div className="bg-neutral-800 p-3 md:p-4 rounded-xl border border-neutral-700">
                <h3 className="text-sm font-bold text-gray-400 mb-3 border-b border-neutral-700 pb-2">Coming Up</h3>
                <div className="space-y-2 max-h-[250px] overflow-y-auto">
                  {upcomingPicks.length === 0 && <p className="text-xs text-gray-500">No picks left.</p>}
                  
                  {upcomingPicks.map((p) => (
                    <div key={p.pick_number} className={`flex justify-between text-xs md:text-sm p-2 rounded ${p.pick_number === currentPick?.pick_number ? 'bg-neutral-700 font-bold text-white' : 'text-gray-400'}`}>
                      <span>#{p.pick_number}</span>
                      <span className="truncate w-32 text-right">{p.teams.owner_name}</span>
                    </div>
                  ))}
                </div>
              </div>

          </div>
        </div>

        {/* --- RIGHT CONTENT: MARKET (Split View) --- */}
        <div className="lg:col-span-3 space-y-8 pb-20 md:pb-0">
            
            {/* SECTION 1: DRIVERS */}
            <div>
                <div className="flex items-center gap-2 mb-4 sticky top-0 bg-neutral-900 py-2 z-10 border-b border-neutral-800">
                    <span className="text-xl">🏎️</span>
                    <h2 className="text-xl md:text-2xl font-bold">Drivers</h2>
                    <span className="bg-neutral-800 text-gray-400 text-xs px-2 py-1 rounded-full">{availableDrivers.length}</span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {availableDrivers.map((item) => (
                        <button
                            key={item.id}
                            disabled={!isMyTurn || loading}
                            onClick={() => handleDraft(item, 'driver')}
                            className={`
                                group relative flex items-center justify-between p-3 md:p-4 rounded-xl border transition-all text-left
                                ${!isMyTurn 
                                    ? 'bg-neutral-800 border-neutral-700 opacity-60' 
                                    : 'bg-neutral-800 border-neutral-600 hover:border-red-600 hover:bg-neutral-750 active:scale-95 shadow-lg'
                                }
                            `}
                        >
                            <div>
                                <div className="font-bold text-base md:text-lg text-white">{item.name}</div>
                                <div className="text-xs md:text-sm text-gray-400">{item.team}</div>
                            </div>
                            {isMyTurn && <div className="text-f1-red font-bold text-xl">➜</div>}
                        </button>
                    ))}
                </div>
            </div>

            {/* SEPARATOR */}
            <hr className="border-neutral-800" />

            {/* SECTION 2: CONSTRUCTORS */}
            <div>
                <div className="flex items-center gap-2 mb-4 sticky top-0 bg-neutral-900 py-2 z-10 border-b border-neutral-800">
                    <span className="text-xl">🔧</span>
                    <h2 className="text-xl md:text-2xl font-bold">Constructors</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {availableConstructors.map((item) => (
                        <button
                            key={item.id}
                            disabled={!isMyTurn || loading}
                            onClick={() => handleDraft(item, 'constructor')}
                            className={`
                                group relative flex items-center justify-between p-3 md:p-4 rounded-xl border transition-all text-left
                                ${!isMyTurn 
                                    ? 'bg-neutral-800 border-neutral-700 opacity-60' 
                                    : 'bg-neutral-800 border-neutral-600 hover:border-blue-500 hover:bg-neutral-750 active:scale-95 shadow-lg'
                                }
                            `}
                        >
                            <div>
                                <div className="font-bold text-base md:text-lg text-white">{item.name}</div>
                                <div className="text-xs md:text-sm text-gray-400">Constructor</div>
                            </div>
                            {isMyTurn && <div className="text-blue-500 font-bold text-xl">➜</div>}
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