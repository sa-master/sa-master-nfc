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
    input.addEventListener('key
