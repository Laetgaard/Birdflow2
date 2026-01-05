import type { ShippingRateRequest, ShippingRate } from '@shared/schema';
import type { ShippingProvider } from '../types';

export class GLSProvider implements ShippingProvider {
  carrier = 'gls' as const;
  name = 'GLS';

  getRequiredCredentials() {
    return [
      {
        key: 'contactId',
        label: 'Contact ID',
        type: 'text' as const,
        placeholder: 'Your GLS Contact ID',
        helpText: 'Get this from your GLS business account',
      },
      {
        key: 'password',
        label: 'API Password',
        type: 'password' as const,
        placeholder: 'Your GLS API Password',
      },
      {
        key: 'customerId',
        label: 'Customer ID',
        type: 'text' as const,
        placeholder: 'Your GLS Customer ID',
      },
    ];
  }

  async validateCredentials(credentials: Record<string, string>, testMode: boolean): Promise<boolean> {
    const { contactId, password, customerId } = credentials;
    if (!contactId || !password || !customerId) {
      return false;
    }
    return true;
  }

  async getRates(request: ShippingRateRequest, credentials: Record<string, string>, testMode: boolean): Promise<ShippingRate[]> {
    const { contactId, password, customerId } = credentials;
    
    try {
      const baseUrl = testMode 
        ? 'https://api-test.gls-group.eu'
        : 'https://api.gls-group.eu';

      const totalWeight = request.packages.reduce((sum, pkg) => sum + pkg.weight, 0);
      const weightKg = totalWeight / 1000;

      const priceEstimates = this.estimatePrices(weightKg, request.destinationAddress.country);

      return priceEstimates.map(estimate => ({
        carrierId: 'gls',
        carrierName: 'GLS',
        serviceName: estimate.serviceName,
        serviceCode: estimate.serviceCode,
        price: estimate.price,
        currency: 'EUR',
        deliveryTime: estimate.deliveryTime,
      }));
    } catch (error) {
      console.error('GLS getRates error');
      return [];
    }
  }

  private estimatePrices(weightKg: number, country: string): Array<{
    serviceName: string;
    serviceCode: string;
    price: number;
    deliveryTime: string;
  }> {
    const basePrice = this.getBasePrice(weightKg);
    const countryMultiplier = this.getCountryMultiplier(country);

    return [
      {
        serviceName: 'GLS Business Parcel',
        serviceCode: 'BUSINESS',
        price: Math.round(basePrice * countryMultiplier * 100),
        deliveryTime: '2-4 business days',
      },
      {
        serviceName: 'GLS Express',
        serviceCode: 'EXPRESS',
        price: Math.round(basePrice * countryMultiplier * 1.5 * 100),
        deliveryTime: '1-2 business days',
      },
      {
        serviceName: 'GLS FlexDelivery',
        serviceCode: 'FLEX',
        price: Math.round(basePrice * countryMultiplier * 1.2 * 100),
        deliveryTime: '2-3 business days',
      },
    ];
  }

  private getBasePrice(weightKg: number): number {
    if (weightKg <= 1) return 5.99;
    if (weightKg <= 5) return 7.99;
    if (weightKg <= 10) return 9.99;
    if (weightKg <= 20) return 14.99;
    if (weightKg <= 31.5) return 19.99;
    return 24.99 + (weightKg - 31.5) * 0.5;
  }

  private getCountryMultiplier(country: string): number {
    const domestic = ['DK', 'DE'];
    const nearbyEU = ['NL', 'BE', 'AT', 'PL', 'CZ', 'SE'];
    
    if (domestic.includes(country)) return 1;
    if (nearbyEU.includes(country)) return 1.3;
    return 1.8;
  }
}
