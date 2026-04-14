import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../App'

export const useTeamData = () => {
    const [team, setTeam] = useState(null)
    const [roster, setRoster] = useState([])
    const [recaps, setRecaps] = useState([])
    const [chips, setChips] = useState([])
    const [nextRace, setNextRace] = useState(null)
    const [allDrivers, setAllDrivers] = useState([])
    const [loading, setLoading] = useState(true)

    // Helper: Pick Number Logic
    const getPickNum = (pickHistory, dId, cId) => {
        const found = pickHistory?.find(p => (dId && p.driver_id === dId) || (cId && p.constructor_id === cId))
        return found ? found.pick_number : '-'
    }

    const fetchMyTeam = useCallback(async (overrideTeamId = null) => {
        setLoading(true)
        let myTeam = null;

        if (overrideTeamId) {
            // ADMIN OVERRIDE: Fetch the requested team
            const { data } = await supabase.from('teams').select('*').eq('id', overrideTeamId).maybeSingle()
            myTeam = data
        } else {
            // NORMAL USER: Fetch their own team
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) { setLoading(false); return }
            const { data } = await supabase.from('teams').select('*').eq('user_id', user.id).maybeSingle()
            myTeam = data
        }

        if (!myTeam) { setTeam(null); setLoading(false); return }
        setTeam(myTeam)

        // 2. Fetch Aux Data (Chips & Next Race) EARLY so we can use them for roster logic
        const { data: teamChips } = await supabase.from('team_chips').select('*').eq('team_id', myTeam.id)
        setChips(teamChips || [])

        const today = new Date().toISOString()
        const { data: next } = await supabase.from('races').select('*').gte('date', today).order('date', { ascending: true }).limit(1).maybeSingle()
        setNextRace(next)

        // Load All Drivers (for Modals)
        const { data: driversList } = await supabase.from('drivers').select('id, name, team, code').eq('year', 2026).order('name')
        setAllDrivers(driversList || [])

        // 3. Fetch Base Roster & Picks
        const [rosterRes, picksRes] = await Promise.all([
            supabase.from('rosters').select(`
                driver_1:drivers!rosters_driver_1_id_fkey (id, name, team, code),
                driver_2:drivers!rosters_driver_2_id_fkey (id, name, team, code),
                driver_3:drivers!rosters_driver_3_id_fkey (id, name, team, code),
                constructor:constructors!rosters_constructor_id_fkey (id, name)
            `).eq('team_id', myTeam.id).single(),
            supabase.from('draft_picks').select('pick_number, driver_id, constructor_id').eq('team_id', myTeam.id)
        ])

        // 4. Process Roster (AND APPLY STEAL LOGIC)
        const formattedRoster = []
        const rData = rosterRes.data
        const pData = picksRes.data || []

        // Check if Steal is Active for the UPCOMING race
        const activeSteal = teamChips?.find(c =>
            c.chip_type === 'steal_driver' &&
            c.is_used &&
            next && c.race_id === next.id
        )

        // Helper to Swap Data if Stolen
        const processDriverSlot = async (slotDriver) => {
            if (!slotDriver) return null

            // If this is the driver we dropped, we need to show the STOLEN one instead
            if (activeSteal && activeSteal.metadata?.target_driver_id === slotDriver.id) {
                const stolenId = activeSteal.metadata.swapped_driver_id
                const victimTeamId = activeSteal.metadata.victim_team_id

                // Fetch the Stolen Driver's Details
                const { data: stolenDriver } = await supabase.from('drivers').select('*').eq('id', stolenId).single()
                // Fetch the Victim's Owner Name
                const { data: victimTeam } = await supabase.from('teams').select('owner_name').eq('id', victimTeamId).single()

                return {
                    pick_number: getPickNum(pData, slotDriver.id), // Keep original pick number for the slot
                    driver_id: stolenDriver.id,
                    drivers: stolenDriver,
                    type: 'driver',
                    isStolen: true,
                    stolenFrom: victimTeam?.owner_name || 'Rival Team'
                }
            }

            // Normal Driver
            return {
                pick_number: getPickNum(pData, slotDriver.id),
                driver_id: slotDriver.id,
                drivers: slotDriver,
                type: 'driver'
            }
        }

        if (rData) {
            if (rData.driver_1) formattedRoster.push(await processDriverSlot(rData.driver_1))
            if (rData.driver_2) formattedRoster.push(await processDriverSlot(rData.driver_2))
            if (rData.driver_3) formattedRoster.push(await processDriverSlot(rData.driver_3))

            if (rData.constructor) {
                formattedRoster.push({
                    pick_number: getPickNum(pData, null, rData.constructor.id),
                    constructor_id: rData.constructor.id,
                    constructors: rData.constructor,
                    type: 'constructor'
                })
            }
        }

        formattedRoster.sort((a, b) => a.pick_number - b.pick_number)
        setRoster(formattedRoster)

        // 5. Fetch Recaps
        const { data: recapData } = await supabase
            .from('view_team_race_recaps')
            .select('*')
            .eq('team_id', myTeam.id)
            .order('race_date', { ascending: false })

        setRecaps(recapData || [])
        setLoading(false)
    }, [])

    const fetchAuxData = async (teamId) => {
        // 1. Fetch Chips
        const { data: teamChips } = await supabase.from('team_chips').select('*').eq('team_id', teamId)
        setChips(teamChips || [])

        // 2. Fetch Next Race
        const today = new Date().toISOString()
        const { data: next } = await supabase.from('races').select('*').gte('date', today).order('date', { ascending: true }).limit(1).maybeSingle()
        setNextRace(next)

        // 3. Fetch All Drivers
        const { data: drivers } = await supabase.from('drivers').select('id, name, team, code').eq('year', 2026).order('name')

        // 4. NEW: Filter for OWNED drivers only
        // Fetch all rosters EXCEPT my own to see who is available to steal
        const { data: otherRosters } = await supabase
            .from('rosters')
            .select('driver_1_id, driver_2_id, driver_3_id')
            .neq('team_id', teamId)

        // Flatten the roster data into a Set of IDs
        const ownedDriverIds = new Set()
        otherRosters?.forEach(r => {
            if (r.driver_1_id) ownedDriverIds.add(r.driver_1_id)
            if (r.driver_2_id) ownedDriverIds.add(r.driver_2_id)
            if (r.driver_3_id) ownedDriverIds.add(r.driver_3_id)
        })

        // Filter the master list: Only show drivers who are currently on a team
        const stealeableDrivers = drivers?.filter(d => ownedDriverIds.has(d.id)) || []

        setAllDrivers(stealeableDrivers)
    }

    // --- ACTIONS ---

    const updateTeamName = async (newName) => {
        const { error } = await supabase.from('teams').update({ team_name: newName }).eq('id', team.id)
        if (!error) setTeam(prev => ({ ...prev, team_name: newName }))
        return error
    }

    const deploySafetyCar = async () => {
        if (!nextRace) return { error: { message: "No upcoming race." } }
        const { error } = await supabase.from('team_chips').update({ is_used: true, race_id: nextRace.id }).eq('team_id', team.id).eq('chip_type', 'safety_car')
        if (!error) await fetchAuxData(team.id)
        return { error }
    }

    const deploySteal = async (myDriverId, targetDriverId) => {
        if (!nextRace) return { error: { message: "No upcoming race." } }

        // 1. IDENTIFY THE VICTIM TEAM
        const { data: victimRoster, error: rosterError } = await supabase
            .from('rosters')
            .select('team_id')
            .or(`driver_1_id.eq.${targetDriverId},driver_2_id.eq.${targetDriverId},driver_3_id.eq.${targetDriverId}`)
            .maybeSingle()

        if (rosterError || !victimRoster) {
            return { error: { message: "Could not identify the team owning this driver. Try refreshing." } }
        }

        // 2. PREPARE METADATA
        const metadata = {
            target_driver_id: myDriverId,
            swapped_driver_id: targetDriverId,
            victim_team_id: victimRoster.team_id
        }

        // 3. ATTEMPT THE TRANSACTION
        const { error } = await supabase
            .from('team_chips')
            .update({
                is_used: true,
                race_id: nextRace.id,
                metadata: metadata
            })
            .eq('team_id', team.id)
            .eq('chip_type', 'steal_driver')

        // 4. HANDLE CONCURRENCY ERROR
        if (error) {
            if (error.code === '23505') {
                return { error: { message: "LOCKED: Another team has already used the Steal Driver chip for this race! Only one steal is allowed per Grand Prix." } }
            }
            return { error }
        }

        await fetchAuxData(team.id)
        return { error: null }
    }

    // --- DATA GETTERS FOR MODALS ---

    const getStatsData = async (pick, type) => {
        let query = type === 'driver'
            ? supabase.from('driver_stats_view').select('*').eq('driver_id', pick.driver_id)
            : supabase.from('constructor_stats_view').select('*').eq('constructor_id', pick.constructor_id)

        const { data } = await query.eq('year', 2026).maybeSingle()

        return data || { total_fantasy_points: 0, total_real_points: 0, best_finish: '-', dnf_count: 0 }
    }

    const getRecapData = async (raceRecap) => {
        // 1. Get Race Info (Sprint, SC counts)
        const { data: raceInfo } = await supabase
            .from('races')
            .select('is_sprint_weekend, safety_cars, virtual_safety_cars')
            .eq('id', raceRecap.race_id)
            .single()

        const isSprint = raceInfo?.is_sprint_weekend || false
        const scCount = raceInfo?.safety_cars || 0
        const vscCount = raceInfo?.virtual_safety_cars || 0

        // 2. Check for Chips
        const stealChip = chips.find(c => c.chip_type === 'steal_driver' && c.race_id === raceRecap.race_id && c.is_used)
        const scChip = chips.find(c => c.chip_type === 'safety_car' && c.race_id === raceRecap.race_id && c.is_used)

        // 3. FETCH HISTORICAL ROSTER 
        const { data: histRoster } = await supabase
            .from('view_team_historical_rosters')
            .select('*')
            .eq('team_id', team.id)
            .eq('race_id', raceRecap.race_id)

        let effectiveDrivers = (histRoster || [])
            .filter(r => r.entity_type === 'driver')
            .map(d => ({
                id: d.entity_id,
                name: d.name,
                team: d.team_name_or_code
            }))

        const constructorItem = (histRoster || []).find(r => r.entity_type === 'constructor')
        const constructorId = constructorItem?.entity_id
        const constructorName = constructorItem?.name

        // Steal Logic
        if (stealChip) {
            const meta = stealChip.metadata
            if (stealChip.team_id === team.id) {
                const targetIndex = effectiveDrivers.findIndex(d => d.id === meta.target_driver_id)
                if (targetIndex !== -1) {
                    const stolenDriver = allDrivers.find(d => d.id === meta.swapped_driver_id)
                    if (stolenDriver) effectiveDrivers[targetIndex] = { ...stolenDriver, isSwapped: true }
                }
            } else if (meta.victim_team_id === team.id) {
                const stolenIndex = effectiveDrivers.findIndex(d => d.id === meta.swapped_driver_id)
                if (stolenIndex !== -1) {
                    const forcedDriver = allDrivers.find(d => d.id === meta.target_driver_id)
                    if (forcedDriver) effectiveDrivers[stolenIndex] = { ...forcedDriver, isSwapped: true }
                }
            }
        }

        // 4. Fetch Results & Calculate Driver Points
        const driverIds = effectiveDrivers.map(d => d.id)

        const { data: dResults } = await supabase
            .from('race_results')
            .select('driver_id, session_type, position, fantasy_points')
            .eq('race_id', raceRecap.race_id)
            .in('driver_id', driverIds)

        // 🔥 THE FIX: Fetch Constructor Points WITH Driver Codes Joined
        let cResults = []
        if (constructorId) {
            const { data: cData } = await supabase
                .from('race_results')
                .select('session_type, fantasy_points, driver_id, drivers(code)')
                .eq('race_id', raceRecap.race_id)
                .eq('constructor_id', constructorId)
            cResults = cData || []
        }

        // 5. Calculate Scores
        const resultsMap = {}
        let calculatedTotal = 0

        effectiveDrivers.forEach(d => { resultsMap[d.id] = { race: null, qualifying: null, sprint: null } })
        dResults?.forEach(r => {
            if (resultsMap[r.driver_id]) {
                resultsMap[r.driver_id][r.session_type] = { pos: r.position, pts: r.fantasy_points }
                calculatedTotal += (r.fantasy_points || 0)
            }
        })

        // 🔥 THE FIX: Constructor Math & Contribution Breakdown
        let constructorRow = null
        if (constructorId) {
            const agg = { race: 0, qualifying: 0, sprint: 0 }
            const driverBreakdown = {}

            cResults.forEach(r => {
                if (agg[r.session_type] !== undefined) agg[r.session_type] += (r.fantasy_points || 0)

                // Track individual driver points natively via the Supabase join
                if (!driverBreakdown[r.driver_id]) {
                    driverBreakdown[r.driver_id] = {
                        code: r.drivers?.code || 'UNK',
                        pts: 0
                    }
                }
                driverBreakdown[r.driver_id].pts += (r.fantasy_points || 0)
            })

            const hR = agg.race * 0.5; const hQ = agg.qualifying * 0.5; const hS = agg.sprint * 0.5
            calculatedTotal += (hR + hQ + hS)

            // Halve the driver points to match the 0.5x constructor multiplier
            const contributions = Object.values(driverBreakdown).map(d => ({
                code: d.code,
                pts: d.pts * 0.5
            })).sort((a, b) => b.pts - a.pts)

            constructorRow = {
                name: constructorName || 'Unknown Constructor',
                sprintPts: hS, racePts: hR, qualiPts: hQ, total: hR + hQ + hS,
                contributions: contributions // This passes the data to TeamModals.jsx!
            }
        }

        // 6. SAFETY CAR CHIP LOGIC
        let safetyCarRow = null
        if (scChip) {
            const pts = (scCount * 20) + (vscCount * 10)
            calculatedTotal += pts
            safetyCarRow = {
                name: "Safety Car Chip",
                scCount: scCount,
                vscCount: vscCount,
                points: pts
            }
        }

        // 7. Format Driver Rows
        const driverRows = effectiveDrivers.map(d => {
            const res = resultsMap[d.id]
            const col1 = isSprint ? res.sprint : res.qualifying
            const col2 = res.race
            const total = (col1?.pts || 0) + (col2?.pts || 0)
            return { ...d, col1, col2, total }
        })

        return { isSprint, calculatedTotal, driverRows, constructorRow, safetyCarRow }
    }

    useEffect(() => { fetchMyTeam() }, [fetchMyTeam])

    return {
        team, roster, recaps, chips, nextRace, allDrivers, loading,
        updateTeamName, deploySafetyCar, deploySteal, getStatsData, getRecapData,
        switchTeam: fetchMyTeam
    }
}