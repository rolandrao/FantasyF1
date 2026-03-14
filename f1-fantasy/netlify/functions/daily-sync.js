import { schedule } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL, 
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// --- CONFIGURATION ---
const SYNC_WINDOW_MINUTES = 180 // 3-hour window for syncing after a session ends

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
    
    // ========================================================================
    // ⚠️ MANUAL OVERRIDE TOGGLE (FOR LOCAL TESTING & MISSED RACES) ⚠️
    // ========================================================================
    // To force the sync to run RIGHT NOW (bypassing the time lock):
    // Change `let forceSync = false;` to `let forceSync = true;`
    // 
    // IMPORTANT: ALWAYS CHANGE IT BACK TO `false` BEFORE MERGING TO GITHUB!
    // ========================================================================
    
    let forceSync = false; // <--- CHANGE THIS TO true TO FORCE A RUN
    
    // ========================================================================

    let shouldRunSync = forceSync;

    if (forceSync) {
        console.log(`⚠️ FORCE SYNC ENABLED: Bypassing automated time checks!`)
    } else {
        // --- NORMAL AUTOMATED SESSION TRACKING ---
        // Fetch live schedule from Jolpi/Ergast to get precise Quali and Sprint times
        // (Since our database only stores the Main Race time)
        const scheduleResp = await fetch(`http://api.jolpi.ca/ergast/f1/2026.json`);
        const scheduleData = await scheduleResp.json();
        const currentRaces = scheduleData.MRData?.RaceTable?.Races || [];

        for (const race of currentRaces) {
          // Helper to check if current time is within the sync window for a specific session
          const isWindowOpen = (dateStr, timeStr, durationHours) => {
            if (!dateStr || !timeStr) return false;
            
            // 1. Calculate when the session actually finishes (Start Time + Duration)
            const sessionStart = new Date(`${dateStr}T${timeStr}`);
            const sessionEnd = new Date(sessionStart.getTime() + (durationHours * 60 * 60 * 1000));
            
            // 2. The sync window opens EXACTLY when the session ends and stays open for 3 hours
            const syncStart = sessionEnd;
            const syncEnd = new Date(sessionEnd.getTime() + (SYNC_WINDOW_MINUTES * 60 * 1000));
            
            return now >= syncStart && now <= syncEnd;
          };

          // Check Main Race (approx 2 hours long)
          if (isWindowOpen(race.date, race.time, 2)) {
            console.log(`🚀 TRIGGER: ${race.raceName} (Main Race) finished recently.`);
            shouldRunSync = true; break;
          }
          
          // Check Sprint (approx 1 hour long)
          if (race.Sprint && isWindowOpen(race.Sprint.date, race.Sprint.time, 1)) {
            console.log(`🚀 TRIGGER: ${race.raceName} (Sprint) finished recently.`);
            shouldRunSync = true; break;
          }
          
          // Check Qualifying (approx 1 hour long)
          if (race.Qualifying && isWindowOpen(race.Qualifying.date, race.Qualifying.time, 1)) {
            console.log(`🚀 TRIGGER: ${race.raceName} (Qualifying) finished recently.`);
            shouldRunSync = true; break;
          }
        }
    }
    
    if (shouldRunSync) {
        for (const year of yearsToSync) {
            await syncSeasonComplete(year)
        }
        console.log(`✅ SYNC COMPLETE\n`)
        return { statusCode: 200, body: "Sync Executed" }
    } else {
        console.log(`💤 No active sessions detected. Skipping sync to save resources.`)
        return { statusCode: 200, body: "Skipped" }
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
  
  const { data: dbRaces } = await supabaseAdmin.from('races').select('id, round').eq('year', year)
  if (!dbRaces) return
  const raceMap = {}; dbRaces.forEach(r => { raceMap[r.round] = r.id })

  // 2. FETCH RESULTS FROM API
  const raceRaces = await fetchAllPages(`http://api.jolpi.ca/ergast/f1/${year}/results.json`)
  const sprintRaces = await fetchAllPages(`http://api.jolpi.ca/ergast/f1/${year}/sprint.json`)
  const qualiRaces = await fetchAllPages(`http://api.jolpi.ca/ergast/f1/${year}/qualifying.json`)

  // 3. PROCESS PAYLOADS
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
            year: year, name: `${row.Driver.givenName} ${row.Driver.familyName}`,
            number: row.number ? parseInt(row.number) : null,
            nationality: row.Driver.nationality, code: dCode, team: cName 
        })
        
        if (cName) constructorsToUpsert.set(cName, { year: year, name: cName, nationality: row.Constructor.nationality })
        
        resultsPayload.push({
            race_id: raceId, driver_code: dCode, constructor_name: cName,
            session_type: sessionType, position: parseInt(row.position),
            real_points: parseFloat(row.points || 0), grid: parseInt(row.grid || 0),
            status: row.status || 'Finished', fastest_lap_time: getBestTime(row, sessionType)
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
              race_id: r.race_id, driver_id: dId, constructor_id: cId,
              session_type: r.session_type, position: r.position,
              real_points: r.real_points, grid: r.grid, status: r.status,
              fastest_lap_time: r.fastest_lap_time
          })
      }
  })

// 4. OPENF1 ENTRY LIST SYNC (For Backfilling Scratched Drivers)
  console.log("   -> 🏎️ Syncing Official Entry Lists from OpenF1...")
  for (const race of racesPayload) {
      const raceDate = new Date(race.date)
      if (Math.abs((new Date() - raceDate) / (1000 * 60 * 60 * 24)) > 7) continue;

      try {
          const meetResp = await fetch(`https://api.openf1.org/v1/meetings?year=${year}`)
          const meetings = await meetResp.json()
          
          if (!Array.isArray(meetings)) {
              console.error(`      ⚠️ OpenF1 returned invalid data for meetings!`)
              console.error(`      ⚠️ Raw Response:`, JSON.stringify(meetings).substring(0, 1000))
              continue;
          }

          const meeting = meetings.find(m => Math.abs((new Date(m.date_start) - raceDate) / (1000 * 60 * 60 * 24)) <= 5)

          if (meeting) {
              const drvResp = await fetch(`https://api.openf1.org/v1/drivers?meeting_key=${meeting.meeting_key}`)
              const drvData = await drvResp.json()
              
              if (!Array.isArray(drvData)) {
                  console.error(`      ⚠️ OpenF1 returned invalid data for drivers!`)
                  console.error(`      ⚠️ Raw Response:`, JSON.stringify(drvData).substring(0, 1000))
                  continue; 
              }

              const codes = [...new Set(drvData.map(d => d.name_acronym))].filter(Boolean)

              const activePayload = codes.map(code => ({ race_id: raceMap[race.round], driver_id: dMap[code] })).filter(p => p.driver_id)
              if (activePayload.length > 0) {
                  await supabaseAdmin.from('active_drivers').upsert(activePayload, { onConflict: 'race_id, driver_id' })
              }
          }
      } catch (err) { console.error(`      ⚠️ OpenF1 Sync failed:`, err.message) }
  }
  
  // 5. TARGETED BACKFILL (Ensure DNS drivers get 0 points)
  const { data: adData } = await supabaseAdmin.from('active_drivers').select('race_id, driver_id')
  const expected = {}
  adData?.forEach(row => { 
    if (!expected[row.race_id]) expected[row.race_id] = new Set()
    expected[row.race_id].add(row.driver_id) 
  })

  for (const raceId of Object.keys(participated)) {
      for (const sessionType of Object.keys(participated[raceId])) {
          const inSession = participated[raceId][sessionType]
          const active = expected[raceId] || new Set()
          for (const dId of active) {
              if (!inSession.has(dId)) {
                  const driver = allDrivers.find(d => d.id === dId)
                  finalResults.push({
                      race_id: raceId, driver_id: dId, constructor_id: cMap[driver?.team] || null,
                      session_type: sessionType, position: 0, real_points: 0, grid: 0,
                      status: 'DNS', fastest_lap_time: null
                  })
              }
          }
      }
  }

  if (finalResults.length > 0) {
      await supabaseAdmin.from('race_results').upsert(finalResults, { onConflict: 'race_id, driver_id, session_type' })
      console.log(`   ✅ SUCCESSFULLY WROTE ${finalResults.length} ROWS TO DATABASE!`)
  }
}

export const handler = schedule('0 * * * *', syncLogic)