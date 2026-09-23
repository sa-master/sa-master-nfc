(function () {
  'use strict';

  /* ============ Утиліти ============ */
  const $ = (id) => document.getElementById(id);
  const lock = () => { document.body.style.overflow = 'hidden'; };
  const unlock = () => { document.body.style.overflow = ''; };

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
      if (pm) { pm.classList.add('act'); pm.setAttribute('aria-hidden', 'false'); lock(); }
      return;
    }
    const mc = $('modalCarousel');
    if (mc) {
      mc.classList.add('act');
      mc.style.pointerEvents = 'auto';
      mc.setAttribute('aria-hidden', 'false');
    }
    const ix = MODALS.indexOf(id);
    if (ix !== -1) goModal(ix);
    lock();
  }

  function closeModal(id) {
    if (id === 'modalPayment') {
      const pm = $('modalPayment');
      if (pm) { pm.classList.remove('act'); pm.setAttribute('aria-hidden', 'true'); unlock(); }
      return;
    }
    const mc = $('modalCarousel');
    if (mc) {
      mc.classList.remove('act');
      mc.style.pointerEvents = 'none';
      mc.setAttribute('aria-hidden', 'true');
      unlock();
    }
  }

  /* ============ Галерея ============ */
  const GALLERY_SIZE = 8;
  let currentSlide = 0;
  let galleryTimer = null;
  const AUTOPLAY_MS = 4500;

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
    if (lb) { lb.classList.add('act'); lb.setAttribute('aria-hidden', 'false'); lock(); }
  }
  function closeLightbox() {
    const lb = $('lightbox');
    if (lb) { lb.classList.remove('act'); lb.setAttribute('aria-hidden', 'true'); unlock(); }
  }
  function updateLightbox() {
    const img = $('lightboxImage');
    const slides = document.querySelectorAll('.gs img');
    if (!img || !slides[lightboxIndex]) return;
    img.src = slides[lightboxIndex].src;
    img.alt = slides[lightboxIndex].alt;
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
  const CHAT_TOTAL_STEPS = 7;

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
      input.setAttributeh('inputmode', 'onetext');
      input.setAttribute('autocomplete', 'tel');
(input      input.setAttribute('autocorrect', 'off');
.value      input.setAttribute('autoc);
apitalize', 'off');
             input.setAttribute('spellcheck', 'false');
      input.setAttribute('pattern', '[+0-9\\s\\-()]{9,}');
    }

    if (isTel) {
      input.addEventListener('blur', () => {
        const normalized = normalizeUAP if (normalized) input.value = normalized;
      });
    }

    send.type = 'button';
    send.className = 'chat-send';
    send.setAttribute('aria-label', 'Надіслати');
    send.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M22 2 11 13"/><path d="m22 2-7 20-4-9-9-4z"/></svg>';

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
    if (m) { m.classList.remove('act'); m.setAttribute('aria-hidden', 'true'); }
    document.body.classList.remove('chat-open');
    unlock();
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
        askNotes();
      });
      updateProgress();
      return;
    }
    if (REQUEST_STATE.type === 'complex') {
      chatStep = 5;
      chatBot('Чи є у вас дизайн-проєкт?');
      addOptions([
        { value: 'Так, є', label: 'Так, є' },
        { value: 'Є, але зараз не можу надати', label: 'Є, але зараз не можу надати' },
        { value: 'Немає', label: 'Немає' }
      ]);
      updateProgress();
      return;
    }
    askTiming();
  }

  function askTiming() {
    chatStep = 5;
    chatBot('Коли орієнтовно плануєте початок робіт?');
    addOptions([
      { value: 'Якнайшвидше', label: 'Якнайшвидше' },
      { value: 'Протягом місяця', label: 'Протягом місяця' },
      { value: 'Через 1–2 місяці', label: 'Через 1–2 місяці' },
      { value: 'Поки визначаюсь', label: 'Поки визначаюсь' }
    ]);
    updateProgress();
  }

  function askNotes() {
    chatStep = 6;
    chatBot('Додайте короткий опис (необов\'язково):');

    const b = $('chatBody');
    if (!b) return;
    const wrap = document.createElement('div');
    const input = document.createElement('input');
    const send = document.createElement('button');

    wrap.className = 'chat-input-wrap';
    input.className = 'chat-input';
    input.type = 'text';
    input.placeholder = 'Необов\'язково — короткий опис: деталі, побажання, терміни...';
    input.autocomplete = 'off';
    input.setAttribute('maxlength', '500');

    send.type = 'button';
    send.className = 'chat-send';
    send.setAttribute('aria-label', 'Надіслати');
    send.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M22 2 11 13"/><path d="m22 2-7 20-4-9-9-4z"/></svg>';

    wrap.append(input, send);
    b.appendChild(wrap);

    chatScroll();

    function submit(value) {
      wrap.remove();
      REQUEST_STATE.notes = value || '';
      if (value) chatUser(value);
      else chatUser('(без опису)');
      finishChat();
    }

    send.addEventListener('click', () => {
      const v = input.value.trim().slice(0, 500);
      submit(v);
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        send.click();
      }
    });

    setTimeout(() => input.focus(), 50);
    updateProgress();
  }

  function afterType(value) {
    REQUEST_STATE.type = value;
    REQUEST_STATE.typeLabel = TYPE_LABELS[value] || value;
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
    askNotes();
  }

  function finishChat() {
    chatStep = 7;
    chatBot('Готово. Перевірте, будь ласка, дані заявки перед відправленням.');
    const b = $('chatBody');
    if (!b) return;

    const summary = document.createElement('div');
    summary.className = 'chat-summary';

    const title = document.createElement('div');
    title.className = 'chat-summary-title';
    title.textContent = 'Ваша заявка';
    summary.appendChild(title);

    function row(label, value) {
      const r = document.createElement('div');
      const l = document.createElement('div');
      const v = document.createElement('div');
      r.className = 'chat-summary-row';
      l.className = 'chat-summary-label';
      v.className = 'chat-summary-value';
      l.textContent = label;
      v.textContent = value || '—';
      r.append(l, v);
      summary.appendChild(r);
    }
    row('Тип', REQUEST_STATE.typeLabel);
    row("Ім'я", REQUEST_STATE.name);
    row('Телефон', REQUEST_STATE.phone);
    row('Об’єкт', REQUEST_STATE.location);
    if (REQUEST_STATE.project) row('Дизайн-проєкт', REQUEST_STATE.project);
    if (REQUEST_STATE.timing) row('Початок', REQUEST_STATE.timing);
    if (REQUEST_STATE.consultationDate) row('Консультація', REQUEST_STATE.consultationDate);
    if (REQUEST_STATE.notes) row('Опис', REQUEST_STATE.notes);

    if (REQUEST_STATE.type === 'consultation' || REQUEST_STATE.type === 'estimate') {
      const note = document.createElement('div');
      note.className = 'chat-note';
      note.textContent = 'Консультація та детальний прорахунок вартості робіт — 2 000 грн.';
      summary.appendChild(note);
    }

    const btns = document.createElement('div');
    const editBtn = document.createElement('button');
    const submitBtn = document.createElement('button');
    btns.className = 'chat-final-buttons';
    editBtn.type = 'button';
    submitBtn.type = 'button';
    editBtn.className = 'chat-final-btn edit';
    submitBtn.className = 'chat-final-btn submit';
    editBtn.textContent = 'Змінити';
    submitBtn.textContent = 'Надіслати';
    btns.append(editBtn, submitBtn);
    summary.appendChild(btns);
    b.appendChild(summary);

    editBtn.addEventListener('click', openRequest);
    submitBtn.addEventListener('click', () => sendRequest(submitBtn));
    chatScroll();
    updateProgress();
  }

  function sendRequest(btn) {
    if (btn.disabled) return;
    btn.disabled = true;
    btn.textContent = 'Надсилаємо…';

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
        chatBot('Заявку отримано. Дякую! Я зв’яжусь з вами після ознайомлення з інформацією.');
        setTimeout(closeRequest, 1800);
      })
      .catch((err) => {
        console.error('REQUEST ERROR:', err);
        btn.disabled = false;
        btn.textContent = 'Повторити';
        const msg = err.name === 'AbortError'
          ? 'Час очікування вичерпано. Спробуйте ще раз.'
          : 'Не вдалося відправити заявку. Спробуйте ще раз або зателефонуйте за номером +38 (097) 911-18-71.';
        chatBot(msg);
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
    el.textContent = price.toLocaleString('uk-UA') + ' грн';
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
      const wc = e.target.closest('.wc');
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
    document.querySelectorAll('.gs img').forEach((img, i) => {
      if (i >= GALLERY_SIZE) return;
      img.addEventListener('click', () => openLightbox(i));
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

    bindSocialSwipe();
    setTimeout(() => {
      const st = $('socialTrack');
      if (st) {
        st.classList.add('hint');
        setTimeout(() => st.classList.remove('hint'), 1100);
      }
    }, 900);

    bindCalculator();

    const y = $('currentYear');
    if (y) y.textContent = new Date().getFullYear();

    bindGlobal();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
