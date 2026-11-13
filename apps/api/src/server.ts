import { buildApp } from './app.js';
import { getConfig } from './config.js';

const config = getConfig();
const app = await buildApp({ config });

try {
  await app.listen({ host: config.API_HOST, port: config.API_PORT });
  console.log(`GreenFlow API listening on http://${config.API_HOST}:${config.API_PORT}`);
} catch (error) {
  app.log.error(error);
  process.exit(1);
}

