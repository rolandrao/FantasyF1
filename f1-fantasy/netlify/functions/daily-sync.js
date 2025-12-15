import { schedule } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'

// 1. Setup Supabase Admin Client
const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL, 
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Internal function logic (renamed to avoid naming conflict)
const syncLogic = async (event) => {
  try {
    const currentYear = new Date().getFullYear()
    console.log(`🏁 Starting F1 Sync for ${currentYear}...`)

    const response = await fetch(`http://api.jolpi.ca/ergast/f1/${currentYear}/results.json?limit=1000`)
    const data = await response.json()
    const races = data.MRData.RaceTable.Races

    if (!races || races.length === 0) {
      console.log("No races found.")
      return { statusCode: 200 }
    }

    for (const race of races) {
      // Upsert Race
      const { data: dbRace, error: raceErr } = await supabaseAdmin
        .from('races')
        .upsert({
          year: parseInt(race.season),
          round: parseInt(race.round),
          name: race.raceName,
          date: race.date,
          circuit: race.Circuit.circuitName,
          country: race.Circuit.Location.country
        }, { onConflict: 'year, round' })
        .select()
        .single()

      if (raceErr) {
        console.error(`Error syncing race ${race.raceName}:`, raceErr)
        continue
      }

      // Upsert Results
      const results = race.Results || []
      
      for (const row of results) {
        // Upsert Driver
        const { data: dbDriver } = await supabaseAdmin
          .from('drivers')
          .upsert({
            name: `${row.Driver.givenName} ${row.Driver.familyName}`,
            number: parseInt(row.number),
            nationality: row.Driver.nationality,
            code: row.Driver.code || row.Driver.driverId.substring(0,3).toUpperCase()
          }, { onConflict: 'code' }) 
          .select().single()

        // Upsert Constructor
        const { data: dbConstructor } = await supabaseAdmin
          .from('constructors')
          .upsert({
            name: row.Constructor.name,
            nationality: row.Constructor.nationality
          }, { onConflict: 'name' })
          .select().single()

        // Upsert Stats
        if (dbRace && dbDriver && dbConstructor) {
           await supabaseAdmin.from('race_results').upsert({
             race_id: dbRace.id,
             driver_id: dbDriver.id,
             constructor_id: dbConstructor.id,
             position: parseInt(row.position),
             points: parseFloat(row.points),
             grid: parseInt(row.grid),
             status: row.status,
             fastest_lap_rank: row.FastestLap?.rank || null,
             fastest_lap_time: row.FastestLap?.Time?.time || null
           }, { onConflict: 'race_id, driver_id' })
        }
      }
    }

    console.log(`✅ Synced ${races.length} races.`)
    return { statusCode: 200 }

  } catch (error) {
    console.error("Sync Failed:", error)
    return { statusCode: 500 }
  }
}

// 4. Schedule the Cron Job
// The export MUST be named 'handler'
export const handler = schedule('0 0 * * *', syncLogic)