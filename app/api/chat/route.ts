import { StreamingTextResponse, LangChainStream, Message } from 'ai';
import { AIMessage, HumanMessage } from 'langchain/schema';
import {
  DynamicTool,
  DynamicStructuredTool,
  WikipediaQueryRun,
  ChainTool,
  SerpAPI,
} from 'langchain/tools';
import { Calculator } from 'langchain/tools/calculator';
import { ChatOpenAI } from 'langchain/chat_models/openai';
import { initializeAgentExecutorWithOptions } from 'langchain/agents';

import { getVectorStoreChain } from '../../../lib/utils/vectorStoreChain.js';

import * as z from 'zod';

// export const runtime = 'edge';

export async function POST(req: Request) {
  const { messages } = await req.json();

  // const { stream, handlers } = LangChainStream();

  const model = new ChatOpenAI({
    temperature: 0,
    streaming: true,
  });

  const wikiQuery = new WikipediaQueryRun({
    topKResults: 1,
    maxDocContentLength: 300,
  });

  const foo = new DynamicTool({
    name: 'foo',
    description: 'returns the answer to what foo is',
    func: async () => {
      console.log('triggers foo function');
      return 'the value of foo is "This is a demo"';
    },
  });

  const serper = new SerpAPI(process.env.SERPAPI_API_KEY, {
    location: 'Hong Kong',
    hl: 'en',
    gl: 'us',
  });

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

  const tools = [foo, fetchCryptoPrice, wikiQuery, serper, new Calculator()];

  const vectorStoreChain = await getVectorStoreChain();

  if (vectorStoreChain) {
    const docQaTool = new ChainTool({
      name: 'documentsQuery',
      description:
        "documents about the Hong Kong Securities and Futures Commission's Online Distribution and Advisory Platforms Guilelines - useful for questions about selling investments online in Hong Kong, the core principles, requirements, robo-advice, client profiling, suitability requirement and other conduct requirements applicable to the sale of investment products, and guidelines about complex products.",
      chain: vectorStoreChain,
    });
    tools.push(docQaTool);
  }

  const executor = await initializeAgentExecutorWithOptions(tools, model, {
    agentType: 'openai-functions',
    verbose: true,
  });

  const input = messages[messages.length - 1].content;
  console.log('messages: ', messages);
  console.log(input);

  const result = await executor.run(input);

  const chunks = result.split(' ');

  const responseStream = new ReadableStream({
    async start(controller) {
      for (const chunk of chunks) {
        const bytes = new TextEncoder().encode(chunk + ' ');
        controller.enqueue(bytes);
        await new Promise((r) => setTimeout(r, Math.floor(Math.random() * 20 + 10)));
      }
      controller.close();
    },
  });

  return new StreamingTextResponse(responseStream);

  // model
  //   .call(
  //     (messages as Message[]).map((m) =>
  //       m.role == 'user' ? new HumanMessage(m.content) : new AIMessage(m.content)
  //     ),
  //     {},
  //     [handlers]
  //   )
  //   .catch(console.error);

  // return new StreamingTextResponse(stream);
}
