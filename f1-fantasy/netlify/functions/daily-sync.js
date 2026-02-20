import { schedule } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL, 
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// --- CONFIGURATION ---
const DURATIONS = {
    qualifying: 90, 
    sprint: 90,     
    race: 180,      
}

const SYNC_WINDOW_MINUTES = 180 

// --- HELPER: AUTO-PAGINATION ---
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

// --- MAIN LOGIC ---
const syncLogic = async (event) => {
  try {
    const now = new Date()
    console.log(`⏰ Hourly Trigger: ${now.toISOString()}`)

    const yearsToSync = [2025, 2026]
    let shouldRunSync = false

    // 1. MIDNIGHT SAFETY NET
    if (now.getUTCHours() === 0) {
        console.log("🌙 Midnight Safety Sync triggered.")
        shouldRunSync = true
    }

    // 2. INTELLIGENT EVENT CHECK
    if (!shouldRunSync) {
        shouldRunSync = await checkIfSessionJustFinished(yearsToSync, now)
    }

    if (shouldRunSync) {
        for (const year of yearsToSync) {
            await syncSeasonComplete(year)
        }
        return { statusCode: 200, body: "Sync Executed" }
    } else {
        console.log("💤 No active sessions or midnight trigger. Skipping sync.")
        return { statusCode: 200, body: "Skipped" }
    }

  } catch (error) {
    console.error("❌ Critical Sync Failure:", error)
    return { statusCode: 500 }
  }
}

// --- CHECKER FUNCTION ---
const checkIfSessionJustFinished = async (years, now) => {
    for (const year of years) {
        const resp = await fetch(`http://api.jolpi.ca/ergast/f1/${year}.json`)
        const data = await resp.json()
        const races = data.MRData?.RaceTable?.Races || []

        for (const race of races) {
            const raceDate = new Date(`${race.date}T${race.time}`)
            const diffDays = Math.abs((now - raceDate) / (1000 * 60 * 60 * 24))
            
            if (diffDays > 3) continue; 

            console.log(`🔎 Checking timeline for ${race.raceName}...`)

            const checkSession = (name, dateStr, timeStr, durationMins) => {
                if (!dateStr || !timeStr) return false
                
                const sessionStart = new Date(`${dateStr}T${timeStr}`)
                const sessionEnd = new Date(sessionStart.getTime() + durationMins * 60000)
                
                const startSyncTime = new Date(sessionEnd.getTime() + 60 * 60000) 
                const stopSyncTime = new Date(sessionEnd.getTime() + SYNC_WINDOW_MINUTES * 60000)

                if (now >= startSyncTime && now <= stopSyncTime) {
                    console.log(`   🚀 TRIGGER: ${name} finished recently (End: ${sessionEnd.toISOString()})`)
                    return true
                }
                return false
            }

            if (checkSession('Race', race.date, race.time, DURATIONS.race)) return true
            
            if (race.Qualifying) {
                if (checkSession('Qualifying', race.Qualifying.date, race.Qualifying.time, DURATIONS.qualifying)) return true
            }

            if (race.Sprint) {
                if (checkSession('Sprint', race.Sprint.date, race.Sprint.time, DURATIONS.sprint)) return true
            }
        }
    }
    return false
}

// --- SYNC FUNCTION ---
const syncSeasonComplete = async (year) => {
  console.log(`\n📅 Processing Season ${year}...`)

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

  const { error: raceErr } = await supabaseAdmin
    .from('races')
    .upsert(racesPayload, { onConflict: 'year, round' })
  
  if (raceErr) console.error(`   -> Race Sync Error:`, raceErr)
  
  // 2. FETCH EXISTING RACES
  const { data: dbRaces } = await supabaseAdmin
    .from('races')
    .select('id, round')
    .eq('year', year)

  if (!dbRaces) return
  const raceMap = {}; dbRaces.forEach(r => { raceMap[r.round] = r.id })

  // 3. FETCH ALL RESULTS
  console.log("   -> Fetching full result lists...")
  const raceRaces = await fetchAllPages(`http://api.jolpi.ca/ergast/f1/${year}/results.json`)
  const sprintRaces = await fetchAllPages(`http://api.jolpi.ca/ergast/f1/${year}/sprint.json`)
  const qualiRaces = await fetchAllPages(`http://api.jolpi.ca/ergast/f1/${year}/qualifying.json`)

  // 4. PREPARE DATA CONTAINERS
  const driversToUpsert = new Map()
  const constructorsToUpsert = new Map()
  const resultsPayload = []

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

      let list = []
      if (sessionType === 'race') list = race.Results || []
      else if (sessionType === 'sprint') list = race.SprintResults || []
      else if (sessionType === 'qualifying') list = race.QualifyingResults || []

      for (const row of list) {
        if (!row.Driver) continue; 
        
        const dCode = row.Driver.code || row.Driver.driverId.substring(0,3).toUpperCase()
        
        driversToUpsert.set(dCode, {
            year: year,
            name: `${row.Driver.givenName} ${row.Driver.familyName}`,
            number: row.number ? parseInt(row.number) : null,
            nationality: row.Driver.nationality,
            code: dCode,
            team: row.Constructor?.name 
        })
        
        const cName = row.Constructor?.name
        if (cName) {
            constructorsToUpsert.set(cName, { 
                year: year,
                name: cName, 
                nationality: row.Constructor.nationality 
            })
        }
        
        resultsPayload.push({
            race_id: raceId,
            driver_code: dCode,
            constructor_name: cName,
            session_type: sessionType,
            position: parseInt(row.position),
            points: parseFloat(row.points || 0),
            real_points: parseFloat(row.points || 0), // <-- FIX APPLIED HERE
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

  if (driversToUpsert.size > 0) {
      await supabaseAdmin.from('drivers').upsert(Array.from(driversToUpsert.values()), { onConflict: 'year, code' })
  }

  if (constructorsToUpsert.size > 0) {
      await supabaseAdmin.from('constructors').upsert(Array.from(constructorsToUpsert.values()), { onConflict: 'year, name' })
  }

  const { data: allDrivers } = await supabaseAdmin.from('drivers').select('id, code').eq('year', year) 
  const { data: allConstructors } = await supabaseAdmin.from('constructors').select('id, name').eq('year', year)

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
              real_points: r.real_points, // <-- FIX APPLIED HERE
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
  }

  // 7. SYNC SAFETY CAR DATA (OpenF1)
  console.log("   -> 🚨 Syncing Safety Car data from OpenF1...")

  for (const race of racesPayload) {
      const raceDate = new Date(race.date)
      const daysSince = (new Date() - raceDate) / (1000 * 60 * 60 * 24)
      if (raceDate > new Date() || daysSince > 5) continue;

      try {
          const sessionResp = await fetch(`https://api.openf1.org/v1/sessions?date_start=${race.date}&date_end=${race.date}&session_name=Race`)
          const sessions = await sessionResp.json()

          if (sessions && sessions.length > 0) {
              const sessionKey = sessions[0].session_key
              const scResp = await fetch(`https://api.openf1.org/v1/safety_cars?session_key=${sessionKey}`)
              const scData = await scResp.json()

              const scCount = scData.filter(x => x.type === 'SC').length
              const vscCount = scData.filter(x => x.type === 'VSC').length
              const raceUUID = raceMap[race.round]

              if (raceUUID) {
                  await supabaseAdmin.from('races').update({ safety_cars: scCount, virtual_safety_cars: vscCount }).eq('id', raceUUID)
              }
          }
          await new Promise(r => setTimeout(r, 200))
      } catch (err) {
          console.error(`      ⚠️ OpenF1 sync failed for ${race.name}:`, err.message)
      }
  }
}

export const handler = schedule('0 * * * *', syncLogic)