// Rendered typography, layout, network, and APCA audit via Chrome DevTools
// Protocol. It drives the real planner, then checks computed styles rather than
// trusting source declarations. The 12px, overflow, footer/nav, console, and
// 4xx/5xx thresholds are intentionally strict and must not be relaxed.
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { APCA_THRESHOLDS, apcaPair, parseColor } from './apca-check.mjs'

const BASE_URL = process.env.BASE_URL ?? 'http://127.0.0.1:4173/EndfieldSkill/'
const CHROME =
  process.env.CHROME_BIN ??
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'

const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 900, mobile: false },
  { name: 'tablet-768', width: 768, height: 1024, mobile: true },
  { name: 'iphone-390', width: 390, height: 844, mobile: true },
  { name: 'iphone-393', width: 393, height: 852, mobile: true },
  { name: 'small-320', width: 320, height: 568, mobile: true },
]

const ROUTES = ['#/', '#/data']

function findFreePort() {
  return new Promise((resolve) => {
    const srv = createServer()
    srv.listen(0, '127.0.0.1', () => {
      const port = srv.address().port
      srv.close(() => resolve(port))
    })
  })
}

async function wsConnect(url) {
  const ws = new WebSocket(url)
  const queue = new Map()
  let eventHandler = null
  await new Promise((resolve, reject) => {
    ws.onopen = resolve
    ws.onerror = reject
  })
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data)
    if (msg.method) {
      if (eventHandler) eventHandler(msg)
      return
    }
    const handler = queue.get(msg.id)
    if (handler) {
      queue.delete(msg.id)
      handler(msg)
    }
  }
  let nextId = 1
  function send(method, params = {}) {
    const id = nextId++
    return new Promise((resolve) => {
      queue.set(id, resolve)
      ws.send(JSON.stringify({ id, method, params }))
    })
  }
  function call(sessionId, method, params = {}, timeoutMs = 20000) {
    const id = nextId++
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        queue.delete(id)
        reject(new Error(`CDP ${method} timed out after ${timeoutMs}ms`))
      }, timeoutMs)
      queue.set(id, (msg) => {
        clearTimeout(timer)
        resolve(msg ?? { id, error: { message: 'empty CDP response' } })
      })
      ws.send(JSON.stringify({ id, sessionId, method, params }))
    })
  }
  function dig(msg, ...keys) {
    let cur = msg
    for (const k of keys) {
      if (cur == null) return undefined
      cur = cur[k]
    }
    return cur
  }
  function setEventHandler(fn) {
    eventHandler = fn
  }
  return { ws, send, call, dig, setEventHandler }
}

const SCROLL_TO_BOTTOM_FN = `(() => {
  const waitFrame = () => new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(resolve))
  );
  return (async () => {
    const root = document.documentElement;
    const previousScrollBehavior = root.style.scrollBehavior;
    root.style.scrollBehavior = 'auto';
    const maxScroll = () => Math.max(
      0,
      Math.max(root.scrollHeight, document.body ? document.body.scrollHeight : 0) -
        window.innerHeight
    );
    window.scrollTo(0, maxScroll());
    await waitFrame();
    await new Promise((resolve) => setTimeout(resolve, 150));
    window.scrollTo(0, maxScroll());
    await waitFrame();
    await new Promise((resolve) => setTimeout(resolve, 50));
    root.style.scrollBehavior = previousScrollBehavior;
    const target = maxScroll();
    return JSON.stringify({
      scrollY: Math.round(window.scrollY),
      maxScroll: Math.round(target),
      settled: Math.abs(window.scrollY - target) <= 1
    });
  })();
})()`

const SETTLE_RENDERED_FN = `(() => {
  const waitFrame = () => new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(resolve))
  );
  const isVisible = (el) => {
    if (!el) return false;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' ||
        cs.visibility === 'collapse' || parseFloat(cs.opacity) === 0) return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  };
  const ownAuditText = (el) => {
    const directText = Array.from(el.childNodes || [])
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.textContent.trim()).join(' ').trim();
    if (directText) return true;
    if (el.matches('input,textarea') &&
        (String(el.value || '').trim() || (el.getAttribute('placeholder') || '').trim())) {
      return true;
    }
    if (el.matches('select') && Array.from(el.options).some((option) =>
      (option.textContent || '').trim())) return true;
    return ['::before', '::after'].some((pseudo) => {
      const content = getComputedStyle(el, pseudo).content;
      return content && content !== 'none' && content !== 'normal' &&
        /^["'].*["']$/s.test(content) && content.slice(1, -1).trim();
    });
  };
  const auditTextElements = () => Array.from(document.querySelectorAll('*'))
    .filter((el) => isVisible(el) && !el.closest('[aria-hidden="true"]') && ownAuditText(el));
  const effectiveOpacity = (el) => {
    let opacity = 1;
    let current = el;
    while (current) {
      opacity *= parseFloat(getComputedStyle(current).opacity);
      current = current.parentElement;
    }
    return opacity;
  };
  const opacityIssues = () => auditTextElements()
    .filter((el) => effectiveOpacity(el) < 0.999)
    .map((el) => ({
      selector: el.tagName.toLowerCase() + (el.id ? '#' + el.id : ''),
      opacity: Math.round(effectiveOpacity(el) * 1000) / 1000,
    }));
  const relevantAnimations = () => {
    const textElements = auditTextElements();
    return document.getAnimations().filter((animation) => {
      const target = animation.effect && animation.effect.target;
      return target instanceof Element && textElements.some((el) =>
        target === el || target.contains(el) || el.contains(target));
    });
  };
  const isFiniteAnimation = (animation) => {
    const timing = animation.effect && animation.effect.getTiming();
    return Number.isFinite(timing && timing.iterations);
  };

  return (async () => {
    const deadline = performance.now() + 5000;
    let contentSeen = false;
    let stableSince = 0;
    while (performance.now() < deadline) {
      await waitFrame();
      contentSeen = contentSeen ||
        (!!document.querySelector('.planner-page, .data-page, .pipeline-shell') &&
          document.querySelectorAll('body *').length > 25);
      const animations = relevantAnimations();
      const runningFinite = animations.some((animation) =>
        isFiniteAnimation(animation) &&
        animation.playState !== 'finished' && animation.playState !== 'idle');
      const issues = opacityIssues();
      if (contentSeen && !runningFinite && !issues.length) {
        if (!stableSince) stableSince = performance.now();
        if (performance.now() - stableSince >= 400) {
          return JSON.stringify({
            settled: true,
            waitedMs: Math.round(performance.now() - (deadline - 5000)),
            opacityIssues: [],
            animationStates: [],
          });
        }
      } else {
        stableSince = 0;
      }
    }

    const animationStates = [];
    for (const animation of relevantAnimations()) {
      const previous = {
        animation,
        playState: animation.playState,
        currentTime: animation.currentTime,
      };
      try {
        animation.pause();
        const computed = animation.effect.getComputedTiming();
        const timing = animation.effect.getTiming();
        if (isFiniteAnimation(animation)) {
          if (Number.isFinite(computed.endTime)) animation.currentTime = computed.endTime;
        } else {
          const duration = Number(timing.duration);
          const delay = Number(timing.delay) || 0;
          if (Number.isFinite(duration) && duration > 0) {
            for (let i = 0; i <= 24; i++) {
              animation.currentTime = delay + duration * (i / 24);
              const target = animation.effect.target;
              if (parseFloat(getComputedStyle(target).opacity) >= 0.999) break;
            }
          }
        }
        animationStates.push(previous);
      } catch {}
    }
    await waitFrame();
    window.__endfieldRenderedAnimationStates = animationStates;
    return JSON.stringify({
      settled: opacityIssues().length === 0,
      waitedMs: 5000,
      opacityIssues: opacityIssues(),
      animationStates: animationStates.length,
    });
  })();
})()`

const RESTORE_ANIMATIONS_FN = `(() => {
  const states = window.__endfieldRenderedAnimationStates || [];
  for (const state of states) {
    try {
      state.animation.currentTime = state.currentTime;
      if (state.playState === 'running' || state.playState === 'pending') {
        state.animation.play();
      } else if (state.playState === 'finished') {
        state.animation.finish();
      } else if (state.playState === 'paused') {
        state.animation.pause();
      } else {
        state.animation.cancel();
      }
    } catch {}
  }
  delete window.__endfieldRenderedAnimationStates;
  return JSON.stringify({ restored: states.length });
})()`

// One browser-side collector handles text nodes, placeholders, options,
// generated pseudo-elements, disabled controls, and real computed colors.
// `backgroundImage !== none` is deliberately reported as a limitation because
// the APCA result cannot be trusted without rasterizing the composited layer.
const SCAN_FN = `(() => {
  const out = [];
  const contrast = [];
  const limitations = [];
  const seenLimitations = new Set();
  const MIN_PX = 12;
  const isVisible = (el) => {
    if (!el || el.closest('[aria-hidden="true"]')) return false;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' ||
        cs.visibility === 'collapse' || parseFloat(cs.opacity) === 0) return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  };
  const selectorOf = (el, pseudo = '') => {
    if (!el) return 'unknown';
    let value = el.tagName.toLowerCase();
    if (el.id) value += '#' + el.id;
    const classes = Array.from(el.classList || []).slice(0, 2);
    if (classes.length) value += '.' + classes.join('.');
    return value + pseudo;
  };
  const colorAlpha = (color) => {
    const match = String(color || '').match(/rgba?\\([^)]*\\)/);
    if (!match) return 0;
    if (!/^rgba/i.test(match[0])) return 1;
    const parts = match[0].slice(5, -1).split(',').map((v) => parseFloat(v));
    return parts.length > 3 ? parts[3] : 1;
  };
  const effectiveOpacity = (el, pseudoStyle = null) => {
    let opacity = pseudoStyle ? parseFloat(pseudoStyle.opacity) : 1;
    let current = el;
    while (current) {
      opacity *= parseFloat(getComputedStyle(current).opacity);
      current = current.parentElement;
    }
    return opacity;
  };
  const textOf = (el) => Array.from(el.childNodes || [])
    .filter((n) => n.nodeType === Node.TEXT_NODE)
    .map((n) => n.textContent.trim()).join(' ').replace(/\\s+/g, ' ').trim();
  const contentText = (content) => {
    if (!content || content === 'none' || content === 'normal') return '';
    const quoted = content.match(/^["'](.*)["']$/s);
    if (quoted) return quoted[1].trim();
    // url()/image() are non-text generated content; counters and attr() cannot
    // be reliably mapped back to a rendered string here.
    return '';
  };
  const contentNeedsLimitation = (content) => {
    if (!content || content === 'none' || content === 'normal') return false;
    if (/^["'].*["']$/s.test(content)) return false;
    if (/^(?:url|image|image-set|cross-fade)\\(/i.test(content)) return false;
    return true;
  };
  const nearestOpaqueBackground = (el) => {
    let current = el;
    const unreliableLayers = [];
    while (current) {
      const cs = getComputedStyle(current);
      const bg = cs.backgroundColor;
      const match = bg.match(/rgba?\\([^)]*\\)/);
      let alpha = 1;
      if (match && /^rgba/i.test(match[0])) {
        const parts = match[0].slice(5, -1).split(',').map((v) => parseFloat(v));
        alpha = parts.length > 3 ? parts[3] : 1;
      }
      if (alpha >= 1) {
        return {
          el: current,
          color: bg,
          backgroundImage: cs.backgroundImage,
          selector: selectorOf(current),
          unreliableLayers
        };
      }
      if (alpha > 0 || (cs.backgroundImage && cs.backgroundImage !== 'none')) {
        unreliableLayers.push(selectorOf(current));
      }
      current = current.parentElement;
    }
    return null;
  };
  const sample = (
    el, text, fg, sizePx, weight, pseudo = '', kindOverride = '', pseudoStyle = null,
  ) => {
    if (effectiveOpacity(el, pseudoStyle) < 0.999) {
      const key = 'opacity:' + selectorOf(el, pseudo);
      if (!seenLimitations.has(key)) {
        seenLimitations.add(key);
        limitations.push({
          selector: selectorOf(el, pseudo),
          text: text.slice(0, 60),
          reason: 'CSS opacity < 1 cannot be composited reliably'
        });
      }
      return;
    }
    if (pseudoStyle) {
      const alpha = colorAlpha(pseudoStyle.backgroundColor);
      if (pseudoStyle.backgroundImage && pseudoStyle.backgroundImage !== 'none') {
        const key = 'pseudo-background-image:' + selectorOf(el, pseudo);
        if (!seenLimitations.has(key)) {
          seenLimitations.add(key);
          limitations.push({
            selector: selectorOf(el, pseudo),
            text: text.slice(0, 60),
            reason: 'pseudo-element gradient/background-image cannot be scored reliably'
          });
        }
        return;
      }
      if (alpha > 0 && alpha < 1) {
        const key = 'pseudo-translucent-background:' + selectorOf(el, pseudo);
        if (!seenLimitations.has(key)) {
          seenLimitations.add(key);
          limitations.push({
            selector: selectorOf(el, pseudo),
            text: text.slice(0, 60),
            reason: 'pseudo-element translucent background cannot be composited reliably'
          });
        }
        return;
      }
      if (alpha >= 1) {
        contrast.push({
          selector: selectorOf(el, pseudo),
          text: text.slice(0, 60),
          fg,
          bg: pseudoStyle.backgroundColor,
          bgSelector: selectorOf(el, pseudo),
          sizePx: Math.round(sizePx * 10) / 10,
          weight,
          kind: kindOverride || (sizePx >= 24 || (sizePx >= 18.66 && weight >= 700) ? 'large' : 'body')
        });
        return;
      }
    }
    const bg = nearestOpaqueBackground(el);
    if (!bg) {
      const key = 'no-background:' + selectorOf(el, pseudo);
      if (!seenLimitations.has(key)) {
        seenLimitations.add(key);
        limitations.push({
          selector: selectorOf(el, pseudo),
          text: text.slice(0, 60),
          reason: 'no opaque background ancestor'
        });
      }
      return;
    }
    if ((bg.backgroundImage && bg.backgroundImage !== 'none') || bg.unreliableLayers.length) {
      const key = 'background-image:' + selectorOf(el, pseudo) + ':' + bg.selector;
      if (!seenLimitations.has(key)) {
        seenLimitations.add(key);
        limitations.push({
          selector: selectorOf(el, pseudo),
          text: text.slice(0, 60),
          background: bg.selector,
          reason: bg.unreliableLayers.length
            ? 'translucent layer(s) cannot be composited reliably: ' + bg.unreliableLayers.join(' > ')
            : 'gradient/background-image background cannot be scored reliably'
        });
      }
      return;
    }
    // APCA's UI threshold is for non-text indicators (borders, focus rings).
    // Text inside a button/link is still text, so classify it by size/weight.
    const interactive = kindOverride;
    const large = sizePx >= 24 || (sizePx >= 18.66 && weight >= 700);
    contrast.push({
      selector: selectorOf(el, pseudo),
      text: text.slice(0, 60),
      fg,
      bg: bg.color,
      bgSelector: bg.selector,
      sizePx: Math.round(sizePx * 10) / 10,
      weight,
      kind: interactive || (large ? 'large' : 'body')
    });
  };
  const checkText = (el, text, cs, pseudo = '') => {
    if (!text) return;
    const fs = parseFloat(cs.fontSize);
    if (fs < MIN_PX) {
      out.push({
        t: text.slice(0, 60),
        px: Math.round(fs * 10) / 10,
        selector: selectorOf(el, pseudo),
        state: (el.matches(':disabled') || el.closest('[aria-disabled="true"]')) ? 'disabled' : ''
      });
    }
    sample(
      el, text, cs.color, fs, parseInt(cs.fontWeight, 10) || 400, pseudo, '',
      pseudo && pseudo !== '::placeholder' && pseudo !== '::value' ? cs : null,
    );
  };

  document.querySelectorAll('*').forEach((el) => {
    const directText = textOf(el);
    if (directText && isVisible(el)) checkText(el, directText, getComputedStyle(el));

    if (el.matches('input,textarea') && isVisible(el)) {
      const value = String(el.value || '').trim();
      if (value) checkText(el, value, getComputedStyle(el), '::value');
      const placeholder = (el.getAttribute('placeholder') || '').trim();
      if (placeholder) checkText(el, placeholder, getComputedStyle(el, '::placeholder'), '::placeholder');
    }

    if (el.matches('select') && isVisible(el)) {
      el.querySelectorAll('option').forEach((option) => {
        const text = (option.textContent || '').trim();
        if (text) checkText(option, text, getComputedStyle(option));
      });
    }

    for (const pseudo of ['::before', '::after']) {
      const pcs = getComputedStyle(el, pseudo);
      if (pcs.display === 'none' || pcs.visibility === 'hidden' ||
          parseFloat(pcs.opacity) === 0) continue;
      const text = contentText(pcs.content);
      if (text && isVisible(el)) checkText(el, text, pcs, pseudo);
      else if (contentNeedsLimitation(pcs.content)) {
        const key = 'pseudo-content:' + selectorOf(el, pseudo);
        if (!seenLimitations.has(key)) {
          seenLimitations.add(key);
          limitations.push({
            selector: selectorOf(el, pseudo),
            text: String(pcs.content).slice(0, 60),
            reason: 'generated content is not a statically readable text string'
          });
        }
      }
    }
  });

  const sw = Math.max(
    document.documentElement.scrollWidth,
    document.body ? document.body.scrollWidth : 0
  );
  const cw = document.documentElement.clientWidth;
  let footerNav = null;
  const footerInner = document.querySelector('.site-footer .footer-inner');
  const nav = document.querySelector('.nav-links');
  if (footerInner && nav) {
    const fr = footerInner.getBoundingClientRect();
    const nr = nav.getBoundingClientRect();
    const navStyle = getComputedStyle(nav);
    const navBottom = parseFloat(navStyle.bottom);
    const navFixedBottom = navStyle.position === 'fixed' &&
      Number.isFinite(navBottom) && navBottom <= 1;
    const navInViewport = nr.top < window.innerHeight && nr.bottom > 0;
    const footerInViewport = fr.top < window.innerHeight && fr.bottom > 0;
    footerNav = {
      footerBottom: Math.round(fr.bottom),
      navTop: Math.round(nr.top),
      viewportHeight: window.innerHeight,
      scrollY: Math.round(window.scrollY),
      occluded: navFixedBottom && navInViewport && footerInViewport &&
        (fr.bottom - nr.top) > 1
    };
  }
  return JSON.stringify({
    out,
    contrast,
    limitations,
    overflow: sw > cw + 1 ? (sw - cw) : 0,
    footerNav
  });
})()`

const ACTIVE_FOCUS_FN = `(() => {
  const el = document.activeElement;
  if (!el || el === document.body || el === document.documentElement) return null;
  const cs = getComputedStyle(el);
  const selector = el.tagName.toLowerCase() + (el.id ? '#' + el.id : '');
  const text = (el.getAttribute('aria-label') || el.textContent || el.getAttribute('placeholder') || '')
    .trim().replace(/\\s+/g, ' ').slice(0, 60);
  // Outlines and box-shadows are painted outside the element's border box, so
  // compare them with the background behind the element, not its own fill.
  let current = el.parentElement;
  let bg = null;
  const unreliableLayers = [];
  while (current) {
    const bcs = getComputedStyle(current);
    const match = bcs.backgroundColor.match(/rgba?\\([^)]*\\)/);
    let alpha = 1;
    if (match && /^rgba/i.test(match[0])) {
      const parts = match[0].slice(5, -1).split(',').map((v) => parseFloat(v));
      alpha = parts.length > 3 ? parts[3] : 1;
    }
    if (alpha >= 1) {
      bg = {
        color: bcs.backgroundColor,
        image: bcs.backgroundImage,
        selector: current.tagName.toLowerCase(),
        unreliableLayers
      };
      break;
    }
    if (alpha > 0 || (bcs.backgroundImage && bcs.backgroundImage !== 'none')) {
      unreliableLayers.push(current.tagName.toLowerCase());
    }
    current = current.parentElement;
  }
  return JSON.stringify({
    selector,
    text,
    focusVisible: el.matches(':focus-visible'),
    outlineColor: cs.outlineColor,
    outlineStyle: cs.outlineStyle,
    outlineWidth: parseFloat(cs.outlineWidth) || 0,
    boxShadow: cs.boxShadow,
    background: bg
  });
})()`

function formatPx(px) {
  return Math.round(px * 10) / 10
}

function addContrastResults(parsed, label, failures, limitations) {
  for (const sample of parsed.contrast || []) {
    const fg = parseColor(sample.fg)
    const bg = parseColor(sample.bg)
    if (!fg) {
      limitations.push(
        `${label}: ${sample.selector} "${sample.text}" has unparseable foreground ` +
        `(${sample.fg || 'none'})`,
      )
      continue
    }
    if (!bg || bg[3] < 1) {
      limitations.push(
        `${label}: ${sample.selector} "${sample.text}" has unparseable/translucent background ` +
        `(${sample.bg || 'none'})`,
      )
      continue
    }
    const threshold = APCA_THRESHOLDS[sample.kind] ?? APCA_THRESHOLDS.body
    const result = apcaPair(fg, bg, threshold)
    if (!result.ok) {
      failures.push(
        `${label}: APCA ${result.lc} < ${threshold} (${sample.kind}) for ` +
        `${sample.selector} "${sample.text}" fg ${result.foreground} bg ${result.background}`,
      )
    }
  }
  for (const limitation of parsed.limitations || []) {
    limitations.push(
      `${label}: ${limitation.selector} "${limitation.text}" — ${limitation.reason}` +
      (limitation.background ? ` (${limitation.background})` : ''),
    )
  }
}

async function evaluateJson(
  call,
  sessionId,
  expression,
  dig,
  label,
  awaitPromise = false,
  allowNull = false,
) {
  const resp = await call(sessionId, 'Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise,
  }, awaitPromise ? 30000 : 20000)
  const value = dig(resp, 'result', 'result', 'value')
  if (value === null && allowNull) return null
  if (typeof value !== 'string') {
    const err = dig(resp, 'error', 'message') || dig(resp, 'result', 'exceptionDetails', 'text')
    throw new Error(err ? `${label}: ${err}` : `${label}: Runtime.evaluate returned no value`)
  }
  return JSON.parse(value)
}

async function main() {
  if (!existsSync(CHROME)) {
    console.error(`Chrome not found at ${CHROME}; rendered audit skipped.`)
    process.exitCode = 2
    return
  }
  const port = await findFreePort()
  const userData = mkdtempSync(join(tmpdir(), 'endfield-cdp-'))
  const chrome = spawn(CHROME, [
    `--remote-debugging-port=${port}`,
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    `--user-data-dir=${userData}`,
    'about:blank',
  ], { stdio: 'ignore' })

  let exitCode = 0
  const cleanup = () => {
    try { chrome.kill('SIGKILL') } catch {}
    try { rmSync(userData, { recursive: true, force: true }) } catch {}
  }
  process.on('exit', cleanup)

  try {
    let endpoint
    for (let i = 0; i < 40; i++) {
      try {
        const res = await fetch(`http://127.0.0.1:${port}/json/version`)
        if (res.ok) {
          endpoint = (await res.json()).webSocketDebuggerUrl
          break
        }
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 250))
    }
    if (!endpoint) throw new Error('Could not reach Chrome DevTools endpoint')

    const { send, call, dig, setEventHandler } = await wsConnect(endpoint)
    const created = await send('Target.createTarget', { url: 'about:blank' })
    const targetId = dig(created, 'result', 'targetId')
    if (!targetId) throw new Error('Target.createTarget did not return a targetId')
    const attached = await send('Target.attachToTarget', { targetId, flatten: true })
    const sessionId = dig(attached, 'result', 'sessionId')
    if (!sessionId) throw new Error('Target.attachToTarget did not return a sessionId')

    const fontFailures = []
    const contrastFailures = []
    const auditLimitations = []
    const overflow = []
    const consoleErrors = []
    const failedRequests = []
    const responseUrls = new Map()

    await call(sessionId, 'Runtime.enable')
    await call(sessionId, 'Log.enable')
    await call(sessionId, 'Network.enable')
    await call(sessionId, 'Page.enable')

    setEventHandler((msg) => {
      if (msg.method === 'Runtime.exceptionThrown') {
        const desc = dig(msg, 'params', 'exceptionDetails', 'exception', 'description') ||
          dig(msg, 'params', 'exceptionDetails', 'text') || 'uncaught exception'
        consoleErrors.push(`exception: ${String(desc).slice(0, 200)}`)
      } else if (msg.method === 'Runtime.consoleAPICalled') {
        const level = dig(msg, 'params', 'type')
        if (level === 'error' || level === 'warning') {
          const args = (dig(msg, 'params', 'args') || [])
            .map((arg) => arg.value ?? arg.description ?? '').join(' ')
          consoleErrors.push(`${level}: ${String(args).slice(0, 200)}`)
        }
      } else if (msg.method === 'Log.entryAdded') {
        const entry = dig(msg, 'params', 'entry') || {}
        if (entry.level === 'error' || entry.level === 'warning') {
          consoleErrors.push(`${entry.level}: ${String(entry.text || '').slice(0, 200)}`)
        }
      } else if (msg.method === 'Network.responseReceived') {
        const rid = dig(msg, 'params', 'requestId')
        const url = dig(msg, 'params', 'response', 'url')
        if (rid && url) responseUrls.set(rid, url)
        const status = dig(msg, 'params', 'response', 'status')
        if (status && status >= 400) {
          failedRequests.push({ requestId: rid, failure: `HTTP ${status}`, url })
        }
      } else if (msg.method === 'Network.loadingFailed') {
        const rid = dig(msg, 'params', 'requestId')
        const failure = dig(msg, 'params', 'errorText') || 'load failed'
        failedRequests.push({ requestId: rid, failure, url: responseUrls.get(rid) || null })
      }
    })

    const settleRendered = async (label) => evaluateJson(
      call, sessionId, SETTLE_RENDERED_FN, dig, `${label} animation settle`, true,
    )

    const restoreAnimations = async (label) => evaluateJson(
      call, sessionId, RESTORE_ANIMATIONS_FN, dig, `${label} animation restore`, false,
    )

    const navigate = async (url, label) => {
      await call(sessionId, 'Page.navigate', { url })
      await settleRendered(label)
    }

    const setViewport = async (vp) => {
      await call(sessionId, 'Emulation.setDeviceMetricsOverride', {
        width: vp.width,
        height: vp.height,
        deviceScaleFactor: 2,
        mobile: vp.mobile,
      })
    }

    const scrollToBottom = async () => evaluateJson(
      call, sessionId, SCROLL_TO_BOTTOM_FN, dig, 'bottom scroll', true,
    )

    const inspectPage = async (label, prepared = false) => {
      if (!prepared) await settleRendered(label)
      try {
        const scrollResult = await scrollToBottom()
        if (!scrollResult.settled) {
          overflow.push(
            `${label}: could not reach document bottom ` +
            `(scrollY ${scrollResult.scrollY}, maxScroll ${scrollResult.maxScroll})`,
          )
        }
        const parsed = await evaluateJson(call, sessionId, SCAN_FN, dig, `${label} scan`)
        for (const item of parsed.out || []) {
          fontFailures.push(
            `${label}: ${item.selector}${item.state ? ` [${item.state}]` : ''} ` +
            `"${item.t}" ${formatPx(item.px)}px`,
          )
        }
        if (parsed.overflow) overflow.push(`${label}: horizontal overflow ${parsed.overflow}px`)
        if (parsed.footerNav?.occluded) {
          overflow.push(
            `${label}: footer content occluded by bottom nav ` +
            `(footerBottom ${parsed.footerNav.footerBottom} > navTop ${parsed.footerNav.navTop})`,
          )
        }
        addContrastResults(parsed, label, contrastFailures, auditLimitations)
        return parsed
      } finally {
        await restoreAnimations(label)
      }
    }

    const auditFocusVisible = async (label) => {
      const seen = new Set()
      for (let i = 0; i < 24; i++) {
        await call(sessionId, 'Input.dispatchKeyEvent', {
          type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9,
        })
        await call(sessionId, 'Input.dispatchKeyEvent', {
          type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9,
        })
        await new Promise((resolve) => setTimeout(resolve, 35))
        const active = await evaluateJson(
          call, sessionId, ACTIVE_FOCUS_FN, dig, `${label} focus`, false, true,
        )
        if (!active || !active.focusVisible) continue
        const key = `${active.selector}:${active.text}`
        if (seen.has(key)) break
        seen.add(key)
        if (active.outlineStyle === 'none' || active.outlineWidth <= 0) {
          if (!active.boxShadow || active.boxShadow === 'none') {
            contrastFailures.push(
              `${label}: focus-visible ${active.selector} "${active.text}" has no outline/box-shadow indicator`,
            )
            continue
          }
          auditLimitations.push(
            `${label}: focus-visible ${active.selector} relies on box-shadow; ` +
            'its composited color cannot be reliably parsed',
          )
          continue
        }
        if (!active.background) {
          auditLimitations.push(
            `${label}: focus-visible ${active.selector} has no opaque background ancestor`,
          )
          continue
        }
        if (active.background.unreliableLayers?.length) {
          auditLimitations.push(
            `${label}: focus-visible ${active.selector} has translucent/background-image layer(s) ` +
            `before its opaque backdrop: ${active.background.unreliableLayers.join(' > ')}`,
          )
          continue
        }
        if (active.background.image && active.background.image !== 'none') {
          auditLimitations.push(
            `${label}: focus-visible ${active.selector} sits on a gradient/background image`,
          )
          continue
        }
        const fg = parseColor(active.outlineColor)
        const bg = parseColor(active.background.color)
        if (!fg || !bg || bg[3] < 1) {
          auditLimitations.push(
            `${label}: focus-visible ${active.selector} colors could not be parsed`,
          )
          continue
        }
        const result = apcaPair(fg, bg, APCA_THRESHOLDS.ui)
        if (!result.ok) {
          contrastFailures.push(
            `${label}: focus-visible ${active.selector} APCA ${result.lc} < ` +
            `${APCA_THRESHOLDS.ui} (UI) fg ${result.foreground} bg ${result.background}`,
          )
        }
      }
    }

    for (const vp of VIEWPORTS) {
      await setViewport(vp)
      for (const route of ROUTES) {
        const label = `${vp.name} ${route}`
        await navigate(`${BASE_URL}${route}`, label)
        await inspectPage(label, true)
        await auditFocusVisible(label)
      }
    }

    // Exercise team-size boundaries through the real controls, then scan the
    // complete generated planner state (not only #recommendation-output).
    await setViewport(VIEWPORTS.find((vp) => vp.name === 'iphone-390'))
    await navigate(`${BASE_URL}#/`, 'iphone-390 #/ (drive)')
    await restoreAnimations('iphone-390 #/ (drive)')
    const drive = await evaluateJson(call, sessionId, `(() => {
      const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      return (async () => {
        const button = document.querySelector('.generate-button');
        const emptyDisabled = !!button?.disabled;
        const cards = Array.from(document.querySelectorAll('.character-card'));
        cards[0]?.click();
        await wait(60);
        const oneEnabled = !!button && !button.disabled;
        for (const card of cards.slice(1, 5)) {
          card.click();
          await wait(60);
        }
        const selectedCount = document.querySelectorAll('.squad-slot.filled').length;
        const fifthBlocked = selectedCount === 4;
        const level = document.querySelector('#player-level');
        if (level) {
          const setter = Object.getOwnPropertyDescriptor(
            window.HTMLInputElement.prototype, 'value'
          ).set;
          setter.call(level, '40');
          level.dispatchEvent(new Event('input', { bubbles: true }));
        }
        if (button && !button.disabled) button.click();
        // Wait for the output reveal to settle before auditing text opacity.
        await wait(1200);
        return JSON.stringify({
          generated: !!document.querySelector('#recommendation-output'),
          emptyDisabled,
          oneEnabled,
          selectedCount,
          fifthBlocked,
        });
      })();
    })()`, dig, 'planner drive', true)
    if (!drive.generated || !drive.emptyDisabled || !drive.oneEnabled || !drive.fifthBlocked) {
      overflow.push(
        'iphone-390 #/ (generated): team-size boundary failed ' +
        `(empty disabled=${drive.emptyDisabled}, one enabled=${drive.oneEnabled}, ` +
        `selected=${drive.selectedCount}, fifth blocked=${drive.fifthBlocked}, ` +
        `generated=${drive.generated})`,
      )
    }
    await inspectPage('iphone-390 #/ (generated)')
    await auditFocusVisible('iphone-390 #/ (generated)')

    for (const failure of failedRequests) {
      if (failure.failure && /net::ERR_ABORTED/i.test(failure.failure) && !failure.url) continue
      consoleErrors.push(`network: ${failure.failure}${failure.url ? ` ${failure.url}` : ''}`)
    }

    if (fontFailures.length) {
      console.error('Rendered font-size audit failed:')
      for (const failure of fontFailures) console.error(`- ${failure}`)
      exitCode = 1
    } else {
      console.log('Rendered font-size audit passed: visible text, placeholders, options, pseudo text, and disabled controls are >= 12px on all viewports.')
    }

    if (contrastFailures.length) {
      console.error('Rendered APCA contrast audit failed:')
      for (const failure of contrastFailures) console.error(`- ${failure}`)
      exitCode = 1
    } else {
      console.log('Rendered APCA audit passed for all reliably measurable text/focus pairings.')
    }

    if (auditLimitations.length) {
      console.error('APCA audit limitations (not scored; audit incomplete for these elements):')
      for (const limitation of [...new Set(auditLimitations)]) console.error(`- ${limitation}`)
      exitCode = 1
    } else {
      console.log('No APCA gradient/background-image or unresolved-color limitations.')
    }

    if (overflow.length) {
      console.error('Horizontal overflow / footer occlusion / planner generation failure detected:')
      for (const item of overflow) console.error(`- ${item}`)
      exitCode = 1
    } else {
      console.log('No horizontal overflow, footer occlusion, or planner generation failure on any viewport.')
    }

    if (consoleErrors.length) {
      console.error('Console errors / 404s / exceptions detected:')
      for (const item of consoleErrors) console.error(`- ${item}`)
      exitCode = 1
    } else {
      console.log('No console errors, uncaught exceptions, or 4xx/5xx resources.')
    }
  } catch (error) {
    console.error('Rendered audit errored:', error.message)
    exitCode = 2
  } finally {
    try { chrome.kill('SIGKILL') } catch {}
    try { rmSync(userData, { recursive: true, force: true }) } catch {}
  }
  process.exitCode = exitCode
}

main()
