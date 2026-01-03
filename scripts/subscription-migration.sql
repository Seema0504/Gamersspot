-- ============================================================================
-- DATA MIGRATION AND TRIGGERS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 5. MIGRATION: MIGRATE EXISTING subscriptions TABLE DATA
-- ----------------------------------------------------------------------------

DO $$
DECLARE
    shop_record RECORD;
    latest_sub RECORD;
    plan_code_mapped VARCHAR(50);
    computed_status_val VARCHAR(20);
    grace_end TIMESTAMP WITH TIME ZONE;
BEGIN
    FOR shop_record IN SELECT id FROM shops LOOP
        IF NOT EXISTS (SELECT 1 FROM shop_subscriptions WHERE shop_id = shop_record.id) THEN
            
            SELECT * INTO latest_sub 
            FROM subscriptions 
            WHERE shop_id = shop_record.id 
            ORDER BY created_at DESC 
            LIMIT 1;
            
            IF latest_sub IS NOT NULL THEN
                plan_code_mapped := CASE 
                    WHEN latest_sub.plan_name ILIKE '%trial%' THEN 'FREE_TRIAL'
                    WHEN latest_sub.plan_name ILIKE '%monthly%' THEN 'MONTHLY'
                    WHEN latest_sub.plan_name ILIKE '%quarterly%' THEN 'QUARTERLY'
                    WHEN latest_sub.plan_name ILIKE '%6%month%' OR latest_sub.plan_name ILIKE '%semi%' THEN 'SEMI_ANNUAL'
                    WHEN latest_sub.plan_name ILIKE '%year%' THEN 'YEARLY'
                    ELSE 'FREE_TRIAL'
                END;
                
                IF latest_sub.end_date IS NULL OR latest_sub.end_date > NOW() THEN
                    computed_status_val := CASE 
                        WHEN plan_code_mapped = 'FREE_TRIAL' THEN 'trial'
                        ELSE 'active'
                    END;
                    grace_end := NULL;
                ELSE
                    grace_end := latest_sub.end_date + INTERVAL '3 days';
                    IF NOW() < grace_end THEN
                        computed_status_val := 'grace';
                    ELSE
                        computed_status_val := 'expired';
                    END IF;
                END IF;
                
                INSERT INTO shop_subscriptions (
                    shop_id,
                    current_plan_code,
                    started_at,
                    expires_at,
                    grace_ends_at,
                    computed_status,
                    last_status_check_at,
                    created_at,
                    updated_at
                ) VALUES (
                    shop_record.id,
                    plan_code_mapped,
                    COALESCE(latest_sub.start_date, latest_sub.created_at, NOW()),
                    COALESCE(latest_sub.end_date, NOW() + INTERVAL '14 days'),
                    grace_end,
                    computed_status_val,
                    NOW(),
                    latest_sub.created_at,
                    NOW()
                );
                
                INSERT INTO subscription_events (
                    shop_id,
                    event_type,
                    new_plan_code,
                    new_status,
                    new_expires_at,
                    triggered_by,
                    metadata
                ) VALUES (
                    shop_record.id,
                    'migrated',
                    plan_code_mapped,
                    computed_status_val,
                    COALESCE(latest_sub.end_date, NOW() + INTERVAL '14 days'),
                    'system',
                    jsonb_build_object('source', 'migration_script', 'old_subscription_id', latest_sub.id)
                );
            ELSE
                INSERT INTO shop_subscriptions (
                    shop_id,
                    current_plan_code,
                    started_at,
                    expires_at,
                    computed_status
                ) VALUES (
                    shop_record.id,
                    'FREE_TRIAL',
                    NOW(),
                    NOW() + INTERVAL '14 days',
                    'trial'
                );
                
                INSERT INTO subscription_events (
                    shop_id,
                    event_type,
                    new_plan_code,
                    new_status,
                    new_expires_at,
                    triggered_by,
                    metadata
                ) VALUES (
                    shop_record.id,
                    'created',
                    'FREE_TRIAL',
                    'trial',
                    NOW() + INTERVAL '14 days',
                    'system',
                    jsonb_build_object('source', 'migration_auto_trial')
                );
            END IF;
        END IF;
    END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- 6. TRIGGERS FOR AUTOMATIC TIMESTAMP UPDATES
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_shop_subscriptions_updated_at ON shop_subscriptions;
CREATE TRIGGER update_shop_subscriptions_updated_at
    BEFORE UPDATE ON shop_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_subscription_plans_updated_at ON subscription_plans;
CREATE TRIGGER update_subscription_plans_updated_at
    BEFORE UPDATE ON subscription_plans
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ----------------------------------------------------------------------------
-- 7. HELPER FUNCTION: AUTO-CREATE SUBSCRIPTION FOR NEW SHOPS
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION auto_create_shop_subscription()
RETURNS TRIGGER AS $$
DECLARE
    default_plan VARCHAR(50);
    trial_duration INTEGER;
BEGIN
    SELECT value INTO default_plan FROM subscription_config WHERE key = 'default_trial_plan';
    IF default_plan IS NULL THEN
        default_plan := 'FREE_TRIAL';
    END IF;
    
    SELECT duration_days INTO trial_duration FROM subscription_plans WHERE plan_code = default_plan;
    IF trial_duration IS NULL THEN
        trial_duration := 14;
    END IF;
    
    INSERT INTO shop_subscriptions (
        shop_id,
        current_plan_code,
        started_at,
        expires_at,
        computed_status
    ) VALUES (
        NEW.id,
        default_plan,
        NOW(),
        NOW() + (trial_duration || ' days')::INTERVAL,
        'trial'
    );
    
    INSERT INTO subscription_events (
        shop_id,
        event_type,
        new_plan_code,
        new_status,
        new_expires_at,
        triggered_by,
        metadata
    ) VALUES (
        NEW.id,
        'created',
        default_plan,
        'trial',
        NOW() + (trial_duration || ' days')::INTERVAL,
        'system',
        jsonb_build_object('trigger', 'auto_create_on_shop_insert')
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_auto_create_subscription ON shops;
CREATE TRIGGER trigger_auto_create_subscription
    AFTER INSERT ON shops
    FOR EACH ROW
    EXECUTE FUNCTION auto_create_shop_subscription();
