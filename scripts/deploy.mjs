#!/usr/bin/env node
// Explicit apply only. Preview this plan and complete the release gates first.
import { spawnSync } from 'node:child_process';
import { loadEnv, readState, root, requireEnv } from './lib.mjs';
loadEnv();
const args=new Set(process.argv.slice(2));
const steps=['Clean lockfile install','Provision resources in explicitly selected account','Worker dry-run','Apply remote migrations (backup/maintenance approval required)','Deploy Worker (fails closed without required secrets)','Install configured Worker secrets','Optional explicit media upload / seed','Read-only public smoke verification'];
console.log(steps.map((s,i)=>`${i+1}. ${s}`).join('\n'));
if(!args.has('--apply')) {console.log('\nPlan only. Use npm run deploy -- --apply after backup, security and release approval. --seed and --upload-media are separate explicit opt-ins.');process.exit(0);}
for(const key of ['CLOUDFLARE_API_TOKEN','CLOUDFLARE_ACCOUNT_ID','ADMIN_TOKEN','ANALYTICS_SALT','SITE_URL'])requireEnv(key);
const site=new URL(process.env.SITE_URL);
if(site.protocol!=='https:'||site.hostname==='localhost'||site.username||site.password)throw new Error('Production SITE_URL must be an approved public HTTPS origin');
if(process.env.ADMIN_TOKEN.length<32||process.env.ANALYTICS_SALT.length<32)throw new Error('Admin token and analytics salt must each be at least 32 characters');
function run(command,argv,cwd=root(),input) {
  const r=spawnSync(command,argv,{cwd,env:process.env,stdio:[input===undefined?'ignore':'pipe','inherit','inherit'],input});
  if(r.error||r.status!==0)throw new Error(`Release stopped: ${command} ${argv[0]??''}; inspect state before retry`);
}
run('npm',['ci']);run('node',['scripts/provision.mjs']);
run('npm',['run','--workspace','@fg/api','dry-run']);
run('node',['scripts/migrate.mjs','--remote']);
run('npx',['wrangler','deploy','--keep-vars'],`${root()}/apps/api`);
for(const name of ['ADMIN_TOKEN','ANALYTICS_SALT','SITE_URL','RESEND_API_KEY','NOTIFY_FROM','NOTIFY_TO','FEED_ALLOWED_HOSTS']) {
  if(process.env[name])run('npx',['wrangler','secret','put',name],`${root()}/apps/api`,process.env[name]);
}
if(args.has('--upload-media'))run('node',['scripts/upload-media.mjs','--remote']);
if(args.has('--seed'))run('node',['scripts/seed.mjs','--remote']);
const url=readState()?.workerUrl;if(!url)throw new Error('Resolve actual Worker URL and run read-only smoke before declaring release ready');
run('node',['scripts/smoke.mjs',url]);
console.log('Backend smoke passed. Frontend/DNS cutover and physical Android verification remain separate gates.');
