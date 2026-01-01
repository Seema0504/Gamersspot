import { useState, useEffect } from 'react'
import { GAME_TYPES } from '../utils/pricing'
import { bonusAPI } from '../utils/api'

const BonusConfig = ({ onClose }) => {
    const [bonusConfig, setBonusConfig] = useState({
        [GAME_TYPES.PLAYSTATION]: {
            weekday: {
                oneHour: 900,    // 15 minutes in seconds
                twoHours: 1800,  // 30 minutes in seconds
                threeHours: 3600 // 1 hour in seconds
            },
            weekend: {
                oneHour: 0,
                twoHours: 0,
                threeHours: 0
            }
        },
        [GAME_TYPES.STEERING_WHEEL]: {
            weekday: {
                oneHour: 900,
                twoHours: 1800,
                threeHours: 3600
            },
            weekend: {
                oneHour: 0,
                twoHours: 0,
                threeHours: 0
            }
        },
        [GAME_TYPES.SYSTEM]: {
            weekday: {
                oneHour: 900,
                twoHours: 1800,
                threeHours: 3600
            },
            weekend: {
                oneHour: 900,
                twoHours: 1800,
                threeHours: 3600
            }
        }
    })

    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        const loadBonusConfig = async () => {
            try {
                const config = await bonusAPI.get()
                if (config && Object.keys(config).length > 0) {
                    setBonusConfig(config)
                }
            } catch (error) {
                console.error('Error loading bonus configuration:', error)
            } finally {
                setLoading(false)
            }
        }

        loadBonusConfig()
    }, [])

    const handleBonusChange = (gameType, dayType, tier, minutes) => {
        const seconds = parseInt(minutes) * 60 || 0
        setBonusConfig(prev => ({
            ...prev,
            [gameType]: {
                ...prev[gameType],
                [dayType]: {
                    ...prev[gameType][dayType],
                    [tier]: seconds
                }
            }
        }))
    }

    const handleSave = async () => {
        try {
            setSaving(true)
            await bonusAPI.update(bonusConfig)
            alert('Bonus configuration saved successfully!')
            onClose()
        } catch (error) {
            console.error('Failed to save bonus configuration:', error)
            alert(error.message || 'Failed to save bonus configuration. Please try again.')
        } finally {
            setSaving(false)
        }
    }

    const secondsToMinutes = (seconds) => {
        return Math.floor(seconds / 60)
    }

    const gameTypeLabels = {
        [GAME_TYPES.PLAYSTATION]: 'Playstation Console',
        [GAME_TYPES.STEERING_WHEEL]: 'Steering Wheel',
        [GAME_TYPES.SYSTEM]: 'System Game'
    }

    const tierLabels = {
        oneHour: '1+ Hour Played',
        twoHours: '2+ Hours Played',
        threeHours: '3+ Hours Played'
    }

    if (loading) {
        return (
            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-lg shadow-xl p-8">
                    <div className="flex items-center gap-3">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                        <span className="text-gray-700">Loading bonus configuration...</span>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-gray-200">
                <div className="p-6 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white z-20">
                    <div>
                        <h2 className="text-xl font-semibold text-gray-900">Bonus Time Configuration</h2>
                        <p className="text-xs text-gray-600 mt-1">
                            Configure free bonus time given to customers based on hours played
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-600 hover:text-gray-900 transition-colors p-2 rounded-md hover:bg-gray-100"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {/* Info Banner */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <div className="flex gap-3">
                            <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <div className="text-sm text-blue-900">
                                <p className="font-medium mb-1">How Bonus Time Works:</p>
                                <ul className="list-disc list-inside space-y-1 text-blue-800">
                                    <li>Bonus time is <strong>free time</strong> given to customers after they pay for certain hours</li>
                                    <li>For example: If 1 hour = 15 min bonus, customer pays for 1 hour but plays for 1 hour 15 minutes</li>
                                    <li>Set to <strong>0 minutes</strong> to disable bonus time for that tier</li>
                                    <li>Configure different bonus times for weekdays and weekends</li>
                                </ul>
                            </div>
                        </div>
                    </div>

                    {/* Configuration for each game type */}
                    {Object.values(GAME_TYPES).map((gameType) => (
                        <div key={gameType} className="bg-gray-50 rounded-lg p-5 border border-gray-200">
                            <h3 className="text-base font-semibold text-gray-900 mb-4">
                                {gameTypeLabels[gameType]}
                            </h3>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* Weekday Configuration */}
                                <div className="bg-white rounded-lg p-4 border border-gray-200">
                                    <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                        Monday - Friday
                                    </h4>
                                    <div className="space-y-3">
                                        {Object.keys(bonusConfig[gameType].weekday).map((tier) => (
                                            <div key={tier}>
                                                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                                                    {tierLabels[tier]}
                                                </label>
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="number"
                                                        value={secondsToMinutes(bonusConfig[gameType].weekday[tier])}
                                                        onChange={(e) => handleBonusChange(gameType, 'weekday', tier, e.target.value)}
                                                        className="flex-1 px-3 py-2 bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 font-medium text-sm"
                                                        min="0"
                                                        step="5"
                                                    />
                                                    <span className="text-sm text-gray-600 font-medium">minutes</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Weekend Configuration */}
                                <div className="bg-white rounded-lg p-4 border border-gray-200">
                                    <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                                        Saturday - Sunday
                                    </h4>
                                    <div className="space-y-3">
                                        {Object.keys(bonusConfig[gameType].weekend).map((tier) => (
                                            <div key={tier}>
                                                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                                                    {tierLabels[tier]}
                                                </label>
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="number"
                                                        value={secondsToMinutes(bonusConfig[gameType].weekend[tier])}
                                                        onChange={(e) => handleBonusChange(gameType, 'weekend', tier, e.target.value)}
                                                        className="flex-1 px-3 py-2 bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 font-medium text-sm"
                                                        min="0"
                                                        step="5"
                                                    />
                                                    <span className="text-sm text-gray-600 font-medium">minutes</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}

                    {/* Save Button */}
                    <div className="pt-4 border-t border-gray-200/50">
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-400 text-white rounded-md font-medium text-sm transition-colors flex items-center justify-center gap-2"
                            style={{ fontFamily: 'Rajdhani, sans-serif' }}
                        >
                            {saving ? (
                                <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                    <span>Saving...</span>
                                </>
                            ) : (
                                <>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    <span>Save & Close</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default BonusConfig
