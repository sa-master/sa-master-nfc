(function () {
  'use strict';

  /* ============ Утиліти ============ */
  const $ = (id) => document.getElementById(id);
  const lock = () => { document.body.style.overflow = 'hidden'; };
  const unlock = () => { document.body.style.overflow = ''; };

  /* ============ Аналітика (вмикається, лише якщо вказано ID) ============ */
  // GA4: ANALYTICS.ga4 = 'G-XXXXXXXXXX'; Plausible: ANALYTICS.plausibleDomain = 'sa-master.pro'
  const ANALYTICS = { ga4: '', plausibleDomain: '' };

  (function initAnalytics() {
    try {
      if (ANALYTICS.ga4) {
        window.dataLayer = window.dataLayer || [];
        window.gtag = function () { window.dataLayer.push(arguments); };
        window.gtag('js', new Date());
        window.gtag('config', ANALYTICS.ga4);
        const g = document.createElement('script');
        g.async = true;
        g.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(ANALYTICS.ga4);
        document.head.appendChild(g);
      }
      if (ANALYTICS.plausibleDomain) {
        window.plausible = window.plausible || function () {
          (window.plausible.q = window.plausible.q || []).push(arguments);
        };
        const pl = document.createElement('script');
        pl.defer = true;
        pl.setAttribute('data-domain', ANALYTICS.plausibleDomain);
        pl.src = 'https://plausible.io/js/script.js';
        document.head.appendChild(pl);
      }
    } catch (e) { /* аналітика не повинна ламати сайт */ }
  })();

  // Персональні дані (ім'я, телефон, адреса) в аналітику не передаються
  function track(name, params) {
    try {
      if (ANALYTICS.ga4 && window.gtag) window.gtag('event', name, params || {});
      if (ANALYTICS.plausibleDomain && window.plausible) window.plausible(name, { props: params || {} });
    } catch (e) { /* ignore */ }
  }

  /* ============ Фокус і доступність діалогів ============ */
  const OVERLAY_IDS = ['lightbox', 'modalPayment', 'requestModal', 'modalCarousel'];
  const focusStack = [];
  function anyOverlayOpen() {
    return OVERLAY_IDS.some((id) => { const el = $(id); return el && el.classList.contains('act'); });
  }
  function unlockIfIdle() { if (!anyOverlayOpen()) unlock(); }
  function rememberFocus() {
    const a = document.activeElement;
    focusStack.push(a && a !== document.body ? a : null);
  }
  function restoreFocus() {
    const el = focusStack.pop();
    if (el && document.contains(el) && typeof el.focus === 'function') {
      try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); }
    }
  }
  function focusEl(el) {
    if (!el) return;
    try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); }
  }
  function focusables(container) {
    if (!container) return [];
    return Array.from(container.querySelectorAll(
      'a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])'
    )).filter((el) => el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden');
  }
  function activeDialog() {
    const lb = $('lightbox');
    if (lb && lb.classList.contains('act')) return lb;
    const pm = $('modalPayment');
    if (pm && pm.classList.contains('act')) return pm.querySelector('.mpb');
    const rm = $('requestModal');
    if (rm && rm.classList.contains('act')) return rm.querySelector('.request-box');
    const mc = $('modalCarousel');
    if (mc && mc.classList.contains('act')) return mc.querySelector('.mo.act');
    return null;
  }

  /* ============ Нормалізація телефону ============ */
  function normalizeUAPhone(input) {
    const digits = String(input || '').replace(/\D/g, '');
    if (!digits) return '';
    if (digits.length === 12 && digits.startsWith('380')) return '+' + digits;
    if (digits.length === 11 && digits.startsWith('80'))  return '+3' + digits;
    if (digits.length === 10 && digits.startsWith('0'))   return '+38' + digits;
    if (digits.length === 9)                              return '+380' + digits;
    if (digits.length >= 10 && digits.length <= 13)       return '+' + digits;
    return '';
  }

  /* ============ Модальна карусель ============ */
  const MODALS = ['modalAbout', 'modalProcess', 'modalPrice', 'modalReviews'];
  let currentModal = 0;

  const modalEls = {};
  MODALS.forEach((id) => { modalEls[id] = $(id); });

  function goModal(i) {
    currentModal = Math.max(0, Math.min(MODALS.length - 1, i));
    MODALS.forEach((id, x) => {
      const m = modalEls[id];
      if (!m) return;
      const active = x === currentModal;
      m.classList.toggle('act', active);
      m.style.zIndex = active ? '2' : '1';
      m.style.opacity = active ? '1' : '0';
      m.style.visibility = active ? 'visible' : 'hidden';
      m.style.transform = active
        ? 'translateX(0)'
        : (x < currentModal ? 'translateX(-100%)' : 'translateX(100%)');
      m.setAttribute('aria-hidden', String(!active));
    });
    document.querySelectorAll('.mp').forEach((p) => {
      p.querySelectorAll('.dot').forEach((d, i) => d.classList.toggle('act', i === currentModal));
    });
  }

  function openModal(id) {
    if (id === 'modalPayment') {
      const pm = $('modalPayment');
      if (pm) {
        rememberFocus();
        pm.classList.add('act');
        pm.setAttribute('aria-hidden', 'false');
        lock();
        track('open_payment');
        focusEl(pm.querySelector('.mc'));
      }
      return;
    }
    const mc = $('modalCarousel');
    const wasOpen = !!(mc && mc.classList.contains('act'));
    if (mc) {
      if (!wasOpen) rememberFocus();
      mc.classList.add('act');
      mc.style.pointerEvents = 'auto';
      mc.setAttribute('aria-hidden', 'false');
      document.body.classList.add('sheet-open');
    }
    const ix = MODALS.indexOf(id);
    if (ix !== -1) goModal(ix);
    lock();
    if (ix !== -1) {
      track('open_section', { section: id });
      const m = modalEls[id];
      focusEl(m && m.querySelector('.mc'));
    }
  }

  function closeModal(id) {
    if (id === 'modalPayment') {
      const pm = $('modalPayment');
      if (pm && pm.classList.contains('act')) {
        pm.classList.remove('act');
        pm.setAttribute('aria-hidden', 'true');
        unlockIfIdle();
        restoreFocus();
      }
      return;
    }
    const mc = $('modalCarousel');
    if (mc && mc.classList.contains('act')) {
      mc.classList.remove('act');
      mc.style.pointerEvents = 'none';
      mc.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('sheet-open');
      unlockIfIdle();
      restoreFocus();
    }
  }

  /* ============ Галерея ============ */
  const GALLERY_SIZE = 8;
  let currentSlide = 0;
  let galleryTimer = null;
  const AUTOPLAY_MS = 4500;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  const galleryTrack = $('galleryTrack');
  const galleryCounter = $('galleryCounter');
  const galleryDots = Array.from(document.querySelectorAll('.gdot'));
  const galleryWindow = $('galleryWindow');

  function updateGallery(animate = true) {
    if (!galleryTrack) return;
    galleryTrack.style.transition = animate
      ? 'transform .5s cubic-bezier(.22,.61,.36,1)'
      : 'none';
    galleryTrack.style.transform = `translate3d(-${currentSlide * 100}%, 0, 0)`;
    if (galleryCounter) galleryCounter.textContent = `${currentSlide + 1} / ${GALLERY_SIZE}`;
    galleryDots.forEach((d, i) => {
      const active = i === currentSlide;
      d.classList.toggle('act', active);
      d.setAttribute('aria-selected', String(active));
    });
  }

  function nextSlide() {
    currentSlide = (currentSlide + 1) % GALLERY_SIZE;
    updateGallery();
  }
  function prevSlide() {
    currentSlide = (currentSlide - 1 + GALLERY_SIZE) % GALLERY_SIZE;
    updateGallery();
  }
  function startAutoplay() {
    stopAutoplay();
    if (reduceMotion.matches || document.hidden) return;
    galleryTimer = setInterval(nextSlide, AUTOPLAY_MS);
  }
  function stopAutoplay() {
    if (galleryTimer) { clearInterval(galleryTimer); galleryTimer = null; }
  }

  /* Свайп галереї */
  let galleryStartX = 0;
  let galleryStartY = 0;
  let gallerySwiping = false;

  function bindGallerySwipe() {
    if (!galleryWindow) return;
    galleryWindow.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1) return;
      galleryStartX = e.touches[0].clientX;
      galleryStartY = e.touches[0].clientY;
      gallerySwiping = true;
      stopAutoplay();
    }, { passive: true });

    galleryWindow.addEventListener('touchend', (e) => {
      if (!gallerySwiping) return;
      gallerySwiping = false;
      const dx = e.changedTouches[0].clientX - galleryStartX;
      const dy = e.changedTouches[0].clientY - galleryStartY;
      if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) {
        if (dx < 0) nextSlide(); else prevSlide();
      }
      startAutoplay();
    }, { passive: true });
  }

  /* ============ Lightbox ============ */
  let lightboxIndex = 0;

  function openLightbox(i) {
    lightboxIndex = Math.max(0, Math.min(GALLERY_SIZE - 1, i));
    updateLightbox();
    const lb = $('lightbox');
    if (lb) {
      rememberFocus();
      lb.classList.add('act');
      lb.setAttribute('aria-hidden', 'false');
      lock();
      stopAutoplay();
      track('open_photo', { index: lightboxIndex + 1 });
      focusEl($('lightboxClose'));
    }
  }
  function closeLightbox() {
    const lb = $('lightbox');
    if (lb && lb.classList.contains('act')) {
      lb.classList.remove('act');
      lb.setAttribute('aria-hidden', 'true');
      lb.style.backgroundColor = '';
      const li = $('lightboxImage');
      if (li) { li.style.transform = ''; li.style.opacity = ''; }
      unlockIfIdle();
      restoreFocus();
      startAutoplay();
    }
  }
  function updateLightbox() {
    const img = $('lightboxImage');
    const slides = document.querySelectorAll('.gs img');
    if (!img || !slides[lightboxIndex]) return;
    img.src = slides[lightboxIndex].src;
    img.alt = slides[lightboxIndex].alt;
    const cap = $('lightboxCaption');
    if (cap) cap.textContent = slides[lightboxIndex].alt;
    const c = $('lightboxCounter');
    if (c) c.textContent = `${lightboxIndex + 1} / ${GALLERY_SIZE}`;
  }

  /* ============ Чат-заявка ============ */
  const REQUEST_STATE = {
    type: '', typeLabel: '', name: '', phone: '',
    location: '', timing: '', project: '', consultationDate: '',
    notes: ''
  };
  let chatStep = 0;
  const CHAT_TOTAL_STEPS = 6;

  const PROJECT_OPTIONS = ['Так, є', 'Є, але зараз не можу надати', 'Немає'];
  const TIMING_OPTIONS = ['Якнайшвидше', 'Протягом місяця', 'Через 1–2 місяці', 'Поки визначаюсь'];

  const TYPE_LABELS = {
    complex: 'Комплексний монтаж',
    local: 'Локальний монтаж',
    consultation: 'Консультація',
    estimate: 'Прорахунок'
  };

  function chatScroll() {
    const b = $('chatBody');
    if (!b) return;
    setTimeout(() => { b.scrollTop = b.scrollHeight; }, 50);
  }

  function chatMsg(text, who) {
    const b = $('chatBody');
    if (!b) return;
    const row = document.createElement('div');
    const bubble = document.createElement('div');
    row.className = `chat-message ${who}`;
    bubble.className = 'chat-bubble';
    bubble.textContent = text;
    row.appendChild(bubble);
    b.appendChild(row);
    chatScroll();
  }
  const chatBot = (t) => chatMsg(t, 'bot');
  const chatUser = (t) => chatMsg(t, 'user');

  function updateProgress() {
    const bar = $('chatProgressBar');
    if (!bar) return;
    bar.style.width = Math.max(5, Math.min(100, ((chatStep + 1) / CHAT_TOTAL_STEPS) * 100)) + '%';
  }

  function addOptions(options) {
    const b = $('chatBody');
    if (!b) return;
    const wrap = document.createElement('div');
    wrap.className = 'chat-options';
    options.forEach((o) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'chat-option';
      btn.textContent = o.label;
      btn.dataset.chatValue = o.value;
      wrap.appendChild(btn);
    });
    b.appendChild(wrap);
    chatScroll();
  }

  function addInput(placeholder, type, onDone, validate) {
    const b = $('chatBody');
    if (!b) return;
    const wrap = document.createElement('div');
    const input = document.createElement('input');
    const send = document.createElement('button');

    wrap.className = 'chat-input-wrap';
    input.className = 'chat-input';
    input.type = type || 'text';
    input.placeholder = placeholder;
    input.autocomplete = 'off';
    input.setAttribute('aria-label', placeholder);

    const isTel = type === 'tel';
    if (isTel) {
      input.setAttribute('inputmode', 'text');
      input.setAttribute('autocomplete', 'tel');
      input.setAttribute('autocorrect', 'off');
      input.setAttribute('autocapitalize', 'off');
      input.setAttribute('spellcheck', 'false');
      input.setAttribute('pattern', '[+0-9\\s\\-()]{9,}');
    }

    if (isTel) {
      input.addEventListener('blur', () => {
        const normalized = normalizeUAPhone(input.value);
        if (normalized) input.value = normalized;
      });
    }

    send.type = 'button';
    send.className = 'chat-send';
    send.setAttribute('aria-label', 'Надіслати');
    send.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5"/><path d="m5 12 7-7 7 7"/></svg>';

    wrap.append(input, send);
    b.appendChild(wrap);

    let scrollTimer = null;
    const scrollToInput = () => {
      if (scrollTimer) clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => {
        b.scrollTop = b.scrollHeight;
        wrap.scrollIntoView({ block: 'end', behavior: 'auto' });
      }, 250);
    };
    input.addEventListener('focus', scrollToInput);
    setTimeout(() => input.focus(), 50);

    function submit() {
      let value = input.value.trim();
      if (!value) { input.focus(); return; }

      if (isTel) {
        const normalized = normalizeUAPhone(value);
        if (!normalized) {
          input.setAttribute('aria-invalid', 'true');
          input.focus();
          return;
        }
        value = normalized;
      }

      if (validate && !validate(value)) {
        input.setAttribute('aria-invalid', 'true');
        input.focus();
        return;
      }

      wrap.remove();
      chatUser(value);
      onDone(value);
    }
    send.addEventListener('click', submit);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); submit(); }
    });

    chatScroll();
  }

  function resetChat() {
    const b = $('chatBody');
    if (b) b.innerHTML = '';
    Object.keys(REQUEST_STATE).forEach((k) => { REQUEST_STATE[k] = ''; });
    chatStep = 0;
    updateProgress();
  }

  function openRequest() {
    const m = $('requestModal');
    if (!m) return;
    const wasOpen = m.classList.contains('act');
    if (!wasOpen) { rememberFocus(); track('request_start'); }
    resetChat();
    document.body.classList.add('chat-open');
    m.classList.add('act');
    m.setAttribute('aria-hidden', 'false');
    lock();
    chatBot('Вітаю. Щоб зрозуміти, чи можемо взяти ваш об’єкт у роботу, поставлю кілька коротких запитань.');
    chatBot('Що вас цікавить?');
    addOptions([
      { value: 'complex', label: 'Комплексний монтаж' },
      { value: 'local', label: 'Локальний монтаж' },
      { value: 'consultation', label: 'Консультація' },
      { value: 'estimate', label: 'Прорахунок' }
    ]);
    updateProgress();
  }

  function closeRequest() {
    const m = $('requestModal');
    const wasOpen = !!(m && m.classList.contains('act'));
    if (m) { m.classList.remove('act'); m.setAttribute('aria-hidden', 'true'); }
    document.body.classList.remove('chat-open');
    unlockIfIdle();
    if (wasOpen) restoreFocus();
  }

  /* Кроки чату */
  function askName() {
    chatStep = 2;
    chatBot('Як до вас звертатися?');
    addInput("Ваше ім'я", 'text', (v) => {
      REQUEST_STATE.name = v;
      askPhone();
    });
    updateProgress();
  }

  function askPhone() {
    chatStep = 3;
    chatBot('Дякую. Тепер залиште номер телефону для зв’язку.');
    addInput(
      'Наприклад: 0979111871',
      'tel',
      (v) => {
        REQUEST_STATE.phone = v;
        askLocation();
      },
      (v) => {
        const digits = String(v || '').replace(/\D/g, '');
        return digits.length >= 9 && digits.length <= 13;
      }
    );
    updateProgress();
  }

  function askLocation() {
    chatStep = 4;
    chatBot('Де знаходиться об’єкт? Вкажіть ЖК, вулицю або адресу.');
    addInput('Наприклад: ЖК Файна Таун, вул. Салютна', 'text', (v) => {
      REQUEST_STATE.location = v;
      afterLocation();
    });
    updateProgress();
  }

  function afterLocation() {
    if (REQUEST_STATE.type === 'consultation') {
      chatStep = 5;
      chatBot('Коли вам зручно провести консультацію?');
      addInput('Наприклад: 18 вересня після 17:00', 'text', (v) => {
        REQUEST_STATE.consultationDate = v;
        finishChat();
      });
      updateProgress();
      return;
    }
    if (REQUEST_STATE.type === 'complex') {
      chatStep = 5;
      chatBot('Чи є у вас дизайн-проєкт?');
      addOptions(PROJECT_OPTIONS.map((v) => ({ value: v, label: v })));
      updateProgress();
      return;
    }
    askTiming();
  }

  function askTiming() {
    chatStep = 5;
    chatBot('Коли орієнтовно плануєте початок робіт?');
    addOptions(TIMING_OPTIONS.map((v) => ({ value: v, label: v })));
    updateProgress();
  }

  function afterType(value) {
    REQUEST_STATE.type = value;
    REQUEST_STATE.typeLabel = TYPE_LABELS[value] || value;
    track('request_type', { type: value });
    chatUser(REQUEST_STATE.typeLabel);
    chatStep = 1;
    askName();
  }

  function afterProject(value) {
    REQUEST_STATE.project = value;
    chatUser(value);
    askTiming();
  }

  function afterTiming(value) {
    REQUEST_STATE.timing = value;
    chatUser(value);
    finishChat();
  }

  function finishChat() {
    chatStep = 6;
    chatBot('Готово. Перевірте, будь ласка, дані заявки перед відправленням. Будь-яке поле можна змінити.');
    track('request_review');
    renderSummary(true);
  }

  function summaryRows() {
    const s = REQUEST_STATE;
    return [
      { key: 'typeLabel', label: 'Тип', value: s.typeLabel },
      { key: 'name', label: "Ім'я", value: s.name, kind: 'text', ph: "Ваше ім'я" },
      { key: 'phone', label: 'Телефон', value: s.phone, kind: 'tel', ph: 'Наприклад: 0979111871' },
      { key: 'location', label: 'Об’єкт', value: s.location, kind: 'text', ph: 'ЖК, вулиця або адреса' },
      s.project && { key: 'project', label: 'Дизайн-проєкт', value: s.project, kind: 'options', options: PROJECT_OPTIONS },
      s.timing && { key: 'timing', label: 'Початок', value: s.timing, kind: 'options', options: TIMING_OPTIONS },
      s.consultationDate && { key: 'consultationDate', label: 'Консультація', value: s.consultationDate, kind: 'text', ph: 'Наприклад: 18 вересня після 17:00' }
    ].filter(Boolean);
  }

  function startEdit(def, valueEl, editBtn) {
    valueEl.textContent = '';
    editBtn.hidden = true;

    if (def.kind === 'options') {
      const wrap = document.createElement('div');
      wrap.className = 'chat-edit-opts';
      def.options.forEach((o) => {
        const bt = document.createElement('button');
        bt.type = 'button';
        bt.className = 'chat-edit-opt' + (o === REQUEST_STATE[def.key] ? ' act' : '');
        bt.textContent = o;
        bt.addEventListener('click', () => { REQUEST_STATE[def.key] = o; renderSummary(false); });
        wrap.appendChild(bt);
      });
      valueEl.appendChild(wrap);
      return;
    }

    const wrap = document.createElement('div');
    const input = document.createElement('input');
    const ok = document.createElement('button');
    wrap.className = 'chat-edit-wrap';
    input.className = 'chat-edit-input';
    input.type = def.kind === 'tel' ? 'tel' : 'text';
    input.value = REQUEST_STATE[def.key] || '';
    input.placeholder = def.ph || '';
    input.autocomplete = 'off';
    input.setAttribute('aria-label', def.label);
    ok.type = 'button';
    ok.className = 'chat-edit-ok';
    ok.textContent = 'OK';

    const save = () => {
      let v = input.value.trim();
      if (!v) { input.setAttribute('aria-invalid', 'true'); input.focus(); return; }
      if (def.kind === 'tel') {
        const n = normalizeUAPhone(v);
        if (!n) { input.setAttribute('aria-invalid', 'true'); input.focus(); return; }
        v = n;
      }
      REQUEST_STATE[def.key] = v;
      renderSummary(false);
    };
    ok.addEventListener('click', save);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); save(); }
    });
    wrap.append(input, ok);
    valueEl.appendChild(wrap);
    input.focus();
  }

  function buildSummary() {
    const summary = document.createElement('div');
    summary.className = 'chat-summary';

    const title = document.createElement('div');
    title.className = 'chat-summary-title';
    title.textContent = 'Ваша заявка';
    summary.appendChild(title);

    summaryRows().forEach((def) => {
      const r = document.createElement('div');
      const l = document.createElement('div');
      const v = document.createElement('div');
      r.className = 'chat-summary-row';
      l.className = 'chat-summary-label';
      v.className = 'chat-summary-value';
      l.textContent = def.label;
      v.textContent = def.value || '—';
      r.append(l, v);
      if (def.kind) {
        const eb = document.createElement('button');
        eb.type = 'button';
        eb.className = 'chat-summary-edit';
        eb.textContent = 'Змінити';
        eb.setAttribute('aria-label', 'Змінити: ' + def.label);
        eb.addEventListener('click', () => startEdit(def, v, eb));
        r.appendChild(eb);
      }
      summary.appendChild(r);
    });

    if (REQUEST_STATE.type === 'consultation' || REQUEST_STATE.type === 'estimate') {
      const note = document.createElement('div');
      note.className = 'chat-note';
      note.textContent = 'Консультація та детальний прорахунок вартості робіт — 2 000 грн.';
      summary.appendChild(note);
    }

    /* Поле для примітки */
    const notesWrap = document.createElement('div');
    notesWrap.className = 'chat-notes-wrap';
    const notesInput = document.createElement('input');
    notesInput.className = 'chat-notes-input';
    notesInput.type = 'text';
    notesInput.placeholder = '📝 Примітка (необов\'язково)';
    notesInput.autocomplete = 'off';
    notesInput.setAttribute('maxlength', '500');
    notesInput.setAttribute('aria-label', 'Примітка (необов\'язково)');
    notesInput.value = REQUEST_STATE.notes || '';
    notesInput.addEventListener('input', () => {
      REQUEST_STATE.notes = notesInput.value.trim().slice(0, 500);
    });
    notesWrap.appendChild(notesInput);
    summary.appendChild(notesWrap);

    const consent = document.createElement('div');
    consent.className = 'chat-consent';
    consent.textContent = 'Натискаючи «Надіслати», ви погоджуєтесь на обробку наданих контактних даних для зв’язку щодо вашої заявки.';
    summary.appendChild(consent);

    /* Кнопки */
    const btns = document.createElement('div');
    const restartBtn = document.createElement('button');
    const submitBtn = document.createElement('button');
    btns.className = 'chat-final-buttons';
    restartBtn.type = 'button';
    submitBtn.type = 'button';
    restartBtn.className = 'chat-final-btn edit';
    submitBtn.className = 'chat-final-btn submit';
    restartBtn.textContent = 'Почати спочатку';
    submitBtn.textContent = 'Надіслати';
    btns.append(restartBtn, submitBtn);
    summary.appendChild(btns);

    restartBtn.addEventListener('click', openRequest);
    submitBtn.addEventListener('click', () => sendRequest(submitBtn));
    return summary;
  }

  function renderSummary(scroll) {
    const b = $('chatBody');
    if (!b) return;
    const old = b.querySelector('.chat-summary');
    const el = buildSummary();
    if (old) old.replaceWith(el); else b.appendChild(el);
    if (scroll) chatScroll();
    updateProgress();
  }

  /* ---- Запасний канал, якщо відправка не вдалася ---- */
  function requestAsText() {
    const st = REQUEST_STATE;
    const lines = ['Заявка з сайту SA-MASTER.PRO'];
    const add = (label, val) => { if (val) lines.push(label + ': ' + val); };
    add('Тип', st.typeLabel);
    add("Ім'я", st.name);
    add('Телефон', st.phone);
    add('Об’єкт', st.location);
    add('Дизайн-проєкт', st.project);
    add('Початок робіт', st.timing);
    add('Консультація', st.consultationDate);
    add('Примітка', st.notes);
    return lines.join('\n');
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    return new Promise((resolve, reject) => {
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand('copy');
        ta.remove();
        if (ok) resolve(); else reject(new Error('copy failed'));
      } catch (e) { reject(e); }
    });
  }

  function showFallback() {
    const b = $('chatBody');
    if (!b || b.querySelector('.chat-fallback')) return;

    const box = document.createElement('div');
    box.className = 'chat-fallback';
    const t = document.createElement('div');
    t.className = 'chat-fallback-t';
    t.textContent = 'Можна написати або зателефонувати напряму. Скопіюйте заявку і вставте її в месенджер, щоб нічого не набирати вдруге.';
    const row = document.createElement('div');
    row.className = 'chat-fallback-row';

    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'chat-fallback-btn primary';
    copyBtn.textContent = 'Скопіювати заявку';
    copyBtn.addEventListener('click', () => {
      copyText(requestAsText())
        .then(() => { copyBtn.textContent = '✓ Скопійовано'; track('fallback_copy'); })
        .catch(() => { copyBtn.textContent = 'Не вдалося скопіювати'; });
    });

    const link = (href, label, ev, external) => {
      const a = document.createElement('a');
      a.className = 'chat-fallback-btn';
      a.href = href;
      a.textContent = label;
      if (external) { a.target = '_blank'; a.rel = 'noopener noreferrer'; }
      a.addEventListener('click', () => track(ev));
      return a;
    };

    row.append(
      copyBtn,
      link('https://t.me/sa_master', 'Telegram', 'fallback_telegram', true),
      link('viber://chat?number=%2B380979111871', 'Viber', 'fallback_viber', false),
      link('tel:+380979111871', 'Подзвонити', 'fallback_call', false)
    );
    box.append(t, row);
    b.appendChild(box);
    chatScroll();
  }

  function sendRequest(btn) {
    if (btn.disabled) return;
    btn.disabled = true;
    btn.textContent = 'Надсилаємо…';
    track('request_submit', { type: REQUEST_STATE.type });

    const payload = {
      name: REQUEST_STATE.name,
      phone: REQUEST_STATE.phone,
      type: REQUEST_STATE.type,
      typeLabel: REQUEST_STATE.typeLabel,
      location: REQUEST_STATE.location,
      timing: REQUEST_STATE.timing,
      consultationDate: REQUEST_STATE.consultationDate,
      project: REQUEST_STATE.project,
      notes: REQUEST_STATE.notes,
      source: 'SA-MASTER.PRO'
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    fetch('https://sa-master-worker.c6hht469s9.workers.dev/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    })
      .then((r) => r.text().then((t) => {
        let data;
        try { data = JSON.parse(t); }
        catch (e) { throw new Error('Worker повернув некоректну відповідь: ' + t); }
        if (!r.ok || !data.ok) throw new Error(data.error || 'Невідома помилка Worker');
        return data;
      }))
      .then(() => {
        btn.textContent = '✓ Надіслано';
        track('request_success', { type: REQUEST_STATE.type });
        const cb = $('chatBody');
        if (cb) {
          const dl = document.createElement('div');
          dl.className = 'chat-delivered';
          dl.textContent = 'Доставлено';
          cb.appendChild(dl);
        }
        chatBot('Заявку отримано. Дякую! Я зв’яжусь з вами після ознайомлення з інформацією.');
        setTimeout(closeRequest, 1800);
      })
      .catch((err) => {
        console.error('REQUEST ERROR:', err);
        track('request_error', { reason: err.name === 'AbortError' ? 'timeout' : 'error' });
        btn.disabled = false;
        btn.textContent = 'Повторити';
        const msg = err.name === 'AbortError'
          ? 'Час очікування вичерпано. Спробуйте ще раз або скористайтеся кнопками нижче.'
          : 'Не вдалося відправити заявку. Спробуйте ще раз або скористайтеся кнопками нижче.';
        chatBot(msg);
        showFallback();
      })
      .finally(() => clearTimeout(timeoutId));
  }

  /* ============ Калькулятор ============ */
  const calcState = { bathrooms: 1, system: 'tee' };
  const CALC_PRICES = {
    '1-tee': 160000,
    '1-radial': 240000,
    '2-tee': 340000,
    '2-radial': 420000
  };
  function updateCalc() {
    const el = $('calcPrice');
    if (!el) return;
    const price = CALC_PRICES[`${calcState.bathrooms}-${calcState.system}`] || 160000;
    el.textContent = 'від ' + price.toLocaleString('uk-UA') + ' грн';
  }

  /* ============ Соцслайдер ============ */
  let socialPage = 0;
  function setSocialPage(p) {
    socialPage = Math.max(0, Math.min(1, p));
    const track = $('socialTrack');
    if (track) track.style.transform = `translate3d(-${socialPage * 50}%, 0, 0)`;
    document.querySelectorAll('.ispd').forEach((d, i) => d.classList.toggle('act', i === socialPage));
  }
  function bindSocialSwipe() {
    const vp = $('socialViewport');
    if (!vp) return;
    let sx = 0, active = false;
    vp.addEventListener('touchstart', (e) => {
      sx = e.touches[0].clientX;
      active = true;
    }, { passive: true });
    vp.addEventListener('touchend', (e) => {
      if (!active) return;
      active = false;
      const dx = e.changedTouches[0].clientX - sx;
      if (Math.abs(dx) < 45) return;
      setSocialPage(dx < 0 ? socialPage + 1 : socialPage - 1);
    }, { passive: true });
  }

  /* ============ Глобальні обробники ============ */
  function bindGlobal() {
    document.addEventListener('click', (e) => {
      const closeBtn = e.target.closest('.mc');
      if (closeBtn) {
        e.preventDefault();
        closeModal(closeBtn.getAttribute('data-close'));
        return;
      }
      const openBtn = e.target.closest('[data-open]');
      if (openBtn) {
        e.preventDefault();
        openModal(openBtn.getAttribute('data-open'));
        return;
      }
      const wc = e.target.closest('.wc');
      if (wc) { openModal(wc.getAttribute('data-modal')); return; }

      const navBtn = e.target.closest('.mna');
      if (navBtn) {
        e.preventDefault();
        const dir = navBtn.getAttribute('data-direction');
        if (dir === 'next') goModal(currentModal + 1);
        if (dir === 'prev') goModal(currentModal - 1);
        const cur = modalEls[MODALS[currentModal]];
        focusEl(cur && cur.querySelector('.mna[data-direction="' + dir + '"]'));
        return;
      }
      const payBtn = e.target.closest('#calcPayBtn');
      if (payBtn) { e.preventDefault(); openModal('modalPayment'); return; }

      const opt = e.target.closest('.chat-option');
      if (opt) {
        const value = opt.dataset.chatValue;
        const parent = opt.parentElement;
        if (parent) parent.remove();
        if (chatStep === 0) { afterType(value); return; }
        if (chatStep === 5 && REQUEST_STATE.type === 'complex' && !REQUEST_STATE.project) {
          afterProject(value);
          return;
        }
        if (chatStep === 5) { afterTiming(value); return; }
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        const dlg = activeDialog();
        if (!dlg) return;
        const f = focusables(dlg);
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (!dlg.contains(document.activeElement)) { e.preventDefault(); first.focus(); return; }
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        return;
      }
      const wc = e.target && e.target.closest ? e.target.closest('.wc') : null;
      if (wc && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        openModal(wc.getAttribute('data-modal'));
        return;
      }
      if (e.key !== 'Escape') return;
      const lb = $('lightbox');
      if (lb && lb.classList.contains('act')) { closeLightbox(); return; }
      const pm = $('modalPayment');
      if (pm && pm.classList.contains('act')) { closeModal('modalPayment'); return; }
      const mc = $('modalCarousel');
      if (mc && mc.classList.contains('act')) { closeModal('modalAbout'); return; }
      const rm = $('requestModal');
      if (rm && rm.classList.contains('act')) closeRequest();
    });
  }

  /* ============ iOS: свайп вниз закриває sheet ============ */
  function bindSheetDrag() {
    const mcc = $('modalCarousel');
    const pay = $('modalPayment');
    if (mcc) mcc.addEventListener('click', (e) => { if (e.target === mcc) closeModal('modalAbout'); });
    if (pay) pay.addEventListener('click', (e) => { if (e.target === pay) closeModal('modalPayment'); });
    if (!mcc) return;

    let sheet = null, scroller = null, sy = 0, sx = 0, dy = 0, axis = null, dragging = false, t0 = 0;

    mcc.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1) { sheet = null; return; }
      sheet = mcc.querySelector('.mo.act');
      if (!sheet) return;
      scroller = sheet.querySelector('.mbox');
      sy = e.touches[0].clientY; sx = e.touches[0].clientX;
      dy = 0; axis = null; dragging = false; t0 = Date.now();
    }, { passive: true });

    mcc.addEventListener('touchmove', (e) => {
      if (!sheet || e.touches.length !== 1) return;
      const ddy = e.touches[0].clientY - sy;
      const ddx = e.touches[0].clientX - sx;
      if (axis === null) {
        if (Math.abs(ddy) < 6 && Math.abs(ddx) < 6) return;
        axis = Math.abs(ddy) > Math.abs(ddx) ? 'y' : 'x';
        dragging = axis === 'y' && ddy > 0 && (!scroller || scroller.scrollTop <= 0);
      }
      if (!dragging) return;
      e.preventDefault();
      dy = Math.max(0, ddy);
      sheet.style.transition = 'none';
      sheet.style.translate = '0 ' + dy + 'px';
      mcc.style.transition = 'none';
      mcc.style.backgroundColor = 'rgba(0,0,0,' + (0.4 * (1 - Math.min(1, dy / window.innerHeight))) + ')';
    }, { passive: false });

    const endDrag = () => {
      if (!sheet) return;
      const s = sheet;
      sheet = null;
      if (!dragging) return;
      const velocity = dy / Math.max(1, Date.now() - t0);
      s.style.transition = '';
      mcc.style.transition = '';
      mcc.style.backgroundColor = '';
      s.style.translate = '';
      if (dy > 120 || velocity > 0.6) closeModal('modalAbout');
      dragging = false;
    };
    mcc.addEventListener('touchend', endDrag);
    mcc.addEventListener('touchcancel', endDrag);
  }

  /* ============ iOS: жести у фотопереглядачі ============ */
  function bindLightboxGestures() {
    const lb = $('lightbox');
    const img = $('lightboxImage');
    if (!lb || !img) return;
    let sx = 0, sy = 0, dx = 0, dy = 0, axis = null, active = false, t0 = 0;

    lb.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1) { active = false; return; }
      sx = e.touches[0].clientX; sy = e.touches[0].clientY;
      dx = 0; dy = 0; axis = null; active = true; t0 = Date.now();
    }, { passive: true });

    lb.addEventListener('touchmove', (e) => {
      if (!active || e.touches.length !== 1) return;
      dx = e.touches[0].clientX - sx;
      dy = e.touches[0].clientY - sy;
      if (axis === null) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      }
      if (e.cancelable) e.preventDefault();
      img.style.transition = 'none';
      if (axis === 'x') {
        img.style.transform = 'translateX(' + dx + 'px)';
      } else {
        const p = Math.min(1, Math.abs(dy) / 320);
        img.style.transform = 'translateY(' + dy + 'px) scale(' + (1 - p * 0.25) + ')';
        lb.style.transition = 'none';
        lb.style.backgroundColor = 'rgba(0,0,0,' + (0.94 * (1 - p)) + ')';
      }
    }, { passive: false });

    const finish = () => {
      if (!active) return;
      active = false;
      img.style.transition = '';
      lb.style.transition = '';
      const v = Math.max(Math.abs(dx), Math.abs(dy)) / Math.max(1, Date.now() - t0);
      if (axis === 'x' && (Math.abs(dx) > 70 || v > 0.5)) {
        const dir = dx < 0 ? 1 : -1;
        lightboxIndex = (lightboxIndex + dir + GALLERY_SIZE) % GALLERY_SIZE;
        updateLightbox();
        img.style.transition = 'none';
        img.style.transform = 'translateX(' + (-dir * 60) + 'px)';
        img.style.opacity = '0';
        requestAnimationFrame(() => requestAnimationFrame(() => {
          img.style.transition = '';
          img.style.transform = '';
          img.style.opacity = '';
        }));
      } else if (axis === 'y' && (Math.abs(dy) > 110 || v > 0.6)) {
        closeLightbox();
      } else {
        img.style.transform = '';
        lb.style.backgroundColor = '';
      }
    };
    lb.addEventListener('touchend', finish);
    lb.addEventListener('touchcancel', finish);
  }

  /* ============ iOS: segmented control з рухомим повзунком ============ */
  function initSegmented() {
    document.querySelectorAll('.calc-s').forEach((seg) => {
      const thumb = document.createElement('span');
      thumb.className = 'seg-thumb';
      thumb.setAttribute('aria-hidden', 'true');
      seg.insertBefore(thumb, seg.firstChild);
      const place = () => {
        const btns = Array.from(seg.querySelectorAll('.calc-b'));
        const n = btns.length || 1;
        const i = Math.max(0, btns.findIndex((b) => b.classList.contains('act')));
        thumb.style.width = 'calc((100% - 4px - ' + ((n - 1) * 2) + 'px) / ' + n + ')';
        thumb.style.transform = 'translateX(calc(' + (i * 100) + '% + ' + (i * 2) + 'px))';
      };
      thumb.style.transition = 'none';
      place();
      requestAnimationFrame(() => requestAnimationFrame(() => { thumb.style.transition = ''; }));
      seg.addEventListener('click', () => requestAnimationFrame(place));
    });
  }

  /* ============ Відстеження кліків по контактах ============ */
  function bindTracking() {
    const map = [
      ['a[href^="tel:"]', 'click_call'],
      ['a[href*="t.me/"]', 'click_telegram'],
      ['a[href^="viber:"]', 'click_viber'],
      ['a[href*="instagram.com"]', 'click_instagram'],
      ['a[href*="facebook.com"]', 'click_facebook'],
      ['a[href*="youtube.com"]', 'click_youtube'],
      ['a[href$=".vcf"]', 'save_contact'],
      ['a[href*="privat24"], a[href*="monobank"]', 'click_payment_link'],
      ['a[href*="g.page"]', 'click_google_reviews']
    ];
    document.addEventListener('click', (e) => {
      if (!e.target || !e.target.closest) return;
      for (let i = 0; i < map.length; i++) {
        if (e.target.closest(map[i][0])) { track(map[i][1]); return; }
      }
    }, true);
  }

  /* ============ Ініціалізація ============ */
  function applyTheme() {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    document.body.classList.toggle('dark', mq.matches);
  }

  function bindGalleryClicks() {
    galleryDots.forEach((d, i) => {
      d.addEventListener('click', () => {
        currentSlide = i;
        updateGallery();
        startAutoplay();
      });
    });
    /* img має pointer-events:none, тому клік ловимо на слайді */
    document.querySelectorAll('.gs').forEach((slide, i) => {
      if (i >= GALLERY_SIZE) return;
      slide.style.cursor = 'zoom-in';
      slide.addEventListener('click', () => openLightbox(i));
    });
  }

  function bindLightbox() {
    const lb = $('lightbox');
    const lc = $('lightboxClose');
    const lp = $('lightboxPrev');
    const ln = $('lightboxNext');
    if (lc) lc.addEventListener('click', closeLightbox);
    if (lp) lp.addEventListener('click', () => {
      lightboxIndex = (lightboxIndex - 1 + GALLERY_SIZE) % GALLERY_SIZE;
      updateLightbox();
    });
    if (ln) ln.addEventListener('click', () => {
      lightboxIndex = (lightboxIndex + 1) % GALLERY_SIZE;
      updateLightbox();
    });
    if (lb) lb.addEventListener('click', (e) => { if (e.target === lb) closeLightbox(); });
  }

  function bindCalculator() {
    document.querySelectorAll('.calc-b').forEach((b) => {
      b.addEventListener('click', () => {
        const group = b.getAttribute('data-group');
        const value = b.getAttribute('data-value');
        if (group === 'bathrooms') calcState.bathrooms = parseInt(value, 10);
        if (group === 'system') calcState.system = value;
        document.querySelectorAll(`.calc-b[data-group="${group}"]`).forEach((x) => x.classList.remove('act'));
        b.classList.add('act');
        updateCalc();
        track('calc_change', { bathrooms: calcState.bathrooms, system: calcState.system });
      });
    });
    updateCalc();
  }

  function init() {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    applyTheme();
    if (mq.addEventListener) mq.addEventListener('change', applyTheme);

    const rl = $('requestLaunch');
    if (rl) rl.addEventListener('click', openRequest);
    const rc = $('requestClose');
    if (rc) rc.addEventListener('click', closeRequest);
    const rm = $('requestModal');
    if (rm) rm.addEventListener('click', (e) => { if (e.target === rm) closeRequest(); });

    if (galleryWindow) {
      galleryWindow.addEventListener('mouseenter', stopAutoplay);
      galleryWindow.addEventListener('mouseleave', startAutoplay);
    }
    bindGallerySwipe();
    bindGalleryClicks();
    bindLightbox();
    updateGallery(false);
    startAutoplay();

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) stopAutoplay();
      else {
        const lbEl = $('lightbox');
        if (!(lbEl && lbEl.classList.contains('act'))) startAutoplay();
      }
    });
    if (reduceMotion.addEventListener) {
      reduceMotion.addEventListener('change', () => { if (reduceMotion.matches) stopAutoplay(); else startAutoplay(); });
    }

    bindSocialSwipe();
    setTimeout(() => {
      const st = $('socialTrack');
      if (st && !reduceMotion.matches) {
        st.classList.add('hint');
        setTimeout(() => st.classList.remove('hint'), 1100);
      }
    }, 900);

    bindCalculator();

    const y = $('currentYear');
    if (y) y.textContent = new Date().getFullYear();

    bindGlobal();
    bindTracking();
    bindSheetDrag();
    bindLightboxGestures();
    initSegmented();
    openFromHash();
    window.addEventListener('hashchange', openFromHash);
  }

  /* Посилання з інших сторінок: /#request, /#price тощо */
  function openFromHash() {
    const h = (location.hash || '').replace('#', '');
    const map = { about: 'modalAbout', process: 'modalProcess', price: 'modalPrice', reviews: 'modalReviews' };
    if (h === 'request') { openRequest(); return; }
    if (map[h]) openModal(map[h]);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
