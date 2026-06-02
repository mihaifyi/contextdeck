import { generateDirectoryTree, estimateTokens, cleanCode } from '../src/utils/bundler';

describe('Bundler Utility', () => {
  describe('generateDirectoryTree', () => {
    it('should generate a correct ASCII tree representation', () => {
      const paths = [
        'src/index.ts',
        'src/utils/files.ts',
        'package.json',
        'tests/files.test.ts'
      ];
      
      const tree = generateDirectoryTree(paths);
      
      expect(tree).toContain('├── package.json');
      expect(tree).toContain('├── src');
      expect(tree).toContain('│   ├── index.ts');
      expect(tree).toContain('│   └── utils');
      expect(tree).toContain('│       └── files.ts');
      expect(tree).toContain('└── tests');
      expect(tree).toContain('    └── files.test.ts');
    });
  });

  describe('estimateTokens', () => {
    it('should calculate estimates for different model providers', () => {
      const sampleText = 'const x = 42;\nconsole.log(x);';
      const stats = estimateTokens(sampleText);
      
      expect(stats.characters).toBe(sampleText.length);
      expect(stats.gpt).toBeGreaterThan(0);
      expect(stats.claude).toBeGreaterThan(0);
      expect(stats.gemini).toBeGreaterThan(0);
    });
  });

  describe('cleanCode', () => {
    it('should strip empty lines when removeEmptyLines is true', () => {
      const dirtyCode = 'const a = 1;\n\n\nconst b = 2;\n  \nconsole.log(a, b);';
      const cleaned = cleanCode(dirtyCode, { format: 'xml', removeEmptyLines: true });
      
      expect(cleaned).toBe('const a = 1;\nconst b = 2;\nconsole.log(a, b);');
    });

    it('should leave code intact when removeEmptyLines is false', () => {
      const dirtyCode = 'const a = 1;\n\nconst b = 2;';
      const cleaned = cleanCode(dirtyCode, { format: 'xml', removeEmptyLines: false });
      
      expect(cleaned).toBe(dirtyCode);
    });
  });
});
