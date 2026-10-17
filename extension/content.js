(() => {
  if (globalThis.__imageGrabLoaded) return;
  globalThis.__imageGrabLoaded = true;
  const MIN_SIZE = 100;
  const isDetail = () => {
    const { hostname: host, pathname: path, search } = location;
    if (/(^|\.)jd\.com$/.test(host)) return /\/\d+\.html|\/product\/|\/ware\//i.test(path) || /[?&](wareId|sku)=/i.test(search);
    if (/(^|\.)(taobao|tmall)\.com$/.test(host)) return /\/item\.htm|\/item\/|\/detail\.htm/i.test(path) && /[?&]id=\d+/.test(search);
    if (/(^|\.)(pinduoduo|yangkeduo)\.com$/.test(host)) return /goods|product/i.test(path) && (/\d/.test(path + search) || /[?&]goods_id=/.test(search));
    return false;
  };
  const normalize = value => {
    if (!value || /^(data:|blob:|javascript:)/i.test(value.trim())) return null;
    try { const url = new URL(value.trim(), location.href); if (!/^https?:$/.test(url.protocol)) return null; url.hash = ''; return url.href; } catch { return null; }
  };
  const sizeOf = url => new Promise(resolve => {
    const image = new Image();
    const timer = setTimeout(() => { image.src = ''; resolve(null); }, 5000);
    image.onload = () => { clearTimeout(timer); resolve({width:image.naturalWidth,height:image.naturalHeight}); };
    image.onerror = () => { clearTimeout(timer); resolve(null); };
    image.src = url;
  });
  async function extract() {
    const found = new Map();
    const add = (value, source, dimensions) => {
      const url = normalize(value);
      if (!url || /(?:^|[\/_-])(logo|icon|sprite|spacer|placeholder|loading|pixel)(?:[\/_\-.?]|$)/i.test(url)) return;
      if (!found.has(url)) found.set(url, {url,source, ...dimensions});
    };
    // Scan loaded and lazy images; srcset may contain commas inside a URL.
    for (const image of document.images) {
      const dim = image.complete && image.naturalWidth ? {width:image.naturalWidth,height:image.naturalHeight} : {};
      add(image.currentSrc || image.src, 'img', dim);
      for (const attr of ['data-src','data-lazy-src','data-original','data-ks-lazyload','data-url']) add(image.getAttribute(attr), attr);
      for (const attr of ['srcset','data-srcset']) for (const part of (image.getAttribute(attr) || '').split(/,\s*(?=(?:https?:)?\/)/)) add(part.trim().replace(/\s+\d+(?:\.\d+)?[wx]$/, ''), attr);
    }
    for (const source of document.querySelectorAll('picture source')) for (const part of (source.srcset || '').split(/,\s*(?=(?:https?:)?\/)/)) add(part.trim().replace(/\s+\d+(?:\.\d+)?[wx]$/, ''), 'picture');
    for (const element of document.querySelectorAll('body *')) {
      if (element.closest('#imagegrab-root')) continue;
      for (const match of getComputedStyle(element).backgroundImage.matchAll(/url\(["']?(.*?)["']?\)/g)) add(match[1], 'background');
    }
    const candidates = [...found.values()];
    let cursor = 0; const images = [];
    // A bounded pool avoids hundreds of simultaneous network requests.
    await Promise.all(Array.from({length:Math.min(10,candidates.length)}, async () => {
      while (cursor < candidates.length) {
        const item = candidates[cursor++];
        const size = item.width ? item : await sizeOf(item.url);
        if (size && size.width >= MIN_SIZE && size.height >= MIN_SIZE) images.push({...item,width:size.width,height:size.height});
      }
    }));
    images.sort((a,b) => b.width*b.height - a.width*a.height);
    if (!images.length) throw new Error('没有找到 ≥100 × 100 的图片。请先向下滚动加载商品详情，再重新提取。');
    return chrome.runtime.sendMessage({type:'OPEN_GALLERY', payload:{title:document.title,url:location.href,images,createdAt:Date.now()}});
  }
  let button;
  let busy = false;
  async function run() {
    if (busy) return {ok:false,error:'正在提取，请稍候'};
    if (!isDetail()) return {ok:false,error:'请在淘宝、天猫、京东或拼多多商品详情页使用。'};
    busy = true; if(button) button.textContent = '正在提取…';
    try { return await extract(); }
    catch(error) { if(button) button.textContent = error.message; return {ok:false,error:error.message}; }
    finally { busy=false; if(button) setTimeout(() => {button.textContent='↓ 获取图片';},2500); }
  }
  function mount() {
    const existing=document.getElementById('imagegrab-root');
    if (!isDetail()) {existing?.remove();button=null;return;}
    if(existing) return;
    const host=document.createElement('div');host.id='imagegrab-root';
    // Shadow DOM isolates the floating control from the shop's CSS.
    const root=host.attachShadow({mode:'open'});
    const link=document.createElement('link');link.rel='stylesheet';link.href=chrome.runtime.getURL('content.css');
    // Inline style is used as a fallback because the stylesheet is extension-local.
    const style=document.createElement('style');style.textContent='button{all:initial;position:fixed;right:28px;bottom:28px;z-index:2147483647;max-width:340px;background:#275d49;color:#fff;font:600 15px/1.6 "Microsoft YaHei",sans-serif;padding:15px 24px;border:1px solid #ffffff55;border-radius:16px;box-shadow:0 8px 28px #163a3d40;cursor:pointer;transition:transform .2s}button:hover{transform:translateY(-3px);background:#1b4938}button:focus-visible{outline:3px solid #f7b55b;outline-offset:4px}';
    button=document.createElement('button');button.textContent='↓ 获取图片';button.addEventListener('click',run);
    root.append(style,button);document.documentElement.append(host);
  }
  chrome.runtime.onMessage.addListener((message,sender,respond) => {
    if(message.type==='EXTRACT_IMAGES'){run().then(respond);return true;}
  });
  mount();
  // Merchant dashboards often navigate without a full page reload.
  let last=location.href;setInterval(()=>{if(location.href!==last){last=location.href;mount();}},1000);
})();
