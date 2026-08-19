// src/scrapers/indy_parcel_owners.ts
// Parcel ownership and property assessment data from Accela HHC.
// Two tables from the same ArcGIS server:
//   - ParcelOwner (410K, non-spatial) — owner name, property class, assessed values
//   - ACCELA_XAPO_PARCEL (354K, point geometry) — land/improved values, legal description
import { ArcgisScraper } from './arcgis';

const ACCELA_BASE = 'https://gis.indy.gov/server/rest/services/Accela';

export class IndyParcelOwnerScraper extends ArcgisScraper {
  constructor() {
    super({
      module: 'parcel_owners',
      city: 'indy',
      serviceUrl: `${ACCELA_BASE}/HHC_ParcelOwner/MapServer/1/query`,
      tableName: 'parcel_owners',
      fieldMap: {
        state_parcel_number: 'STATEPARCELNUMBER',
        parcel_i: 'PARCEL_I',
        owner_name: 'FULLOWNERNAME',
        property_class: 'PROPERTY_CLASS',
        property_sub_class_description: 'PROPERTY_SUB_CLASS_DESCRIPTION',
        township_name: 'TOWNSHIPNAME',
        owner_address: 'OWNERADDRESS',
        owner_address2: 'OWNERADDRESS2',
        owner_city: 'OWNERCITY',
        owner_state: 'OWNERSTATE',
        owner_zip: 'OWNERZIP',
        land_total: 'ASSESSORYEAR_LANDTOTAL',
        improvement_total: 'ASSESSORYEAR_IMPTOTAL',
      },
      dedupFields: ['city', 'parcel_i'],
      whereClause: '1=1',
      hasGeometry: false,
      staticFields: { source: 'indy_accela' },
      enableAlerts: false,
    });
  }
}

export class IndyPropertyAssessmentScraper extends ArcgisScraper {
  constructor() {
    super({
      module: 'property_assessments',
      city: 'indy',
      serviceUrl: `${ACCELA_BASE}/ACCELA_XAPO_ADDRESS/MapServer/0/query`,
      tableName: 'property_assessments',
      fieldMap: {
        parcel_tag: 'PARCEL_TAG',
        improved_value: 'IMPROVED_VALUE',
        land_value: 'LAND_VALUE',
        legal_desc: 'LEGAL_DESC',
        parcel_number: 'PARCEL_NUMBER',
        state_pin: 'STATE_PINP',
        address: 'ADDRESS1',
        owner_name: 'OWNER_NAME',
      },
      dedupFields: ['city', 'parcel_tag'],
      whereClause: '1=1',
      hasGeometry: false,
      staticFields: { source: 'indy_accela' },
      enableAlerts: false,
    });
  }
}