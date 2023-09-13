import { DynamicTool } from 'langchain/tools';

const foo = new DynamicTool({
  name: 'foo',
  description: 'returns the answer to what foo is',
  func: async () => {
    console.log('triggers foo function');
    return 'the value of foo is "This is a demo"';
  },
});

export default foo;
