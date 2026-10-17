/* Requires Playwright. Uses an isolated browser profile and a clearly labelled,
   controlled product fixture. No customer account or shop data is used. */
const {chromium}=require('playwright');
const fs=require('fs');const path=require('path');const http=require('http');const assert=require('assert');
const root=path.resolve(__dirname,'..');const scratch=path.resolve(process.env.IMAGEGRAB_TEST_WORK||path.join(root,'test-results'));
const output=path.resolve(process.env.IMAGEGRAB_SCREENSHOTS||path.join(scratch,'screenshots'));
fs.mkdirSync(scratch,{recursive:true});fs.mkdirSync(output,{recursive:true});
const assets=path.join(scratch,'assets');fs.mkdirSync(assets,{recursive:true});
const mime={'.html':'text/html; charset=utf-8','.jpg':'image/jpeg','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.css':'text/css','.js':'text/javascript'};
const errors=[];const result={checks:[],provenance:'Actual extension in isolated Edge, controlled locally served product fixture with original SVG illustrations. Not a live JD merchant page.'};
let context,server;
(async()=>{
 const destination=path.join(scratch,'downloads');fs.mkdirSync(destination,{recursive:true});
 const preferencesPath=path.join(scratch,'edge-profile/Default/Preferences');fs.mkdirSync(path.dirname(preferencesPath),{recursive:true});
 const preferences=fs.existsSync(preferencesPath)?JSON.parse(fs.readFileSync(preferencesPath,'utf8')):{};
 preferences.download={...(preferences.download||{}),default_directory:destination,prompt_for_download:false,directory_upgrade:true};fs.writeFileSync(preferencesPath,JSON.stringify(preferences));
 context=await chromium.launchPersistentContext(path.join(scratch,'edge-profile'),{executablePath:process.env.IMAGEGRAB_BROWSER||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,viewport:{width:1440,height:1000},acceptDownloads:true,args:[`--disable-extensions-except=${path.join(root,'extension')}`,`--load-extension=${path.join(root,'extension')}`,'--no-first-run','--no-proxy-server','--host-resolver-rules=MAP item.jd.com 127.0.0.1']});
 context.on('weberror',e=>errors.push(e.error().message));
 const raster=await context.newPage();await raster.setViewportSize({width:600,height:600});
 for(let i=1;i<=6;i++){
  const svg=fs.readFileSync(path.join(root,`docs/assets/product-${i}.svg`),'utf8');
  await raster.setContent(`<style>html,body{margin:0;width:600px;height:600px;overflow:hidden}</style>${svg}`);
  await raster.screenshot({path:path.join(assets,`product-${i}.png`)});
  await raster.screenshot({path:path.join(assets,`product-${i}.jpg`),type:'jpeg',quality:92});
  const webp=await raster.evaluate(()=>{const c=document.createElement('canvas');c.width=600;c.height=600;const x=c.getContext('2d');return new Promise(resolve=>{const im=new Image();im.onload=()=>{x.drawImage(im,0,0,600,600);resolve(c.toDataURL('image/webp').split(',')[1]);};im.src='data:image/svg+xml;base64,'+btoa(new XMLSerializer().serializeToString(document.querySelector('svg')));});});
  fs.writeFileSync(path.join(assets,`product-${i}.webp`),Buffer.from(webp,'base64'));
 }
 await raster.setViewportSize({width:20,height:20});await raster.setContent('<style>body{margin:0;background:red}</style>');await raster.screenshot({path:path.join(assets,'tiny.png')});await raster.close();
 server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');let file;
  if(url.pathname.startsWith('/assets/'))file=path.join(assets,path.basename(url.pathname));
  else if(url.pathname==='/100012345678.html'||url.pathname==='/')file=path.join(root,'tests/product-fixture.html');
  else if(url.pathname==='/search') {res.setHeader('Content-Type','text/html');res.end('<html><body>Non-product page</body></html>');return;}
  if(!file||!fs.existsSync(file)){res.writeHead(404);res.end('not found');return;}
  res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));
 });await new Promise(resolve=>server.listen(4175,'127.0.0.1',resolve));
 let worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');const id=new URL(worker.url()).host;result.extensionId=id;
 const page=await context.newPage();await page.goto('http://item.jd.com:4175/100012345678.html');
 const extract=page.locator('#imagegrab-root').getByRole('button',{name:'获取图片'});await extract.waitFor();
 await page.screenshot({path:path.join(output,'01-插件-商品页提取按钮.png'),fullPage:false});
 const galleryPromise=context.waitForEvent('page');await extract.click();const gallery=await galleryPromise;await gallery.waitForLoadState();
 await gallery.locator('.card').first().waitFor();assert.equal(await gallery.locator('.card').count(),6,'deduplication and size filtering');result.checks.push('img + data-src + background extraction, duplicate removal, 20px icon filtered: 6 unique images');
 await gallery.getByRole('button',{name:'全选',exact:true}).click();assert.equal(await gallery.locator('.card.selected').count(),6);
 await gallery.getByRole('button',{name:'反选',exact:true}).click();assert.equal(await gallery.locator('.card.selected').count(),0);
 await gallery.locator('.card input').nth(0).check();await gallery.locator('.card input').nth(2).check();
 await gallery.locator('#only-selected').check();assert.equal(await gallery.locator('.card').count(),2);await gallery.locator('#only-selected').uncheck();
 await gallery.locator('#min-size').selectOption('600');assert.equal(await gallery.locator('.card').count(),6);await gallery.locator('#min-size').selectOption('100');
 result.checks.push('select all, invert, individual selection, only-selected and 600px size filter');
 await gallery.locator('.card input').nth(1).check();await gallery.locator('.card input').nth(3).check();
 await gallery.screenshot({path:path.join(output,'02-插件-图片工作台.png'),fullPage:true});
 await worker.evaluate(async()=>{await chrome.downloads.setShelfEnabled(false);});
 const saved=[];const downloadErrors=[];
 // Restore normal browser handling: Playwright's default allowAndName mode
 // replaces extension-provided filenames with GUIDs, which hides naming bugs.
 const cdp=await context.newCDPSession(gallery);await cdp.send('Browser.setDownloadBehavior',{behavior:'default'});
 const startedAt=Date.now();
 await gallery.getByRole('button',{name:'下载选中'}).click();
 await gallery.locator('#status').filter({hasText:/下载完成/}).waitFor({timeout:120000});
 assert.match(await gallery.locator('#status').innerText(),/成功 4 张，失败 0 张/);
 const records=await worker.evaluate(async()=>chrome.downloads.search({state:'complete',orderBy:['-startTime'],limit:4}));
 assert(records.every(r=>Date.parse(r.startTime)>=startedAt-1000));
 for(const record of records){assert(fs.existsSync(record.filename),'downloaded file exists: '+record.filename);saved.push(record.filename);}
 assert.equal(saved.length,4);assert.equal(new Set(saved).size,4,'4 separate files');for(const file of saved){assert.match(path.basename(file),/商品图_\d{3}.*\.png$/);const data=fs.readFileSync(file);assert.equal(data.subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert.equal(data.readUInt32BE(16),600);assert.equal(data.readUInt32BE(20),600);}
 result.checks.push('4 browser downloads completed from mixed JPG/WebP/PNG sources; PNG signatures and 600×600 IHDR verified');result.downloads=saved.map(f=>path.basename(f));
 await gallery.screenshot({path:path.join(output,'03-插件-PNG下载完成.png'),fullPage:true});
 // Explicit failure path: missing image must not be reported as success.
 const failure=await gallery.evaluate(()=>chrome.runtime.sendMessage({type:'DOWNLOAD_IMAGE',url:'http://item.jd.com:4175/assets/missing.jpg',index:99}));assert.equal(failure.ok,false);assert.match(failure.error,/404/);result.checks.push('HTTP 404 correctly returned as a failed download');
 await page.goto('http://item.jd.com:4175/search');assert.equal(await page.locator('#imagegrab-root').count(),0);result.checks.push('no floating button on a non-product page');
 const extensionPage=await context.newPage();await extensionPage.goto('edge://extensions/');await extensionPage.waitForTimeout(1200);await extensionPage.screenshot({path:path.join(output,'04-插件-浏览器加载证明.png'),fullPage:false});
 const web=await context.newPage();await web.goto('http://127.0.0.1:4173/');await web.screenshot({path:path.join(output,'work-local-site.png'),fullPage:true});
 for(const width of [320,768,1440]){await web.setViewportSize({width,height:900});await web.reload();const noOverflow=await web.evaluate(()=>document.documentElement.scrollWidth<=innerWidth);assert(noOverflow,'horizontal overflow at '+width);}
 await web.setViewportSize({width:390,height:844});await web.reload();await web.getByRole('button',{name:'展开导航'}).click();await web.locator('#nav-links a[href="#install"]').click();assert.equal(await web.getByRole('button',{name:'展开导航'}).getAttribute('aria-expanded'),'false');result.checks.push('website 320/768/1440px layout and mobile navigation');
 const local=await context.newPage();await local.goto('file:///'+path.join(root,'docs/index.html').replaceAll('\\','/'));assert.equal(await local.locator('h1').count(),1);result.checks.push('static website opens from file:// without a build or CDN');
 result.errors=errors;result.downloadErrors=downloadErrors;assert.equal(errors.length,0);assert.equal(downloadErrors.length,0);result.ok=true;
 fs.writeFileSync(path.join(scratch,'browser-result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
})().catch(e=>{result.ok=false;result.error=e.stack;fs.writeFileSync(path.join(scratch,'browser-result.json'),JSON.stringify(result,null,2));console.error(e);process.exitCode=1;}).finally(async()=>{await context?.close();if(server)await new Promise(resolve=>server.close(resolve));});
