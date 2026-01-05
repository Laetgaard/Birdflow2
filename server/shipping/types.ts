import type { ShippingRateRequest, ShippingRate, CarrierType } from '@shared/schema';

export interface ShippingProvider {
  carrier: CarrierType;
  name: string;
  
  getRates(request: ShippingRateRequest, credentials: Record<string, string>, testMode: boolean): Promise<ShippingRate[]>;
  
  validateCredentials(credentials: Record<string, string>, testMode: boolean): Promise<boolean>;
  
  getRequiredCredentials(): Array<{
    key: string;
    label: string;
    type: 'text' | 'password';
    placeholder?: string;
    helpText?: string;
  }>;
}

export type CarrierInfo = {
  id: CarrierType;
  name: string;
  logo?: string;
  description: string;
  supportedCountries: string[];
};

export const CARRIER_INFO: Record<CarrierType, CarrierInfo> = {
  ups: {
    id: 'ups',
    name: 'UPS',
    description: 'United Parcel Service - Global shipping and logistics',
    supportedCountries: ['US', 'CA', 'GB', 'DE', 'FR', 'DK', 'SE', 'NO'],
  },
  gls: {
    id: 'gls',
    name: 'GLS',
    description: 'General Logistics Systems - European parcel service',
    supportedCountries: ['DK', 'DE', 'NL', 'BE', 'FR', 'AT', 'PL', 'CZ'],
  },
  postnord: {
    id: 'postnord',
    name: 'PostNord',
    description: 'Nordic postal and logistics - Denmark, Sweden, Norway, Finland',
    supportedCountries: ['DK', 'SE', 'NO', 'FI'],
  },
};
