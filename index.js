const CONFIG={API_URL:'https://eon.zk524.com',FAUCET_URL:'https://eon.zk524.com',TURNSTILE_SITE_KEY:'0x4AAAAAACvuWReT5CoqVcfm',REFRESH_INTERVAL:10000};
const STATE={currentPage:'wallet',currentWalletId:null,wallets:{},refreshTimer:null};
function loadWallets(){
const stored=localStorage.getItem('eon_wallets');
const currentId=localStorage.getItem('eon_current_wallet');
if(stored){
STATE.wallets=JSON.parse(stored);
STATE.currentWalletId=currentId;
}
}
function saveWallets(){
localStorage.setItem('eon_wallets',JSON.stringify(STATE.wallets));
if(STATE.currentWalletId){
localStorage.setItem('eon_current_wallet',STATE.currentWalletId);
}
}
function getCurrentWallet(){
return STATE.currentWalletId?STATE.wallets[STATE.currentWalletId]:null;
}
function setCurrentWallet(id){
STATE.currentWalletId=id;
localStorage.setItem('eon_current_wallet',id);
updateWalletSwitcher();
if(STATE.currentPage==='wallet'){
loadWallet();
}
}
function addWallet(wallet,name){
const id=wallet.address;
STATE.wallets[id]={wallet,name:name||`Wallet ${Object.keys(STATE.wallets).length+1}`};
saveWallets();
setCurrentWallet(id);
}
function removeWallet(id){
delete STATE.wallets[id];
if(STATE.currentWalletId===id){
const ids=Object.keys(STATE.wallets);
STATE.currentWalletId=ids.length>0?ids[0]:null;
}
saveWallets();
updateWalletSwitcher();
}
function renameWallet(id,newName){
if(STATE.wallets[id]){
STATE.wallets[id].name=newName;
saveWallets();
updateWalletSwitcher();
}
}
function updateWalletSwitcher(){
const currentWalletName=document.getElementById('currentWalletName');
const walletList=document.getElementById('walletList');
if(!currentWalletName)return;
const current=getCurrentWallet();
currentWalletName.textContent=current?current.name:'No Wallet';
if(!walletList)return;
const ids=Object.keys(STATE.wallets);
if(ids.length===0){
walletList.innerHTML='<div class="wallet-list-empty">No wallets</div>';
return;
}
walletList.innerHTML=ids.map(id=>{
const w=STATE.wallets[id];
const active=id===STATE.currentWalletId;
const accountType=w.wallet.account_type||'zk';
const typeLabel=accountType==='normal'?'[N]':'[ZK]';
return `<div class="wallet-list-item ${active?'active':''}" data-id="${id}">
<div class="wallet-list-info">
<div class="wallet-list-name">${w.name} <span style="opacity:0.6;font-size:0.85em;">${typeLabel}</span></div>
<div class="wallet-list-address">${formatHash(w.wallet.address,12)}</div>
</div>
${active?'<span class="wallet-list-badge">●</span>':''}
</div>`;
}).join('');
walletList.querySelectorAll('.wallet-list-item').forEach(item=>{
item.addEventListener('click',()=>{
setCurrentWallet(item.dataset.id);
hideWalletDropdown();
});
});
}
function showWalletDropdown(){
document.getElementById('walletDropdown').style.display='block';
updateWalletSwitcher();
}
function hideWalletDropdown(){
document.getElementById('walletDropdown').style.display='none';
}
async function callRPC(method,params=null){
try{
const response=await fetch(CONFIG.API_URL,{
method:'POST',
headers:{'Content-Type':'application/json'},
body:JSON.stringify({jsonrpc:'2.0',id:Date.now(),method:method,params:params})
});
const data=await response.json();
if(data.error)throw new Error(data.error.message||JSON.stringify(data.error)||'RPC Error');
updateConnectionStatus(true);
return data.result;
}catch(error){
updateConnectionStatus(false);
const msg=error instanceof TypeError?`Network error: ${error.message} (check CORS or API endpoint ${CONFIG.API_URL})`:
(typeof error==='string'?error:(error.message||JSON.stringify(error)));
console.error('RPC call failed:',msg,error);
throw new Error(msg);
}
}
function updateConnectionStatus(isConnected){
const indicator=document.getElementById('statusIndicator');
const apiStatus=document.getElementById('apiStatus');
if(indicator)indicator.style.background=isConnected?'var(--success)':'var(--error)';
if(apiStatus){
apiStatus.textContent=isConnected?'Connected':'Disconnected';
apiStatus.style.color=isConnected?'var(--success)':'var(--error)';
}
}
function updateLastRefresh(){
const lastUpdate=document.getElementById('lastUpdate');
if(lastUpdate)lastUpdate.textContent=new Date().toLocaleTimeString();
}
function navigate(page){
STATE.currentPage=page;
document.querySelectorAll('.nav-link').forEach(link=>{
link.classList.toggle('active',link.dataset.page===page);
});
if(STATE.refreshTimer&&page!=='wallet'){
clearInterval(STATE.refreshTimer);
STATE.refreshTimer=null;
}
loadPage(page);
}
async function loadPage(page){
const content=document.getElementById('content');
const template=document.getElementById(`${page}Template`);
if(!template){
content.innerHTML='<div class="error">Page not found</div>';
return;
}
content.innerHTML='';
content.appendChild(template.content.cloneNode(true));
switch(page){
case 'wallet':
await loadWallet();
break;
case 'send':
setupSend();
break;
case 'faucet':
setupFaucet();
break;
case 'settings':
setupSettings();
break;
}
updateLastRefresh();
}
async function loadWallet(){
const wallet=getCurrentWallet();
const totalBalance=document.getElementById('totalBalance');
const walletAddress=document.getElementById('walletAddress');
const utxoList=document.getElementById('utxoList');
if(!wallet){
totalBalance.textContent='0';
walletAddress.textContent='No wallet loaded';
utxoList.innerHTML='<div class="info">Create or import a wallet</div>';
return;
}
walletAddress.textContent=wallet.wallet.address;
try{
const bech32=await WasmWallet.addressToBech32(wallet.wallet.address);
document.getElementById('walletBech32').textContent=bech32;
document.getElementById('copyBech32Btn').addEventListener('click',()=>{
navigator.clipboard.writeText(bech32);
showNotification('Bech32 address copied!');
});
}catch(e){document.getElementById('walletBech32').textContent='--';}
document.getElementById('copyAddressBtn').addEventListener('click',()=>{
navigator.clipboard.writeText(wallet.wallet.address);
showNotification('Address copied!');
});
try{
const balance=await callRPC('get_balance_by_owner',{owner:wallet.wallet.address});
totalBalance.textContent=balance||'0';
const EON_PRICE=13.37;
const fiatValue=(Number(balance)||0)*EON_PRICE;
document.getElementById('balanceFiat').textContent=`≈ $${fiatValue.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const utxos=await callRPC('get_list_of_utxo_by_owner_order_by_amount',{owner:wallet.wallet.address,limit:10});
if(Array.isArray(utxos)&&utxos.length>0){
utxoList.innerHTML=utxos.map((u,i)=>`
<div class="utxo-item">
<div class="utxo-id">${formatHash(u.id)}</div>
<div class="utxo-amount">${parseOutAmount(u.out)}</div>
</div>
`).join('');
}else{
utxoList.innerHTML='<div class="info">No UTXOs found</div>';
}
}catch(error){
utxoList.innerHTML=`<div class="error">Failed to load: ${error.message}</div>`;
}
document.getElementById('refreshBtn').addEventListener('click',loadWallet);
if(!STATE.refreshTimer){
STATE.refreshTimer=setInterval(()=>{
if(STATE.currentPage==='wallet')loadWallet();
},CONFIG.REFRESH_INTERVAL);
}
}
function parseOutAmount(outHex){
try{
return WasmWallet.rustWasm.parse_out_amount(outHex);
}catch{
return '0';
}
}
function setupSend(){
const sendBtn=document.getElementById('sendBtn');
const sendResult=document.getElementById('sendResult');
sendBtn.addEventListener('click',async()=>{
sendResult.innerHTML='';
const wallet=getCurrentWallet();
if(!wallet){
sendResult.innerHTML='<div class="error">No wallet loaded</div>';
return;
}
const toAddress=document.getElementById('toAddress').value.trim();
const amount=document.getElementById('sendAmount').value.trim();
const fee=document.getElementById('sendFee').value.trim()||'0';
if(!toAddress||!amount){
sendResult.innerHTML='<div class="error">Please fill all required fields</div>';
return;
}
let secret='';
if(wallet.wallet.account_type==='zk'){
secret=prompt('Enter your wallet secret:');
if(!secret){
sendResult.innerHTML='<div class="error">Secret required to sign ZK transaction</div>';
return;
}
sendResult.innerHTML='<div class="loading">Verifying wallet...</div>';
try{
const valid=await WasmWallet.verifyWallet(wallet.wallet,secret);
if(!valid){
throw new Error('Invalid secret');
}
}catch(error){
const msg=typeof error==='string'?error:(error.message||JSON.stringify(error));
sendResult.innerHTML=`<div class="error">Verification failed: ${msg}</div>`;
return;
}
}
sendResult.innerHTML='<div class="loading">Resolving address...</div>';
let resolvedAddress=toAddress;
try{
await WasmWallet.init();
resolvedAddress=WasmWallet.rustWasm.resolve_address(toAddress);
}catch(e){
sendResult.innerHTML=`<div class="error">Invalid address: ${e}</div>`;
return;
}
sendResult.innerHTML='<div class="loading">Fetching UTXOs...</div>';
try{
console.log('[TX] Fetching UTXOs for',wallet.wallet.address);
const utxos=await callRPC('get_list_of_utxo_by_owner_order_by_amount',{owner:wallet.wallet.address,limit:2});
console.log('[TX] UTXOs:',JSON.stringify(utxos));
if(!Array.isArray(utxos)||utxos.length===0){
throw new Error('No UTXOs available');
}
sendResult.innerHTML='<div class="loading">Building and signing transaction...</div>';
console.log('[TX] Building tx: to=',resolvedAddress,'amount=',amount,'fee=',fee);
console.log('[TX] Wallet:',JSON.stringify(wallet.wallet));
const wptx=await WasmWallet.buildAndSignTransaction(wallet.wallet,secret,utxos,resolvedAddress,amount,fee);
console.log('[TX] Generated wptx length:',wptx.length);
console.log('[TX] wptx prefix:',wptx.substring(0,100));
sendResult.innerHTML='<div class="loading">Submitting transaction...</div>';
const submitResult=await callRPC('submit_transaction',{tx:wptx});
console.log('[TX] Submit result:',submitResult);
sendResult.innerHTML='<div class="success">Transaction submitted successfully!</div>';
setTimeout(()=>{
navigate('wallet');
},2000);
}catch(error){
console.error('[TX] Error:',error);
const msg=typeof error==='string'?error:(error.message||JSON.stringify(error));
sendResult.innerHTML=`<div class="error">Transaction failed: ${msg}</div>`;
}
});
}

function setupFaucet(){
fetch(CONFIG.FAUCET_URL+'/faucet/info').then(r=>r.json()).then(info=>{
document.getElementById('faucetAmount').textContent=info.amount_per_request+' EON';
document.getElementById('faucetBalance').textContent=Number(info.balance).toLocaleString()+' EON';
}).catch(()=>{
document.getElementById('faucetAmount').textContent='--';
document.getElementById('faucetBalance').textContent='--';
});
const widget=document.getElementById('turnstileWidget');
var faucetBtn=document.getElementById('faucetRequestBtn');
faucetBtn.disabled=true;
faucetBtn.style.opacity='0.5';
faucetBtn.style.cursor='not-allowed';
if(widget&&CONFIG.TURNSTILE_SITE_KEY&&window.turnstile){
turnstile.render('#turnstileWidget',{
sitekey:CONFIG.TURNSTILE_SITE_KEY,
theme:'dark',
callback:function(){
faucetBtn.disabled=false;
faucetBtn.style.opacity='1';
faucetBtn.style.cursor='pointer';
},
'expired-callback':function(){
faucetBtn.disabled=true;
faucetBtn.style.opacity='0.5';
faucetBtn.style.cursor='not-allowed';
},
'error-callback':function(){
faucetBtn.disabled=true;
faucetBtn.style.opacity='0.5';
faucetBtn.style.cursor='not-allowed';
}
});
}
document.getElementById('faucetUseMyAddress').addEventListener('click',()=>{
const wallet=getCurrentWallet();
if(wallet){
document.getElementById('faucetAddress').value=wallet.wallet.address;
}else{
showNotification('No wallet loaded');
}
});
document.getElementById('faucetRequestBtn').addEventListener('click',async()=>{
const result=document.getElementById('faucetResult');
const address=document.getElementById('faucetAddress').value.trim();
if(!address){
result.innerHTML='<div class="error">Please enter an address</div>';
return;
}
let turnstileToken='';
const turnstileInput=document.querySelector('[name="cf-turnstile-response"]');
if(turnstileInput){
turnstileToken=turnstileInput.value;
}
if(!turnstileToken){
result.innerHTML='<div class="error">Please complete the verification first</div>';
return;
}
result.innerHTML='<div class="loading">Requesting tokens...</div>';
try{
const resp=await fetch(CONFIG.FAUCET_URL+'/faucet',{
method:'POST',
headers:{'Content-Type':'application/json'},
body:JSON.stringify({address:address,turnstile_token:turnstileToken})
});
const data=await resp.json();
if(data.success){
result.innerHTML='<div class="success">'+data.message+'</div>';
if(window.turnstile)turnstile.reset('#turnstileWidget');
}else{
result.innerHTML='<div class="error">'+(data.message||'Request failed')+'</div>';
if(window.turnstile)turnstile.reset('#turnstileWidget');
}
}catch(e){
result.innerHTML='<div class="error">Failed to connect to faucet: '+e.message+'</div>';
}
});
}
function setupSettings(){
renderWalletManagement();
document.getElementById('changeEndpointBtn').addEventListener('click',changeEndpoint);
}
function renderWalletManagement(){
const container=document.getElementById('walletManagementList');
const ids=Object.keys(STATE.wallets);
if(ids.length===0){
container.innerHTML='<div class="info">No wallets. Create or import one.</div><div class="setting-item"><div class="setting-actions"><button id="createWalletBtnSettings" class="btn btn-primary btn-small">Create New</button><button id="importWalletBtnSettings" class="btn btn-secondary btn-small">Import</button></div></div>';
document.getElementById('createWalletBtnSettings').addEventListener('click',showAddWalletModal);
document.getElementById('importWalletBtnSettings').addEventListener('click',importWallet);
return;
}
container.innerHTML=ids.map(id=>{
const wallet=STATE.wallets[id];
const accountType=wallet.wallet.account_type||'zk';
const typeLabel=accountType==='normal'?'Normal':'ZK';
return `<div class="setting-item">
<div class="setting-info">
<div class="setting-label">${wallet.name} <span style="font-size:0.8em;color:#666;">[${typeLabel}]</span></div>
<div class="setting-desc">${formatHash(wallet.wallet.address,20)}</div>
</div>
<div class="setting-actions">
<button class="btn btn-secondary btn-small wallet-rename" data-id="${id}">Rename</button>
<button class="btn btn-secondary btn-small wallet-export" data-id="${id}">Export</button>
<button class="btn btn-danger btn-small wallet-delete" data-id="${id}">Delete</button>
</div>
</div>`;
}).join('')+`<div class="setting-item"><div class="setting-actions"><button id="createWalletBtnSettings" class="btn btn-primary btn-small">Create New</button><button id="importWalletBtnSettings" class="btn btn-secondary btn-small">Import</button></div></div>`;
container.querySelectorAll('.wallet-rename').forEach(btn=>{
btn.addEventListener('click',()=>{
const id=btn.dataset.id;
const newName=prompt('Enter new wallet name:',STATE.wallets[id].name);
if(newName){
renameWallet(id,newName);
renderWalletManagement();
}
});
});
container.querySelectorAll('.wallet-export').forEach(btn=>{
btn.addEventListener('click',()=>{
const id=btn.dataset.id;
exportWalletById(id);
});
});
container.querySelectorAll('.wallet-delete').forEach(btn=>{
btn.addEventListener('click',()=>{
const id=btn.dataset.id;
if(confirm(`Delete wallet "${STATE.wallets[id].name}"? Make sure you have exported it first!`)){
removeWallet(id);
renderWalletManagement();
}
});
});
document.getElementById('createWalletBtnSettings').addEventListener('click',showAddWalletModal);
document.getElementById('importWalletBtnSettings').addEventListener('click',importWallet);
}
function showAddWalletModal(){
const overlay=document.createElement('div');
overlay.style.cssText='position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:1000;';
const modal=document.createElement('div');
modal.style.cssText='background:var(--card-bg,#1a1a2e);border:1px solid var(--border,#333);border-radius:12px;padding:24px;min-width:320px;text-align:center;';
modal.innerHTML=`
<h3 style="margin:0 0 20px;color:var(--text,#fff);">Add Wallet</h3>
<div style="display:flex;flex-direction:column;gap:12px;">
<button id="modalCreateNormal" style="padding:12px;border-radius:8px;border:1px solid var(--border,#333);background:var(--primary,#00d4aa);color:#000;font-weight:600;cursor:pointer;font-size:14px;">Create Normal Account</button>
<button id="modalCreateZk" style="padding:12px;border-radius:8px;border:1px solid var(--border,#333);background:var(--primary,#00d4aa);color:#000;font-weight:600;cursor:pointer;font-size:14px;">Create ZK Account</button>
<button id="modalImport" style="padding:12px;border-radius:8px;border:1px solid var(--border,#333);background:transparent;color:var(--text,#fff);cursor:pointer;font-size:14px;">Import Wallet</button>
<button id="modalCancel" style="padding:10px;border-radius:8px;border:none;background:transparent;color:var(--text-secondary,#888);cursor:pointer;font-size:13px;">Cancel</button>
</div>`;
overlay.appendChild(modal);
document.body.appendChild(overlay);
const close=()=>document.body.removeChild(overlay);
overlay.addEventListener('click',e=>{if(e.target===overlay)close();});
modal.querySelector('#modalCreateNormal').addEventListener('click',()=>{close();createWallet('normal');});
modal.querySelector('#modalCreateZk').addEventListener('click',()=>{close();createWallet('zk');});
modal.querySelector('#modalImport').addEventListener('click',()=>{close();importWallet();});
modal.querySelector('#modalCancel').addEventListener('click',close);
}
async function createWallet(type){
const name=prompt('Enter wallet name:');
if(!name)return;
let secret='';
if(type==='zk'){
secret=prompt('Enter a secret passphrase:');
if(!secret)return;
const confirm=prompt('Confirm your secret passphrase:');
if(secret!==confirm){
showNotification('Passphrases do not match!');
return;
}
}
showNotification('Creating wallet...');
try{
const wallet=type==='normal'?
await WasmWallet.createWallet(secret):
await WasmWallet.createZkWallet(secret);
addWallet(wallet,name);
showNotification('Wallet created successfully!');
navigate('wallet');
}catch(error){
showNotification('Failed to create wallet: '+error.message);
}
}
function importWallet(){
const input=document.createElement('input');
input.type='file';
input.accept='.json';
input.onchange=async e=>{
const file=e.target.files[0];
const reader=new FileReader();
reader.onload=async event=>{
try{
const walletData=JSON.parse(event.target.result);
await WasmWallet.importWallet(walletData);
const name=prompt('Enter wallet name:',`Wallet ${Object.keys(STATE.wallets).length+1}`);
if(!name)return;
addWallet(walletData,name);
showNotification('Wallet imported successfully!');
navigate('wallet');
}catch(error){
showNotification('Failed to import wallet: '+error.message);
}
};
reader.readAsText(file);
};
input.click();
}
function exportWalletById(id){
const w=STATE.wallets[id];
if(!w)return;
const dataStr=JSON.stringify(w.wallet,null,2);
const dataBlob=new Blob([dataStr],{type:'application/json'});
const url=URL.createObjectURL(dataBlob);
const link=document.createElement('a');
link.href=url;
link.download=`${w.name.replace(/[^a-z0-9]/gi,'_')}.json`;
link.click();
showNotification('Wallet exported!');
}
function changeEndpoint(){
const newEndpoint=prompt('Enter new API endpoint:',CONFIG.API_URL);
if(newEndpoint){
CONFIG.API_URL=newEndpoint;
document.getElementById('currentEndpoint').textContent=newEndpoint;
showNotification('Endpoint updated');
}
}
function formatHash(hash,length=16){
if(!hash||hash==='N/A')return 'N/A';
if(hash.length<=length)return hash;
return hash.substring(0,length)+'...';
}
function showNotification(message){
const notif=document.createElement('div');
notif.className='notification';
notif.textContent=message;
document.body.appendChild(notif);
setTimeout(()=>notif.classList.add('show'),10);
setTimeout(()=>{
notif.classList.remove('show');
setTimeout(()=>notif.remove(),300);
},3000);
}
document.addEventListener('DOMContentLoaded',()=>{
loadWallets();
updateWalletSwitcher();
document.getElementById('walletSwitcherBtn').addEventListener('click',e=>{
e.stopPropagation();
const dropdown=document.getElementById('walletDropdown');
if(dropdown.style.display==='none'){
showWalletDropdown();
}else{
hideWalletDropdown();
}
});
document.getElementById('addWalletBtn').addEventListener('click',()=>{
hideWalletDropdown();
showAddWalletModal();
});
document.addEventListener('click',e=>{
if(!e.target.closest('.wallet-switcher')){
hideWalletDropdown();
}
});
document.querySelectorAll('.nav-link').forEach(link=>{
link.addEventListener('click',e=>{
e.preventDefault();
navigate(link.dataset.page);
});
});
navigate('wallet');
updateLastRefresh();
callRPC('get_tail').then(tail=>{
document.getElementById('blockHeight').textContent=formatHash(tail,8);
}).catch(()=>{});
});
