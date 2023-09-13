import { createRetrieverTool } from 'langchain/agents/toolkits';
import { getVectorStoreRetriever } from './vectorStoreRetriever';

const docRetrieverTool = async () => {
  const vectorStoreRetriever = await getVectorStoreRetriever();

  if (!vectorStoreRetriever) {
    return null;
  }

  const tool = createRetrieverTool(vectorStoreRetriever, {
    name: 'documentsQuery',
    description:
      "documents about the Hong Kong Securities and Futures Commission's Online Distribution and Advisory Platforms Guilelines - useful for questions about selling investments online in Hong Kong, the core principles, requirements, robo-advice, client profiling, suitability requirement and other conduct requirements applicable to the sale of investment products, and guidelines about complex products.",
  });

  return tool;
};

export default docRetrieverTool;
