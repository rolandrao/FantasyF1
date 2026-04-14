import { useState, useEffect } from 'react'
import { getTeamColors, getRaceColors } from '../utils/colors'

// Helper for gradients
const constructGradient = (colors) => `linear-gradient(135deg, ${colors.primary} 0%, ${colors.secondary} 100%)`

const TeamModals = ({ type, item, isOpen, onClose, dataFuncs, contextData }) => {
    const [loading, setLoading] = useState(false)
    const [data, setData] = useState(null)
    const [stealSelection, setStealSelection] = useState({ my: null, target: null })

    // --- LOAD DATA ON OPEN ---
    useEffect(() => {
        if (!isOpen) {
            setData(null)
            return
        }

        const load = async () => {
            setLoading(true)
            if (type === 'stats') {
                const res = await dataFuncs.getStats(item, item.type)
                setData(res)
            } else if (type === 'recap') {
                const res = await dataFuncs.getRecap(item)
                setData(res)
            }
            setLoading(false)
        }
        load()
        setStealSelection({ my: null, target: null }) // Reset steal state
    }, [isOpen, type, item])

    if (!isOpen) return null

    // --- HEADER STYLES ---
    const getHeaderStyle = () => {
        if (type === 'chip_sc') return { background: 'linear-gradient(135deg, #15803d 0%, #14532d 100%)' }
        if (type === 'chip_steal') return { background: 'linear-gradient(135deg, #7e22ce 0%, #581c87 100%)' }
        if (!item) return { background: '#333' }
        if (type === 'recap') return { background: getRaceColors(item.race_name).primary }

        // Safety check for stats modal
        const teamName = item.type === 'driver' ? item.drivers.team : item.constructors.name
        return { background: constructGradient(getTeamColors(teamName)) }
    }

    // --- ACTIONS ---
    const handleScDeploy = async () => {
        setLoading(true)
        const { error } = await dataFuncs.deploySc()
        setLoading(false)
        if (!error) { onClose(); alert('Safety Car Deployed!') }
    }

    const handleStealDeploy = async () => {
        setLoading(true)
        const { error } = await dataFuncs.deploySteal(stealSelection.my, stealSelection.target)
        setLoading(false)

        if (!error) {
            onClose()
            alert('Driver Swap Confirmed!')
        } else {
            alert(error.message || "An unknown error occurred.")
        }
    }

    // --- RENDER CONTENT ---
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90" onClick={onClose}>
            <div
                className={`bg-neutral-800 w-full rounded-2xl border border-neutral-600 shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 transform-gpu ${type === 'chip_steal' ? 'max-w-2xl' : 'max-w-lg'}`}
                onClick={e => e.stopPropagation()}
            >
                <button onClick={onClose} className="absolute top-4 right-4 text-white/80 hover:text-white z-10 text-xl font-bold bg-black/20 rounded-full w-8 h-8 flex items-center justify-center">✕</button>

                {/* 1. STATS */}
                {type === 'stats' && (
                    <>
                        <div className="p-6 text-center border-b border-neutral-700 relative" style={getHeaderStyle()}>
                            <div className="text-4xl mb-2 drop-shadow-md">{item.type === 'driver' ? '🏎️' : '🔧'}</div>
                            <h2 className="text-2xl font-black italic drop-shadow-md">{item.type === 'driver' ? item.drivers.name : item.constructors.name}</h2>
                            <p className="text-white/90 font-bold uppercase tracking-widest text-xs drop-shadow-sm">Season Stats</p>
                        </div>
                        <div className="p-6 grid grid-cols-2 gap-4">
                            {(loading || !data) ? <div className="col-span-2 text-center text-gray-500 animate-pulse">Loading...</div> : (
                                <>
                                    <div className="bg-neutral-700/50 p-3 rounded text-center border border-neutral-600"><div className="text-xs text-gray-400">TOTAL PTS</div><div className="text-2xl font-black text-green-400">{data.total_fantasy_points}</div></div>
                                    <div className="bg-neutral-700/50 p-3 rounded text-center border border-neutral-600"><div className="text-xs text-gray-400">REAL PTS</div><div className="text-2xl font-black text-white">{data.total_real_points}</div></div>
                                    <div className="bg-neutral-700/50 p-3 rounded text-center border border-neutral-600"><div className="text-xs text-gray-400">BEST</div><div className="text-2xl font-bold text-yellow-500">P{data.best_finish}</div></div>
                                    <div className="bg-neutral-700/50 p-3 rounded text-center border border-neutral-600"><div className="text-xs text-gray-400">{item.type === 'driver' ? 'DNFs' : 'RACES'}</div><div className="text-2xl font-bold text-red-400">{item.type === 'driver' ? data.dnf_count : data.races_completed}</div></div>
                                </>
                            )}
                        </div>
                    </>
                )}

                {/* 2. RECAP */}
                {type === 'recap' && (
                    <>
                        <div className="p-6 text-center border-b border-neutral-700" style={getHeaderStyle()}>
                            <h2 className="text-2xl font-black italic drop-shadow-md text-white">{item.race_name}</h2>
                            <p className="text-white font-bold text-lg drop-shadow-sm opacity-90">{loading ? '...' : (data?.calculatedTotal || 0)} pts</p>
                        </div>
                        <div className="p-0 overflow-x-auto">
                            {(loading || !data) ? (
                                <div className="p-8 text-center text-gray-500 animate-pulse">Loading Scorecard...</div>
                            ) : (
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-white/5 text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-white/10">
                                            <th className="p-4">Asset</th>
                                            {data.isSprint ? (
                                                <>
                                                    <th className="p-4 text-center">Sprint</th>
                                                    <th className="p-4 text-center">Race</th>
                                                </>
                                            ) : (
                                                <>
                                                    <th className="p-4 text-center">Quali</th>
                                                    <th className="p-4 text-center">Race</th>
                                                </>
                                            )}
                                            <th className="p-4 text-right">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5 text-sm">
                                        {/* DRIVERS */}
                                        {data.driverRows.map(row => (
                                            <tr key={row.id} className={`transition-colors duration-100 ${row.isSwapped ? 'bg-purple-900/20' : 'hover:bg-white/5'}`}>
                                                <td className="p-4 font-bold border-r border-white/5 w-1/3">
                                                    <div>{row.name}</div>
                                                    <div className="text-[10px] text-gray-500 font-normal flex items-center gap-2">
                                                        {row.team}
                                                        {row.isSwapped && <span className="text-purple-400 font-bold uppercase tracking-wider text-[9px] bg-purple-500/10 px-1 rounded">Swapped</span>}
                                                    </div>
                                                </td>
                                                <td className="p-4 text-center">
                                                    {row.col1 ? <div><div className="font-bold text-white">P{row.col1.pos}</div>{row.col1.pts > 0 && <div className="text-[10px] text-green-400 font-mono">+{row.col1.pts}</div>}</div> : <span className="text-gray-600">-</span>}
                                                </td>
                                                <td className="p-4 text-center border-l border-white/5 bg-white/[0.02]">
                                                    {row.col2 ? <div><div className="font-bold text-white">P{row.col2.pos}</div>{row.col2.pts > 0 && <div className="text-[10px] text-green-400 font-mono">+{row.col2.pts}</div>}</div> : <span className="text-gray-600">-</span>}
                                                </td>
                                                <td className="p-4 text-right font-mono font-bold text-green-400 text-lg border-l border-white/5">+{row.total}</td>
                                            </tr>
                                        ))}

                                        {/* CONSTRUCTOR */}
                                        {data.constructorRow && (
                                            <tr className="bg-blue-900/10 hover:bg-blue-900/20 transition-colors duration-100">
                                                <td className="p-4 font-bold border-r border-white/5 text-blue-200">
                                                    <div>{data.constructorRow.name}</div>
                                                    <div className="text-[10px] text-blue-300/50 font-normal uppercase mb-1">Constructor</div>

                                                    {/* NEW: Driver Breakdown List */}
                                                    {data.constructorRow.contributions && data.constructorRow.contributions.length > 0 && (
                                                        <div className="mt-1 space-y-0.5">
                                                            {data.constructorRow.contributions.map((c, i) => (
                                                                <div key={i} className="text-[10px] text-white/60 font-normal flex items-center gap-1">
                                                                    <span className="opacity-50 text-blue-300">↳</span> {c.code}: <span className="text-green-400 font-mono">+{c.pts}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="p-4 text-center font-mono text-blue-200">
                                                    {(data.isSprint ? data.constructorRow.sprintPts : data.constructorRow.qualiPts) > 0
                                                        ? `+${data.isSprint ? data.constructorRow.sprintPts : data.constructorRow.qualiPts}`
                                                        : '-'}
                                                </td>
                                                <td className="p-4 text-center font-mono text-blue-200 border-l border-white/5">
                                                    {data.constructorRow.racePts > 0 ? `+${data.constructorRow.racePts}` : '-'}
                                                </td>
                                                <td className="p-4 text-right font-mono font-bold text-green-400 text-lg border-l border-white/5">
                                                    +{data.constructorRow.total}
                                                </td>
                                            </tr>
                                        )}

                                        {/* SAFETY CAR ROW - CONDITIONALLY RENDERED */}
                                        {data.safetyCarRow && (
                                            <>
                                                {/* Header Row / Break */}
                                                <tr className="bg-green-900/20 border-t-2 border-green-500/20">
                                                    <td colSpan="4" className="py-2 px-4 text-[10px] font-bold uppercase tracking-widest text-green-400 text-center">
                                                        Active Chip Bonus
                                                    </td>
                                                </tr>

                                                {/* Data Row */}
                                                <tr className="hover:bg-white/5 transition-colors">
                                                    <td className="p-4 font-bold border-r border-white/5 text-green-200">
                                                        <div>Safety Car Chip</div>
                                                        <div className="text-[10px] text-green-300/50 font-normal uppercase flex flex-col">
                                                            <span>{data.safetyCarRow.scCount} SC</span>
                                                            <span>{data.safetyCarRow.vscCount} VSC</span>
                                                        </div>
                                                    </td>
                                                    <td className="p-4 text-center text-gray-600 font-mono">-</td>
                                                    <td className="p-4 text-center text-gray-600 font-mono">-</td>
                                                    <td className="p-4 text-right font-mono font-bold text-green-400 text-lg border-l border-white/5">
                                                        +{data.safetyCarRow.points}
                                                    </td>
                                                </tr>
                                            </>
                                        )}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </>
                )}

                {/* 3. SAFETY CAR CHIP MODAL */}
                {type === 'chip_sc' && (
                    <>
                        <div className="p-6 text-center border-b border-neutral-700 bg-green-800">
                            <div className="text-4xl mb-2">🏎️</div>
                            <h2 className="text-2xl font-black italic">DEPLOY SAFETY CAR</h2>
                        </div>
                        <div className="p-6">
                            {contextData.nextRace ? (
                                <div className="space-y-6">
                                    <div className="bg-white/10 p-4 rounded-lg text-center">
                                        <div className="text-xs text-green-200 uppercase font-bold mb-1">Upcoming Race</div>
                                        <div className="text-xl font-bold">{contextData.nextRace.name}</div>
                                        <div className="text-sm text-gray-300">{contextData.nextRace.circuit}</div>
                                        <div className="text-sm font-mono text-green-400 mt-1">{new Date(contextData.nextRace.date).toLocaleDateString()}</div>
                                    </div>
                                    <button onClick={handleScDeploy} disabled={loading} className="w-full bg-green-600 hover:bg-green-500 py-3 rounded-lg font-bold text-white transition">{loading ? 'Deploying...' : 'CONFIRM DEPLOYMENT'}</button>
                                </div>
                            ) : <div className="text-center text-gray-500">No upcoming races found.</div>}
                        </div>
                    </>
                )}

                {/* 4. STEAL DRIVER CHIP MODAL */}
                {type === 'chip_steal' && (
                    <>
                        <div className="px-6 py-4 text-center border-b border-neutral-700 bg-purple-900 sticky top-0 z-10 shadow-lg">
                            <div className="flex items-center justify-center gap-3"><span className="text-2xl">🥷</span><h2 className="text-xl font-black italic tracking-tighter text-white">STEAL A DRIVER</h2></div>
                        </div>
                        <div className="flex flex-col h-[80vh] md:h-auto md:max-h-[85vh]">
                            {contextData.nextRace ? (
                                <>
                                    <div className="px-4 py-3 bg-neutral-900 border-b border-white/10 shrink-0">
                                        <div className="bg-gradient-to-r from-purple-900/20 to-neutral-800 border border-purple-500/20 rounded-lg p-3 flex items-center justify-between relative overflow-hidden">
                                            <div className="absolute -right-4 -bottom-4 text-6xl opacity-5 pointer-events-none">🏁</div>
                                            <div className="relative z-10 flex flex-col justify-center"><div className="text-[10px] text-purple-400 font-bold uppercase tracking-widest mb-0.5">Upcoming Event</div><h3 className="text-lg font-black italic text-white leading-none">{contextData.nextRace.name}</h3></div>
                                            <div className="text-center bg-black/40 backdrop-blur-md rounded border border-white/10 px-3 py-1.5 min-w-[60px]"><div className="text-[9px] uppercase text-gray-500 font-bold">DATE</div><div className="font-mono font-bold text-white leading-none">{new Date(contextData.nextRace.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</div></div>
                                        </div>
                                    </div>
                                    <div className="flex-1 p-4 bg-neutral-800/50 overflow-y-auto custom-scrollbar">
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                            {contextData.allDrivers.filter(d => !contextData.roster.some(my => my.driver_id === d.id)).map(d => {
                                                const colors = getTeamColors(d.team); const isSelected = stealSelection.target === d.id
                                                return (
                                                    <div key={d.id} onClick={() => setStealSelection({ ...stealSelection, target: d.id })} className={`relative overflow-hidden rounded-lg border cursor-pointer transition-colors duration-150 h-14 ${isSelected ? 'border-white ring-2 ring-purple-500' : 'border-white/5 hover:border-white/20'}`}>
                                                        <div className={`absolute inset-0 transition-opacity duration-150 ${isSelected ? 'opacity-80' : 'opacity-40 hover:opacity-60'}`} style={{ background: constructGradient(colors) }} />
                                                        <div className="relative z-10 flex flex-col items-center justify-center h-full text-center p-1"><div className="text-xs font-black italic text-white leading-none mb-0.5 drop-shadow-md">{d.name}</div><div className="text-[9px] font-mono text-white/80 uppercase tracking-tight drop-shadow-sm">{d.code} - {d.team}</div></div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                    <div className="p-4 bg-neutral-900 border-t border-white/10 shrink-0 z-20 shadow-2xl">
                                        <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 text-center">Select Driver to Send Away</h3>
                                        <div className="grid grid-cols-3 gap-3 mb-4">
                                            {contextData.roster.filter(r => r.type === 'driver').map(d => {
                                                const colors = getTeamColors(d.drivers.team); const isSelected = stealSelection.my === d.driver_id
                                                return (
                                                    <div key={d.driver_id} onClick={() => setStealSelection({ ...stealSelection, my: d.driver_id })} className={`relative overflow-hidden rounded-lg border cursor-pointer transition-colors duration-150 h-14 ${isSelected ? 'border-white ring-2 ring-red-500' : 'border-white/10 hover:border-white/30'}`}>
                                                        <div className={`absolute inset-0 transition-opacity duration-150 ${isSelected ? 'opacity-80' : 'opacity-40 hover:opacity-60'}`} style={{ background: constructGradient(colors) }} />
                                                        <div className="relative z-10 flex flex-col items-center justify-center h-full text-center p-1"><div className="text-xs font-black italic text-white leading-none mb-0.5 drop-shadow-md">{d.drivers.name}</div><div className="text-[9px] font-mono text-white/80 uppercase tracking-tight drop-shadow-sm">{d.drivers.code} - {d.drivers.team}</div></div>
                                                        {isSelected && <div className="absolute top-1 right-1 w-3 h-3 bg-red-500 rounded-full border border-white flex items-center justify-center"><div className="w-1.5 h-1.5 bg-white rounded-full"></div></div>}
                                                    </div>
                                                )
                                            })}
                                        </div>
                                        <button onClick={handleStealDeploy} disabled={loading || !stealSelection.my || !stealSelection.target} className={`w-full py-3 rounded-lg font-black italic tracking-wider text-sm transition-colors duration-200 ${(!stealSelection.my || !stealSelection.target) ? 'bg-neutral-800 text-gray-600 border border-white/5 cursor-not-allowed' : 'bg-white text-black hover:bg-gray-200 shadow-lg'}`}>{loading ? 'PROCESSING...' : 'CONFIRM SWAP'}</button>
                                    </div>
                                </>
                            ) : <div className="h-64 flex flex-col items-center justify-center text-gray-500 gap-2"><div className="text-3xl">😴</div><div className="text-sm">No upcoming races found.</div></div>}
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}

export default TeamModals