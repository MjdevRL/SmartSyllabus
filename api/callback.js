import { handle } from '../lib/oauth.js';
export default { fetch: (req) => handle(req, process.env) };
