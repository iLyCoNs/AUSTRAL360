/**
 * f-device.js — Detección de capacidad del dispositivo para adaptar Ferrari360
 *
 * Tier (high / mid / low) → archivo panorama pre-escalado (sin resize JS):
 *   high → loteo360.jpg (12000) si la GPU aguanta; si no, 4096
 *   mid  → loteo360-4096.jpg
 *   low  → loteo360-2048.jpg
 *
 * Nunca reescalar el equirect de 41MB en el navegador móvil: cuelga en
 * "Ajustando resolución…". Los JPG mid/low se generan con tools/gen-pano-variants.py
 *
 * Override URL: ?tex=2048|4096|8192  o  ?tier=low|mid|high
 */

'use strict';

(function() {

  const ORIGINAL_WIDTH  = 12000;
  const ORIGINAL_HEIGHT = 6000;

  const LIMITS = {
    high: 8192,
    mid:  4096,
    low:  2048
  };

  const PANO = {
    full: { url: 'loteo360.jpg', width: ORIGINAL_WIDTH, height: ORIGINAL_HEIGHT },
    mid:  { url: 'loteo360-4096.jpg', width: 4096, height: 2048 },
    low:  { url: 'loteo360-2048.jpg', width: 2048, height: 1024 }
  };

  let _tier  = 'high';
  let _limit = LIMITS.high;
  let _maxTexSize = 0;
  let _detected   = false;
  let _externalTexSize = 0;
  let _isTablet = false;
  let _isPhone = false;
  let _maxDpr = 2;
  let _panoUrl = PANO.full.url;

  function _ua() {
    return (navigator.userAgent || '').toLowerCase();
  }

  function _isSamsungDevice() {
    var ua = _ua();
    return ua.indexOf('samsung') >= 0 ||
           ua.indexOf('galaxy') >= 0 ||
           /sm-[a-z0-9]+/i.test(navigator.userAgent || '');
  }

  function _detectPhone() {
    var ua = _ua();
    try {
      if (navigator.userAgentData && navigator.userAgentData.mobile === true) return true;
    } catch (e) {}
    if (/iphone|ipod|windows phone/.test(ua)) return true;
    if (/android/.test(ua) && !_detectTablet()) return true;
    var w = Math.max(screen.width || 0, screen.height || 0);
    var h = Math.min(screen.width || 0, screen.height || 0);
    if (/android|mobile/.test(ua) && w > 0 && h > 0 && (w / h) >= 1.6 && w < 1400) return true;
    return false;
  }

  function _detectTablet() {
    var ua = _ua();
    var screenW = Math.max(screen.width || 0, screen.height || 0);
    var screenH = Math.min(screen.width || 0, screen.height || 0);
    if (/sm-t7|sm-t8|sm-t9|sm-x7|sm-x8|galaxy tab|gts7|gts8|gts9/.test(ua)) return true;
    if (ua.indexOf('android') >= 0 && screenW >= 1000 && (screenW / Math.max(1, screenH)) < 1.6) return true;
    if (ua.indexOf('tablet') >= 0) return true;
    try {
      if (navigator.userAgentData && navigator.userAgentData.mobile === false &&
          ua.indexOf('android') >= 0 && screenW >= 1200) return true;
    } catch (e) {}
    return false;
  }

  function _urlOverride() {
    try {
      var q = new URLSearchParams(window.location.search);
      var tex = parseInt(q.get('tex'), 10);
      var tier = (q.get('tier') || '').toLowerCase();
      if (tex === 2048 || tex === 4096 || tex === 8192) {
        return { tier: tex <= 2048 ? 'low' : (tex <= 4096 ? 'mid' : 'high'), maxWidth: tex };
      }
      if (tier === 'low' || tier === 'mid' || tier === 'high') {
        return { tier: tier, maxWidth: LIMITS[tier] };
      }
    } catch (e) {}
    return null;
  }

  /** Pannellum equirect: falla si max(width/2, height) > MAX_TEXTURE_SIZE */
  function _gpuFits(width, height) {
    if (!_maxTexSize || _maxTexSize <= 0) return true;
    return Math.max(width / 2, height) <= _maxTexSize;
  }

  /**
   * Elige JPG pre-escalado. Nunca requiere resize en el navegador.
   * @param {number} [forcedMaxWidth]
   */
  function pickPanorama(forcedMaxWidth) {
    detect();
    var force = forcedMaxWidth > 0 ? forcedMaxWidth : 0;

    function choose() {
      if (force > 0) {
        if (force <= 2048) return PANO.low;
        if (force <= 4096) {
          if (_gpuFits(PANO.mid.width, PANO.mid.height)) return PANO.mid;
          return PANO.low;
        }
        if (_gpuFits(PANO.full.width, PANO.full.height)) return PANO.full;
        if (_gpuFits(PANO.mid.width, PANO.mid.height)) return PANO.mid;
        return PANO.low;
      }

      // Tablets: 4096 (fluido). Teléfonos high con GPU OK: original.
      if (_isTablet) {
        if (_tier === 'low' || !_gpuFits(PANO.mid.width, PANO.mid.height)) return PANO.low;
        return PANO.mid;
      }

      if (_tier === 'low') return PANO.low;

      if (_tier === 'mid') {
        if (_gpuFits(PANO.mid.width, PANO.mid.height)) return PANO.mid;
        return PANO.low;
      }

      // high
      if (_gpuFits(PANO.full.width, PANO.full.height)) return PANO.full;
      if (_gpuFits(PANO.mid.width, PANO.mid.height)) return PANO.mid;
      return PANO.low;
    }

    var pick = choose();

    _panoUrl = pick.url;
    _limit = pick.width;
    return {
      url: pick.url,
      width: pick.width,
      height: pick.height,
      tier: _tier,
      maxTextureSize: _maxTexSize,
      isTablet: _isTablet,
      isPhone: _isPhone,
      maxDpr: _maxDpr
    };
  }

  function detect() {
    if (_detected) {
      return {
        tier: _tier,
        maxWidth: _limit,
        maxTextureSize: _maxTexSize,
        isTablet: _isTablet,
        isPhone: _isPhone,
        maxDpr: _maxDpr,
        panoramaUrl: _panoUrl
      };
    }
    _detected = true;
    _isTablet = _detectTablet();
    _isPhone = !_isTablet && _detectPhone();

    var override = _urlOverride();
    if (override) {
      _tier = override.tier;
      _limit = override.maxWidth;
      if (_isTablet && _limit > LIMITS.mid && !override.maxWidth) {
        _limit = LIMITS.mid;
        _tier = 'mid';
      }
      // ?tex=8192 en tablet → mid file (nunca JS resize a 8K)
      if (_isTablet && _limit > LIMITS.mid) {
        _limit = LIMITS.mid;
        _tier = 'mid';
      }
      _maxTexSize = _detectMaxTextureSize();
      _maxDpr = _tier === 'high' ? 2 : (_tier === 'mid' ? 1.35 : 1.15);
      var picked = pickPanorama(_limit);
      console.log('[Ferrari/Device] Override URL → Tier:', _tier, '| pano:', picked.url,
        '| phone:', _isPhone, '| tablet:', _isTablet);
      return {
        tier: _tier,
        maxWidth: picked.width,
        maxTextureSize: _maxTexSize,
        isTablet: _isTablet,
        isPhone: _isPhone,
        maxDpr: _maxDpr,
        panoramaUrl: picked.url
      };
    }

    var score = 0;
    _maxTexSize = _detectMaxTextureSize();

    var mem = navigator.deviceMemory;
    if (mem !== undefined) {
      if (mem >= 6)      score += 3;
      else if (mem >= 4) score += 2;
      else               score += 1;
    } else {
      score += 2;
    }

    var cores = navigator.hardwareConcurrency;
    if (cores !== undefined) {
      if (cores >= 8)      score += 3;
      else if (cores >= 4) score += 2;
      else                 score += 1;
    } else {
      score += 2;
    }

    var screenPx = (screen.width || 1920) * (screen.height || 1080);
    if (screenPx > 4000000)      score += 2;
    else if (screenPx > 2000000) score += 1;

    var isSamsung = _isSamsungDevice();
    if (isSamsung && ((cores !== undefined && cores <= 8) || (mem !== undefined && mem <= 6))) {
      score -= 1;
    }

    if (_isTablet || (isSamsung && Math.max(screen.width || 0, screen.height || 0) >= 1800)) {
      score -= 2;
      if (score >= 6) score = 5;
    }

    if (_maxTexSize > 0) {
      if (_maxTexSize >= 8192)      score += 2;
      else if (_maxTexSize >= 4096) score += 0;
      else                          score -= 2;
    }

    if (score >= 6) { _tier = 'high'; _limit = LIMITS.high; }
    else if (score >= 3) { _tier = 'mid'; _limit = LIMITS.mid; }
    else { _tier = 'low'; _limit = LIMITS.low; }

    if (_isTablet && _tier === 'high') {
      _tier = 'mid';
      _limit = LIMITS.mid;
    }

    if (_tier === 'high') _maxDpr = 2;
    else if (_tier === 'mid') _maxDpr = (_isTablet || _isPhone) ? 1.35 : 1.5;
    else _maxDpr = 1.15;

    var pano = pickPanorama();
    _limit = pano.width;
    _panoUrl = pano.url;

    console.log('[Ferrari/Device] Tier:', _tier, '| pano:', _panoUrl,
      '| MAX_TEXTURE_SIZE:', _maxTexSize, '| score:', score,
      '| phone:', _isPhone, '| tablet:', _isTablet, '| maxDpr:', _maxDpr);

    return {
      tier: _tier,
      maxWidth: _limit,
      maxTextureSize: _maxTexSize,
      isTablet: _isTablet,
      isPhone: _isPhone,
      maxDpr: _maxDpr,
      panoramaUrl: _panoUrl
    };
  }

  function setMaxTextureSize(size) {
    _externalTexSize = size;
  }

  function _detectMaxTextureSize() {
    if (_externalTexSize > 0) return _externalTexSize;
    var c = document.createElement('canvas');
    var names = ['webgl2', 'webgl', 'experimental-webgl'];
    var gl = null;
    for (var i = 0; i < names.length && !gl; i++) {
      try { gl = c.getContext(names[i], { alpha: false, depth: false }); } catch (e) {}
    }
    if (!gl) return 0;
    var size = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    var lose = gl.getExtension('WEBGL_lose_context');
    if (lose) lose.loseContext();
    return size;
  }

  function needsDownscale() {
    detect();
    return false; // variantes pre-escaladas; no resize JS
  }

  function getMaxWidth() {
    detect();
    return _limit;
  }

  function getTier() {
    detect();
    return _tier;
  }

  function getPanoramaUrl() {
    detect();
    return _panoUrl;
  }

  function isTablet() {
    detect();
    return _isTablet;
  }

  function isPhone() {
    detect();
    return _isPhone;
  }

  function getMaxDpr() {
    detect();
    return _maxDpr;
  }

  function getOriginalWidth() { return ORIGINAL_WIDTH; }
  function getOriginalHeight() { return ORIGINAL_HEIGHT; }

  /** Baja un escalón: high→4096 file, mid→2048 file */
  function stepDown() {
    detect();
    if (_tier === 'high' || _limit > 4096) {
      _tier = 'mid';
      _limit = LIMITS.mid;
    } else if (_tier === 'mid' || _limit > 2048) {
      _tier = 'low';
      _limit = LIMITS.low;
    } else if (_limit > 1024) {
      _limit = 1024;
    }
    _maxDpr = (_isPhone || _isTablet || _tier === 'low') ? 1.1 : 1.25;
    var pano = pickPanorama(_limit);
    console.warn('[Ferrari/Device] stepDown →', _tier, pano.url);
    return {
      tier: _tier,
      maxWidth: pano.width,
      maxTextureSize: _maxTexSize,
      isTablet: _isTablet,
      isPhone: _isPhone,
      maxDpr: _maxDpr,
      panoramaUrl: pano.url
    };
  }

  window.FerrariDevice = {
    detect: detect,
    needsDownscale: needsDownscale,
    getMaxWidth: getMaxWidth,
    getTier: getTier,
    getPanoramaUrl: getPanoramaUrl,
    pickPanorama: pickPanorama,
    isTablet: isTablet,
    isPhone: isPhone,
    getMaxDpr: getMaxDpr,
    stepDown: stepDown,
    setMaxTextureSize: setMaxTextureSize,
    getOriginalWidth: getOriginalWidth,
    getOriginalHeight: getOriginalHeight,
    PANO: PANO
  };

  console.log('[Ferrari/Device] ✓ Módulo cargado');

})();
