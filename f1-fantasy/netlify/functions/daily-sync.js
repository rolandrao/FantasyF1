import { schedule } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL, 
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// --- HELPER: AUTO-PAGINATION ---
// Fetches all pages of data (handling limits > 100)
const fetchAllPages = async (baseUrl) => {
  let allResults = []
  let offset = 0
  const limit = 100 
  let total = 0

  do {
    const separator = baseUrl.includes('?') ? '&' : '?'
    const url = `${baseUrl}${separator}limit=${limit}&offset=${offset}`
    
    // Safety Delay: 200ms to avoid API rate limits
    await new Promise(r => setTimeout(r, 200))

    const resp = await fetch(url)
    if (!resp.ok) {
        console.error(`❌ API Error ${resp.status} at ${url}`)
        break;
    }

    const data = await resp.json()
    if (!data.MRData || !data.MRData.RaceTable) break;
    
    const races = data.MRData.RaceTable.Races || []
    allResults = [...allResults, ...races]
    
    total = parseInt(data.MRData.total)
    offset += limit
    
    if (offset > 1000) break; // Hard stop safety
  } while (offset < total)

  return allResults
}

const syncLogic = async (event) => {
  try {
    // We strictly define the years we want to maintain
    const yearsToSync = [2025, 2026]
    console.log(`🚀 Starting Multi-Year Sync for: ${yearsToSync.join(', ')}`)

    for (const year of yearsToSync) {
      await syncSeasonComplete(year)
    }
    return { statusCode: 200 }
  } catch (error) {
    console.error("❌ Critical Sync Failure:", error)
    return { statusCode: 500 }
  }
}

const syncSeasonComplete = async (year) => {
  console.log(`\n📅 Processing Season ${year}...`)

  // 1. FETCH & SYNC SCHEDULE
  const scheduleResp = await fetch(`http://api.jolpi.ca/ergast/f1/${year}.json`)
  const scheduleData = await scheduleResp.json()
  const apiRaces = scheduleData.MRData?.RaceTable?.Races || []

  if (apiRaces.length === 0) {
    console.log(`   -> No schedule found for ${year}.`)
    return
  }

  const racesPayload = apiRaces.map(r => ({
    year: parseInt(r.season),
    round: parseInt(r.round),
    name: r.raceName,
    date: r.date,
    time: r.time,
    circuit: r.Circuit.circuitName,
    country: r.Circuit.Location.country,
    is_sprint_weekend: !!r.Sprint
  }))

  const { error: raceErr } = await supabaseAdmin
    .from('races')
    .upsert(racesPayload, { onConflict: 'year, round' })
  
  if (raceErr) console.error(`   -> Race Sync Error:`, raceErr)
  
  // 2. FETCH EXISTING RACES (Map Round -> ID)
  // We need to map the API "Round 1" to your Database UUID
  const { data: dbRaces } = await supabaseAdmin
    .from('races')
    .select('id, round')
    .eq('year', year)

  if (!dbRaces) return
  const raceMap = {}; dbRaces.forEach(r => { raceMap[r.round] = r.id })

  // 3. FETCH ALL RESULTS (Sequentially)
  console.log("   -> Fetching full result lists...")
  const raceRaces = await fetchAllPages(`http://api.jolpi.ca/ergast/f1/${year}/results.json`)
  const sprintRaces = await fetchAllPages(`http://api.jolpi.ca/ergast/f1/${year}/sprint.json`)
  const qualiRaces = await fetchAllPages(`http://api.jolpi.ca/ergast/f1/${year}/qualifying.json`)

  // 4. PREPARE DATA CONTAINERS
  const driversToUpsert = new Map()
  const constructorsToUpsert = new Map()
  const resultsPayload = []

  // Helper: Extract Qualifying Time vs Race Time
  const getBestTime = (row, sessionType) => {
      if (sessionType === 'qualifying') {
         return row.Q3 || row.Q2 || row.Q1 || null
      }
      return row.FastestLap?.Time?.time || null
  }

  const processList = (racesList, sessionType) => {
    if (!racesList) return

    for (const race of racesList) {
      const raceId = raceMap[parseInt(race.round)]
      if (!raceId) continue

      // Explicitly select the correct list based on session type
      let list = []
      if (sessionType === 'race') list = race.Results || []
      else if (sessionType === 'sprint') list = race.SprintResults || []
      else if (sessionType === 'qualifying') list = race.QualifyingResults || []

      for (const row of list) {
        if (!row.Driver) continue; 
        
        // --- DRIVER ---
        const dCode = row.Driver.code || row.Driver.driverId.substring(0,3).toUpperCase()
        
        // We use .set() to ensure we capture the latest team info for this year
        driversToUpsert.set(dCode, {
            year: year, // <--- CRITICAL: Links driver to specific season
            name: `${row.Driver.givenName} ${row.Driver.familyName}`,
            number: row.number ? parseInt(row.number) : null,
            nationality: row.Driver.nationality,
            code: dCode,
            team: row.Constructor?.name 
        })
        
        // --- CONSTRUCTOR ---
        const cName = row.Constructor?.name
        if (cName) {
            constructorsToUpsert.set(cName, { 
                year: year, // <--- CRITICAL: Links team to specific season
                name: cName, 
                nationality: row.Constructor.nationality 
            })
        }
        
        // --- RESULT ---
        resultsPayload.push({
            race_id: raceId,
            driver_code: dCode,
            constructor_name: cName,
            session_type: sessionType,
            position: parseInt(row.position),
            points: parseFloat(row.points || 0),
            grid: parseInt(row.grid || 0),
            status: row.status || 'Finished',
            fastest_lap_time: getBestTime(row, sessionType)
        })
      }
    }
  }

  processList(raceRaces, 'race')
  processList(sprintRaces, 'sprint')
  processList(qualiRaces, 'qualifying')

  // 5. UPSERT DRIVERS & CONSTRUCTORS
  // Note: We changed onConflict to include 'year'
  if (driversToUpsert.size > 0) {
      const { error } = await supabaseAdmin
        .from('drivers')
        .upsert(Array.from(driversToUpsert.values()), { onConflict: 'year, code' })
      if (error) console.error("   ❌ Driver Sync Error:", error)
  }

  if (constructorsToUpsert.size > 0) {
      const { error } = await supabaseAdmin
        .from('constructors')
        .upsert(Array.from(constructorsToUpsert.values()), { onConflict: 'year, name' })
      if (error) console.error("   ❌ Constructor Sync Error:", error)
  }

  // 6. MAP IDS (Year-Filtered) & UPSERT RESULTS
  // We must fetch IDs strictly for the current YEAR to avoid linking to 2025 entities in 2026
  const { data: allDrivers } = await supabaseAdmin
    .from('drivers')
    .select('id, code')
    .eq('year', year) 

  const { data: allConstructors } = await supabaseAdmin
    .from('constructors')
    .select('id, name')
    .eq('year', year)

  const dMap = {}; allDrivers?.forEach(d => dMap[d.code] = d.id)
  const cMap = {}; allConstructors?.forEach(c => cMap[c.name] = c.id)

  const finalResults = []
  resultsPayload.forEach(r => {
      const dId = dMap[r.driver_code]
      const cId = cMap[r.constructor_name]
      
      // Only add result if we successfully found both IDs for this year
      if (dId && cId) {
          finalResults.push({
              race_id: r.race_id,
              driver_id: dId,
              constructor_id: cId,
              session_type: r.session_type,
              position: r.position,
              points: r.points,
              grid: r.grid,
              status: r.status,
              fastest_lap_time: r.fastest_lap_time
          })
      }
  })

  if (finalResults.length > 0) {
      const { error } = await supabaseAdmin
        .from('race_results')
        .upsert(finalResults, { onConflict: 'race_id, driver_id, session_type' })
      
      if (error) console.error("   ❌ Result Write Error:", error)
      else console.log(`   -> ✅ Successfully synced ${finalResults.length} TOTAL results.`)
  } else {
      console.log("   -> No results to sync (Season might not have started).")
  }
}

export const handler = schedule('0 0 * * *', syncLogic)