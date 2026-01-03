/**
 * ============================================================================
 * SUBSCRIPTION STATUS BADGE
 * ============================================================================
 * Shows current subscription status in the UI
 * Displays warnings when subscription is expiring
 * ============================================================================
 */

import React from 'react';
import { useSubscription } from '../contexts/SubscriptionContext';

export default function SubscriptionStatusBadge({ className = '' }) {
    const { subscription, loading, isTrial, isActive, isGrace, isExpired, daysRemaining, planName } = useSubscription();

    if (loading || !subscription) {
        return null;
    }

    // Determine badge color and icon
    let badgeClass = '';
    let icon = '';
    let statusText = '';
    let showWarning = false;

    if (isExpired) {
        badgeClass = 'bg-red-100 text-red-800 border-red-300';
        icon = '❌';
        statusText = 'Expired';
        showWarning = true;
    } else if (isGrace) {
        badgeClass = 'bg-orange-100 text-orange-800 border-orange-300';
        icon = '⚠️';
        statusText = 'Grace Period';
        showWarning = true;
    } else if (isTrial) {
        badgeClass = 'bg-blue-100 text-blue-800 border-blue-300';
        icon = '🎯';
        statusText = 'Trial';
        showWarning = daysRemaining <= 3;
    } else if (isActive) {
        badgeClass = 'bg-green-100 text-green-800 border-green-300';
        icon = '✓';
        statusText = 'Active';
        showWarning = daysRemaining <= 7;
    }

    return (
        <div className={`inline-flex flex-col gap-1 ${className}`}>
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border ${badgeClass} font-medium text-sm`}>
                <span>{icon}</span>
                <span>{statusText} - {planName}</span>
            </div>

            {showWarning && daysRemaining > 0 && (
                <div className="text-xs text-orange-600 font-medium">
                    ⏰ {daysRemaining} day{daysRemaining !== 1 ? 's' : ''} remaining
                </div>
            )}

            {showWarning && daysRemaining <= 0 && (
                <div className="text-xs text-red-600 font-medium">
                    Expired {Math.abs(daysRemaining)} day{Math.abs(daysRemaining) !== 1 ? 's' : ''} ago
                </div>
            )}
        </div>
    );
}

/**
 * ============================================================================
 * SUBSCRIPTION DETAILS CARD
 * ============================================================================
 * Full subscription information card for dashboard
 * ============================================================================
 */

export function SubscriptionDetailsCard() {
    const { subscription, loading, setShowExpiredModal, fetchSubscription } = useSubscription();

    if (loading) {
        return (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="animate-pulse">
                    <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
                    <div className="h-8 bg-gray-200 rounded w-1/2"></div>
                </div>
            </div>
        );
    }

    if (!subscription) {
        return null;
    }

    const expiresAt = new Date(subscription.expires_at);
    const daysRemaining = subscription.days_remaining;
    const isExpiringSoon = daysRemaining <= 7 && daysRemaining > 0;

    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex justify-between items-start mb-4">
                <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">
                        Subscription Status
                    </h3>
                    <SubscriptionStatusBadge />
                </div>
                <button
                    onClick={fetchSubscription}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                    title="Refresh"
                >
                    🔄
                </button>
            </div>

            <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <span className="text-sm text-gray-600">Plan</span>
                    <span className="font-medium text-gray-900">{subscription.plan_name}</span>
                </div>

                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <span className="text-sm text-gray-600">Price</span>
                    <span className="font-medium text-gray-900">
                        {subscription.price === 0 ? 'Free' : `₹${subscription.price}`}
                    </span>
                </div>

                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <span className="text-sm text-gray-600">Expires On</span>
                    <span className="font-medium text-gray-900">
                        {expiresAt.toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                        })}
                    </span>
                </div>

                <div className="flex justify-between items-center py-2">
                    <span className="text-sm text-gray-600">Days Remaining</span>
                    <span className={`font-bold ${daysRemaining <= 0 ? 'text-red-600' :
                            daysRemaining <= 3 ? 'text-orange-600' :
                                daysRemaining <= 7 ? 'text-yellow-600' :
                                    'text-green-600'
                        }`}>
                        {daysRemaining > 0 ? daysRemaining : `Expired ${Math.abs(daysRemaining)} days ago`}
                    </span>
                </div>
            </div>

            {(isExpiringSoon || daysRemaining <= 0) && (
                <div className={`mt-4 p-4 rounded-lg ${daysRemaining <= 0 ? 'bg-red-50 border border-red-200' : 'bg-yellow-50 border border-yellow-200'
                    }`}>
                    <p className={`text-sm font-medium mb-2 ${daysRemaining <= 0 ? 'text-red-900' : 'text-yellow-900'
                        }`}>
                        {daysRemaining <= 0
                            ? '⚠️ Your subscription has expired!'
                            : '⏰ Your subscription is expiring soon!'
                        }
                    </p>
                    <button
                        onClick={() => setShowExpiredModal(true)}
                        className={`w-full py-2 px-4 rounded-lg font-medium transition-colors ${daysRemaining <= 0
                                ? 'bg-red-600 hover:bg-red-700 text-white'
                                : 'bg-yellow-600 hover:bg-yellow-700 text-white'
                            }`}
                    >
                        Renew Now
                    </button>
                </div>
            )}

            {subscription.features && Object.keys(subscription.features).length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Plan Features</h4>
                    <ul className="space-y-1">
                        {subscription.features.max_stations === -1 && (
                            <li className="text-sm text-gray-600 flex items-center gap-2">
                                <span className="text-green-600">✓</span>
                                Unlimited Stations
                            </li>
                        )}
                        {subscription.features.max_stations > 0 && (
                            <li className="text-sm text-gray-600 flex items-center gap-2">
                                <span className="text-blue-600">•</span>
                                Up to {subscription.features.max_stations} Stations
                            </li>
                        )}
                        {subscription.features.max_invoices_per_month === -1 && (
                            <li className="text-sm text-gray-600 flex items-center gap-2">
                                <span className="text-green-600">✓</span>
                                Unlimited Invoices
                            </li>
                        )}
                        {subscription.features.discount_percent && (
                            <li className="text-sm text-green-600 flex items-center gap-2">
                                <span>🎉</span>
                                {subscription.features.discount_percent}% Discount
                            </li>
                        )}
                    </ul>
                </div>
            )}
        </div>
    );
}
