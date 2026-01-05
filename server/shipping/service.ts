import type { ShippingRateRequest, ShippingRate, CarrierType, ShippingCarrierCredentials, ShippingConfig, ShippingMethod } from '@shared/schema';
import type { ShippingProvider } from './types';
import { UPSProvider } from './providers/ups';
import { GLSProvider } from './providers/gls';
import { PostNordProvider } from './providers/postnord';

const providers: Record<CarrierType, ShippingProvider> = {
  ups: new UPSProvider(),
  gls: new GLSProvider(),
  postnord: new PostNordProvider(),
};

export class ShippingService {
  static getProvider(carrier: CarrierType): ShippingProvider {
    return providers[carrier];
  }

  static getAllProviders(): ShippingProvider[] {
    return Object.values(providers);
  }

  static async getCarrierRates(
    carrier: CarrierType,
    request: ShippingRateRequest,
    credentials: Record<string, string>,
    testMode: boolean
  ): Promise<ShippingRate[]> {
    const provider = providers[carrier];
    if (!provider) {
      throw new Error(`Unknown carrier: ${carrier}`);
    }
    return provider.getRates(request, credentials, testMode);
  }

  static async getAllCarrierRates(
    carrierCredentials: ShippingCarrierCredentials[],
    request: ShippingRateRequest
  ): Promise<ShippingRate[]> {
    const activeCredentials = carrierCredentials.filter(c => c.isActive);
    
    const ratePromises = activeCredentials.map(async (cred) => {
      try {
        return await this.getCarrierRates(
          cred.carrier as CarrierType,
          request,
          cred.credentials,
          cred.testMode
        );
      } catch (error) {
        console.error(`Error getting rates from ${cred.carrier}:`, error);
        return [];
      }
    });

    const results = await Promise.all(ratePromises);
    return results.flat().sort((a, b) => a.price - b.price);
  }

  static async validateCredentials(
    carrier: CarrierType,
    credentials: Record<string, string>,
    testMode: boolean
  ): Promise<boolean> {
    const provider = providers[carrier];
    if (!provider) {
      return false;
    }
    return provider.validateCredentials(credentials, testMode);
  }

  static getRequiredCredentials(carrier: CarrierType) {
    const provider = providers[carrier];
    if (!provider) {
      return [];
    }
    return provider.getRequiredCredentials();
  }

  static convertManualMethodsToRates(
    methods: ShippingMethod[],
    currency?: string
  ): ShippingRate[] {
    return methods
      .filter(m => m.isActive)
      .map(method => ({
        carrierId: 'manual',
        carrierName: 'Store',
        serviceName: method.name,
        serviceCode: method.id,
        price: method.priceAmount,
        currency: method.currency,
        deliveryTime: method.deliveryTime || undefined,
      }));
  }

  static async getCombinedRates(
    config: ShippingConfig | null,
    manualMethods: ShippingMethod[],
    carrierCredentials: ShippingCarrierCredentials[],
    request: ShippingRateRequest
  ): Promise<ShippingRate[]> {
    const mode = config?.mode || 'manual';

    if (mode === 'manual') {
      return this.convertManualMethodsToRates(manualMethods);
    }

    const carrierRates = await this.getAllCarrierRates(carrierCredentials, request);
    
    if (carrierRates.length === 0) {
      return this.convertManualMethodsToRates(manualMethods);
    }

    return carrierRates;
  }
}
