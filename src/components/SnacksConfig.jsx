import { useState, useEffect } from 'react'
import { snacksAPI } from '../utils/api'

const SnacksConfig = ({ onClose }) => {
  const [snacks, setSnacks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [newSnack, setNewSnack] = useState({ name: '', price: '', display_order: 0 })

  useEffect(() => {
    loadSnacks()
  }, [])

  const loadSnacks = async () => {
    try {
      setLoading(true)
      const data = await snacksAPI.getAll(false) // Get all snacks including inactive
      setSnacks(data.sort((a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name)))
      setError(null)
    } catch (err) {
      console.error('Error loading snacks:', err)
      setError('Failed to load snacks')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (snack) => {
    try {
      if (snack.id) {
        await snacksAPI.update(snack)
      } else {
        await snacksAPI.create(snack)
      }
      await loadSnacks()
      setEditingId(null)
      setNewSnack({ name: '', price: '', display_order: 0 })
    } catch (err) {
      console.error('Error saving snack:', err)
      alert('Failed to save snack')
    }
  }

  const handleDelete = async (id, name) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) {
      return
    }
    try {
      await snacksAPI.delete(id, false) // Soft delete
      await loadSnacks()
    } catch (err) {
      console.error('Error deleting snack:', err)
      alert('Failed to delete snack')
    }
  }

  const handleToggleActive = async (snack) => {
    try {
      await snacksAPI.update({ ...snack, active: !snack.active })
      await loadSnacks()
    } catch (err) {
      console.error('Error toggling snack:', err)
      alert('Failed to update snack')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto border border-gray-200">
        <div className="p-6 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white z-20">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Snacks Configuration</h2>
            <p className="text-xs text-gray-600 mt-1">Manage snack items and pricing</p>
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
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3 text-red-700 text-sm">
              {error}
            </div>
          )}

          {loading ? (
            <div className="text-center py-8 text-gray-600">Loading snacks...</div>
          ) : (
            <>
              {/* Add New Snack */}
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">
                  Add New Snack
                </h3>
                <div className="grid grid-cols-4 gap-3">
                  <input
                    type="text"
                    placeholder="Snack Name"
                    value={newSnack.name}
                    onChange={(e) => setNewSnack({ ...newSnack, name: e.target.value })}
                    className="col-span-2 px-3 py-2 bg-white border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                  <input
                    type="number"
                    placeholder="Price (₹)"
                    value={newSnack.price}
                    onChange={(e) => setNewSnack({ ...newSnack, price: e.target.value })}
                    className="px-3 py-2 bg-white border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    min="0"
                    step="0.01"
                  />
                  <button
                    onClick={() => handleSave(newSnack)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium text-sm transition-colors shadow-sm disabled:bg-gray-300 disabled:cursor-not-allowed"
                    disabled={!newSnack.name || !newSnack.price}
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Existing Snacks */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">
                  Manage Snacks
                </h3>
                {snacks.map((snack) => (
                  <div
                    key={snack.id}
                    className={`bg-white rounded-lg p-4 border border-gray-200 shadow-sm ${!snack.active ? 'opacity-60' : ''}`}
                  >
                    {editingId === snack.id ? (
                      <div className="grid grid-cols-4 gap-3">
                        <input
                          type="text"
                          value={snack.name}
                          onChange={(e) => setSnacks(snacks.map(s => s.id === snack.id ? { ...s, name: e.target.value } : s))}
                          className="col-span-2 px-3 py-2 bg-white border border-gray-300 rounded-md text-gray-900 text-sm"
                        />
                        <input
                          type="number"
                          value={snack.price}
                          onChange={(e) => setSnacks(snacks.map(s => s.id === snack.id ? { ...s, price: parseFloat(e.target.value) } : s))}
                          className="px-3 py-2 bg-white border border-gray-300 rounded-md text-gray-900 text-sm"
                          min="0"
                          step="0.01"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleSave(snack)}
                            className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium text-xs transition-colors shadow-sm"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="flex-1 px-3 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-md font-medium text-xs transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 flex-1">
                          <span className={`text-sm font-medium ${snack.active ? 'text-gray-900' : 'text-gray-500'}`}>
                            {snack.name}
                          </span>
                          <span className="text-gray-600 text-sm">₹{snack.price}</span>
                          <span className={`text-xs px-2 py-1 rounded font-medium ${snack.active ? 'bg-gray-100 text-gray-700 border border-gray-300' : 'bg-gray-50 text-gray-500 border border-gray-200'}`}>
                            {snack.active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleToggleActive(snack)}
                            className={`px-3 py-1 rounded text-xs font-medium transition-colors border ${snack.active ? 'bg-gray-100 text-gray-700 hover:bg-gray-200 border-gray-300' : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border-gray-200'}`}
                          >
                            {snack.active ? 'Deactivate' : 'Activate'}
                          </button>
                          <button
                            onClick={() => setEditingId(snack.id)}
                            className="px-3 py-1 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded text-xs font-medium transition-colors border border-gray-300"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(snack.id, snack.name)}
                            className="px-3 py-1 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded text-xs font-medium transition-colors border border-gray-300"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="pt-4 border-t border-gray-200">
            <button
              onClick={onClose}
              className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium text-sm transition-colors shadow-sm"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SnacksConfig


