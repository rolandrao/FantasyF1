import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../App'

const MyTeam = () => {
  const [team, setTeam] = useState(null)
  const [drivers, setDrivers] = useState([])
  const [constructor, setConstructor] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchTeamData = async () => {
      // 1. Get Current User
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return setLoading(false)

      // 2. Get User's Team Details
      const { data: teamData } = await supabase
        .from('teams')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (!teamData) return setLoading(false)
      setTeam(teamData)

      // 3. Get The Draft Picks for this Team
      // We join on drivers and constructors to get the names
      const { data: picks } = await supabase
        .from('draft_picks')
        .select(`
          driver_id,
          constructor_id,
          drivers (*),
          constructors (*)
        `)
        .eq('team_id', teamData.id)

      // 4. Separate Drivers from Constructor
      const draftedDrivers = picks
        .filter(p => p.driver_id) // Only rows with drivers
        .map(p => p.drivers)      // Extract the driver object
      
      const draftedConstructor = picks
        .find(p => p.constructor_id) // Find the row with constructor
        ?.constructors              // Extract constructor object

      setDrivers(draftedDrivers)
      setConstructor(draftedConstructor)
      setLoading(false)
    }

    fetchTeamData()
  }, [])

  if (loading) return <div className="p-10 text-white">Loading Roster...</div>

  if (!team) return (
    <div className="p-10 text-white">
      <h2 className="text-2xl font-bold">No Team Found</h2>
      <p>You need to create a team and draft players first.</p>
      <Link to="/draft" className="text-red-500 underline">Go to Draft</Link>
    </div>
  )

  return (
    <div className="min-h-screen bg-neutral-900 text-white p-6">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* TEAM HEADER */}
        <div className="bg-neutral-800 p-8 rounded-2xl border-l-8 border-f1-red shadow-2xl flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-extrabold italic uppercase tracking-wider">{team.team_name}</h1>
            <p className="text-gray-400 mt-2 font-mono">Principal: {team.owner_name}</p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase text-gray-500 font-bold">Season Points</p>
            <p className="text-5xl font-bold text-white">{team.total_points}</p>
          </div>
        </div>

        {/* DRIVERS SECTION */}
        <div>
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
            <span className="text-f1-red">///</span> Driver Lineup
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {drivers.length === 0 && <p className="text-gray-500 italic">No drivers drafted yet.</p>}
            
            {drivers.map((driver) => (
              <div key={driver.id} className="bg-neutral-800 rounded-xl overflow-hidden border border-neutral-700 hover:border-gray-500 transition group relative">
                {/* Driver Number / Placeholder */}
                <div className="h-24 bg-gradient-to-br from-neutral-700 to-neutral-800 flex items-center justify-center">
                   <span className="text-4xl text-neutral-600 font-bold group-hover:text-white transition">#{Math.floor(Math.random() * 99)}</span>
                </div>
                
                <div className="p-5">
                  <h3 className="text-xl font-bold">{driver.name}</h3>
                  <p className="text-sm text-gray-400 uppercase tracking-widest mt-1">{driver.team}</p>
                </div>
                
                {/* Top Border Accent */}
                <div className="absolute top-0 left-0 w-full h-1 bg-f1-red transform scale-x-0 group-hover:scale-x-100 transition duration-300"></div>
              </div>
            ))}
          </div>
        </div>

        {/* CONSTRUCTOR SECTION */}
        <div>
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
            <span className="text-f1-red">///</span> Constructor
          </h2>
          {constructor ? (
             <div className="bg-neutral-800 rounded-xl p-6 border border-neutral-700 flex justify-between items-center hover:bg-neutral-750 transition">
                <div>
                   <h3 className="text-3xl font-bold">{constructor.name}</h3>
                   <p className="text-gray-400">Official Constructor Entry</p>
                </div>
                <div className="text-6xl opacity-20">🏎️</div>
             </div>
          ) : (
             <p className="text-gray-500 italic bg-neutral-800 p-6 rounded-xl border border-dashed border-neutral-700">No constructor drafted yet.</p>
          )}
        </div>

      </div>
    </div>
  )
}

export default MyTeam