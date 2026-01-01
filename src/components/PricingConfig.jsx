import { useState, useEffect } from 'react'
import { GAME_TYPES, loadPricing, savePricing } from '../utils/pricing'

const PricingConfig = ({ onClose }) => {
  const [pricing, setPricing] = useState(loadPricing())

  useEffect(() => {
    setPricing(loadPricing())
  }, [])

  const handlePriceChange = (gameType, dayType, value) => {
    const newPricing = {
      ...pricing,
      [gameType]: {
        ...pricing[gameType],
        [dayType]: parseFloat(value) || 0
      }
    }
    setPricing(newPricing)
  }

  const handleSave = async () => {
    try {
      await savePricing(pricing)
      onClose()
    } catch (error) {
      console.error('Failed to save pricing:', error)
      alert(error.message || 'Failed to save pricing. Please try again.')
    }
  }

  const gameTypeLabels = {
    [GAME_TYPES.PLAYSTATION]: 'Playstation Console',
    [GAME_TYPES.STEERING_WHEEL]: 'Steering Wheel',
    [GAME_TYPES.SYSTEM]: 'System Game'
  }

  const getGameTypeColor = (gameType) => {
    if (gameType === GAME_TYPES.PLAYSTATION) return 'cyan'
    if (gameType === GAME_TYPES.STEERING_WHEEL) return 'purple'
    return 'pink'
  }

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-gray-200">
        <div className="p-6 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white z-20">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Pricing Configuration</h2>
            <p className="text-xs text-gray-600 mt-1">Set hourly rates for different game types</p>
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

        <div className="p-6 space-y-4">
          {Object.values(GAME_TYPES).map((gameType) => {
            return (
              <div key={gameType} className="bg-gray-50 rounded-lg p-5 border border-gray-200">
                <h3 className="text-base font-semibold text-gray-900 mb-4">
                  {gameTypeLabels[gameType]}
                </h3>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-2">
                      Monday - Friday (₹/hour)
                    </label>
                    <input
                      type="number"
                      value={pricing[gameType]?.weekday || 0}
                      onChange={(e) => handlePriceChange(gameType, 'weekday', e.target.value)}
                      className="w-full px-4 py-2 bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 font-medium text-sm"
                      min="0"
                      step="1"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-2">
                      Saturday - Sunday (₹/hour)
                    </label>
                    <input
                      type="number"
                      value={pricing[gameType]?.weekend || 0}
                      onChange={(e) => handlePriceChange(gameType, 'weekend', e.target.value)}
                      className="w-full px-4 py-2 bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 font-medium text-sm"
                      min="0"
                      step="1"
                    />
                  </div>
                </div>
              </div>
            )
          })}

          {/* Extra Controller Rate */}
          <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-lg p-5 border border-orange-200">
            <h3 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
              <span>Extra Controller Rate</span>
            </h3>
            <p className="text-xs text-gray-600 mb-3">
              Price charged per additional controller (applies to PlayStation only)
            </p>
            <div className="max-w-xs">
              <label className="block text-xs font-medium text-gray-700 mb-2">
                Price per Extra Controller (₹)
              </label>
              <input
                type="number"
                value={pricing.extraControllerRate || 50}
                onChange={(e) => setPricing({ ...pricing, extraControllerRate: parseFloat(e.target.value) || 0 })}
                className="w-full px-4 py-2 bg-white border border-orange-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-gray-900 font-medium text-sm"
                min="0"
                step="5"
              />
            </div>
          </div>

          {/* Billing Buffer Time */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-5 border border-blue-200">
            <h3 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Billing Buffer Time</span>
            </h3>
            <p className="text-xs text-gray-600 mb-3">
              Grace period for billing when bonus time is 0. If time exceeds full hours by less than this buffer, charge only for full hours. Applies to all game types.
            </p>
            <div className="max-w-xs">
              <label className="block text-xs font-medium text-gray-700 mb-2">
                Buffer Time (minutes)
              </label>
              <input
                type="number"
                value={pricing.bufferMinutes || 10}
                onChange={(e) => setPricing({ ...pricing, bufferMinutes: parseFloat(e.target.value) || 0 })}
                className="w-full px-4 py-2 bg-white border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 font-medium text-sm"
                min="0"
                max="30"
                step="1"
              />
              <p className="text-xs text-gray-500 mt-2 italic">
                Example: 10 min buffer means 1hr 8min → charge 1hr, but 1hr 12min → charge 2hr
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-gray-200/50">
            <button
              onClick={handleSave}
              className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-md font-medium text-sm transition-colors"
              style={{ fontFamily: 'Rajdhani, sans-serif' }}
            >
              Save & Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PricingConfig

