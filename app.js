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

  const WORKER_URL = 'https://sa-master-worker.c6hht469s9.workers.dev';

  const makeRequestState = () => ({
    type:'', typeLabel:'', requestGoal:'', workScope:'', objectType:'',
    estimateType:'', name:'', phone:'', location:'', address:'', timing:'',
    project:'', consultationDate:'', consultationFormat:'', servicePrice:'',
    notes:'', workDescription:'', requestDetails:{},
    projectFile:null, photoFile:null,
    requestCode:'', uploadToken:'', fileUploaded:false, photoUploaded:false
  });

  const REQUEST_STATE = makeRequestState();

  const TYPE_LABELS = {
    complex:'Комплексний монтаж',
    local:'Локальний монтаж',
    consultation:'Консультація',
    estimate:'Розрахунок вартості',
    plumbing:'🔧 Монтаж сантехніки',
    repair:'🚿 Ремонт або заміна',
    emergency:'🚨 Аварійний виклик',
    other_job:'📋 Інше'
  };

  const OBJECT_LABELS = {
    apartment:'Квартира',
    house:'Будинок',
    other:'Інший об’єкт'
  };

  let chatStep = 0;
  let chatHistory = [];
  const CHAT_TOTAL_STEPS = 10;

  function setStep(n){
    chatStep = n;
    updateProgress();
  }

  function setDetail(key,value){
    REQUEST_STATE.requestDetails[key] = value;
  }

  function cloneRequestState(){
    return {
      ...REQUEST_STATE,
      requestDetails:{...(REQUEST_STATE.requestDetails || {})}
    };
  }

  function saveBack(renderQuestion){
    chatHistory.push({
      state:cloneRequestState(),
      renderQuestion,
      chatStep
    });
  }

  function appendBackControl(parent){
    if(!parent || chatHistory.length === 0) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'chat-back';
    button.textContent = '← Назад';
    button.addEventListener('click',goBackInChat);
    parent.appendChild(button);
  }

  function goBackInChat(){
    const previous = chatHistory.pop();
    if(!previous) return;

    Object.keys(REQUEST_STATE).forEach((key)=>{
      REQUEST_STATE[key] = key === 'requestDetails'
        ? {...(previous.state[key] || {})}
        : previous.state[key];
    });

    const body = $('chatBody');
    if(body) body.innerHTML = '';

    chatStep = previous.chatStep;
    previous.renderQuestion();
  }

  function chatScroll(){
    const body = $('chatBody');
    if(body) setTimeout(()=>{ body.scrollTop = body.scrollHeight; },50);
  }

  function chatMsg(text,who){
    const body = $('chatBody');
    if(!body) return;
    const row = document.createElement('div');
    const bubble = document.createElement('div');
    row.className = `chat-message ${who}`;
    bubble.className = 'chat-bubble';
    bubble.textContent = text;
    row.appendChild(bubble);
    body.appendChild(row);
    chatScroll();
  }

  const chatBot = (text)=>chatMsg(text,'bot');
  const chatUser = (text)=>chatMsg(text,'user');

  function updateProgress(){
    const bar = $('chatProgressBar');
    if(!bar) return;
    bar.style.width = Math.max(5,Math.min(100,((chatStep+1)/CHAT_TOTAL_STEPS)*100))+'%';
  }

  function addOptions(options,onChoose){
    const body = $('chatBody');
    if(!body) return;

    const wrap = document.createElement('div');
    wrap.className = 'chat-options';

    options.forEach(({value,label})=>{
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'chat-option';
      button.textContent = label;
      button.addEventListener('click',(event)=>{
        event.preventDefault();
        event.stopPropagation();
        wrap.remove();
        onChoose(value,label);
      },{once:true});
      wrap.appendChild(button);
    });

    appendBackControl(wrap);
    body.appendChild(wrap);
    chatScroll();
  }

  function addInput(placeholder,type,onDone,validate){
    const body = $('chatBody');
    if(!body) return;

    const section = document.createElement('div');
    const wrap = document.createElement('div');
    const input = document.createElement('input');
    const send = document.createElement('button');

    section.className = 'chat-input-section';
    wrap.className = 'chat-input-wrap';
    input.className = 'chat-input';
    input.type = type || 'text';
    input.placeholder = placeholder;
    input.autocomplete = type === 'tel' ? 'tel' : 'off';
    input.setAttribute('aria-label',placeholder);

    if(type === 'number'){
      input.inputMode = 'numeric';
      input.min = '1';
    }

    if(type === 'tel'){
      input.inputMode = 'text';
      input.setAttribute('autocorrect','off');
      input.setAttribute('autocapitalize','off');
      input.setAttribute('spellcheck','false');
      input.addEventListener('blur',()=>{
        const value = normalizeUAPhone(input.value);
        if(value) input.value = value;
      });
    }

    send.type = 'button';
    send.className = 'chat-send';
    send.setAttribute('aria-label','Надіслати');
    send.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M22 2 11 13"/><path d="m22 2-7 20-4-9-9-4z"/></svg>';

    const submit = ()=>{
      let value = input.value.trim();
      if(!value) return input.focus();

      if(type === 'tel'){
        value = normalizeUAPhone(value);
        if(!value){
          input.setAttribute('aria-invalid','true');
          return input.focus();
        }
      }

      if(validate && !validate(value)){
        input.setAttribute('aria-invalid','true');
        return input.focus();
      }

      section.remove();
      chatUser(value);
      onDone(value);
    };

    send.addEventListener('click',submit);
    input.addEventListener('keydown',(event)=>{
      if(event.key === 'Enter'){
        event.preventDefault();
        submit();
      }
    });

    wrap.append(input,send);
    section.appendChild(wrap);
    appendBackControl(section);
    body.appendChild(section);
    setTimeout(()=>input.focus(),50);
    chatScroll();
  }

  function addFileInput(onDone,options={}){
    const body = $('chatBody');
    if(!body) return;

    const wrap = document.createElement('div');
    const title = document.createElement('div');
    const hint = document.createElement('div');
    const actions = document.createElement('div');
    const input = document.createElement('input');
    const pick = document.createElement('button');
    const skip = document.createElement('button');

    wrap.className = 'chat-file-wrap';
    title.className = 'chat-file-title';
    hint.className = 'chat-file-hint';
    actions.className = 'chat-file-actions';

    title.textContent = options.title || 'Прикріпіть файл';
    hint.textContent = options.hint || 'PDF, фото або документ. Максимальний розмір — 25 МБ.';

    input.type = 'file';
    input.hidden = true;
    input.style.display = 'none';
    input.accept = options.accept || '.pdf,.jpg,.jpeg,.png,.webp,.heic,.doc,.docx,.xls,.xlsx,.zip,.txt';

    pick.type = 'button';
    pick.className = 'chat-file-pick chat-option';
    pick.textContent = options.pickLabel || '📎 Додати файл';

    skip.type = 'button';
    skip.className = 'chat-file-skip';
    skip.textContent = options.skipLabel || 'Пропустити';

    wrap.style.display='grid';
    wrap.style.gap='10px';
    wrap.style.padding='16px';
    wrap.style.borderRadius='18px';
    wrap.style.background='rgba(255,255,255,.055)';
    title.style.fontWeight='700';
    title.style.fontSize='18px';
    hint.style.opacity='.68';
    hint.style.fontSize='14px';
    hint.style.lineHeight='1.35';
    actions.style.display='grid';
    actions.style.gridTemplateColumns='1fr 1fr';
    actions.style.gap='10px';
    pick.style.gridColumn='1 / -1';
    pick.style.width='100%';
    pick.style.margin='0';
    skip.style.minHeight='44px';
    skip.style.border='0';
    skip.style.borderRadius='12px';
    skip.style.background='rgba(255,255,255,.08)';
    skip.style.color='inherit';
    skip.style.font='inherit';

    pick.addEventListener('click',()=>input.click());

    input.addEventListener('change',()=>{
      const file = input.files && input.files[0];
      if(!file) return;
      if(file.size > 25*1024*1024){
        chatBot('Файл завеликий. Оберіть файл до 25 МБ.');
        input.value='';
        return;
      }
      wrap.remove();
      onDone(file);
    });

    skip.addEventListener('click',()=>{
      wrap.remove();
      onDone(null);
    });

    actions.append(pick,skip);
    wrap.append(title,hint,input,actions);
    appendBackControl(wrap);
    body.appendChild(wrap);
    chatScroll();
  }

  function resetChat(){
    const body = $('chatBody');
    if(body) body.innerHTML='';

    const fresh = makeRequestState();
    Object.keys(REQUEST_STATE).forEach((key)=>{
      REQUEST_STATE[key] = fresh[key];
    });

    chatStep=0;
    chatHistory=[];
    updateProgress();
  }

  function openRequest(){
    const modal = $('requestModal');
    if(!modal) return;
    resetChat();
    document.body.classList.add('chat-open');
    modal.classList.add('act');
    modal.setAttribute('aria-hidden','false');
    lock();
    askType();
  }

  function closeRequest(){
    const modal = $('requestModal');
    if(modal){
      modal.classList.remove('act');
      modal.setAttribute('aria-hidden','true');
    }
    document.body.classList.remove('chat-open');
    unlock();
  }

  /* MASTER TRANSFER — логіка збережена */
  function askType(){
    setStep(0);

    if(MASTER_TRANSFER_MODE){
      chatBot('Передайте заявку від замовника. Це займе менше хвилини.');
      chatBot('Що потрібно зробити?');
      addOptions([
        {value:'plumbing',label:'🔧 Монтаж сантехніки'},
        {value:'repair',label:'🚿 Ремонт або заміна'},
        {value:'emergency',label:'🚨 Аварійний виклик'},
        {value:'other_job',label:'📋 Інше'}
      ],afterType);
      return;
    }

    chatBot('Вітаю. Поставлю кілька запитань, щоб правильно сформувати заявку.');
    chatBot('Що вам потрібно?');
    addOptions([
      {value:'work',label:'Виконати роботи'},
      {value:'consultation',label:'Проконсультувати'},
      {value:'estimate',label:'Дізнатись вартість'}
    ],afterClientGoal);
  }

  function afterType(value){
    saveBack(askType);
    REQUEST_STATE.type=value;
    REQUEST_STATE.typeLabel=TYPE_LABELS[value] || value;
    chatUser(REQUEST_STATE.typeLabel);
    askMasterLocation();
  }

  function askMasterLocation(){
    setStep(1);
    chatBot('Де об’єкт?');
    addInput('ЖК / район / адреса','text',(value)=>{
      saveBack(askMasterLocation);
      REQUEST_STATE.location=value;
      askMasterDescription();
    });
  }

  function askMasterDescription(){
    setStep(2);
    chatBot('Коротко опишіть, що потрібно зробити.');
    addInput('Наприклад: замінити бойлер 80 л','text',(value)=>{
      saveBack(askMasterDescription);
      REQUEST_STATE.workDescription=value;
      askMasterProject();
    });
  }

  function askMasterProject(){
    setStep(3);
    chatBot('Чи є у замовника дизайн-проєкт?');
    addOptions([
      {value:'Є',label:'✅ Є'},
      {value:'Немає',label:'❌ Немає'},
      {value:'Не знаю',label:'❓ Не знаю'}
    ],(value,label)=>{
      saveBack(askMasterProject);
      REQUEST_STATE.project=value;
      chatUser(label);
      if(value==='Є') askMasterProjectFile();
      else{
        REQUEST_STATE.projectFile=null;
        askMasterTiming();
      }
    });
  }

  function askMasterProjectFile(){
    setStep(3);
    addFileInput((file)=>{
      saveBack(askMasterProjectFile);
      REQUEST_STATE.projectFile=file || null;
      chatUser(file ? `Проєкт: ${file.name}` : 'Проєкт без файлу');
      askMasterTiming();
    },{
      title:'📐 Файл дизайн-проєкту',
      hint:'Необов’язково · PDF, фото або документ · до 25 МБ.',
      accept:'image/*,.heic,.heif,.pdf,.doc,.docx,.xls,.xlsx,.zip,.txt',
      pickLabel:'📎 Додати проєкт',
      skipLabel:'Без файлу'
    });
  }

  function askMasterTiming(){
    setStep(4);
    chatBot('Коли потрібно виконати роботу?');
    addOptions([
      {value:'Сьогодні',label:'🔥 Сьогодні'},
      {value:'Завтра',label:'Завтра'},
      {value:'Найближчими днями',label:'Найближчими днями'},
      {value:'Дата не визначена',label:'Дата не визначена'}
    ],(value,label)=>{
      saveBack(askMasterTiming);
      REQUEST_STATE.timing=value;
      chatUser(label);
      askMasterName();
    });
  }

  function askMasterName(){
    setStep(5);
    chatBot('Як звати замовника?');
    addInput('Ім’я замовника','text',(value)=>{
      saveBack(askMasterName);
      REQUEST_STATE.name=value;
      askMasterPhone();
    });
  }

  function askMasterPhone(){
    setStep(6);
    chatBot('Вкажіть номер телефону замовника.');
    addInput('Наприклад: 0979111871','tel',(value)=>{
      saveBack(askMasterPhone);
      REQUEST_STATE.phone=value;
      askMasterPhoto();
    },(value)=>{
      const digits=String(value||'').replace(/\D/g,'');
      return digits.length>=9 && digits.length<=13;
    });
  }

  function askMasterPhoto(){
    setStep(7);
    addFileInput((file)=>{
      saveBack(askMasterPhoto);
      REQUEST_STATE.photoFile=file || null;
      chatUser(file ? `Фото: ${file.name}` : 'Без фото');
      finishChat();
    },{
      title:'📷 Фото об’єкта',
      hint:'Необов’язково · фото допоможе майстру швидше оцінити роботу · до 25 МБ.',
      accept:'image/*,.heic,.heif',
      pickLabel:'📷 Додати фото',
      skipLabel:'Пропустити'
    });
  }

  /* CLIENT */
  function afterClientGoal(value,label){
    saveBack(askType);
    REQUEST_STATE.requestGoal=value;
    chatUser(label);

    if(value==='work'){
      askWorkScope();
      return;
    }

    if(value==='consultation'){
      REQUEST_STATE.type='consultation';
      REQUEST_STATE.typeLabel='Консультація';
      askConsultationKind();
      return;
    }

    REQUEST_STATE.type='estimate';
    REQUEST_STATE.typeLabel='Розрахунок вартості';
    askEstimateType();
  }

  function askWorkScope(){
    setStep(1);
    chatBot('Який формат робіт планується?');
    addOptions([
      {value:'complex',label:'Комплексний монтаж'},
      {value:'local',label:'Локальний монтаж'}
    ],(value,label)=>{
      saveBack(askWorkScope);
      REQUEST_STATE.workScope=value;
      REQUEST_STATE.type=value;
      REQUEST_STATE.typeLabel=TYPE_LABELS[value];
      chatUser(label);

      if(value==='local') askLocalDescription();
      else askObjectType(()=>routeComplexObject(false));
    });
  }

  function askObjectType(onDone){
    setStep(2);
    chatBot('Який у вас об’єкт?');
    addOptions([
      {value:'apartment',label:'Квартира'},
      {value:'house',label:'Будинок'},
      {value:'other',label:'Інший об’єкт'}
    ],(value,label)=>{
      saveBack(()=>askObjectType(onDone));
      REQUEST_STATE.objectType=value;
      chatUser(label);

      if(value==='other'){
        chatBot('Уточніть, який саме це об’єкт.');
        addInput('Наприклад: офіс, салон, ресторан','text',(text)=>{
          setDetail('object_other',text);
          onDone();
        });
      }else onDone();
    });
  }

  function routeComplexObject(isEstimate){
    if(REQUEST_STATE.objectType==='house'){
      askHouseArea(()=>askHouseHeating(isEstimate));
      return;
    }
    if(REQUEST_STATE.objectType==='apartment'){
      askApartmentHeating(isEstimate);
      return;
    }
    askGenericComplexDescription(isEstimate);
  }

  function askHouseArea(onDone){
    setStep(3);
    chatBot('Яка площа будинку?');
    addInput('Наприклад: 180','number',(value)=>{
      saveBack(()=>askHouseArea(onDone));
      setDetail('house_area',Number(value));
      onDone();
    },(value)=>Number(value)>0);
  }

  function askApartmentHeating(isEstimate){
    setStep(3);
    chatBot('Що планується з системою опалення?');
    addOptions([
      {value:'unchanged',label:'Залишити без змін'},
      {value:'partial',label:'Частково скоригувати'},
      {value:'replace',label:'Повністю замінити'}
    ],(value,label)=>{
      saveBack(()=>askApartmentHeating(isEstimate));
      setDetail('heating_change',label);
      chatUser(label);

      if(value==='replace'){
        chatBot('Яку систему плануєте?');
        addOptions([
          {value:'radial',label:'Променеву'},
          {value:'tee',label:'Трійникову'},
          {value:'unknown',label:'Ще не визначились'}
        ],(v,l)=>{
          setDetail('heating_system',l);
          chatUser(l);
          askWaterSystem(()=>askApartmentRecirculation(isEstimate));
        });
      }else if(value==='partial'){
        chatBot('Що потрібно змінити?');
        addInput('Наприклад: перенести або замінити радіатори','text',(text)=>{
          setDetail('heating_changes_description',text);
          askWaterSystem(()=>askApartmentRecirculation(isEstimate));
        });
      }else{
        askWaterSystem(()=>askApartmentRecirculation(isEstimate));
      }
    });
  }

  function askWaterSystem(onDone){
    setStep(4);
    chatBot('Яка система водопостачання планується?');
    addOptions([
      {value:'tee',label:'Трійникова'},
      {value:'radial',label:'Променева'},
      {value:'unknown',label:'Ще не визначились'}
    ],(value,label)=>{
      saveBack(()=>askWaterSystem(onDone));
      setDetail('water_system',label);
      chatUser(label);
      onDone();
    });
  }

  function askApartmentRecirculation(isEstimate){
    chatBot('Чи потрібна рециркуляція гарячої води?');
    addOptions([
      {value:'yes',label:'Так'},
      {value:'no',label:'Ні'},
      {value:'unknown',label:'Ще не визначились'}
    ],(value,label)=>{
      setDetail('dhw_recirculation',label);
      chatUser(label);
      askApartmentDhw(isEstimate);
    });
  }

  function askApartmentDhw(isEstimate){
    setStep(5);
    chatBot('Яке джерело гарячої води?');
    addOptions([
      {value:'central',label:'Централізоване ГВП'},
      {value:'autonomous',label:'Автономне ГВП'},
      {value:'unknown',label:'Ще не визначились'}
    ],(value,label)=>{
      saveBack(()=>askApartmentDhw(isEstimate));
      setDetail('dhw_source',label);
      chatUser(label);

      if(value==='autonomous'){
        chatBot('Яке джерело ГВП планується?');
        addOptions([
          {value:'boiler',label:'Бойлер'},
          {value:'other',label:'Інше'},
          {value:'unknown',label:'Ще не визначились'}
        ],(v,l)=>{
          setDetail('dhw_autonomous_source',l);
          chatUser(l);
          askApartmentSewer(isEstimate);
        });
      }else askApartmentSewer(isEstimate);
    });
  }

  function askApartmentSewer(isEstimate){
    setStep(6);
    chatBot('Що планується з центральним каналізаційним стояком?');
    addOptions([
      {value:'unchanged',label:'Залишити без змін'},
      {value:'soundproof',label:'Знешумити'},
      {value:'replace',label:'Замінити'},
      {value:'replace_soundproof',label:'Замінити та знешумити'}
    ],(value,label)=>{
      saveBack(()=>askApartmentSewer(isEstimate));
      setDetail('sewer_riser',label);
      chatUser(label);
      askDesignPlanning(()=>askHiddenCommunications(()=>askComplexDescription(isEstimate)));
    });
  }

  function askDesignPlanning(onDone){
    setStep(7);
    chatBot('Чи є дизайн-проєкт або план із розміщенням меблів і сантехніки?');
    addOptions([
      {value:'design',label:'Є дизайн-проєкт'},
      {value:'plan',label:'Є план розміщення'},
      {value:'development',label:'Ще в розробці'},
      {value:'none',label:'Немає'}
    ],(value,label)=>{
      saveBack(()=>askDesignPlanning(onDone));
      setDetail('design_planning',label);
      REQUEST_STATE.project=label;
      chatUser(label);

      if(value==='design' || value==='plan'){
        addFileInput((file)=>{
          REQUEST_STATE.projectFile=file || null;
          if(file) REQUEST_STATE.project=`${label}, файл додається`;
          chatUser(file ? `Файл: ${file.name}` : 'Без файлу');
          onDone();
        },{
          title:'📐 Додайте проєкт або план',
          hint:'Необов’язково зараз · PDF, фото або документ · до 25 МБ.',
          pickLabel:'📎 Додати файл',
          skipLabel:'Без файлу'
        });
      }else onDone();
    });
  }

  function askHiddenCommunications(onDone){
    setStep(7);
    chatBot('Чи є інформація про приховані комунікації та конструкції?');
    chatBot('Якщо є — додайте виконавчу схему від забудовника та/або фото прихованих комунікацій: опалення, водопостачання, дренажі кондиціонерів, електропроводка. Також корисна інформація про розташування несучих стін і вентиляційних каналів.');
    addOptions([
      {value:'file',label:'📎 Додати файли'},
      {value:'none',label:'Немає'}
    ],(value,label)=>{
      saveBack(()=>askHiddenCommunications(onDone));
      setDetail('hidden_communications',label);
      chatUser(label);

      if(value==='file'){
        addFileInput((file)=>{
          if(file && !REQUEST_STATE.projectFile) REQUEST_STATE.projectFile=file;
          setDetail('hidden_communications_file',file ? file.name : '');
          chatUser(file ? `Файл: ${file.name}` : 'Без файлу');
          onDone();
        },{
          title:'📎 Інформація про приховані комунікації',
          hint:'Схема, фото або документ · до 25 МБ.',
          pickLabel:'📎 Додати файл',
          skipLabel:'Пропустити'
        });
      }else onDone();
    });
  }

  function askHouseHeating(isEstimate){
    setStep(4);
    chatBot('Яка система опалення планується?');
    addOptions([
      {value:'floor',label:'Тепла підлога'},
      {value:'radiators',label:'Радіатори'},
      {value:'combined',label:'Комбінована — тепла підлога + радіатори'},
      {value:'unknown',label:'Ще не визначились'}
    ],(value,label)=>{
      saveBack(()=>askHouseHeating(isEstimate));
      setDetail('heating_system',label);
      chatUser(label);
      askHouseGas(isEstimate);
    });
  }

  function askHouseGas(isEstimate){
    chatBot('Чи є газ на об’єкті?');
    addOptions([
      {value:'yes',label:'Так'},
      {value:'no',label:'Ні'},
      {value:'planned',label:'Планується підключення'}
    ],(value,label)=>{
      setDetail('gas',label);
      setDetail('gas_code',value);
      chatUser(label);
      askHeatSource(isEstimate);
    });
  }

  function askHeatSource(isEstimate){
    setStep(5);
    chatBot('Яке джерело тепла планується?');

    const options=[];
    if(REQUEST_STATE.requestDetails.gas_code!=='no'){
      options.push({value:'gas',label:'Газовий котел'});
    }
    options.push(
      {value:'electric',label:'Електричний котел'},
      {value:'pump',label:'Тепловий насос'},
      {value:'solid',label:'Твердопаливний котел'},
      {value:'combined',label:'Комбінована система'},
      {value:'unknown',label:'Ще не визначились'}
    );

    addOptions(options,(value,label)=>{
      saveBack(()=>askHeatSource(isEstimate));
      setDetail('heat_source',label);
      chatUser(label);
      askHouseWaterSource(isEstimate);
    });
  }

  function askHouseWaterSource(isEstimate){
    chatBot('Яке джерело водопостачання?');
    addOptions([
      {value:'central',label:'Централізоване'},
      {value:'well',label:'Свердловина'},
      {value:'other',label:'Інше'},
      {value:'unknown',label:'Ще не визначились'}
    ],(value,label)=>{
      setDetail('water_source',label);
      chatUser(label);
      askHouseWastewater(isEstimate);
    });
  }

  function askHouseWastewater(isEstimate){
    setStep(6);
    chatBot('Яке водовідведення?');
    addOptions([
      {value:'central',label:'Централізована каналізація'},
      {value:'local',label:'Септик / локальна каналізація'},
      {value:'other',label:'Інше'},
      {value:'unknown',label:'Ще не визначились'}
    ],(value,label)=>{
      saveBack(()=>askHouseWastewater(isEstimate));
      setDetail('wastewater',label);
      chatUser(label);
      askWaterSystem(()=>askHouseRecirculation(isEstimate));
    });
  }

  function askHouseRecirculation(isEstimate){
    chatBot('Чи планується рециркуляція гарячої води?');
    addOptions([
      {value:'yes',label:'Так'},
      {value:'no',label:'Ні'},
      {value:'unknown',label:'Ще не визначились'}
    ],(value,label)=>{
      setDetail('dhw_recirculation',label);
      chatUser(label);
      askHouseDhw(isEstimate);
    });
  }

  function askHouseDhw(isEstimate){
    setStep(7);
    chatBot('Чи визначено, як буде забезпечуватись гаряче водопостачання?');
    addOptions([
      {value:'yes',label:'Так'},
      {value:'recommendation',label:'Ні, потрібна рекомендація'}
    ],(value,label)=>{
      saveBack(()=>askHouseDhw(isEstimate));
      setDetail('dhw_defined',label);
      chatUser(label);

      if(value==='yes'){
        chatBot('Вкажіть запланований варіант:');
        addInput('Наприклад: бойлер непрямого нагріву','text',(text)=>{
          setDetail('dhw_solution',text);
          askWaterTreatment(isEstimate);
        });
      }else askWaterTreatment(isEstimate);
    });
  }

  function askWaterTreatment(isEstimate){
    chatBot('Чи планується система водоочистки?');
    addOptions([
      {value:'yes',label:'Так'},
      {value:'no',label:'Ні'},
      {value:'recommendation',label:'Потрібна рекомендація'}
    ],(value,label)=>{
      setDetail('water_treatment',label);
      chatUser(label);
      askDesignPlanning(()=>askEngineeringProject(()=>askComplexDescription(isEstimate)));
    });
  }

  function askEngineeringProject(onDone){
    setStep(8);
    chatBot('Чи є інженерний проєкт?');
    addOptions([
      {value:'yes',label:'Є'},
      {value:'no',label:'Немає'},
      {value:'development',label:'Ще в розробці'}
    ],(value,label)=>{
      saveBack(()=>askEngineeringProject(onDone));
      setDetail('engineering_project',label);
      chatUser(label);

      if(value==='yes' && !REQUEST_STATE.projectFile){
        addFileInput((file)=>{
          REQUEST_STATE.projectFile=file || null;
          setDetail('engineering_project_file',file ? file.name : '');
          chatUser(file ? `Файл: ${file.name}` : 'Без файлу');
          onDone();
        },{
          title:'📐 Додайте інженерний проєкт',
          hint:'PDF, фото або документ · до 25 МБ.',
          pickLabel:'📎 Додати проєкт',
          skipLabel:'Без файлу'
        });
      }else onDone();
    });
  }

  function askGenericComplexDescription(isEstimate){
    setStep(6);
    chatBot('Опишіть об’єкт та заплановані сантехнічні роботи.');
    addInput('Короткий опис об’єкта та робіт','text',(value)=>{
      setDetail('complex_description',value);
      askComplexDescription(isEstimate);
    });
  }

  function askComplexDescription(isEstimate){
    setStep(8);
    chatBot('Що ще важливо знати про майбутні роботи?');
    chatBot('Опишіть додаткові побажання, особливості об’єкта або роботи, які не були зазначені вище.');
    addInput('Коротко опишіть додаткову інформацію','text',(value)=>{
      saveBack(()=>askComplexDescription(isEstimate));
      setDetail('additional_description',value);
      REQUEST_STATE.workDescription=value;
      askPublicLocation(()=>askExactAddress(()=>askTiming(()=>askContactName())));
    });
  }

  function askLocalDescription(){
    setStep(2);
    chatBot('Що потрібно зробити?');
    chatBot('Опишіть роботи якомога детальніше: що потрібно встановити, замінити, перенести, підключити або відремонтувати. Якщо є проблема — опишіть, у чому вона полягає.');
    addInput('Наприклад: замінити бойлер на 100 л, перенести його приблизно на 50 см та переробити підключення води','text',(value)=>{
      saveBack(askLocalDescription);
      REQUEST_STATE.workDescription=value;
      setDetail('work_description',value);
      askLocalPhoto();
    });
  }

  function askLocalPhoto(){
    setStep(3);
    chatBot('Додайте фото або відео.');
    chatBot('Покажіть зону, де плануються роботи: загальний вигляд та, за можливості, крупним планом наявні підключення, комунікації, обладнання або проблему, яку потрібно усунути.');
    addFileInput((file)=>{
      saveBack(askLocalPhoto);
      REQUEST_STATE.photoFile=file || null;
      setDetail('media_file',file ? file.name : '');
      chatUser(file ? `Файл: ${file.name}` : 'Пропустити');
      askPublicLocation(()=>askExactAddress(()=>askTiming(()=>askContactName())));
    },{
      title:'📷 Фото або відео',
      hint:'Необов’язково · до 25 МБ.',
      accept:'image/*,video/*,.heic,.heif',
      pickLabel:'📎 Додати файл',
      skipLabel:'Пропустити'
    });
  }

  function askPublicLocation(onDone){
    setStep(8);
    chatBot('📍 Де знаходиться об’єкт?');
    addInput('Місто + район / ЖК / котеджне містечко','text',(value)=>{
      saveBack(()=>askPublicLocation(onDone));
      REQUEST_STATE.location=value;
      onDone();
    });
  }

  function askExactAddress(onDone){
    setStep(8);
    chatBot('🏠 Вкажіть точну адресу об’єкта.');
    chatBot('Точна адреса не публікується для всіх майстрів.');
    addInput('Вулиця, будинок, корпус','text',(value)=>{
      saveBack(()=>askExactAddress(onDone));
      REQUEST_STATE.address=value;
      onDone();
    });
  }

  function askTiming(onDone){
    setStep(9);
    chatBot('Коли плануєте розпочати роботи?');
    addOptions([
      {value:'Якнайшвидше',label:'Якнайшвидше'},
      {value:'Протягом місяця',label:'Протягом місяця'},
      {value:'Через 1–3 місяці',label:'Через 1–3 місяці'}
    ],(value,label)=>{
      saveBack(()=>askTiming(onDone));
      REQUEST_STATE.timing=value;
      chatUser(label);
      onDone();
    });
  }

  function askContactName(onDone=askContactPhone){
    setStep(9);
    chatBot('Як з вами зв’язатися?');
    addInput('Ваше ім’я','text',(value)=>{
      saveBack(()=>askContactName(onDone));
      REQUEST_STATE.name=value;
      onDone();
    });
  }

  function askContactPhone(onDone=finishChat){
    setStep(9);
    chatBot('Вкажіть номер телефону.');
    addInput('Наприклад: 0979111871','tel',(value)=>{
      saveBack(()=>askContactPhone(onDone));
      REQUEST_STATE.phone=value;
      onDone();
    },(value)=>{
      const digits=String(value||'').replace(/\D/g,'');
      return digits.length>=9 && digits.length<=13;
    });
  }

  /* CONSULTATION */
  function askConsultationKind(){
    setStep(1);
    chatBot('Яка консультація вам потрібна?');
    addOptions([
      {value:'short_remote',label:'Коротка консультація віддалено'},
      {value:'detailed',label:'Детальна консультація'},
      {value:'onsite',label:'Консультація на об’єкті'}
    ],(value,label)=>{
      saveBack(askConsultationKind);
      REQUEST_STATE.consultationFormat=value;
      setDetail('consultation_type',label);
      chatUser(label);

      if(value==='short_remote') chatBot('Кілька коротких запитань.');
      if(value==='detailed') chatBot('Розбір проєкту, технічних рішень або складного питання.');
      if(value==='onsite') chatBot('Огляд об’єкта та консультація безпосередньо на місці.');

      askConsultationQuestion();
    });
  }

  function askConsultationQuestion(){
    setStep(2);
    chatBot('З якого питання потрібна консультація?');
    chatBot('Коротко опишіть ситуацію та що саме хочете з’ясувати.');
    addInput('Опишіть ваше питання','text',(value)=>{
      saveBack(askConsultationQuestion);
      setDetail('consultation_question',value);
      REQUEST_STATE.workDescription=value;
      askConsultationAttachment();
    });
  }

  function askConsultationAttachment(){
    setStep(3);
    chatBot('Додайте фото, відео або документи, якщо вони допоможуть краще зрозуміти питання.');
    addFileInput((file)=>{
      saveBack(askConsultationAttachment);
      REQUEST_STATE.projectFile=file || null;
      setDetail('consultation_file',file ? file.name : '');
      chatUser(file ? `Файл: ${file.name}` : 'Пропустити');

      if(REQUEST_STATE.consultationFormat==='onsite'){
        askPublicLocation(()=>askExactAddress(()=>askContactName()));
      }else askContactName();
    },{
      title:'📎 Фото, відео або документ',
      hint:'Необов’язково · до 25 МБ.',
      accept:'image/*,video/*,.heic,.heif,.pdf,.doc,.docx,.xls,.xlsx,.zip,.txt',
      pickLabel:'📎 Додати файл',
      skipLabel:'Пропустити'
    });
  }

  /* ESTIMATE */
  function askEstimateType(){
    setStep(1);
    chatBot('Розрахунок вартості робіт');
    chatBot('Допоможемо попередньо розрахувати вартість сантехнічних робіт. Вартість обладнання та матеріалів залежить від обраних технічних рішень і комплектації.');
    chatBot('Який розрахунок вам потрібен?');
    addOptions([
      {value:'approximate',label:'Орієнтовна вартість робіт'},
      {value:'detailed',label:'Детальний прорахунок'}
    ],(value,label)=>{
      saveBack(askEstimateType);
      REQUEST_STATE.estimateType=value;
      chatUser(label);

      if(value==='approximate'){
        chatBot('Безкоштовна орієнтовна оцінка');
        chatBot('На основі наданої інформації ми зорієнтуємо вас щодо приблизної вартості робіт. Це не є детальним кошторисом і може бути уточнено після погодження технічних рішень.');
        askApproximateScope();
      }else{
        chatBot('Детальний прорахунок вартості робіт');
        chatBot('Формується на основі достатньої технічної інформації та погоджених рішень.');
        askDetailedDocumentation();
      }
    });
  }

  function askApproximateScope(){
    setStep(2);
    chatBot('Що потрібно оцінити?');
    addOptions([
      {value:'complex',label:'Комплексний монтаж'},
      {value:'local',label:'Локальні роботи'}
    ],(value,label)=>{
      saveBack(askApproximateScope);
      REQUEST_STATE.workScope=value;
      setDetail('estimate_scope',label);
      chatUser(label);

      if(value==='local') askEstimateLocalDescription();
      else askObjectType(()=>routeComplexObject(true));
    });
  }

  function askEstimateLocalDescription(){
    setStep(3);
    chatBot('Опишіть, які роботи потрібно оцінити.');
    addInput('Що потрібно встановити, замінити, перенести або підключити?','text',(value)=>{
      saveBack(askEstimateLocalDescription);
      REQUEST_STATE.workDescription=value;
      setDetail('work_description',value);
      askLocalPhoto();
    });
  }

  function askDetailedDocumentation(){
    setStep(2);
    chatBot('Чи є готовий проєкт / достатня документація для прорахунку?');
    addOptions([
      {value:'yes',label:'Так, є'},
      {value:'no',label:'Ні / потрібне опрацювання технічних рішень'}
    ],(value,label)=>{
      saveBack(askDetailedDocumentation);
      setDetail('documentation_ready',label);
      chatUser(label);

      if(value==='yes') askDetailedPath();
      else{
        setDetail('detailed_calculation_path','Потрібне попереднє опрацювання технічних рішень');
        chatBot('Для детального прорахунку спочатку потрібно опрацювати технічні рішення. Після цього можна сформувати коректний розрахунок робіт.');
        askDetailedDescription();
      }
    });
  }

  function askDetailedPath(){
    setStep(3);
    chatBot('Як опрацювати наданий проєкт?');
    addOptions([
      {value:'as_is',label:'За наданим проєктом'},
      {value:'review',label:'З попередньою консультацією'}
    ],(value,label)=>{
      saveBack(askDetailedPath);
      setDetail('detailed_calculation_path',label);
      chatUser(label);

      addFileInput((file)=>{
        REQUEST_STATE.projectFile=file || null;
        REQUEST_STATE.project=file ? 'Є, файл додається' : 'Є, надішле пізніше';
        setDetail('project_file',file ? file.name : '');
        chatUser(file ? `Файл: ${file.name}` : 'Надішлю пізніше');
        askDetailedDescription();
      },{
        title:'📐 Додайте проєкт або документацію',
        hint:'PDF, фото або документ · до 25 МБ.',
        pickLabel:'📎 Додати файл',
        skipLabel:'Надішлю пізніше'
      });
    });
  }

  function askDetailedDescription(){
    setStep(4);
    chatBot('Коротко опишіть об’єкт і що потрібно прорахувати.');
    addInput('Додаткова інформація для прорахунку','text',(value)=>{
      saveBack(askDetailedDescription);
      REQUEST_STATE.workDescription=value;
      setDetail('calculation_description',value);
      askPublicLocation(()=>askContactName());
    });
  }

  function consultationDetails(){
    const labels={
      short_remote:'Коротка консультація віддалено',
      detailed:'Детальна консультація',
      onsite:'Консультація на об’єкті'
    };
    return labels[REQUEST_STATE.consultationFormat] || '';
  }

  function finishChat(){
    setStep(10);
    chatBot(requestText(
      'Готово. Перевірте дані заявки перед відправленням.',
      'Перевірте дані заявки перед передачею.'
    ));

    const body=$('chatBody');
    if(!body) return;

    const summary=document.createElement('div');
    const title=document.createElement('div');
    summary.className='chat-summary';
    title.className='chat-summary-title';
    title.textContent=requestText('Ваша заявка','Передача заявки');
    summary.appendChild(title);

    const row=(label,value)=>{
      if(!value) return;
      const item=document.createElement('div');
      const labelEl=document.createElement('div');
      const valueEl=document.createElement('div');
      item.className='chat-summary-row';
      labelEl.className='chat-summary-label';
      valueEl.className='chat-summary-value';
      labelEl.textContent=label;
      valueEl.textContent=value;
      item.append(labelEl,valueEl);
      summary.appendChild(item);
    };

    row(MASTER_TRANSFER_MODE ? 'Робота' : 'Заявка',REQUEST_STATE.typeLabel);

    if(!MASTER_TRANSFER_MODE){
      row('Мета',{
        work:'Виконати роботи',
        consultation:'Проконсультувати',
        estimate:'Дізнатись вартість'
      }[REQUEST_STATE.requestGoal]);

      row('Формат робіт',{
        complex:'Комплексний монтаж',
        local:'Локальний монтаж'
      }[REQUEST_STATE.workScope]);

      row('Об’єкт',OBJECT_LABELS[REQUEST_STATE.objectType]);
      row('Тип розрахунку',{
        approximate:'Орієнтовна вартість робіт',
        detailed:'Детальний прорахунок'
      }[REQUEST_STATE.estimateType]);
    }

    row('Опис',REQUEST_STATE.workDescription);
    row('Консультація',consultationDetails());
    row('Документація',REQUEST_STATE.project);
    row('Файл',REQUEST_STATE.projectFile && REQUEST_STATE.projectFile.name);
    row('Фото / відео',REQUEST_STATE.photoFile && REQUEST_STATE.photoFile.name);
    row('Локація',REQUEST_STATE.location);
    row('Точна адреса',REQUEST_STATE.address);
    row('Початок',REQUEST_STATE.timing);
    row(MASTER_TRANSFER_MODE ? 'Замовник' : 'Ім’я',REQUEST_STATE.name);
    row('Телефон',REQUEST_STATE.phone);

    const notesWrap=document.createElement('div');
    const notesInput=document.createElement('input');
    notesWrap.className='chat-notes-wrap';
    notesInput.className='chat-notes-input';
    notesInput.type='text';
    notesInput.placeholder='📝 Примітка (необов’язково)';
    notesInput.maxLength=500;
    notesInput.value=REQUEST_STATE.notes || '';
    notesInput.addEventListener('input',()=>{
      REQUEST_STATE.notes=notesInput.value.trim();
    });
    notesWrap.appendChild(notesInput);
    summary.appendChild(notesWrap);

    const buttons=document.createElement('div');
    const edit=document.createElement('button');
    const submit=document.createElement('button');
    buttons.className='chat-final-buttons';
    edit.type='button';
    submit.type='button';
    edit.className='chat-final-btn edit';
    submit.className='chat-final-btn submit';
    edit.textContent=MASTER_TRANSFER_MODE ? '← Змінити' : 'Змінити';
    submit.textContent=MASTER_TRANSFER_MODE ? '🤝 Передати заявку' : 'Надіслати';

    edit.addEventListener('click',openRequest);
    submit.addEventListener('click',()=>sendRequest(submit));

    buttons.append(edit,submit);
    summary.appendChild(buttons);
    appendBackControl(summary);
    body.appendChild(summary);
    chatScroll();
  }

  /* API */
  async function requestJson(url,options,timeoutMs=15000){
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),timeoutMs);

    try{
      const response=await fetch(url,{...options,signal:controller.signal});
      const data=await response.json().catch(()=>({}));
      if(!response.ok || !data.ok) throw new Error(data.error || 'Помилка сервера');
      return data;
    }finally{
      clearTimeout(timeout);
    }
  }

  async function uploadRequestFile(file,kind){
    const form=new FormData();
    form.append('file',file);
    form.append('kind',kind);

    return requestJson(
      `${WORKER_URL}/request/${encodeURIComponent(REQUEST_STATE.requestCode)}/project?token=${encodeURIComponent(REQUEST_STATE.uploadToken)}`,
      {method:'POST',body:form},
      45000
    );
  }

  async function sendRequest(button){
    if(button.disabled) return;
    button.disabled=true;

    try{
      const referralToken=getReferralToken();

      if(!REQUEST_STATE.requestCode){
        button.textContent='Надсилаємо…';

        const notes=[
          MASTER_TRANSFER_MODE && REQUEST_STATE.workDescription
            ? `Опис роботи: ${REQUEST_STATE.workDescription}`
            : '',
          REQUEST_STATE.notes
        ].filter(Boolean).join('\n');

        const payload={
          name:REQUEST_STATE.name,
          phone:REQUEST_STATE.phone,
          type:REQUEST_STATE.type,
          typeLabel:REQUEST_STATE.typeLabel,
          location:REQUEST_STATE.location,
          timing:REQUEST_STATE.timing,
          consultationDate:consultationDetails(),
          project:REQUEST_STATE.project,
          notes,
          source:MASTER_TRANSFER_MODE ? 'SA-MASTER Jobs' : 'SA-MASTER.PRO'
        };

        if(!MASTER_TRANSFER_MODE){
          payload.request_goal=REQUEST_STATE.requestGoal;
          payload.work_scope=REQUEST_STATE.workScope;
          payload.object_type=REQUEST_STATE.objectType;
          payload.address=REQUEST_STATE.address;
          payload.request_details=REQUEST_STATE.requestDetails;
          payload.estimate_type=REQUEST_STATE.estimateType;
        }

        if(referralToken) payload.ref=referralToken;

        const result=await requestJson(`${WORKER_URL}/`,{
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify(payload)
        });

        REQUEST_STATE.requestCode=result.request.request_code;
        REQUEST_STATE.uploadToken=result.request.upload_token;
      }

      if(REQUEST_STATE.projectFile && !REQUEST_STATE.fileUploaded){
        button.textContent='Завантажуємо файл…';
        await uploadRequestFile(REQUEST_STATE.projectFile,'project');
        REQUEST_STATE.fileUploaded=true;
      }

      if(REQUEST_STATE.photoFile && !REQUEST_STATE.photoUploaded){
        button.textContent='Завантажуємо фото…';
        await uploadRequestFile(REQUEST_STATE.photoFile,'photo');
        REQUEST_STATE.photoUploaded=true;
      }

      button.textContent='✓ Надіслано';

      chatBot(requestText(
        'Заявку отримано. Дякую! Я зв’яжусь з вами після ознайомлення з інформацією.',
        'Заявку передано в SA-MASTER Jobs.'
      ));

      setTimeout(closeRequest,1800);

    }catch(error){
      console.error('REQUEST ERROR:',error);
      button.disabled=false;
      button.textContent=REQUEST_STATE.requestCode ? 'Повторити завантаження' : 'Повторити';

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
