-- src/db/schema.sql

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    display_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS council_votes (
    id SERIAL PRIMARY KEY,
    city TEXT NOT NULL DEFAULT 'fishers',          -- 'fishers' | 'indy' | 'carmel' | 'noblesville' | ...
    event_id TEXT,                                 -- CivicClerk/Municode event ID (per-city dedup key)
    title TEXT NOT NULL,
    date DATE NOT NULL,
    category TEXT,                                 -- e.g. "City Council", "Plan Commission"
    location TEXT,                                 -- meeting location string
    status TEXT DEFAULT 'past',                    -- 'upcoming' | 'past'
    summary TEXT,                                  -- populated by PDF parsing
    vote_counts JSONB,                             -- { yes, no, abstain } from minutes PDF
    tags TEXT[],                                   -- derived from category / keywords
    attached_pdfs JSONB,                           -- [{ fileId, type, label, url }]
    agenda_items JSONB,                            -- [{ label, title, ordinance, resolution }]
    scraped_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(city, event_id)
);

CREATE TABLE IF NOT EXISTS bids (
    id SERIAL PRIMARY KEY,
    city TEXT NOT NULL DEFAULT 'fishers',          -- 'fishers' | 'indy' | 'carmel' | 'noblesville' | ...
    source TEXT NOT NULL DEFAULT 'unknown',        -- 'fishers' | 'idoa' | 'idoa_upcoming' | 'indy'
    bid_id TEXT,                                   -- external ID (IDOA event ID, etc.)
    title TEXT NOT NULL,
    agency TEXT,
    description TEXT,                              -- full solicitation description
    contact TEXT,                                  -- contact name / email
    posted_date DATE,
    close_date DATE,
    category TEXT,
    value_estimate TEXT,
    status TEXT DEFAULT 'open',                    -- 'open' | 'closed' | 'awarded' | 'anticipated'
    awarded_to TEXT,
    documents TEXT[],
    scraped_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(city, source, bid_id)
);

CREATE TABLE IF NOT EXISTS zoning_changes (
    id SERIAL PRIMARY KEY,
    city TEXT NOT NULL DEFAULT 'fishers',          -- 'fishers' | 'indy' | 'carmel' | 'noblesville' | ...
    source TEXT NOT NULL DEFAULT 'public_notice',  -- 'public_notice' | 'dev_project'
    address TEXT NOT NULL,
    applicant TEXT,
    from_zone TEXT,
    to_zone TEXT,
    filed_date DATE,
    hearing_date DATE,
    status TEXT,
    lat DECIMAL(10, 8),
    lng DECIMAL(11, 8),
    -- public_notice fields
    docket TEXT,
    board TEXT,
    request_type TEXT,
    description TEXT,
    city_staff TEXT,
    city_staff_email TEXT,
    -- dev_project fields
    project_name TEXT,
    project_type TEXT,
    contact_name TEXT,
    contact_email TEXT,
    est_completion TEXT,
    scraped_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(city, address, filed_date)
);

CREATE TABLE IF NOT EXISTS campaign_contributions (
    id SERIAL PRIMARY KEY,
    city TEXT NOT NULL DEFAULT 'fishers',          -- 'fishers' | 'indy' | 'hamilton_county' | ...
    candidate TEXT NOT NULL,
    committee TEXT,                                -- FCPA Committee name
    committee_type TEXT,                           -- e.g. "Candidate", "Regular Party"
    office TEXT,
    donor_name TEXT,
    donor_type TEXT,                               -- e.g. "Individual", "Corporation"
    amount DECIMAL(15, 2),
    filed_date DATE,
    cycle TEXT,                                    -- year string e.g. "2024"
    scraped_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(city, donor_name, candidate, amount, filed_date)
);

CREATE TABLE IF NOT EXISTS court_cases (
    id SERIAL PRIMARY KEY,
    city TEXT NOT NULL DEFAULT 'fishers',          -- 'fishers' | 'indy' | 'hamilton_county' | ...
    case_number TEXT NOT NULL,
    title TEXT,
    case_type TEXT,
    status TEXT,
    parties JSONB,
    next_hearing DATE,
    judge TEXT,
    filed_date DATE,
    scraped_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(city, case_number)
);

CREATE TABLE IF NOT EXISTS alert_rules (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    city TEXT NOT NULL DEFAULT 'fishers',          -- city scope for the alert rule
    module TEXT NOT NULL,
    keyword TEXT,
    lat DECIMAL(10, 8),
    lng DECIMAL(11, 8),
    radius_miles DECIMAL(8, 2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS alerts (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    city TEXT NOT NULL DEFAULT 'fishers',          -- city scope for the alert
    read BOOLEAN DEFAULT FALSE,
    module TEXT NOT NULL,
    message TEXT NOT NULL,
    item_id INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- INDIANAPOLIS DATA TABLES
-- ═══════════════════════════════════════════════════════════════════════════════

-- Public safety incidents (from Indy ArcGIS)
CREATE TABLE IF NOT EXISTS incidents (
    id SERIAL PRIMARY KEY,
    city TEXT NOT NULL DEFAULT 'indy',
    incident_id TEXT,                              -- external ID from source
    incident_type TEXT NOT NULL,                   -- 'THEFT', 'BURGLARY', 'ASSAULT', etc.
    description TEXT,
    address TEXT,
    district TEXT,                                 -- council district
    occurred_at TIMESTAMP WITH TIME ZONE,
    lat DECIMAL(10, 8),
    lng DECIMAL(11, 8),
    source TEXT DEFAULT 'indy_arcgis',
    scraped_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(city, incident_id)
);

-- Traffic crashes (from Indy ArcGIS)
CREATE TABLE IF NOT EXISTS crashes (
    id SERIAL PRIMARY KEY,
    city TEXT NOT NULL DEFAULT 'indy',
    crash_id TEXT,                                 -- external ID from source
    crash_type TEXT,                               -- 'FATAL', 'INJURY', 'PROPERTY DAMAGE', etc.
    severity TEXT,
    address TEXT,
    district TEXT,
    occurred_at TIMESTAMP WITH TIME ZONE,
    lat DECIMAL(10, 8),
    lng DECIMAL(11, 8),
    vehicles_involved INTEGER,
    injuries INTEGER DEFAULT 0,
    fatalities INTEGER DEFAULT 0,
    source TEXT DEFAULT 'indy_arcgis',
    scraped_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(city, crash_id)
);

-- Police citations (from Indy ArcGIS)
CREATE TABLE IF NOT EXISTS citations (
    id SERIAL PRIMARY KEY,
    city TEXT NOT NULL DEFAULT 'indy',
    citation_id TEXT,                              -- external ID from source
    violation TEXT,
    violation_type TEXT,
    address TEXT,
    district TEXT,
    issued_at TIMESTAMP WITH TIME ZONE,
    lat DECIMAL(10, 8),
    lng DECIMAL(11, 8),
    driver_age TEXT,
    driver_sex TEXT,
    driver_race TEXT,
    source TEXT DEFAULT 'indy_arcgis',
    scraped_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(city, citation_id)
);

-- Use of force reports (from Indy ArcGIS)
CREATE TABLE IF NOT EXISTS use_of_force (
    id SERIAL PRIMARY KEY,
    city TEXT NOT NULL DEFAULT 'indy',
    report_id TEXT,                                -- external ID from source
    incident_type TEXT,
    force_type TEXT,                               -- 'TASER', 'PHYSICAL', 'PEPPER SPRAY', etc.
    address TEXT,
    district TEXT,
    occurred_at TIMESTAMP WITH TIME ZONE,
    lat DECIMAL(10, 8),
    lng DECIMAL(11, 8),
    officer_years_experience TEXT,
    subject_injury TEXT,
    source TEXT DEFAULT 'indy_arcgis',
    scraped_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(city, report_id)
);

-- 311 service requests (from RequestIndy ArcGIS)
CREATE TABLE IF NOT EXISTS service_requests (
    id SERIAL PRIMARY KEY,
    city TEXT NOT NULL DEFAULT 'indy',
    request_id TEXT,                               -- external ID from source
    request_type TEXT NOT NULL,                    -- 'POTHOLE', 'GRAFFITI', 'STREET LIGHT', etc.
    description TEXT,
    status TEXT DEFAULT 'open',                    -- 'open' | 'in_progress' | 'closed'
    address TEXT,
    district TEXT,
    requested_at TIMESTAMP WITH TIME ZONE,
    closed_at TIMESTAMP WITH TIME ZONE,
    lat DECIMAL(10, 8),
    lng DECIMAL(11, 8),
    source TEXT DEFAULT 'indy_arcgis',
    scraped_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(city, request_id)
);

-- Property parcels (from MapIndy)
CREATE TABLE IF NOT EXISTS parcels (
    id SERIAL PRIMARY KEY,
    city TEXT NOT NULL DEFAULT 'indy',
    parcel_id TEXT,                                -- external parcel ID
    address TEXT,
    owner_name TEXT,
    owner_address TEXT,
    land_use TEXT,
    zoning TEXT,
    assessed_value DECIMAL(15, 2),
    land_area_sqft DECIMAL(15, 2),
    building_area_sqft DECIMAL(15, 2),
    year_built INTEGER,
    last_sale_date DATE,
    last_sale_price DECIMAL(15, 2),
    lat DECIMAL(10, 8),
    lng DECIMAL(11, 8),
    source TEXT DEFAULT 'mapindy',
    scraped_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(city, parcel_id)
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- HAMILTON COUNTY DATA TABLES
-- ═══════════════════════════════════════════════════════════════════════════════

-- Building footprints (from HamCo GIS)
CREATE TABLE IF NOT EXISTS buildings (
    id SERIAL PRIMARY KEY,
    city TEXT NOT NULL DEFAULT 'hamco',
    building_id TEXT,
    address TEXT,
    area_sqft DECIMAL(15, 2),
    year_built INTEGER,
    status TEXT,
    lat DECIMAL(10, 8),
    lng DECIMAL(11, 8),
    source TEXT DEFAULT 'hamco_gis',
    scraped_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(city, building_id)
);

-- Tax districts (from HamCo GIS)
CREATE TABLE IF NOT EXISTS tax_districts (
    id SERIAL PRIMARY KEY,
    city TEXT NOT NULL DEFAULT 'hamco',
    district_code TEXT NOT NULL,
    district_name TEXT,
    district_type TEXT,
    lat DECIMAL(10, 8),
    lng DECIMAL(11, 8),
    source TEXT DEFAULT 'hamco_gis',
    scraped_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(city, district_code)
);

-- Schools (from HamCo GIS)
CREATE TABLE IF NOT EXISTS schools (
    id SERIAL PRIMARY KEY,
    city TEXT NOT NULL DEFAULT 'hamco',
    name TEXT NOT NULL,
    district TEXT,
    district_num INTEGER,
    address TEXT,
    zip TEXT,
    phone TEXT,
    website TEXT,
    school_type TEXT,
    opened INTEGER,
    status TEXT,
    lat DECIMAL(10, 8),
    lng DECIMAL(11, 8),
    source TEXT DEFAULT 'hamco_gis',
    scraped_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(city, name, address)
);

-- Parks (from HamCo GIS)
CREATE TABLE IF NOT EXISTS parks (
    id SERIAL PRIMARY KEY,
    city TEXT NOT NULL DEFAULT 'hamco',
    name TEXT,
    park_type TEXT,          -- 'boundary', 'trailhead', 'trail', 'memorial', 'sign'
    address TEXT,
    description TEXT,
    lat DECIMAL(10, 8),
    lng DECIMAL(11, 8),
    source TEXT DEFAULT 'hamco_gis',
    scraped_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Polling locations (from HamCo Voting layer)
CREATE TABLE IF NOT EXISTS polling_locations (
    id SERIAL PRIMARY KEY,
    city TEXT NOT NULL DEFAULT 'hamco',
    name TEXT NOT NULL,
    address TEXT,
    city_name TEXT,
    precincts TEXT,
    lat DECIMAL(10, 8),
    lng DECIMAL(11, 8),
    source TEXT DEFAULT 'hamco_gis',
    scraped_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(city, name, address)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_council_city ON council_votes (city);
CREATE INDEX IF NOT EXISTS idx_council_city_event ON council_votes (city, event_id);
CREATE INDEX IF NOT EXISTS idx_council_date_category ON council_votes (date, category);
CREATE INDEX IF NOT EXISTS idx_council_tags ON council_votes USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_bids_city ON bids (city);
CREATE INDEX IF NOT EXISTS idx_bids_city_source_status ON bids (city, source, status);
CREATE INDEX IF NOT EXISTS idx_bids_close_date ON bids (close_date);
CREATE UNIQUE INDEX IF NOT EXISTS idx_bids_city_source_title ON bids (city, source, title) WHERE bid_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_zoning_city ON zoning_changes (city);
CREATE INDEX IF NOT EXISTS idx_zoning_lat_lng_status_hearing ON zoning_changes (lat, lng, status, hearing_date);
CREATE INDEX IF NOT EXISTS idx_campaign_city ON campaign_contributions (city);
CREATE INDEX IF NOT EXISTS idx_campaign_candidate_cycle_donor ON campaign_contributions (candidate, cycle, donor_type);
CREATE INDEX IF NOT EXISTS idx_court_city ON court_cases (city);
CREATE INDEX IF NOT EXISTS idx_court_filed_type_status ON court_cases (filed_date, case_type, status);
CREATE INDEX IF NOT EXISTS idx_alerts_city ON alerts (city);
CREATE INDEX IF NOT EXISTS idx_alerts_user_read_module ON alerts (user_id, read, module);

-- Indy indexes
CREATE INDEX IF NOT EXISTS idx_incidents_city_type ON incidents (city, incident_type);
CREATE INDEX IF NOT EXISTS idx_incidents_city_district ON incidents (city, district);
CREATE INDEX IF NOT EXISTS idx_incidents_lat_lng ON incidents (lat, lng);
CREATE INDEX IF NOT EXISTS idx_incidents_occurred ON incidents (occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_crashes_city_type ON crashes (city, crash_type);
CREATE INDEX IF NOT EXISTS idx_crashes_city_district ON crashes (city, district);
CREATE INDEX IF NOT EXISTS idx_crashes_lat_lng ON crashes (lat, lng);
CREATE INDEX IF NOT EXISTS idx_crashes_occurred ON crashes (occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_citations_city_type ON citations (city, violation_type);
CREATE INDEX IF NOT EXISTS idx_citations_city_district ON citations (city, district);
CREATE INDEX IF NOT EXISTS idx_citations_lat_lng ON citations (lat, lng);
CREATE INDEX IF NOT EXISTS idx_uof_city_type ON use_of_force (city, force_type);
CREATE INDEX IF NOT EXISTS idx_uof_city_district ON use_of_force (city, district);
CREATE INDEX IF NOT EXISTS idx_uof_lat_lng ON use_of_force (lat, lng);
CREATE INDEX IF NOT EXISTS idx_service_city_type ON service_requests (city, request_type);
CREATE INDEX IF NOT EXISTS idx_service_city_status ON service_requests (city, status);
CREATE INDEX IF NOT EXISTS idx_service_lat_lng ON service_requests (lat, lng);
CREATE INDEX IF NOT EXISTS idx_service_requested ON service_requests (requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_parcels_city ON parcels (city);
CREATE INDEX IF NOT EXISTS idx_parcels_parcel_id ON parcels (city, parcel_id);
CREATE INDEX IF NOT EXISTS idx_parcels_lat_lng ON parcels (lat, lng);
CREATE INDEX IF NOT EXISTS idx_parcels_zoning ON parcels (city, zoning);

-- Hamilton County indexes
CREATE INDEX IF NOT EXISTS idx_buildings_city ON buildings (city);
CREATE INDEX IF NOT EXISTS idx_buildings_id ON buildings (city, building_id);
CREATE INDEX IF NOT EXISTS idx_buildings_lat_lng ON buildings (lat, lng);
CREATE INDEX IF NOT EXISTS idx_tax_districts_city ON tax_districts (city);
CREATE INDEX IF NOT EXISTS idx_tax_districts_code ON tax_districts (city, district_code);
CREATE INDEX IF NOT EXISTS idx_schools_city ON schools (city);
CREATE INDEX IF NOT EXISTS idx_schools_district ON schools (city, district);
CREATE INDEX IF NOT EXISTS idx_schools_lat_lng ON schools (lat, lng);
CREATE INDEX IF NOT EXISTS idx_parks_city ON parks (city);
CREATE INDEX IF NOT EXISTS idx_parks_lat_lng ON parks (lat, lng);
CREATE INDEX IF NOT EXISTS idx_polling_city ON polling_locations (city);
CREATE INDEX IF NOT EXISTS idx_polling_lat_lng ON polling_locations (lat, lng);

-- Migrations for existing installs (safe to re-run)
ALTER TABLE council_votes ADD COLUMN IF NOT EXISTS city TEXT NOT NULL DEFAULT 'fishers';
ALTER TABLE council_votes ADD COLUMN IF NOT EXISTS event_id TEXT;
ALTER TABLE council_votes ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE council_votes ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE council_votes ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'past';
ALTER TABLE council_votes ADD COLUMN IF NOT EXISTS summary TEXT;
ALTER TABLE council_votes ADD COLUMN IF NOT EXISTS attached_pdfs JSONB;
ALTER TABLE council_votes ADD COLUMN IF NOT EXISTS agenda_items JSONB;
-- Drop old global unique on event_id, add per-city unique
DROP INDEX IF EXISTS idx_council_event_id;

ALTER TABLE bids ADD COLUMN IF NOT EXISTS city TEXT NOT NULL DEFAULT 'fishers';
ALTER TABLE bids ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'unknown';
ALTER TABLE bids ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE bids ADD COLUMN IF NOT EXISTS contact TEXT;
ALTER TABLE bids ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'open';
ALTER TABLE bids ADD COLUMN IF NOT EXISTS awarded_to TEXT;

ALTER TABLE campaign_contributions ADD COLUMN IF NOT EXISTS city TEXT NOT NULL DEFAULT 'fishers';
ALTER TABLE campaign_contributions ADD COLUMN IF NOT EXISTS committee TEXT;
ALTER TABLE campaign_contributions ADD COLUMN IF NOT EXISTS committee_type TEXT;

ALTER TABLE court_cases ADD COLUMN IF NOT EXISTS city TEXT NOT NULL DEFAULT 'fishers';

ALTER TABLE alert_rules ADD COLUMN IF NOT EXISTS city TEXT NOT NULL DEFAULT 'fishers';
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS city TEXT NOT NULL DEFAULT 'fishers';

-- Zoning: real ArcGIS fields (PublicNoticePoints source)
ALTER TABLE zoning_changes ADD COLUMN IF NOT EXISTS city TEXT NOT NULL DEFAULT 'fishers';
ALTER TABLE zoning_changes ADD COLUMN IF NOT EXISTS docket TEXT;
ALTER TABLE zoning_changes ADD COLUMN IF NOT EXISTS board TEXT;
ALTER TABLE zoning_changes ADD COLUMN IF NOT EXISTS request_type TEXT;
ALTER TABLE zoning_changes ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE zoning_changes ADD COLUMN IF NOT EXISTS city_staff TEXT;
ALTER TABLE zoning_changes ADD COLUMN IF NOT EXISTS city_staff_email TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_zoning_docket ON zoning_changes (docket) WHERE docket IS NOT NULL;

-- Zoning: dev projects layer (source discriminator + project name)
ALTER TABLE zoning_changes ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'public_notice';
ALTER TABLE zoning_changes ADD COLUMN IF NOT EXISTS project_name TEXT;
ALTER TABLE zoning_changes ADD COLUMN IF NOT EXISTS project_type TEXT;
ALTER TABLE zoning_changes ADD COLUMN IF NOT EXISTS contact_name TEXT;
ALTER TABLE zoning_changes ADD COLUMN IF NOT EXISTS contact_email TEXT;
ALTER TABLE zoning_changes ADD COLUMN IF NOT EXISTS est_completion TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_zoning_devproject ON zoning_changes (project_name) WHERE source = 'dev_project' AND project_name IS NOT NULL;
