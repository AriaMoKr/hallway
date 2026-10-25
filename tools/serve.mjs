// The dev server (common's) on the hallway's port: node tools/serve.mjs [--port 8088] [--host 0.0.0.0]
import { start } from 'common/tools/serve.mjs';
await start(process.argv.slice(2), { port: 8088 });
