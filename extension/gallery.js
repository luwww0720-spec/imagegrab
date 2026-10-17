const $=id=>document.getElementById(id);
let session;let images=[];const selected=new Set();let downloading=false;
function visibleImages(){const min=Number($('min-size').value);return images.filter(i=>i.width>=min&&i.height>=min&&(!$('only-selected').checked||selected.has(i.url)));}
function updateCount(){ $('selected-count').textContent='已选 '+selected.size+' 张';$('download').disabled=downloading||selected.size===0; }
function render(){
  const list=visibleImages();$('grid').replaceChildren();$('empty').hidden=list.length>0;
  $('empty').textContent=images.length?'当前筛选条件下没有图片，请降低最小尺寸或取消仅显示选中。':'还没有图片。请在支持的商品详情页点击右下角「获取图片」。';
  for(const item of list){
    const index=images.indexOf(item)+1;
    const card=document.createElement('label');card.className='card'+(selected.has(item.url)?' selected':'');
    const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.checked=selected.has(item.url);checkbox.setAttribute('aria-label','选择商品图 '+index);checkbox.disabled=downloading;
    checkbox.addEventListener('change',()=>{checkbox.checked?selected.add(item.url):selected.delete(item.url);render();});
    const img=document.createElement('img');img.src=item.url;img.alt='商品图片 '+index;img.loading='lazy';img.referrerPolicy='no-referrer';
    const tag=document.createElement('span');tag.className='tag';tag.textContent=item.source==='background'?'背景图':'商品图';
    const meta=document.createElement('div');meta.className='meta';const name=document.createElement('strong');name.textContent='商品图 '+String(index).padStart(3,'0');const dim=document.createElement('span');dim.textContent=item.width+' × '+item.height;meta.append(name,dim);card.append(img,checkbox,tag,meta);$('grid').append(card);
  }updateCount();
}
$('select-all').onclick=()=>{for(const i of visibleImages())selected.add(i.url);render();};
$('invert').onclick=()=>{for(const i of visibleImages())selected.has(i.url)?selected.delete(i.url):selected.add(i.url);render();};
$('only-selected').onchange=render;$('min-size').onchange=render;
$('download').onclick=async()=>{
  const batch=images.filter(i=>selected.has(i.url));if(!batch.length||downloading)return;
  downloading=true;for(const id of ['select-all','invert','min-size','only-selected'])$(id).disabled=true;render();
  $('progress').hidden=false;$('progress').max=batch.length;$('progress').value=0;
  let success=0;const failures=[];
  for(let i=0;i<batch.length;i++){
    $('status').textContent=`正在转换并保存 ${i+1} / ${batch.length}…`;
    try{const result=await chrome.runtime.sendMessage({type:'DOWNLOAD_IMAGE',url:batch[i].url,index:images.indexOf(batch[i])+1});if(!result?.ok)throw new Error(result?.error||'下载未响应');success++;}catch(error){failures.push({url:batch[i].url,error:error.message});}
    $('progress').value=i+1;
  }
  $('status').textContent=`下载完成：成功 ${success} 张，失败 ${failures.length} 张。`+(failures.length?' '+failures.map(f=>f.error).join('；'):'文件已保存至浏览器下载目录的「图采集」文件夹。');
  downloading=false;for(const id of ['select-all','invert','min-size','only-selected'])$(id).disabled=false;render();
};
(async()=>{
  try{const key=new URLSearchParams(location.search).get('session');if(!key){$('source-title').textContent='从商品详情页开始，建立你的图片工作台。';render();return;}
    session=(await chrome.storage.local.get(key))[key];if(!session)throw new Error('这次提取记录已过期，请回商品页重新提取。');
    images=session.images;$('total').textContent=images.length;$('source-title').textContent=session.title;
    if(/^https?:\/\//.test(session.url)){$('source-link').href=session.url;$('source-link').textContent=session.url;}
    render();
  }catch(error){$('source-title').textContent=error.message;render();}
})();
