(() => {
  const API = "https://friends-api.sidorinmark65.workers.dev";
  let adminToken = "";
  const el = (id) => document.getElementById(id);
  document.head.insertAdjacentHTML("beforeend", `<style>
  #friends-admin{position:fixed;inset:0;z-index:20000;display:grid;place-items:center;background:#000b;font:14px "Segoe UI",sans-serif}
  #friends-admin .box{width:min(720px,calc(100vw - 32px));max-height:calc(100vh - 48px);overflow:auto;padding:22px;border-radius:10px;background:#313338;color:#f2f3f5;box-shadow:0 16px 50px #000}
  #friends-admin input{width:100%;height:40px;padding:0 10px;border:0;border-radius:5px;background:#1e1f22;color:#fff}
  #friends-admin button{margin:8px 6px 8px 0;padding:8px 11px;border:0;border-radius:5px;background:#5865f2;color:#fff;cursor:pointer}
  #friends-admin .danger{background:#da373c}#friends-admin .row{display:flex;gap:10px;align-items:center;padding:8px 0;border-top:1px solid #41434a}#friends-admin .row span{flex:1}.admin-muted{color:#b5bac1;font-size:12px}
  </style>`);
  document.body.insertAdjacentHTML("beforeend", `<div id="friends-admin" hidden><div class="box"><button id="friends-admin-close" style="float:right;background:transparent">×</button><h2>Панель управления</h2><p id="friends-admin-status" class="admin-muted">Введи секретный ключ администратора.</p><input id="friends-admin-key" type="password" placeholder="Ключ администратора" autocomplete="off"><div id="friends-admin-actions"><button id="friends-admin-login">Войти</button></div><div id="friends-admin-list"></div></div></div>`);
  const overlay=el("friends-admin"),status=el("friends-admin-status"),key=el("friends-admin-key"),actions=el("friends-admin-actions"),list=el("friends-admin-list");
  async function normalToken(){const saved=window.savedAccess?await window.savedAccess.load():null;return saved?.key||localStorage.getItem("fv-token")||""}
  async function request(path,options={},token=adminToken){const r=await fetch(API+path,{...options,headers:{"content-type":"application/json",authorization:"Bearer "+token,...(options.headers||{})}}),body=await r.json().catch(()=>({}));if(!r.ok)throw Error(body.error||"Ошибка сервера");return body}
  async function load(){try{const data=await request("/api/admin/overview");status.textContent=`Пользователей: ${data.users.length} · серверов: ${data.servers.length} · последние сообщения: ${data.messages.length}`;list.replaceChildren();const h=document.createElement("h3");h.textContent="Последние сообщения";list.append(h,...data.messages.map(m=>{const row=document.createElement("div");row.className="row";const text=document.createElement("span");text.textContent=`${m.username}: ${m.body||"(вложение)"}`;const del=document.createElement("button");del.className="danger";del.textContent="Удалить";del.onclick=async()=>{if(confirm("Удалить это сообщение?")){await request("/api/admin/messages/"+encodeURIComponent(m.id),{method:"DELETE"});load()}};row.append(text,del);return row;}));}catch(e){status.textContent=e.message}}
  async function login(){try{const token=await normalToken();if(!token)throw Error("Сначала войди в Friends");const data=await request("/api/admin/login",{method:"POST",body:JSON.stringify({key:key.value})},token);adminToken=data.token;key.value="";key.hidden=true;actions.innerHTML='<button id="friends-admin-refresh">Обновить</button>';el("friends-admin-refresh").onclick=load;load()}catch(e){status.textContent=e.message}}
  function open(){overlay.hidden=false;key.hidden=false;key.value="";actions.innerHTML='<button id="friends-admin-login">Войти</button>';el("friends-admin-login").onclick=login;key.focus()}
  document.addEventListener("keydown",e=>{if(e.ctrlKey&&e.shiftKey&&e.key.toLowerCase()==="a"){e.preventDefault();open()}if(e.key==="Escape")overlay.hidden=true});
  el("friends-admin-close").onclick=()=>overlay.hidden=true;
})();
