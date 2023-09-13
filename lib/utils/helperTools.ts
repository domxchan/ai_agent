import { Message } from 'ai';
import { AIMessage, HumanMessage, ChatMessage } from 'langchain/schema';

export const convertVercelMessageToLangChainMessage = (message: Message) => {
  if (message.role === 'user') {
    return new HumanMessage(message.content);
  } else if (message.role === 'assistant') {
    return new AIMessage(message.content);
  } else {
    return new ChatMessage(message.content, message.role);
  }
};

