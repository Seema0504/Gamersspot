import { useState, useEffect } from 'react'
import { GAME_TYPES } from '../utils/pricing'
import { stationsAPI } from '../utils/api'

const ManageStations = ({ onClose, stations, onStationsUpdate }) => {
    const [stationsList, setStationsList] = useState([])
    const [isAddingNew, setIsAddingNew] = useState(false)
    const [editingStation, setEditingStation] = useState(null)
    const [formData, setFormData] = useState({
        name: '',
        gameType: GAME_TYPES.PLAYSTATION
    })
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')

    useEffect(() => {
        // Sort stations by ID
        const sorted = [...stations].sort((a, b) => a.id - b.id)
        setStationsList(sorted)
    }, [stations])

    const resetForm = () => {
        setFormData({
            name: '',
            gameType: GAME_TYPES.PLAYSTATION
        })
        setIsAddingNew(false)
        setEditingStation(null)
        setError('')
    }

    const handleAddNew = () => {
        setIsAddingNew(true)
        setEditingStation(null)
        setFormData({
            name: '',
            gameType: GAME_TYPES.PLAYSTATION
        })
        setError('')
        setSuccess('')
    }

    const handleEdit = (station) => {
        setEditingStation(station)
        setIsAddingNew(false)
        setFormData({
            name: station.name,
            gameType: station.gameType
        })
        setError('')
        setSuccess('')
    }

    const handleSave = async () => {
        if (!formData.name.trim()) {
            setError('Station name is required')
            return
        }

        setLoading(true)
        setError('')
        setSuccess('')

        try {
            if (editingStation) {
                // Update existing station using PUT
                const updatedStation = {
                    ...editingStation,
                    name: formData.name.trim(),
                    gameType: formData.gameType
                }

                await stationsAPI.update(updatedStation)
                setSuccess(`Station "${formData.name}" updated successfully!`)

                // Update local list
                const updated = stationsList.map(s =>
                    s.id === editingStation.id ? updatedStation : s
                )
                setStationsList(updated)

                // Notify parent
                if (onStationsUpdate) {
                    onStationsUpdate(updated)
                }
            } else {
                // Add new station using POST (bulk insert)
                // Find the next available ID (start from 1 if no stations exist)
                const maxId = stationsList.length > 0 ? Math.max(...stationsList.map(s => s.id)) : 0
                const newId = maxId + 1

                const newStation = {
                    id: newId,
                    name: formData.name.trim(),
                    gameType: formData.gameType,
                    elapsedTime: 0,
                    isRunning: false,
                    isDone: false,
                    isPaused: false,
                    pausedTime: 0,
                    pauseStartTime: null,
                    extraControllers: 0,
                    snacks: {},
                    snacksEnabled: false,
                    customerName: '',
                    customerPhone: '',
                    startTime: null,
                    endTime: null
                }

                // Use POST with stations array to insert new station
                await stationsAPI.saveAll([newStation])
                setSuccess(`Station "${formData.name}" added successfully!`)

                // Update local list
                const updated = [...stationsList, newStation].sort((a, b) => a.id - b.id)
                setStationsList(updated)

                // Notify parent
                if (onStationsUpdate) {
                    onStationsUpdate(updated)
                }
            }

            // Reset form after short delay
            setTimeout(() => {
                resetForm()
                setSuccess('')
            }, 2000)
        } catch (err) {
            console.error('Error saving station:', err)
            setError(err.message || 'Failed to save station')
        } finally {
            setLoading(false)
        }
    }

    const handleDelete = async (station) => {
        // Check if station is currently in use
        if (station.isRunning || station.isDone) {
            setError('Cannot delete a station that is currently in use. Please reset it first.')
            setTimeout(() => setError(''), 3000)
            return
        }

        if (!confirm(`Are you sure you want to delete "${station.name}"?`)) {
            return
        }

        setLoading(true)
        setError('')
        setSuccess('')

        try {
            await stationsAPI.delete(station.id)
            setSuccess(`Station "${station.name}" deleted successfully!`)

            // Update local list
            const updated = stationsList.filter(s => s.id !== station.id)
            setStationsList(updated)

            // CRITICAL FIX: Update localStorage to prevent deleted stations from reappearing
            // The loadStations function falls back to localStorage, so we must update it
            // Using the correct localStorage key: 'ps-game-timer-stations'
            try {
                localStorage.setItem('ps-game-timer-stations', JSON.stringify(updated))
            } catch (localStorageError) {
                console.warn('Failed to update localStorage:', localStorageError)
            }

            // Notify parent to update App state
            if (onStationsUpdate) {
                onStationsUpdate(updated)
            }

            setTimeout(() => setSuccess(''), 2000)
        } catch (err) {
            console.error('Error deleting station:', err)
            setError(err.message || 'Failed to delete station')
        } finally {
            setLoading(false)
        }
    }

    const getGameTypeColor = (gameType) => {
        switch (gameType) {
            case GAME_TYPES.PLAYSTATION:
                return 'bg-blue-100 text-blue-800'
            case GAME_TYPES.STEERING_WHEEL:
                return 'bg-purple-100 text-purple-800'
            case GAME_TYPES.SYSTEM:
                return 'bg-green-100 text-green-800'
            default:
                return 'bg-gray-100 text-gray-800'
        }
    }

    const getStationStatus = (station) => {
        if (station.isRunning) return { text: 'Running', color: 'text-green-600' }
        if (station.isDone) return { text: 'Completed', color: 'text-blue-600' }
        return { text: 'Idle', color: 'text-gray-500' }
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6">
                    <div className="flex justify-between items-center">
                        <div>
                            <h2 className="text-2xl font-bold">Manage Stations</h2>
                            <p className="text-blue-100 text-sm mt-1">Add, edit, or delete gaming stations</p>
                        </div>
                        <button
                            onClick={onClose}
                            className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition-colors"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {/* Messages */}
                    {error && (
                        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center">
                            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                            </svg>
                            {error}
                        </div>
                    )}

                    {success && (
                        <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-center">
                            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            {success}
                        </div>
                    )}

                    {/* Add New Button */}
                    {!isAddingNew && !editingStation && (
                        <button
                            onClick={handleAddNew}
                            className="mb-6 w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 px-4 rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all flex items-center justify-center font-semibold"
                        >
                            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Add New Station
                        </button>
                    )}

                    {/* Add/Edit Form */}
                    {(isAddingNew || editingStation) && (
                        <div className="mb-6 bg-gray-50 border-2 border-blue-200 rounded-lg p-6">
                            <h3 className="text-lg font-semibold mb-4 text-gray-800">
                                {editingStation ? 'Edit Station' : 'Add New Station'}
                            </h3>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Station Name *
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        placeholder="e.g., Seat 1, VIP Station, etc."
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Game Type *
                                    </label>
                                    <select
                                        value={formData.gameType}
                                        onChange={(e) => setFormData({ ...formData, gameType: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    >
                                        <option value={GAME_TYPES.PLAYSTATION}>PlayStation</option>
                                        <option value={GAME_TYPES.STEERING_WHEEL}>Steering Wheel</option>
                                        <option value={GAME_TYPES.SYSTEM}>System Game</option>
                                    </select>
                                </div>

                                <div className="flex gap-3 pt-2">
                                    <button
                                        onClick={handleSave}
                                        disabled={loading}
                                        className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
                                    >
                                        {loading ? 'Saving...' : (editingStation ? 'Update Station' : 'Add Station')}
                                    </button>
                                    <button
                                        onClick={resetForm}
                                        disabled={loading}
                                        className="flex-1 bg-gray-200 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-300 transition-colors disabled:bg-gray-100 disabled:cursor-not-allowed font-medium"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Stations List */}
                    <div className="space-y-3">
                        <h3 className="text-lg font-semibold text-gray-800 mb-3">
                            All Stations ({stationsList.length})
                        </h3>

                        {stationsList.length === 0 ? (
                            <div className="text-center py-12 text-gray-500">
                                <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                                </svg>
                                <p className="text-lg">No stations found</p>
                                <p className="text-sm mt-1">Click "Add New Station" to create one</p>
                            </div>
                        ) : (
                            stationsList.map((station) => {
                                const status = getStationStatus(station)

                                return (
                                    <div
                                        key={station.id}
                                        className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-3 mb-2">
                                                    <h4 className="font-semibold text-gray-800 text-lg">
                                                        {station.name}
                                                    </h4>
                                                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getGameTypeColor(station.gameType)}`}>
                                                        {station.gameType}
                                                    </span>
                                                    <span className={`text-sm font-medium ${status.color}`}>
                                                        {status.text}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-4 text-sm text-gray-600">
                                                    <span>ID: {station.id}</span>
                                                </div>
                                            </div>

                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => handleEdit(station)}
                                                    disabled={loading}
                                                    className="px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(station)}
                                                    disabled={loading || station.isRunning || station.isDone}
                                                    className="px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                                                    title={station.isRunning || station.isDone ? 'Cannot delete station in use' : 'Delete station'}
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
                    <div className="flex justify-between items-center text-sm text-gray-600">
                        <div>
                            <p className="font-medium">💡 Tips:</p>
                            <ul className="list-disc list-inside mt-1 space-y-1">
                                <li>All stations can be created, edited, or deleted from here</li>
                                <li>Stations in use cannot be deleted until reset</li>
                                <li>Changes appear in the dashboard immediately</li>
                            </ul>
                        </div>
                        <button
                            onClick={onClose}
                            className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ManageStations
