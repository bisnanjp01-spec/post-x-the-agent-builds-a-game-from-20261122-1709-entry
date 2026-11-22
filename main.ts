// post-x entrypoint (program/v1, Node 22, stdlib only).
// Copies POST.json from the repository root to the output directory.
// That is all it has to do: the house reads the post from X itself,
// counts it through FxTwitter, and writes post.counts.json to /output.
import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';
mkdirSync(outDir, { recursive: true });

const postPath = join(root, 'POST.json');
const post = JSON.parse(readFileSync(postPath, 'utf8'));
const urlOk = /^https:\/\/(www\.|mobile\.)?(x\.com|twitter\.com)\/.*\/status\/(\d+|POST_AFTER_UPLOAD)/.test(post.url || '');
if (!urlOk) {
  throw new Error('POST.json url must be an x.com/twitter.com status url');
}
copyFileSync(postPath, join(outDir, 'POST.json'));
console.log('copied POST.json -> ' + join(outDir, 'POST.json'));
