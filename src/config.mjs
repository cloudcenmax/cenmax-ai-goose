import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {BASE_URL, CenmaxError} from './oauth.mjs';

export function providerConfig(models, {node = process.execPath, cli = fileURLToPath(new URL('./cli.mjs', import.meta.url))} = {}) {
  if (!models.length || !path.isAbsolute(node) || !path.isAbsolute(cli)) throw new CenmaxError('Sign in and discover available Cenmax AI models before configuring Goose.');
  return {
    name: 'cenmax_ai', engine: 'openai', display_name: 'Cenmax AI',
    description: 'Use the models and allowance available to your Cenmax AI account.',
    base_url: `${BASE_URL}/chat/completions`, requires_auth: true, supports_streaming: true,
    auth: {command: node, args: [cli, 'credential'], refresh_interval: 300, timeout_seconds: 45},
    models: models.map(model => ({name: model.id, context_limit: model.contextWindow})),
  };
}
