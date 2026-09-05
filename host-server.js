const http = require('node:http');
const { randomUUID, timingSafeEqual } = require('node:crypto');
const { Server } = require('socket.io');

const key = process.env.FRIENDS_HOST_KEY || '';
const port = Number(process.env.FRIENDS_HOST_PORT || 3000);
const history = [];
const voiceRooms = new Map();
const server = http.createServer((req, res) => {
  if (req.url === '/health') { res.writeHead(200, {'content-type':'application/json'}); return res.end('{"ok":true}'); }
  res.writeHead(200, {'content-type':'text/plain'}); res.end('Friends local host is online');
});
const io = new Server(server, { cors: { origin: '*' }, maxHttpBufferSize: 64000 });
function allowed(value) {
  if (typeof value !== 'string') return false;
  const a = Buffer.from(value), b = Buffer.from(key);
  return a.length === b.length && timingSafeEqual(a, b);
}
function username(value) { return typeof value === 'string' ? value.trim().slice(0,32) || 'Друг' : 'Друг'; }
function roster() { io.emit('participants', [...io.sockets.sockets.values()].map(s => ({id:s.id, username:s.data.username, avatar:s.data.avatar || '', voice:voiceRooms.has(s.id)}))); }
function leaveVoice(socket) { const room=voiceRooms.get(socket.id); if (!room) return; socket.to(room).emit('voice-user-left',{id:socket.id}); socket.leave(room); voiceRooms.delete(socket.id); roster(); }
io.use((socket, next) => allowed(socket.handshake.auth?.key) ? next() : next(new Error('Неверный код доступа')));
io.on('connection', socket => {
  socket.data.username=username(socket.handshake.auth?.username);
  socket.data.avatar=typeof socket.handshake.auth?.avatar === 'string' ? socket.handshake.auth.avatar.slice(0,1000) : '';
  socket.emit('session-info',{uploadToken:'',iceServers:[{urls:'stun:stun.l.google.com:19302'}],turnConfigured:false});
  socket.emit('chat-history', history); roster();
  socket.on('profile-update', data => { socket.data.username=username(data?.username); socket.data.avatar=typeof data?.avatar==='string'?data.avatar.slice(0,1000):''; roster(); });
  socket.on('chat-message',(data, ack) => { const text=typeof data?.text==='string'?data.text.trim().slice(0,2000):''; if(!text) return ack?.({ok:false,error:'Напиши сообщение'}); const message={id:randomUUID(),createdAt:new Date().toISOString(),senderId:socket.id,username:socket.data.username,avatar:socket.data.avatar,text}; history.push(message); if(history.length>100) history.shift(); io.emit('chat-message',message); ack?.({ok:true}); });
  socket.on('delete-message',(data,ack)=>{const i=history.findIndex(m=>m.id===data?.id&&m.senderId===socket.id); if(i<0)return ack?.({ok:false}); const [m]=history.splice(i,1); io.emit('message-deleted',{id:m.id}); ack?.({ok:true});});
  socket.on('join-voice', room => { if(room!=='general-voice')return; leaveVoice(socket); const internal='voice:'+room; const peers=[...(io.sockets.adapter.rooms.get(internal)||[])]; socket.join(internal); voiceRooms.set(socket.id,internal); socket.emit('voice-peers',peers); roster(); });
  for(const [event,field] of [['voice-offer','offer'],['voice-answer','answer'],['ice-candidate','candidate']]) socket.on(event,data=>{if(data?.target&&data[field]&&voiceRooms.get(socket.id)===voiceRooms.get(data.target))io.to(data.target).emit(event,{from:socket.id,[field]:data[field]});});
  socket.on('leave-voice',()=>leaveVoice(socket)); socket.on('disconnecting',()=>leaveVoice(socket)); socket.on('disconnect',roster);
});
server.listen(port,'0.0.0.0');
