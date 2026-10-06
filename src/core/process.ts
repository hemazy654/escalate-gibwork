import { spawn } from 'node:child_process';
import { StringDecoder } from 'node:string_decoder';
export async function run(command: string, args: string[], cwd: string, timeout = 15000, limit = 128000, environment: Record<string, string> = {}): Promise<{code:number; output:string; stdout:string; stderr:string}> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, shell:false, env:{ PATH:process.env.PATH, HOME:process.env.HOME, LANG:'C.UTF-8', ...environment }, stdio:['ignore','pipe','pipe'] });
    let output = ''; let stdout = ''; let stderr = ''; let bytes = 0; let exceeded = false;
    const decoders = new Map([[child.stdout, new StringDecoder('utf8')], [child.stderr, new StringDecoder('utf8')]]);
    const timer = setTimeout(() => { exceeded = true; child.kill('SIGKILL'); }, timeout);
    for (const stream of [child.stdout, child.stderr]) stream.on('data', (chunk:Buffer) => {
      bytes += chunk.length;
      if (bytes > limit) { exceeded = true; child.kill('SIGKILL'); } else { const text=decoders.get(stream)!.write(chunk); output += text; if(stream===child.stdout)stdout+=text;else stderr+=text; }
    });
    child.on('error', error => { clearTimeout(timer); reject(error); });
    child.on('close', code => { clearTimeout(timer); const outTail=decoders.get(child.stdout)!.end(); const errTail=decoders.get(child.stderr)!.end(); stdout+=outTail; stderr+=errTail; output+=outTail+errTail; resolve({code:exceeded ? 124 : code ?? 1, output,stdout,stderr}); });
  });
}
