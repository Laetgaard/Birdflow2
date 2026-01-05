import type { ShippingRateRequest, ShippingRate } from '@shared/schema';
import type { ShippingProvider } from '../types';

export class UPSProvider implements ShippingProvider {
  carrier = 'ups' as const;
  name = 'UPS';

  getRequiredCredentials() {
    return [
      {
        key: 'clientId',
        label: 'Client ID',
        type: 'text' as const,
        placeholder: 'Your UPS OAuth Client ID',
        helpText: 'Get this from the UPS Developer Portal',
      },
      {
        key: 'clientSecret',
        label: 'Client Secret',
        type: 'password' as const,
        placeholder: 'Your UPS OAuth Client Secret',
      },
      {
        key: 'accountNumber',
        label: 'Account Number',
        type: 'text' as const,
        placeholder: 'Your UPS Account Number',
      },
    ];
  }

  async validateCredentials(credentials: Record<string, string>, testMode: boolean): Promise<boolean> {
    const { clientId, clientSecret, accountNumber } = credentials;
    if (!clientId || !clientSecret || !accountNumber) {
      return false;
    }

    try {
      const token = await this.getAccessToken(clientId, clientSecret, testMode);
      return !!token;
    } catch (error) {
      console.error('UPS credential validation failed');
      return false;
    }
  }

  async getRates(request: ShippingRateRequest, credentials: Record<string, string>, testMode: boolean): Promise<ShippingRate[]> {
    const { clientId, clientSecret, accountNumber } = credentials;
    
    try {
      const token = await this.getAccessToken(clientId, clientSecret, testMode);
      const baseUrl = testMode 
        ? 'https://wwwcie.ups.com' 
        : 'https://onlinetools.ups.com';

      const rateRequest = {
        RateRequest: {
          Request: {
            RequestOption: 'Shop',
          },
          Shipment: {
            Shipper: {
              ShipperNumber: accountNumber,
              Address: {
                PostalCode: request.destinationAddress.postalCode,
                CountryCode: request.destinationAddress.country,
              },
            },
            ShipTo: {
              Address: {
                PostalCode: request.destinationAddress.postalCode,
                CountryCode: request.destinationAddress.country,
                City: request.destinationAddress.city || '',
              },
            },
            ShipFrom: {
              Address: {
                PostalCode: request.destinationAddress.postalCode,
                CountryCode: request.destinationAddress.country,
              },
            },
            Package: request.packages.map(pkg => ({
              PackagingType: { Code: '02' },
              Dimensions: pkg.dimensions ? {
                UnitOfMeasurement: { Code: 'CM' },
                Length: String(pkg.dimensions.length),
                Width: String(pkg.dimensions.width),
                Height: String(pkg.dimensions.height),
              } : undefined,
              PackageWeight: {
                UnitOfMeasurement: { Code: 'KGS' },
                Weight: String((pkg.weight / 1000).toFixed(2)),
              },
            })),
          },
        },
      };

      const response = await fetch(`${baseUrl}/api/rating/v1/shop`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'transId': Date.now().toString(),
          'transactionSrc': 'SaaSify',
        },
        body: JSON.stringify(rateRequest),
      });

      if (!response.ok) {
        console.error('UPS rating API error: Status', response.status);
        return [];
      }

      const data = await response.json();
      const ratedShipments = data.RateResponse?.RatedShipment || [];

      return ratedShipments.map((shipment: any) => ({
        carrierId: 'ups',
        carrierName: 'UPS',
        serviceName: this.getServiceName(shipment.Service?.Code),
        serviceCode: shipment.Service?.Code || '',
        price: Math.round(parseFloat(shipment.TotalCharges?.MonetaryValue || '0') * 100),
        currency: shipment.TotalCharges?.CurrencyCode || 'USD',
        deliveryTime: shipment.GuaranteedDelivery?.BusinessDaysInTransit 
          ? `${shipment.GuaranteedDelivery.BusinessDaysInTransit} business days`
          : undefined,
      }));
    } catch (error) {
      console.error('UPS getRates error');
      return [];
    }
  }

  private async getAccessToken(clientId: string, clientSecret: string, testMode: boolean): Promise<string> {
    const baseUrl = testMode 
      ? 'https://wwwcie.ups.com' 
      : 'https://onlinetools.ups.com';

    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const response = await fetch(`${baseUrl}/security/v1/oauth/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    if (!response.ok) {
      throw new Error('UPS authentication failed');
    }

    const data = await response.json();
    return data.access_token;
  }

  private getServiceName(code: string): string {
    const services: Record<string, string> = {
      '01': 'UPS Next Day Air',
      '02': 'UPS 2nd Day Air',
      '03': 'UPS Ground',
      '07': 'UPS Worldwide Express',
      '08': 'UPS Worldwide Expedited',
      '11': 'UPS Standard',
      '12': 'UPS 3 Day Select',
      '14': 'UPS Next Day Air Early',
      '65': 'UPS Worldwide Saver',
    };
    return services[code] || `UPS Service ${code}`;
  }
}
