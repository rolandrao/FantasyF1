import { useEffect, useState } from 'react'
import { supabase } from '../App'
import { getTeamColors } from '../utils/colors'
import LeagueTeamRow from '../components/LeagueTeamRow'

const League = () => {
  const [standings, setStandings] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedTeamId, setExpandedTeamId] = useState(null)

  useEffect(() => {
    fetchLeagueData()
  }, [])

  const fetchLeagueData = async () => {
    setLoading(true)

    // 1. Fetch Basic Data
    const { data: teams } = await supabase.from('teams').select('id, team_name, owner_name, is_bot')
    
    // 2. Fetch Rosters
    const { data: rosters } = await supabase.from('rosters').select(`
        team_id,
        driver_1:drivers!rosters_driver_1_id_fkey (id, code, name, team),
        driver_2:drivers!rosters_driver_2_id_fkey (id, code, name, team),
        driver_3:drivers!rosters_driver_3_id_fkey (id, code, name, team),
        constructor:constructors!rosters_constructor_id_fkey (id, name)
    `)

    // 3. Fetch Picks & Points
    const { data: picks } = await supabase.from('draft_picks').select('team_id, driver_id, constructor_id, pick_number')
    const { data: pointTotals } = await supabase.from('view_team_points_total').select('team_id, total_points')

    // 4. Fetch Chips & Races
    const { data: chips } = await supabase.from('team_chips').select('*')
    
    const { data: races } = await supabase
      .from('races')
      .select('*')
      .eq('year', 2026)
      .order('date', { ascending: true })

    const { data: allDrivers } = await supabase.from('drivers').select('id, name, code, team').eq('year', 2026)
    
    // FETCH ALL RESULTS (needed for summation)
    const { data: results } = await supabase.from('race_results').select('race_id, driver_id, session_type, fantasy_points')

    // 5. DETERMINE ACTIVE CONTEXT (Next Race)
    const today = new Date().toISOString()
    const nextRace = races.find(r => r.date >= today) || races[races.length - 1]

    // --- MERGE DATA ---
    const merged = teams.map(t => {
      // A. Points
      const tPointsRow = pointTotals.find(p => p.team_id === t.id)
      const tPoints = tPointsRow ? tPointsRow.total_points : 0

      // B. Build Base Roster
      const tRoster = rosters.find(r => r.team_id === t.id)

      let drivers = []
      if (tRoster?.driver_1) drivers.push({ ...tRoster.driver_1, pick_number: getPickNumber(picks, tRoster.driver_1.id) })
      if (tRoster?.driver_2) drivers.push({ ...tRoster.driver_2, pick_number: getPickNumber(picks, tRoster.driver_2.id) })
      if (tRoster?.driver_3) drivers.push({ ...tRoster.driver_3, pick_number: getPickNumber(picks, tRoster.driver_3.id) })

      const constructor = tRoster?.constructor 
        ? { ...tRoster.constructor, pick_number: getPickNumber(picks, null, tRoster.constructor.id) } 
        : null

      // C. APPLY STEAL LOGIC (VISUAL SWAP)
      if (nextRace) {
          // Case 1: I am the ATTACKER
          const mySteal = chips.find(c => c.team_id === t.id && c.chip_type === 'steal_driver' && c.race_id === nextRace.id && c.is_used)
          
          if (mySteal && mySteal.metadata) {
              const meta = mySteal.metadata
              const targetIndex = drivers.findIndex(d => d.id === meta.target_driver_id)
              
              if (targetIndex !== -1) {
                  const stolenDriverData = allDrivers.find(d => d.id === meta.swapped_driver_id)
                  const victimTeamName = teams.find(team => team.id === meta.victim_team_id)?.owner_name

                  if (stolenDriverData) {
                      drivers[targetIndex] = {
                          ...stolenDriverData,
                          pick_number: drivers[targetIndex].pick_number,
                          isStolen: true,
                          stolenFrom: victimTeamName
                      }
                  }
              }
          }

          // Case 2: I am the VICTIM
          const victimChip = chips.find(c => 
              c.chip_type === 'steal_driver' && 
              c.race_id === nextRace.id && 
              c.is_used && 
              c.metadata?.victim_team_id === t.id
          )

          if (victimChip && victimChip.metadata) {
              const meta = victimChip.metadata
              const stolenIndex = drivers.findIndex(d => d.id === meta.swapped_driver_id)

              if (stolenIndex !== -1) {
                  const forcedDriverData = allDrivers.find(d => d.id === meta.target_driver_id)
                  const attackerName = teams.find(team => team.id === victimChip.team_id)?.owner_name

                  if (forcedDriverData) {
                      drivers[stolenIndex] = {
                          ...forcedDriverData,
                          pick_number: drivers[stolenIndex].pick_number,
                          isSwapped: true,
                          swappedFrom: attackerName
                      }
                  }
              }
          }
      }

      // D. CHIP NARRATIVE LOGIC
      const myChips = chips.filter(c => c.team_id === t.id)
      
      // Safety Car
      const scChip = myChips.find(c => c.chip_type === 'safety_car')
      let scData = { status: 'available', points: 0, raceName: '' }
      if (scChip && scChip.is_used) {
        scData.status = 'used'
        const race = races.find(r => r.id === scChip.race_id)
        if (race) {
          scData.points = (race.safety_cars * 10) + (race.virtual_safety_cars * 5)
          scData.raceName = race.name
        }
      }

      // Steal Status Text (Narrative)
      let stealData = { status: 'available', narrative: '' }
      const myStealChip = myChips.find(c => c.chip_type === 'steal_driver')

      if (myStealChip && myStealChip.is_used) {
        stealData.status = 'used'
        const race = races.find(r => r.id === myStealChip.race_id)
        const meta = myStealChip.metadata
        if (meta) {
          const stolenName = allDrivers.find(d => d.id === meta.swapped_driver_id)?.name || 'Unknown'
          
          // --- POINTS CALCULATION (Sprint Rule Applied) ---
          let driverResults = results.filter(r => r.race_id === myStealChip.race_id && r.driver_id === meta.swapped_driver_id)
          
          if (race?.is_sprint_weekend) {
             // If Sprint: Exclude 'qualifying'
             driverResults = driverResults.filter(r => r.session_type !== 'qualifying')
          }
          
          const pts = driverResults.reduce((sum, r) => sum + (r.fantasy_points || 0), 0)
          
          stealData.narrative = `ATTACK: Stole ${stolenName} at ${race?.name}. (+${pts} pts)`
        }
      } else {
         // Check if Victim Narrative needed
         const victimChip = chips.find(c => c.chip_type === 'steal_driver' && c.is_used && c.metadata?.victim_team_id === t.id)
         if (victimChip) {
             const race = races.find(r => r.id === victimChip.race_id)
             const meta = victimChip.metadata
             const lostName = allDrivers.find(d => d.id === meta.swapped_driver_id)?.name
             const forcedName = allDrivers.find(d => d.id === meta.target_driver_id)?.name
             
             // --- POINTS CALCULATION (Sprint Rule Applied) ---
             let driverResults = results.filter(r => r.race_id === victimChip.race_id && r.driver_id === meta.target_driver_id)
             
             if (race?.is_sprint_weekend) {
                // If Sprint: Exclude 'qualifying'
                driverResults = driverResults.filter(r => r.session_type !== 'qualifying')
             }

             const pts = driverResults.reduce((sum, r) => sum + (r.fantasy_points || 0), 0)

             stealData.narrative = `VICTIM: Lost ${lostName} at ${race?.name}. Forced to play ${forcedName} (+${pts} pts).`
         }
      }

      return {
        ...t,
        points: tPoints,
        drivers,
        constructor,
        color: getTeamColors(constructor?.name).primary,
        chips: { sc: scData, steal: stealData }
      }
    })

    setStandings(merged.sort((a, b) => b.points - a.points))
    setLoading(false)
  }

  const getPickNumber = (allPicks, driverId, constructorId) => {
    const found = allPicks.find(p => (driverId && p.driver_id === driverId) || (constructorId && p.constructor_id === constructorId))
    return found ? found.pick_number : null
  }

  if (loading) return <div className="min-h-screen bg-neutral-900 text-white flex items-center justify-center animate-pulse">Loading Championship Data...</div>

  return (
    <div className="min-h-screen bg-neutral-900 text-white pb-24">
      {/* HEADER */}
      <div className="p-6 md:p-10 border-b border-white/10 bg-gradient-to-b from-neutral-800 to-neutral-900 sticky top-0 z-20 shadow-xl backdrop-blur-sm">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-3xl md:text-5xl font-black italic tracking-tighter mb-1">
            LEAGUE <span className="text-f1-red">STANDINGS</span>
          </h1>
          <p className="text-gray-400 text-xs md:text-sm font-bold uppercase tracking-widest">
            Season 2026 • Era 1
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 mt-6 space-y-3">
        {standings.map((team, index) => (
          <LeagueTeamRow
            key={team.id}
            team={team}
            rank={index + 1}
            isExpanded={expandedTeamId === team.id}
            onToggle={() => setExpandedTeamId(expandedTeamId === team.id ? null : team.id)}
          />
        ))}
      </div>
    </div>
  )
}

export default League