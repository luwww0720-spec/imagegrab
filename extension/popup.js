document.getElementById('extract').onclick=async()=>{
 const button=document.getElementById('extract');const status=document.getElementById('status');button.disabled=true;
 try{const [tab]=await chrome.tabs.query({active:true,currentWindow:true});const result=await chrome.tabs.sendMessage(tab.id,{type:'EXTRACT_IMAGES'});if(!result?.ok)throw new Error(result?.error||'提取失败');status.textContent='已打开图片工作台。';}
 catch(error){status.textContent=/Receiving end|Could not establish/.test(error.message)?'请打开支持的商品详情页；刚安装插件时，请先刷新商品页。':error.message;}
 finally{button.disabled=false;}
};
