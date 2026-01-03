import React, { useState, useEffect } from 'react';
import SubscriptionPlansConfig from './SubscriptionPlansConfig';

// Scaffolding for Admin Dashboard
const AdminDashboard = ({ onLogout, onManageShop }) => {
    const [shops, setShops] = useState([]);
    const [loading, setLoading] = useState(true);
    const [newShop, setNewShop] = useState({
        name: '',
        ownerUsername: '',
        ownerPassword: '',
        phone: '',
        email: '',
        address: '',
        upiId: '',
        upiId: '',
        planCode: 'FREE_TRIAL'
    });
    const [plans, setPlans] = useState([]);
    const [editingShop, setEditingShop] = useState(null); // Shop being edited
    const [showEditModal, setShowEditModal] = useState(false);
    const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
    const [selectedShopForSub, setSelectedShopForSub] = useState(null);
    const [subscriptionData, setSubscriptionData] = useState({
        plan_name: 'PREMIUM_MONTHLY',
        monthly_amount: 999,
        end_date: '',
        status: 'ACTIVE'
    });
    const [showCredentialsModal, setShowCredentialsModal] = useState(false);
    const [credentialsData, setCredentialsData] = useState({ shopId: null, username: '', password: '' });
    const [sortConfig, setSortConfig] = useState({ key: 'created_at', direction: 'desc' });
    const [showDeleted, setShowDeleted] = useState(false);
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [selectedShopForHistory, setSelectedShopForHistory] = useState(null);
    const [historyTab, setHistoryTab] = useState('subscriptions'); // 'subscriptions' or 'payments'
    const [historyData, setHistoryData] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [showPlansConfig, setShowPlansConfig] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [systemSettingsOpen, setSystemSettingsOpen] = useState(false);

    useEffect(() => {
        if (showHistoryModal && selectedShopForHistory) {
            fetchHistory(selectedShopForHistory.id, historyTab);
        }
    }, [historyTab, showHistoryModal]);

    const fetchHistory = async (shopId, type) => {
        setHistoryLoading(true);
        try {
            const token = localStorage.getItem('token');
            const action = type === 'subscriptions' ? 'subscription-history' : 'payment-history';
            const res = await fetch(`/api/admin?action=${action}&shopId=${shopId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setHistoryData(data);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setHistoryLoading(false);
        }
    };

    const handleViewHistory = (shop) => {
        setSelectedShopForHistory(shop);
        setHistoryTab('subscriptions'); // Default tab
        setShowHistoryModal(true);
    };


    useEffect(() => {
        fetchShops();
        fetchPlans();
    }, [showDeleted]);

    const fetchPlans = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/admin?action=get-plans', {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setPlans(data.plans || []);
            }
        } catch (error) {
            console.error('Error fetching plans:', error);
        }
    };

    const fetchShops = async () => {
        try {
            const token = localStorage.getItem('token');
            const url = `/api/admin?action=shops${showDeleted ? '&includeDeleted=true' : ''}`;
            const res = await fetch(url, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setShops(data);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateShop = async (e) => {
        e.preventDefault();

        // Frontend validation for phone number
        const phoneRegex = /^[6-9]\d{9}$/;
        if (!phoneRegex.test(newShop.phone)) {
            alert('Invalid phone number! Please enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.');
            return;
        }

        const token = localStorage.getItem('token');
        try {
            const res = await fetch('/api/admin?action=create-shop', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(newShop)
            });
            const data = await res.json();

            if (res.ok) {
                alert('Shop Created!');
                fetchShops();
                fetchShops();
                setNewShop({ name: '', ownerUsername: '', ownerPassword: '', phone: '', email: '', address: '', upiId: '', planCode: 'FREE_TRIAL' });
            } else {
                alert(data.error || 'Failed to create shop');
            }
        } catch (error) {
            console.error('Error creating shop:', error);
            alert('An error occurred. Please try again.');
        }
    };

    const handleManageShop = (shop) => {
        if (onManageShop) {
            onManageShop(shop);
        }
    };

    const handleEditShop = (shop) => {
        setEditingShop({
            id: shop.id,
            name: shop.name,
            address: shop.address || '',
            phone: shop.phone || '',
            email: shop.email || '',
            upi_id: shop.upi_id || ''
        });
        setShowEditModal(true);
    };

    const handleUpdateShop = async (e) => {
        e.preventDefault();
        const token = localStorage.getItem('token');
        const res = await fetch('/api/admin?action=update-shop', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify(editingShop)
        });
        if (res.ok) {
            alert('Shop Updated!');
            setShowEditModal(false);
            fetchShops();
        } else {
            alert('Failed to update shop');
        }
    };

    const handleManageSubscription = async (shop) => {
        setSelectedShopForSub(shop);

        // Fetch current subscription for this shop
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`/api/admin?action=get-subscription&shopId=${shop.id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.ok) {
                const data = await res.json();
                if (data.subscription) {
                    // Load existing subscription data
                    setSubscriptionData({
                        plan_name: data.subscription.plan_name || 'PREMIUM_MONTHLY',
                        monthly_amount: data.subscription.monthly_amount || 999,
                        end_date: data.subscription.end_date ? data.subscription.end_date.split('T')[0] : '',
                        status: data.subscription.status || 'ACTIVE'
                    });
                } else {
                    // No subscription exists, use defaults
                    setSubscriptionData({
                        plan_name: 'PREMIUM_MONTHLY',
                        monthly_amount: 999,
                        end_date: '',
                        status: 'ACTIVE'
                    });
                }
            }
        } catch (error) {
            console.error('Error fetching subscription:', error);
            // Use defaults on error
            setSubscriptionData({
                plan_name: 'PREMIUM_MONTHLY',
                monthly_amount: 999,
                end_date: '',
                status: 'ACTIVE'
            });
        }

        setShowSubscriptionModal(true);
    };

    const handleUpdateSubscription = async (e) => {
        e.preventDefault();
        const token = localStorage.getItem('token');
        const res = await fetch('/api/admin?action=update-subscription', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
                shop_id: selectedShopForSub.id,
                ...subscriptionData
            })
        });
        if (res.ok) {
            alert('Subscription Updated!');
            setShowSubscriptionModal(false);
            fetchShops();
        } else {
            alert('Failed to update subscription');
        }
    };

    const handleEditCredentials = async (shop) => {
        // Fetch current username
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`/api/admin?action=get-shop-credentials&shopId=${shop.id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setCredentialsData({
                    shopId: shop.id,
                    username: data.credentials.username,
                    password: '' // Don't fetch password, only allow reset
                });
                setShowCredentialsModal(true);
            } else {
                alert('Failed to fetch credentials');
            }
        } catch (e) {
            console.error(e);
        }
    };

    const handleUpdateCredentials = async (e) => {
        e.preventDefault();
        const token = localStorage.getItem('token');
        const res = await fetch('/api/admin?action=update-shop-credentials', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify(credentialsData)
        });

        if (res.ok) {
            alert('Credentials Updated!');
            setShowCredentialsModal(false);
            fetchShops();
        } else {
            alert('Failed to update credentials');
        }
    };

    const handleDeleteShop = async (shop) => {
        // Check if shop can be deleted (only EXPIRED or CANCELLED)
        const canDelete = shop.plan_status === 'EXPIRED' || shop.plan_status === 'CANCELLED' || !shop.plan_status;

        if (!canDelete) {
            alert('Cannot delete shop with ACTIVE subscription. Please cancel or expire the subscription first.');
            return;
        }

        const confirmMessage = `⚠️ WARNING: You are about to permanently delete:\n\nShop: ${shop.name}\nStatus: ${shop.plan_status || 'No Subscription'}\n\nThis will delete:\n- All shop data\n- All invoices\n- All customers\n- All stations\n- Owner account\n\nThis action CANNOT be undone!\n\nType the shop name to confirm: "${shop.name}"`;

        const userInput = prompt(confirmMessage);

        if (userInput !== shop.name) {
            if (userInput !== null) {
                alert('Shop name did not match. Deletion cancelled.');
            }
            return;
        }

        const token = localStorage.getItem('token');
        try {
            const res = await fetch('/api/admin?action=delete-shop', {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ shopId: shop.id })
            });

            const data = await res.json();

            if (res.ok) {
                alert(`✅ ${data.message}`);
                fetchShops();
            } else {
                alert(`❌ ${data.error || 'Failed to delete shop'}`);
            }
        } catch (error) {
            console.error('Error deleting shop:', error);
            alert('An error occurred while deleting the shop.');
        }
    };

    const handleRestoreShop = async (shop) => {
        const confirmMessage = `Are you sure you want to restore "${shop.name}"?\n\nThis will:\n- Reactivate the shop\n- Restore owner account access\n- Make the shop visible again`;

        if (!confirm(confirmMessage)) {
            return;
        }

        const token = localStorage.getItem('token');
        try {
            const res = await fetch('/api/admin?action=restore-shop', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ shopId: shop.id })
            });

            const data = await res.json();

            if (res.ok) {
                alert(`✅ ${data.message}`);
                fetchShops();
            } else {
                alert(`❌ ${data.error || 'Failed to restore shop'}`);
            }
        } catch (error) {
            console.error('Error restoring shop:', error);
            alert('An error occurred while restoring the shop.');
        }
    };

    const handleSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const sortedShops = [...shops].sort((a, b) => {
        let aValue = a[sortConfig.key];
        let bValue = b[sortConfig.key];

        // Custom sort logic for specific columns
        if (sortConfig.key === 'contact') {
            aValue = a.email || a.phone || '';
            bValue = b.email || b.phone || '';
        }

        if (sortConfig.key === 'plan_status') {
            // Sort by days remaining until expiration
            const aDays = a.plan_end_date ? Math.ceil((new Date(a.plan_end_date) - new Date()) / (1000 * 60 * 60 * 24)) : -999999;
            const bDays = b.plan_end_date ? Math.ceil((new Date(b.plan_end_date) - new Date()) / (1000 * 60 * 60 * 24)) : -999999;
            aValue = aDays;
            bValue = bDays;
        }

        if (sortConfig.key === 'created_at') {
            aValue = new Date(a.created_at || 0).getTime();
            bValue = new Date(b.created_at || 0).getTime();
        }

        // Handle nulls
        if (aValue === null || aValue === undefined) aValue = '';
        if (bValue === null || bValue === undefined) bValue = '';

        if (typeof aValue === 'string') {
            aValue = aValue.toLowerCase();
            bValue = bValue.toLowerCase();
        }

        if (aValue < bValue) {
            return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
            return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
    });

    // Calculate stats
    const activeShops = shops.filter(s => s.is_active).length;
    const premiumShops = shops.filter(s => s.plan_status === 'ACTIVE').length;
    const totalRevenue = shops.reduce((sum, s) => {
        if (s.plan_status === 'ACTIVE') {
            // Get monthly amount from subscription (you might want to fetch this separately)
            return sum + 999; // Default amount
        }
        return sum;
    }, 0);

    if (loading) return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
            <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
                <p className="text-gray-600">Loading Admin Panel...</p>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Sidebar */}
            <aside className={`fixed left-0 top-0 h-full w-64 bg-white border-r border-gray-200 z-50 transition-transform duration-300 ease-in-out shadow-lg ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'
                }`}>
                <div className="flex flex-col h-full">
                    {/* Sidebar Header */}
                    <div className="p-6 border-b border-gray-200">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-bold text-gray-900">Admin Menu</h2>
                            <button
                                onClick={() => setSidebarOpen(false)}
                                className="text-gray-400 hover:text-gray-600 transition-colors"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    {/* Sidebar Menu */}
                    <nav className="flex-1 overflow-y-auto p-4">
                        {/* Dashboard Link */}
                        <div className="mb-2">
                            <button
                                onClick={() => setSidebarOpen(false)}
                                className="w-full px-4 py-3 text-left rounded-lg font-medium transition-all text-gray-700 hover:bg-blue-50 hover:text-blue-600 flex items-center gap-3"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                                </svg>
                                <span>Dashboard</span>
                            </button>
                        </div>

                        {/* System Settings Section */}
                        <div className="mb-2">
                            <button
                                onClick={() => setSystemSettingsOpen(!systemSettingsOpen)}
                                className="w-full px-4 py-3 text-left rounded-lg font-medium transition-all text-gray-700 hover:bg-gray-50 flex items-center justify-between"
                            >
                                <div className="flex items-center gap-3">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                    <span>System Settings</span>
                                </div>
                                <svg
                                    className={`w-4 h-4 transition-transform ${systemSettingsOpen ? 'rotate-180' : ''
                                        }`}
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>

                            {/* System Settings Submenu */}
                            {systemSettingsOpen && (
                                <div className="ml-4 mt-1 space-y-1">
                                    <button
                                        onClick={() => {
                                            setShowPlansConfig(true);
                                            setSidebarOpen(false);
                                        }}
                                        className="w-full px-4 py-2 text-left rounded-lg text-sm transition-all text-gray-600 hover:bg-blue-50 hover:text-blue-600 flex items-center gap-2"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                                        </svg>
                                        <span>Configure Plans</span>
                                    </button>
                                    {/* Placeholder for future features */}
                                    <div className="px-4 py-2 text-xs text-gray-400 italic">
                                        More settings coming soon...
                                    </div>
                                </div>
                            )}
                        </div>
                    </nav>

                    {/* Sidebar Footer */}
                    <div className="p-4 border-t border-gray-200">
                        <button
                            onClick={onLogout}
                            className="w-full px-4 py-3 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg font-medium transition-all flex items-center justify-center gap-2 border border-red-200"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                            <span>Logout</span>
                        </button>
                        <div className="mt-3 text-center text-xs text-gray-500">
                            Logged in as: <span className="font-medium text-gray-700">Super Admin</span>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Sidebar Overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Header */}
            <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => setSidebarOpen(true)}
                                className="text-gray-600 hover:text-gray-900 transition-colors p-2 rounded-md hover:bg-gray-100"
                                aria-label="Open menu"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                                </svg>
                            </button>
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900">Super Admin Dashboard</h1>
                                <p className="text-sm text-gray-500 mt-1">Manage all shops and subscriptions</p>
                            </div>
                        </div>
                        <button
                            onClick={onLogout}
                            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors shadow-sm"
                        >
                            Logout
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-600">Total Shops</p>
                                <p className="text-3xl font-bold text-gray-900 mt-2">{shops.length}</p>
                            </div>
                            <div className="bg-blue-100 rounded-full p-3">
                                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                </svg>
                            </div>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">{activeShops} active</p>
                    </div>

                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-600">Premium Shops</p>
                                <p className="text-3xl font-bold text-green-600 mt-2">{premiumShops}</p>
                            </div>
                            <div className="bg-green-100 rounded-full p-3">
                                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">Active subscriptions</p>
                    </div>

                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-600">Monthly Revenue</p>
                                <p className="text-3xl font-bold text-purple-600 mt-2">₹{totalRevenue.toLocaleString()}</p>
                            </div>
                            <div className="bg-purple-100 rounded-full p-3">
                                <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">From {premiumShops} shops</p>
                    </div>
                </div>

                {/* Create Shop Section */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">🚀 Launch New Shop</h2>
                    <form onSubmit={handleCreateShop} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {/* Shop Name */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Shop Name *</label>
                                <input
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="Enter shop name"
                                    value={newShop.name}
                                    onChange={e => setNewShop({ ...newShop, name: e.target.value })}
                                    required
                                />
                            </div>

                            {/* Phone Number */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number *</label>
                                <input
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    type="tel"
                                    placeholder="10-digit mobile (e.g., 9876543210)"
                                    value={newShop.phone}
                                    onChange={e => {
                                        const value = e.target.value.replace(/\D/g, ''); // Remove non-digits
                                        if (value.length <= 10) {
                                            setNewShop({ ...newShop, phone: value });
                                        }
                                    }}
                                    pattern="[6-9][0-9]{9}"
                                    title="Enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9"
                                    maxLength="10"
                                    required
                                />
                                {newShop.phone && !/^[6-9]\d{9}$/.test(newShop.phone) && (
                                    <p className="text-xs text-red-600 mt-1">Must be 10 digits, starting with 6-9</p>
                                )}
                            </div>

                            {/* Email */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Email ID *</label>
                                <input
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    type="email"
                                    placeholder="shop@example.com"
                                    value={newShop.email}
                                    onChange={e => setNewShop({ ...newShop, email: e.target.value })}
                                    required
                                />
                            </div>

                            {/* Address */}
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Shop Address *</label>
                                <input
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="Complete shop address"
                                    value={newShop.address}
                                    onChange={e => setNewShop({ ...newShop, address: e.target.value })}
                                    required
                                />
                            </div>

                            {/* UPI ID */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">UPI ID (Optional)</label>
                                <input
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="username@bank"
                                    value={newShop.upiId}
                                    onChange={e => setNewShop({ ...newShop, upiId: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="border-t border-gray-200 pt-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                {/* Owner Username */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Owner Username *</label>
                                    <input
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        placeholder="username"
                                        value={newShop.ownerUsername}
                                        onChange={e => setNewShop({ ...newShop, ownerUsername: e.target.value })}
                                        required
                                    />
                                </div>

                                {/* Owner Password */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Owner Password *</label>
                                    <input
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        type="password"
                                        placeholder="Secure password"
                                        value={newShop.ownerPassword}
                                        onChange={e => setNewShop({ ...newShop, ownerPassword: e.target.value })}
                                        required
                                    />
                                </div>

                                {/* Subscription Plan */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Subscription Plan</label>
                                    <select
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        value={newShop.planCode}
                                        onChange={e => setNewShop({ ...newShop, planCode: e.target.value })}
                                        required
                                    >
                                        <option value="" disabled>Select a plan</option>
                                        {plans.filter(plan => plan.is_active).map(plan => (
                                            <option key={plan.plan_code} value={plan.plan_code}>
                                                {plan.plan_name}
                                                {plan.price_inr > 0 ? ` - ₹${plan.price_inr}` : ' - Free'}
                                                {' '}({plan.duration_days} Days)
                                            </option>
                                        ))}
                                    </select>
                                    {newShop.planCode && plans.find(p => p.plan_code === newShop.planCode) && (
                                        <p className="text-xs text-gray-500 mt-1">
                                            Includes: {plans.find(p => p.plan_code === newShop.planCode).duration_days} days validity
                                        </p>
                                    )}
                                </div>

                                {/* Submit Button */}
                                <div className="flex items-end">
                                    <button type="submit" className="w-full px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors shadow-sm">
                                        Create Shop
                                    </button>
                                </div>
                            </div>
                        </div>
                    </form>
                </div>

                {/* Shops Table */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                        <h2 className="text-lg font-semibold text-gray-900">
                            All Shops ({shops.length})
                        </h2>
                        <button
                            onClick={() => setShowDeleted(!showDeleted)}
                            className={`px-4 py-2 rounded-lg font-medium transition-colors text-sm ${showDeleted
                                ? 'bg-red-100 text-red-700 hover:bg-red-200'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                        >
                            {showDeleted ? '👁️ Showing Deleted' : '👁️‍🗨️ Show Deleted'}
                        </button>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                    {[
                                        { key: 'name', label: 'Shop' },
                                        { key: 'contact', label: 'Contact' },
                                        { key: 'owner_username', label: 'Username' },
                                        { key: 'is_active', label: 'Status' },
                                        { key: 'plan_status', label: 'Subscription' },
                                        { key: 'created_at', label: 'Created' }
                                    ].map((col) => (
                                        <th
                                            key={col.key}
                                            onClick={() => handleSort(col.key)}
                                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 hover:text-gray-700 transition-colors select-none"
                                        >
                                            <div className="flex items-center gap-1">
                                                {col.label}
                                                {sortConfig.key === col.key && (
                                                    <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                                                )}
                                            </div>
                                        </th>
                                    ))}
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {shops.length === 0 ? (
                                    <tr>
                                        <td colSpan="7" className="px-6 py-12 text-center text-gray-500">
                                            <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                            </svg>
                                            <p className="text-sm font-medium">No shops found</p>
                                            <p className="text-xs text-gray-400 mt-1">Create your first shop above!</p>
                                        </td>
                                    </tr>
                                ) : sortedShops.map(shop => (
                                    <tr key={shop.id} className={`transition-colors ${shop.deleted_at ? 'bg-gray-100 opacity-75' : 'hover:bg-gray-50'}`}>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <div className={`flex-shrink-0 h-10 w-10 rounded-lg flex items-center justify-center ${shop.deleted_at ? 'bg-gray-400' : 'bg-gradient-to-br from-blue-500 to-purple-600'}`}>
                                                    <span className="text-white font-bold text-sm">{shop.name.charAt(0).toUpperCase()}</span>
                                                </div>
                                                <div className="ml-4">
                                                    <div className="flex items-center gap-2">
                                                        <div className="text-sm font-medium text-gray-900">{shop.name}</div>
                                                        {shop.deleted_at && (
                                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                                                                🗑️ DELETED
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-xs text-gray-500">ID: #{shop.id}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm text-gray-900">
                                                {shop.email && <div className="flex items-center text-blue-600"><span className="mr-1">📧</span>{shop.email}</div>}
                                                {shop.phone && <div className="flex items-center text-green-600 mt-1"><span className="mr-1">📞</span>{shop.phone}</div>}
                                                {!shop.email && !shop.phone && <span className="text-gray-400 text-xs">No contact info</span>}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="text-sm font-mono bg-gray-100 px-2 py-1 rounded text-gray-700">
                                                {shop.owner_username || 'N/A'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${shop.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                                {shop.is_active ? '● Active' : '● Disabled'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex flex-col items-start gap-1">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${shop.plan_status === 'ACTIVE'
                                                    ? (shop.plan_name === 'TRIAL' ? 'bg-orange-100 text-orange-800' : 'bg-purple-100 text-purple-800')
                                                    : 'bg-gray-100 text-gray-800'
                                                    }`}>
                                                    {shop.plan_status === 'ACTIVE'
                                                        ? (shop.plan_name === 'TRIAL' ? '⏳ Trial' : '✓ Premium')
                                                        : shop.plan_status || 'Trial'}
                                                </span>
                                                {shop.plan_end_date && (() => {
                                                    const diffTime = new Date(shop.plan_end_date) - new Date();
                                                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                                                    return (
                                                        <span className={`text-xs ${diffDays <= 5 ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                                                            {diffDays < 0 ? 'Expired' : `Expires in ${diffDays} days`}
                                                        </span>
                                                    );
                                                })()}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {new Date(shop.created_at).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <div className="flex justify-end gap-2">
                                                {shop.deleted_at ? (
                                                    // Restore button for deleted shops
                                                    <button
                                                        onClick={() => handleRestoreShop(shop)}
                                                        className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded-md transition-colors text-sm font-medium"
                                                        title="Restore Shop"
                                                    >
                                                        ♻️ Restore
                                                    </button>
                                                ) : (
                                                    // Normal action buttons for active shops
                                                    <>
                                                        <button
                                                            onClick={() => handleManageShop(shop)}
                                                            className="text-blue-600 hover:text-blue-900 transition-colors"
                                                            title="Manage Dashboard"
                                                        >
                                                            📊
                                                        </button>
                                                        <button
                                                            onClick={() => handleEditShop(shop)}
                                                            className="text-yellow-600 hover:text-yellow-900 transition-colors"
                                                            title="Edit Details"
                                                        >
                                                            ✏️
                                                        </button>
                                                        <button
                                                            onClick={() => handleManageSubscription(shop)}
                                                            className="text-purple-600 hover:text-purple-900 transition-colors"
                                                            title="Manage Subscription"
                                                        >
                                                            💳
                                                        </button>
                                                        <button
                                                            onClick={() => handleViewHistory(shop)}
                                                            className="text-indigo-600 hover:text-indigo-900 transition-colors"
                                                            title="View Payment & Sub History"
                                                        >
                                                            📜
                                                        </button>
                                                        <button
                                                            onClick={() => handleEditCredentials(shop)}
                                                            className="text-gray-600 hover:text-gray-900 transition-colors"
                                                            title="Manage Credentials"
                                                        >
                                                            🔑
                                                        </button>
                                                        {/* Delete button - only for expired/cancelled shops */}
                                                        {(shop.plan_status === 'EXPIRED' || shop.plan_status === 'CANCELLED' || !shop.plan_status) && (
                                                            <button
                                                                onClick={() => handleDeleteShop(shop)}
                                                                className="text-red-600 hover:text-red-900 transition-colors"
                                                                title="Delete Shop (Soft Delete)"
                                                            >
                                                                🗑️
                                                            </button>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>

            {/* Edit Shop Modal */}
            {showEditModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-xl">
                        <h3 className="text-xl font-bold text-gray-900 mb-4">Edit Shop Details</h3>
                        <form onSubmit={handleUpdateShop} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Shop Name</label>
                                <input
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    value={editingShop.name}
                                    onChange={e => setEditingShop({ ...editingShop, name: e.target.value })}
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                                <input
                                    type="email"
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="shop@example.com"
                                    value={editingShop.email}
                                    onChange={e => setEditingShop({ ...editingShop, email: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                                <input
                                    type="tel"
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="+1234567890"
                                    value={editingShop.phone}
                                    onChange={e => setEditingShop({ ...editingShop, phone: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">UPI ID</label>
                                <input
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="username@upi"
                                    value={editingShop.upi_id || ''}
                                    onChange={e => setEditingShop({ ...editingShop, upi_id: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                                <textarea
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    rows="3"
                                    placeholder="Full address..."
                                    value={editingShop.address}
                                    onChange={e => setEditingShop({ ...editingShop, address: e.target.value })}
                                />
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button type="submit" className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors">
                                    Save Changes
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowEditModal(false)}
                                    className="flex-1 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-medium transition-colors"
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Subscription Management Modal */}
            {showSubscriptionModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-xl">
                        <h3 className="text-xl font-bold text-gray-900 mb-4">
                            Manage Subscription - {selectedShopForSub?.name}
                        </h3>
                        <form onSubmit={handleUpdateSubscription} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Plan Name</label>
                                <select
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    value={subscriptionData.plan_name}
                                    onChange={e => {
                                        const code = e.target.value;
                                        const selectedPlan = plans.find(p => p.plan_code === code);
                                        if (selectedPlan) {
                                            const now = new Date();
                                            const endDate = new Date(now.getTime() + (selectedPlan.duration_days) * 24 * 60 * 60 * 1000);
                                            const endDateStr = endDate.toISOString().split('T')[0];
                                            setSubscriptionData({
                                                ...subscriptionData,
                                                plan_name: code,
                                                monthly_amount: selectedPlan.price_inr,
                                                end_date: endDateStr
                                            });
                                        } else {
                                            setSubscriptionData({ ...subscriptionData, plan_name: code });
                                        }
                                    }}
                                >
                                    <option value="" disabled>Select Plan</option>
                                    {plans.filter(p => p.is_active).map(plan => (
                                        <option key={plan.plan_code} value={plan.plan_code}>
                                            {plan.plan_name} ({plan.duration_days} days) - ₹{plan.price_inr}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Monthly Amount (₹)</label>
                                <input
                                    type="number"
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    value={subscriptionData.monthly_amount}
                                    onChange={e => setSubscriptionData({ ...subscriptionData, monthly_amount: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">End Date (Leave empty for lifetime)</label>
                                <input
                                    type="date"
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    value={subscriptionData.end_date}
                                    onChange={e => setSubscriptionData({ ...subscriptionData, end_date: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                                <select
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    value={subscriptionData.status}
                                    onChange={e => setSubscriptionData({ ...subscriptionData, status: e.target.value })}
                                >
                                    <option value="ACTIVE">Active</option>
                                    <option value="EXPIRED">Expired</option>
                                    <option value="CANCELLED">Cancelled</option>
                                    <option value="GRACE_PERIOD">Grace Period</option>
                                </select>
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button type="submit" className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors">
                                    Update Subscription
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowSubscriptionModal(false)}
                                    className="flex-1 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-medium transition-colors"
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Credentials Modal */}
            {showCredentialsModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-xl">
                        <h3 className="text-xl font-bold text-gray-900 mb-4">Manage Credentials</h3>
                        <form onSubmit={handleUpdateCredentials} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                                <input
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    value={credentialsData.username}
                                    onChange={e => setCredentialsData({ ...credentialsData, username: e.target.value })}
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">New Password (Optional)</label>
                                <input
                                    type="password"
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="Leave empty to keep current"
                                    value={credentialsData.password}
                                    onChange={e => setCredentialsData({ ...credentialsData, password: e.target.value })}
                                />
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button type="submit" className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors">
                                    Update
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowCredentialsModal(false)}
                                    className="flex-1 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-medium transition-colors"
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* History Modal */}
            {showHistoryModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg p-6 max-w-4xl w-full shadow-xl max-h-[90vh] flex flex-col">
                        <div className="flex justify-between items-center mb-6 border-b pb-4">
                            <h3 className="text-xl font-bold text-gray-900">
                                History - {selectedShopForHistory?.name}
                            </h3>
                            <button
                                onClick={() => setShowHistoryModal(false)}
                                className="text-gray-400 hover:text-gray-500 text-2xl"
                            >
                                ×
                            </button>
                        </div>

                        {/* Tabs */}
                        <div className="flex gap-4 mb-6 border-b border-gray-200">
                            <button
                                className={`pb-2 px-4 font-medium transition-colors ${historyTab === 'subscriptions'
                                    ? 'border-b-2 border-blue-600 text-blue-600'
                                    : 'text-gray-500 hover:text-gray-700'
                                    }`}
                                onClick={() => setHistoryTab('subscriptions')}
                            >
                                Subscription Logs
                            </button>
                            <button
                                className={`pb-2 px-4 font-medium transition-colors ${historyTab === 'payments'
                                    ? 'border-b-2 border-blue-600 text-blue-600'
                                    : 'text-gray-500 hover:text-gray-700'
                                    }`}
                                onClick={() => setHistoryTab('payments')}
                            >
                                Payment History
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto">
                            {historyLoading ? (
                                <div className="flex justify-center py-12">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                                </div>
                            ) : historyData.length === 0 ? (
                                <div className="text-center py-12 text-gray-500">
                                    No records found.
                                </div>
                            ) : (
                                <table className="w-full text-left">
                                    <thead className="bg-gray-50 sticky top-0">
                                        <tr>
                                            {historyTab === 'subscriptions' ? (
                                                <>
                                                    <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                                                    <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">Plan</th>
                                                    <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">Amount</th>
                                                    <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">Start Date</th>
                                                    <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">End Date</th>
                                                </>
                                            ) : (
                                                <>
                                                    <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">Date</th>
                                                    <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">Amount</th>
                                                    <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">Method</th>
                                                    <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">Transaction ID</th>
                                                    <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                                                </>
                                            )}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200">
                                        {historyData.map((item) => (
                                            <tr key={item.id} className="hover:bg-gray-50">
                                                {historyTab === 'subscriptions' ? (
                                                    <>
                                                        <td className="px-4 py-3">
                                                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${item.status === 'ACTIVE' ? 'bg-green-100 text-green-800' :
                                                                item.status === 'CANCELLED' ? 'bg-gray-100 text-gray-800' : 'bg-red-100 text-red-800'
                                                                }`}>
                                                                {item.status}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 text-sm">{item.plan_name}</td>
                                                        <td className="px-4 py-3 text-sm">₹{item.monthly_amount}</td>
                                                        <td className="px-4 py-3 text-sm text-gray-500">{new Date(item.start_date || item.created_at).toLocaleDateString()}</td>
                                                        <td className="px-4 py-3 text-sm text-gray-500">{item.end_date ? new Date(item.end_date).toLocaleDateString() : 'Lifetime'}</td>
                                                    </>
                                                ) : (
                                                    <>
                                                        <td className="px-4 py-3 text-sm text-gray-500">{new Date(item.payment_date).toLocaleDateString()}</td>
                                                        <td className="px-4 py-3 text-sm font-medium">₹{item.amount}</td>
                                                        <td className="px-4 py-3 text-sm text-gray-500">{item.payment_method}</td>
                                                        <td className="px-4 py-3 text-sm font-mono text-xs text-gray-500">{item.transaction_id || '-'}</td>
                                                        <td className="px-4 py-3">
                                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                                                {item.status}
                                                            </span>
                                                        </td>
                                                    </>
                                                )}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Subscription Plans Configuration Modal */}
            {showPlansConfig && (
                <SubscriptionPlansConfig onClose={() => setShowPlansConfig(false)} />
            )}
        </div>
    );
};

export default AdminDashboard;
