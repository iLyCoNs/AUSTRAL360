function generarSmartPin(hotSpotDiv, args) {
    hotSpotDiv.style.width = '0px'; hotSpotDiv.style.height = '0px'; hotSpotDiv.setAttribute('data-status', args.status || 'disponible');
    hotSpotDiv.setAttribute('data-pitch', args.pitch); hotSpotDiv.setAttribute('data-yaw', args.yaw);
    hotSpotDiv.addEventListener('mouseenter', () => { hotSpotDiv.style.zIndex = '999999'; }); hotSpotDiv.addEventListener('mouseleave', () => { hotSpotDiv.style.zIndex = ''; });
    
    // TRUCO SUPREMO ARQUITECTO 2.0: Mover físicamente el pin fuera del encierro WebGL
    const hologui = document.getElementById('holographic-ui-engine');
    if (hologui && hotSpotDiv.parentElement !== hologui) {
        hologui.appendChild(hotSpotDiv);
    }
    
    let numeroLote = args.numero || '00'; let tiene360 = args.videoUrl ? 'has-360' : ''; let favs = JSON.parse(localStorage.getItem('mp360_favs') || '[]'); let isFav = favs.includes(args.id);
    const wrapper = document.createElement('div'); wrapper.className = `smart-pin-wrapper ${tiene360}`; wrapper.setAttribute('data-status', args.status || 'disponible');
    const scaler = document.createElement('div'); scaler.classList.add('pin-scaler');
    const pinContainer = document.createElement('div'); pinContainer.classList.add('pin-teardrop-container');
    pinContainer.innerHTML = `<div class="pin-teardrop-body"><div class="pin-teardrop-core">${numeroLote}</div></div><div class="pin-status-badge ${args.status || 'disponible'}"></div>`;
    const card = document.createElement('div'); card.classList.add('lote-card');
    const vis = getCardVis(args);
    
    let videoBtn = '';
    if (args.videoUrl) {
        card.classList.add('lote-card-video'); const isYouTube = args.videoUrl.toLowerCase().includes('youtube.com') || args.videoUrl.toLowerCase().includes('youtu.be');
        if (isYouTube) { videoBtn = `<button onclick="openInAppViewer(event, '${args.videoUrl}')" class="btn-action-new youtube-btn full" title="Ver en YouTube"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/></svg> Ver Recorrido</button>`;
        } else { videoBtn = `<button onclick="openInAppViewer(event, '${args.videoUrl}')" class="btn-action-new video full" title="Explorar Inmersión"><svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg> Explorar Inmersión</button>`; }
    }

    let precioCLP_HTML = ''; let rawPrice = (args.precio || '0').toString().toUpperCase();
    if(vis.precioCLP && (rawPrice.includes('UF') || rawPrice.includes('U.F.'))) {
        let cleanNum = rawPrice.replace(/UF|U\.F\.|/g, '').trim(); cleanNum = cleanNum.replace(/\./g, ''); cleanNum = cleanNum.replace(',', '.'); 
        let numPrecio = parseFloat(cleanNum); let ufFinal = UF_Online > 0 ? UF_Online : (ConfigProyecto.valorUF || 37500);
        if(numPrecio > 0 && ufFinal > 0) {
            let totalCLP = Math.round(numPrecio * ufFinal); let totalFormatted = "$" + totalCLP.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
            let colorCLP = (args.status === 'vendido' || args.status === 'no_disponible') ? '#86868b' : '#10b981';
            let decoration = (args.status === 'vendido' || args.status === 'no_disponible') ? 'text-decoration: line-through;' : '';
            precioCLP_HTML = `<div style="font-size: 11px; font-weight: 800; color: ${colorCLP}; margin-top: -10px; margin-bottom: 12px; letter-spacing: 0.5px; ${decoration}">≈ ${totalFormatted} CLP</div>`;
        }
    }

    let actionGrid = '';
    if (vis.acciones) {
        actionGrid = `<div class="card-actions-grid">`; let galeriaBtn = '';
        if (args.galeria && args.galeria.length > 0) { galeriaBtn = `<button onclick="window.abrirGaleriaLote('${args.id}', event)" class="btn-action-new full" style="background: rgba(10, 132, 255, 0.1); color: #0A84FF; border-color: rgba(10, 132, 255, 0.2);" title="Ver Fotos"><svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg> Ver Fotos (${args.galeria.length})</button>`; }
        let shareBtn = `<button onclick="window.compartirLote('${args.numero}', '${args.titulo}', event)" class="btn-action-new share" title="Compartir Lote"><svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg> Compartir</button>`;
        if (args.status === 'disponible') { 
            actionGrid += `<a href="https://wa.me/569XXXXXXXX" target="_blank" class="btn-action-new whatsapp" draggable="false"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.275-.883-.628-1.48-1.403-1.653-1.702-.173-.299-.018-.461.13-.611.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/></svg> Agendar</a>`;
            actionGrid += shareBtn; if(args.videoUrl) actionGrid += videoBtn; if(galeriaBtn) actionGrid += galeriaBtn; 
        } else { actionGrid += `<div class="btn-action-new disabled">${(args.status || 'NO DISP.').toUpperCase()}</div>`; actionGrid += shareBtn; if(args.videoUrl) actionGrid += videoBtn; if(galeriaBtn) actionGrid += galeriaBtn; }
        actionGrid += `</div>`;
    }
    const statusText = (args.status || 'disponible').replace('_', ' ');
    const titleHtml = buildCardTitleHTML(args, vis);
    const priceHtml = vis.precio ? `<div class="card-price" style="${precioCLP_HTML && vis.precioCLP ? 'margin-bottom:2px;' : ''}">${args.precio || 'UF 0'}</div>` : '';
    const clpHtml = vis.precioCLP ? precioCLP_HTML : '';
    const specParts = [];
    if (vis.superficie) specParts.push(`<div class="spec-item"><span>Superficie</span><b>${args.superficie || '0 m²'}</b></div>`);
    if (vis.terreno) specParts.push(`<div class="spec-item"><span>Terreno</span><b>${args.terreno || 'Plano'}</b></div>`);
    const specsHtml = specParts.length ? `<div class="card-specs">${specParts.join('')}</div>` : '';
    let favHtml = '';
    if (vis.favorito) {
        let favIcon = isFav ? '❤️' : '🤍'; let favClass = isFav ? 'card-fav-btn active' : 'card-fav-btn';
        favHtml = `<button onclick="window.toggleFavorite('${args.id}', event, this)" class="${favClass}" title="Añadir a Favoritos">${favIcon}</button>`;
    }
    const imgHtml = vis.imagen ? `<div class="card-img-box">${favHtml}<img src="${args.imagen}" alt="Lote" draggable="false">${vis.statusPill ? `<div class="card-status-pill ${args.status || 'disponible'}">${statusText}</div>` : ''}</div>` : (favHtml ? `<div class="card-img-box card-img-box--compact">${favHtml}</div>` : '');
    card.innerHTML = `${imgHtml}<div class="card-content">${titleHtml}${priceHtml}${clpHtml}${specsHtml}${actionGrid}</div>`;
        
    scaler.appendChild(pinContainer); wrapper.appendChild(scaler); wrapper.appendChild(card); addQuickActions(wrapper, args); hotSpotDiv.appendChild(wrapper); bindPinEvents(pinContainer, args, hotSpotDiv);
}

function generarPin360(hotSpotDiv, args) {
    hotSpotDiv.style.width = '0px'; hotSpotDiv.style.height = '0px'; 
    hotSpotDiv.addEventListener('mouseenter', () => { hotSpotDiv.style.zIndex = '999999'; }); 
    hotSpotDiv.addEventListener('mouseleave', () => { hotSpotDiv.style.zIndex = ''; });
    
    // TRUCO SUPREMO ARQUITECTO 2.0: Mover físicamente el pin fuera del encierro WebGL
    const hologui = document.getElementById('holographic-ui-engine');
    if (hologui && hotSpotDiv.parentElement !== hologui) {
        hologui.appendChild(hotSpotDiv);
    }
    const wrapper = document.createElement('div'); wrapper.classList.add('smart-pin-wrapper', 'has-360');
    const scaler = document.createElement('div'); scaler.classList.add('pin-scaler');
    const pin = document.createElement('div'); pin.classList.add('pin-360'); pin.innerHTML = `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg> <span style="font-size:12px; margin-left:4px; font-weight:800;">360°</span>`;
    const card = document.createElement('div'); card.classList.add('portal-card');
    card.innerHTML = `<div class="portal-img-container"><img src="https://images.unsplash.com/photo-1542224566-6e85f2e6772f?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80" alt="Vista 360" draggable="false"></div><div class="portal-overlay"><div class="portal-title">${args.titulo || 'VISTA 360'}</div><button onclick="openInAppViewer(event, '${args.url}')" class="portal-btn"><svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg> Explorar Entorno</button></div>`;
    scaler.appendChild(pin); wrapper.appendChild(scaler); wrapper.appendChild(card); addQuickActions(wrapper, args); hotSpotDiv.appendChild(wrapper); bindPinEvents(pin, args, hotSpotDiv);
}

function generarMarcadorHorizonte(hotSpotDiv, args) {
    hotSpotDiv.style.width = '0px'; hotSpotDiv.style.height = '0px';
    hotSpotDiv.setAttribute('data-pitch', args.pitch); hotSpotDiv.setAttribute('data-yaw', args.yaw);
    
    // TRUCO SUPREMO ARQUITECTO 2.0: Mover físicamente el pin fuera del encierro WebGL
    const hologui = document.getElementById('holographic-ui-engine');
    if (hologui && hotSpotDiv.parentElement !== hologui) {
        hologui.appendChild(hotSpotDiv);
    }
    const wrapper = document.createElement('div'); wrapper.className = 'horizon-hud-wrapper';
    const links = getNavPinLinks(args);
    const distTxt = args.distancia || '0 KM';
    const timeTxt = (args.tiempo || '0 MIN').replace(/^~/, '');
    const trafficLine = args.rutaEtiquetaTrafico || 'Estimación con tráfico Chile';

    wrapper.innerHTML = `<div class="horizon-detail-card"><div class="hdc-head"><svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg> ${args.titulo || 'Destino'}</div><div class="hdc-metrics"><span>Distancia <b>${distTxt}</b></span><span>Tiempo <b>~${timeTxt}</b></span></div><div class="hdc-traffic">${trafficLine}</div><div class="hdc-nav-row"><a href="${links.linkWaze}" target="_blank" class="hdc-nav-btn waze" draggable="false">${SVG_WAZE} Waze</a><a href="${links.linkGmapsFromProject}" target="_blank" class="hdc-nav-btn gmaps" draggable="false">${SVG_MAPS_PIN} Maps</a></div></div><div class="ruta-glass-pill">${buildNavGlassPillMarkup(args, { title: args.titulo || 'HORIZONTE', horizonMobileExpand: true })}</div><div class="ruta-line-down"></div><div class="ruta-target-dot"></div>`;
    hotSpotDiv.appendChild(wrapper); addQuickActions(wrapper, args);
    const pill = wrapper.querySelector('.ruta-glass-pill');
    bindPinEvents(pill || wrapper, args, hotSpotDiv);
}

function generarMarcadorRuta(hotSpotDiv, args) {
    hotSpotDiv.style.width = '0px'; hotSpotDiv.style.height = '0px';
    hotSpotDiv.setAttribute('data-pitch', args.pitch); hotSpotDiv.setAttribute('data-yaw', args.yaw);

    // TRUCO SUPREMO ARQUITECTO 2.0: Mover físicamente el pin fuera del encierro WebGL
    const hologui = document.getElementById('holographic-ui-engine');
    if (hologui && hotSpotDiv.parentElement !== hologui) {
        hologui.appendChild(hotSpotDiv);
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'ruta-hud-wrapper';
    // El anchor hotspot está en bottom:0 left:0 — el wrapper se pinta encima del punto

    const links = getNavPinLinks(args);
    const distArr = parseMetricaRuta(args.distancia, 'KM');
    const timeArr = parseMetricaRuta(args.tiempo, 'MIN');
    const title   = (args.titulo || 'RUTA').toUpperCase();
    const trafficTip = args.rutaEtiquetaTrafico ? ` title="${args.rutaEtiquetaTrafico.replace(/"/g, '&quot;')}"` : '';
    const trfBadge = `<span class="ruta-traffic-badge">TRF</span>`;

    // SVG flecha derecha > (idéntico a la foto — colapso)
    const SVG_ARROW_RIGHT = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="pointer-events:none"><path d="M9 18l6-6-6-6"/></svg>`;

    // Bloque de métricas (distancia + tiempo) — visible al expandir
    const pillExtra = `<div class="ruta-divider"></div><div class="ruta-metrics">` +
        `<span class="ruta-val">${distArr.v}<small>${distArr.u}</small></span>` +
        `<span class="ruta-val"${trafficTip}>~${timeArr.v}<small>${timeArr.u}</small>${trfBadge}</span>` +
        `</div>` +
        `<div class="ruta-links">` +
        `<a href="${links.linkWaze}" target="_blank" class="r-link waze" title="Ir con Waze" draggable="false">${SVG_WAZE}</a>` +
        `<a href="${links.linkGmapsFromProject}" target="_blank" class="r-link gmaps" title="Ir con Google Maps" draggable="false">${SVG_MAPS_PIN}</a>` +
        `</div>`;

    // Botón flecha naranja pulsante (> colapso / ↓ expandido)
    const arrowBtn = `<button type="button" class="ruta-expand-arrow" aria-label="Desplegar distancia y navegación">${SVG_ARROW_RIGHT}</button>`;

    // Glass pill completa
    const pillContent = `<span class="ruta-title">${title}</span>${arrowBtn}<div class="horizon-pill-extra">${pillExtra}</div>`;

    wrapper.innerHTML = `<div class="ruta-glass-pill">${pillContent}</div><div class="ruta-line-down"></div><div class="ruta-target-dot"></div>`;

    hotSpotDiv.appendChild(wrapper);
    addQuickActions(wrapper, args);

    const pill = wrapper.querySelector('.ruta-glass-pill');
    bindPinEvents(pill || wrapper, args, hotSpotDiv);
}

function generarMarcadorCasa360(hotSpotDiv, args) {
    hotSpotDiv.style.width = '0px'; hotSpotDiv.style.height = '0px';
    hotSpotDiv.setAttribute('data-pitch', args.pitch); hotSpotDiv.setAttribute('data-yaw', args.yaw);
    
    // TRUCO SUPREMO ARQUITECTO 2.0: Mover físicamente el pin fuera del encierro WebGL
    const hologui = document.getElementById('holographic-ui-engine');
    if (hologui && hotSpotDiv.parentElement !== hologui) {
        hologui.appendChild(hotSpotDiv);
    }
    const wrapper = document.createElement('div'); wrapper.className = 'casa-hud-wrapper';
    
    wrapper.innerHTML = `
        <div class="pin-scaler">
            <div class="casa-glass-card" onclick="openInAppViewer(event, '${args.url}')">
                <div class="casa-play-icon">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M4 2.69127C4 1.93067 4.81547 1.44851 5.48192 1.81506L22.4069 11.1238C23.0977 11.5037 23.0977 12.4963 22.4069 12.8762L5.48192 22.1849C4.81546 22.5515 4 22.0693 4 21.3087V2.69127Z"/></svg>
                </div>
                <span class="casa-title">${args.titulo || 'CASA TOUR'}</span>
            </div>
        </div>
    `;
    
    hotSpotDiv.appendChild(wrapper);
    addQuickActions(wrapper, args);
    bindPinEvents(wrapper.querySelector('.casa-glass-card'), args, hotSpotDiv);
}

// === PIN ORIGEN DRONE ===
// Pin visual en la escena 3D que marca el punto de aterrizaje del drone.
// Muestra las coordenadas lat/lng guardadas y permite abrirlas en Google Maps.
function generarMarcadorDrone(hotSpotDiv, args) {
    hotSpotDiv.style.width = '0px';
    hotSpotDiv.style.height = '0px';
    hotSpotDiv.setAttribute('data-pitch', args.pitch);
    hotSpotDiv.setAttribute('data-yaw', args.yaw);

    // Mover al holographic-ui-engine para que el Ferrari lo proyecte en 3D
    const hologui = document.getElementById('holographic-ui-engine');
    if (hologui && hotSpotDiv.parentElement !== hologui) {
        hologui.appendChild(hotSpotDiv);
    }

    const lat = args.lat || (window.OrigenDrone && window.OrigenDrone.lat) || '';
    const lng = args.lng || (window.OrigenDrone && window.OrigenDrone.lng) || '';
    const mapsUrl = lat && lng
        ? `https://www.google.com/maps?q=${lat},${lng}`
        : '#';

    const wrapper = document.createElement('div');
    wrapper.className = 'drone-hud-wrapper';
    wrapper.innerHTML = `
        <div class="drone-pin-card">
            <div class="drone-pin-icon">🚁</div>
            <div class="drone-pin-label">${args.titulo || 'ORIGEN DRONE'}</div>
            ${lat ? `<div class="drone-pin-coords">${parseFloat(lat).toFixed(5)}, ${parseFloat(lng).toFixed(5)}</div>` : ''}
            ${lat ? `<a href="${mapsUrl}" target="_blank" class="drone-pin-maps-btn">📍 Ver en Maps</a>` : ''}
        </div>
        <div class="ruta-line-down"></div>
        <div class="ruta-target-dot" style="background:#f59e0b;box-shadow:0 0 8px #f59e0b,0 0 16px #f59e0b80;"></div>
    `;

    hotSpotDiv.appendChild(wrapper);
}

// Exposición global para que Ferrari pueda invocarlas desde importPuntosHorizonte
window.generarMarcadorDrone     = generarMarcadorDrone;
window.generarMarcadorRuta      = generarMarcadorRuta;
window.generarMarcadorHorizonte = generarMarcadorHorizonte;
window.generarMarcadorCasa360   = generarMarcadorCasa360;
window.generarSmartPin          = generarSmartPin;
window.generarPin360            = generarPin360;
