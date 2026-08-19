// src/api.ts — typed fetch helpers with DB → UI field transforms

const BASE = '/api';

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('cd_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
  return res.json();
}

function cityParam(params: Record<string, string>): Record<string, string> {
  const city = localStorage.getItem('cd_selected_city') ?? 'fishers';
  return { ...params, city };
}

// --- Auth ---

export interface AuthUser {
  id: number;
  email: string;
  display_name: string | null;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

export async function apiLogin(email: string, password: string): Promise<AuthResponse> {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? `Login failed (${res.status})`);
  }
  return res.json();
}

export async function apiRegister(email: string, password: string, display_name?: string): Promise<AuthResponse> {
  const res = await fetch(`${BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, display_name }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? `Registration failed (${res.status})`);
  }
  return res.json();
}

export async function apiMe(): Promise<AuthUser> {
  return get<AuthUser>('/auth/me');
}

export interface AlertRule {
  id: number;
  user_id: string;
  city: string;
  module: string;
  keyword: string | null;
  lat: number | null;
  lng: number | null;
  radius_miles: number | null;
  created_at: string;
}

export async function fetchAlertRules(city?: string): Promise<AlertRule[]> {
  const qs = city ? `?city=${encodeURIComponent(city)}` : '';
  return get<AlertRule[]>(`/alerts/rules${qs}`);
}

export async function apiCreateAlertRule(rule: {
  city?: string;
  module: string;
  keyword?: string;
  lat?: number;
  lng?: number;
  radius_miles?: number;
}): Promise<AlertRule> {
  const res = await fetch(`${BASE}/alerts/rules`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(rule),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? `Failed to create alert rule (${res.status})`);
  }
  return res.json();
}

export async function apiDeleteAlertRule(id: number): Promise<void> {
  const res = await fetch(`${BASE}/alerts/rules/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to delete rule (${res.status})`);
}

// --- Court ---

export interface CourtCase {
  id: number;
  case_number: string;
  title: string | null;
  case_type: string | null;
  status: string | null;
  parties: { name: string; role: string }[];
  next_hearing: string | null;
  judge: string | null;
  filed_date: string | null;
  scraped_at: string;
}

// GET /api/court returns { total, rows }; the bare-array arm covers older
// responses that callers still narrow against with Array.isArray.
export type CourtListResponse = CourtCase[] | { total?: number; rows: CourtCase[] };

export async function fetchCourt(params: Record<string, string> = {}): Promise<CourtListResponse> {
  const merged = cityParam(params);
  const qs = new URLSearchParams(merged).toString();
  return get<CourtListResponse>(`/court?${qs}`);
}

export async function lookupCourtCase(caseNumber: string): Promise<{ source: string; case: CourtCase }> {
  const res = await fetch(`${BASE}/court/lookup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ case_number: caseNumber }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? `Lookup failed (${res.status})`);
  }
  return res.json();
}

// --- Council ---

export interface AgendaItem {
  label: string;
  title: string;
  ordinance: string | null;
  resolution: string | null;
}

export interface CouncilVote {
  id: number;
  city: string;
  event_id: string;
  title: string;
  date: string;
  category: string | null;
  location: string | null;
  status: 'upcoming' | 'past';
  summary: string | null;
  tags: string[];
  votes: { yes: number; no: number; abstain: number };
  documents: { label: string; url: string }[];
  agendaItems: AgendaItem[];
}

interface CouncilRow {
  id: number;
  city: string;
  event_id: string;
  title: string;
  date: string;
  category: string | null;
  location: string | null;
  status: string;
  summary: string | null;
  tags: string[];
  vote_counts: { yes: number; no: number; abstain: number } | null;
  attached_pdfs: { fileId: number; type: string; label: string; url: string }[] | null;
  agenda_items: AgendaItem[] | null;
}

function transformCouncil(row: CouncilRow): CouncilVote {
  return {
    id: row.id,
    city: row.city ?? 'fishers',
    event_id: row.event_id,
    title: row.title,
    date: row.date,
    category: row.category,
    location: row.location,
    status: row.status as 'upcoming' | 'past',
    summary: row.summary,
    tags: row.tags ?? [],
    votes: row.vote_counts ?? { yes: 0, no: 0, abstain: 0 },
    documents: (row.attached_pdfs ?? []).map(f => ({ label: f.label, url: f.url })),
    agendaItems: row.agenda_items ?? [],
  };
}

export async function fetchCouncil(params: Record<string, string> = {}): Promise<CouncilVote[]> {
  const merged = cityParam(params);
  const qs = new URLSearchParams(merged).toString();
  const rows = await get<CouncilRow[]>(`/council?${qs}`);
  return rows.map(transformCouncil);
}

// --- Bids ---

export interface Bid {
  id: number;
  city: string;
  source: string;
  bid_id: string | null;
  title: string;
  agency: string | null;
  description: string | null;
  contact: string | null;
  posted_date: string | null;
  close_date: string | null;
  category: string | null;
  value_estimate: number | null;
  status: string;
  awarded_to: string | null;
  documents: { label: string; url: string }[];
}

interface BidRow {
  id: number;
  city: string;
  source: string;
  bid_id: string | null;
  title: string;
  agency: string | null;
  description: string | null;
  contact: string | null;
  posted_date: string | null;
  close_date: string | null;
  category: string | null;
  value_estimate: string | null;
  status: string;
  awarded_to: string | null;
  documents: string[] | null;
}

function transformBid(row: BidRow): Bid {
  return {
    id: row.id,
    city: row.city ?? 'fishers',
    source: row.source,
    bid_id: row.bid_id,
    title: row.title,
    agency: row.agency,
    description: row.description,
    contact: row.contact,
    posted_date: row.posted_date,
    close_date: row.close_date,
    category: row.category,
    value_estimate: row.value_estimate ? parseFloat(row.value_estimate) || null : null,
    status: row.status,
    awarded_to: row.awarded_to,
    documents: (row.documents ?? []).map(url => ({ label: 'Document', url })),
  };
}

export async function fetchBids(params: Record<string, string> = {}): Promise<Bid[]> {
  const merged = cityParam(params);
  const qs = new URLSearchParams(merged).toString();
  const rows = await get<BidRow[]>(`/bids?${qs}`);
  return rows.map(transformBid);
}

// --- Campaign Finance ---

export interface CampaignContribution {
  id: number;
  city: string;
  candidate: string;
  committee: string | null;
  committee_type: string | null;
  office: string | null;
  donor_name: string | null;
  donor_type: string | null;
  amount: number;
  filed_date: string | null;
  cycle: string | null;
  scraped_at: string;
}

export async function fetchCampaign(params: Record<string, string> = {}): Promise<CampaignContribution[]> {
  const merged = cityParam(params);
  const qs = new URLSearchParams(merged).toString();
  return get<CampaignContribution[]>(`/campaign?${qs}`);
}

export async function fetchCampaignCandidates(city?: string): Promise<string[]> {
  const qs = city ? `?city=${encodeURIComponent(city)}` : '';
  return get<string[]>(`/campaign/candidates${qs}`);
}

export async function fetchCampaignOffices(city?: string): Promise<string[]> {
  const qs = city ? `?city=${encodeURIComponent(city)}` : '';
  return get<string[]>(`/campaign/offices${qs}`);
}

// --- Zoning ---

export interface ZoningChange {
  id: number;
  city: string;
  source: 'public_notice' | 'dev_project';
  address: string;
  applicant: string | null;
  from_zone: string | null;
  to_zone: string | null;
  filed_date: string | null;
  hearing_date: string | null;
  status: string;
  lat: number | null;
  lng: number | null;
  docket: string | null;
  board: string | null;
  request_type: string | null;
  description: string | null;
  city_staff: string | null;
  city_staff_email: string | null;
  project_name: string | null;
  project_type: string | null;
  contact_name: string | null;
  contact_email: string | null;
  est_completion: string | null;
  scraped_at: string;
}

export async function fetchZoning(params: Record<string, string> = {}): Promise<ZoningChange[]> {
  const merged = cityParam(params);
  const qs = new URLSearchParams(merged).toString();
  return get<ZoningChange[]>(`/zoning?${qs}`);
}

// --- Incidents ---

export interface Incident {
  id: number;
  city: string;
  incident_id: string;
  incident_type: string;
  description: string | null;
  address: string | null;
  district: string | null;
  occurred_at: string | null;
  lat: number | null;
  lng: number | null;
  source: string;
  scraped_at: string;
}

export async function fetchIncidents(params: Record<string, string> = {}): Promise<Incident[]> {
  const merged = cityParam(params);
  const qs = new URLSearchParams(merged).toString();
  return get<Incident[]>(`/incidents?${qs}`);
}

// --- Crashes ---

export interface Crash {
  id: number;
  city: string;
  crash_id: string;
  crash_type: string | null;
  severity: string | null;
  address: string | null;
  district: string | null;
  occurred_at: string | null;
  lat: number | null;
  lng: number | null;
  vehicles_involved: number | null;
  injuries: number;
  fatalities: number;
  source: string;
  scraped_at: string;
}

export async function fetchCrashes(params: Record<string, string> = {}): Promise<Crash[]> {
  const merged = cityParam(params);
  const qs = new URLSearchParams(merged).toString();
  return get<Crash[]>(`/crashes?${qs}`);
}

// --- Citations ---

export interface Citation {
  id: number;
  city: string;
  citation_id: string;
  violation: string | null;
  violation_type: string | null;
  address: string | null;
  district: string | null;
  issued_at: string | null;
  lat: number | null;
  lng: number | null;
  driver_age: string | null;
  driver_sex: string | null;
  driver_race: string | null;
  source: string;
  scraped_at: string;
}

export async function fetchCitations(params: Record<string, string> = {}): Promise<Citation[]> {
  const merged = cityParam(params);
  const qs = new URLSearchParams(merged).toString();
  return get<Citation[]>(`/citations?${qs}`);
}

// --- Use of Force ---

export interface UseOfForceReport {
  id: number;
  city: string;
  report_id: string;
  incident_type: string | null;
  force_type: string | null;
  address: string | null;
  district: string | null;
  occurred_at: string | null;
  lat: number | null;
  lng: number | null;
  officer_years_experience: string | null;
  subject_injury: string | null;
  source: string;
  scraped_at: string;
}

export async function fetchUseOfForce(params: Record<string, string> = {}): Promise<UseOfForceReport[]> {
  const merged = cityParam(params);
  const qs = new URLSearchParams(merged).toString();
  return get<UseOfForceReport[]>(`/use-of-force?${qs}`);
}

// --- Service Requests ---

export interface ServiceRequest {
  id: number;
  city: string;
  request_id: string;
  request_type: string;
  description: string | null;
  status: string;
  address: string | null;
  district: string | null;
  requested_at: string | null;
  closed_at: string | null;
  lat: number | null;
  lng: number | null;
  source: string;
  scraped_at: string;
}

export async function fetchServiceRequests(params: Record<string, string> = {}): Promise<ServiceRequest[]> {
  const merged = cityParam(params);
  const qs = new URLSearchParams(merged).toString();
  return get<ServiceRequest[]>(`/service-requests?${qs}`);
}

// --- Alerts ---

export interface ApiAlert {
  id: number;
  user_id: string;
  city: string;
  read: boolean;
  module: string;
  message: string;
  item_id: number | null;
  created_at: string;
}

export async function fetchAlerts(params: Record<string, string> = {}): Promise<ApiAlert[]> {
  const merged = cityParam(params);
  const qs = new URLSearchParams(merged).toString();
  return get<ApiAlert[]>(`/alerts?${qs}`);
}

export async function markAlertRead(id: number): Promise<void> {
  await fetch(`${BASE}/alerts/${id}/read`, { method: 'PATCH', headers: authHeaders() });
}

// --- Dashboard summary ---

export interface DashboardSummary {
  counts: {
    council: number;
    bids: number;
    zoning: number;
    campaign: number;
    court: number;
    incidents: number;
    crashes: number;
    citations: number;
    useOfForce: number;
    serviceRequests: number;
    parcels: number;
    buildings: number;
    schools: number;
    parks: number;
    polling: number;
    tax_districts: number;
  };
  latestItems: {
    council: CouncilRow | null;
    bids: BidRow | null;
    zoning: unknown;
    campaign: unknown;
    court: unknown;
  };
}

export async function fetchDashboardSummary(city?: string): Promise<DashboardSummary> {
  const qs = city ? `?city=${encodeURIComponent(city)}` : '';
  return get<DashboardSummary>(`/dashboard/summary${qs}`);
}

// --- Cities ---

export interface CityInfo {
  id: string;
  displayName: string;
  state: string;
  description: string;
  modules: string[];
  icon: string;
  hasData: boolean;
}

export async function fetchCities(): Promise<{ cities: CityInfo[] }> {
  return get<{ cities: CityInfo[] }>('/cities');
}

// --- Parcels ---

export interface Parcel {
  id: number;
  city: string;
  parcel_id: string;
  address: string | null;
  owner_name: string | null;
  owner_address: string | null;
  land_use: string | null;
  zoning: string | null;
  tax_district: string | null;
  land_area_sqft: number | null;
  building_area_sqft: number | null;
  assessed_value: number | null;
  last_sale_date: string | null;
  year_built: number | null;
  lat: number | null;
  lng: number | null;
  source: string;
  scraped_at: string;
}

export async function fetchParcels(params: Record<string, string> = {}): Promise<Parcel[]> {
  const merged = cityParam(params);
  const qs = new URLSearchParams(merged).toString();
  return get<Parcel[]>(`/parcels?${qs}`);
}

// --- Buildings ---

export interface Building {
  id: number;
  city: string;
  building_id: string | null;
  address: string | null;
  building_type: string | null;
  year_built: number | null;
  area_sqft: number | null;
  levels: number | null;
  lat: number | null;
  lng: number | null;
  source: string;
  scraped_at: string;
}

export async function fetchBuildings(params: Record<string, string> = {}): Promise<Building[]> {
  const merged = cityParam(params);
  const qs = new URLSearchParams(merged).toString();
  return get<Building[]>(`/buildings?${qs}`);
}

// --- Schools ---

export interface School {
  id: number;
  city: string;
  name: string;
  district: string | null;
  school_type: string | null;
  address: string | null;
  grade_levels: string | null;
  enrollment: number | null;
  lat: number | null;
  lng: number | null;
  source: string;
  scraped_at: string;
}

export async function fetchSchools(params: Record<string, string> = {}): Promise<School[]> {
  const merged = cityParam(params);
  const qs = new URLSearchParams(merged).toString();
  return get<School[]>(`/schools?${qs}`);
}

// --- Parks ---

export interface Park {
  id: number;
  city: string;
  name: string;
  park_type: string | null;
  address: string | null;
  area_acres: number | null;
  features: string | null;
  lat: number | null;
  lng: number | null;
  source: string;
  scraped_at: string;
}

export async function fetchParks(params: Record<string, string> = {}): Promise<Park[]> {
  const merged = cityParam(params);
  const qs = new URLSearchParams(merged).toString();
  return get<Park[]>(`/parks?${qs}`);
}

// --- Polling Locations ---

export interface PollingLocation {
  id: number;
  city: string;
  name: string;
  address: string | null;
  precinct: string | null;
  district: string | null;
  poll_hours: string | null;
  lat: number | null;
  lng: number | null;
  source: string;
  scraped_at: string;
}

export async function fetchPollingLocations(params: Record<string, string> = {}): Promise<PollingLocation[]> {
  const merged = cityParam(params);
  const qs = new URLSearchParams(merged).toString();
  return get<PollingLocation[]>(`/polling-locations?${qs}`);
}

// --- Tax Districts ---

export interface TaxDistrict {
  id: number;
  city: string;
  district_code: string | null;
  district_name: string | null;
  tax_rate: number | null;
  net_assessed_value: number | null;
  lat: number | null;
  lng: number | null;
  source: string;
  scraped_at: string;
}

export async function fetchTaxDistricts(params: Record<string, string> = {}): Promise<TaxDistrict[]> {
  const merged = cityParam(params);
  const qs = new URLSearchParams(merged).toString();
  return get<TaxDistrict[]>(`/tax-districts?${qs}`);
}

// --- Calls for Service (IMPD CAD) ---

export interface CallForService {
  id: number;
  city: string;
  cad: string | null;
  call_source: string | null;
  incident_type: string;
  primary_dispatch: string | null;
  address: string | null;
  district: string | null;
  council_district: string | null;
  received_at: string | null;
  dispatched_at: string | null;
  arrived_at: string | null;
  cleared_at: string | null;
  lat: number | null;
  lng: number | null;
  source: string;
  scraped_at: string;
}

export async function fetchCallsForService(params: Record<string, string> = {}): Promise<CallForService[]> {
  const merged = cityParam(params);
  const qs = new URLSearchParams(merged).toString();
  return get<CallForService[]>(`/cfs?${qs}`);
}

// --- VisionZero Crashes (DPW traffic safety) ---

export interface VisionZeroCrash {
  id: number;
  city: string;
  crash_id: string;
  vehicles: number | null;
  people_involved: number | null;
  pedestrians: number | null;
  bicycle: number | null;
  injuries: number;
  fatalities: number;
  hit_and_run: string | null;
  roadway_class: string | null;
  manner_of_collision: string | null;
  crash_type: string | null;
  severity: string | null;
  crash_status: string | null;
  address: string | null;
  district: string | null;
  council_district: string | null;
  occurred_at: string | null;
  lat: number | null;
  lng: number | null;
  source: string;
  scraped_at: string;
}

export async function fetchVisionZeroCrashes(params: Record<string, string> = {}): Promise<VisionZeroCrash[]> {
  const merged = cityParam(params);
  const qs = new URLSearchParams(merged).toString();
  return get<VisionZeroCrash[]>(`/visionzero?${qs}`);
}

// --- Historic Sites ---

export interface HistoricSite {
  id: number;
  city: string;
  name: string;
  address: string | null;
  year_built: number | null;
  district: string | null;
  rating: string | null;
  notes: string | null;
  external_id: string | null;
  lat: number | null;
  lng: number | null;
  source: string;
  scraped_at: string;
}

export async function fetchHistoricSites(params: Record<string, string> = {}): Promise<HistoricSite[]> {
  const merged = cityParam(params);
  const qs = new URLSearchParams(merged).toString();
  return get<HistoricSite[]>(`/historic-sites?${qs}`);
}

// --- Daycares ---

export interface Daycare {
  id: number;
  city: string;
  name: string;
  address: string | null;
  license_number: string | null;
  provider_type: string | null;
  lat: number | null;
  lng: number | null;
  source: string;
  scraped_at: string;
}

export async function fetchDaycares(params: Record<string, string> = {}): Promise<Daycare[]> {
  const merged = cityParam(params);
  const qs = new URLSearchParams(merged).toString();
  return get<Daycare[]>(`/daycares?${qs}`);
}

// --- Places of Worship ---

export interface PlaceOfWorship {
  id: number;
  city: string;
  name: string;
  place_type: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  source: string;
  scraped_at: string;
}

export async function fetchPlacesOfWorship(params: Record<string, string> = {}): Promise<PlaceOfWorship[]> {
  const merged = cityParam(params);
  const qs = new URLSearchParams(merged).toString();
  return get<PlaceOfWorship[]>(`/places-of-worship?${qs}`);
}

// --- Parcel Owners ---

export interface ParcelOwner {
  id: number;
  city: string;
  state_parcel_number: string | null;
  parcel_i: number | null;
  owner_name: string | null;
  property_class: string | null;
  property_sub_class_description: string | null;
  township_name: string | null;
  owner_address: string | null;
  owner_address2: string | null;
  owner_city: string | null;
  owner_state: string | null;
  owner_zip: string | null;
  land_total: number | null;
  improvement_total: number | null;
  source: string;
  scraped_at: string;
}

export async function fetchParcelOwners(params: Record<string, string> = {}): Promise<ParcelOwner[]> {
  const merged = cityParam(params);
  const qs = new URLSearchParams(merged).toString();
  return get<ParcelOwner[]>(`/parcel-owners?${qs}`);
}

// --- Property Assessments ---

export interface PropertyAssessment {
  id: number;
  city: string;
  parcel_tag: number | null;
  improved_value: string | null;
  land_value: string | null;
  legal_desc: string | null;
  parcel_number: string | null;
  state_pin: string | null;
  address: string | null;
  owner_name: string | null;
  source: string;
  scraped_at: string;
}

export async function fetchPropertyAssessments(params: Record<string, string> = {}): Promise<PropertyAssessment[]> {
  const merged = cityParam(params);
  const qs = new URLSearchParams(merged).toString();
  return get<PropertyAssessment[]>(`/property-assessments?${qs}`);
}

// --- Zoning Variances ---

export interface ZoningVariance {
  id: number;
  city: string;
  case_number: string;
  recommendation: string | null;
  status: string | null;
  decision_date: string | null;
  planner: string | null;
  lat: number | null;
  lng: number | null;
  source: string;
  scraped_at: string;
}

export async function fetchZoningVariances(params: Record<string, string> = {}): Promise<ZoningVariance[]> {
  const merged = cityParam(params);
  const qs = new URLSearchParams(merged).toString();
  return get<ZoningVariance[]>(`/zoning-variances?${qs}`);
}
