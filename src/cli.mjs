#!/usr/bin/env node
import {createOAuth, CenmaxError} from './oauth.mjs';
import {TokenStore} from './storage.mjs';
import {providerConfig} from './config.mjs';

const [command, ...args] = process.argv.slice(2);
try {
  if (args.length || !['login', 'credential', 'models', 'config', 'logout'].includes(command)) throw new CenmaxError('Usage: cenmax-goose <login|credential|models|config|logout>');
  const oauth = createOAuth(); const store = new TokenStore(oauth);
  if (command === 'login') {
    await store.login(({url, code}) => { console.error(`Sign in with Cenmax AI: ${url}\nConfirm code: ${code}`); });
    console.error('Cenmax AI connected.');
  } else if (command === 'credential') {
    // Only Goose's command-auth protocol should consume this stdout value.
    process.stdout.write(`${await store.token()}\n`);
  } else if (command === 'logout') {
    await store.logout(); console.error('Cenmax AI disconnected.');
  } else {
    const models = await oauth.models(await store.token());
    if (command === 'config') console.log(JSON.stringify(providerConfig(models), null, 2));
    else for (const model of models) console.log(`${model.id}\t${model.name}`);
  }
} catch (error) {
  console.error(error instanceof CenmaxError ? error.message : 'Cenmax AI operation failed. Sign in again or retry.');
  process.exitCode = 1;
}
