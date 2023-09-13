import { DynamicStructuredTool } from 'langchain/tools';
import * as z from 'zod';

const fetchCryptoPrice = new DynamicStructuredTool({
  name: 'fetchCryptoPrice',
  description: 'Fetches the current price of a specified cryptocurrency',
  schema: z.object({
    cryptoName: z.string(),
    vsCurrency: z.string().default('USD'),
  }),
  func: async (options) => {
    console.log('triggers fetchCryptoPrice function with options: ', options);
    const { cryptoName, vsCurrency } = options;
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${cryptoName}&vs_currencies=${vsCurrency}`;
    let response;
    try {
      response = await fetch(url);
    } catch (e) {
      console.log(e);
      return '';
    }
    const data = await response.json();
    console.log(data);
    const output = data[cryptoName!.toLowerCase()][vsCurrency.toLowerCase()].toString();
    return output;
  },
});

export default fetchCryptoPrice;
