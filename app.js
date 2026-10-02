(function () {
  'use strict';

  /* =========================================================
   * БАЗОВІ УТИЛІТИ
   * ========================================================= */

  const $ = (id) => document.getElementById(id);

  const lock = () => {
    document.body.style.overflow = 'hidden';
  };

  const unlock = () => {
    document.body.style.overflow = '';
  };

  function normalizeUAPhone(input) {
    const digits = String(input || '').replace(/\D/g, '');

    if (!digits) return '';

    if (digits.length === 12 && digits.startsWith('380')) {
      return '+' + digits;
    }

    if (digits.length === 11 && digits.startsWith('80')) {
      return '+3' + digits;
    }

    if (digits.length === 10 && digits.startsWith('0')) {
      return '+38' + digits;
    }

    if (digits.length === 9) {
      return '+380' + digits;
    }

    if (digits.length >= 10 && digits.length <= 13) {
      return '+' + digits;
    }

    return '';
  }


  /* =========================================================
   * REFERRAL / ДЖЕРЕЛО ЗАЯВКИ
   *
   * Майстер отримує персональне посилання:
   *
   * https://sa-master.pro/?ref=TOKEN
   *
   * Сайт:
   * 1. читає TOKEN;
   * 2. зберігає його локально на 30 днів;
   * 3. передає Worker як ref;
   * 4. Worker сам перевіряє TOKEN та визначає master_id.
   * ========================================================= */

  const REFERRAL_STORAGE_KEY = 'saMasterReferralV1';
  const REFERRAL_TTL_MS = 30 * 24 * 60 * 60 * 1000;


  /*
   * Режим передачі заявки зареєстрованим майстром.
   * Вмикається ТІЛЬКИ для персонального URL з ?ref=...&request=1.
   * Збережений referral у localStorage не перемикає звичайну клієнтську форму.
   */
  function isMasterTransferMode() {
    try {
      const url = new URL(window.location.href);
      return Boolean(cleanReferralToken(url.searchParams.get('ref'))) &&
        url.searchParams.get('request') === '1';
    } catch {
      return false;
    }
  }

  const MASTER_TRANSFER_MODE = isMasterTransferMode();

  function requestText(clientText, masterText) {
    return MASTER_TRANSFER_MODE ? masterText : clientText;
  }

  function cleanReferralToken(value) {
    const token = String(value || '').trim();

    if (!token) return '';

    /*
     * Дозволяємо тільки безпечний набір символів.
     * crypto.randomUUID без дефісів також сюди підходить.
     */
    if (!/^[A-Za-z0-9_-]{6,120}$/.test(token)) {
      return '';
    }

    return token;
  }

  function saveReferralToken(token) {
    const cleanToken = cleanReferralToken(token);

    if (!cleanToken) return;

    const data = {
      token: cleanToken,
      savedAt: Date.now(),
      expiresAt: Date.now() + REFERRAL_TTL_MS
    };

    try {
      localStorage.setItem(
        REFERRAL_STORAGE_KEY,
        JSON.stringify(data)
      );
    } catch (error) {
      console.warn('Не вдалося зберегти referral token:', error);
    }
  }

  function getStoredReferralToken() {
    try {
      const raw = localStorage.getItem(REFERRAL_STORAGE_KEY);

      if (!raw) return '';

      const data = JSON.parse(raw);

      const token = cleanReferralToken(data?.token);
      const expiresAt = Number(data?.expiresAt || 0);

      if (!token || !expiresAt) {
        localStorage.removeItem(REFERRAL_STORAGE_KEY);
        return '';
      }

      if (Date.now() > expiresAt) {
        localStorage.removeItem(REFERRAL_STORAGE_KEY);
        return '';
      }

      return token;

    } catch (error) {
      console.warn('Не вдалося прочитати referral token:', error);

      try {
        localStorage.removeItem(REFERRAL_STORAGE_KEY);
      } catch {}

      return '';
    }
  }

  function captureReferralFromUrl() {
    try {
      const url = new URL(window.location.href);

      const token = cleanReferralToken(
        url.searchParams.get('ref')
      );

      if (!token) return;

      /*
       * Новий валідний ?ref= має пріоритет.
       * Тобто якщо клієнт відкрив персональне посилання
       * іншого майстра — запам'ятовується новий referral.
       */
      saveReferralToken(token);

    } catch (error) {
      console.warn('Не вдалося прочитати referral з URL:', error);
    }
  }

  function getReferralToken() {
    return getStoredReferralToken();
  }


  /* =========================================================
   * МОДАЛЬНА КАРУСЕЛЬ
   * ========================================================= */

  const MODALS = [
    'modalAbout',
    'modalProcess',
    'modalPrice',
    'modalReviews'
  ];

  let currentModal = 0;

  const modalEls = {};

  MODALS.forEach((id) => {
    modalEls[id] = $(id);
  });

  function goModal(index) {
    currentModal = Math.max(
      0,
      Math.min(MODALS.length - 1, index)
    );

    MODALS.forEach((id, position) => {
      const modal = modalEls[id];

      if (!modal) return;

      const active = position === currentModal;

      modal.classList.toggle('act', active);

      modal.style.zIndex = active ? '2' : '1';
      modal.style.opacity = active ? '1' : '0';
      modal.style.visibility = active
        ? 'visible'
        : 'hidden';

      modal.style.transform = active
        ? 'translateX(0)'
        : (
            position < currentModal
              ? 'translateX(-100%)'
              : 'translateX(100%)'
          );

      modal.setAttribute(
        'aria-hidden',
        String(!active)
      );
    });

    document
      .querySelectorAll('.mp')
      .forEach((dots) => {
        dots
          .querySelectorAll('.dot')
          .forEach((dot, index2) => {
            dot.classList.toggle(
              'act',
              index2 === currentModal
            );
          });
      });
  }

  function openModal(id) {
    if (id === 'modalPayment') {
      const payment = $('modalPayment');

      if (payment) {
        payment.classList.add('act');
        payment.setAttribute(
          'aria-hidden',
          'false'
        );
        lock();
      }

      return;
    }

    const carousel = $('modalCarousel');

    if (carousel) {
      carousel.classList.add('act');
      carousel.style.pointerEvents = 'auto';

      carousel.setAttribute(
        'aria-hidden',
        'false'
      );
    }

    const index = MODALS.indexOf(id);

    if (index !== -1) {
      goModal(index);
    }

    lock();
  }

  function closeModal(id) {
    if (id === 'modalPayment') {
      const payment = $('modalPayment');

      if (payment) {
        payment.classList.remove('act');

        payment.setAttribute(
          'aria-hidden',
          'true'
        );

        unlock();
      }

      return;
    }

    const carousel = $('modalCarousel');

    if (carousel) {
      carousel.classList.remove('act');

      carousel.style.pointerEvents = 'none';

      carousel.setAttribute(
        'aria-hidden',
        'true'
      );

      unlock();
    }
  }


  /* =========================================================
   * ГАЛЕРЕЯ
   * ========================================================= */

  const GALLERY_SIZE = 8;
  const AUTOPLAY_MS = 4500;

  let currentSlide = 0;
  let galleryTimer = null;

  const galleryTrack = $('galleryTrack');
  const galleryCounter = $('galleryCounter');

  const galleryDots = Array.from(
    document.querySelectorAll('.gdot')
  );

  const galleryWindow = $('galleryWindow');

  function updateGallery(animate = true) {
    if (!galleryTrack) return;

    galleryTrack.style.transition = animate
      ? 'transform .5s cubic-bezier(.22,.61,.36,1)'
      : 'none';

    galleryTrack.style.transform =
      `translate3d(-${currentSlide * 100}%, 0, 0)`;

    if (galleryCounter) {
      galleryCounter.textContent =
        `${currentSlide + 1} / ${GALLERY_SIZE}`;
    }

    galleryDots.forEach((dot, index) => {
      const active = index === currentSlide;

      dot.classList.toggle(
        'act',
        active
      );

      dot.setAttribute(
        'aria-selected',
        String(active)
      );
    });
  }

  function nextSlide() {
    currentSlide =
      (currentSlide + 1) % GALLERY_SIZE;

    updateGallery();
  }

  function prevSlide() {
    currentSlide =
      (currentSlide - 1 + GALLERY_SIZE) %
      GALLERY_SIZE;

    updateGallery();
  }

  function stopAutoplay() {
    if (galleryTimer) {
      clearInterval(galleryTimer);
      galleryTimer = null;
    }
  }

  function startAutoplay() {
    stopAutoplay();

    galleryTimer = setInterval(
      nextSlide,
      AUTOPLAY_MS
    );
  }

  function bindGallerySwipe() {
    if (!galleryWindow) return;

    let startX = 0;
    let startY = 0;
    let active = false;

    galleryWindow.addEventListener(
      'touchstart',
      (event) => {
        if (event.touches.length !== 1) return;

        startX = event.touches[0].clientX;
        startY = event.touches[0].clientY;

        active = true;

        stopAutoplay();
      },
      { passive: true }
    );

    galleryWindow.addEventListener(
      'touchend',
      (event) => {
        if (!active) return;

        active = false;

        const dx =
          event.changedTouches[0].clientX -
          startX;

        const dy =
          event.changedTouches[0].clientY -
          startY;

        if (
          Math.abs(dx) > 45 &&
          Math.abs(dx) > Math.abs(dy)
        ) {
          dx < 0
            ? nextSlide()
            : prevSlide();
        }

        startAutoplay();
      },
      { passive: true }
    );
  }


  /* =========================================================
   * LIGHTBOX
   * ========================================================= */

  let lightboxIndex = 0;

  function updateLightbox() {
    const image = $('lightboxImage');

    const slides =
      document.querySelectorAll('.gs img');

    if (
      !image ||
      !slides[lightboxIndex]
    ) {
      return;
    }

    image.src =
      slides[lightboxIndex].src;

    image.alt =
      slides[lightboxIndex].alt;

    const counter =
      $('lightboxCounter');

    if (counter) {
      counter.textContent =
        `${lightboxIndex + 1} / ${GALLERY_SIZE}`;
    }
  }

  function openLightbox(index) {
    lightboxIndex = Math.max(
      0,
      Math.min(
        GALLERY_SIZE - 1,
        index
      )
    );

    updateLightbox();

    const lightbox = $('lightbox');

    if (lightbox) {
      lightbox.classList.add('act');

      lightbox.setAttribute(
        'aria-hidden',
        'false'
      );

      lock();
    }
  }

  function closeLightbox() {
    const lightbox = $('lightbox');

    if (lightbox) {
      lightbox.classList.remove('act');

      lightbox.setAttribute(
        'aria-hidden',
        'true'
      );

      unlock();
    }
  }


  /* =========================================================
   * ЧАТ-ЗАЯВКА
   * ========================================================= */

  const WORKER_URL =
    'https://sa-master-worker.c6hht469s9.workers.dev';

  const REQUEST_STATE = {
    type: '',
    typeLabel: '',
    name: '',
    phone: '',
    location: '',
    timing: '',
    project: '',
    consultationDate: '',
    consultationFormat: '',
    servicePrice: '',
    notes: '',
    workDescription: '',
    projectFile: null,
    photoFile: null,

    requestCode: '',
    uploadToken: '',
    fileUploaded: false,
    photoUploaded: false
  };

  const TYPE_LABELS = {
    complex: 'Комплексний монтаж',
    local: 'Локальний монтаж',
    consultation: 'Консультація',
    estimate: 'Прорахунок',
    plumbing: '🔧 Монтаж сантехніки',
    repair: '🚿 Ремонт або заміна',
    emergency: '🚨 Аварійний виклик',
    other_job: '📋 Інше'
  };

  let chatStep = 0;
  let chatHistory = [];

  const CHAT_TOTAL_STEPS = 6;


  function saveBack(renderQuestion) {
    chatHistory.push({
      state: {
        ...REQUEST_STATE
      },

      renderQuestion,
      chatStep
    });
  }


  function appendBackControl(parent) {
    if (
      !parent ||
      chatHistory.length === 0
    ) {
      return;
    }

    const button =
      document.createElement('button');

    button.type = 'button';
    button.className = 'chat-back';
    button.textContent = '← Назад';

    button.addEventListener(
      'click',
      goBackInChat
    );

    parent.appendChild(button);
  }


  function goBackInChat() {
    const previous =
      chatHistory.pop();

    if (!previous) return;

    Object
      .keys(REQUEST_STATE)
      .forEach((key) => {
        REQUEST_STATE[key] =
          previous.state[key];
      });

    const body = $('chatBody');

    if (body) {
      body.innerHTML = '';
    }

    chatStep =
      previous.chatStep;

    previous.renderQuestion();
  }


  function chatScroll() {
    const body = $('chatBody');

    if (body) {
      setTimeout(() => {
        body.scrollTop =
          body.scrollHeight;
      }, 50);
    }
  }


  function chatMsg(text, who) {
    const body = $('chatBody');

    if (!body) return;

    const row =
      document.createElement('div');

    const bubble =
      document.createElement('div');

    row.className =
      `chat-message ${who}`;

    bubble.className =
      'chat-bubble';

    bubble.textContent =
      text;

    row.appendChild(bubble);
    body.appendChild(row);

    chatScroll();
  }


  const chatBot = (text) =>
    chatMsg(text, 'bot');

  const chatUser = (text) =>
    chatMsg(text, 'user');


  function updateProgress() {
    const bar =
      $('chatProgressBar');

    if (!bar) return;

    bar.style.width =
      Math.max(
        5,
        Math.min(
          100,
          ((chatStep + 1) /
            CHAT_TOTAL_STEPS) *
            100
        )
      ) + '%';
  }


  function addOptions(
    options,
    onChoose
  ) {
    const body = $('chatBody');

    if (!body) return;

    const wrap =
      document.createElement('div');

    wrap.className =
      'chat-options';

    options.forEach(
      ({ value, label }) => {
        const button =
          document.createElement(
            'button'
          );

        button.type = 'button';

        button.className =
          'chat-option';

        button.textContent =
          label;

        button.addEventListener(
          'click',
          (event) => {
            event.preventDefault();
            event.stopPropagation();

            wrap.remove();

            onChoose(
              value,
              label
            );
          },
          { once: true }
        );

        wrap.appendChild(
          button
        );
      }
    );

    appendBackControl(wrap);

    body.appendChild(wrap);

    chatScroll();
  }


  function addInput(
    placeholder,
    type,
    onDone,
    validate
  ) {
    const body =
      $('chatBody');

    if (!body) return;

    const section =
      document.createElement('div');

    const wrap =
      document.createElement('div');

    const input =
      document.createElement('input');

    const send =
      document.createElement('button');

    section.className =
      'chat-input-section';

    wrap.className =
      'chat-input-wrap';

    input.className =
      'chat-input';

    input.type =
      type || 'text';

    input.placeholder =
      placeholder;

    input.autocomplete =
      type === 'tel'
        ? 'tel'
        : 'off';

    input.setAttribute(
      'aria-label',
      placeholder
    );

    if (type === 'tel') {
      input.inputMode = 'text';

      input.setAttribute(
        'autocorrect',
        'off'
      );

      input.setAttribute(
        'autocapitalize',
        'off'
      );

      input.setAttribute(
        'spellcheck',
        'false'
      );

      input.addEventListener(
        'blur',
        () => {
          const value =
            normalizeUAPhone(
              input.value
            );

          if (value) {
            input.value =
              value;
          }
        }
      );
    }

    send.type = 'button';

    send.className =
      'chat-send';

    send.setAttribute(
      'aria-label',
      'Надіслати'
    );

    send.innerHTML = `
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path d="M22 2 11 13"/>
        <path d="m22 2-7 20-4-9-9-4z"/>
      </svg>
    `;

    const submit = () => {
      let value =
        input.value.trim();

      if (!value) {
        return input.focus();
      }

      if (type === 'tel') {
        value =
          normalizeUAPhone(
            value
          );

        if (!value) {
          input.setAttribute(
            'aria-invalid',
            'true'
          );

          return input.focus();
        }
      }

      if (
        validate &&
        !validate(value)
      ) {
        input.setAttribute(
          'aria-invalid',
          'true'
        );

        return input.focus();
      }

      section.remove();

      chatUser(value);

      onDone(value);
    };

    send.addEventListener(
      'click',
      submit
    );

    input.addEventListener(
      'keydown',
      (event) => {
        if (
          event.key === 'Enter'
        ) {
          event.preventDefault();

          submit();
        }
      }
    );

    wrap.append(
      input,
      send
    );

    section.appendChild(
      wrap
    );

    appendBackControl(
      section
    );

    body.appendChild(
      section
    );

    setTimeout(
      () => input.focus(),
      50
    );

    chatScroll();
  }


  function addFileInput(
    onDone,
    options = {}
  ) {
    const body =
      $('chatBody');

    if (!body) return;

    const wrap =
      document.createElement('div');

    const title =
      document.createElement('div');

    const hint =
      document.createElement('div');

    const actions =
      document.createElement('div');

    const input =
      document.createElement('input');

    const pick =
      document.createElement('button');

    const skip =
      document.createElement('button');

    wrap.className =
      'chat-file-wrap';

    title.className =
      'chat-file-title';

    hint.className =
      'chat-file-hint';

    actions.className =
      'chat-file-actions';

    title.textContent =
      options.title || 'Прикріпіть дизайн-проєкт';

    hint.textContent =
      options.hint || 'PDF, фото, Word, Excel або ZIP. Максимальний розмір — 25 МБ.';

    input.type = 'file';
    input.hidden = true;
    input.style.display = 'none';

    input.accept =
      options.accept || '.pdf,.jpg,.jpeg,.png,.webp,.heic,.doc,.docx,.xls,.xlsx,.zip,.txt';

    pick.type = 'button';

    pick.className =
      'chat-file-pick chat-option';

    pick.textContent =
      options.pickLabel || 'Обрати файл';

    skip.type = 'button';

    skip.className =
      'chat-file-skip';

    /* Акуратний блок завантаження замість системного file input */
    wrap.style.display = 'grid';
    wrap.style.gap = '10px';
    wrap.style.padding = '16px';
    wrap.style.borderRadius = '18px';
    wrap.style.background = 'rgba(255,255,255,.055)';
    title.style.fontWeight = '700';
    title.style.fontSize = '18px';
    hint.style.opacity = '.68';
    hint.style.fontSize = '14px';
    hint.style.lineHeight = '1.35';
    actions.style.display = 'grid';
    actions.style.gridTemplateColumns = '1fr 1fr';
    actions.style.gap = '10px';
    pick.style.gridColumn = '1 / -1';
    pick.style.width = '100%';
    pick.style.margin = '0';
    skip.style.minHeight = '44px';
    skip.style.border = '0';
    skip.style.borderRadius = '12px';
    skip.style.background = 'rgba(255,255,255,.08)';
    skip.style.color = 'inherit';
    skip.style.font = 'inherit';

    skip.textContent =
      options.skipLabel || 'Надішлю пізніше';

    pick.addEventListener(
      'click',
      () => input.click()
    );

    input.addEventListener(
      'change',
      () => {
        const file =
          input.files &&
          input.files[0];

        if (!file) return;

        if (
          file.size >
          25 * 1024 * 1024
        ) {
          chatBot(
            'Файл завеликий. Оберіть файл до 25 МБ.'
          );

          input.value = '';

          return;
        }

        wrap.remove();

        onDone(file);
      }
    );

    skip.addEventListener(
      'click',
      () => {
        wrap.remove();

        onDone(null);
      }
    );

    actions.append(
      pick,
      skip
    );

    wrap.append(
      title,
      hint,
      input,
      actions
    );

    appendBackControl(
      wrap
    );

    body.appendChild(
      wrap
    );

    chatScroll();
  }


  function resetChat() {
    const body =
      $('chatBody');

    if (body) {
      body.innerHTML = '';
    }

    Object
      .keys(REQUEST_STATE)
      .forEach((key) => {
        REQUEST_STATE[key] =
          (key === 'projectFile' || key === 'photoFile')
            ? null
            : '';
      });

    REQUEST_STATE.fileUploaded = false;
    REQUEST_STATE.photoUploaded = false;

    chatStep = 0;

    chatHistory = [];

    updateProgress();
  }


  function openRequest() {
    const modal =
      $('requestModal');

    if (!modal) return;

    resetChat();

    document.body.classList.add(
      'chat-open'
    );

    modal.classList.add(
      'act'
    );

    modal.setAttribute(
      'aria-hidden',
      'false'
    );

    lock();

    askType();
  }


  function closeRequest() {
    const modal =
      $('requestModal');

    if (modal) {
      modal.classList.remove(
        'act'
      );

      modal.setAttribute(
        'aria-hidden',
        'true'
      );
    }

    document.body.classList.remove(
      'chat-open'
    );

    unlock();
  }


  function askType() {
    chatStep = 0;
    updateProgress();

    if (MASTER_TRANSFER_MODE) {
      chatBot('Передайте заявку від замовника. Це займе менше хвилини.');
      chatBot('Що потрібно зробити?');
      addOptions(
        [
          { value: 'plumbing', label: '🔧 Монтаж сантехніки' },
          { value: 'repair', label: '🚿 Ремонт або заміна' },
          { value: 'emergency', label: '🚨 Аварійний виклик' },
          { value: 'other_job', label: '📋 Інше' }
        ],
        afterType
      );
      return;
    }

    chatBot('Вітаю. Поставлю кілька коротких запитань, щоб підготувати заявку.');
    chatBot('Що вас цікавить?');
    addOptions(
      [
        { value: 'complex', label: 'Комплексний монтаж' },
        { value: 'local', label: 'Локальний монтаж' },
        { value: 'consultation', label: 'Консультація' },
        { value: 'estimate', label: 'Прорахунок' }
      ],
      afterType
    );
  }


  function askMasterLocation() {
    chatStep = 1;
    updateProgress();
    chatBot('Де об’єкт?');
    addInput(
      'ЖК / район / адреса',
      'text',
      (value) => {
        saveBack(askMasterLocation);
        REQUEST_STATE.location = value;
        askMasterDescription();
      }
    );
  }


  function askMasterDescription() {
    chatStep = 2;
    updateProgress();
    chatBot('Коротко опишіть, що потрібно зробити.');
    addInput(
      'Наприклад: замінити бойлер 80 л',
      'text',
      (value) => {
        saveBack(askMasterDescription);
        REQUEST_STATE.workDescription = value;
        askMasterProject();
      }
    );
  }


  function askMasterProject() {
    chatStep = 3;
    updateProgress();
    chatBot('Чи є у замовника дизайн-проєкт?');
    addOptions(
      [
        { value: 'Є', label: '✅ Є' },
        { value: 'Немає', label: '❌ Немає' },
        { value: 'Не знаю', label: '❓ Не знаю' }
      ],
      (value, label) => {
        saveBack(askMasterProject);
        REQUEST_STATE.project = value;
        chatUser(label);
        if (value === 'Є') {
          askMasterProjectFile();
        } else {
          REQUEST_STATE.projectFile = null;
          askMasterTiming();
        }
      }
    );
  }


  function askMasterProjectFile() {
    chatStep = 3;
    updateProgress();
    addFileInput(
      (file) => {
        saveBack(askMasterProjectFile);
        REQUEST_STATE.projectFile = file || null;
        if (file) chatUser(`Проєкт: ${file.name}`);
        else chatUser('Проєкт без файлу');
        askMasterTiming();
      },
      {
        title: '📐 Файл дизайн-проєкту',
        hint: 'Необов’язково · PDF, фото або документ · до 25 МБ.',
        accept: 'image/*,.heic,.heif,.pdf,.doc,.docx,.xls,.xlsx,.zip,.txt',
        pickLabel: '📎 Додати проєкт',
        skipLabel: 'Без файлу'
      }
    );
  }


  function askMasterTiming() {
    chatStep = 3;
    updateProgress();
    chatBot('Коли потрібно виконати роботу?');
    addOptions(
      [
        { value: 'Сьогодні', label: '🔥 Сьогодні' },
        { value: 'Завтра', label: 'Завтра' },
        { value: 'Найближчими днями', label: 'Найближчими днями' },
        { value: 'Дата не визначена', label: 'Дата не визначена' }
      ],
      (value, label) => {
        saveBack(askMasterTiming);
        REQUEST_STATE.timing = value;
        chatUser(label);
        askMasterName();
      }
    );
  }


  function askMasterName() {
    chatStep = 4;
    updateProgress();
    chatBot('Як звати замовника?');
    addInput(
      'Ім’я замовника',
      'text',
      (value) => {
        saveBack(askMasterName);
        REQUEST_STATE.name = value;
        askMasterPhone();
      }
    );
  }


  function askMasterPhone() {
    chatStep = 5;
    updateProgress();
    chatBot('Вкажіть номер телефону замовника.');
    addInput(
      'Наприклад: 0979111871',
      'tel',
      (value) => {
        saveBack(askMasterPhone);
        REQUEST_STATE.phone = value;
        askMasterPhoto();
      },
      (value) => {
        const digits = String(value || '').replace(/\D/g, '');
        return digits.length >= 9 && digits.length <= 13;
      }
    );
  }


  function askMasterPhoto() {
    chatStep = 5;
    updateProgress();
    addFileInput(
      (file) => {
        saveBack(askMasterPhoto);
        if (file) {
          REQUEST_STATE.photoFile = file;
          chatUser(`Фото: ${file.name}`);
        } else {
          REQUEST_STATE.photoFile = null;
          chatUser('Без фото');
        }
        finishChat();
      },
      {
        title: '📷 Фото об’єкта',
        hint: 'Необов’язково · фото допоможе майстру швидше оцінити роботу · до 25 МБ.',
        accept: 'image/*,.heic,.heif',
        pickLabel: '📷 Додати фото',
        skipLabel: 'Пропустити'
      }
    );
  }

  function askName() {
    chatStep = 1;

    updateProgress();

    chatBot(
      requestText('Як до вас звертатися?', 'Як звати замовника?')
    );

    addInput(
      requestText("Ваше ім’я", "Ім’я замовника"),
      'text',
      (value) => {
        saveBack(askName);

        REQUEST_STATE.name =
          value;

        askPhone();
      }
    );
  }


  function askPhone() {
    chatStep = 2;

    updateProgress();

    chatBot(
      requestText('Залиште номер телефону для зв’язку.', 'Вкажіть номер телефону замовника.')
    );

    addInput(
      'Наприклад: 0979111871',
      'tel',
      (value) => {
        saveBack(askPhone);

        REQUEST_STATE.phone =
          value;

        if (
          REQUEST_STATE.type ===
          'consultation'
        ) {
          askConsultationFormat(
            () =>
              askConsultationDate(
                finishChat
              )
          );
        } else if (
          REQUEST_STATE.type ===
          'estimate'
        ) {
          askEstimateConsultation();
        } else {
          askLocation();
        }
      },
      (value) => {
        const digits =
          String(value || '')
            .replace(/\D/g, '');

        return (
          digits.length >= 9 &&
          digits.length <= 13
        );
      }
    );
  }


  function askLocation() {
    chatStep = 3;

    updateProgress();

    chatBot(
      requestText(
        'Де знаходиться об’єкт? Вкажіть ЖК, вулицю або адресу.',
        'Де знаходиться об’єкт замовника? Вкажіть ЖК, вулицю або адресу.'
      )
    );

    addInput(
      'Наприклад: ЖК Файна Таун, вул. Салютна',
      'text',
      (value) => {
        saveBack(
          askLocation
        );

        REQUEST_STATE.location =
          value;

        if (
          REQUEST_STATE.type ===
          'complex'
        ) {
          askComplexProject();
        } else {
          askTiming();
        }
      }
    );
  }


  function askConsultationFormat(
    onDone
  ) {
    chatStep = 3;

    updateProgress();

    chatBot(
      'Який формат консультації вам підходить?'
    );

    addOptions(
      [
        {
          value: 'remote',
          label: 'Віддалено'
        },
        {
          value: 'onsite',
          label: 'З виїздом на об’єкт'
        }
      ],
      (value, label) => {
        saveBack(
          () =>
            askConsultationFormat(
              onDone
            )
        );

        REQUEST_STATE.consultationFormat =
          value;

        chatUser(label);

        if (
          value === 'onsite' &&
          !REQUEST_STATE.location
        ) {
          askConsultationLocation(
            onDone
          );

          return;
        }

        onDone();
      }
    );
  }


  function askConsultationLocation(
    onDone
  ) {
    chatStep = 4;

    updateProgress();

    chatBot(
      'Вкажіть адресу або ЖК об’єкта.'
    );

    addInput(
      'Наприклад: ЖК Файна Таун, вул. Салютна',
      'text',
      (value) => {
        saveBack(
          () =>
            askConsultationLocation(
              onDone
            )
        );

        REQUEST_STATE.location =
          value;

        onDone();
      }
    );
  }


  function askConsultationDate(
    onDone
  ) {
    chatStep = 4;

    updateProgress();

    chatBot(
      requestText(
        'Коли вам буде зручно провести консультацію?',
        'Коли замовнику буде зручно провести консультацію?'
      )
    );

    addInput(
      'Наприклад: 18 вересня після 17:00',
      'text',
      (value) => {
        saveBack(
          () =>
            askConsultationDate(
              onDone
            )
        );

        REQUEST_STATE.consultationDate =
          value;

        onDone();
      }
    );
  }


  function askComplexProject() {
    chatStep = 4;

    updateProgress();

    chatBot(
      requestText('Чи є у вас дизайн-проєкт?', 'Чи є у замовника дизайн-проєкт?')
    );

    addOptions(
      [
        {
          value: 'Так, є',
          label: 'Так, є'
        },
        {
          value: 'Є, але зараз не можу надати',
          label: 'Є, але зараз не можу надати'
        },
        {
          value: 'Немає',
          label: 'Немає'
        }
      ],
      (value, label) => {
        saveBack(
          askComplexProject
        );

        chatUser(label);

        if (
          value !== 'Так, є'
        ) {
          REQUEST_STATE.project =
            value;

          askTiming();

          return;
        }

        REQUEST_STATE.project =
          'Є, файл додається';

        askProjectConsultation(
          () => {
            askProjectFile(
              askTiming
            );
          }
        );
      }
    );
  }


  function askProjectConsultation(
    onDone
  ) {
    chatBot(
      'Чи потрібна консультація перед початком робіт?'
    );

    addOptions(
      [
        {
          value: 'yes',
          label: 'Так, потрібна'
        },
        {
          value: 'no',
          label: 'Ні, не потрібна'
        }
      ],
      (value, label) => {
        saveBack(
          () =>
            askProjectConsultation(
              onDone
            )
        );

        chatUser(label);

        if (
          value === 'no'
        ) {
          onDone();

          return;
        }

        askConsultationFormat(
          () =>
            askConsultationDate(
              onDone
            )
        );
      }
    );
  }


  function askEstimateConsultation() {
    chatStep = 3;

    updateProgress();

    chatBot(
      'Чи потрібна консультація перед прорахунком?'
    );

    addOptions(
      [
        {
          value: 'yes',
          label: 'Так, потрібна'
        },
        {
          value: 'no',
          label: 'Ні, потрібен лише прорахунок'
        }
      ],
      (value, label) => {
        saveBack(
          askEstimateConsultation
        );

        chatUser(label);

        if (
          value === 'no'
        ) {
          askEstimateProject();

          return;
        }

        askConsultationFormat(
          () =>
            askConsultationDate(
              askEstimateProject
            )
        );
      }
    );
  }


  function askEstimateProject() {
    chatStep = 4;

    updateProgress();

    chatBot(
      'Чи є дизайн-проєкт?'
    );

    addOptions(
      [
        {
          value: 'yes',
          label: 'Є проєкт'
        },
        {
          value: 'no',
          label: 'Немає проєкту'
        }
      ],
      (value, label) => {
        saveBack(
          askEstimateProject
        );

        chatUser(label);

        if (
          value === 'no'
        ) {
          REQUEST_STATE.project =
            'Немає';

          askTiming();

          return;
        }

        REQUEST_STATE.project =
          'Є, файл додається';

        askProjectFile(
          askTiming
        );
      }
    );
  }


  function askProjectFile(
    onDone
  ) {
    chatBot(
      'Оберіть файл проєкту. Якщо зараз його немає під рукою — заявку все одно можна надіслати.'
    );

    addFileInput(
      (file) => {
        saveBack(
          () =>
            askProjectFile(
              onDone
            )
        );

        if (file) {
          REQUEST_STATE.projectFile =
            file;

          chatUser(
            `Файл: ${file.name}`
          );
        } else {
          REQUEST_STATE.project =
            'Є, надішле пізніше';

          chatUser(
            'Надішлю пізніше'
          );
        }

        onDone();
      }
    );
  }


  function askTiming() {
    chatStep = 5;

    updateProgress();

    chatBot(
      requestText(
        'Коли орієнтовно плануєте початок робіт?',
        'Коли замовник орієнтовно планує початок робіт?'
      )
    );

    addOptions(
      [
        {
          value: 'Якнайшвидше',
          label: 'Якнайшвидше'
        },
        {
          value: 'Протягом місяця',
          label: 'Протягом місяця'
        },
        {
          value: 'Через 1–2 місяці',
          label: 'Через 1–2 місяці'
        },
        {
          value: 'Поки визначаюсь',
          label: 'Поки визначаюсь'
        }
      ],
      (value) => {
        saveBack(
          askTiming
        );

        REQUEST_STATE.timing =
          value;

        chatUser(value);

        finishChat();
      }
    );
  }


  function afterType(value) {
    saveBack(
      askType
    );

    REQUEST_STATE.type =
      value;

    REQUEST_STATE.typeLabel =
      TYPE_LABELS[value] ||
      value;

    chatUser(
      REQUEST_STATE.typeLabel
    );

    if (MASTER_TRANSFER_MODE) {
      askMasterLocation();
      return;
    }

    askName();
  }


  function consultationFormatLabel() {
    if (
      REQUEST_STATE.consultationFormat ===
      'remote'
    ) {
      return 'Віддалено';
    }

    if (
      REQUEST_STATE.consultationFormat ===
      'onsite'
    ) {
      return 'З виїздом на об’єкт';
    }

    return '';
  }


  function servicePriceText() {
    const format =
      REQUEST_STATE.consultationFormat;

    if (
      REQUEST_STATE.type ===
      'consultation'
    ) {
      return format === 'remote'
        ? 'Віддалена консультація — 1 000 грн'
        : 'Консультація з виїздом — 2 000 грн / година';
    }

    if (
      REQUEST_STATE.type ===
      'estimate'
    ) {
      if (
        format === 'remote'
      ) {
        return 'Прорахунок — 1 000 грн + віддалена консультація — 1 000 грн. Разом: 2 000 грн';
      }

      if (
        format === 'onsite'
      ) {
        return 'Прорахунок — 1 000 грн + консультація з виїздом — 2 000 грн / година';
      }

      return 'Прорахунок вартості робіт — 1 000 грн';
    }

    if (
      format === 'remote'
    ) {
      return 'Віддалена консультація — 1 000 грн';
    }

    if (
      format === 'onsite'
    ) {
      return 'Консультація з виїздом — 2 000 грн / година';
    }

    return '';
  }


  function consultationDetails() {
    const format =
      consultationFormatLabel();

    if (!format) return '';

    return REQUEST_STATE.consultationDate
      ? `${format} · ${REQUEST_STATE.consultationDate}`
      : format;
  }


  function finishChat() {
    chatStep = 6;

    updateProgress();

    chatBot(
      requestText(
        'Готово. Перевірте дані заявки перед відправленням.',
        'Перевірте дані заявки перед передачею.'
      )
    );

    const body =
      $('chatBody');

    if (!body) return;

    const summary =
      document.createElement('div');

    const title =
      document.createElement('div');

    summary.className =
      'chat-summary';

    title.className =
      'chat-summary-title';

    title.textContent =
      requestText('Ваша заявка', 'Передача заявки');

    summary.appendChild(
      title
    );


    const row = (
      label,
      value
    ) => {
      const item =
        document.createElement('div');

      const labelEl =
        document.createElement('div');

      const valueEl =
        document.createElement('div');

      item.className =
        'chat-summary-row';

      labelEl.className =
        'chat-summary-label';

      valueEl.className =
        'chat-summary-value';

      labelEl.textContent =
        label;

      valueEl.textContent =
        value || '—';

      item.append(
        labelEl,
        valueEl
      );

      summary.appendChild(
        item
      );
    };


    row(
      MASTER_TRANSFER_MODE ? 'Робота' : 'Тип',
      REQUEST_STATE.typeLabel
    );

    if (MASTER_TRANSFER_MODE && REQUEST_STATE.workDescription) {
      row('Опис', REQUEST_STATE.workDescription);
    }

    row(
      MASTER_TRANSFER_MODE ? 'Замовник' : "Ім’я",
      REQUEST_STATE.name
    );

    row(
      'Телефон',
      REQUEST_STATE.phone
    );


    if (
      REQUEST_STATE.location
    ) {
      row(
        'Об’єкт',
        REQUEST_STATE.location
      );
    }


    if (
      consultationDetails()
    ) {
      row(
        'Консультація',
        consultationDetails()
      );
    }


    if (REQUEST_STATE.project) {
      row('Дизайн-проєкт', REQUEST_STATE.project);
    }

    if (MASTER_TRANSFER_MODE && REQUEST_STATE.projectFile) {
      row('Файл проєкту', REQUEST_STATE.projectFile.name);
    }

    if (MASTER_TRANSFER_MODE && REQUEST_STATE.photoFile) {
      row('Фото об’єкта', REQUEST_STATE.photoFile.name);
    }


    if (
      REQUEST_STATE.timing
    ) {
      row(
        MASTER_TRANSFER_MODE ? 'Коли' : 'Початок',
        REQUEST_STATE.timing
      );
    }


    REQUEST_STATE.servicePrice =
      MASTER_TRANSFER_MODE ? '' : servicePriceText();


    if (
      REQUEST_STATE.servicePrice
    ) {
      const note =
        document.createElement('div');

      note.className =
        'chat-note';

      note.textContent =
        `Вартість послуги: ${REQUEST_STATE.servicePrice}`;

      summary.appendChild(
        note
      );
    }


    const notesWrap =
      document.createElement('div');

    const notesInput =
      document.createElement('input');

    notesWrap.className =
      'chat-notes-wrap';

    notesInput.className =
      'chat-notes-input';

    notesInput.type =
      'text';

    notesInput.placeholder =
      '📝 Примітка (необов’язково)';

    notesInput.maxLength =
      500;

    notesInput.addEventListener(
      'input',
      () => {
        REQUEST_STATE.notes =
          notesInput.value.trim();
      }
    );

    notesWrap.appendChild(
      notesInput
    );

    summary.appendChild(
      notesWrap
    );


    const buttons =
      document.createElement('div');

    const edit =
      document.createElement('button');

    const submit =
      document.createElement('button');

    buttons.className =
      'chat-final-buttons';

    edit.type =
      'button';

    submit.type =
      'button';

    edit.className =
      'chat-final-btn edit';

    submit.className =
      'chat-final-btn submit';

    edit.textContent =
      MASTER_TRANSFER_MODE ? '← Змінити' : 'Змінити';

    submit.textContent =
      MASTER_TRANSFER_MODE ? '🤝 Передати заявку' : 'Надіслати';


    edit.addEventListener(
      'click',
      openRequest
    );

    submit.addEventListener(
      'click',
      () =>
        sendRequest(
          submit
        )
    );


    buttons.append(
      edit,
      submit
    );

    summary.appendChild(
      buttons
    );

    appendBackControl(
      summary
    );

    body.appendChild(
      summary
    );

    chatScroll();
  }


  /* =========================================================
   * API
   * ========================================================= */

  async function requestJson(
    url,
    options,
    timeoutMs = 15000
  ) {
    const controller =
      new AbortController();

    const timeout =
      setTimeout(
        () =>
          controller.abort(),
        timeoutMs
      );

    try {
      const response =
        await fetch(
          url,
          {
            ...options,
            signal:
              controller.signal
          }
        );

      const data =
        await response
          .json()
          .catch(
            () => ({})
          );

      if (
        !response.ok ||
        !data.ok
      ) {
        throw new Error(
          data.error ||
          'Помилка сервера'
        );
      }

      return data;

    } finally {
      clearTimeout(
        timeout
      );
    }
  }


  async function uploadRequestFile(file, kind) {
    const form = new FormData();
    form.append('file', file);
    form.append('kind', kind);

    return requestJson(
      `${WORKER_URL}/request/${encodeURIComponent(REQUEST_STATE.requestCode)}/project?token=${encodeURIComponent(REQUEST_STATE.uploadToken)}`,
      { method: 'POST', body: form },
      45000
    );
  }


  async function sendRequest(
    button
  ) {
    if (button.disabled) {
      return;
    }

    button.disabled =
      true;

    try {

      /*
       * Referral читаємо безпосередньо перед
       * створенням заявки.
       */
      const referralToken =
        getReferralToken();


      if (
        !REQUEST_STATE.requestCode
      ) {
        button.textContent =
          'Надсилаємо…';


        const notes = [
          MASTER_TRANSFER_MODE && REQUEST_STATE.workDescription
            ? `Опис роботи: ${REQUEST_STATE.workDescription}`
            : '',
          REQUEST_STATE.servicePrice
            ? `Вартість послуги: ${REQUEST_STATE.servicePrice}`
            : '',
          REQUEST_STATE.notes
        ]
          .filter(Boolean)
          .join('\n');


        const payload = {
          name:
            REQUEST_STATE.name,

          phone:
            REQUEST_STATE.phone,

          type:
            REQUEST_STATE.type,

          typeLabel:
            REQUEST_STATE.typeLabel,

          location:
            REQUEST_STATE.location,

          timing:
            REQUEST_STATE.timing,

          consultationDate:
            consultationDetails(),

          project:
            REQUEST_STATE.project,

          notes,

          source:
            MASTER_TRANSFER_MODE
              ? 'SA-MASTER Jobs'
              : 'SA-MASTER.PRO'
        };


        /*
         * Якщо користувач прийшов
         * за персональним посиланням майстра —
         * передаємо тільки referral token.
         *
         * source_master_id тут НЕ передаємо.
         * Його визначає Worker після перевірки D1.
         */
        if (referralToken) {
          payload.ref =
            referralToken;
        }


        const result =
          await requestJson(
            `${WORKER_URL}/`,
            {
              method: 'POST',

              headers: {
                'Content-Type':
                  'application/json'
              },

              body:
                JSON.stringify(
                  payload
                )
            }
          );


        REQUEST_STATE.requestCode =
          result.request.request_code;

        REQUEST_STATE.uploadToken =
          result.request.upload_token;
      }


      if (REQUEST_STATE.projectFile && !REQUEST_STATE.fileUploaded) {
        button.textContent = 'Завантажуємо проєкт…';
        await uploadRequestFile(REQUEST_STATE.projectFile, 'project');
        REQUEST_STATE.fileUploaded = true;
      }

      if (MASTER_TRANSFER_MODE && REQUEST_STATE.photoFile && !REQUEST_STATE.photoUploaded) {
        button.textContent = 'Завантажуємо фото…';
        await uploadRequestFile(REQUEST_STATE.photoFile, 'photo');
        REQUEST_STATE.photoUploaded = true;
      }


      button.textContent =
        '✓ Надіслано';


      chatBot(
        requestText(
          'Заявку отримано. Дякую! Я зв’яжусь з вами після ознайомлення з інформацією.',
          'Заявку передано в SA-MASTER Jobs.'
        )
      );


      setTimeout(
        closeRequest,
        1800
      );

    } catch (error) {

      console.error(
        'REQUEST ERROR:',
        error
      );


      button.disabled =
        false;


      button.textContent =
        REQUEST_STATE.requestCode
          ? 'Повторити завантаження'
          : 'Повторити';


      chatBot(
        REQUEST_STATE.requestCode
          ? 'Заявку вже отримано, але файл не завантажився. Спробуйте ще раз.'
          : 'Не вдалося відправити заявку. Спробуйте ще раз або зателефонуйте за номером +38 (097) 911-18-71.'
      );
    }
  }


  /* =========================================================
   * КАЛЬКУЛЯТОР
   * ========================================================= */

  const calcState = {
    bathrooms: 1,
    system: 'tee'
  };

  const CALC_PRICES = {
    '1-tee': 160000,
    '1-radial': 240000,
    '2-tee': 340000,
    '2-radial': 420000
  };

  function updateCalc() {
    const el =
      $('calcPrice');

    if (!el) return;

    el.textContent =
      (
        CALC_PRICES[
          `${calcState.bathrooms}-${calcState.system}`
        ] ||
        160000
      ).toLocaleString(
        'uk-UA'
      ) +
      ' грн';
  }


  /* =========================================================
   * СОЦСЛАЙДЕР
   * ========================================================= */

  let socialPage = 0;

  function setSocialPage(
    page
  ) {
    socialPage =
      Math.max(
        0,
        Math.min(
          1,
          page
        )
      );

    const track =
      $('socialTrack');

    if (track) {
      track.style.transform =
        `translate3d(-${socialPage * 50}%, 0, 0)`;
    }

    document
      .querySelectorAll('.ispd')
      .forEach(
        (dot, index) => {
          dot.classList.toggle(
            'act',
            index === socialPage
          );
        }
      );
  }


  function bindSocialSwipe() {
    const viewport =
      $('socialViewport');

    if (!viewport) return;

    let startX = 0;
    let active = false;

    viewport.addEventListener(
      'touchstart',
      (event) => {
        startX =
          event.touches[0]
            .clientX;

        active = true;
      },
      { passive: true }
    );

    viewport.addEventListener(
      'touchend',
      (event) => {
        if (!active) return;

        active = false;

        const dx =
          event.changedTouches[0]
            .clientX -
          startX;

        if (
          Math.abs(dx) >= 45
        ) {
          setSocialPage(
            dx < 0
              ? socialPage + 1
              : socialPage - 1
          );
        }
      },
      { passive: true }
    );
  }


  /* =========================================================
   * ГЛОБАЛЬНІ ОБРОБНИКИ
   * ========================================================= */

  function bindGlobal() {

    document.addEventListener(
      'click',
      (event) => {

        const close =
          event.target.closest(
            '.mc'
          );

        if (close) {
          event.preventDefault();

          closeModal(
            close.getAttribute(
              'data-close'
            )
          );

          return;
        }


        const open =
          event.target.closest(
            '[data-open]'
          );

        if (open) {
          event.preventDefault();

          openModal(
            open.getAttribute(
              'data-open'
            )
          );

          return;
        }


        const section =
          event.target.closest(
            '.wc'
          );

        if (section) {
          openModal(
            section.getAttribute(
              'data-modal'
            )
          );

          return;
        }


        const nav =
          event.target.closest(
            '.mna'
          );

        if (nav) {
          event.preventDefault();

          goModal(
            currentModal +
            (
              nav.getAttribute(
                'data-direction'
              ) === 'next'
                ? 1
                : -1
            )
          );

          return;
        }


        if (
          event.target.closest(
            '#calcPayBtn'
          )
        ) {
          event.preventDefault();

          openModal(
            'modalPayment'
          );
        }
      }
    );


    document.addEventListener(
      'keydown',
      (event) => {

        if (
          event.key !==
          'Escape'
        ) {
          return;
        }

        const lightbox =
          $('lightbox');

        const payment =
          $('modalPayment');

        const carousel =
          $('modalCarousel');

        const request =
          $('requestModal');


        if (
          lightbox &&
          lightbox.classList.contains(
            'act'
          )
        ) {
          return closeLightbox();
        }


        if (
          payment &&
          payment.classList.contains(
            'act'
          )
        ) {
          return closeModal(
            'modalPayment'
          );
        }


        if (
          carousel &&
          carousel.classList.contains(
            'act'
          )
        ) {
          return closeModal(
            'modalAbout'
          );
        }


        if (
          request &&
          request.classList.contains(
            'act'
          )
        ) {
          closeRequest();
        }
      }
    );
  }


  function applyTheme() {
    document.body.classList.toggle(
      'dark',
      window
        .matchMedia(
          '(prefers-color-scheme: dark)'
        )
        .matches
    );
  }


  function bindLightbox() {
    const lightbox =
      $('lightbox');

    const close =
      $('lightboxClose');

    const prev =
      $('lightboxPrev');

    const next =
      $('lightboxNext');


    if (close) {
      close.addEventListener(
        'click',
        closeLightbox
      );
    }


    if (prev) {
      prev.addEventListener(
        'click',
        () => {
          lightboxIndex =
            (
              lightboxIndex -
              1 +
              GALLERY_SIZE
            ) %
            GALLERY_SIZE;

          updateLightbox();
        }
      );
    }


    if (next) {
      next.addEventListener(
        'click',
        () => {
          lightboxIndex =
            (
              lightboxIndex +
              1
            ) %
            GALLERY_SIZE;

          updateLightbox();
        }
      );
    }


    if (lightbox) {
      lightbox.addEventListener(
        'click',
        (event) => {
          if (
            event.target ===
            lightbox
          ) {
            closeLightbox();
          }
        }
      );
    }
  }


  /* =========================================================
   * ІНІЦІАЛІЗАЦІЯ
   * ========================================================= */

  function init() {

    /*
     * ВАЖЛИВО:
     * referral фіксуємо одразу після відкриття сайту.
     */
    captureReferralFromUrl();

    if (MASTER_TRANSFER_MODE) {
      setTimeout(openRequest, 0);
    }


    const media =
      window.matchMedia(
        '(prefers-color-scheme: dark)'
      );

    applyTheme();

    if (
      media.addEventListener
    ) {
      media.addEventListener(
        'change',
        applyTheme
      );
    }


    const launch =
      $('requestLaunch');

    const requestClose =
      $('requestClose');

    const requestModal =
      $('requestModal');


    if (launch) {
      launch.addEventListener(
        'click',
        openRequest
      );
    }


    if (requestClose) {
      requestClose.addEventListener(
        'click',
        closeRequest
      );
    }


    if (requestModal) {
      requestModal.addEventListener(
        'click',
        (event) => {
          if (
            event.target ===
            requestModal
          ) {
            closeRequest();
          }
        }
      );
    }


    galleryDots.forEach(
      (dot, index) => {
        dot.addEventListener(
          'click',
          () => {
            currentSlide =
              index;

            updateGallery();

            startAutoplay();
          }
        );
      }
    );


    document
      .querySelectorAll(
        '.gs img'
      )
      .forEach(
        (image, index) => {
          if (
            index <
            GALLERY_SIZE
          ) {
            image.addEventListener(
              'click',
              () =>
                openLightbox(
                  index
                )
            );
          }
        }
      );


    if (galleryWindow) {
      galleryWindow.addEventListener(
        'mouseenter',
        stopAutoplay
      );

      galleryWindow.addEventListener(
        'mouseleave',
        startAutoplay
      );
    }


    bindGallerySwipe();

    bindLightbox();

    updateGallery(false);

    startAutoplay();

    bindSocialSwipe();


    setTimeout(
      () => {
        const track =
          $('socialTrack');

        if (track) {
          track.classList.add(
            'hint'
          );

          setTimeout(
            () =>
              track.classList.remove(
                'hint'
              ),
            1100
          );
        }
      },
      900
    );


    document
      .querySelectorAll(
        '.calc-b'
      )
      .forEach(
        (button) =>
          button.addEventListener(
            'click',
            () => {
              const group =
                button.getAttribute(
                  'data-group'
                );

              const value =
                button.getAttribute(
                  'data-value'
                );


              if (
                group ===
                'bathrooms'
              ) {
                calcState.bathrooms =
                  Number(value);
              }


              if (
                group ===
                'system'
              ) {
                calcState.system =
                  value;
              }


              document
                .querySelectorAll(
                  `.calc-b[data-group="${group}"]`
                )
                .forEach(
                  (item) =>
                    item.classList.remove(
                      'act'
                    )
                );


              button.classList.add(
                'act'
              );


              updateCalc();
            }
          )
      );


    updateCalc();


    const year =
      $('currentYear');

    if (year) {
      year.textContent =
        new Date()
          .getFullYear();
    }


    bindGlobal();
  }


  if (
    document.readyState ===
    'loading'
  ) {
    document.addEventListener(
      'DOMContentLoaded',
      init
    );
  } else {
    init();
  }

})();
