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

  const REQUEST_STATE = {
    type:'', typeLabel:'', name:'', phone:'', location:'', address:'', timing:'',
    project:'', notes:'', workDescription:'', projectFile:null, photoFile:null,
    requestGoal:'', workScope:'', objectType:'', estimateType:'', requestDetails:{},
    transferConsent:'', requestCode:'', uploadToken:'', fileUploaded:false, photoUploaded:false
  };

  const TYPE_LABELS = {
    plumbing:'🔧 Монтаж сантехніки', repair:'🚿 Ремонт або заміна',
    emergency:'🚨 Аварійний виклик', other_job:'📋 Інше'
  };

  let chatStep=0, chatHistory=[];
  const CHAT_TOTAL_STEPS=12;

  function cloneState(){ return {...REQUEST_STATE, requestDetails:{...REQUEST_STATE.requestDetails}}; }
  function saveBack(renderQuestion){ chatHistory.push({state:cloneState(),renderQuestion,chatStep}); }
  function appendBackControl(parent){
    if(!parent||!chatHistory.length)return;
    const b=document.createElement('button'); b.type='button'; b.className='chat-back'; b.textContent='← Назад';
    b.addEventListener('click',goBackInChat); parent.appendChild(b);
  }
  function goBackInChat(){
    const prev=chatHistory.pop(); if(!prev)return;
    Object.keys(REQUEST_STATE).forEach(k=>REQUEST_STATE[k]=k==='requestDetails'?{...(prev.state[k]||{})}:prev.state[k]);
    const body=$('chatBody'); if(body)body.innerHTML=''; chatStep=prev.chatStep; prev.renderQuestion();
  }
  function chatScroll(){ const body=$('chatBody'); if(body)setTimeout(()=>body.scrollTop=body.scrollHeight,50); }
  function chatMsg(text,who){ const body=$('chatBody'); if(!body)return; const row=document.createElement('div'),bubble=document.createElement('div'); row.className=`chat-message ${who}`; bubble.className='chat-bubble'; bubble.textContent=text; row.appendChild(bubble); body.appendChild(row); chatScroll(); }
  const chatBot=t=>chatMsg(t,'bot'), chatUser=t=>chatMsg(t,'user');
  function updateProgress(){ const bar=$('chatProgressBar'); if(bar)bar.style.width=Math.max(5,Math.min(100,((chatStep+1)/CHAT_TOTAL_STEPS)*100))+'%'; }
  function step(n){ chatStep=n; updateProgress(); }

  function addOptions(options,onChoose){
    const body=$('chatBody'); if(!body)return; const wrap=document.createElement('div'); wrap.className='chat-options';
    options.forEach(({value,label})=>{ const b=document.createElement('button'); b.type='button'; b.className='chat-option'; b.textContent=label; b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();wrap.remove();onChoose(value,label);},{once:true}); wrap.appendChild(b); });
    appendBackControl(wrap); body.appendChild(wrap); chatScroll();
  }

  function addInput(placeholder,type,onDone,validate,opts={}){
    const body=$('chatBody'); if(!body)return; const section=document.createElement('div'),wrap=document.createElement('div');
    const input=opts.multiline?document.createElement('textarea'):document.createElement('input'); const send=document.createElement('button');
    section.className='chat-input-section'; wrap.className='chat-input-wrap'; input.className='chat-input';
    if(!opts.multiline) input.type=type||'text'; input.placeholder=placeholder; input.autocomplete=type==='tel'?'tel':'off'; input.setAttribute('aria-label',placeholder); if(opts.multiline){input.rows=4;input.maxLength=opts.maxLength||3000;}
    if(type==='tel'){ input.inputMode='tel'; input.addEventListener('blur',()=>{const v=normalizeUAPhone(input.value);if(v)input.value=v;}); }
    send.type='button'; send.className='chat-send'; send.setAttribute('aria-label','Надіслати'); send.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M22 2 11 13"/><path d="m22 2-7 20-4-9-9-4z"/></svg>';
    const submit=()=>{ let v=input.value.trim(); if(!v)return input.focus(); if(type==='tel'){v=normalizeUAPhone(v);if(!v){input.setAttribute('aria-invalid','true');return input.focus();}} if(validate&&!validate(v)){input.setAttribute('aria-invalid','true');return input.focus();} section.remove(); chatUser(v); onDone(v); };
    send.addEventListener('click',submit); input.addEventListener('keydown',e=>{if(e.key==='Enter'&&!opts.multiline){e.preventDefault();submit();}}); wrap.append(input,send); section.appendChild(wrap); appendBackControl(section); body.appendChild(section); setTimeout(()=>input.focus(),50); chatScroll();
  }

  function addFileInput(onDone,options={}){
    const body=$('chatBody'); if(!body)return; const wrap=document.createElement('div'),title=document.createElement('div'),hint=document.createElement('div'),actions=document.createElement('div'),input=document.createElement('input'),pick=document.createElement('button'),skip=document.createElement('button');
    wrap.className='chat-file-wrap'; title.className='chat-file-title'; hint.className='chat-file-hint'; actions.className='chat-file-actions';
    title.textContent=options.title||'Додайте файл'; hint.textContent=options.hint||'Необов’язково · до 25 МБ.'; input.type='file'; input.hidden=true; input.accept=options.accept||'image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.zip,.txt';
    pick.type=skip.type='button'; pick.className='chat-file-btn'; skip.className='chat-file-btn secondary'; pick.textContent=options.pickLabel||'📎 Додати файл'; skip.textContent=options.skipLabel||'Пропустити';
    pick.onclick=()=>input.click(); input.onchange=()=>{const f=input.files&&input.files[0]; if(!f)return; if(f.size>25*1024*1024){chatBot('Файл завеликий. Максимальний розмір — 25 МБ.');input.value='';return;} wrap.remove();onDone(f);}; skip.onclick=()=>{wrap.remove();onDone(null);};
    actions.append(pick,skip); wrap.append(title,hint,input,actions); appendBackControl(wrap); body.appendChild(wrap); chatScroll();
  }

  function resetChat(){
    const body=$('chatBody'); if(body)body.innerHTML='';
    Object.keys(REQUEST_STATE).forEach(k=>{ if(k==='projectFile'||k==='photoFile')REQUEST_STATE[k]=null; else if(k==='requestDetails')REQUEST_STATE[k]={}; else if(k==='fileUploaded'||k==='photoUploaded')REQUEST_STATE[k]=false; else REQUEST_STATE[k]=''; });
    chatStep=0; chatHistory=[]; updateProgress();
  }
  function openRequest(){ const modal=$('requestModal'); if(!modal)return; resetChat(); document.body.classList.add('chat-open'); modal.classList.add('act'); modal.setAttribute('aria-hidden','false'); lock(); askType(); }
  function closeRequest(){ const modal=$('requestModal'); if(modal){modal.classList.remove('act');modal.setAttribute('aria-hidden','true');} document.body.classList.remove('chat-open'); unlock(); }

  /* ---------- окрема форма передачі заявки майстром: залишена без зміни логіки ---------- */
  function askType(){
    step(0);
    if(MASTER_TRANSFER_MODE){ chatBot('Передайте заявку від замовника. Це займе менше хвилини.'); chatBot('Що потрібно зробити?'); addOptions([{value:'plumbing',label:'🔧 Монтаж сантехніки'},{value:'repair',label:'🚿 Ремонт або заміна'},{value:'emergency',label:'🚨 Аварійний виклик'},{value:'other_job',label:'📋 Інше'}],afterMasterType); return; }
    chatBot('Вітаю. Допоможу швидко оформити звернення.'); chatBot('Що вас цікавить?');
    addOptions([{value:'work',label:'Виконати роботи'},{value:'cost',label:'Дізнатись вартість'},{value:'consultation',label:'Потрібна консультація'}],(v,l)=>{saveBack(askType);REQUEST_STATE.requestGoal=v;chatUser(l); if(v==='work')askWorkScope(); else if(v==='cost')askCostScope(); else askConsultationType();});
  }
  function afterMasterType(v,l){saveBack(askType);REQUEST_STATE.type=v;REQUEST_STATE.typeLabel=TYPE_LABELS[v]||l;chatUser(l);askMasterLocation();}
  function askMasterLocation(){step(1);chatBot('Де об’єкт?');addInput('ЖК / район / адреса','text',v=>{saveBack(askMasterLocation);REQUEST_STATE.location=v;askMasterDescription();});}
  function askMasterDescription(){step(2);chatBot('Коротко опишіть, що потрібно зробити.');addInput('Наприклад: замінити бойлер 80 л','text',v=>{saveBack(askMasterDescription);REQUEST_STATE.workDescription=v;askMasterProject();},null,{multiline:true});}
  function askMasterProject(){step(3);chatBot('Чи є у замовника дизайн-проєкт?');addOptions([{value:'Є',label:'✅ Є'},{value:'Немає',label:'❌ Немає'},{value:'Не знаю',label:'❓ Не знаю'}],(v,l)=>{saveBack(askMasterProject);REQUEST_STATE.project=v;chatUser(l);v==='Є'?askMasterProjectFile():askMasterTiming();});}
  function askMasterProjectFile(){step(3);addFileInput(f=>{saveBack(askMasterProjectFile);REQUEST_STATE.projectFile=f;if(f)chatUser(`Проєкт: ${f.name}`);else chatUser('Проєкт без файлу');askMasterTiming();},{title:'📐 Файл дизайн-проєкту',hint:'Необов’язково · PDF, фото або документ · до 25 МБ.',pickLabel:'📎 Додати проєкт',skipLabel:'Без файлу'});}
  function askMasterTiming(){step(4);chatBot('Коли потрібно виконати роботу?');addOptions([{value:'Сьогодні',label:'🔥 Сьогодні'},{value:'Завтра',label:'Завтра'},{value:'Найближчими днями',label:'Найближчими днями'},{value:'Дата не визначена',label:'Дата не визначена'}],(v,l)=>{saveBack(askMasterTiming);REQUEST_STATE.timing=v;chatUser(l);askMasterName();});}
  function askMasterName(){step(5);chatBot('Як звати замовника?');addInput('Ім’я замовника','text',v=>{saveBack(askMasterName);REQUEST_STATE.name=v;askMasterPhone();});}
  function askMasterPhone(){step(6);chatBot('Вкажіть номер телефону замовника.');addInput('Наприклад: 0979111871','tel',v=>{saveBack(askMasterPhone);REQUEST_STATE.phone=v;askMasterPhoto();},v=>String(v).replace(/\D/g,'').length>=9);}
  function askMasterPhoto(){step(7);addFileInput(f=>{saveBack(askMasterPhoto);REQUEST_STATE.photoFile=f;if(f)chatUser(`Фото: ${f.name}`);else chatUser('Без фото');finishChat();},{title:'📷 Фото об’єкта',hint:'Необов’язково · до 25 МБ.',accept:'image/*,.heic,.heif',pickLabel:'📷 Додати фото',skipLabel:'Пропустити'});}

  /* ---------- ВИКОНАТИ РОБОТИ ---------- */
  function askWorkScope(){step(1);chatBot('Які роботи плануються?');addOptions([{value:'complex',label:'Комплексний монтаж'},{value:'separate',label:'Окремі роботи'}],(v,l)=>{saveBack(askWorkScope);REQUEST_STATE.workScope=v;REQUEST_STATE.type=v==='complex'?'complex':'local';REQUEST_STATE.typeLabel=l;chatUser(l);v==='complex'?askWorkObject():askSeparateWorkDescription(true);});}
  function askWorkObject(){step(2);chatBot('Який це об’єкт?');addOptions([{value:'apartment',label:'Квартира'},{value:'house',label:'Будинок'}],(v,l)=>{saveBack(askWorkObject);REQUEST_STATE.objectType=v;chatUser(l);askNewBuild(()=>v==='house'?askHouseArea(()=>askWorkProject()):askWorkProject());});}
  function askNewBuild(next){step(3);chatBot('Це новобудова?');addOptions([{value:'yes',label:'Так'},{value:'no',label:'Ні'}],(v,l)=>{saveBack(()=>askNewBuild(next));REQUEST_STATE.requestDetails.new_build=v;chatUser(l);next();});}
  function askHouseArea(next){step(4);chatBot('Яка площа будинку?');addInput('Наприклад: 180 м²','text',v=>{saveBack(()=>askHouseArea(next));REQUEST_STATE.requestDetails.house_area=v;next();});}
  function askWorkProject(){step(4);chatBot('Чи є дизайн-проєкт або план із розміщенням меблів і сантехніки?');addOptions([{value:'design',label:'Є дизайн-проєкт'},{value:'plan',label:'Є план розміщення'},{value:'developing',label:'Ще в розробці'},{value:'none',label:'Немає'}],(v,l)=>{saveBack(askWorkProject);REQUEST_STATE.project=l;REQUEST_STATE.requestDetails.documentation=v;chatUser(l); if(v==='design'||v==='plan')askProjectFile(()=>askWorkMedia()); else askWorkMedia();});}
  function askProjectFile(next){step(5);addFileInput(f=>{saveBack(()=>askProjectFile(next));REQUEST_STATE.projectFile=f;if(f)chatUser(`Файл: ${f.name}`);else chatUser('Без файлу');next();},{title:'Додайте проєкт або план',hint:'Необов’язково · один файл · до 25 МБ.',pickLabel:'📎 Додати файл',skipLabel:'Пропустити'});}
  function askWorkMedia(){step(5);chatBot('За бажанням додайте фото або відео об’єкта.');addFileInput(f=>{saveBack(askWorkMedia);REQUEST_STATE.photoFile=f;if(f)chatUser(`Матеріал: ${f.name}`);else chatUser('Пропустити');askWorkLocation();},{title:'Фото або відео об’єкта',hint:'Необов’язково · один файл · до 25 МБ.',accept:'image/*,video/*,.heic,.heif',pickLabel:'📎 Додати',skipLabel:'Пропустити'});}
  function askSeparateWorkDescription(isWork){step(2);chatBot('Що потрібно зробити?');chatBot(isWork?'Опишіть роботи якомога детальніше: що потрібно встановити, замінити, перенести, підключити або відремонтувати. Якщо є проблема — опишіть, у чому вона полягає.':'Опишіть роботи якомога детальніше, щоб ми могли попередньо оцінити їх вартість.');addInput('Опишіть роботи','text',v=>{saveBack(()=>askSeparateWorkDescription(isWork));REQUEST_STATE.workDescription=v;REQUEST_STATE.requestDetails.work_description=v;askSeparateMedia(isWork);},null,{multiline:true});}
  function askSeparateMedia(isWork){step(3);chatBot('Додайте фото або відео.');chatBot(isWork?'Покажіть зону, де плануються роботи: загальний вигляд та, за можливості, крупним планом наявні підключення, комунікації, обладнання або проблему, яку потрібно усунути.':'Покажіть місце проведення робіт, наявні підключення, обладнання або проблему, яку потрібно усунути.');addFileInput(f=>{saveBack(()=>askSeparateMedia(isWork));REQUEST_STATE.photoFile=f;if(f)chatUser(`Матеріал: ${f.name}`);else chatUser('Пропустити');isWork?askWorkLocation():askName();},{title:'Фото або відео',hint:'Необов’язково · один файл · до 25 МБ.',accept:'image/*,video/*,.heic,.heif',pickLabel:'📎 Додати',skipLabel:'Пропустити'});}
  function askWorkLocation(){step(6);chatBot('Де знаходиться об’єкт?');addInput('ЖК / район / населений пункт','text',v=>{saveBack(askWorkLocation);REQUEST_STATE.location=v;askWorkAddress();});}
  function askWorkAddress(){step(7);chatBot('Вкажіть точну адресу об’єкта.');addInput('Вулиця, будинок, квартира / приміщення','text',v=>{saveBack(askWorkAddress);REQUEST_STATE.address=v;askWorkTiming();});}
  function askWorkTiming(){step(8);chatBot('Коли потрібно виконати роботи?');const separate=REQUEST_STATE.workScope==='separate';addOptions(separate?[{value:'asap',label:'Якнайшвидше'},{value:'days',label:'Протягом кількох днів'},{value:'week',label:'Протягом тижня'}]:[{value:'asap',label:'Якнайшвидше'},{value:'month',label:'Протягом місяця'},{value:'1_3_months',label:'Через 1–3 місяці'}],(v,l)=>{saveBack(askWorkTiming);REQUEST_STATE.timing=l;REQUEST_STATE.requestDetails.timing_code=v;chatUser(l);askName();});}
  function askTransferConsent(){step(11);chatBot('Якщо ми не зможемо взяти заявку в роботу, передати її іншим перевіреним майстрам?');addOptions([{value:'yes',label:'Так, передати'},{value:'no',label:'Ні, тільки SA-MASTER'}],(v,l)=>{saveBack(askTransferConsent);REQUEST_STATE.transferConsent=v;REQUEST_STATE.requestDetails.transfer_consent=v;chatUser(l);finishChat();});}

  /* ---------- ДІЗНАТИСЬ ВАРТІСТЬ ---------- */
  function askCostScope(){step(1);chatBot('Що потрібно прорахувати?');addOptions([{value:'complex',label:'Комплексний монтаж'},{value:'separate',label:'Окремі роботи'}],(v,l)=>{saveBack(askCostScope);REQUEST_STATE.workScope=v;REQUEST_STATE.type='estimate';REQUEST_STATE.typeLabel='Прорахунок';chatUser(l);if(v==='separate'){REQUEST_STATE.estimateType='approximate';chatBot('Для окремих робіт можемо попередньо зорієнтувати по вартості. Остаточний обсяг і вартість можуть уточнюватися під час виконання робіт залежно від фактичного стану комунікацій та обладнання.');askSeparateWorkDescription(false);}else askEstimateType();});}
  function askEstimateType(){step(2);chatBot('Який прорахунок потрібен?');addOptions([{value:'approximate',label:'Орієнтовна вартість робіт — безкоштовно'},{value:'detailed',label:'Детальний прорахунок — платний'}],(v,l)=>{saveBack(askEstimateType);REQUEST_STATE.estimateType=v;chatUser(l);if(v==='detailed')chatBot('Детально опрацюємо надану інформацію, документацію та технічні рішення для точного визначення обсягу і вартості робіт.');else chatBot('Орієнтовна вартість робіт на основі наданої інформації.');askEstimateObject();});}
  function askEstimateObject(){step(3);chatBot('Який це об’єкт?');addOptions([{value:'apartment',label:'Квартира'},{value:'house',label:'Будинок'}],(v,l)=>{saveBack(askEstimateObject);REQUEST_STATE.objectType=v;chatUser(l);askNewBuild(()=>askEstimateDocumentation());});}
  function askEstimateDocumentation(){step(4);chatBot('Яка документація є?');addOptions([{value:'design',label:'Дизайн-проєкт'},{value:'plan',label:'План / креслення'},{value:'other',label:'Інша документація'},{value:'none',label:'Документації немає'}],(v,l)=>{saveBack(askEstimateDocumentation);REQUEST_STATE.requestDetails.documentation=v;REQUEST_STATE.project=l;chatUser(l);if(REQUEST_STATE.estimateType==='detailed'&&!(v==='design'||v==='plan')){chatBot('Без проєкту можемо зорієнтувати по вартості. Для детального прорахунку потрібен проєкт або креслення з розміщенням сантехніки та обладнання.');addOptions([{value:'approx',label:'Орієнтовний прорахунок'}],()=>{REQUEST_STATE.estimateType='approximate';askApproxAfterDocs();});return;} if(v==='design'||v==='plan')askProjectFile(()=>REQUEST_STATE.estimateType==='detailed'?askDetailedAfterDocs():askApproxAfterDocs());else askApproxAfterDocs();});}
  function askApproxAfterDocs(){ if(REQUEST_STATE.objectType==='house')askHouseArea(()=>askApproxBathroomsIfNeeded()); else askApproxBathroomsIfNeeded(); }
  function askApproxBathroomsIfNeeded(){const d=REQUEST_STATE.requestDetails.documentation;if(d==='design'||d==='plan')return askWaterDistribution(()=>REQUEST_STATE.objectType==='house'?askHouseHeating(()=>askHouseGas()):askApproxMedia());step(5);chatBot('Скільки санвузлів планується?');addInput('Наприклад: 2','text',v=>{saveBack(askApproxBathroomsIfNeeded);REQUEST_STATE.requestDetails.bathrooms=v;askWaterDistribution(()=>REQUEST_STATE.objectType==='house'?askHouseHeating(()=>askHouseGas()):askApproxMedia());},v=>/^\d+$/.test(v));}
  function askWaterDistribution(next){step(6);chatBot('Яка система водорозведення планується?');addOptions([{value:'tee',label:'Трійникова'},{value:'radial',label:'Променева'},{value:'unknown',label:'Ще не визначились'}],(v,l)=>{saveBack(()=>askWaterDistribution(next));REQUEST_STATE.requestDetails.water_distribution=v;chatUser(l);next();});}
  function askHouseHeating(next){step(6);chatBot('Яка система опалення планується?');addOptions([{value:'floor',label:'Тепла підлога'},{value:'radiators',label:'Радіатори'},{value:'combined',label:'Комбінована — тепла підлога + радіатори'},{value:'unknown',label:'Ще не визначились'}],(v,l)=>{saveBack(()=>askHouseHeating(next));REQUEST_STATE.requestDetails.heating_system=v;chatUser(l);next();});}
  function askHouseGas(){step(7);chatBot('Чи є газ на об’єкті?');addOptions([{value:'yes',label:'Так'},{value:'no',label:'Ні'},{value:'planned',label:'Планується підключення'}],(v,l)=>{saveBack(askHouseGas);REQUEST_STATE.requestDetails.gas=v;chatUser(l);askHeatSource(()=>askWaterSupply());});}
  function askHeatSource(next){step(7);chatBot('Яке джерело тепла планується?');let o=[{value:'electric',label:'Електричний котел'},{value:'heat_pump',label:'Тепловий насос'},{value:'solid',label:'Твердопаливний котел'},{value:'combined',label:'Комбінована система'},{value:'unknown',label:'Ще не визначились'}];if(REQUEST_STATE.requestDetails.gas!=='no')o.unshift({value:'gas',label:'Газовий котел'});addOptions(o,(v,l)=>{saveBack(()=>askHeatSource(next));REQUEST_STATE.requestDetails.heat_source=v;chatUser(l);if(v==='combined')askCombinedHeatSources(next);else next();});}
  function askCombinedHeatSources(next){step(7);chatBot('Вкажіть джерела тепла, які плануються в комбінованій системі.');addInput('Наприклад: газовий котел + тепловий насос','text',v=>{saveBack(()=>askCombinedHeatSources(next));REQUEST_STATE.requestDetails.heat_sources_combined=v;next();});}
  function askWaterSupply(){step(8);chatBot('Яке водопостачання передбачене?');addOptions([{value:'central',label:'Централізоване'},{value:'individual',label:'Індивідуальне'},{value:'unknown',label:'Ще не визначились'}],(v,l)=>{saveBack(askWaterSupply);REQUEST_STATE.requestDetails.water_supply=v;chatUser(l);askWastewater();});}
  function askWastewater(){step(8);chatBot('Яке водовідведення передбачене?');addOptions([{value:'central',label:'Централізоване'},{value:'individual',label:'Індивідуальне'},{value:'unknown',label:'Ще не визначились'}],(v,l)=>{saveBack(askWastewater);REQUEST_STATE.requestDetails.wastewater=v;chatUser(l);REQUEST_STATE.estimateType==='detailed'?askWaterDistribution(()=>askRecirculation(()=>askHouseHotWater())):askApproxMedia();});}
  function askApproxMedia(){step(9);addFileInput(f=>{saveBack(askApproxMedia);REQUEST_STATE.photoFile=f;if(f)chatUser(`Матеріал: ${f.name}`);else chatUser('Пропустити');askOptionalComment(()=>askName());},{title:'Додайте фото або відео',hint:'Необов’язково · один файл · до 25 МБ.',accept:'image/*,video/*,.heic,.heif',pickLabel:'📎 Додати',skipLabel:'Пропустити'});}

  /* ---------- ДЕТАЛЬНИЙ ПРОРАХУНОК ---------- */
  function askDetailedAfterDocs(){ if(REQUEST_STATE.objectType==='house')askHouseArea(()=>askHouseHeating(()=>askHouseGas())); else askWaterDistribution(()=>askApartmentHeating()); }
  function askApartmentHeating(){step(6);chatBot('Що планується з існуючою системою опалення?');addOptions([{value:'keep',label:'Залишити без змін'},{value:'partial',label:'Частково змінити'},{value:'replace',label:'Повністю замінити'},{value:'unknown',label:'Ще не визначились'}],(v,l)=>{saveBack(askApartmentHeating);REQUEST_STATE.requestDetails.heating_change=v;chatUser(l);if(v==='partial')addInput('Що саме планується змінити?','text',x=>{REQUEST_STATE.requestDetails.heating_partial=x;askCentralHotWater();},null,{multiline:true});else if(v==='replace')askApartmentHeatingSystem();else askCentralHotWater();});}
  function askApartmentHeatingSystem(){step(6);chatBot('Яка система опалення планується?');addOptions([{value:'radial',label:'Променева'},{value:'tee',label:'Трійникова'},{value:'unknown',label:'Ще не визначились'}],(v,l)=>{saveBack(askApartmentHeatingSystem);REQUEST_STATE.requestDetails.heating_distribution=v;chatUser(l);askCentralHotWater();});}
  function askCentralHotWater(){step(7);chatBot('Чи плануєте користуватися централізованим гарячим водопостачанням?');addOptions([{value:'yes',label:'Так'},{value:'no',label:'Ні'},{value:'absent',label:'Централізованого ГВП немає'},{value:'unknown',label:'Ще не визначились'}],(v,l)=>{saveBack(askCentralHotWater);REQUEST_STATE.requestDetails.central_hot_water=v;chatUser(l);askRecirculation(()=>askAcDrain(()=>askSewerRisers()));});}
  function askRecirculation(next){step(7);chatBot('Чи планується рециркуляція гарячої води?');addOptions([{value:'yes',label:'Так'},{value:'no',label:'Ні'},{value:'unknown',label:'Ще не визначились'}],(v,l)=>{saveBack(()=>askRecirculation(next));REQUEST_STATE.requestDetails.recirculation=v;chatUser(l);next();});}
  function askHouseHotWater(){step(8);chatBot('Як планується готувати гарячу воду?');addOptions([{value:'boiler',label:'Бойлер'},{value:'indirect',label:'Бойлер непрямого нагріву'},{value:'gas',label:'Газовий котел'},{value:'heat_pump',label:'Тепловий насос'},{value:'other',label:'Інше'},{value:'unknown',label:'Ще не визначились'}],(v,l)=>{saveBack(askHouseHotWater);REQUEST_STATE.requestDetails.hot_water_source=v;chatUser(l);askWaterTreatment(()=>askAcDrain(()=>askBuiltInMixers(()=>askBathFill(()=>askDetailedMedia()))));});}
  function askWaterTreatment(next){step(8);chatBot('Чи планується система комплексного очищення / пом’якшення води?');addOptions([{value:'yes',label:'Так'},{value:'no',label:'Ні'},{value:'unknown',label:'Ще не визначились'}],(v,l)=>{saveBack(()=>askWaterTreatment(next));REQUEST_STATE.requestDetails.water_treatment=v;chatUser(l);next();});}
  function askAcDrain(next){step(8);chatBot('Чи планується підключення дренажу кондиціонерів до каналізації через сифони?');addOptions([{value:'yes',label:'Так'},{value:'no',label:'Ні'},{value:'unknown',label:'Ще не визначились'}],(v,l)=>{saveBack(()=>askAcDrain(next));REQUEST_STATE.requestDetails.ac_drain=v;chatUser(l);if(v==='yes')addInput('Скільки точок?','text',x=>{REQUEST_STATE.requestDetails.ac_drain_points=x;next();},x=>/^\d+$/.test(x));else next();});}
  function askSewerRisers(){step(8);chatBot('Що планується з каналізаційними стояками?');addOptions([{value:'keep',label:'Залишити без змін'},{value:'soundproof',label:'Знешумити'},{value:'replace',label:'Замінити'},{value:'replace_soundproof',label:'Замінити та знешумити'},{value:'unknown',label:'Ще не визначились'}],(v,l)=>{saveBack(askSewerRisers);REQUEST_STATE.requestDetails.sewer_risers=v;chatUser(l);askBuiltInMixers(()=>askBathFill(()=>askWaterTreatment(()=>askDetailedMedia())));});}
  function askBuiltInMixers(next){step(9);chatBot('Чи плануються вбудовані змішувачі?');addOptions([{value:'yes',label:'Так'},{value:'no',label:'Ні'},{value:'unknown',label:'Ще не визначились'}],(v,l)=>{saveBack(()=>askBuiltInMixers(next));REQUEST_STATE.requestDetails.built_in_mixers=v;chatUser(l);if(v==='yes')addInput('Скільки вбудованих змішувачів?','text',x=>{REQUEST_STATE.requestDetails.built_in_mixers_count=x;next();},x=>/^\d+$/.test(x));else next();});}
  function askBathFill(next){step(9);chatBot('Якщо проєктом передбачена ванна, як планується її наповнення?');addOptions([{value:'classic',label:'Через класичний змішувач'},{value:'siphon',label:'Через сифон із функцією наповнення ванни'},{value:'no_bath',label:'Ванна не передбачена'},{value:'unknown',label:'Ще не визначились'}],(v,l)=>{saveBack(()=>askBathFill(next));REQUEST_STATE.requestDetails.bath_fill=v;chatUser(l);next();});}
  function askDetailedMedia(){step(10);addFileInput(f=>{saveBack(askDetailedMedia);REQUEST_STATE.photoFile=f;if(f)chatUser(`Матеріал: ${f.name}`);else chatUser('Пропустити');askOptionalComment(()=>askName());},{title:'Додайте фото або відео',hint:'Необов’язково · один файл · до 25 МБ.',accept:'image/*,video/*,.heic,.heif',pickLabel:'📎 Додати',skipLabel:'Пропустити'});}
  function askOptionalComment(next){step(10);chatBot('Що ще важливо врахувати?');addOptions([{value:'add',label:'Додати коментар'},{value:'skip',label:'Пропустити'}],v=>{saveBack(()=>askOptionalComment(next));if(v==='skip'){chatUser('Пропустити');next();}else addInput('Додаткові побажання або особливості','text',x=>{REQUEST_STATE.notes=x;next();},null,{multiline:true});});}

  /* ---------- КОНСУЛЬТАЦІЯ ---------- */
  function askConsultationType(){step(1);REQUEST_STATE.type='consultation';REQUEST_STATE.typeLabel='Консультація';chatBot('Яка консультація потрібна?');addOptions([{value:'short',label:'Коротка консультація'},{value:'individual',label:'Індивідуальна консультація — платна'},{value:'onsite',label:'Консультація на об’єкті — платна'}],(v,l)=>{saveBack(askConsultationType);REQUEST_STATE.requestDetails.consultation_type=v;REQUEST_STATE.requestDetails.consultation_paid=v!=='short';REQUEST_STATE.typeLabel=l;chatUser(l);askConsultationQuestion();});}
  function askConsultationQuestion(){step(2);chatBot('Опишіть ваше питання.');const t=REQUEST_STATE.requestDetails.consultation_type;chatBot(t==='onsite'?'Коротко опишіть об’єкт, заплановані роботи та питання, які потрібно розглянути під час консультації.':t==='individual'?'Опишіть ситуацію, технічне завдання або рішення, яке потрібно розібрати.':'Коротко опишіть ситуацію та що саме хочете уточнити.');addInput('Ваше питання','text',v=>{saveBack(askConsultationQuestion);REQUEST_STATE.requestDetails.question=v;REQUEST_STATE.workDescription=v;askConsultationFile();},null,{multiline:true});}
  function askConsultationFile(){step(3);addFileInput(f=>{saveBack(askConsultationFile);REQUEST_STATE.projectFile=f;if(f)chatUser(`Матеріал: ${f.name}`);else chatUser('Пропустити');REQUEST_STATE.requestDetails.consultation_type==='onsite'?askConsultationLocation():askName();},{title:'Додайте фото, відео або документ',hint:'Необов’язково · один файл · до 25 МБ.',pickLabel:'📎 Додати',skipLabel:'Пропустити'});}
  function askConsultationLocation(){step(4);chatBot('Де знаходиться об’єкт?');addInput('ЖК / район / населений пункт','text',v=>{saveBack(askConsultationLocation);REQUEST_STATE.location=v;askConsultationAddress();});}
  function askConsultationAddress(){step(5);chatBot('Вкажіть точну адресу об’єкта.');addInput('Вулиця, будинок, квартира / приміщення','text',v=>{saveBack(askConsultationAddress);REQUEST_STATE.address=v;askName();});}

  /* ---------- КОНТАКТИ / НЕВИЗНАЧЕНІ РІШЕННЯ ---------- */
  function askName(){step(10);chatBot('Як до вас звертатися?');addInput('Ваше ім’я','text',v=>{saveBack(askName);REQUEST_STATE.name=v;askPhone();});}
  function askPhone(){step(10);chatBot('Залиште номер телефону для зв’язку.');addInput('Наприклад: 0979111871','tel',v=>{saveBack(askPhone);REQUEST_STATE.phone=v;if(REQUEST_STATE.requestGoal==='work')askTransferConsent();else if(REQUEST_STATE.estimateType==='detailed')askUnresolvedCheck();else finishChat();},v=>String(v).replace(/\D/g,'').length>=9);}
  function unresolvedItems(){ const d=REQUEST_STATE.requestDetails, labels={water_distribution:'Система водорозведення',heating_change:'Зміни системи опалення',heating_distribution:'Система опалення',central_hot_water:'Централізоване ГВП',recirculation:'Рециркуляція гарячої води',heating_system:'Система опалення',heat_source:'Джерело тепла',water_supply:'Водопостачання',wastewater:'Водовідведення',hot_water_source:'Приготування гарячої води',water_treatment:'Очищення / пом’якшення води',ac_drain:'Дренаж кондиціонерів',sewer_risers:'Каналізаційні стояки',built_in_mixers:'Вбудовані змішувачі',bath_fill:'Наповнення ванни'}; const out=[];Object.entries(labels).forEach(([k,l])=>{if(d[k]==='unknown')out.push(l);});if(d.ac_drain==='yes'&&!d.ac_drain_points)out.push('Кількість точок дренажу кондиціонерів');if(d.built_in_mixers==='yes'&&!d.built_in_mixers_count)out.push('Кількість вбудованих змішувачів');return out; }
  function askUnresolvedCheck(){const items=unresolvedItems();REQUEST_STATE.requestDetails.unresolved_items=items;if(!items.length)return finishChat();step(11);chatBot('Залишились невизначені технічні рішення.');chatBot('Для детального прорахунку потрібно уточнити: '+items.join(', ')+'. За потреби ми можемо допомогти підібрати оптимальні рішення під ваш об’єкт під час індивідуальної платної консультації онлайн.');addOptions([{value:'consultation',label:'Потрібна консультація'},{value:'continue',label:'Пропустити та продовжити'}],(v,l)=>{saveBack(askUnresolvedCheck);REQUEST_STATE.requestDetails.unresolved_action=v;chatUser(l);if(v==='continue')chatBot('Через невизначені технічні рішення прорахунок буде менш точним.');finishChat();});}

  /* ---------- ПІДСУМОК ---------- */
  function finishChat(){
    step(12);chatBot(MASTER_TRANSFER_MODE?'Перевірте дані заявки перед передачею.':'Готово. Перевірте дані перед відправленням.');
    const body=$('chatBody');if(!body)return;const summary=document.createElement('div'),title=document.createElement('div');summary.className='chat-summary';title.className='chat-summary-title';title.textContent=MASTER_TRANSFER_MODE?'Передача заявки':'Ваша заявка';summary.appendChild(title);
    const row=(label,value)=>{if(value===undefined||value===null||value==='')return;const item=document.createElement('div'),le=document.createElement('div'),ve=document.createElement('div');item.className='chat-summary-row';le.className='chat-summary-label';ve.className='chat-summary-value';le.textContent=label;ve.textContent=String(value);item.append(le,ve);summary.appendChild(item);};
    if(MASTER_TRANSFER_MODE){row('Робота',REQUEST_STATE.typeLabel);row('Опис',REQUEST_STATE.workDescription);} else {row('Звернення',REQUEST_STATE.requestGoal==='work'?'Виконати роботи':REQUEST_STATE.requestGoal==='cost'?'Дізнатись вартість':'Потрібна консультація');row('Тип',REQUEST_STATE.typeLabel);if(REQUEST_STATE.workScope)row('Обсяг',REQUEST_STATE.workScope==='complex'?'Комплексний монтаж':'Окремі роботи');if(REQUEST_STATE.objectType)row('Об’єкт',REQUEST_STATE.objectType==='house'?'Будинок':'Квартира');if(REQUEST_STATE.estimateType)row('Прорахунок',REQUEST_STATE.estimateType==='detailed'?'Детальний — платний':'Орієнтовний');}
    row(REQUEST_STATE.requestGoal==='consultation'?'Питання':'Опис',REQUEST_STATE.workDescription);row('Локація',REQUEST_STATE.location);row('Адреса',REQUEST_STATE.address);row('Коли',REQUEST_STATE.timing);row('Документація',REQUEST_STATE.project);if(REQUEST_STATE.projectFile)row('Файл',REQUEST_STATE.projectFile.name);if(REQUEST_STATE.photoFile)row('Фото / відео',REQUEST_STATE.photoFile.name);if(REQUEST_STATE.transferConsent)row('Передача іншим майстрам',REQUEST_STATE.transferConsent==='yes'?'Так, передати':'Ні, тільки SA-MASTER');row(MASTER_TRANSFER_MODE?'Замовник':"Ім’я",REQUEST_STATE.name);row('Телефон',REQUEST_STATE.phone);
    const buttons=document.createElement('div'),edit=document.createElement('button'),submit=document.createElement('button');buttons.className='chat-final-buttons';edit.type=submit.type='button';edit.className='chat-final-btn edit';submit.className='chat-final-btn submit';edit.textContent=MASTER_TRANSFER_MODE?'← Змінити':'Змінити';submit.textContent=MASTER_TRANSFER_MODE?'🤝 Передати заявку':'Надіслати';edit.onclick=openRequest;submit.onclick=()=>sendRequest(submit);buttons.append(edit,submit);summary.appendChild(buttons);appendBackControl(summary);body.appendChild(summary);chatScroll();
  }

  /* =========================================================
   * API
   * ========================================================= */
  async function requestJson(url,options,timeoutMs=15000){const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),timeoutMs);try{const response=await fetch(url,{...options,signal:controller.signal});const data=await response.json().catch(()=>({}));if(!response.ok||!data.ok)throw new Error(data.error||'Помилка сервера');return data;}finally{clearTimeout(timeout);}}
  async function uploadRequestFile(file,kind){const form=new FormData();form.append('file',file);form.append('kind',kind);return requestJson(`${WORKER_URL}/request/${encodeURIComponent(REQUEST_STATE.requestCode)}/project?token=${encodeURIComponent(REQUEST_STATE.uploadToken)}`,{method:'POST',body:form},45000);}
  function showSuccessTelegram(result){
    chatBot(MASTER_TRANSFER_MODE?'Заявку передано в SA-MASTER Jobs.':`Заявку ${REQUEST_STATE.requestCode} отримано.`);
    if(MASTER_TRANSFER_MODE)return setTimeout(closeRequest,1800);
    const body=$('chatBody');if(!body)return;const box=document.createElement('div');box.className='chat-summary';const t=document.createElement('div');t.className='chat-summary-title';t.textContent='Стежити за статусом заявки';const p=document.createElement('div');p.className='chat-note';p.textContent='Підключіть Telegram, щоб отримувати повідомлення про статус заявки та подальші дії. Це необов’язково — заявку вже успішно відправлено.';box.append(t,p);
    const telegramLink=result?.request?.telegram_link||result?.telegram_link||'';
    if(telegramLink){const a=document.createElement('a');a.className='chat-final-btn submit';a.textContent='Отримувати статус у Telegram';a.href=telegramLink;a.target='_blank';a.rel='noopener';box.appendChild(a);}else{const note=document.createElement('div');note.className='chat-note';note.textContent='Підключення статусів у Telegram буде доступне після активації цієї функції в боті.';box.appendChild(note);}
    const close=document.createElement('button');close.type='button';close.className='chat-final-btn edit';close.textContent='Закрити';close.onclick=closeRequest;box.appendChild(close);body.appendChild(box);chatScroll();
  }
  async function sendRequest(button){if(button.disabled)return;button.disabled=true;try{const referralToken=getReferralToken();let result=null;if(!REQUEST_STATE.requestCode){button.textContent='Надсилаємо…';const notes=[MASTER_TRANSFER_MODE&&REQUEST_STATE.workDescription?`Опис роботи: ${REQUEST_STATE.workDescription}`:'',REQUEST_STATE.notes].filter(Boolean).join('\n');const payload={name:REQUEST_STATE.name,phone:REQUEST_STATE.phone,type:REQUEST_STATE.type,typeLabel:REQUEST_STATE.typeLabel,location:REQUEST_STATE.location,timing:REQUEST_STATE.timing,project:REQUEST_STATE.project,notes,source:MASTER_TRANSFER_MODE?'SA-MASTER Jobs':'SA-MASTER.PRO',request_goal:REQUEST_STATE.requestGoal,work_scope:REQUEST_STATE.workScope,object_type:REQUEST_STATE.objectType,address:REQUEST_STATE.address,request_details:REQUEST_STATE.requestDetails,estimate_type:REQUEST_STATE.estimateType};if(referralToken)payload.ref=referralToken;result=await requestJson(`${WORKER_URL}/`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});REQUEST_STATE.requestCode=result.request.request_code;REQUEST_STATE.uploadToken=result.request.upload_token;}
    if(REQUEST_STATE.projectFile&&!REQUEST_STATE.fileUploaded){button.textContent='Завантажуємо файл…';await uploadRequestFile(REQUEST_STATE.projectFile,'project');REQUEST_STATE.fileUploaded=true;}
    if(REQUEST_STATE.photoFile&&!REQUEST_STATE.photoUploaded){button.textContent='Завантажуємо фото / відео…';await uploadRequestFile(REQUEST_STATE.photoFile,'photo');REQUEST_STATE.photoUploaded=true;}
    button.textContent='✓ Надіслано';button.closest('.chat-summary')?.remove();showSuccessTelegram(result);
  }catch(error){console.error('REQUEST ERROR:',error);button.disabled=false;button.textContent=REQUEST_STATE.requestCode?'Повторити завантаження':'Повторити';chatBot(REQUEST_STATE.requestCode?'Заявку вже отримано, але файл не завантажився. Спробуйте ще раз.':'Не вдалося відправити заявку. Спробуйте ще раз або зателефонуйте за номером +38 (097) 911-18-71.');}}



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
