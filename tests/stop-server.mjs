import { spawnSync } from 'node:child_process';

export function stopServer(server) {
  if (!server) return;
  if (server.exitCode === null && !server.killed) {
    if (process.platform === 'win32') {
      spawnSync('taskkill.exe',['/PID',String(server.pid),'/T','/F'],{windowsHide:true,timeout:10000,stdio:'ignore'});
    } else server.kill();
  }
  server.stdout?.destroy();
  server.stderr?.destroy();
  server.unref();
}
