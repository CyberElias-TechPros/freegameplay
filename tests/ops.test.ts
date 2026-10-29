import test from 'node:test';
import assert from 'node:assert/strict';
import { applyEnvText } from '../scripts/lib.mjs';
test('dotenv preserves quoted sender values, existing secrets and literal shell syntax',()=>{
 const env:Record<string,string>={ADMIN_TOKEN:'existing-value'};
 applyEnvText('NOTIFY_FROM="FreeGameplay <hello@example.com>"\r\nADMIN_TOKEN=replacement\nSITE_URL=https://site.example # comment\nLITERAL="$(echo do-not-execute); value"\n',env);
 assert.equal(env.NOTIFY_FROM,'FreeGameplay <hello@example.com>');assert.equal(env.ADMIN_TOKEN,'existing-value');assert.equal(env.SITE_URL,'https://site.example');assert.equal(env.LITERAL,'$(echo do-not-execute); value');
});
