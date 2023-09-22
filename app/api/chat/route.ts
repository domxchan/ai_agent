import { NextRequest, NextResponse } from 'next/server';
import { StreamingTextResponse, LangChainStream, Message } from 'ai';
import { ChatOpenAI } from 'langchain/chat_models/openai';
import { StructuredTool } from 'langchain/tools';

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
import docRetrieverTool from '@/lib/utils/docRetrieverTool';

// import { getVectorStoreChain } from '../../../lib/utils/vectorStoreRetriever';

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
    modelName: 'gpt-3.5-turbo-instruct', // this replaces the text-davinci-003
  });

  const tools: StructuredTool[] = [foo, fetchCryptoPrice, wikiQuery, serper, new Calculator()];

  const docQaTool = await docRetrieverTool();

  if (docQaTool) {
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
    maxIterations: 5, // limiting max iterations
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
