import { NextRequest, NextResponse } from 'next/server';
import { StreamingTextResponse, LangChainStream, Message } from 'ai';
import { ChatOpenAI } from 'langchain/chat_models/openai';

// memory
import { createRetrieverTool, OpenAIAgentTokenBufferMemory } from 'langchain/agents/toolkits';
import { ChatMessageHistory } from 'langchain/memory';

// helper tools
import { convertVercelMessageToLangChainMessage } from '../../../lib/utils/helperTools';

// agent tools
import { initializeAgentExecutorWithOptions } from 'langchain/agents';
import { ChainTool } from 'langchain/tools';
import { Calculator } from 'langchain/tools/calculator';
import foo from '../../../lib/utils/fooDynamicTool';
import serper from '../../../lib/utils/serperTool';
import wikiQuery from '@/lib/utils/wikipediaQueryRunTool';
import fetchCryptoPrice from '../../../lib/utils/fetchCryptoDynamicTool';
import { getVectorStoreChain } from '../../../lib/utils/vectorStoreChain';

// export const runtime = 'edge';

export async function POST(req: Request) {
  const body = await req.json();

  // const { stream, handlers } = LangChainStream();

  const messages = (body.messages ?? []).filter(
    (message: Message) => message.role === 'user' || message.role === 'assistant'
  );

  const model = new ChatOpenAI({
    temperature: 0,
    streaming: true,
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

  const returnIntermediateSteps = body.show_intermediate_steps;
  const previousMessages = messages.slice(0, -1);
  const currentMessageContent = messages[messages.length - 1].content;

  console.log('messages: ', messages);
  console.log(currentMessageContent);

  const chatHistory = new ChatMessageHistory(
    previousMessages.map(convertVercelMessageToLangChainMessage)
  );

  /**
   * This is a special type of memory specifically for conversational
   * retrieval agents.
   * It tracks intermediate steps as well as chat history up to a
   * certain number of tokens.
   *
   * The default OpenAI Functions agent prompt has a placeholder named
   * "chat_history" where history messages get injected - this is why
   * we set "memoryKey" to "chat_history". This will be made clearer
   * in a future release.
   */
  const memory = new OpenAIAgentTokenBufferMemory({
    llm: model,
    memoryKey: 'chat_history',
    outputKey: 'output',
    chatHistory,
  });

  const executor = await initializeAgentExecutorWithOptions(tools, model, {
    agentType: 'openai-functions',
    memory,
    returnIntermediateSteps: true,
    verbose: true,
  });

  const result = await executor.call({ input: currentMessageContent });

  console.log('result: ', result.output);
  const chunks = result.output.split(' ');

  if (returnIntermediateSteps) {
    return NextResponse.json(
      { output: result.output, intermediate_steps: result.intermediateSteps },
      { status: 200 }
    );
  } else {
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
  }
}
