// Read-only screenshot fixture server. No requests are sent to a live database.
const http = require('http'), fs = require('fs'), path = require('path');
const root = process.env.LUMA_ROOT;
if (!root) throw new Error('Set LUMA_ROOT to the application checkout to capture.');
const fixturePath = path.resolve(__dirname, '../../docs/test-automation/rig/stub.js');
let fixture = fs.readFileSync(fixturePath, 'utf8')
 .replaceAll('Test User', 'Alex Morgan').replace("first_name: 'Test', last_name: 'User'", "first_name: 'Alex', last_name: 'Morgan'")
 .replaceAll('a@b.c', 'alex@example.com').replaceAll('aina@x.com','aina@example.com').replaceAll('ben@x.com','ben@example.com')
 .replace("addons: ['study'], addon_info:", "addons: ['study', 'work'], addon_info:")
 .replace("n === 'is_admin' ? true", "n === 'is_admin' ? false");
const types = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp'};
http.createServer((req,res)=>{
 let name = new URL(req.url,'http://localhost').pathname;
 if (name==='/__manual_fixture.js') {res.setHeader('Content-Type','text/javascript');return res.end(req.url.includes('guest=1') ? fixture.replace('getSession: async () => ({ data: { session } })', 'getSession: async () => ({ data: { session: null } })') : fixture);}
 name=name.replace(/^\/(login|register|reset-password|verify-email)(?=\/|$)/,'/app/modules/$1');
 if(name.endsWith('/')) name+='index.html';
 const file=path.resolve(root,'.'+name);
 if(!file.startsWith(path.resolve(root)+path.sep)){res.writeHead(403);return res.end();}
 fs.readFile(file,(err,buf)=>{
  if(err){res.writeHead(404);return res.end('Not found');}
  if(name==='/app/index.html') buf=String(buf).replace(/<script[^>]*src="https:[^"]*supabase[^\"]*"[^>]*><\/script>/g,'').replace('<script defer src="../shared/supabase-config.js">','<script src="/__manual_fixture.js"></script><script defer src="../shared/supabase-config.js">');
  if (/^\/app\/modules\/(login|register|verify-email|reset-password)\/index.html$/.test(name)) {
   const guest = name.includes('/reset-password/') ? '' : '?guest=1';
   buf=String(buf).replace(/<script[^>]*src="https:[^"]*supabase[^"]*"[^>]*><\/script>/g, '<script src="/__manual_fixture.js'+guest+'"></script>');
  }
  res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(buf);
 });
}).listen(8771,'127.0.0.1',()=>console.log('Fixture app: http://127.0.0.1:8771'));
