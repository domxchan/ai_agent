import { SerpAPI } from 'langchain/tools';

const serper = new SerpAPI(process.env.SERPAPI_API_KEY, {
  location: 'Hong Kong',
  hl: 'en',
  gl: 'us',
});

export default serper;
