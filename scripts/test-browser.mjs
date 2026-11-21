import { spawn } from 'node:child_process';
const runner = spawn(process.execPath, ['--test', 'tests/api.integration.mjs'], {env:{...process.env,BROWSER_TEST:'1'},stdio:'inherit',windowsHide:true});
runner.on('error',error=>{console.error(error.message);process.exitCode=1;});
runner.on('exit',code=>{process.exitCode=code??1;});
