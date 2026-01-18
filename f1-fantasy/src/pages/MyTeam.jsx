import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../App'
import { useTeamData } from '../hooks/useTeamData'
import TeamModals from '../components/TeamModals'
import { getTeamColors } from '../utils/colors.js'

const MyTeam = () => {
    const navigate = useNavigate()

    // 1. USE THE CUSTOM HOOK
    const {
        team, roster, recaps, chips, nextRace, allDrivers, loading,
        updateTeamName, deploySafetyCar, deploySteal, getStatsData, getRecapData
    } = useTeamData()

    // 2. LOCAL UI STATE
    const [isEditing, setIsEditing] = useState(false)
    const [newName, setNewName] = useState('')
    const [renameLoading, setRenameLoading] = useState(false)

    // Modal State
    const [modalState, setModalState] = useState({ type: null, item: null })
    const closeModal = () => setModalState({ type: null, item: null })

    // --- HANDLERS ---
    const handleLogout = async () => { await supabase.auth.signOut(); navigate('/') }

    const onRename = async () => {
        if (!newName.trim() || newName === team.team_name) { setIsEditing(false); return }
        setRenameLoading(true)
        await updateTeamName(newName)
        setIsEditing(false); setRenameLoading(false)
    }

    // --- STYLING ---
    const constructGradient = (colors) => `linear-gradient(135deg, ${colors.primary} 0%, ${colors.secondary} 100%)`

    if (loading) return <div className="text-white p-10 text-center animate-pulse bg-neutral-900 min-h-screen flex items-center justify-center">Loading Team HQ...</div>

    if (!team) return (
        <div className="min-h-screen bg-neutral-900 text-white flex flex-col items-center justify-center p-6 text-center">
            <div className="w-20 h-20 bg-neutral-800 rounded-full flex items-center justify-center mb-6 border border-neutral-700 shadow-xl"><span className="text-4xl">🏎️</span></div>
            <h2 className="text-2xl md:text-3xl font-black italic tracking-tighter mb-4">NO TEAM LINKED</h2>
            <p className="text-gray-400 max-w-md mb-8 text-sm md:text-base leading-relaxed">Your account is not linked to a team yet. <br className="hidden md:block" /> Please contact the administrator.</p>
            <button onClick={handleLogout} className="bg-red-600 hover:bg-red-500 text-white font-bold py-3 px-8 rounded-xl transition-all">Log Out</button>
        </div>
    )

    const driversList = roster.filter(p => p.type === 'driver')
    const constructorPick = roster.find(p => p.type === 'constructor')
    const safetyCarChip = chips.find(c => c.chip_type === 'safety_car')
    const stealChip = chips.find(c => c.chip_type === 'steal_driver')

    return (
        <div className="min-h-screen bg-neutral-900 text-white pb-24 md:pb-10 relative">

            {/* MODALS MANAGER */}
            <TeamModals
                isOpen={!!modalState.type}
                type={modalState.type}
                item={modalState.item}
                onClose={closeModal}
                dataFuncs={{ getStats: getStatsData, getRecap: getRecapData, deploySc: deploySafetyCar, deploySteal: deploySteal }}
                contextData={{ roster, nextRace, allDrivers }}
            />

            {/* HEADER */}
            <div className="bg-neutral-800 border-b border-neutral-700 p-6 md:p-10 relative">
                <div className="absolute top-4 right-4 md:hidden"><a href="/settings" className="text-gray-400 p-2">⚙️</a></div>
                <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center md:items-start gap-4 md:gap-8 text-center md:text-left">
                    <div className="w-20 h-20 md:w-24 md:h-24 rounded-full flex items-center justify-center text-3xl md:text-4xl shadow-xl border-4 border-neutral-700 bg-gradient-to-br from-f1-red to-red-900">🧢</div>
                    <div className="flex-1">
                        <p className="text-gray-400 font-bold uppercase tracking-widest text-xs mb-1">Team Principal: {team.owner_name}</p>
                        {isEditing ? (
                            <div className="flex items-center gap-2 justify-center md:justify-start">
                                <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} className="bg-neutral-900 border border-neutral-600 text-2xl font-black italic text-white px-3 py-1 rounded" autoFocus />
                                <button onClick={onRename} disabled={renameLoading} className="bg-green-600 p-2 rounded text-white">{renameLoading ? '...' : '✓'}</button>
                                <button onClick={() => { setIsEditing(false); setNewName(team.team_name) }} className="bg-neutral-600 p-2 rounded text-white">✕</button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-3 justify-center md:justify-start group">
                                <h1 className="text-3xl md:text-5xl font-black italic tracking-tighter">{team.team_name}</h1>
                                <button onClick={() => setIsEditing(true)} className="text-gray-500 hover:text-white opacity-0 group-hover:opacity-100 transition">✏️</button>
                            </div>
                        )}
                        <p className="text-gray-500 text-sm mt-2">Season 2026 • Tier 1</p>
                    </div>
                </div>
            </div>

            <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-8">
                {/* 1. DRIVERS */}
                <div>
                    <h2 className="text-xl font-bold border-b border-neutral-700 pb-2 mb-4"><span>🏎️</span> Active Drivers</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    </div>
                    {/* --- 1. DRIVERS SECTION --- */}
                    {/* FORCE 3 COLUMNS: grid-cols-1 (mobile) -> grid-cols-2 (tablet) -> grid-cols-3 (desktop) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full">
                        {driversList.map((pick) => {
                            const teamName = pick.drivers.team || 'Free Agent';
                            const colors = getTeamColors(teamName);

                            return (
                                <div
                                    key={pick.pick_number}
                                    onClick={() => setModalState({ type: 'stats', item: pick })}
                                    className={`
                    p-5 pt-12 relative overflow-hidden rounded-xl border shadow-lg cursor-pointer
                    group hover:scale-[1.02] transition transform duration-200
                    flex flex-col justify-between 
                    w-full min-h-[220px]
                    ${pick.isStolen ? 'border-purple-500 ring-2 ring-purple-500/50' : 'border-neutral-700/30'}
                `}
                                    style={{ background: constructGradient(colors) }}
                                >
                                    {/* ... (Content remains exactly the same) ... */}

                                    {/* Pick Number */}
                                    <div className="absolute top-0 right-0 bg-black/40 text-white/80 text-xs px-3 py-1.5 rounded-bl backdrop-blur-md font-bold">
                                        #{pick.pick_number}
                                    </div>

                                    {/* Stolen Badge */}
                                    {pick.isStolen && (
                                        <div className="absolute top-0 left-0 bg-purple-600 text-white text-[10px] font-bold px-3 py-1.5 rounded-br shadow-lg flex items-center gap-1.5 z-10">
                                            <span>🥷</span>
                                            <span className="uppercase tracking-wider">Stolen</span>
                                        </div>
                                    )}

                                    {/* Main Content */}
                                    <div className="relative z-10">
                                        <div className="text-3xl lg:text-4xl font-black italic tracking-tighter leading-none mb-2 drop-shadow-md">
                                            {pick.drivers.name}
                                        </div>
                                        <div className="text-sm text-white/80 font-bold uppercase tracking-widest flex items-center gap-2">
                                            <span className="opacity-60">{pick.drivers.code}</span>
                                            <span className="w-1 h-1 bg-white/50 rounded-full"></span>
                                            <span>{teamName}</span>
                                        </div>
                                        {pick.isStolen && (
                                            <div className="text-[10px] text-purple-200 mt-2 font-mono">
                                                ← Acquired from {pick.stolenFrom}
                                            </div>
                                        )}
                                    </div>

                                    {/* Footer */}
                                    <div className="mt-6 flex justify-between items-end border-t border-white/10 pt-4">
                                        <span className="text-xs text-white/60 font-medium uppercase tracking-wider">Season Stats</span>
                                        <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center group-hover:bg-white/20 transition-colors">
                                            <span className="text-white font-bold text-sm group-hover:translate-x-0.5 transition-transform">➜</span>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>

                {/* 2. CONSTRUCTOR */}
                <div>
                    <h2 className="text-xl font-bold border-b border-neutral-700 pb-2 mb-4"><span>🔧</span> Constructor</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {constructorPick ? (
                            <div onClick={() => setModalState({ type: 'stats', item: constructorPick })} className="p-6 rounded-xl border border-neutral-700/30 relative overflow-hidden shadow-lg cursor-pointer hover:scale-[1.02] transition transform duration-200" style={{ background: constructGradient(getTeamColors(constructorPick.constructors.name)) }}>
                                <div className="absolute top-0 right-0 bg-black/40 text-white/80 text-xs px-3 py-1 rounded-bl font-bold">Constructor</div>
                                <div className="flex items-center gap-4"><div className="text-4xl">🏁</div><div><div className="text-2xl font-black italic">{constructorPick.constructors.name}</div><div className="text-sm text-white/70">Click for Stats</div></div></div>
                            </div>
                        ) : <div className="bg-neutral-800/50 border-2 border-dashed border-neutral-700 rounded-xl p-6 flex items-center justify-center text-gray-600 h-32">No Constructor Selected</div>}
                    </div>
                </div>

                {/* 3. CHIPS */}
                <div>
                    <h2 className="text-xl font-bold border-b border-neutral-700 pb-2 mb-4"><span>💎</span> Team Chips</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div onClick={(!safetyCarChip || !safetyCarChip.is_used) ? () => setModalState({ type: 'chip_sc' }) : undefined} className={`p-4 rounded-xl border relative overflow-hidden transition-all ${safetyCarChip?.is_used ? 'bg-neutral-800/50 border-neutral-700 opacity-60 cursor-not-allowed' : 'bg-green-900/20 border-green-500/30 cursor-pointer hover:bg-green-900/40'}`}>
                            <div className="flex items-center justify-between"><div className="flex items-center gap-3"><div className="text-3xl">🏎️</div><div><div className="font-black italic text-green-400">SAFETY CAR</div><div className="text-xs text-gray-400">Score big on chaos</div></div></div><div className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${safetyCarChip?.is_used ? 'bg-gray-700 text-gray-400' : 'bg-green-500 text-black'}`}>{safetyCarChip?.is_used ? 'Used' : 'Deploy'}</div></div>
                        </div>
                        <div onClick={(!stealChip || !stealChip.is_used) ? () => setModalState({ type: 'chip_steal' }) : undefined} className={`p-4 rounded-xl border relative overflow-hidden transition-all ${stealChip?.is_used ? 'bg-neutral-800/50 border-neutral-700 opacity-60 cursor-not-allowed' : 'bg-purple-900/20 border-purple-500/30 cursor-pointer hover:bg-purple-900/40'}`}>
                            <div className="flex items-center justify-between"><div className="flex items-center gap-3"><div className="text-3xl">🥷</div><div><div className="font-black italic text-purple-400">STEAL DRIVER</div><div className="text-xs text-gray-400">Swap for one race</div></div></div><div className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${stealChip?.is_used ? 'bg-gray-700 text-gray-400' : 'bg-purple-500 text-black'}`}>{stealChip?.is_used ? 'Used' : 'Deploy'}</div></div>
                        </div>
                    </div>
                </div>

                {/* 4. RECAPS */}
                <div>
                    <h2 className="text-xl font-bold border-b border-neutral-700 pb-2 mb-4"><span>📅</span> Season Recap</h2>
                    <div className="bg-neutral-800 rounded-xl border border-neutral-700 overflow-hidden">
                        {recaps.length === 0 ? <div className="p-6 text-center text-gray-500">No races completed yet.</div> : (
                            <div className="divide-y divide-neutral-700">
                                {recaps.map((race) => (
                                    <div key={race.race_id} onClick={() => setModalState({ type: 'recap', item: race })} className="p-4 flex justify-between items-center hover:bg-neutral-700/50 transition cursor-pointer group">
                                        <div><div className="font-bold text-lg">{race.race_name}</div><div className="text-xs text-gray-500">{new Date(race.race_date).toLocaleDateString()}</div></div>
                                        <div className="flex items-center gap-4"><div className="text-right"><div className="font-black text-xl text-green-400">{race.total_points}</div><div className="text-[10px] text-gray-500 uppercase">Points</div></div><div className="text-gray-500 group-hover:text-white">➜</div></div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

export default MyTeam