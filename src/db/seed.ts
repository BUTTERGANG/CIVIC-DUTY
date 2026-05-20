import { pool } from './index';

async function seed() {
  try {
    console.log('Seeding database...');
    
    await pool.query('BEGIN');
    
    // Clear existing data for reset
    await pool.query('TRUNCATE table council_votes, bids, zoning_changes, campaign_contributions, court_cases, alert_rules, alerts RESTART IDENTITY;');
    
    // Seed Council Votes
    await pool.query(`
      INSERT INTO council_votes (title, date, vote_counts, tags, attached_pdfs) VALUES
      ('Resolution 55 - Park Funding', '2023-10-15', '{"yea": 20, "nay": 5}', ARRAY['parks', 'budget'], ARRAY['http://example.com/res55.pdf']),
      ('Ordinance 12 - New Zoning Area', '2023-10-16', '{"yea": 15, "nay": 10}', ARRAY['zoning', 'development'], ARRAY['http://example.com/ord12.pdf']);
    `);
    
    // Seed Bids
    await pool.query(`
      INSERT INTO bids (bid_id, title, agency, posted_date, close_date, category, value_estimate, documents) VALUES
      ('BID-2023-01', 'Street Paving Downtown', 'DPW', '2023-10-01', '2023-11-01', 'infrastructure', '$500k-$1M', ARRAY['http://example.com/bid1.pdf']),
      ('BID-2023-02', 'Library Roof Repair', 'Parks and Rec', '2023-10-05', '2023-11-05', 'maintenance', '$100k-$500k', ARRAY['http://example.com/bid2.pdf']);
    `);
    
    // Seed Zoning
    await pool.query(`
      INSERT INTO zoning_changes (address, applicant, from_zone, to_zone, filed_date, hearing_date, status, lat, lng) VALUES
      ('123 Main St, Indianapolis, IN', 'John Doe Dev', 'C-1', 'C-3', '2023-09-01', '2023-10-20', 'Scheduled', 39.7684, -86.1581),
      ('456 Broad Ave, Indianapolis, IN', 'Jane Smith', 'R-1', 'C-1', '2023-09-15', '2023-10-25', 'Approved', 39.8000, -86.1500);
    `);
    
    // Seed Campaign
    await pool.query(`
      INSERT INTO campaign_contributions (candidate, office, donor_name, donor_type, amount, filed_date, cycle) VALUES
      ('Alice Walker', 'Mayor', 'Bob Builder', 'Individual', 5000.00, '2023-10-10', '2023 Election'),
      ('Charlie Brown', 'City Council', 'Acme Corp', 'PAC', 10000.00, '2023-10-12', '2023 Election');
    `);
    
    // Seed Court
    await pool.query(`
      INSERT INTO court_cases (case_number, title, case_type, status, parties, next_hearing, judge, filed_date) VALUES
      ('49D01-2301-PL-123456', 'City v. Acme', 'Civil', 'Open', '[{"name": "City of Indy", "role": "Plaintiff"}, {"name": "Acme", "role": "Defendant"}]', '2023-11-01', 'Hon. Judy', '2023-10-01');
    `);
    
    await pool.query('COMMIT');
    console.log('Seeding completed successfully.');
  } catch (err) {
    await pool.query('ROLLBACK');
    console.error('Error seeding DB:', err);
  } finally {
    pool.end();
  }
}

seed();
