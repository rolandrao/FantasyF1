import { useEffect, useState } from 'react'
import { supabase } from '../App'
import DraftConfirmationModal from '../components/DraftConfirmationModal'

const DraftRoom = () => {
  // --- STATE ---
  const [currentPick, setCurrentPick] = useState(null)
  const [upcomingPicks, setUpcomingPicks] = useState([])
  const [allRosters, setAllRosters] = useState([])
  const [myPicks, setMyPicks] = useState([])
  const [availableDrivers, setAvailableDrivers] = useState([])
  const [availableConstructors, setAvailableConstructors] = useState([])

  // UI State
  const [activeTab, setActiveTab] = useState('market') // 'market', 'board', 'squad'
  const [marketFilter, setMarketFilter] = useState('drivers') // 'drivers', 'constructors'

  // Modal State
  const [draftModal, setDraftModal] = useState({ show: false, item: null, type: null, pickNumber: null })

  // User Data
  const [myTeamId, setMyTeamId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState({ show: false, message: '', type: 'error' })

  // --- INITIAL LOAD ---
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

  // --- HELPERS ---
  const showToast = (message, type = 'error') => {
    setToast({ show: true, message, type })
    setTimeout(() => setToast({ ...toast, show: false }), 3000)
  }

  const getAbbr = (name) => {
    if (!name) return ''
    const parts = name.split(' ')
    const target = parts.length > 1 ? parts[parts.length - 1] : parts[0]
    return target.substring(0, 3).toUpperCase()
  }

  // --- CORE LOGIC ---
  // --- CORE LOGIC ---
  const refreshDraftState = async () => {
    // 1. Fetch Picks with EXPLICIT Foreign Keys
    const { data: picks, error } = await supabase
      .from('draft_picks')
      .select(`
        pick_number, driver_id, constructor_id, picked_at,
        teams (id, team_name, owner_name, is_bot),
        drivers!draft_picks_driver_id_fkey (
            name, 
            constructors (name)
        ), 
        constructors!draft_picks_constructor_id_fkey (name)
      `)
      .order('pick_number', { ascending: true })

    if (error) {
      console.error("Error fetching picks:", error)
      return
    }

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

    // Determine Upcoming
    if (nextUp) {
      const idx = picks.indexOf(nextUp)
      setUpcomingPicks(picks.slice(idx, idx + 5))
    } else {
      setUpcomingPicks([])
    }

    // Filter Available
    const takenDrivers = picks.map(p => p.driver_id).filter(Boolean)
    const takenConstructors = picks.map(p => p.constructor_id).filter(Boolean)

    // Fetch Market Data (explicit link for drivers->constructors usually helps too)
    const { data: drivers } = await supabase
      .from('drivers')
      .select('*, constructors (name)')

    const { data: constructors } = await supabase
      .from('constructors')
      .select('*')

    // Sort drivers by ranking/name if possible, here just name
    setAvailableDrivers((drivers || []).filter(d => !takenDrivers.includes(d.id)).sort((a, b) => a.name.localeCompare(b.name)))
    setAvailableConstructors((constructors || []).filter(c => !takenConstructors.includes(c.id)))
  }

  // --- ACTIONS ---
  // --- STEP 1: OPEN MODAL (Triggered by button click) ---
  const triggerDraftModal = (item, type) => {
    if (!currentPick || currentPick.teams.id !== myTeamId) return showToast("Not your turn!", "error")

    const driverCount = myPicks.filter(p => p.driver_id).length
    const constructorCount = myPicks.filter(p => p.constructor_id).length

    if (type === 'driver' && driverCount >= 3) return showToast("Max 3 Drivers!", "error")
    if (type === 'constructor' && constructorCount >= 1) return showToast("Max 1 Constructor!", "error")

    setDraftModal({
      show: true,
      item: {
        ...item,
        type,
        pickNumber: currentPick.pick_number
      },
      type: type
    })
  }

  // --- STEP 2: CONFIRM DRAFT (Triggered by modal button) ---
  const confirmDraft = async () => {
    const item = draftModal.item
    const type = draftModal.type

    setDraftModal({ show: false, item: null, type: null, pickNumber: null }) // Close Modal

    setLoading(true)
    const col = type === 'driver' ? 'driver_id' : 'constructor_id'

    const { error } = await supabase
      .from('draft_picks')
      .update({ [col]: item.id, picked_at: new Date() })
      .eq('pick_number', currentPick.pick_number)

    if (!error) {
      showToast("Pick Confirmed!", "success")
      await refreshDraftState()
    } else {
      showToast(error.message, "error")
    }
    setLoading(false)
  }
  const simulateBotPick = async () => {
    setLoading(true)
    const { data: botPicks } = await supabase.from('draft_picks').select('driver_id, constructor_id').eq('team_id', currentPick.teams.id)
    const dCount = botPicks.filter(p => p.driver_id).length
    const cCount = botPicks.filter(p => p.constructor_id).length

    let pickType = '', item = null
    if (dCount < 3 && availableDrivers.length > 0) { pickType = 'driver'; item = availableDrivers[0] }
    else if (cCount < 1 && availableConstructors.length > 0) { pickType = 'constructor'; item = availableConstructors[0] }

    if (!item) { showToast("Bot stuck!", "error"); setLoading(false); return }

    const col = pickType === 'driver' ? 'driver_id' : 'constructor_id'
    await supabase.from('draft_picks').update({ [col]: item.id, picked_at: new Date() }).eq('pick_number', currentPick.pick_number)

    setLoading(false)
    refreshDraftState()
  }

  const isMyTurn = currentPick && myTeamId && currentPick.teams.id === myTeamId
  const isBotTurn = currentPick && currentPick.teams.is_bot

  return (
    <div className="h-screen flex flex-col bg-neutral-900 text-white overflow-hidden pb-16 md:pb-0">

      {/* TOAST OVERLAY */}
      {toast.show && (
        <div className={`fixed top-20 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full shadow-2xl z-[100] font-bold animate-in fade-in slide-in-from-top-4 ${toast.type === 'error' ? 'bg-red-600' : 'bg-green-600'}`}>
          {toast.message}
        </div>
      )}

      {/* ==================================================================
          1. STICKY HEADER: CURRENT STATUS
          ================================================================== */}
      <div className={`shrink-0 p-4 border-b border-neutral-800 transition-colors duration-500 ${isMyTurn ? 'bg-green-900/30 border-green-800' : 'bg-neutral-800'}`}>
        <div className="max-w-7xl mx-auto flex items-center justify-between">

          {/* Pick Info */}
          <div className="flex items-center gap-3 md:gap-6">
            <div className="text-center">
              <div className="text-[10px] uppercase text-gray-400 font-bold tracking-widest">Pick</div>
              <div className="text-2xl md:text-3xl font-black italic leading-none">
                {currentPick ? `#${currentPick.pick_number}` : '-'}
              </div>
            </div>

            <div className="h-8 w-px bg-white/10"></div>

            <div>
              <div className="text-[10px] uppercase text-gray-400 font-bold tracking-widest">On The Clock</div>
              {currentPick ? (
                <div className="font-bold text-lg md:text-xl truncate max-w-[150px] md:max-w-none">
                  {currentPick.teams.owner_name}
                  {isMyTurn && <span className="ml-2 text-xs bg-green-500 text-black px-1.5 py-0.5 rounded font-black animate-pulse">YOU</span>}
                </div>
              ) : (
                <div className="text-green-400 font-bold">DRAFT COMPLETE</div>
              )}
            </div>
          </div>

          {/* Actions (Bot / Timer placeholder) */}
          <div>
            {isBotTurn && (
              <button onClick={simulateBotPick} disabled={loading} className="bg-blue-600 hover:bg-blue-500 text-xs font-bold px-3 py-2 rounded shadow transition">
                {loading ? '...' : 'Skip Bot'}
              </button>
            )}
          </div>
        </div>
      </div>


      {/* ==================================================================
          2. MAIN CONTENT AREA (Scrollable)
          ================================================================== */}
      <div className="flex-1 overflow-y-auto bg-neutral-900 relative">
        <div className="max-w-7xl mx-auto p-4 pb-24 md:pb-4 min-h-full">

          {/* --- TAB 1: MARKET (Default) --- */}
          <div className={activeTab === 'market' ? 'block animate-in fade-in zoom-in duration-300' : 'hidden md:block'}>

            {/* Market Toggle Pills */}
            <div className="flex gap-2 mb-4 sticky top-0 bg-neutral-900/95 backdrop-blur z-20 py-2 border-b border-neutral-800 md:hidden">
              <button onClick={() => setMarketFilter('drivers')} className={`flex-1 py-2 rounded-lg text-sm font-bold transition ${marketFilter === 'drivers' ? 'bg-f1-red text-white' : 'bg-neutral-800 text-gray-400'}`}>Drivers ({availableDrivers.length})</button>
              <button onClick={() => setMarketFilter('constructors')} className={`flex-1 py-2 rounded-lg text-sm font-bold transition ${marketFilter === 'constructors' ? 'bg-blue-600 text-white' : 'bg-neutral-800 text-gray-400'}`}>Teams ({availableConstructors.length})</button>
            </div>

            {/* ... (TOAST OVERLAY JSX) ... */}

            {/* ==================================================================
          DRAFT CONFIRMATION MODAL
          ================================================================== */}
            <DraftConfirmationModal
              item={draftModal.item}
              onConfirm={confirmDraft}
              onCancel={() => setDraftModal({ show: false, item: null, type: null, pickNumber: null })}
              isMyTurn={isMyTurn}
            />

            {/* ==================================================================
          1. STICKY HEADER: CURRENT STATUS
          ... (rest of the component) ...

                {/* Desktop Split View Wrapper */}
            <div className="md:grid md:grid-cols-4 md:gap-6">

              {/* LEFT COL: ROSTER (Desktop Only) */}
              <div className="hidden md:block col-span-1 space-y-4">
                <div className="bg-neutral-800 p-4 rounded-xl border border-neutral-700">
                  <h3 className="font-bold text-gray-400 text-xs uppercase mb-3">League Board</h3>
                  {/* Reusing the Row Logic from Board Tab */}
                  <div className="space-y-2">
                    {allRosters.map(team => (
                      <div key={team.id} className="text-xs bg-neutral-900/50 p-2 rounded border border-neutral-700">
                        <div className="font-bold text-gray-300 mb-1">{team.owner}</div>
                        <div className="flex gap-1">
                          {[0, 1, 2].map(i => <div key={i} className="bg-neutral-800 px-1 rounded text-[10px] w-8 text-center">{team.drivers[i] ? getAbbr(team.drivers[i]) : '-'}</div>)}
                          <div className="bg-blue-900/30 text-blue-200 px-1 rounded text-[10px] w-8 text-center">{team.constructor ? getAbbr(team.constructor) : '-'}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* RIGHT COL: MARKET GRID */}
              <div className="col-span-3 space-y-6">

                {/* DRIVERS LIST */}
                <div className={marketFilter === 'drivers' || window.innerWidth >= 768 ? 'block' : 'hidden'}>
                  <h3 className="hidden md:block text-xl font-black italic mb-4 text-f1-red">AVAILABLE DRIVERS</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {availableDrivers.map(d => (
                      <button
                        key={d.id}
                        disabled={!isMyTurn || loading}
                        onClick={() => triggerDraftModal(d, 'driver')}
                        className={`
                                            group flex items-center justify-between p-3 rounded-xl border transition-all text-left shadow-lg
                                            ${!isMyTurn ? 'bg-neutral-800 border-neutral-800 opacity-60' : 'bg-neutral-800 border-neutral-600 hover:border-f1-red hover:bg-neutral-750 hover:scale-[1.02]'}
                                        `}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded bg-neutral-700 flex items-center justify-center text-lg shadow-inner">🏎️</div>
                          <div>
                            <div className="font-bold text-sm leading-tight text-white">{d.name}</div>
                            <div className="text-xs text-gray-500">{d.constructors?.name || 'Free Agent'}</div>
                          </div>
                        </div>
                        {isMyTurn && <div className="text-f1-red font-black text-xl opacity-0 group-hover:opacity-100 transition-opacity">➜</div>}
                      </button>
                    ))}
                  </div>
                </div>

                {/* CONSTRUCTORS LIST */}
                <div className={marketFilter === 'constructors' || window.innerWidth >= 768 ? 'block' : 'hidden'}>
                  <h3 className="hidden md:block text-xl font-black italic mb-4 text-blue-500">AVAILABLE CONSTRUCTORS</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {availableConstructors.map(c => (
                      <button
                        key={c.id}
                        disabled={!isMyTurn || loading}
                        onClick={() => triggerDraftModal(c, 'constructor')}
                        className={`
                                            group flex items-center justify-between p-3 rounded-xl border transition-all text-left shadow-lg
                                            ${!isMyTurn ? 'bg-neutral-800 border-neutral-800 opacity-60' : 'bg-neutral-800 border-neutral-600 hover:border-blue-500 hover:bg-neutral-750 hover:scale-[1.02]'}
                                        `}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded bg-blue-900/20 flex items-center justify-center text-lg shadow-inner">🔧</div>
                          <div>
                            <div className="font-bold text-sm leading-tight text-white">{c.name}</div>
                            <div className="text-xs text-blue-400">Factory Team</div>
                          </div>
                        </div>
                        {isMyTurn && <div className="text-blue-500 font-black text-xl opacity-0 group-hover:opacity-100 transition-opacity">➜</div>}
                      </button>
                    ))}
                  </div>
                </div>

              </div>
            </div>
          </div>


          {/* --- TAB 2: BOARD (Mobile Only View) --- */}
          <div className={activeTab === 'board' ? 'block md:hidden animate-in slide-in-from-right duration-300' : 'hidden'}>
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><span>📋</span> Draft Board</h2>
            <div className="space-y-3">
              {allRosters.map(team => (
                <div key={team.id} className="bg-neutral-800 p-3 rounded-xl border border-neutral-700 shadow-md">
                  <div className="flex justify-between items-center mb-2 border-b border-neutral-700 pb-2">
                    <span className="font-bold text-white">{team.owner}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${team.id === myTeamId ? 'bg-f1-red text-white' : 'bg-neutral-700 text-gray-400'}`}>
                      {team.id === myTeamId ? 'YOU' : 'OPPONENT'}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    {/* Drivers */}
                    <div className="flex-1 flex gap-1">
                      {[0, 1, 2].map(i => (
                        <div key={i} className={`flex-1 h-8 rounded flex items-center justify-center text-xs font-bold border ${team.drivers[i] ? 'bg-neutral-700 border-red-900 text-white' : 'bg-neutral-900 border-neutral-800 text-gray-600'}`}>
                          {team.drivers[i] ? getAbbr(team.drivers[i]) : ''}
                        </div>
                      ))}
                    </div>
                    {/* Constructor */}
                    <div className={`w-1/4 h-8 rounded flex items-center justify-center text-xs font-bold border ${team.constructor ? 'bg-blue-900/20 border-blue-800 text-blue-200' : 'bg-neutral-900 border-neutral-800 text-gray-600'}`}>
                      {team.constructor ? getAbbr(team.constructor) : 'CONST'}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8">
              <h3 className="font-bold text-gray-400 text-xs uppercase mb-3">Recent Activity</h3>
              <div className="bg-neutral-800 rounded-xl overflow-hidden border border-neutral-700 divide-y divide-neutral-700">
                {upcomingPicks.length === 0 && <div className="p-4 text-gray-500 text-center text-sm">Draft Complete</div>}
                {upcomingPicks.slice(0, 3).map(p => (
                  <div key={p.pick_number} className="p-3 flex justify-between text-sm">
                    <span className="text-gray-500">Pick {p.pick_number}</span>
                    <span className="font-bold">{p.teams.owner_name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>


          {/* --- TAB 3: MY SQUAD (Mobile Only View) --- */}
          <div className={activeTab === 'squad' ? 'block md:hidden animate-in slide-in-from-right duration-300' : 'hidden'}>
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><span>🧢</span> My Draft</h2>

            {/* Stats Summary */}
            <div className="flex gap-4 mb-6">
              <div className="flex-1 bg-neutral-800 p-4 rounded-xl border border-neutral-700 text-center">
                <div className="text-3xl font-black text-f1-red">{myPicks.filter(p => p.driver_id).length}/3</div>
                <div className="text-xs text-gray-400 uppercase font-bold">Drivers</div>
              </div>
              <div className="flex-1 bg-neutral-800 p-4 rounded-xl border border-neutral-700 text-center">
                <div className="text-3xl font-black text-blue-500">{myPicks.filter(p => p.constructor_id).length}/1</div>
                <div className="text-xs text-gray-400 uppercase font-bold">Constructor</div>
              </div>
            </div>

            <div className="space-y-3">
              {/* Render Drivers */}
              {myPicks.filter(p => p.driver_id).map(p => (
                <div key={p.pick_number} className="flex items-center gap-3 bg-neutral-800 p-3 rounded-xl border-l-4 border-f1-red">
                  <div className="text-2xl">🏎️</div>
                  <div>
                    <div className="font-bold text-lg">{p.drivers.name}</div>
                    <div className="text-xs text-gray-400">Pick #{p.pick_number}</div>
                  </div>
                </div>
              ))}
              {/* Render Constructor */}
              {myPicks.filter(p => p.constructor_id).map(p => (
                <div key={p.pick_number} className="flex items-center gap-3 bg-neutral-800 p-3 rounded-xl border-l-4 border-blue-500">
                  <div className="text-2xl">🔧</div>
                  <div>
                    <div className="font-bold text-lg">{p.constructors.name}</div>
                    <div className="text-xs text-gray-400">Pick #{p.pick_number}</div>
                  </div>
                </div>
              ))}

              {myPicks.length === 0 && <div className="text-center text-gray-500 py-10">You haven't picked anyone yet. Get to the Market!</div>}
            </div>
          </div>

        </div>
      </div>


      {/* ==================================================================
          3. MOBILE BOTTOM TABS (Floating above Nav)
          ================================================================== */}
      <div className="md:hidden absolute bottom-16 left-0 w-full px-4 pb-2 z-50">
        <div className="bg-neutral-800/90 backdrop-blur-md rounded-2xl border border-neutral-700 shadow-2xl flex p-1">

          <button
            onClick={() => setActiveTab('market')}
            className={`flex-1 py-3 rounded-xl text-xs font-bold uppercase tracking-wide transition-all ${activeTab === 'market' ? 'bg-f1-red text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
          >
            Market
          </button>

          <button
            onClick={() => setActiveTab('board')}
            className={`flex-1 py-3 rounded-xl text-xs font-bold uppercase tracking-wide transition-all ${activeTab === 'board' ? 'bg-neutral-700 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
          >
            Board
          </button>

          <button
            onClick={() => setActiveTab('squad')}
            className={`flex-1 py-3 rounded-xl text-xs font-bold uppercase tracking-wide transition-all ${activeTab === 'squad' ? 'bg-neutral-700 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
          >
            My Squad
          </button>

        </div>
      </div>

    </div>
  )
}

export default DraftRoom