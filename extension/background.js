const IMAGE_HOSTS = ['taobao.com','tmall.com','jd.com','pinduoduo.com','yangkeduo.com','alicdn.com','360buyimg.com','jdimg.com','pddpic.com','pinduoduoimg.com','pddcdn.com'];
function allowed(url) {
  const parsed=new URL(url);
  return ['https:','http:'].includes(parsed.protocol) && IMAGE_HOSTS.some(host=>parsed.hostname===host||parsed.hostname.endsWith('.'+host));
}
async function openGallery(payload) {
  if(!payload || !Array.isArray(payload.images)) throw new Error('图片数据无效');
  const key='session_'+crypto.randomUUID();
  // Keep recent galleries without filling chrome.storage.local indefinitely.
  const all=await chrome.storage.local.get(null);
  const expired=Object.keys(all).filter(k=>k.startsWith('session_') && Date.now()-(all[k].createdAt||0)>86400000);
  if(expired.length) await chrome.storage.local.remove(expired);
  await chrome.storage.local.set({[key]:{...payload,images:payload.images.filter(i=>allowed(i.url))}});
  await chrome.tabs.create({url:chrome.runtime.getURL('gallery.html')+'?session='+key});
  return {ok:true};
}
function waitForDownload(id) {
  return new Promise((resolve,reject)=>{
    let finished=false;
    const finish=(error)=>{if(finished)return;finished=true;clearTimeout(timer);chrome.downloads.onChanged.removeListener(listener);error?reject(new Error(error)):resolve();};
    const listener=delta=>{if(delta.id!==id)return;if(delta.state?.current==='complete')finish();else if(delta.state?.current==='interrupted')finish(delta.error?.current||'文件保存被取消');};
    const timer=setTimeout(()=>finish('保存超时，请检查浏览器下载列表'),90000);
    chrome.downloads.onChanged.addListener(listener);
    chrome.downloads.search({id}).then(items=>{if(items[0]?.state==='complete')finish();else if(items[0]?.state==='interrupted')finish(items[0].error||'保存失败');});
  });
}
async function downloadImage(message) {
  if(!allowed(message.url)) throw new Error('图片域名不在支持范围内');
  const response=await fetch(message.url,{credentials:'omit',signal:AbortSignal.timeout(25000)});
  if(!response.ok) throw new Error('图片请求失败：HTTP '+response.status);
  const blob=await response.blob();
  if(blob.size>32*1024*1024)throw new Error('图片超过 32 MB，请单独保存');
  const bitmap=await createImageBitmap(blob);
  try {
    if(bitmap.width*bitmap.height>50_000_000)throw new Error('图片尺寸过大，请单独保存');
    const canvas=new OffscreenCanvas(bitmap.width,bitmap.height);
    canvas.getContext('2d').drawImage(bitmap,0,0);
    const png=await canvas.convertToBlob({type:'image/png'});
    const bytes=new Uint8Array(await png.arrayBuffer());
    let binary='';for(let i=0;i<bytes.length;i+=16384)binary+=String.fromCharCode(...bytes.subarray(i,i+16384));
    const filename='图采集/商品图_'+String(message.index).replace(/\D/g,'').padStart(3,'0').slice(-6)+'.png';
    const id=await chrome.downloads.download({url:'data:image/png;base64,'+btoa(binary),filename,saveAs:false,conflictAction:'uniquify'});
    await waitForDownload(id);
    return {ok:true,id,width:bitmap.width,height:bitmap.height,bytes:png.size};
  } finally {bitmap.close();}
}
chrome.runtime.onMessage.addListener((message,sender,respond)=>{
  const isOwnPage=sender.url?.startsWith(chrome.runtime.getURL(''));
  const isShop=sender.tab && sender.url && allowed(sender.url);
  if(message.type==='OPEN_GALLERY' && (isOwnPage||isShop)){
    openGallery(message.payload).then(respond).catch(e=>respond({ok:false,error:e.message}));return true;
  }
  if(message.type==='DOWNLOAD_IMAGE' && isOwnPage){
    downloadImage(message).then(respond).catch(e=>respond({ok:false,error:e.message}));return true;
  }
});
