// Registry-delivered Chromium for restricted runners. No browser binary is committed.
import chromium from '@sparticuz/chromium';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
const require=createRequire(import.meta.url);
export async function browserRuntime() {
  const executablePath=process.env.PLAYWRIGHT_CHROMIUM_PATH || await chromium.executablePath();
  let env={...process.env};
  if(process.platform==='linux' && !process.env.PLAYWRIGHT_CHROMIUM_PATH) {
    const base=path.join(os.tmpdir(),'fg-browser-runtime');
    fs.mkdirSync(base,{recursive:true});
    const archive=path.resolve(path.dirname(require.resolve('@sparticuz/chromium')),'../bin/al2023.tar.br');
    if(!fs.existsSync(path.join(base,'lib/libnspr4.so'))) {
      const tar=path.join(base,'libs.tar');
      fs.writeFileSync(tar,zlib.brotliDecompressSync(fs.readFileSync(archive)));
      execFileSync('tar',['-xf',tar,'-C',base]);fs.unlinkSync(tar);
    }
    env.LD_LIBRARY_PATH=[path.join(base,'lib'),env.LD_LIBRARY_PATH].filter(Boolean).join(':');
  }
  return {executablePath,env,args:chromium.args.filter(a=>!['--disable-web-security','--allow-running-insecure-content','--disable-site-isolation-trials','--single-process'].includes(a))};
}
