-- Migration: add scraper_log and campaign_expenditures tables
-- Run this after the main schema.sql

-- Scraper run log
CREATE TABLE IF NOT EXISTS scraper_log (
    id SERIAL PRIMARY KEY,
    source VARCHAR(100) NOT NULL,
    run_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status VARCHAR(10) NOT NULL CHECK (status IN ('success', 'error')),
    records_upserted INTEGER DEFAULT 0,
    error_message TEXT
);
CREATE INDEX IF NOT EXISTS idx_scraper_log_source ON scraper_log(source, run_at DESC);

-- Campaign expenditures (FCPA)
CREATE TABLE IF NOT EXISTS campaign_expenditures (
    id SERIAL PRIMARY KEY,
    city VARCHAR(50) DEFAULT 'fishers',
    committee_name TEXT,
    candidate_name TEXT,
    office_sought TEXT,
    cycle TEXT,
    payee_name TEXT,
    payee_address TEXT,
    purpose TEXT,
    amount NUMERIC(12,2),
    expenditure_date DATE,
    report_type TEXT,
    source VARCHAR(50) DEFAULT 'fcpa',
    scraped_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (committee_name, payee_name, amount, expenditure_date)
);
CREATE INDEX IF NOT EXISTS idx_campaign_exp_office ON campaign_expenditures(office_sought);
CREATE INDEX IF NOT EXISTS idx_campaign_exp_candidate ON campaign_expenditures(candidate_name);
