function setupUI() {
    const mapPanel = document.getElementById('js-map-panel'); const dock = document.getElementById('js-dock'); const sidebar = document.getElementById('js-sidebar');
    if(OrigenDrone && OrigenDrone.lat && OrigenDrone.lng) { const gmap = document.getElementById('js-gmap-iframe'); const btnDir = document.getElementById('js-directions-btn'); if(gmap) gmap.src = `https://maps.google.com/maps?q=${OrigenDrone.lat},${OrigenDrone.lng}&t=k&z=16&ie=UTF8&iwloc=&output=embed`; if(btnDir) btnDir.href = `https://www.google.com/maps/dir/?api=1&destination=${OrigenDrone.lat},${OrigenDrone.lng}`; }
    const btnMap = document.getElementById('js-location-btn'); if(btnMap && mapPanel) { btnMap.addEventListener('click', (e) => { e.stopPropagation(); mapPanel.classList.toggle('open'); if(sidebar) sidebar.classList.remove('open'); }); }
    const btnCloseMap = document.getElementById('js-close-map'); if(btnCloseMap) { btnCloseMap.addEventListener('click', (e) => { e.stopPropagation(); mapPanel.classList.remove('open'); }); }
    const btnLotes = document.getElementById('js-toggle-btn'); if(btnLotes && sidebar) { btnLotes.addEventListener('click', (e) => { e.stopPropagation(); sidebar.classList.toggle('open'); if(mapPanel) mapPanel.classList.remove('open'); }); }
    const btnGps = document.getElementById('js-btn-gps'); if (btnGps) { btnGps.addEventListener('click', () => { btnGps.innerText = "Sincronizando satélites..."; if (navigator.geolocation) { navigator.geolocation.getCurrentPosition( async (pos) => { const lat = pos.coords.latitude; const lon = pos.coords.longitude; if (OrigenDrone && OrigenDrone.lat) { const est = await calcularRutaCompleta(lat, lon, OrigenDrone.lat, OrigenDrone.lng); btnGps.style.display = 'none'; document.getElementById('js-gps-result').style.display = 'block'; document.getElementById('js-gps-km').innerText = est.km; document.getElementById('js-gps-min').innerText = est.min; } else { btnGps.innerText = "Error: Drone sin origen"; } }, (err) => { btnGps.innerText = "Acceso GPS Denegado"; }, { enableHighAccuracy: true } ); } else { btnGps.innerText = "GPS No Soportado"; } }); }
}

function renderSidebarList(lista) {
    const container = document.getElementById("js-lotes-list"); if(!container) return; container.innerHTML = "";
    let favs = JSON.parse(localStorage.getItem('mp360_favs') || '[]'); const activeBtn = document.querySelector(".filter-btn.active"); const filtroStatus = activeBtn ? activeBtn.getAttribute("data-status") : "todos";
    lista.forEach(lote => { 
        if(lote.tipo !== 'lote') return; 
        if (filtroStatus === 'favoritos' && !favs.includes(lote.id)) return;
        const isFav = favs.includes(lote.id); const heartHtml = isFav ? '<span style="color:#f43f5e; font-size:10px; margin-right:4px;">❤️</span>' : '';
        const item = document.createElement("div"); item.classList.add("lote-item"); 
        item.innerHTML = `<div class="lote-item-info"><h4>${heartHtml}<span>${lote.numero}</span> ${lote.titulo}</h4><p>${lote.superficie}</p></div><span class="badge ${lote.status}">${lote.status.substring(0,4)} .</span>`; 
        item.addEventListener("click", () => { visor360.lookAt(lote.pitch, lote.yaw, 80, 1500); }); 
        container.appendChild(item); 
    });
}

function setupFilters() {
    document.querySelectorAll(".filter-btn").forEach(btn => { 
        btn.addEventListener("click", (e) => { 
            document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active")); e.target.classList.add("active"); refreshAllHotspots(); 
            const status = e.target.getAttribute("data-status"); let sumP = 0, sumY = 0, c = 0; 
            getHotspotsConfig().forEach(hs => { if (hs.createTooltipFunc === generarSmartPin && hs.createTooltipArgs) { if (status === 'todos' || hs.createTooltipArgs.status === status || status === 'favoritos') { sumP += hs.pitch; sumY += hs.yaw; c++; } } }); 
            if (c > 0) visor360.lookAt(sumP / c, sumY / c, status === 'todos' ? 125 : 85, 2000); 
        }); 
    });
}

window.abrirRutaServicio = function(categoria, event) { if(event) event.stopPropagation(); if(!OrigenDrone || !OrigenDrone.lat) { alert("⚠️ Ubicación del proyecto no definida.\nEl administrador debe fijar el 'Origen Drone' en el Panel de Control para buscar servicios exactos."); return; } const url = `https://www.google.com/maps/search/${encodeURIComponent(categoria)}/@${OrigenDrone.lat},${OrigenDrone.lng},14z`; window.open(url, '_blank'); document.getElementById('js-poi-panel')?.classList.remove('open'); }
document.addEventListener("DOMContentLoaded", () => { const btnTrigger = document.getElementById('js-poi-trigger'); const panelPoi = document.getElementById('js-poi-panel'); const btnClosePoi = document.getElementById('js-close-poi'); if(btnTrigger && panelPoi) { btnTrigger.addEventListener('click', (e) => { e.stopPropagation(); panelPoi.classList.toggle('open'); document.getElementById('js-sidebar')?.classList.remove('open'); document.getElementById('js-map-panel')?.classList.remove('open'); }); } if(btnClosePoi) { btnClosePoi.addEventListener('click', (e) => { e.stopPropagation(); panelPoi.classList.remove('open'); }); } document.getElementById('panorama-container').addEventListener('mousedown', () => { panelPoi?.classList.remove('open'); }); document.getElementById('panorama-container').addEventListener('touchstart', () => { panelPoi?.classList.remove('open'); }, {passive: true}); });

let galeriaActiva = []; let galeriaIndiceActual = 0;
window.abrirGaleriaLote = function(loteId, event) { if(event) event.stopPropagation(); const lote = BaseDatosLotes.find(l => l.id === loteId); if(!lote || !lote.galeria || lote.galeria.length === 0) return; galeriaActiva = lote.galeria; galeriaIndiceActual = 0; document.getElementById('mac-g-title').innerText = lote.titulo || "Galería de Lote"; renderizarThumbs(); cargarFotoPrincipal(0); document.getElementById('mac-gallery-modal').classList.add('open'); }
window.cerrarGaleriaLote = function() { document.getElementById('mac-gallery-modal').classList.remove('open'); document.getElementById('img-gallery-main').classList.remove('zoomed'); setTimeout(() => { document.getElementById('img-gallery-main').src = ""; }, 300); }
window.navegarGaleria = function(direccion) { galeriaIndiceActual += direccion; if (galeriaIndiceActual < 0) galeriaIndiceActual = galeriaActiva.length - 1; if (galeriaIndiceActual >= galeriaActiva.length) galeriaIndiceActual = 0; cargarFotoPrincipal(galeriaIndiceActual); }
function renderizarThumbs() { const container = document.getElementById('mac-g-thumbs-container'); container.innerHTML = ''; galeriaActiva.forEach((url, index) => { const img = document.createElement('img'); img.src = url; img.className = `mac-g-thumb ${index === 0 ? 'active' : ''}`; img.onclick = () => cargarFotoPrincipal(index); container.appendChild(img); }); }
function cargarFotoPrincipal(index) { galeriaIndiceActual = index; const mainImg = document.getElementById('img-gallery-main'); mainImg.classList.remove('zoomed'); mainImg.src = galeriaActiva[index]; document.querySelectorAll('.mac-g-thumb').forEach((thumb, i) => { thumb.classList.toggle('active', i === index); }); }

window.compartirLote = function(numero, titulo, event) { if(event) event.stopPropagation(); const url = window.location.origin + window.location.pathname + '?lote=' + numero; if (navigator.share) { navigator.share({ title: titulo || 'Mira este lote', text: 'He estado revisando este Masterplan y me interesó este terreno. Míralo aquí:', url: url }).catch(()=>{}); } else { navigator.clipboard.writeText(url).then(() => { alert('✅ Enlace directo copiado al portapapeles.\nPuedes pegarlo en WhatsApp o correo.'); }); } }
window.toggleFavorite = function(loteId, event, btnEl) { if(event) event.stopPropagation(); let favs = JSON.parse(localStorage.getItem('mp360_favs') || '[]'); if(favs.includes(loteId)) { favs = favs.filter(id => id !== loteId); btnEl.classList.remove('active'); btnEl.innerHTML = '🤍'; } else { favs.push(loteId); btnEl.classList.add('active'); btnEl.innerHTML = '❤️'; } localStorage.setItem('mp360_favs', JSON.stringify(favs)); const activeFilter = document.querySelector('.filter-btn.active'); if(activeFilter && activeFilter.getAttribute('data-status') === 'favoritos') { document.querySelector('.filter-btn[data-status="favoritos"]').click(); } else { renderSidebarList(BaseDatosLotes); } }

function setupSunEngine() {
    const btn = document.getElementById('js-sun-btn'); const hud = document.getElementById('sun-hud'); if(!btn || !hud) return;
    btn.addEventListener('click', () => {
        if(!visor360) return; let este = NorteOffset + 90; let norteMediodia = NorteOffset; let oeste = NorteOffset - 90;
        document.getElementById('js-sidebar')?.classList.remove('open'); document.getElementById('js-map-panel')?.classList.remove('open'); document.getElementById('js-poi-panel')?.classList.remove('open');
        hud.innerText = "☀️ AMANECER (ESTE)"; hud.classList.add('show'); visor360.lookAt(5, este, 110, 2000);
        setTimeout(() => { hud.innerText = "☀️ MEDIODÍA SOLAR (NORTE)"; visor360.lookAt(45, norteMediodia, 110, 3500); 
            setTimeout(() => { hud.innerText = "☀️ ATARDECER (OESTE)"; visor360.lookAt(5, oeste, 110, 3500); setTimeout(() => { hud.classList.remove('show'); }, 3500); }, 4000);
        }, 2500);
    });
}