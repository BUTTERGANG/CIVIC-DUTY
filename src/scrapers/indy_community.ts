// src/scrapers/indy_community.ts
// Community directory layers from Accela AGIS: historic sites, daycares, and places of worship.
// All are small datasets (hundreds to low thousands) from the same ArcGIS server.
import { ArcgisScraper } from './arcgis';

const ACCELA_BASE = 'https://gis.indy.gov/server/rest/services/Accela/AGIS_INDIANAPOLIS/MapServer';

// ── Historic Sites (layer 4) ─────────────────────────────────────────────────

export class IndyHistoricSitesScraper extends ArcgisScraper {
  constructor() {
    super({
      module: 'historic_sites',
      city: 'indy',
      serviceUrl: `${ACCELA_BASE}/4/query`,
      tableName: 'historic_sites',
      fieldMap: {
        name: 'ITEM',
        address: 'ADDRESS',
        year_built: 'YEAR_BUILT',
        district: 'DISTRICT',
        rating: 'RATING',
        notes: 'NOTES',
        external_id: 'SHAARD_ID',
      },
      dedupFields: ['city', 'name', 'address'],
      staticFields: { source: 'indy_accola' },
      enableAlerts: false,
    });
  }
}

// ── Licensed Daycares (layer 3) ────────────────────────────────────────────────

export class IndyDaycareScraper extends ArcgisScraper {
  constructor() {
    super({
      module: 'daycares',
      city: 'indy',
      serviceUrl: `${ACCELA_BASE}/3/query`,
      tableName: 'daycares',
      fieldMap: {
        name: 'FACILITY_NAME',
        address: 'LOCATION_ADDRESS',
        license_number: 'LICENSE_NUMBER',
        provider_type: 'PROVIDERTYPE',
      },
      dedupFields: ['city', 'name', 'address'],
      staticFields: { source: 'indy_accola' },
      hasGeometry: false,
      enableAlerts: false,
    });
  }
}

// ── Places of Worship (layer 0) ────────────────────────────────────────────────

export class IndyPlacesOfWorshipScraper extends ArcgisScraper {
  constructor() {
    super({
      module: 'places_of_worship',
      city: 'indy',
      serviceUrl: `${ACCELA_BASE}/0/query`,
      tableName: 'places_of_worship',
      fieldMap: {
        name: 'NAME',
        place_type: 'TYPE',
        address: 'ADDRESS',
      },
      dedupFields: ['city', 'name', 'address'],
      staticFields: { source: 'indy_accola' },
      enableAlerts: false,
    });
  }
}