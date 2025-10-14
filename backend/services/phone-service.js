const axios = require('axios');

/**
 * Phone Number Service Integration
 * Supports: 5sim.net, sms-activate.org, smspool.net
 */
class PhoneService {
  constructor() {
    this.provider = process.env.PHONE_SERVICE_PROVIDER || '5sim';
    this.apiKey = process.env.PHONE_SERVICE_API_KEY;
    this.apiUrls = {
      '5sim': 'https://5sim.net/v1',
      'sms-activate': 'https://api.sms-activate.org/stubs/handler_api.php',
      'smspool': 'https://api.smspool.net'
    };
  }

  /**
   * Get a phone number for Twitter verification
   */
  async getNumber(service = 'twitter') {
    if (!this.apiKey) {
      return {
        success: false,
        error: 'Phone service API key not configured'
      };
    }

    try {
      if (this.provider === '5sim') {
        return await this.get5simNumber(service);
      } else if (this.provider === 'sms-activate') {
        return await this.getSMSActivateNumber(service);
      } else if (this.provider === 'smspool') {
        return await this.getSMSPoolNumber(service);
      } else {
        return {
          success: false,
          error: 'Unsupported phone service provider'
        };
      }
    } catch (error) {
      console.error('Error getting phone number:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get number from 5sim
   */
  async get5simNumber(service) {
    try {
      const country = 'usa'; // Or make configurable
      const product = this.serviceToProductCode(service);

      const response = await axios.get(
        `${this.apiUrls['5sim']}/user/buy/activation/${country}/any/${product}`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Accept': 'application/json'
          }
        }
      );

      if (response.data && response.data.id) {
        return {
          success: true,
          number: response.data.phone,
          activationId: response.data.id,
          provider: '5sim'
        };
      } else {
        return {
          success: false,
          error: 'No available numbers'
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  }

  /**
   * Get number from SMS-Activate
   */
  async getSMSActivateNumber(service) {
    try {
      const response = await axios.get(this.apiUrls['sms-activate'], {
        params: {
          api_key: this.apiKey,
          action: 'getNumber',
          service: this.serviceToProductCode(service),
          country: 0 // Russia (cheap), or use 187 for USA
        }
      });

      const data = response.data;
      if (data.startsWith('ACCESS_NUMBER')) {
        const [, activationId, phoneNumber] = data.split(':');
        return {
          success: true,
          number: phoneNumber,
          activationId,
          provider: 'sms-activate'
        };
      } else {
        return {
          success: false,
          error: data
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get number from SMSPool
   */
  async getSMSPoolNumber(service) {
    try {
      const response = await axios.post(
        `${this.apiUrls['smspool']}/purchase/sms`,
        {
          key: this.apiKey,
          country: 'US',
          service: 'Twitter',
          pool: 1 // Use pool 1 (cheapest)
        }
      );

      if (response.data.success === 1) {
        return {
          success: true,
          number: response.data.number,
          activationId: response.data.order_id,
          provider: 'smspool'
        };
      } else {
        return {
          success: false,
          error: response.data.message || 'Failed to get number'
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  }

  /**
   * Get SMS code from a purchased number
   */
  async getSMSCode(activationId, provider = null) {
    const usedProvider = provider || this.provider;

    try {
      if (usedProvider === '5sim') {
        return await this.get5simCode(activationId);
      } else if (usedProvider === 'sms-activate') {
        return await this.getSMSActivateCode(activationId);
      } else if (usedProvider === 'smspool') {
        return await this.getSMSPoolCode(activationId);
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get code from 5sim
   */
  async get5simCode(activationId) {
    try {
      const response = await axios.get(
        `${this.apiUrls['5sim']}/user/check/${activationId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Accept': 'application/json'
          }
        }
      );

      if (response.data && response.data.sms && response.data.sms.length > 0) {
        const code = response.data.sms[0].code;
        return {
          success: true,
          code
        };
      } else {
        return {
          success: false,
          error: 'No SMS received yet'
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get code from SMS-Activate
   */
  async getSMSActivateCode(activationId) {
    try {
      const response = await axios.get(this.apiUrls['sms-activate'], {
        params: {
          api_key: this.apiKey,
          action: 'getStatus',
          id: activationId
        }
      });

      const data = response.data;
      if (data.startsWith('STATUS_OK')) {
        const code = data.split(':')[1];
        return {
          success: true,
          code
        };
      } else if (data === 'STATUS_WAIT_CODE') {
        return {
          success: false,
          error: 'Waiting for SMS'
        };
      } else {
        return {
          success: false,
          error: data
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get code from SMSPool
   */
  async getSMSPoolCode(activationId) {
    try {
      const response = await axios.post(
        `${this.apiUrls['smspool']}/sms/check`,
        {
          key: this.apiKey,
          orderid: activationId
        }
      );

      if (response.data.status === 3) {
        // Status 3 = SMS received
        return {
          success: true,
          code: response.data.sms
        };
      } else if (response.data.status === 1) {
        // Status 1 = Pending
        return {
          success: false,
          error: 'Waiting for SMS'
        };
      } else {
        return {
          success: false,
          error: 'No SMS received'
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  }

  /**
   * Cancel an activation (if not used)
   */
  async cancelActivation(activationId, provider = null) {
    const usedProvider = provider || this.provider;

    try {
      if (usedProvider === '5sim') {
        await axios.get(`${this.apiUrls['5sim']}/user/cancel/${activationId}`, {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Accept': 'application/json'
          }
        });
      } else if (usedProvider === 'sms-activate') {
        await axios.get(this.apiUrls['sms-activate'], {
          params: {
            api_key: this.apiKey,
            action: 'setStatus',
            status: 8, // Cancel
            id: activationId
          }
        });
      } else if (usedProvider === 'smspool') {
        await axios.post(`${this.apiUrls['smspool']}/sms/cancel`, {
          key: this.apiKey,
          orderid: activationId
        });
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get account balance
   */
  async getBalance() {
    try {
      if (this.provider === '5sim') {
        const response = await axios.get(`${this.apiUrls['5sim']}/user/profile`, {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Accept': 'application/json'
          }
        });
        return {
          success: true,
          balance: response.data.balance,
          currency: response.data.default_currency
        };
      } else if (this.provider === 'sms-activate') {
        const response = await axios.get(this.apiUrls['sms-activate'], {
          params: {
            api_key: this.apiKey,
            action: 'getBalance'
          }
        });
        return {
          success: true,
          balance: parseFloat(response.data.split(':')[1]),
          currency: 'RUB'
        };
      } else if (this.provider === 'smspool') {
        const response = await axios.post(`${this.apiUrls['smspool']}/request/balance`, {
          key: this.apiKey
        });
        return {
          success: true,
          balance: response.data.balance,
          currency: 'USD'
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Map service name to product code
   */
  serviceToProductCode(service) {
    const codes = {
      '5sim': {
        twitter: 'twitter',
        instagram: 'instagram',
        facebook: 'facebook'
      },
      'sms-activate': {
        twitter: 'tw',
        instagram: 'ig',
        facebook: 'fb'
      }
    };

    return codes[this.provider]?.[service] || service;
  }
}

module.exports = new PhoneService();

