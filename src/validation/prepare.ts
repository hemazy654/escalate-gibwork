/** Explicit image preparation; validation itself never pulls or builds images. */
import { cp, mkdtemp, readFile, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { run } from '../core/process.js';
import { redact } from '../core/redact.js';
const project = fileURLToPath(new URL('../../', import.meta.url));
async function main() {
  const context = await mkdtemp(join(tmpdir(), 'escalate-image-'));
  async function docker(args: string[], timeout=60000) {
    const result = await run('docker', args, project, timeout, 256000);
    if (result.code) throw new Error(`Docker preparation failed: ${result.output}`);
    return result.stdout.trim();
  }
  try {
    await docker(['info', '--format', '{{.OSType}}']);
    const digest = await docker(['image', 'inspect', 'node:22-bookworm', '--format', '{{index .RepoDigests 0}}']);
    if (!/^node@sha256:[a-f0-9]{64}$/.test(digest)) throw new Error('Pull the official node:22-bookworm image first; a registry digest is required');
    for (const [source, target] of [['typescript','typescript'],['@types/node','node-types'],['undici-types','undici-types']]) {
      await cp(resolve(project,'node_modules',source!),join(context,target!),{recursive:true});
    }
    const iidfile = join(context,'image-id');
    await docker(['build','--network=none','--pull=false','--tag','escalate-validation:milestone3','--iidfile',iidfile,'--build-arg',`BASE_IMAGE=${digest}`,'--file',resolve(project,'docker/validation.Dockerfile'),context]);
    const image = (await readFile(iidfile,'utf8')).trim();
    if (!/^sha256:[a-f0-9]{64}$/.test(image)) throw new Error('Docker did not return an immutable local image ID');
    const directory = resolve(project,'.escalate');
    await mkdir(directory,{recursive:true,mode:0o700});
    await writeFile(join(directory,'docker-image.json'),JSON.stringify({image,baseImage:digest},null,2)+'\n',{mode:0o600});
    console.log(JSON.stringify({image,baseImage:digest,validationNetwork:'none',metadata:join(directory,'docker-image.json')},null,2));
  } finally {await rm(context,{recursive:true,force:true});}
}
main().catch((error: unknown)=>{console.error(redact(error instanceof Error?error.message:'Image preparation failed'));process.exitCode=1;});
