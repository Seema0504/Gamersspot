import React, { useState, useEffect } from 'react';

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
        trialDays: 14
    });
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

    useEffect(() => {
        fetchShops();
    }, []);

    const fetchShops = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/admin?action=shops', {
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
                setNewShop({ name: '', ownerUsername: '', ownerPassword: '', phone: '', email: '', address: '', upiId: '', trialDays: 14 });
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
            {/* Header */}
            <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex justify-between items-center">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Super Admin Dashboard</h1>
                            <p className="text-sm text-gray-500 mt-1">Manage all shops and subscriptions</p>
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
                                    placeholder="10-digit mobile number"
                                    value={newShop.phone}
                                    onChange={e => setNewShop({ ...newShop, phone: e.target.value })}
                                    pattern="[0-9]{10}"
                                    required
                                />
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

                                {/* Trial Days */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Subscription Plan</label>
                                    <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden bg-white">
                                        <button
                                            type="button"
                                            className="px-3 py-2 bg-gray-50 hover:bg-gray-100 border-r border-gray-300 text-gray-600 font-bold transition-colors"
                                            onClick={() => setNewShop({ ...newShop, trialDays: Math.max(0, newShop.trialDays - 1) })}
                                        >
                                            -
                                        </button>
                                        <div className="flex-1 text-center text-sm font-medium text-gray-700 min-w-[100px] px-2">
                                            {newShop.trialDays === 0 ? 'Premium (30 Days)' : `${newShop.trialDays} Days Trial`}
                                        </div>
                                        <button
                                            type="button"
                                            className="px-3 py-2 bg-gray-50 hover:bg-gray-100 border-l border-gray-300 text-gray-600 font-bold transition-colors"
                                            onClick={() => setNewShop({ ...newShop, trialDays: newShop.trialDays + 1 })}
                                        >
                                            +
                                        </button>
                                    </div>
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
                    <div className="px-6 py-4 border-b border-gray-200">
                        <h2 className="text-lg font-semibold text-gray-900">All Shops ({shops.length})</h2>
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
                                    <tr key={shop.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <div className="flex-shrink-0 h-10 w-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                                                    <span className="text-white font-bold text-sm">{shop.name.charAt(0).toUpperCase()}</span>
                                                </div>
                                                <div className="ml-4">
                                                    <div className="text-sm font-medium text-gray-900">{shop.name}</div>
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
                                                    onClick={() => handleEditCredentials(shop)}
                                                    className="text-gray-600 hover:text-gray-900 transition-colors"
                                                    title="Manage Credentials"
                                                >
                                                    🔑
                                                </button>
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
                                    onChange={e => setSubscriptionData({ ...subscriptionData, plan_name: e.target.value })}
                                >
                                    <option value="TRIAL">Trial (Free)</option>
                                    <option value="PREMIUM_MONTHLY">Premium Monthly</option>
                                    <option value="PREMIUM_YEARLY">Premium Yearly</option>
                                    <option value="LIFETIME">Lifetime Access</option>
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
        </div>
    );
};

export default AdminDashboard;
