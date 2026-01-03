/**
 * ============================================================================
 * SUBSCRIPTION CONTEXT - Frontend State Management
 * ============================================================================
 * Provides subscription state to all components
 * Automatically refreshes subscription status
 * Shows blocking modals when subscription expires
 * ============================================================================
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const SubscriptionContext = createContext(null);

export function SubscriptionProvider({ children }) {
    const [subscription, setSubscription] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showExpiredModal, setShowExpiredModal] = useState(false);

    /**
     * Fetch current subscription status
     */
    const fetchSubscription = useCallback(async () => {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                setLoading(false);
                return;
            }

            const response = await fetch('/api/subscriptions?action=status', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                setSubscription(data.subscription);
                setError(null);

                // Show modal if expired
                if (data.subscription.status === 'expired') {
                    setShowExpiredModal(true);
                }
            } else if (response.status === 401) {
                // Not authenticated - clear subscription
                setSubscription(null);
            } else {
                const errorData = await response.json();
                setError(errorData.error || 'Failed to fetch subscription');
            }
        } catch (err) {
            console.error('Subscription fetch error:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    /**
     * Renew subscription
     */
    const renewSubscription = useCallback(async (planCode, paymentDetails = {}) => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/subscriptions?action=renew', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    plan_code: planCode,
                    ...paymentDetails
                })
            });

            if (response.ok) {
                const data = await response.json();
                setSubscription(data.subscription);
                setShowExpiredModal(false);
                return { success: true, data };
            } else {
                const errorData = await response.json();
                return { success: false, error: errorData.error };
            }
        } catch (err) {
            console.error('Subscription renewal error:', err);
            return { success: false, error: err.message };
        }
    }, []);

    /**
     * Get available plans
     */
    const getPlans = useCallback(async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/subscriptions?action=plans', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                return { success: true, plans: data.plans };
            } else {
                return { success: false, error: 'Failed to fetch plans' };
            }
        } catch (err) {
            return { success: false, error: err.message };
        }
    }, []);

    // Fetch subscription on mount and when user logs in
    useEffect(() => {
        fetchSubscription();

        // Refresh every 5 minutes
        const interval = setInterval(fetchSubscription, 5 * 60 * 1000);

        return () => clearInterval(interval);
    }, [fetchSubscription]);

    const value = {
        subscription,
        loading,
        error,
        showExpiredModal,
        setShowExpiredModal,
        fetchSubscription,
        renewSubscription,
        getPlans,
        // Computed properties
        isValid: subscription?.is_valid || false,
        isTrial: subscription?.status === 'trial',
        isActive: subscription?.status === 'active',
        isGrace: subscription?.status === 'grace',
        isExpired: subscription?.status === 'expired',
        daysRemaining: subscription?.days_remaining || 0,
        planName: subscription?.plan_name || 'Unknown'
    };

    return (
        <SubscriptionContext.Provider value={value}>
            {children}
            {showExpiredModal && <SubscriptionExpiredModal />}
        </SubscriptionContext.Provider>
    );
}

/**
 * Hook to use subscription context
 */
export function useSubscription() {
    const context = useContext(SubscriptionContext);
    if (!context) {
        throw new Error('useSubscription must be used within SubscriptionProvider');
    }
    return context;
}

/**
 * Subscription Expired Modal Component
 */
function SubscriptionExpiredModal() {
    const { subscription, setShowExpiredModal, renewSubscription, getPlans } = useSubscription();
    const [plans, setPlans] = useState([]);
    const [selectedPlan, setSelectedPlan] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        async function loadPlans() {
            const result = await getPlans();
            if (result.success) {
                setPlans(result.plans.filter(p => p.code !== 'FREE_TRIAL'));
                setSelectedPlan(result.plans.find(p => p.code === 'MONTHLY'));
            }
        }
        loadPlans();
    }, [getPlans]);

    const handleRenew = async () => {
        if (!selectedPlan) return;

        setLoading(true);
        const result = await renewSubscription(selectedPlan.code, {
            payment_method: 'MANUAL',
            notes: 'Manual renewal from expired modal'
        });

        if (result.success) {
            alert('Subscription renewed successfully!');
            setShowExpiredModal(false);
        } else {
            alert(`Failed to renew: ${result.error}`);
        }
        setLoading(false);
    };

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-8 max-w-2xl w-full shadow-2xl">
                <div className="text-center mb-6">
                    <div className="text-6xl mb-4">⚠️</div>
                    <h2 className="text-3xl font-bold text-red-600 mb-2">
                        Subscription Expired
                    </h2>
                    <p className="text-gray-600">
                        Your subscription has expired. Please renew to continue using Gamers Spot.
                    </p>
                </div>

                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-medium text-red-900">Current Plan</p>
                            <p className="text-sm text-red-700">{subscription?.plan_name}</p>
                        </div>
                        <div className="text-right">
                            <p className="font-medium text-red-900">Expired</p>
                            <p className="text-sm text-red-700">
                                {Math.abs(subscription?.days_remaining || 0)} days ago
                            </p>
                        </div>
                    </div>
                </div>

                <div className="mb-6">
                    <h3 className="font-semibold text-lg mb-4">Choose a Plan</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {plans.map(plan => (
                            <button
                                key={plan.code}
                                onClick={() => setSelectedPlan(plan)}
                                className={`p-4 border-2 rounded-lg text-left transition-all ${selectedPlan?.code === plan.code
                                        ? 'border-blue-600 bg-blue-50'
                                        : 'border-gray-200 hover:border-blue-300'
                                    }`}
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <h4 className="font-bold text-lg">{plan.name}</h4>
                                    {selectedPlan?.code === plan.code && (
                                        <span className="text-blue-600">✓</span>
                                    )}
                                </div>
                                <p className="text-2xl font-bold text-blue-600 mb-1">
                                    ₹{plan.price}
                                </p>
                                <p className="text-sm text-gray-600">
                                    {plan.duration_days} days
                                </p>
                                {plan.features?.discount_percent && (
                                    <p className="text-xs text-green-600 mt-2">
                                        Save {plan.features.discount_percent}%
                                    </p>
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex gap-4">
                    <button
                        onClick={handleRenew}
                        disabled={!selectedPlan || loading}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold py-3 px-6 rounded-lg transition-colors"
                    >
                        {loading ? 'Processing...' : `Renew for ₹${selectedPlan?.price || 0}`}
                    </button>
                    <button
                        onClick={() => setShowExpiredModal(false)}
                        className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                        Later
                    </button>
                </div>

                <p className="text-xs text-gray-500 text-center mt-4">
                    Contact support if you need assistance
                </p>
            </div>
        </div>
    );
}
