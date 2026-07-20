@echo off
title KPK - Voz Dalia (humana)
cd /d "%~dp0\.."

echo.
echo  ========================================
echo   Arrancando voz humana Dalia Neural...
echo  ========================================
echo.

start "KPK-TTS-Proxy" cmd /k "node tools\tts-proxy.js"
timeout /t 2 /nobreak >nul

start "KPK-App" cmd /k "node -e \"const http=require('http');const fs=require('fs');const path=require('path');const root=process.cwd();const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.mp3':'audio/mpeg','.woff2':'font/woff2','.webp':'image/webp'};http.createServer((req,res)=>{let u=decodeURIComponent((req.url||'/').split('?')[0]);if(u==='/')u='/index.html';const fp=path.join(root,u.replace(/\//g,path.sep));fs.readFile(fp,(e,data)=>{if(e){res.writeHead(404);return res.end('not found');}res.writeHead(200,{'Content-Type':mime[path.extname(fp)]||'application/octet-stream','Cache-Control':'no-store'});res.end(data);});}).listen(8765,'127.0.0.1',()=>console.log('App: http://127.0.0.1:8765'));\""

timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:8765/index.html"

echo.
echo  Listo.
echo  - Proxy Dalia: http://127.0.0.1:8787
echo  - App:         http://127.0.0.1:8765
echo  NO cierres las ventanas negras mientras uses el chat.
echo.
pause
