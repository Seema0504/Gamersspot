import React, { useState, useEffect, useMemo } from 'react'

const TransferStations = ({ stations, onTransfer, onClose }) => {
    const [sourceId, setSourceId] = useState('')
    const [targetId, setTargetId] = useState('')
    const [error, setError] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)

    // Filter running stations (Source candidates)
    const runningStations = useMemo(() => {
        return stations.filter(s => s.isRunning && !s.isDone)
    }, [stations])

    // Filter valid targets based on selected source
    const validTargets = useMemo(() => {
        if (!sourceId) return []
        const source = runningStations.find(s => s.id === parseInt(sourceId))
        if (!source) return []

        // Target must be:
        // 1. Same Game Type
        // 2. Idle (not running, not paused, elapsed 0)
        // 3. Not the source station itself
        return stations.filter(s =>
            s.id !== source.id &&
            s.gameType === source.gameType &&
            !s.isRunning &&
            !s.isPaused &&
            (s.elapsedTime === 0 || s.elapsedTime === undefined)
        )
    }, [sourceId, stations, runningStations])

    // Reset target if source changes
    useEffect(() => {
        setTargetId('')
    }, [sourceId])

    const handleSubmit = async () => {
        setError('')
        if (!sourceId || !targetId) {
            setError('Please select both source and target stations')
            return
        }

        setIsSubmitting(true)
        try {
            await onTransfer(parseInt(sourceId), parseInt(targetId))
            onClose()
        } catch (err) {
            console.error('Transfer failed:', err)
            setError(err.message || 'Transfer failed. Please try again.')
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <div className="fixed inset-0 bg-white z-[60] overflow-y-auto lg:left-64">
            {/* Header */}
            <div className="sticky top-0 bg-white/95 backdrop-blur-lg border-b border-gray-200 z-[70] shadow-sm">
                <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-6">
                    <div className="flex justify-between items-center">
                        <div>
                            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900">
                                Transfer Stations
                            </h2>
                            <p className="text-sm sm:text-base text-gray-600 mt-1">
                                Move an active session to another station
                            </p>
                        </div>
                        <button
                            onClick={onClose}
                            className="text-gray-600 hover:text-gray-900 text-3xl sm:text-4xl font-bold transition-colors p-2 hover:bg-gray-100 rounded-lg"
                            title="Close"
                        >
                            ×
                        </button>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="container mx-auto px-4 sm:px-6 py-8 max-w-2xl">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">

                    {error && (
                        <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-md border border-red-100 text-sm flex items-start gap-2">
                            <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span>{error}</span>
                        </div>
                    )}

                    <div className="space-y-6">

                        {/* Source Selection */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                From Station (Running)
                            </label>
                            <div className="relative">
                                <select
                                    className="w-full p-3 pl-4 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white appearance-none transition-colors"
                                    value={sourceId}
                                    onChange={(e) => setSourceId(e.target.value)}
                                >
                                    <option value="">Select Source Station</option>
                                    {runningStations.map(s => (
                                        <option key={s.id} value={s.id}>
                                            {s.name} ({s.gameType}) - {s.customerName || 'Guest'}
                                        </option>
                                    ))}
                                </select>
                                <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-gray-500">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </div>
                            </div>
                            {runningStations.length === 0 && (
                                <p className="text-xs text-amber-600 mt-2 font-medium">
                                    No active sessions found to transfer.
                                </p>
                            )}
                        </div>

                        {/* Target Selection */}
                        <div>
                            <label className={`block text-sm font-semibold mb-2 ${!sourceId ? 'text-gray-400' : 'text-gray-700'}`}>
                                To Station (Idle)
                            </label>
                            <div className="relative">
                                <select
                                    className={`w-full p-3 pl-4 pr-10 border rounded-lg appearance-none transition-colors ${!sourceId
                                            ? 'bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed'
                                            : 'bg-white border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900'
                                        }`}
                                    value={targetId}
                                    onChange={(e) => setTargetId(e.target.value)}
                                    disabled={!sourceId}
                                >
                                    <option value="">Select Target Station</option>
                                    {validTargets.map(s => (
                                        <option key={s.id} value={s.id}>
                                            {s.name}
                                        </option>
                                    ))}
                                </select>
                                <div className={`absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none ${!sourceId ? 'text-gray-300' : 'text-gray-500'}`}>
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </div>
                            </div>

                            {sourceId && validTargets.length === 0 && (
                                <p className="text-xs text-red-500 mt-2 font-medium">
                                    No available idle stations matching this game type.
                                </p>
                            )}
                            {!sourceId && (
                                <p className="text-xs text-gray-400 mt-2">
                                    Select a source station first to see compatible targets.
                                </p>
                            )}
                        </div>

                        {/* Assign Button */}
                        <button
                            className={`w-full py-3.5 px-4 rounded-lg font-bold text-white shadow-md transition-all flex items-center justify-center gap-2 ${!sourceId || !targetId || isSubmitting
                                    ? 'bg-gray-300 cursor-not-allowed shadow-none'
                                    : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 hover:shadow-lg active:scale-[0.99]'
                                }`}
                            onClick={handleSubmit}
                            disabled={!sourceId || !targetId || isSubmitting}
                        >
                            {isSubmitting ? (
                                <>
                                    <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Processing Transfer...
                                </>
                            ) : (
                                <>
                                    <span>Assign Station</span>
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                    </svg>
                                </>
                            )}
                        </button>
                        <p className="text-xs text-gray-500 text-center">
                            This will transfer the elapsed time, cost, and customer details to the new station. The old station will become idle.
                        </p>

                    </div>
                </div>
            </div>
        </div>
    )
}

export default TransferStations
