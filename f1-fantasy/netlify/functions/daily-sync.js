import { schedule } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL, 
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// --- HELPER: AUTO-PAGINATION ---
const fetchAllPages = async (baseUrl) => {
  let allResults = []
  let offset = 0
  const limit = 100 
  let total = 0

  do {
    const separator = baseUrl.includes('?') ? '&' : '?'
    const url = `${baseUrl}${separator}limit=${limit}&offset=${offset}`
    await new Promise(r => setTimeout(r, 200)) // Safety Delay

    const resp = await fetch(url)
    if (!resp.ok) break;

    const data = await resp.json()
    if (!data.MRData || !data.MRData.RaceTable) break;
    
    const races = data.MRData.RaceTable.Races || []
    allResults = [...allResults, ...races]
    
    total = parseInt(data.MRData.total)
    offset += limit
    
    if (offset > 1000) break;
  } while (offset < total)

  return allResults
}

const syncLogic = async (event) => {
  try {
    const yearsToSync = [2025, 2026]
    console.log(`🚀 Starting Final Sync for: ${yearsToSync.join(', ')}`)

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
  const apiRaces = scheduleData.MRData?.RaceTable?.Races

  if (!apiRaces || apiRaces.length === 0) {
    console.log(`   -> No schedule for ${year}.`)
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

  const { error: raceErr } = await supabaseAdmin.from('races').upsert(racesPayload, { onConflict: 'year, round' })
  if (raceErr) console.error(`   -> Race Sync Error:`, raceErr)
  
  // 2. FETCH EXISTING RACES (Map Round -> ID)
  const { data: dbRaces } = await supabaseAdmin.from('races').select('id, round').eq('year', year)
  if (!dbRaces) return
  const raceMap = {}; dbRaces.forEach(r => { raceMap[r.round] = r.id })

  // 3. FETCH ALL RESULTS
  console.log("   -> Fetching full result lists...")
  const raceRaces = await fetchAllPages(`http://api.jolpi.ca/ergast/f1/${year}/results.json`)
  const sprintRaces = await fetchAllPages(`http://api.jolpi.ca/ergast/f1/${year}/sprint.json`)
  const qualiRaces = await fetchAllPages(`http://api.jolpi.ca/ergast/f1/${year}/qualifying.json`)

  // 4. PREPARE DATA
  const driversToUpsert = new Map()
  const constructorsToUpsert = new Map()
  const resultsPayload = []

  // HELPER: Extract Best Time
  const getBestTime = (row, sessionType) => {
      if (sessionType === 'qualifying') {
         // Try every possible key that Ergast might use
         return row.Q3 || row.Q2 || row.Q1 || null
      }
      return row.FastestLap?.Time?.time || null
  }

  const processList = (racesList, sessionType) => {
    if (!racesList) return

    let rowCount = 0
    let debugLogged = false

    for (const race of racesList) {
      const raceId = raceMap[parseInt(race.round)]
      if (!raceId) continue

      // EXPLICIT SELECTION: Don't guess. Use the specific list for this type.
      let list = []
      if (sessionType === 'race') list = race.Results || []
      else if (sessionType === 'sprint') list = race.SprintResults || []
      else if (sessionType === 'qualifying') list = race.QualifyingResults || []

      for (const row of list) {
        rowCount++
        if (!row.Driver) continue; 
        
        // DEBUG: Print the first qualifying row to see structure
        if (sessionType === 'qualifying' && !debugLogged) {
            console.log("   🔎 DEBUG QUALI ROW:", JSON.stringify(row).substring(0, 200) + "...")
            debugLogged = true
        }

        const dCode = row.Driver.code || row.Driver.driverId.substring(0,3).toUpperCase()
        if (!driversToUpsert.has(dCode)) {
            driversToUpsert.set(dCode, {
                name: `${row.Driver.givenName} ${row.Driver.familyName}`,
                number: row.number ? parseInt(row.number) : null,
                nationality: row.Driver.nationality,
                code: dCode
            })
        }
        
        const cName = row.Constructor?.name
        if (cName && !constructorsToUpsert.has(cName)) {
            constructorsToUpsert.set(cName, { name: cName, nationality: row.Constructor.nationality })
        }
        
        resultsPayload.push({
            race_id: raceId,
            driver_code: dCode,
            constructor_name: cName,
            session_type: sessionType,
            position: parseInt(row.position),
            points: parseFloat(row.points || 0),
            grid: parseInt(row.grid || 0),
            status: row.status || 'Finished',
            fastest_lap_time: getBestTime(row, sessionType) // <--- CRITICAL FIX
        })
      }
    }
    console.log(`   -> Processed ${rowCount} ${sessionType} rows`)
  }

  processList(raceRaces, 'race')
  processList(sprintRaces, 'sprint')
  processList(qualiRaces, 'qualifying')

  // 5. UPSERT
  if (driversToUpsert.size > 0) {
      await supabaseAdmin.from('drivers').upsert(Array.from(driversToUpsert.values()), { onConflict: 'code' })
  }
  if (constructorsToUpsert.size > 0) {
      await supabaseAdmin.from('constructors').upsert(Array.from(constructorsToUpsert.values()), { onConflict: 'name' })
  }

  // 6. MAP & FINALIZE
  const { data: allDrivers } = await supabaseAdmin.from('drivers').select('id, code')
  const { data: allConstructors } = await supabaseAdmin.from('constructors').select('id, name')

  const dMap = {}; allDrivers?.forEach(d => dMap[d.code] = d.id)
  const cMap = {}; allConstructors?.forEach(c => cMap[c.name] = c.id)

  const finalResults = []
  resultsPayload.forEach(r => {
      const dId = dMap[r.driver_code]
      const cId = cMap[r.constructor_name]
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
      const { error } = await supabaseAdmin.from('race_results').upsert(finalResults, { onConflict: 'race_id, driver_id, session_type' })
      if (error) console.error("   ❌ Result Write Error:", error)
      else console.log(`   -> ✅ Successfully synced ${finalResults.length} TOTAL results.`)
  }
}

export const handler = schedule('0 0 * * *', syncLogic)