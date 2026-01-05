import type { ShippingRateRequest, ShippingRate } from '@shared/schema';
import type { ShippingProvider } from '../types';

export class PostNordProvider implements ShippingProvider {
  carrier = 'postnord' as const;
  name = 'PostNord';

  getRequiredCredentials() {
    return [
      {
        key: 'apiKey',
        label: 'API Key',
        type: 'password' as const,
        placeholder: 'Your PostNord API Key',
        helpText: 'Get this from the PostNord Developer Portal',
      },
      {
        key: 'customerNumber',
        label: 'Customer Number',
        type: 'text' as const,
        placeholder: 'Your PostNord Customer Number',
      },
    ];
  }

  async validateCredentials(credentials: Record<string, string>, testMode: boolean): Promise<boolean> {
    const { apiKey, customerNumber } = credentials;
    if (!apiKey || !customerNumber) {
      return false;
    }

    try {
      const baseUrl = 'https://api2.postnord.com';
      const response = await fetch(
        `${baseUrl}/rest/transport/v1/servicepoints/nearest?apiKey=${apiKey}&returnType=json&countryCode=DK&postalCode=2100`,
        { method: 'GET' }
      );
      return response.ok;
    } catch (error) {
      console.error('PostNord credential validation failed');
      return false;
    }
  }

  async getRates(request: ShippingRateRequest, credentials: Record<string, string>, testMode: boolean): Promise<ShippingRate[]> {
    try {
      const totalWeight = request.packages.reduce((sum, pkg) => sum + pkg.weight, 0);
      const weightKg = totalWeight / 1000;

      const priceEstimates = this.estimatePrices(
        weightKg, 
        request.destinationAddress.country,
        request.destinationAddress.postalCode
      );

      return priceEstimates.map(estimate => ({
        carrierId: 'postnord',
        carrierName: 'PostNord',
        serviceName: estimate.serviceName,
        serviceCode: estimate.serviceCode,
        price: estimate.price,
        currency: 'DKK',
        deliveryTime: estimate.deliveryTime,
      }));
    } catch (error) {
      console.error('PostNord getRates error');
      return [];
    }
  }

  private estimatePrices(weightKg: number, country: string, postalCode: string): Array<{
    serviceName: string;
    serviceCode: string;
    price: number;
    deliveryTime: string;
  }> {
    const isDomestic = ['DK'].includes(country);
    const isNordic = ['DK', 'SE', 'NO', 'FI'].includes(country);

    if (isDomestic) {
      return this.getDomesticPrices(weightKg);
    } else if (isNordic) {
      return this.getNordicPrices(weightKg);
    } else {
      return this.getInternationalPrices(weightKg);
    }
  }

  private getDomesticPrices(weightKg: number): Array<{
    serviceName: string;
    serviceCode: string;
    price: number;
    deliveryTime: string;
  }> {
    const basePrice = this.getBasePrice(weightKg);

    return [
      {
        serviceName: 'PostNord Collect',
        serviceCode: 'COLLECT',
        price: Math.round(basePrice * 0.8 * 100),
        deliveryTime: '1-3 business days',
      },
      {
        serviceName: 'PostNord Home Delivery',
        serviceCode: 'HOME',
        price: Math.round(basePrice * 100),
        deliveryTime: '1-2 business days',
      },
      {
        serviceName: 'PostNord Express',
        serviceCode: 'EXPRESS',
        price: Math.round(basePrice * 1.8 * 100),
        deliveryTime: 'Next business day',
      },
    ];
  }

  private getNordicPrices(weightKg: number): Array<{
    serviceName: string;
    serviceCode: string;
    price: number;
    deliveryTime: string;
  }> {
    const basePrice = this.getBasePrice(weightKg) * 1.5;

    return [
      {
        serviceName: 'PostNord Nordic Parcel',
        serviceCode: 'NORDIC',
        price: Math.round(basePrice * 100),
        deliveryTime: '3-5 business days',
      },
      {
        serviceName: 'PostNord Nordic Express',
        serviceCode: 'NORDIC_EXPRESS',
        price: Math.round(basePrice * 1.6 * 100),
        deliveryTime: '2-3 business days',
      },
    ];
  }

  private getInternationalPrices(weightKg: number): Array<{
    serviceName: string;
    serviceCode: string;
    price: number;
    deliveryTime: string;
  }> {
    const basePrice = this.getBasePrice(weightKg) * 2.5;

    return [
      {
        serviceName: 'PostNord International Parcel',
        serviceCode: 'INTERNATIONAL',
        price: Math.round(basePrice * 100),
        deliveryTime: '5-10 business days',
      },
    ];
  }

  private getBasePrice(weightKg: number): number {
    if (weightKg <= 1) return 39;
    if (weightKg <= 2) return 49;
    if (weightKg <= 5) return 59;
    if (weightKg <= 10) return 79;
    if (weightKg <= 20) return 99;
    return 129 + (weightKg - 20) * 5;
  }
}
