const CONFIG={API_URL:'https://eon.zk524.com',REFRESH_INTERVAL:10000};
const STATE={currentPage:'wallet',wallet:null,refreshTimer:null};
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
case 'receive':
loadReceive();
break;
case 'settings':
setupSettings();
break;
}
updateLastRefresh();
}
function loadWallet(){
STATE.wallet=JSON.parse(localStorage.getItem('eon_wallet')||'null');
}
async function loadWallet(){
STATE.wallet=JSON.parse(localStorage.getItem('eon_wallet')||'null');
const totalBalance=document.getElementById('totalBalance');
const walletAddress=document.getElementById('walletAddress');
const utxoList=document.getElementById('utxoList');
if(!STATE.wallet){
totalBalance.textContent='0';
walletAddress.textContent='No wallet loaded';
utxoList.innerHTML='<div class="info">Create or import a wallet in Settings</div>';
return;
}
walletAddress.textContent=STATE.wallet.address;
document.getElementById('copyAddressBtn').addEventListener('click',()=>{
navigator.clipboard.writeText(STATE.wallet.address);
showNotification('Address copied!');
});
try{
const balance=await callRPC('get_balance_by_owner',{owner:STATE.wallet.address});
totalBalance.textContent=balance||'0';
const utxos=await callRPC('get_list_of_utxo_by_owner_order_by_amount',{owner:STATE.wallet.address,limit:10});
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
if(!STATE.wallet){
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
sendResult.innerHTML='<div class="loading">Creating transaction...</div>';
try{
const utxos=await callRPC('get_list_of_utxo_by_owner_order_by_amount',{owner:STATE.wallet.address,limit:2});
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
oy:encodeOut((outAmount-amountBig-feeBig).toString(),STATE.wallet.address,[])
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
oy:encodeOut((total-amountBig-feeBig).toString(),STATE.wallet.address,[])
};
}
const proof=await generateProof(tx);
const wptx=encodeWpTx(STATE.wallet,proof,tx);
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
const dataLen=(data.length).toString(16).padStart(8,'0');
const dataHex=data.map(d=>d.padStart(64,'0')).join('');
return '0x'+amountHex+ownerHex+dataLen+dataHex;
}
async function generateProof(tx){
const salt=STATE.wallet.salt.replace('0x','');
const hash=STATE.wallet.hash.replace('0x','');
const txHash=await hashTx(tx);
return '0x'+salt+hash+txHash.replace('0x','')+'00'.repeat(768);
}
async function hashTx(tx){
const data=tx.ix+tx.iy+tx.ox+tx.oy;
const msgUint8=new TextEncoder().encode(data);
const hashBuffer=await crypto.subtle.digest('SHA-256',msgUint8);
const hashArray=Array.from(new Uint8Array(hashBuffer));
return '0x'+hashArray.map(b=>b.toString(16).padStart(2,'0')).join('').substring(0,64);
}
function encodeWpTx(wallet,proof,tx){
const vk='0x'+'00'.repeat(96);
const txHex=tx.ix.replace('0x','')+tx.iy.replace('0x','')+tx.ox.replace('0x','')+tx.oy.replace('0x','');
return '0x'+vk.replace('0x','')+proof.replace('0x','')+txHex;
}
function loadReceive(){
const receiveAddress=document.getElementById('receiveAddress');
const qrCode=document.getElementById('qrCode');
if(!STATE.wallet){
receiveAddress.textContent='No wallet loaded';
qrCode.innerHTML='<span class="qr-icon">⬡</span>';
return;
}
receiveAddress.textContent=STATE.wallet.address;
qrCode.innerHTML=`<div class="qr-text">${STATE.wallet.address}</div>`;
document.getElementById('copyReceiveBtn').addEventListener('click',()=>{
navigator.clipboard.writeText(STATE.wallet.address);
showNotification('Address copied!');
});
}
function setupSettings(){
document.getElementById('createWalletBtn').addEventListener('click',createWallet);
document.getElementById('importWalletBtn').addEventListener('click',importWallet);
document.getElementById('exportWalletBtn').addEventListener('click',exportWallet);
document.getElementById('clearWalletBtn').addEventListener('click',clearWallet);
document.getElementById('changeEndpointBtn').addEventListener('click',changeEndpoint);
}
function createWallet(){
const salt=generateRandomHex(64);
const secret=prompt('Enter a secret passphrase:');
if(!secret)return;
const hash=hashSecret(secret,salt);
const address='0x'+hashSecret(salt+hash,'').substring(0,40);
const wallet={address:address,salt:'0x'+salt,hash:'0x'+hash,version:1};
localStorage.setItem('eon_wallet',JSON.stringify(wallet));
STATE.wallet=wallet;
showNotification('Wallet created successfully!');
navigate('wallet');
}
function hashSecret(secret,salt){
let hash=0;
const input=secret+salt;
for(let i=0;i<input.length;i++){
const char=input.charCodeAt(i);
hash=((hash<<5)-hash)+char;
hash=hash&hash;
}
return Math.abs(hash).toString(16).padStart(64,'0');
}
function generateRandomHex(length){
const bytes=new Uint8Array(length/2);
crypto.getRandomValues(bytes);
return Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
}
function importWallet(){
const input=document.createElement('input');
input.type='file';
input.accept='.json';
input.onchange=e=>{
const file=e.target.files[0];
const reader=new FileReader();
reader.onload=event=>{
try{
const wallet=JSON.parse(event.target.result);
if(!wallet.address||!wallet.salt||!wallet.hash){
throw new Error('Invalid wallet file');
}
localStorage.setItem('eon_wallet',JSON.stringify(wallet));
STATE.wallet=wallet;
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
function exportWallet(){
if(!STATE.wallet){
showNotification('No wallet to export');
return;
}
const dataStr=JSON.stringify(STATE.wallet,null,2);
const dataBlob=new Blob([dataStr],{type:'application/json'});
const url=URL.createObjectURL(dataBlob);
const link=document.createElement('a');
link.href=url;
link.download='eon_wallet.json';
link.click();
showNotification('Wallet exported!');
}
function clearWallet(){
if(!confirm('Are you sure you want to clear your wallet? Make sure you have exported it first!'))return;
localStorage.removeItem('eon_wallet');
STATE.wallet=null;
showNotification('Wallet cleared');
navigate('wallet');
}
function changeEndpoint(){
const newEndpoint=prompt('Enter new API endpoint:',CONFIG.API_URL);
if(newEndpoint){
CONFIG.API_URL=newEndpoint;
showNotification('Endpoint updated to: '+newEndpoint);
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
