import { build } from 'esbuild'
import { mkdtemp, writeFile, readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const real = process.argv.includes('--real')
const temp = await mkdtemp(join(root, '.browser-perf-'))
await build({ absWorkingDir: root, entryPoints: [real ? 'tests/browser/reader-real.fixture.tsx' : 'tests/browser/reader-perf.fixture.tsx'], outfile: join(temp, 'fixture.js'), bundle: true, platform: 'browser', format: 'iife', define: { 'process.env.NODE_ENV': '"production"' } })
if (real) {
  const pdfPath = process.env.PAPER_COACH_REAL_PDF || join(root, 'tests/fixtures/sample-paper.pdf')
  const pdf = await readFile(pdfPath)
  const worker = await readFile(join(root, 'node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs'), 'utf8')
  await writeFile(join(temp, 'payload.js'), 'window.__PDF_DATA__=' + JSON.stringify(pdf.toString('base64')) + ';window.__PDF_WORKER__=' + JSON.stringify(worker) + ';')
}
await writeFile(join(temp, 'index.html'), '<!doctype html><html><head><meta charset="utf-8"></head><body><div id="root"></div><script>window.__errors=[];window.onerror=(...a)=>window.__errors.push(String(a[0]));window.onunhandledrejection=e=>window.__errors.push(String(e.reason));</script>' + (real ? '<script src="payload.js"></script>' : '') + '<script src="fixture.js"></script></body></html>')
const defaultBrowsers = [
  process.env.BROWSER_EXE,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
].filter(Boolean)
const browser = defaultBrowsers.find(p => existsSync(p)) || 'google-chrome'
const child = spawn(browser, ['--headless=new', '--allow-file-access-from-files', '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--remote-debugging-port=0', '--remote-debugging-address=127.0.0.1', '--user-data-dir=' + join(temp, 'profile'), '--window-size=1300,900', 'about:blank'], { stdio: 'ignore' })
let socket; let nextId=0; const pending=new Map();
const sleep=ms=>new Promise(r=>setTimeout(r,ms))
const timeout=setTimeout(()=>{child.kill();process.exit(2)},60000)
try {
  let port; for(let n=0;n<100;n++){try{port=Number((await readFile(join(temp,'profile','DevToolsActivePort'),'utf8')).split('\n')[0]);break}catch{await sleep(100)}}
  if(!port)throw new Error('Browser debugging endpoint did not start')
  const targets=await (await fetch('http://127.0.0.1:'+port+'/json/list')).json()
  socket=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl)
  await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject})
  socket.onmessage=ev=>{const m=JSON.parse(ev.data);const p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result)}}
  const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++nextId;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}))})
  if(process.argv.includes('--dpr2')) await send('Emulation.setDeviceMetricsOverride',{width:1300,height:900,deviceScaleFactor:2,mobile:false})
  await send('Page.navigate',{url:pathToFileURL(join(temp,'index.html')).href})
  let ready;for(let n=0;n<100;n++){ready=await send('Runtime.evaluate',{expression:'typeof window.__results !== "undefined"',returnByValue:true});if(ready.result.value)break;await sleep(50)}
  if(!ready.result.value)throw new Error('Fixture did not initialize')
  const report=await send('Runtime.evaluate',{expression:'window.__results',awaitPromise:true,returnByValue:true})
  if(report.exceptionDetails)throw new Error(JSON.stringify(report.exceptionDetails))
  const result=report.result.value
  await writeFile(join(temp,'results.json'),JSON.stringify(result,null,2))
  const shot=await send('Page.captureScreenshot',{format:'png'})
  await writeFile(join(temp,'screenshot.png'),Buffer.from(shot.data,'base64'))
  console.log(JSON.stringify({artifact:join(temp,'results.json'),screenshot:join(temp,'screenshot.png'),...result},null,2))
  process.exitCode=result.error||result.errors?.length||result.results.some(t=>!t.pass)?1:0
  await send('Browser.close').catch(()=>{})
} finally {clearTimeout(timeout);socket?.close();child.kill()}
