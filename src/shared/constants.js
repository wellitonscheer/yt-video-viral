// Globals para content scripts; service worker importa via importScripts ou usa cópia.
var YTVV = (typeof YTVV !== 'undefined') ? YTVV : {};

YTVV.CONSTANTS = {
  CACHE_TTL_MS: 24 * 60 * 60 * 1000,
  RATIO_THRESHOLD: 1.0,
  PROCESSED_ATTR: 'data-ytvv-processed',
  BADGE_CLASS: 'ytvv-badge',
  MSG_GET_SUBS: 'YTVV_GET_SUBS',
  LOG_PREFIX: '[YTVV]',
  DEBUG: false
};

// console.log('[YTVV] constants.js carregado');
