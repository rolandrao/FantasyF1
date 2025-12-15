import { schedule } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL, 
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const syncLogic = async (event) => {
  try {
    // 1. DEFINE YEARS TO SYNC
    // We explicitly want 2025 (historical context) and 2026 (current/future)
    const yearsToSync = [2025, 2026]
    
    console.log(`🏁 Starting Multi-Year Sync: ${yearsToSync.join(', ')}`)

    // Loop through each year
    for (const year of yearsToSync) {
        await syncSeason(year)
    }

    return { statusCode: 200 }

  } catch (error) {
    console.error("Sync Failed:", error)
    return { statusCode: 500 }
  }
}

// Helper function to handle a specific year
const syncSeason = async (year) => {
    console.log(`--- Syncing Season ${year} ---`)

    // A. SYNC SCHEDULE
    const scheduleResp = await fetch(`http://api.jolpi.ca/ergast/f1/${year}.json`)
    const scheduleData = await scheduleResp.json()
    const allRaces = scheduleData.MRData.RaceTable.Races

    if (!allRaces || allRaces.length === 0) {
        console.log(`No data found for ${year} yet.`)
        return
    }

    for (const race of allRaces) {
      if (race.raceName.includes('Test') || race.round === "0") continue;

      const { error: raceErr } = await supabaseAdmin
        .from('races')
        .upsert({
          year: parseInt(race.season),
          round: parseInt(race.round),
          name: race.raceName,
          date: race.date,
          time: race.time, 
          circuit: race.Circuit.circuitName,
          country: race.Circuit.Location.country,
          // Optional: You can map FP/Quali times here if needed
        }, { onConflict: 'year, round' })
      
      if (raceErr) console.error(`Error syncing ${year} ${race.raceName}:`, raceErr)
    }
    console.log(`✅ ${year} Schedule Synced`)


    // B. PROCESS RESULTS (Helper)
    const fetchAndUpsert = async (url, sessionType) => {
      const resp = await fetch(url)
      const data = await resp.json()
      const races = data.MRData.RaceTable.Races

      if (!races.length) return;

      for (const race of races) {
        // Find Race ID
        const { data: dbRace } = await supabaseAdmin
          .from('races')
          .select('id')
          .eq('year', parseInt(race.season))
          .eq('round', parseInt(race.round))
          .single()

        if (!dbRace) continue;

        // Determine list
        const resultList = race.Results || race.QualifyingResults || race.SprintResults || []

        for (const row of resultList) {
           // Upsert Driver
           const { data: dbDriver } = await supabaseAdmin
             .from('drivers')
             .upsert({
                name: `${row.Driver.givenName} ${row.Driver.familyName}`,
                number: parseInt(row.number),
                nationality: row.Driver.nationality,
                code: row.Driver.code || row.Driver.driverId.substring(0,3).toUpperCase()
             }, { onConflict: 'code' }).select().single()

           // Upsert Constructor
           const { data: dbConstructor } = await supabaseAdmin
             .from('constructors')
             .upsert({
                name: row.Constructor.name,
                nationality: row.Constructor.nationality
             }, { onConflict: 'name' }).select().single()

           // Upsert Result
           if (dbDriver && dbConstructor) {
             await supabaseAdmin.from('race_results').upsert({
               race_id: dbRace.id,
               driver_id: dbDriver.id,
               constructor_id: dbConstructor.id,
               session_type: sessionType,
               position: parseInt(row.position),
               points: parseFloat(row.points || 0),
               grid: parseInt(row.grid || 0),
               status: row.status,
               fastest_lap_time: row.FastestLap?.Time?.time || null
             }, { onConflict: 'race_id, driver_id, session_type' })
           }
        }
      }
      console.log(`✅ ${year} ${sessionType} results synced`)
    }

    // C. EXECUTE FETCHES FOR THIS YEAR
    await fetchAndUpsert(`http://api.jolpi.ca/ergast/f1/${year}/results.json?limit=1000`, 'race')
    await fetchAndUpsert(`http://api.jolpi.ca/ergast/f1/${year}/sprint.json?limit=1000`, 'sprint')
    await fetchAndUpsert(`http://api.jolpi.ca/ergast/f1/${year}/qualifying.json?limit=1000`, 'qualifying')
}

export const handler = schedule('0 0 * * *', syncLogic)