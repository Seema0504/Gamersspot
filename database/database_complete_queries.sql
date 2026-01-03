--
-- PostgreSQL database dump
--

\restrict iYcg5GMfD2KLZ3QDy0YMuRD7iqWoBwFilsPmGGAjTydezifrgkFRLgsPeXFWpRv

-- Dumped from database version 15.15 (Debian 15.15-1.pgdg13+1)
-- Dumped by pg_dump version 15.15 (Debian 15.15-1.pgdg13+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: citext; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS citext WITH SCHEMA public;


--
-- Name: EXTENSION citext; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION citext IS 'data type for case-insensitive character strings';


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: auto_create_shop_subscription(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.auto_create_shop_subscription() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
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
    
    INSERT INTO subscriptions (
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
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


--
-- Name: admin_users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.admin_users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: admin_users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_users (
    id integer DEFAULT nextval('public.admin_users_id_seq'::regclass) NOT NULL,
    username character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    role character varying(50) NOT NULL,
    shop_id integer,
    is_active boolean DEFAULT true,
    last_login timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp with time zone,
    CONSTRAINT admin_users_role_check CHECK (((role)::text = ANY (ARRAY[('SUPER_ADMIN'::character varying)::text, ('SHOP_OWNER'::character varying)::text, ('STAFF'::character varying)::text])))
);


--
-- Name: bonus_config_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bonus_config_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bonus_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bonus_config (
    id integer DEFAULT nextval('public.bonus_config_id_seq'::regclass) NOT NULL,
    shop_id integer NOT NULL,
    config_data jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: customers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.customers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: customers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customers (
    id integer DEFAULT nextval('public.customers_id_seq'::regclass) NOT NULL,
    shop_id integer NOT NULL,
    phone_number character varying(20) NOT NULL,
    customer_name character varying(255) NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: invoices_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.invoices_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: invoices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoices (
    id integer DEFAULT nextval('public.invoices_id_seq'::regclass) NOT NULL,
    shop_id integer NOT NULL,
    invoice_number character varying(255) NOT NULL,
    stations jsonb NOT NULL,
    subtotal numeric NOT NULL,
    discount numeric DEFAULT 0,
    total numeric NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: paid_events_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.paid_events_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: paid_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.paid_events (
    id integer DEFAULT nextval('public.paid_events_id_seq'::regclass) NOT NULL,
    shop_id integer NOT NULL,
    invoice_number character varying(255),
    station_ids integer[] NOT NULL,
    reset_data jsonb NOT NULL,
    processed boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payments (
    id integer NOT NULL,
    shop_id integer NOT NULL,
    subscription_id integer,
    amount numeric NOT NULL,
    payment_date timestamp with time zone DEFAULT now(),
    payment_method character varying(50),
    transaction_id character varying(255),
    status character varying(50) DEFAULT 'COMPLETED'::character varying,
    notes text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: payments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.payments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: payments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.payments_id_seq OWNED BY public.payments.id;


--
-- Name: pricing_rules_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.pricing_rules_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pricing_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pricing_rules (
    id integer DEFAULT nextval('public.pricing_rules_id_seq'::regclass) NOT NULL,
    shop_id integer NOT NULL,
    game_type character varying(50) NOT NULL,
    weekday_rate integer NOT NULL,
    weekend_rate integer NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);








--
-- Name: shops_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.shops_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: shops; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shops (
    id integer DEFAULT nextval('public.shops_id_seq'::regclass) NOT NULL,
    name character varying(255) NOT NULL,
    address text,
    phone character varying(20),
    email character varying(255),
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    upi_id character varying(255),
    deleted_at timestamp with time zone
);


--
-- Name: snacks_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.snacks_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: snacks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.snacks (
    id integer DEFAULT nextval('public.snacks_id_seq'::regclass) NOT NULL,
    shop_id integer NOT NULL,
    name character varying(255) NOT NULL,
    price numeric NOT NULL,
    active boolean DEFAULT true,
    display_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: stations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stations (
    id integer NOT NULL,
    shop_id integer NOT NULL,
    name character varying(255) NOT NULL,
    game_type character varying(50) NOT NULL,
    elapsed_time integer DEFAULT 0,
    is_running boolean DEFAULT false,
    is_done boolean DEFAULT false,
    is_paused boolean DEFAULT false,
    paused_time integer DEFAULT 0,
    pause_start_time character varying(50),
    extra_controllers integer DEFAULT 0,
    snacks jsonb DEFAULT '{}'::jsonb,
    snacks_enabled boolean DEFAULT false,
    customer_name character varying(255) DEFAULT ''::character varying,
    customer_phone character varying(20) DEFAULT ''::character varying,
    start_time character varying(50),
    end_time character varying(50),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: subscription_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscription_config (
    key character varying(100) NOT NULL,
    value text NOT NULL,
    description text,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: subscription_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscription_events (
    id integer NOT NULL,
    shop_id integer NOT NULL,
    event_type character varying(50) NOT NULL,
    old_plan_code character varying(50),
    new_plan_code character varying(50),
    old_status character varying(20),
    new_status character varying(20),
    old_expires_at timestamp with time zone,
    new_expires_at timestamp with time zone,
    triggered_by character varying(50),
    triggered_by_user_id integer,
    payment_id integer,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: subscription_events_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.subscription_events_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: subscription_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.subscription_events_id_seq OWNED BY public.subscription_events.id;


--
-- Name: subscription_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscription_plans (
    id integer NOT NULL,
    plan_code character varying(50) NOT NULL,
    plan_name character varying(100) NOT NULL,
    duration_days integer NOT NULL,
    price_inr numeric(10,2) DEFAULT 0 NOT NULL,
    features jsonb DEFAULT '{}'::jsonb,
    is_active boolean DEFAULT true,
    display_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: subscription_plans_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.subscription_plans_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: subscription_plans_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.subscription_plans_id_seq OWNED BY public.subscription_plans.id;


--
-- Name: subscriptions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.subscriptions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscriptions (
    id integer DEFAULT nextval('public.subscriptions_id_seq'::regclass) NOT NULL,
    shop_id integer NOT NULL,
    current_plan_code character varying(50) NOT NULL,
    computed_status character varying(20) DEFAULT 'trial'::character varying NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    grace_ends_at timestamp with time zone,
    last_status_check_at timestamp with time zone DEFAULT now(),
    auto_renew boolean DEFAULT false,
    next_billing_date timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT valid_status CHECK (((computed_status)::text = ANY ((ARRAY['trial'::character varying, 'active'::character varying, 'grace'::character varying, 'expired'::character varying])::text[])))
);


--
-- Name: payments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments ALTER COLUMN id SET DEFAULT nextval('public.payments_id_seq'::regclass);





--
-- Name: subscription_events id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_events ALTER COLUMN id SET DEFAULT nextval('public.subscription_events_id_seq'::regclass);


--
-- Name: subscription_plans id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_plans ALTER COLUMN id SET DEFAULT nextval('public.subscription_plans_id_seq'::regclass);


--
-- Name: admin_users admin_users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_users
    ADD CONSTRAINT admin_users_pkey PRIMARY KEY (id);


--
-- Name: admin_users admin_users_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_users
    ADD CONSTRAINT admin_users_username_key UNIQUE (username);


--
-- Name: bonus_config bonus_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bonus_config
    ADD CONSTRAINT bonus_config_pkey PRIMARY KEY (id);


--
-- Name: bonus_config bonus_config_shop_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bonus_config
    ADD CONSTRAINT bonus_config_shop_id_key UNIQUE (shop_id);


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- Name: customers customers_shop_id_phone_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_shop_id_phone_number_key UNIQUE (shop_id, phone_number);


--
-- Name: invoices invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_pkey PRIMARY KEY (id);


--
-- Name: invoices invoices_shop_id_invoice_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_shop_id_invoice_number_key UNIQUE (shop_id, invoice_number);


--
-- Name: paid_events paid_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.paid_events
    ADD CONSTRAINT paid_events_pkey PRIMARY KEY (id);


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);


--
-- Name: pricing_rules pricing_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pricing_rules
    ADD CONSTRAINT pricing_rules_pkey PRIMARY KEY (id);


--
-- Name: pricing_rules pricing_rules_shop_id_game_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pricing_rules
    ADD CONSTRAINT pricing_rules_shop_id_game_type_key UNIQUE (shop_id, game_type);





--
-- Name: subscriptions subscriptions_shop_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_shop_id_key UNIQUE (shop_id);


--
-- Name: shops shops_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shops
    ADD CONSTRAINT shops_pkey PRIMARY KEY (id);


--
-- Name: snacks snacks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.snacks
    ADD CONSTRAINT snacks_pkey PRIMARY KEY (id);


--
-- Name: snacks snacks_shop_id_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.snacks
    ADD CONSTRAINT snacks_shop_id_name_key UNIQUE (shop_id, name);


--
-- Name: stations stations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stations
    ADD CONSTRAINT stations_pkey PRIMARY KEY (shop_id, id);


--
-- Name: subscription_config subscription_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_config
    ADD CONSTRAINT subscription_config_pkey PRIMARY KEY (key);


--
-- Name: subscription_events subscription_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_events
    ADD CONSTRAINT subscription_events_pkey PRIMARY KEY (id);


--
-- Name: subscription_plans subscription_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_plans
    ADD CONSTRAINT subscription_plans_pkey PRIMARY KEY (id);


--
-- Name: subscription_plans subscription_plans_plan_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_plans
    ADD CONSTRAINT subscription_plans_plan_code_key UNIQUE (plan_code);


--
-- Name: subscriptions subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_pkey PRIMARY KEY (id);


--
-- Name: idx_admin_users_username; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_users_username ON public.admin_users USING btree (username);


--
-- Name: idx_customers_shop_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customers_shop_id ON public.customers USING btree (shop_id);


--
-- Name: idx_invoices_shop_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoices_shop_id ON public.invoices USING btree (shop_id);


--
-- Name: idx_subscriptions_expires_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriptions_expires_at ON public.subscriptions USING btree (expires_at);


--
-- Name: idx_subscriptions_shop_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriptions_shop_id ON public.subscriptions USING btree (shop_id);


--
-- Name: idx_subscriptions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriptions_status ON public.subscriptions USING btree (computed_status);


--
-- Name: idx_stations_shop_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stations_shop_id ON public.stations USING btree (shop_id);


--
-- Name: idx_subscription_events_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscription_events_created_at ON public.subscription_events USING btree (created_at DESC);


--
-- Name: idx_subscription_events_shop_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscription_events_shop_id ON public.subscription_events USING btree (shop_id);


--
-- Name: idx_subscription_events_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscription_events_type ON public.subscription_events USING btree (event_type);


--
-- Name: shops trigger_auto_create_subscription; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_auto_create_subscription AFTER INSERT ON public.shops FOR EACH ROW EXECUTE FUNCTION public.auto_create_shop_subscription();


--
-- Name: subscriptions update_subscriptions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: subscription_plans update_subscription_plans_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_subscription_plans_updated_at BEFORE UPDATE ON public.subscription_plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: payments payments_shop_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(id);


--
-- Name: payments payments_subscription_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES public.subscriptions(id);


--
-- Name: subscriptions subscriptions_current_plan_code_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_current_plan_code_fkey FOREIGN KEY (current_plan_code) REFERENCES public.subscription_plans(plan_code);


--
-- Name: subscriptions subscriptions_shop_id_fkey_cascade; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_shop_id_fkey_cascade FOREIGN KEY (shop_id) REFERENCES public.shops(id) ON DELETE CASCADE;


--
-- Name: snacks snacks_shop_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.snacks
    ADD CONSTRAINT snacks_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(id) ON DELETE CASCADE;


--
-- Name: stations stations_shop_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stations
    ADD CONSTRAINT stations_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(id) ON DELETE CASCADE;


--
-- Name: subscription_events subscription_events_payment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_events
    ADD CONSTRAINT subscription_events_payment_id_fkey FOREIGN KEY (payment_id) REFERENCES public.payments(id);


--
-- Name: subscription_events subscription_events_shop_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_events
    ADD CONSTRAINT subscription_events_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(id) ON DELETE CASCADE;


--
-- Name: subscription_events subscription_events_triggered_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_events
    ADD CONSTRAINT subscription_events_triggered_by_user_id_fkey FOREIGN KEY (triggered_by_user_id) REFERENCES public.admin_users(id);





-- 
-- Data for Name: subscription_config; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.subscription_config (key, value, description) VALUES
('grace_period_days', '3', 'Number of days after expiration before service is suspended'),
('default_trial_plan', 'FREE_TRIAL', 'Plan code for new shop trials'),
('status_check_interval_minutes', '60', 'How often to lazy-check subscription status in minutes')
ON CONFLICT (key) DO NOTHING;


-- 
-- Data for Name: subscription_plans; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.subscription_plans (plan_code, plan_name, duration_days, price_inr, features, is_active, display_order) VALUES
('FREE_TRIAL', 'Free Trial', 14, 0.00, '{"max_stations": 5, "reports": true, "support": "email"}', true, 1),
('MONTHLY', 'Monthly Premium', 30, 999.00, '{"max_stations": 20, "reports": true, "support": "priority"}', true, 2),
('QUARTERLY', 'Quarterly Saver', 90, 2699.00, '{"max_stations": 50, "reports": true, "support": "priority", "discount_percent": 10}', true, 3),
('SEMI_ANNUAL', 'Semi-Annual Pro', 180, 4999.00, '{"max_stations": 100, "reports": true, "support": "24/7", "discount_percent": 15}', true, 4),
('YEARLY', 'Yearly Elite', 365, 8999.00, '{"max_stations": 999, "reports": true, "support": "24/7", "discount_percent": 25}', true, 5)
ON CONFLICT (plan_code) DO NOTHING;


--
-- PostgreSQL database dump complete
--

\unrestrict iYcg5GMfD2KLZ3QDy0YMuRD7iqWoBwFilsPmGGAjTydezifrgkFRLgsPeXFWpRv

