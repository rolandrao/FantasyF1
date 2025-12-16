import { useState, useEffect } from 'react'
import { supabase } from '../App'

// REPLACE THIS WITH YOUR EXACT UUID FROM SUPABASE AUTH
const ADMIN_ID = 'ef8ab482-ae12-4d55-8053-97b6211ded9c' 

const AdminTools = () => {
    const [isAdmin, setIsAdmin] = useState(false)
    const [showModal, setShowModal] = useState(false)
    const [teams, setTeams] = useState([])
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        checkAdmin()
    }, [])

    const checkAdmin = async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (user && user.id === ADMIN_ID) {
            setIsAdmin(true)
        }
    }

    const openDraftSetup = async () => {
        setLoading(true)
        // Fetch all teams to sort
        const { data } = await supabase.from('teams').select('id, team_name, owner_name')
        setTeams(data || [])
        setShowModal(true)
        setLoading(false)
    }

    // Simple Array Move Helper
    const moveTeam = (index, direction) => {
        const newTeams = [...teams]
        const targetIndex = index + direction
        if (targetIndex < 0 || targetIndex >= newTeams.length) return
        
        const temp = newTeams[targetIndex]
        newTeams[targetIndex] = newTeams[index]
        newTeams[index] = temp
        setTeams(newTeams)
    }

    const triggerNewDraft = async () => {
        if (!confirm("⚠️ ARE YOU SURE? This will archive current rosters and start a new draft!")) return

        setLoading(true)
        try {
            // 1. Get the Active Era
            const { data: activeEra } = await supabase.from('eras').select('*').is('end_date', null).single()
            if (!activeEra) throw new Error("No active era found!")

            // 2. Find the Date of the Last Completed Race (to close the era)
            // We look for the most recent race that has results
            const { data: lastRace } = await supabase
                .from('races')
                .select('date, race_results(id)')
                .not('race_results', 'is', null) 
                .order('date', { ascending: false })
                .limit(1)
                .maybeSingle()
            
            // Default to yesterday if no races run yet, or the last race date
            const closeDate = lastRace ? lastRace.date : new Date().toISOString().split('T')[0]

            // 3. Archive Current Draft Picks
            const { data: currentPicks } = await supabase.from('draft_picks').select('*')
            
            const archivePayload = currentPicks
                .filter(p => p.driver_id || p.constructor_id)
                .map(p => ({
                    era_id: activeEra.id,
                    team_id: p.team_id,
                    driver_id: p.driver_id,
                    constructor_id: p.constructor_id
                }))

            if (archivePayload.length > 0) {
                await supabase.from('roster_archive').insert(archivePayload)
            }

            // 4. Close Current Era
            await supabase.from('eras').update({ end_date: closeDate }).eq('id', activeEra.id)

            // 5. Create New Era (Starts Tomorrow)
            // We add 1 day to avoid overlap logic issues
            const nextDay = new Date(closeDate)
            nextDay.setDate(nextDay.getDate() + 1)
            const startDate = nextDay.toISOString().split('T')[0]

            await supabase.from('eras').insert({ 
                name: `Era ${activeEra.id + 1}`, 
                year: activeEra.year, 
                start_date: startDate 
            })

            // 6. Wipe Draft Picks
            await supabase.from('draft_picks').delete().neq('id', 0) // Delete all

            // 7. Insert New Empty Picks based on Order
            // Snake Draft Logic: 1-6, then 6-1, then 1-6...
            const newPicks = []
            let pickNum = 1
            const rounds = 4 // 3 Drivers + 1 Constructor

            for (let r = 0; r < rounds; r++) {
                // If round is even (0, 2), go normal order. If odd (1, 3), go reverse.
                const roundTeams = r % 2 === 0 ? teams : [...teams].reverse()
                
                roundTeams.forEach(team => {
                    newPicks.push({
                        pick_number: pickNum,
                        team_id: team.id,
                        is_active: pickNum === 1 // First pick active
                    })
                    pickNum++
                })
            }
            
            await supabase.from('draft_picks').insert(newPicks)

            alert("✅ New Draft Started! Era Archived.")
            setShowModal(false)

        } catch (error) {
            console.error(error)
            alert("Error: " + error.message)
        }
        setLoading(false)
    }

    if (!isAdmin) return null

    return (
        <>
            {/* ADMIN BUTTON IN NAVBAR */}
            <button 
                onClick={openDraftSetup}
                className="bg-red-600 hover:bg-red-500 text-white text-xs font-bold px-3 py-1 rounded uppercase tracking-wider"
            >
                ADMIN
            </button>

            {/* MODAL */}
            {showModal && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
                    <div className="bg-neutral-800 w-full max-w-lg rounded-2xl border border-neutral-700 shadow-2xl overflow-hidden">
                        <div className="p-6 border-b border-neutral-700 flex justify-between items-center">
                            <h2 className="text-xl font-black italic text-white">TRIGGER NEW DRAFT</h2>
                            <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-white">✕</button>
                        </div>
                        
                        <div className="p-6">
                            <p className="text-sm text-gray-400 mb-4">
                                Drag teams to set the draft order. 
                                <br/>
                                <span className="text-red-400 font-bold">WARNING: This will lock points for the current era and wipe the draft board.</span>
                            </p>

                            <div className="space-y-2 mb-6">
                                {teams.map((team, index) => (
                                    <div key={team.id} className="flex items-center gap-3 bg-neutral-900 p-3 rounded border border-neutral-700">
                                        <div className="font-mono text-gray-500 w-6">#{index + 1}</div>
                                        <div className="flex-1 font-bold text-white">{team.team_name} <span className="text-gray-500 font-normal">({team.owner_name})</span></div>
                                        <div className="flex flex-col gap-1">
                                            <button onClick={() => moveTeam(index, -1)} className="text-xs bg-neutral-700 px-2 rounded hover:bg-white hover:text-black">▲</button>
                                            <button onClick={() => moveTeam(index, 1)} className="text-xs bg-neutral-700 px-2 rounded hover:bg-white hover:text-black">▼</button>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <button 
                                onClick={triggerNewDraft} 
                                disabled={loading}
                                className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-lg transition"
                            >
                                {loading ? 'PROCESSING...' : 'CONFIRM & START DRAFT 🚀'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}

export default AdminTools