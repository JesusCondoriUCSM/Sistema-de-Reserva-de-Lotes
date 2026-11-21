import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createConnection } from 'node:net';
import { randomBytes } from 'node:crypto';
const root = fileURLToPath(new URL('../', import.meta.url));
const runtime = process.env.APP_RUNTIME || join(root, '.runtime');
mkdirSync(runtime, { recursive: true });
const php = process.env.PHP_BIN || (existsSync('C:/xampp/php/php.exe') ? 'C:/xampp/php/php.exe' : 'php');
const managed = process.env.APP_MANAGED_DATABASE === '1';
const pgBin = process.env.PG_BIN || ['D:/PostgreSQL/bin', 'C:/Program Files/PostgreSQL/15/bin'].find(p => existsSync(join(p, 'initdb.exe')));
const exe = name => pgBin ? join(pgBin, name + (process.platform === 'win32' ? '.exe' : '')) : name;
function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8', windowsHide: true, timeout: 20000, ...options });
  if (result.error || result.status !== 0) throw new Error(`${command}: ${result.error?.message || result.stderr || result.stdout}`);
  return result.stdout;
}
try {
  run(php, ['-d', 'extension=pdo_pgsql', '-r', 'if (!in_array("pgsql", PDO::getAvailableDrivers())) exit(1);']);
  const configFile = join(runtime, 'database.ini');
  if (!existsSync(configFile)) writeFileSync(configFile, managed ? `port=${process.env.PG_PORT || 55432}\ndatabase=villa_horizonte\nuser=villa_local\npassword=${randomBytes(24).toString('hex')}\n` : 'port=5434\ndatabase=proyecto_villa_horizonte\nuser=postgres\npassword=\n', { mode: 0o600 });
  const config = Object.fromEntries(readFileSync(configFile, 'utf8').trim().split(/\r?\n/).map(line => line.split('=')));
  const data = join(runtime, 'postgres');
  const env = { ...process.env, PGPASSWORD: config.password, PGCLIENTENCODING: 'UTF8' };
  let postgres;
  // La instalacion SQL solo corresponde a instancias aisladas de pruebas.
  if (managed) {
    if (!existsSync(join(data, 'PG_VERSION'))) {
      const passwordFile = join(runtime, 'init-password');
      writeFileSync(passwordFile, config.password, { mode: 0o600 });
      run(exe('initdb'), ['-D', data, '-U', config.user, '--pwfile', passwordFile, '--auth=scram-sha-256', '--encoding=UTF8', '--locale=C']);
      unlinkSync(passwordFile);
    }
    const online = () => new Promise(resolve => {
      const socket = createConnection({host:'127.0.0.1', port:Number(config.port)});
      socket.setTimeout(500);
      socket.once('connect', () => { socket.destroy(); resolve(true); });
      socket.once('error', () => resolve(false));
      socket.once('timeout', () => { socket.destroy(); resolve(false); });
    });
    if (!(await online())) {
      postgres = spawn(exe('postgres'), ['-D', data, '-h','127.0.0.1','-p',config.port], {windowsHide:true, stdio:['ignore','ignore','inherit']});
      let failure;
      postgres.on('error', error => { failure = error; });
      for (let attempt=0; ; attempt++) {
        const ready = spawnSync(exe('pg_isready'), ['-h','127.0.0.1','-p',config.port], {windowsHide:true, timeout:2000});
        if (ready.status === 0) break;
        if (failure) throw failure;
        if (attempt > 100 || postgres.exitCode !== null) throw new Error('No se pudo iniciar PostgreSQL.');
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    const connection = ['-h','127.0.0.1','-p',config.port,'-U',config.user];
    if (!run(exe('psql'), [...connection,'-d','postgres','-tAc', "SELECT 1 FROM pg_database WHERE datname='villa_horizonte'"], { env }).trim()) run(exe('createdb'), [...connection, config.database], { env });
    const sql = (args, options = {}) => run(exe('psql'), [...connection,'-d',config.database,'-v','ON_ERROR_STOP=1',...args], { env, ...options });
    if (sql(['-tAc', "SELECT to_regclass('public.cliente') IS NOT NULL"]).trim() !== 't') {
      const schema = readFileSync(join(root, 'backend/schema.sql'), 'utf8').replace(/^BEGIN;|COMMIT;/gm, '');
      const routines = readFileSync(join(root, 'backend/routines.sql'), 'utf8').replace(/^BEGIN;|COMMIT;/gm, '');
      const seed = process.env.APP_SEED_DEMO === '1' ? readFileSync(process.env.APP_TEST_SEED_FILE || join(root, '.docker/seed-demo.sql'), 'utf8') : '';
      sql([], { input: `BEGIN;\n${schema}\n${seed}\n${routines}\nCOMMIT;` });
      console.log('Base local creada. Registra catalogos, proyectos, clientes, asesores y lotes desde el sistema.');
    }
  }
  const port = Number(process.env.PORT || 5173);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT no valido.');
  const server = spawn(php, ['-d','extension=pdo_pgsql','-d','display_errors=0','-S',`127.0.0.1:${port}`,'-t',resolve(root,'frontend'),resolve(root,'backend/router.php')], { cwd: root, stdio: 'inherit', windowsHide: true });
  server.on('error', error => { console.error(error.message); process.exitCode = 1; });
  server.on('exit', code => { if (postgres) spawnSync(exe('pg_ctl'), ['-D',data,'-m','fast','-w','stop'], {windowsHide:true, stdio:'ignore', timeout:10000}); process.exitCode = code ?? 0; });
  for (const signal of ['SIGINT','SIGTERM']) process.on(signal, () => server.kill());
  console.log(`Villa Horizonte: http://127.0.0.1:${port}`);
} catch (error) { console.error(error.message); process.exitCode = 1; process.exit(1); }
