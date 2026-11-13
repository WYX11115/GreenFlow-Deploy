import { z } from 'zod';

const configSchema = z.object({
  ANVIL_RPC_URL: z.url().default('http://127.0.0.1:8545'),
  ANVIL_CHAIN_ID: z.coerce.number().int().positive().default(31_337),
  API_HOST: z.literal('127.0.0.1').default('127.0.0.1'),
  API_PORT: z.coerce.number().int().min(1).max(65_535).default(3001),
  WEB_ORIGIN: z.url().default('http://127.0.0.1:5173')
});

export type ApiConfig = z.infer<typeof configSchema>;

export function getConfig(environment: NodeJS.ProcessEnv = process.env): ApiConfig {
  return configSchema.parse(environment);
}

