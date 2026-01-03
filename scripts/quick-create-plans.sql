-- Quick fix: Create subscription plans
INSERT INTO subscription_plans (plan_code, plan_name, duration_days, price_inr, features, is_active, display_order)
VALUES
    ('FREE_TRIAL', 'Free Trial', 14, 0, '{"max_stations": 10, "max_invoices_per_month": 100}'::jsonb, true, 1),
    ('MONTHLY', 'Monthly Premium', 30, 999, '{"max_stations": -1, "max_invoices_per_month": -1}'::jsonb, true, 2),
    ('QUARTERLY', 'Quarterly Premium', 90, 2499, '{"max_stations": -1, "max_invoices_per_month": -1}'::jsonb, true, 3),
    ('SEMI_ANNUAL', '6 Months Premium', 180, 4499, '{"max_stations": -1, "max_invoices_per_month": -1}'::jsonb, true, 4),
    ('YEARLY', 'Yearly Premium', 365, 7999, '{"max_stations": -1, "max_invoices_per_month": -1}'::jsonb, true, 5)
ON CONFLICT (plan_code) DO NOTHING;
