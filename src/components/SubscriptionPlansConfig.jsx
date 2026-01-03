/**
 * ============================================================================
 * SUBSCRIPTION PLANS CONFIGURATION - SUPER ADMIN
 * ============================================================================
 * Allows Super Admin to configure subscription plan pricing and features
 * ============================================================================
 */

import React, { useState, useEffect } from 'react';

export default function SubscriptionPlansConfig({ onClose }) {
    const [plans, setPlans] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [editingPlan, setEditingPlan] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchPlans();
    }, []);

    const fetchPlans = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/admin?action=get-plans', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                console.log('Plans API Response:', data);
                // Map DB columns to frontend properties
                const formattedPlans = (data.plans || []).map(p => ({
                    ...p,
                    code: p.plan_code,
                    name: p.plan_name,
                    price: parseFloat(p.price_inr),
                    duration_days: p.duration_days,
                    features: p.features
                }));
                setPlans(formattedPlans);
                setError(null);
            } else {
                const errorData = await response.json();
                console.error('API Error:', errorData);
                setError(errorData.error || 'Failed to load plans');
            }
        } catch (error) {
            console.error('Error fetching plans:', error);
            setError('Failed to load subscription plans: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleEditPlan = (plan) => {
        setEditingPlan({
            code: plan.code,
            name: plan.name,
            duration_days: plan.duration_days,
            price: plan.price,
            features: plan.features || {}
        });
    };

    const handleSavePlan = async () => {
        if (!editingPlan) return;

        setSaving(true);
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/admin?action=update-plan', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    plan_code: editingPlan.code,
                    plan_name: editingPlan.name,
                    duration_days: parseInt(editingPlan.duration_days),
                    price_inr: parseFloat(editingPlan.price),
                    features: editingPlan.features
                })
            });

            if (response.ok) {
                alert('Plan updated successfully!');
                setEditingPlan(null);
                fetchPlans();
            } else {
                const error = await response.json();
                alert('Failed to update plan: ' + (error.error || 'Unknown error'));
            }
        } catch (error) {
            console.error('Error saving plan:', error);
            alert('Failed to save plan: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    const calculateDiscount = (plan) => {
        const monthlyPrice = plans.find(p => p.code === 'MONTHLY')?.price || 999;
        const monthsInPlan = plan.duration_days / 30;
        const fullPrice = monthlyPrice * monthsInPlan;
        const discount = ((fullPrice - plan.price) / fullPrice) * 100;
        return Math.round(discount);
    };

    const handleToggleActive = async (plan) => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/admin?action=update-plan', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    plan_code: plan.code,
                    is_active: !plan.is_active
                })
            });

            if (response.ok) {
                // Optimistic update
                setPlans(plans.map(p =>
                    p.code === plan.code ? { ...p, is_active: !p.is_active } : p
                ));
            } else {
                const error = await response.json();
                alert('Failed to update plan status: ' + (error.error || 'Unknown error'));
            }
        } catch (error) {
            console.error('Error updating plan status:', error);
            alert('Failed to update plan status');
        }
    };

    if (loading) {
        return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg p-8">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Loading plans...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full my-8">
                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-gray-200">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900">Subscription Plans Configuration</h2>
                        <p className="text-sm text-gray-600 mt-1">Manage pricing and features for all subscription tiers</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Plans Grid */}
                <div className="p-6">
                    {error && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                            <div className="flex items-center gap-2">
                                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <p className="text-red-800 font-medium">{error}</p>
                            </div>
                            <button
                                onClick={fetchPlans}
                                className="mt-3 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
                            >
                                Retry
                            </button>
                        </div>
                    )}

                    {!error && plans.length === 0 && (
                        <div className="text-center py-12">
                            <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                            </svg>
                            <h3 className="text-lg font-medium text-gray-900 mb-2">No Subscription Plans Found</h3>
                            <p className="text-gray-600 mb-4">There are no subscription plans configured yet.</p>
                            <p className="text-sm text-gray-500">Run the subscription migration script to set up default plans.</p>
                        </div>
                    )}

                    {!error && plans.length > 0 && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {plans.map(plan => {
                                const discount = plan.code !== 'FREE_TRIAL' && plan.code !== 'MONTHLY'
                                    ? calculateDiscount(plan)
                                    : 0;

                                return (
                                    <div
                                        key={plan.code}
                                        className={`border-2 rounded-lg p-6 transition-all ${plan.code === 'YEARLY'
                                            ? 'border-blue-500 bg-blue-50 shadow-lg'
                                            : 'border-gray-200 hover:border-blue-300'
                                            } ${!plan.is_active ? 'opacity-60 bg-gray-50' : ''}`}
                                    >
                                        {/* Plan Header */}
                                        <div className="mb-4">
                                            <div className="flex justify-between items-start mb-2">
                                                <h3 className="text-lg font-bold text-gray-900">{plan.name}</h3>
                                                <div className="flex flex-col items-end gap-2">
                                                    {plan.code === 'YEARLY' && (
                                                        <span className="bg-blue-600 text-white text-xs px-2 py-1 rounded-full">
                                                            BEST VALUE
                                                        </span>
                                                    )}
                                                    <label className="relative inline-flex items-center cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={plan.is_active}
                                                            onChange={() => handleToggleActive(plan)}
                                                            className="sr-only peer"
                                                        />
                                                        <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-green-600"></div>
                                                    </label>
                                                </div>
                                            </div>
                                            <p className="text-xs text-gray-500 font-mono">{plan.code}</p>
                                        </div>

                                        {/* Pricing */}
                                        <div className="mb-4">
                                            <div className="flex items-baseline gap-2">
                                                <span className="text-3xl font-bold text-gray-900">₹{plan.price}</span>
                                                {plan.code !== 'FREE_TRIAL' && (
                                                    <span className="text-sm text-gray-500">/ {plan.duration_days} days</span>
                                                )}
                                            </div>
                                            {discount > 0 && (
                                                <p className="text-sm text-green-600 font-medium mt-1">
                                                    Save {discount}% vs Monthly
                                                </p>
                                            )}
                                        </div>

                                        {/* Features */}
                                        <div className="mb-4 space-y-2">
                                            <div className="flex items-center gap-2 text-sm text-gray-700">
                                                <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                </svg>
                                                <span>{plan.duration_days} days access</span>
                                            </div>
                                            {plan.features?.max_stations === -1 && (
                                                <div className="flex items-center gap-2 text-sm text-gray-700">
                                                    <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                    </svg>
                                                    <span>Unlimited Stations</span>
                                                </div>
                                            )}
                                            {plan.features?.max_stations > 0 && (
                                                <div className="flex items-center gap-2 text-sm text-gray-700">
                                                    <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                                    </svg>
                                                    <span>Up to {plan.features.max_stations} Stations</span>
                                                </div>
                                            )}
                                            {plan.features?.max_invoices_per_month === -1 && (
                                                <div className="flex items-center gap-2 text-sm text-gray-700">
                                                    <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                    </svg>
                                                    <span>Unlimited Invoices</span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Edit Button */}
                                        <button
                                            onClick={() => handleEditPlan(plan)}
                                            className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                                        >
                                            Edit Plan
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Edit Modal */}
                {editingPlan && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6">
                            <h3 className="text-xl font-bold text-gray-900 mb-6">
                                Edit Plan: {editingPlan.name}
                            </h3>

                            <div className="space-y-4">
                                {/* Plan Name */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Plan Name
                                    </label>
                                    <input
                                        type="text"
                                        value={editingPlan.name}
                                        onChange={(e) => setEditingPlan({ ...editingPlan, name: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    />
                                </div>

                                {/* Duration */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Duration (days)
                                    </label>
                                    <input
                                        type="number"
                                        value={editingPlan.duration_days}
                                        onChange={(e) => setEditingPlan({ ...editingPlan, duration_days: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    />
                                </div>

                                {/* Price */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Price (₹)
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={editingPlan.price}
                                        onChange={(e) => setEditingPlan({ ...editingPlan, price: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        disabled={editingPlan.code === 'FREE_TRIAL'}
                                    />
                                    {editingPlan.code === 'FREE_TRIAL' && (
                                        <p className="text-xs text-gray-500 mt-1">Trial is always free</p>
                                    )}
                                </div>

                                {/* Features */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Max Stations (-1 for unlimited)
                                    </label>
                                    <input
                                        type="number"
                                        value={editingPlan.features?.max_stations || -1}
                                        onChange={(e) => setEditingPlan({
                                            ...editingPlan,
                                            features: { ...editingPlan.features, max_stations: parseInt(e.target.value) }
                                        })}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Max Invoices per Month (-1 for unlimited)
                                    </label>
                                    <input
                                        type="number"
                                        value={editingPlan.features?.max_invoices_per_month || -1}
                                        onChange={(e) => setEditingPlan({
                                            ...editingPlan,
                                            features: { ...editingPlan.features, max_invoices_per_month: parseInt(e.target.value) }
                                        })}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    />
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-3 mt-6">
                                <button
                                    onClick={handleSavePlan}
                                    disabled={saving}
                                    className="flex-1 py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors"
                                >
                                    {saving ? 'Saving...' : 'Save Changes'}
                                </button>
                                <button
                                    onClick={() => setEditingPlan(null)}
                                    className="flex-1 py-2 px-4 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-medium transition-colors"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
