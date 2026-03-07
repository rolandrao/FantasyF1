import { schedule } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL, 
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// --- CONFIGURATION ---
const DURATIONS = { qualifying: 90, sprint: 90, race: 180 }
const SYNC_WINDOW_MINUTES = 180 

const fetchAllPages = async (baseUrl) => {
  let allResults = []
  let offset = 0
  const limit = 100 
  let total = 0

  do {
    const separator = baseUrl.includes('?') ? '&' : '?'
    const url = `${baseUrl}${separator}limit=${limit}&offset=${offset}`
    
    await new Promise(r => setTimeout(r, 200))
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
    const now = new Date()
    console.log(`\n=========================================================`)
    console.log(`🚀 STARTING SYNC EXECUTION: ${now.toISOString()}`)
    console.log(`=========================================================`)

    const yearsToSync = [2025, 2026]
    
    
    if (shouldRunSync) {
        for (const year of yearsToSync) {
            await syncSeasonComplete(year)
        }
        console.log(`✅ SYNC COMPLETE\n`)
        return { statusCode: 200, body: "Sync Executed" }
    }
  } catch (error) {
    console.error("❌ Critical Sync Failure:", error)
    return { statusCode: 500 }
  }
}

const syncSeasonComplete = async (year) => {
  console.log(`\n📅 --- PROCESSING SEASON ${year} ---`)

  // 1. FETCH & SYNC SCHEDULE
  const scheduleResp = await fetch(`http://api.jolpi.ca/ergast/f1/${year}.json`)
  const scheduleData = await scheduleResp.json()
  const apiRaces = scheduleData.MRData?.RaceTable?.Races || []
  if (apiRaces.length === 0) return

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

  await supabaseAdmin.from('races').upsert(racesPayload, { onConflict: 'year, round' })
  
  // 2. FETCH EXISTING RACES
  const { data: dbRaces } = await supabaseAdmin.from('races').select('id, round').eq('year', year)
  if (!dbRaces) return
  const raceMap = {}; dbRaces.forEach(r => { raceMap[r.round] = r.id })

  // 3. FETCH RESULTS
  const raceRaces = await fetchAllPages(`http://api.jolpi.ca/ergast/f1/${year}/results.json`)
  const sprintRaces = await fetchAllPages(`http://api.jolpi.ca/ergast/f1/${year}/sprint.json`)
  const qualiRaces = await fetchAllPages(`http://api.jolpi.ca/ergast/f1/${year}/qualifying.json`)

  // 4. PROCESS PAYLOADS
  const driversToUpsert = new Map()
  const constructorsToUpsert = new Map()
  const resultsPayload = []

  const getBestTime = (row, sessionType) => {
      if (sessionType === 'qualifying') return row.Q3 || row.Q2 || row.Q1 || null
      return row.FastestLap?.Time?.time || null
  }

  const processList = (racesList, sessionType) => {
    if (!racesList || racesList.length === 0) return

    for (const race of racesList) {
      const raceId = raceMap[parseInt(race.round)]
      if (!raceId) continue

      let list = []
      if (sessionType === 'race') list = race.Results || []
      else if (sessionType === 'sprint') list = race.SprintResults || []
      else if (sessionType === 'qualifying') list = race.QualifyingResults || []

      for (const row of list) {
        if (!row.Driver) continue; 
        
        const dCode = row.Driver.code || row.Driver.driverId.substring(0,3).toUpperCase()
        const cName = row.Constructor?.name
        
        driversToUpsert.set(dCode, {
            year: year,
            name: `${row.Driver.givenName} ${row.Driver.familyName}`,
            number: row.number ? parseInt(row.number) : null,
            nationality: row.Driver.nationality,
            code: dCode,
            team: cName 
        })
        
        if (cName) constructorsToUpsert.set(cName, { year: year, name: cName, nationality: row.Constructor.nationality })
        
        resultsPayload.push({
            race_id: raceId,
            driver_code: dCode,
            constructor_name: cName,
            session_type: sessionType,
            position: parseInt(row.position),
            real_points: parseFloat(row.points || 0), 
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

  if (driversToUpsert.size > 0) await supabaseAdmin.from('drivers').upsert(Array.from(driversToUpsert.values()), { onConflict: 'year, code' })
  if (constructorsToUpsert.size > 0) await supabaseAdmin.from('constructors').upsert(Array.from(constructorsToUpsert.values()), { onConflict: 'year, name' })

  const { data: allDrivers } = await supabaseAdmin.from('drivers').select('id, code, team').eq('year', year) 
  const { data: allConstructors } = await supabaseAdmin.from('constructors').select('id, name').eq('year', year)

  const dMap = {}; allDrivers?.forEach(d => dMap[d.code] = d.id)
  const cMap = {}; allConstructors?.forEach(c => cMap[c.name] = c.id)

  const finalResults = []
  const participated = {} 

  resultsPayload.forEach(r => {
      const dId = dMap[r.driver_code]
      const cId = cMap[r.constructor_name]
      
      if (dId && cId) {
          if (!participated[r.race_id]) participated[r.race_id] = {}
          if (!participated[r.race_id][r.session_type]) participated[r.race_id][r.session_type] = new Set()
          participated[r.race_id][r.session_type].add(dId)

          finalResults.push({
              race_id: r.race_id,
              driver_id: dId,
              constructor_id: cId,
              session_type: r.session_type,
              position: r.position,
              real_points: r.real_points, 
              grid: r.grid,
              status: r.status,
              fastest_lap_time: r.fastest_lap_time
          })
      }
  })

  // --- 5. AUTOMATIC ENTRY LIST SYNC (OPENF1) ---
  console.log("   -> 🏎️ Syncing Official Entry Lists from OpenF1...")
  for (const race of racesPayload) {
      const raceDate = new Date(race.date)
      const daysSince = (new Date() - raceDate) / (1000 * 60 * 60 * 24)

      // Only sync OpenF1 entry lists for races happening right now or within the last week
      if (Math.abs(daysSince) > 7) continue;

      try {
          // Fetch meetings to find the specific meeting_key for this race
          const meetResp = await fetch(`https://api.openf1.org/v1/meetings?year=${year}`)
          const meetings = await meetResp.json()

          const meeting = meetings.find(m => {
              const mDate = new Date(m.date_start)
              return Math.abs((mDate - raceDate) / (1000 * 60 * 60 * 24)) <= 5
          })

          if (meeting) {
              const driversResp = await fetch(`https://api.openf1.org/v1/drivers?meeting_key=${meeting.meeting_key}`)
              const driversData = await driversResp.json()

              // Extract unique 3-letter codes
              const activeDriverCodes = [...new Set(driversData.map(d => d.name_acronym))].filter(Boolean)

              if (activeDriverCodes.length > 0) {
                  console.log(`      ✅ Found ${activeDriverCodes.length} active drivers for ${race.name} via OpenF1!`)
                  const raceUUID = raceMap[race.round]
                  const activePayload = []

                  for (const code of activeDriverCodes) {
                      const driverUUID = dMap[code] // Match to our DB
                      if (driverUUID && raceUUID) {
                          activePayload.push({ race_id: raceUUID, driver_id: driverUUID })
                      }
                  }

                  // Force push the official roster into the database
                  if (activePayload.length > 0) {
                      await supabaseAdmin.from('active_drivers').upsert(activePayload, { onConflict: 'race_id, driver_id' })
                  }
              }
          }
      } catch (err) {
          console.error(`      ⚠️ OpenF1 Entry List sync failed for ${race.name}:`, err.message)
      }
  }

  // --- 6. FETCH ACTIVE DRIVERS FOR BACKFILL ---
  const { data: activeDriversData } = await supabaseAdmin.from('active_drivers').select('race_id, driver_id')
  const expectedActiveDrivers = {}
  
  activeDriversData?.forEach(row => {
      if (!expectedActiveDrivers[row.race_id]) expectedActiveDrivers[row.race_id] = new Set()
      expectedActiveDrivers[row.race_id].add(row.driver_id)
  })

  // --- 7. TARGETED BACKFILL ---
  for (const raceId of Object.keys(participated)) {
      for (const sessionType of Object.keys(participated[raceId])) {
          const driversInSession = participated[raceId][sessionType]
          const activeDriversForThisRace = expectedActiveDrivers[raceId] || new Set()

          if (driversInSession.size > 0) {
              for (const driverId of activeDriversForThisRace) {
                  if (!driversInSession.has(driverId)) {
                      const driver = allDrivers.find(d => d.id === driverId)
                      if (!driver) continue;

                      console.log(`      ⚠️ Targeted Backfill: Missing DB driver ${driver.code} for ${sessionType}`)
                      
                      const fallbackCId = cMap[driver.team] || null 

                      finalResults.push({
                          race_id: raceId,
                          driver_id: driverId,
                          constructor_id: fallbackCId,
                          session_type: sessionType,
                          position: 0,
                          real_points: 0,
                          grid: 0,
                          status: 'DNS', 
                          fastest_lap_time: null
                      })
                  }
              }
          }
      }
  }

  // --- 8. WRITE TO SUPABASE ---
  if (finalResults.length > 0) {
      await supabaseAdmin.from('race_results').upsert(finalResults, { onConflict: 'race_id, driver_id, session_type' })
      console.log(`   ✅ SUCCESSFULLY WROTE ${finalResults.length} ROWS TO DATABASE!`)
  }
}

export const handler = schedule('0 * * * *', syncLogic)