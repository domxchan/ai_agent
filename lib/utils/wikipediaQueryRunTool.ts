import { WikipediaQueryRun } from 'langchain/tools';

const wikiQuery = new WikipediaQueryRun({
  topKResults: 1,
  maxDocContentLength: 300,
});

export default wikiQuery;
