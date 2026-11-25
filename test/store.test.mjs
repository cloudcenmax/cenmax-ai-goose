import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {TokenStore} from '../src/storage.mjs';
import {providerConfig} from '../src/config.mjs';
import {BASE_URL} from '../src/oauth.mjs';

async function temporary() { return fs.mkdtemp(path.join(await fs.realpath(os.tmpdir()), 'cenmax-goose-store-')); }
test('cross-instance refresh uses one exchange and stores replacements privately', async () => {
  const root = await temporary(); let calls = 0;
  const oauth = {refresh: async () => {calls++; return {access: 'replacement', refresh: 'next', expires: Date.now() + 3600000};}};
  try {
    const first = new TokenStore(oauth, root); const second = new TokenStore(oauth, root);
    await first.locked(() => first.write({access: 'old', refresh: 'refresh', expires: 0}));
    assert.deepEqual(await Promise.all([first.token(), second.token()]), ['replacement', 'replacement']); assert.equal(calls, 1);
    assert.equal((await fs.stat(first.file)).mode & 0o777, 0o600);
  } finally {await fs.rm(root, {recursive: true, force: true});}
});
test('command authentication refreshes before its cached credential can expire', async () => {
  const root = await temporary(); let calls = 0;
  try {
    const store = new TokenStore({refresh: async () => {calls++; return {access: 'replacement', refresh: 'next', expires: Date.now() + 3600000};}}, root);
    const interval = providerConfig([{id: 'worker', contextWindow: 10000}]).auth.refresh_interval * 1000;
    await store.locked(() => store.write({access: 'near-expiry', refresh: 'refresh', expires: Date.now() + interval - 1000}));
    assert.equal(await store.token(), 'replacement'); assert.equal(calls, 1);
    assert.equal(await store.token(), 'replacement'); assert.equal(calls, 1);
  } finally {await fs.rm(root, {recursive: true, force: true});}
});
test('uncertain refresh deletes local session and cannot replay', async () => {
  const root = await temporary(); let calls = 0;
  try {
    const store = new TokenStore({refresh: async () => {calls++; throw new Error('synthetic-private-error');}}, root);
    await store.locked(() => store.write({access: 'old', refresh: 'refresh', expires: 0}));
    await assert.rejects(store.token(), /renewed/); await assert.rejects(store.token(), /Sign in/); assert.equal(calls, 1);
  } finally {await fs.rm(root, {recursive: true, force: true});}
});
test('tokens are not removed when remote logout fails', async () => {
  const root = await temporary();
  try {
    const store = new TokenStore({revoke: async () => {throw new Error('connection failed');}}, root);
    await store.locked(() => store.write({access: 'a', refresh: 'r', expires: 1}));
    await assert.rejects(store.logout()); assert.equal((await store.read()).access, 'a');
  } finally {await fs.rm(root, {recursive: true, force: true});}
});
test('credential files refuse symlinks, hardlinks, and permissive modes', async () => {
  const root = await temporary();
  try {
    const store = new TokenStore({}, root); const target = path.join(root, 'target');
    await fs.writeFile(target, JSON.stringify({access: 'a', refresh: 'r', expires: 1}), {mode: 0o600});
    await fs.symlink(target, store.file); await assert.rejects(store.read()); await fs.unlink(store.file);
    await fs.link(target, store.file); await assert.rejects(store.read()); await fs.unlink(store.file);
    await fs.writeFile(store.file, JSON.stringify({access: 'a', refresh: 'r', expires: 1}), {mode: 0o644}); await assert.rejects(store.read());
  } finally {await fs.rm(root, {recursive: true, force: true});}
});
test('Goose config uses command-auth argv, public catalogue and no credential values', () => {
  const models = [{id: 'pro', name: 'Pro by Cenmax AI', contextWindow: 10000}];
  const config = providerConfig(models, {node: '/test/node', cli: '/test/cenmax-goose.mjs'});
  assert.equal(config.base_url, `${BASE_URL}/chat/completions`);
  assert.deepEqual(config.auth, {command: '/test/node', args: ['/test/cenmax-goose.mjs', 'credential'], refresh_interval: 300, timeout_seconds: 45});
  assert.deepEqual(config.models, [{name: 'pro', context_limit: 10000}]); assert.equal(config.api_key_env, undefined);
  assert.equal(config.display_name, 'Cenmax AI'); assert.ok(!JSON.stringify(config).includes('access_token'));
  assert.throws(() => providerConfig([], {node: '/test/node', cli: '/test/helper'}));
  assert.throws(() => providerConfig(models, {node: 'node', cli: '/test/helper'}));
});
