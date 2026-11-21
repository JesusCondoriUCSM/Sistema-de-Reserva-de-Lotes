import { createServer } from 'node:net';

export function freePort() {
  return new Promise((resolve,reject)=>{
    const server=createServer();
    server.once('error',reject);
    server.listen(0,'127.0.0.1',()=>{
      const port=server.address().port;
      server.close(error=>error?reject(error):resolve(port));
    });
  });
}
