const CONFIG={API_URL:'https://eon.zk524.com',REFRESH_INTERVAL:10000};
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
return `<div class="wallet-list-item ${active?'active':''}" data-id="${id}">
<div class="wallet-list-info">
<div class="wallet-list-name">${w.name}</div>
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
if(data.error)throw new Error(data.error.message||'RPC Error');
updateConnectionStatus(true);
return data.result;
}catch(error){
updateConnectionStatus(false);
console.error('RPC call failed:',error);
throw error;
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
document.getElementById('copyAddressBtn').addEventListener('click',()=>{
navigator.clipboard.writeText(wallet.wallet.address);
showNotification('Address copied!');
});
try{
const balance=await callRPC('get_balance_by_owner',{owner:wallet.wallet.address});
totalBalance.textContent=balance||'0';
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
const hex=outHex.replace('0x','');
const amountHex=hex.substring(0,64);
return BigInt('0x'+amountHex).toString();
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
const secret=prompt('Enter your wallet secret:');
if(!secret){
sendResult.innerHTML='<div class="error">Secret required to sign transaction</div>';
return;
}
sendResult.innerHTML='<div class="loading">Verifying wallet...</div>';
try{
const valid=await WasmWallet.verifyWallet(wallet.wallet,secret);
if(!valid){
throw new Error('Invalid secret');
}
}catch(error){
sendResult.innerHTML=`<div class="error">Verification failed: ${error.message}</div>`;
return;
}
sendResult.innerHTML='<div class="loading">Creating transaction...</div>';
try{
const utxos=await callRPC('get_list_of_utxo_by_owner_order_by_amount',{owner:wallet.wallet.address,limit:2});
if(!Array.isArray(utxos)||utxos.length===0){
throw new Error('No UTXOs available');
}
let tx;
const amountBig=BigInt(amount);
const feeBig=BigInt(fee);
if(utxos.length===1){
const utxo=utxos[0];
const outAmount=BigInt(parseOutAmount(utxo.out));
if(outAmount<amountBig+feeBig){
throw new Error('Insufficient balance');
}
tx={
ix:utxo.id,
iy:'0x0000000000000000000000000000000000000000000000000000000000000000',
ox:encodeOut(amount,toAddress,[]),
oy:encodeOut((outAmount-amountBig-feeBig).toString(),wallet.wallet.address,[])
};
}else{
const utxo0=utxos[0];
const utxo1=utxos[1];
const amount0=BigInt(parseOutAmount(utxo0.out));
const amount1=BigInt(parseOutAmount(utxo1.out));
const total=amount0+amount1;
if(total<amountBig+feeBig){
throw new Error('Insufficient balance');
}
tx={
ix:utxo0.id,
iy:utxo1.id,
ox:encodeOut(amount,toAddress,[]),
oy:encodeOut((total-amountBig-feeBig).toString(),wallet.wallet.address,[])
};
}
sendResult.innerHTML='<div class="loading">Signing transaction (may take a moment)...</div>';
const wptx=await WasmWallet.signTransaction(wallet.wallet,secret,tx);
console.log('[DEBUG] Generated wptx length:',wptx.length);
console.log('[DEBUG] wptx:',wptx.substring(0,200)+'...');
sendResult.innerHTML='<div class="loading">Submitting transaction...</div>';
await callRPC('submit_transaction',{tx:wptx});
sendResult.innerHTML='<div class="success">Transaction submitted successfully!</div>';
setTimeout(()=>{
navigate('wallet');
},2000);
}catch(error){
sendResult.innerHTML=`<div class="error">Transaction failed: ${error.message}</div>`;
}
});
}
function encodeOut(amount,owner,data){
const amountHex=BigInt(amount).toString(16).padStart(64,'0');
const ownerHex=owner.replace('0x','').padStart(64,'0');
const dataLenNum=data.length;
const dataLenHex=((dataLenNum>>>24)&0xFF).toString(16).padStart(2,'0')+
((dataLenNum>>>16)&0xFF).toString(16).padStart(2,'0')+
((dataLenNum>>>8)&0xFF).toString(16).padStart(2,'0')+
(dataLenNum&0xFF).toString(16).padStart(2,'0');
const dataHex=data.map(d=>d.padStart(64,'0')).join('');
return '0x'+amountHex+ownerHex+dataLenHex+dataHex;
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
document.getElementById('createWalletBtnSettings').addEventListener('click',createWallet);
document.getElementById('importWalletBtnSettings').addEventListener('click',importWallet);
return;
}
container.innerHTML=ids.map(id=>{
const w=STATE.wallets[id];
return `<div class="setting-item">
<div class="setting-info">
<div class="setting-label">${w.name}</div>
<div class="setting-desc">${formatHash(w.wallet.address,20)}</div>
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
document.getElementById('createWalletBtnSettings').addEventListener('click',createWallet);
document.getElementById('importWalletBtnSettings').addEventListener('click',importWallet);
}
async function createWallet(){
const name=prompt('Enter wallet name:');
if(!name)return;
const secret=prompt('Enter a secret passphrase:');
if(!secret)return;
const confirm=prompt('Confirm your secret passphrase:');
if(secret!==confirm){
showNotification('Passphrases do not match!');
return;
}
showNotification('Creating wallet...');
try{
const wallet=await WasmWallet.createWallet(secret);
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
const choice=prompt('Create new wallet or import existing?\\n1: Create\\n2: Import');
if(choice==='1')createWallet();
else if(choice==='2')importWallet();
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
