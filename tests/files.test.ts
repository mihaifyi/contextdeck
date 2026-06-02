import { isIgnored } from '../src/utils/files';

describe('Files Scanner Utility', () => {
  describe('isIgnored', () => {
    it('should ignore default excluded items', () => {
      expect(isIgnored('node_modules/lodash/index.js', [])).toBe(true);
      expect(isIgnored('.git/config', [])).toBe(true);
      expect(isIgnored('dist/index.js', [])).toBe(true);
    });

    it('should ignore default binary file extensions', () => {
      expect(isIgnored('assets/logo.png', [])).toBe(true);
      expect(isIgnored('docs/manual.pdf', [])).toBe(true);
      expect(isIgnored('archive.zip', [])).toBe(true);
    });

    it('should not ignore standard code files', () => {
      expect(isIgnored('src/index.ts', [])).toBe(false);
      expect(isIgnored('README.md', [])).toBe(false);
    });

    it('should respect custom ignore rules', () => {
      const customRules = ['*.log', 'tmp/', 'config/*.json'];
      
      expect(isIgnored('error.log', customRules)).toBe(true);
      expect(isIgnored('logs/error.log', customRules)).toBe(true);
      
      expect(isIgnored('tmp/file.txt', customRules)).toBe(true);
      expect(isIgnored('config/db.json', customRules)).toBe(true);
      
      // Should not ignore
      expect(isIgnored('src/config/db.json', customRules)).toBe(false);
      expect(isIgnored('config/db.yaml', customRules)).toBe(false);
    });
  });
});
