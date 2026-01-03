-- ============================================================================
-- GAMERS SPOT - AUTOMATED SUBSCRIPTION SYSTEM
-- ============================================================================
-- Purpose: Implement fully autonomous subscription management
-- Author: System Architecture
-- Date: 2026-01-03
-- Version: 1.0
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. SUBSCRIPTION PLANS TABLE
-- ----------------------------------------------------------------------------
-- Defines available subscription tiers with pricing and duration
-- This is the source of truth for plan metadata
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS subscription_plans (
    id SERIAL PRIMARY KEY,
    plan_code VARCHAR(50) UNIQUE NOT NULL, -- 'FREE_TRIAL', 'MONTHLY', 'QUARTERLY', 'SEMI_ANNUAL', 'YEARLY'
    plan_name VARCHAR(100) NOT NULL, -- Display name
    duration_days INTEGER NOT NULL, -- How many days this plan lasts
    price_inr NUMERIC(10, 2) NOT NULL DEFAULT 0, -- Price in Indian Rupees
    features JSONB DEFAULT '{}', -- Feature flags/limits
    is_active BOOLEAN DEFAULT true, -- Can be purchased
    display_order INTEGER DEFAULT 0, -- For UI sorting
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default plans
INSERT INTO subscription_plans (plan_code, plan_name, duration_days, price_inr, display_order, features) VALUES
('FREE_TRIAL', 'Free Trial', 14, 0, 1, '{"max_stations": 10, "max_invoices_per_month": 100}'),
('MONTHLY', 'Monthly Premium', 30, 999, 2, '{"max_stations": -1, "max_invoices_per_month": -1}'),
('QUARTERLY', 'Quarterly Premium', 90, 2499, 3, '{"max_stations": -1, "max_invoices_per_month": -1, "discount_percent": 17}'),
('SEMI_ANNUAL', '6 Months Premium', 180, 4499, 4, '{"max_stations": -1, "max_invoices_per_month": -1, "discount_percent": 25}'),
('YEARLY', 'Yearly Premium', 365, 7999, 5, '{"max_stations": -1, "max_invoices_per_month": -1, "discount_percent": 33}')
ON CONFLICT (plan_code) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 2. SHOP SUBSCRIPTIONS TABLE (REPLACES OLD subscriptions TABLE)
-- ----------------------------------------------------------------------------
-- One row per shop - represents current subscription state
-- This is the single source of truth for a shop's subscription status
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS shop_subscriptions (
    id SERIAL PRIMARY KEY,
    shop_id INTEGER NOT NULL UNIQUE REFERENCES shops(id) ON DELETE CASCADE,
    
    -- Current Plan
    current_plan_code VARCHAR(50) NOT NULL REFERENCES subscription_plans(plan_code),
    
    -- Lifecycle Dates (ALL IN UTC)
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL, -- When current plan ends
    grace_ends_at TIMESTAMP WITH TIME ZONE, -- When grace period ends (if applicable)
    
    -- Computed Status (derived from dates, updated lazily)
    -- Possible values: 'trial', 'active', 'grace', 'expired'
    computed_status VARCHAR(20) NOT NULL DEFAULT 'trial',
    last_status_check_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Renewal tracking
    auto_renew BOOLEAN DEFAULT false, -- For future payment gateway integration
    next_billing_date TIMESTAMP WITH TIME ZONE,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_status CHECK (computed_status IN ('trial', 'active', 'grace', 'expired'))
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_shop_subscriptions_shop_id ON shop_subscriptions(shop_id);
CREATE INDEX IF NOT EXISTS idx_shop_subscriptions_status ON shop_subscriptions(computed_status);
CREATE INDEX IF NOT EXISTS idx_shop_subscriptions_expires_at ON shop_subscriptions(expires_at);

-- ----------------------------------------------------------------------------
-- 3. SUBSCRIPTION EVENTS TABLE (AUDIT LOG)
-- ----------------------------------------------------------------------------
-- Immutable log of all subscription state changes
-- Used for debugging, analytics, and compliance
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS subscription_events (
    id SERIAL PRIMARY KEY,
    shop_id INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL, -- 'created', 'renewed', 'upgraded', 'downgraded', 'expired', 'grace_started', 'cancelled'
    
    -- State before and after
    old_plan_code VARCHAR(50),
    new_plan_code VARCHAR(50),
    old_status VARCHAR(20),
    new_status VARCHAR(20),
    old_expires_at TIMESTAMP WITH TIME ZONE,
    new_expires_at TIMESTAMP WITH TIME ZONE,
    
    -- Context
    triggered_by VARCHAR(50), -- 'system', 'admin', 'user', 'payment_gateway'
    triggered_by_user_id INTEGER REFERENCES admin_users(id),
    payment_id INTEGER REFERENCES payments(id), -- Link to payment if applicable
    
    -- Additional metadata
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for audit queries
CREATE INDEX IF NOT EXISTS idx_subscription_events_shop_id ON subscription_events(shop_id);
CREATE INDEX IF NOT EXISTS idx_subscription_events_created_at ON subscription_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_subscription_events_type ON subscription_events(event_type);

-- ----------------------------------------------------------------------------
-- 4. SYSTEM CONFIGURATION TABLE
-- ----------------------------------------------------------------------------
-- Stores global subscription system settings
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS subscription_config (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default configuration
INSERT INTO subscription_config (key, value, description) VALUES
('grace_period_days', '3', 'Number of days of grace period after subscription expires'),
('status_check_interval_minutes', '60', 'How often to recompute subscription status (lazy evaluation)'),
('default_trial_plan', 'FREE_TRIAL', 'Default plan for new shops'),
('allow_trial_after_paid', 'false', 'Whether shops can go back to trial after having a paid plan')
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
