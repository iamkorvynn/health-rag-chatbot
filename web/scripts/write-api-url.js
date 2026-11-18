// Writes web/public/api-url.json from the live tunnel URL at build time,
// so the deployed site serves the current backend address at /api-url.json
// and the APK can resolve the server itself (see flutter-app/lib/url_resolver.dart).
// Runs automatically before `next build` via the "prebuild" script.
// The tunnel URL rotates on reconnect; the keep-alive rebuilds/redeploys
// the site on rotation, which re-runs this script.
const fs = require('fs');
const path = require('path');

const URL_FILE = '/home/hatch/workspace/health-rag/tunnel-url.txt';
const OUT_FILE = path.join(__dirname, '..', 'public', 'api-url.json');

const url = fs.readFileSync(URL_FILE, 'utf8').trim();
if (!/^https:\/\/[a-z0-9]+\.app\.lhr\.life$/.test(url)) {
  throw new Error(`Unexpected tunnel URL in ${URL_FILE}: ${url}`);
}
fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
fs.writeFileSync(OUT_FILE, JSON.stringify({ url }) + '\n');
console.log(`api-url.json: ${url}`);
