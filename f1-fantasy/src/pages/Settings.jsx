import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../App'

// REPLACE WITH YOUR UUID
const ADMIN_ID = 'ef8ab482-ae12-4d55-8053-97b6211ded9c'

const Settings = () => {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState(null)
  const [team, setTeam] = useState(null)
  
  // Team Name State
  const [isEditing, setIsEditing] = useState(false)
  const [newName, setNewName] = useState('')
  const [saveLoading, setSaveLoading] = useState(false)

  // Admin State
  const [isAdmin, setIsAdmin] = useState(false)
  const [teamsList, setTeamsList] = useState([]) 
  const [showDraftModal, setShowDraftModal] = useState(false)
  const [adminLoading, setAdminLoading] = useState(false)
  
  // NEW: Track which action we are performing
  const [draftMode, setDraftMode] = useState('NEW_ERA') // 'NEW_ERA' or 'DEBUG_WIPE'

  useEffect(() => {
    fetchUserData()
  }, [])

  const fetchUserData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { navigate('/'); return }
    
    setUser(user)
    setIsAdmin(user.id === ADMIN_ID)

    const { data: myTeam } = await supabase.from('teams').select('*').eq('user_id', user.id).single()
    if (myTeam) {
      setTeam(myTeam)
      setNewName(myTeam.team_name)
    }
    setLoading(false)
  }

  // --- 1. TEAM NAME LOGIC ---
  const handleSaveName = async () => {
    if (!newName.trim() || newName === team.team_name) { setIsEditing(false); return }
    setSaveLoading(true)
    const { error } = await supabase.from('teams').update({ team_name: newName }).eq('id', team.id)
    if (!error) {
       setTeam({ ...team, team_name: newName })
       setIsEditing(false)
       alert('Team name updated!')
    }
    setSaveLoading(false)
  }

  // --- 2. LOGOUT LOGIC ---
  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/')
  }

  // --- 3. ADMIN LOGIC (Draft Setup) ---
  
  const moveTeam = (index, direction) => {
    const newTeams = [...teamsList]
    const targetIndex = index + direction
    if (targetIndex < 0 || targetIndex >= newTeams.length) return
    const temp = newTeams[targetIndex]
    newTeams[targetIndex] = newTeams[index]
    newTeams[index] = temp
    setTeamsList(newTeams)
  }

  // A. Triggered by "Trigger New Draft" Button
  const handleOpenNewEra = async () => {
    setDraftMode('NEW_ERA')
    await fetchTeamsAndOpenModal()
  }

  // B. Triggered by "Debug Clear Teams" Button
  const handleOpenDebugWipe = async () => {
    setDraftMode('DEBUG_WIPE')
    await fetchTeamsAndOpenModal()
  }

  const fetchTeamsAndOpenModal = async () => {
    setAdminLoading(true)
    const { data } = await supabase.from('teams').select('id, team_name, owner_name')
    setTeamsList(data || [])
    setShowDraftModal(true)
    setAdminLoading(false)
  }

  // --- THE MASTER EXECUTION FUNCTION ---
  const executeDraftLogic = async () => {
    // Safety check based on mode
    const warningMsg = draftMode === 'NEW_ERA' 
        ? "⚠️ START NEW ERA: This will archive current rosters and start fresh." 
        : "⚠️ DEBUG WIPE: This will DELETE current rosters (no archive) and restart the draft."
    
    if (!confirm(warningMsg)) return

    setAdminLoading(true)
    try {
        // --- LOGIC BRANCH 1: NEW ERA (ARCHIVE) ---
        if (draftMode === 'NEW_ERA') {
            // 1. Archive Active Era
            const { data: activeEra } = await supabase.from('eras').select('*').is('end_date', null).single()
            if (!activeEra) throw new Error("No active era found!")

            const closeDate = new Date().toISOString().split('T')[0]

            const { data: currentPicks } = await supabase.from('draft_picks').select('*')
            const archivePayload = currentPicks
                .filter(p => p.driver_id || p.constructor_id)
                .map(p => ({
                    era_id: activeEra.id,
                    team_id: p.team_id,
                    driver_id: p.driver_id,
                    constructor_id: p.constructor_id
                }))

            if (archivePayload.length > 0) await supabase.from('roster_archive').insert(archivePayload)
            
            // 2. Close Era & Start New One
            await supabase.from('eras').update({ end_date: closeDate }).eq('id', activeEra.id)
            
            const nextDay = new Date()
            nextDay.setDate(nextDay.getDate() + 1)
            const startDate = nextDay.toISOString().split('T')[0]
            await supabase.from('eras').insert({ name: `Era ${activeEra.id + 1}`, year: activeEra.year, start_date: startDate })
        }

        // --- SHARED LOGIC: WIPE & REGENERATE PICKS ---
        // Whether archiving or debugging, we always wipe the active board and generate a new snake draft
        
        // 1. Wipe Draft Board
        await supabase.from('draft_picks').delete().gt('pick_number', 0) 
        
        // 2. Generate New Snake Draft
        const newPicks = []
        let pickNum = 1
        const rounds = 4 

        for (let r = 0; r < rounds; r++) {
            const roundTeams = r % 2 === 0 ? teamsList : [...teamsList].reverse()
            roundTeams.forEach(t => {
                newPicks.push({ pick_number: pickNum, team_id: t.id })
                pickNum++
            })
        }
        await supabase.from('draft_picks').insert(newPicks)

        alert(draftMode === 'NEW_ERA' ? "✅ Era Archived & Draft Started!" : "✅ Debug Wipe Complete. Draft Restarted.")
        setShowDraftModal(false)

    } catch (error) {
        console.error(error)
        alert("Error: " + error.message)
    }
    setAdminLoading(false)
  }

  if (loading) return <div className="p-10 text-white text-center">Loading Settings...</div>

  return (
    <div className="min-h-screen bg-neutral-900 text-white p-6 md:p-10 pb-24">
      <div className="max-w-2xl mx-auto space-y-8">
        
        <h1 className="text-3xl font-black italic tracking-tighter border-b border-white/10 pb-4">
            SETTINGS
        </h1>

        {/* --- TEAM SETTINGS --- */}
        <section className="bg-neutral-800 p-6 rounded-xl border border-white/5">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">Team Details</h2>
            <div className="space-y-4">
                <div>
                    <label className="block text-xs text-gray-500 mb-1">Team Name</label>
                    <div className="flex flex-col md:flex-row gap-3">
                        <input 
                            type="text" 
                            value={newName} 
                            onChange={(e) => setNewName(e.target.value)}
                            disabled={!isEditing}
                            className={`
                                w-full md:flex-1 bg-neutral-900 border px-4 py-2 rounded font-bold text-lg focus:outline-none focus:border-f1-red transition
                                ${isEditing ? 'border-white/20 text-white' : 'border-transparent text-gray-400 cursor-not-allowed'}
                            `}
                        />
                        <div className="flex gap-2 shrink-0">
                            {isEditing ? (
                                <>
                                    <button 
                                        onClick={handleSaveName} 
                                        disabled={saveLoading} 
                                        className="flex-1 md:flex-none bg-green-600 hover:bg-green-500 px-6 py-2 rounded font-bold flex items-center justify-center gap-2"
                                    >
                                        {saveLoading ? '...' : (
                                            <>
                                                <span>Save</span>
                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
                                            </>
                                        )}
                                    </button>
                                    <button onClick={() => { setIsEditing(false); setNewName(team.team_name) }} className="bg-neutral-700 hover:bg-neutral-600 px-4 py-2 rounded font-bold text-white/70 hover:text-white">✕</button>
                                </>
                            ) : (
                                <button onClick={() => setIsEditing(true)} className="w-full md:w-auto bg-neutral-700 hover:bg-neutral-600 px-6 py-2 rounded font-bold text-sm">Edit</button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </section>

        {/* --- COMMISSIONER ZONE (ADMIN ONLY) --- */}
        {isAdmin && (
            <section className="bg-red-900/10 border border-red-900/50 p-6 rounded-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 bg-red-900 text-red-200 text-[10px] font-bold px-2 py-1 rounded-bl">COMMISSIONER ONLY</div>
                <h2 className="text-sm font-bold text-red-400 uppercase tracking-widest mb-4">Danger Zone</h2>
                
                <div className="space-y-6">
                    {/* BUTTON 1: TRIGGER NEW ERA */}
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-red-900/30 pb-4">
                        <div>
                            <h3 className="font-bold text-lg text-white">Trigger New Draft (New Era)</h3>
                            <p className="text-xs text-gray-400 max-w-sm">Archives rosters, closes Era, creates new Era, and starts draft.</p>
                        </div>
                        <button 
                            onClick={handleOpenNewEra}
                            className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-lg font-bold text-sm w-full md:w-auto whitespace-nowrap"
                        >
                            Trigger New Draft
                        </button>
                    </div>

                    {/* BUTTON 2: DEBUG CLEAR */}
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                        <div>
                            <h3 className="font-bold text-lg text-orange-400">Debug Clear Teams</h3>
                            <p className="text-xs text-gray-400 max-w-sm">
                                <span className="text-orange-400 font-bold">WARNING:</span> Wipes current rosters (No Archive). Resets draft board for the *current* era.
                            </p>
                        </div>
                        <button 
                            onClick={handleOpenDebugWipe}
                            className="bg-transparent border border-orange-500 text-orange-400 hover:bg-orange-500 hover:text-white px-4 py-2 rounded-lg font-bold text-sm w-full md:w-auto whitespace-nowrap"
                        >
                            Debug Clear Teams
                        </button>
                    </div>
                </div>
            </section>
        )}

        {/* --- LOGOUT --- */}
        <section>
            <button onClick={handleLogout} className="w-full bg-neutral-800 hover:bg-white hover:text-black border border-white/10 text-gray-400 py-4 rounded-xl font-bold transition-all">
                Log Out
            </button>
        </section>

      </div>

      {/* --- ADMIN MODAL (Draft Order) --- */}
      {showDraftModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
            <div className="bg-neutral-800 w-full max-w-lg rounded-2xl border border-neutral-700 shadow-2xl overflow-hidden">
                <div className="p-6 border-b border-neutral-700 flex justify-between items-center">
                    <h2 className="text-xl font-black italic text-white">
                        {draftMode === 'NEW_ERA' ? 'SETUP NEW ERA DRAFT' : 'SETUP DEBUG DRAFT'}
                    </h2>
                    <button onClick={() => setShowDraftModal(false)} className="text-gray-400 hover:text-white">✕</button>
                </div>
                
                <div className="p-6">
                    <p className="text-sm text-gray-400 mb-4">Set the snake draft order for the {draftMode === 'NEW_ERA' ? 'next era' : 'reset'}.</p>
                    <div className="space-y-2 mb-6 max-h-[50vh] overflow-y-auto">
                        {teamsList.map((t, index) => (
                            <div key={t.id} className="flex items-center gap-3 bg-neutral-900 p-3 rounded border border-neutral-700">
                                <div className="font-mono text-gray-500 w-6">#{index + 1}</div>
                                <div className="flex-1 font-bold text-white">{t.team_name}</div>
                                <div className="flex flex-col gap-1">
                                    <button onClick={() => moveTeam(index, -1)} className="text-xs bg-neutral-700 px-2 rounded hover:bg-white hover:text-black">▲</button>
                                    <button onClick={() => moveTeam(index, 1)} className="text-xs bg-neutral-700 px-2 rounded hover:bg-white hover:text-black">▼</button>
                                </div>
                            </div>
                        ))}
                    </div>

                    <button 
                        onClick={executeDraftLogic} 
                        disabled={adminLoading}
                        className={`w-full font-bold py-3 rounded-lg transition ${
                            draftMode === 'NEW_ERA' 
                                ? 'bg-red-600 hover:bg-red-500 text-white' 
                                : 'bg-orange-600 hover:bg-orange-500 text-white'
                        }`}
                    >
                        {adminLoading ? 'PROCESSING...' : (draftMode === 'NEW_ERA' ? 'CONFIRM & START ERA 🚀' : 'CONFIRM & WIPE BOARD ⚠️')}
                    </button>
                </div>
            </div>
        </div>
      )}

    </div>
  )
}

export default Settings