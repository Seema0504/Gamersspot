// API utility functions for database operations

const API_BASE_URL = '/api';

/**
 * Helper to perform authorized fetch
 */
async function authorizedFetch(endpoint, options = {}) {
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const config = {
    ...options,
    headers,
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, config);

  // Handle 401 Unauthorized globally (e.g. redirect to login)
  if (response.status === 401) {
    // If we are not already on the login page, we might want to trigger a logout
    if (!window.location.pathname.includes('/login') && endpoint !== '/auth?action=check') {
      console.warn('Unauthorized access - potential token expiration');
      // Optional: window.location.href = '/login'; 
      // Better to let the caller handle it or use a global context, but simple redirect works for now
    }
  }

  // Handle 402 Payment Required (Subscription Expired)
  if (response.status === 402) {
    const data = await response.json();
    const error = new Error(data.message || 'Subscription Expired');
    error.status = 402;
    error.code = data.code;
    throw error;
  }

  return response;
}

// Authentication API
export const authAPI = {
  async login(username, password) {
    const response = await fetch(`${API_BASE_URL}/auth?action=login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (!response.ok) {
      const text = await response.text();
      try { return JSON.parse(text); } catch { throw new Error(text || 'Login Failed'); }
    }
    return response.json();
  },

  async logout() {
    // Stateless logout mainly, but we can notify server
    await fetch(`${API_BASE_URL}/auth?action=logout`, { method: 'POST' });
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  },

  async checkAuth() {
    const response = await authorizedFetch('/auth?action=check');
    if (!response.ok) return { authenticated: false };
    return response.json();
  }
};

// Stations API
export const stationsAPI = {
  async getAll() {
    const response = await authorizedFetch(`/stations?_t=${Date.now()}`);
    if (!response.ok) throw new Error('Failed to fetch stations');
    return response.json();
  },

  async saveAll(stations) {
    const stationsArray = Array.isArray(stations) ? stations : [];
    const response = await authorizedFetch('/stations', {
      method: 'POST',
      body: JSON.stringify({ stations: stationsArray }),
    });
    if (!response.ok) throw new Error('Failed to save stations');
    return response.json();
  },

  async update(station) {
    const response = await authorizedFetch('/stations', {
      method: 'PUT',
      body: JSON.stringify(station),
    });
    if (!response.ok) throw new Error('Failed to update station');
    return response.json();
  },

  async delete(id) {
    const response = await authorizedFetch(`/stations?id=${id}`, { method: 'DELETE' });
    if (!response.ok) throw new Error('Failed to delete station');
    return response.json();
  },

  async transfer(fromStationId, toStationId) {
    const response = await authorizedFetch('/stations/transfer', {
      method: 'POST',
      body: JSON.stringify({ fromStationId, toStationId }),
    });
    if (!response.ok) {
      const errorJson = await response.json().catch(() => ({}));
      throw new Error(errorJson.error || 'Failed to transfer session');
    }
    return response.json();
  },
};

// Invoices API
export const invoicesAPI = {
  async getAll() {
    const response = await authorizedFetch('/invoices');
    if (!response.ok) throw new Error('Failed to fetch invoices');
    return response.json();
  },

  async getByNumber(invoiceNumber) {
    const response = await authorizedFetch(`/invoices?invoiceNumber=${invoiceNumber}`);
    if (!response.ok) throw new Error('Failed to fetch invoice');
    return response.json();
  },

  async create(invoice) {
    const response = await authorizedFetch('/invoices', {
      method: 'POST',
      body: JSON.stringify(invoice),
    });
    if (!response.ok) throw new Error('Failed to create invoice');
    return response.json();
  },
};

// Paid Events API
export const paidEventsAPI = {
  async create(invoiceNumber, stationIds, resetData) {
    const response = await authorizedFetch('/paid-events', {
      method: 'POST',
      body: JSON.stringify({ invoiceNumber, stationIds, resetData }),
    });
    if (!response.ok) throw new Error('Failed to create paid event');
    return response.json();
  },

  async getRecent(since = null) {
    const url = since ? `/paid-events?since=${since}` : '/paid-events';
    const response = await authorizedFetch(url);
    if (!response.ok) throw new Error('Failed to fetch paid events');
    return response.json();
  },
};

// Snacks API (Updated to use /api/settings?type=snacks)
export const snacksAPI = {
  async getAll(activeOnly = true) {
    const url = activeOnly ? '/settings?type=snacks&active=true' : '/settings?type=snacks';
    const response = await authorizedFetch(url);
    if (!response.ok) return []; // Graceful degradation if table empty/error
    return response.json();
  },

  async create(snack) {
    const response = await authorizedFetch('/settings?type=snacks', {
      method: 'POST',
      body: JSON.stringify(snack),
    });
    if (!response.ok) throw new Error('Failed to create snack');
    return response.json();
  },

  async update(snack) {
    const response = await authorizedFetch('/settings?type=snacks', {
      method: 'PUT',
      body: JSON.stringify(snack),
    });
    if (!response.ok) throw new Error('Failed to update snack');
    return response.json();
  },

  async delete(id, hardDelete = false) {
    const response = await authorizedFetch(`/settings?type=snacks&id=${id}&hardDelete=${hardDelete}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete snack');
    return response.json();
  },
};

// Customers API
export const customersAPI = {
  async lookupByPhone(phoneNumber) {
    const response = await authorizedFetch(`/customers?phoneNumber=${encodeURIComponent(phoneNumber)}`);
    if (!response.ok) throw new Error('Failed to lookup customer');
    return response.json();
  },

  async getAll() {
    const response = await authorizedFetch('/customers?getAll=true');
    if (!response.ok) throw new Error('Failed to fetch customers');
    return response.json();
  },

  async saveCustomer(phoneNumber, customerName) {
    const response = await authorizedFetch('/customers', {
      method: 'POST',
      body: JSON.stringify({ phoneNumber, customerName }),
    });
    if (!response.ok) throw new Error('Failed to save customer');
    return response.json();
  },
};

// Time API - Get accurate server time
export const timeAPI = {
  async getServerTime() {
    const response = await authorizedFetch('/time');
    if (!response.ok) throw new Error('Failed to get server time');
    return response.json();
  },
};

// Reports API
export const reportsAPI = {
  async getUsageReport(date) {
    const dateParam = date ? `?type=usage&date=${date}` : '?type=usage';
    const response = await authorizedFetch(`/reports${dateParam}`);
    if (!response.ok) throw new Error('Failed to fetch usage report');
    return response.json();
  },

  async getDailyRevenue(date) {
    const dateParam = date ? `?type=daily-revenue&date=${date}` : '?type=daily-revenue';
    const response = await authorizedFetch(`/reports${dateParam}`);
    if (!response.ok) throw new Error('Failed to fetch daily revenue');
    return response.json();
  },

  async getMonthlyRevenue(month, year) {
    const params = new URLSearchParams({ type: 'monthly-revenue' });
    if (month) params.append('month', month);
    if (year) params.append('year', year);
    const response = await authorizedFetch(`/reports?${params}`);
    if (!response.ok) throw new Error('Failed to fetch monthly revenue');
    return response.json();
  },

  async getCustomerReport() {
    const response = await authorizedFetch('/reports?type=customer-report');
    if (!response.ok) throw new Error('Failed to fetch customer report');
    return response.json();
  },

  async getSnacksReport(date, month, year, startDate, endDate) {
    const params = new URLSearchParams({ type: 'snacks-report' });
    if (date) params.append('date', date);
    if (month) params.append('month', month);
    if (year) params.append('year', year);
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    const response = await authorizedFetch(`/reports?${params}`);
    if (!response.ok) throw new Error('Failed to fetch snacks report');
    return response.json();
  }
};

// Pricing API
export const pricingAPI = {
  async get() {
    const response = await authorizedFetch('/settings?type=pricing');
    if (!response.ok) {
      if (response.status === 404) return null;
      return null;
    }
    return response.json();
  },

  async update(pricing) {
    const response = await authorizedFetch('/settings?type=pricing', {
      method: 'POST',
      body: JSON.stringify(pricing),
    });
    if (!response.ok) throw new Error('Failed to update pricing');
    return response.json();
  }
};

// Bonus Time API
export const bonusAPI = {
  async get() {
    const response = await authorizedFetch('/settings?type=bonus');
    if (!response.ok) return null;
    return response.json();
  },

  async update(bonusConfig) {
    const response = await authorizedFetch('/settings?type=bonus', {
      method: 'PUT',
      body: JSON.stringify(bonusConfig),
    });
    if (!response.ok) throw new Error('Failed to update bonus configuration');
    return response.json();
  }
};

// Subscription API
export const subscriptionAPI = {
  async getStatus() {
    const response = await authorizedFetch('/subscription?action=status');
    if (!response.ok) return null;
    return response.json();
  },

  async getInfo(shopId = null) {
    const url = shopId
      ? `/subscription?action=info&shopId=${shopId}`
      : '/subscription?action=info';
    const response = await authorizedFetch(url);
    if (!response.ok) return null;
    return response.json();
  },

  async renew(planId) {
    const response = await authorizedFetch('/subscription?action=renew', {
      method: 'POST',
      body: JSON.stringify({ planId }),
    });

    if (!response.ok) {
      // try to parse error message
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to renew subscription');
    }
    return response.json();
  }
};
