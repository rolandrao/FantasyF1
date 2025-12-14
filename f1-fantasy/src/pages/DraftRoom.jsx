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
  const [activeTab, setActiveTab] = useState('market')
  const [marketFilter, setMarketFilter] = useState('drivers')
  const [draftModal, setDraftModal] = useState({ show: false, item: null, type: null, pickNumber: null })

  // User Data
  const [myTeamId, setMyTeamId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState({ show: false, message: '', type: 'error' })

  // --- COLOR LOGIC ---
  const getTeamGradient = (teamName) => {
    if (!teamName) return 'linear-gradient(110deg, #1e1e1e 40%, #444444 100%)'
    const lower = teamName.toLowerCase()
    let color = '#444444' 

    if (lower.includes('red bull')) color = '#1E41FF'       
    else if (lower.includes('ferrari')) color = '#FF2800'   
    else if (lower.includes('mercedes')) color = '#00D2BE'  
    else if (lower.includes('mclaren')) color = '#FF8000'   
    else if (lower.includes('aston')) color = '#006F62'     
    else if (lower.includes('alpine')) color = '#FF87BC'    
    else if (lower.includes('williams')) color = '#005AFF'  
    else if (lower.includes('haas')) color = '#E6002B'      
    else if (lower.includes('stake') || lower.includes('audi') || lower.includes('sauber')) color = '#52E252' 
    else if (lower.includes('rb') || lower.includes('alpha')) color = '#1634CB' 
    else if (lower.includes('cadillac')) color = '#D4AF37'  

    return `linear-gradient(110deg, #1e1e1e 40%, ${color} 100%)`
  }

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
  }, [myTeamId])

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

  const refreshDraftState = async () => {
    const { data: picks, error } = await supabase
      .from('draft_picks')
      .select(`
        pick_number, driver_id, constructor_id, picked_at,
        teams (id, team_name, owner_name, is_bot),
        drivers!draft_picks_driver_id_fkey (name, constructors (name)), 
        constructors!draft_picks_constructor_id_fkey (name)
      `)
      .order('pick_number', { ascending: true })

    if (error || !picks) return

    if (myTeamId) {
        setMyPicks(picks.filter(p => p.teams.id === myTeamId && (p.driver_id || p.constructor_id)))
    }

    const rosterMap = {}
    picks.forEach(p => {
        const tId = p.teams.id
        if (!rosterMap[tId]) rosterMap[tId] = { id: tId, owner: p.teams.owner_name, drivers: [], constructor: null }
        if (p.drivers) rosterMap[tId].drivers.push(p.drivers.name)
        if (p.constructors) rosterMap[tId].constructor = p.constructors.name
    })
    setAllRosters(Object.values(rosterMap).sort((a, b) => a.owner.localeCompare(b.owner)))

    const nextUp = picks.find(p => !p.driver_id && !p.constructor_id)
    setCurrentPick(nextUp || null)
    
    if (nextUp) {
      const idx = picks.indexOf(nextUp)
      setUpcomingPicks(picks.slice(idx, idx + 6)) // Show next 6
    } else {
      setUpcomingPicks([])
    }

    const takenDrivers = picks.map(p => p.driver_id).filter(Boolean)
    const takenConstructors = picks.map(p => p.constructor_id).filter(Boolean)

    const { data: drivers } = await supabase.from('drivers').select('*, constructors (name)')
    const { data: constructors } = await supabase.from('constructors').select('*')

    setAvailableDrivers((drivers || []).filter(d => !takenDrivers.includes(d.id)).sort((a,b) => a.name.localeCompare(b.name)))
    setAvailableConstructors((constructors || []).filter(c => !takenConstructors.includes(c.id)))
  }

  const triggerDraftModal = (item, type) => {
    if (!currentPick || currentPick.teams.id !== myTeamId) return showToast("Not your turn!", "error")
    const driverCount = myPicks.filter(p => p.driver_id).length
    const constructorCount = myPicks.filter(p => p.constructor_id).length
    if (type === 'driver' && driverCount >= 3) return showToast("Max 3 Drivers!", "error")
    if (type === 'constructor' && constructorCount >= 1) return showToast("Max 1 Constructor!", "error")
    setDraftModal({ show: true, item: { ...item, type, pickNumber: currentPick.pick_number }, type })
  }

  const confirmDraft = async () => {
    const item = draftModal.item
    const type = draftModal.type
    setDraftModal({ show: false, item: null, type: null, pickNumber: null }) 
    setLoading(true)
    const col = type === 'driver' ? 'driver_id' : 'constructor_id'
    const { error } = await supabase.from('draft_picks').update({ [col]: item.id, picked_at: new Date() }).eq('pick_number', currentPick.pick_number)
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
    <div className="bg-neutral-900 text-white min-h-[calc(100vh-64px)] overflow-hidden">
      
      {/* GLOBAL UTILS */}
      {toast.show && (
        <div className={`fixed top-20 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full shadow-2xl z-[150] font-bold animate-in fade-in slide-in-from-top-4 ${toast.type === 'error' ? 'bg-red-600' : 'bg-green-600'}`}>
          {toast.message}
        </div>
      )}
      <DraftConfirmationModal
        item={draftModal.item}
        onConfirm={confirmDraft}
        onCancel={() => setDraftModal({ show: false, item: null, type: null, pickNumber: null })}
        isMyTurn={isMyTurn}
      />

      {/* ======================================================================
          MOBILE VIEW (md:hidden) - Vertical Stack Layout
         ====================================================================== */}
      <div className="md:hidden flex flex-col h-[calc(100dvh-50px)] relative">
        
        {/* Mobile Header */}
        <div className="flex-none bg-neutral-900 border-b border-neutral-800 p-4 safe-top">
             <h1 className="text-xl font-black italic tracking-tighter flex items-center gap-2">
                <span className="text-f1-red">F1</span> DRAFT ROOM
             </h1>
        </div>

        {/* Mobile Clock */}
        <div className={`flex-none p-4 border-b border-neutral-800 ${isMyTurn ? 'bg-green-900/30 border-green-800' : 'bg-neutral-800'}`}>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="text-center">
                        <div className="text-[10px] uppercase text-gray-400 font-bold tracking-widest">Pick</div>
                        <div className="text-3xl font-black italic leading-none">{currentPick ? `#${currentPick.pick_number}` : '-'}</div>
                    </div>
                    <div className="h-8 w-px bg-white/10"></div>
                    <div>
                        <div className="text-[10px] uppercase text-gray-400 font-bold tracking-widest">Current Turn</div>
                        {currentPick && <div className="font-bold text-lg">{currentPick.teams.owner_name}</div>}
                    </div>
                </div>
                {isBotTurn && <button onClick={simulateBotPick} disabled={loading} className="bg-blue-600 text-xs px-2 py-1 rounded">Skip</button>}
            </div>
        </div>

        {/* Mobile Content (Scrollable) */}
        <div className="flex-1 overflow-y-auto bg-neutral-900 p-4 pb-48">
            {activeTab === 'market' && (
                <>
                <div className="flex bg-neutral-800 p-1 rounded-lg mb-4">
                    <button onClick={() => setMarketFilter('drivers')} className={`flex-1 py-1.5 rounded-md text-xs font-bold ${marketFilter === 'drivers' ? 'bg-f1-red' : 'text-gray-400'}`}>Drivers</button>
                    <button onClick={() => setMarketFilter('constructors')} className={`flex-1 py-1.5 rounded-md text-xs font-bold ${marketFilter === 'constructors' ? 'bg-blue-600' : 'text-gray-400'}`}>Teams</button>
                </div>
                <div className="grid grid-cols-1 gap-3">
                    {marketFilter === 'drivers' ? availableDrivers.map(d => (
                         <button key={d.id} disabled={!isMyTurn} onClick={() => triggerDraftModal(d, 'driver')} className={`flex items-center gap-3 p-3 rounded-xl border text-left relative overflow-hidden ${!isMyTurn ? 'opacity-60 border-neutral-800' : 'border-neutral-700/50'}`} style={{ background: getTeamGradient(d.constructors?.name) }}>
                             <div className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-lg shadow-inner z-10 border border-white/10">🏎️</div>
                             <div className="z-10 relative">
                                 <div className="font-black text-sm text-white drop-shadow-md">{d.name}</div>
                                 <div className="text-[10px] font-bold text-white/70 uppercase tracking-wider">{d.constructors?.name || 'Free Agent'}</div>
                             </div>
                             <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#fff_1px,transparent_1px)] bg-[length:10px_10px]"></div>
                         </button>
                    )) : availableConstructors.map(c => (
                         <button key={c.id} disabled={!isMyTurn} onClick={() => triggerDraftModal(c, 'constructor')} className={`flex items-center gap-3 p-3 rounded-xl border text-left relative overflow-hidden ${!isMyTurn ? 'opacity-60 border-neutral-800' : 'border-neutral-700/50'}`} style={{ background: getTeamGradient(c.name) }}>
                             <div className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-lg shadow-inner z-10 border border-white/10">🔧</div>
                             <div className="z-10 relative">
                                 <div className="font-black text-sm text-white drop-shadow-md">{c.name}</div>
                                 <div className="text-[10px] font-bold text-white/70 uppercase tracking-wider">Factory Team</div>
                             </div>
                             <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#fff_1px,transparent_1px)] bg-[length:10px_10px]"></div>
                         </button>
                    ))}
                </div>
                </>
            )}

            {activeTab === 'board' && (
                <div className="space-y-3">
                    {allRosters.map(team => (
                        <div key={team.id} className="bg-neutral-800 p-3 rounded-xl border border-neutral-700">
                             <div className="flex justify-between mb-2 pb-2 border-b border-neutral-700"><span className="font-bold text-sm">{team.owner}</span></div>
                             <div className="flex gap-1">
                                {[0,1,2].map(i => <div key={i} className={`flex-1 h-7 rounded flex items-center justify-center text-[10px] font-bold border ${team.drivers[i] ? 'bg-neutral-700 border-red-900' : 'bg-neutral-900 border-neutral-800'}`}>{team.drivers[i] ? getAbbr(team.drivers[i]) : ''}</div>)}
                                <div className={`w-1/4 h-7 rounded flex items-center justify-center text-[10px] font-bold border ${team.constructor ? 'bg-blue-900/20 border-blue-800' : 'bg-neutral-900 border-neutral-800'}`}>{team.constructor ? getAbbr(team.constructor) : 'tm'}</div>
                             </div>
                        </div>
                    ))}
                </div>
            )}
        </div>

        {/* Mobile Toggle */}
        <div className="flex-none fixed bottom-24 left-6 right-6 z-40">
            <div className="flex p-1 rounded-2xl overflow-hidden border border-white/10 shadow-2xl backdrop-blur-xl backdrop-saturate-150 bg-black/40">
                <button onClick={() => setActiveTab('market')} className={`flex-1 py-3 text-xs font-bold uppercase tracking-widest rounded-xl ${activeTab === 'market' ? 'bg-white/20 text-white shadow-inner' : 'text-white/40'}`}>Market</button>
                <button onClick={() => setActiveTab('board')} className={`flex-1 py-3 text-xs font-bold uppercase tracking-widest rounded-xl ${activeTab === 'board' ? 'bg-white/20 text-white shadow-inner' : 'text-white/40'}`}>Board</button>
            </div>
        </div>
      </div>


      {/* ======================================================================
          DESKTOP VIEW (hidden md:flex) - 2 Column Dashboard
         ====================================================================== */}
      <div className="hidden md:flex h-full p-6 gap-6 max-w-7xl mx-auto w-full">
        
        {/* LEFT COLUMN: Sidebar (Clock -> Next Picks -> Board) */}
        <div className="w-1/3 flex flex-col gap-6">
            
            {/* 1. ON THE CLOCK */}
            <div className={`p-6 rounded-2xl border-2 shadow-2xl transition-all duration-500 ${isMyTurn ? 'bg-green-900/20 border-green-500 shadow-green-900/50' : 'bg-neutral-800 border-neutral-700'}`}>
                <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-bold uppercase tracking-widest text-gray-400">Current Turn</span>
                    <div className="bg-black/40 px-3 py-1 rounded text-xs font-mono font-bold text-gray-400">PICK #{currentPick?.pick_number || '-'}</div>
                </div>
                <div className="text-3xl font-black italic truncate mb-2">{currentPick ? currentPick.teams.owner_name : 'Draft Complete'}</div>
                {isMyTurn && <div className="text-green-400 font-bold animate-pulse">It's your turn! Make a selection.</div>}
                
                {isBotTurn && (
                    <button onClick={simulateBotPick} disabled={loading} className="mt-4 w-full py-2 bg-blue-600 hover:bg-blue-500 rounded font-bold text-sm transition">
                        {loading ? 'Simulating Bot...' : 'Force Bot Pick 🤖'}
                    </button>
                )}
            </div>

            {/* 2. NEXT 6 PICKS */}
            <div className="bg-neutral-800 rounded-2xl border border-neutral-700 p-6 flex-none">
                <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-4 border-b border-neutral-700 pb-2">Upcoming Picks</h3>
                <div className="space-y-3">
                    {upcomingPicks.length === 0 && <div className="text-gray-500 text-sm">No upcoming picks.</div>}
                    {upcomingPicks.map(p => (
                        <div key={p.pick_number} className="flex justify-between items-center text-sm">
                            <span className="font-mono text-gray-500 w-8">#{p.pick_number}</span>
                            <span className="font-bold flex-1">{p.teams.owner_name}</span>
                            {p.teams.is_bot && <span className="text-[10px] bg-blue-900 text-blue-200 px-1 rounded">BOT</span>}
                        </div>
                    ))}
                </div>
            </div>

            {/* 3. DRAFT BOARD (Scrollable List) */}
            <div className="bg-neutral-800 rounded-2xl border border-neutral-700 p-6 flex-1 overflow-y-auto">
                <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-4 border-b border-neutral-700 pb-2">Team Rosters</h3>
                <div className="space-y-3">
                    {allRosters.map(team => (
                        <div key={team.id} className="bg-neutral-900/50 p-3 rounded-xl border border-neutral-700/50">
                             <div className="flex justify-between items-center mb-2">
                                <span className="font-bold text-sm">{team.owner}</span>
                                {team.id === myTeamId && <span className="text-[10px] bg-f1-red px-1.5 rounded font-bold">YOU</span>}
                             </div>
                             <div className="flex gap-1">
                                {[0,1,2].map(i => (
                                    <div key={i} className={`flex-1 h-6 rounded flex items-center justify-center text-[10px] font-bold border ${team.drivers[i] ? 'bg-neutral-700 border-red-900 text-white' : 'bg-neutral-900 border-neutral-800 text-gray-600'}`}>
                                        {team.drivers[i] ? getAbbr(team.drivers[i]) : '-'}
                                    </div>
                                ))}
                                <div className={`w-8 h-6 rounded flex items-center justify-center text-[10px] font-bold border ${team.constructor ? 'bg-blue-900/20 border-blue-800 text-blue-200' : 'bg-neutral-900 border-neutral-800 text-gray-600'}`}>
                                    {team.constructor ? getAbbr(team.constructor) : 'C'}
                                </div>
                             </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>

        {/* RIGHT COLUMN: Market (Drivers Grid & Constructor Grid) */}
        <div className="w-2/3 flex flex-col gap-6 overflow-y-auto pr-2">
            
            {/* DRIVERS SECTION */}
            <div>
                <h2 className="text-xl font-black italic mb-4 flex items-center gap-2"><span className="text-f1-red">🏎️</span> AVAILABLE DRIVERS</h2>
                <div className="grid grid-cols-3 gap-3">
                    {availableDrivers.map(d => {
                        const teamName = d.constructors?.name || 'Free Agent'
                        return (
                            <button 
                                key={d.id} 
                                disabled={!isMyTurn} 
                                onClick={() => triggerDraftModal(d, 'driver')} 
                                className={`
                                    flex items-center gap-3 p-3 rounded-xl border text-left relative overflow-hidden transition-all
                                    ${!isMyTurn ? 'opacity-60 border-neutral-800 cursor-not-allowed' : 'hover:scale-[1.02] border-neutral-600 hover:border-white cursor-pointer'}
                                `}
                                style={{ background: getTeamGradient(teamName) }}
                            >
                                <div className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-lg shadow-inner z-10 border border-white/10 shrink-0">
                                    🏎️
                                </div>
                                <div className="z-10 relative min-w-0">
                                    <div className="font-black text-sm text-white drop-shadow-md truncate">{d.name}</div>
                                    <div className="text-[10px] font-bold text-white/70 uppercase tracking-wider truncate">{teamName}</div>
                                </div>
                                <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#fff_1px,transparent_1px)] bg-[length:10px_10px]"></div>
                            </button>
                        )
                    })}
                </div>
            </div>

            {/* CONSTRUCTORS SECTION */}
            <div>
                <h2 className="text-xl font-black italic mb-4 mt-4 flex items-center gap-2"><span className="text-blue-500">🔧</span> AVAILABLE CONSTRUCTORS</h2>
                <div className="grid grid-cols-3 gap-3">
                    {availableConstructors.map(c => (
                        <button 
                            key={c.id} 
                            disabled={!isMyTurn} 
                            onClick={() => triggerDraftModal(c, 'constructor')} 
                            className={`
                                flex items-center gap-3 p-3 rounded-xl border text-left relative overflow-hidden transition-all
                                ${!isMyTurn ? 'opacity-60 border-neutral-800 cursor-not-allowed' : 'hover:scale-[1.02] border-neutral-600 hover:border-white cursor-pointer'}
                            `}
                            style={{ background: getTeamGradient(c.name) }}
                        >
                            <div className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-lg shadow-inner z-10 border border-white/10 shrink-0">
                                🔧
                            </div>
                            <div className="z-10 relative min-w-0">
                                <div className="font-black text-sm text-white drop-shadow-md truncate">{c.name}</div>
                                <div className="text-[10px] font-bold text-white/70 uppercase tracking-wider truncate">Factory Team</div>
                            </div>
                            <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#fff_1px,transparent_1px)] bg-[length:10px_10px]"></div>
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