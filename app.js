ЗАМІНИ У `app.js` ВЕСЬ БЛОК ВІД
`/* ============ Чат-заявка ============ */`
ДО РЯДКА ПЕРЕД
`/* ============ Калькулятор ============ */`
НА ЦЕЙ КОД:

/* ============ Чат-заявка ============ */
const WORKER_URL = 'https://sa-master-worker.c6hht469s9.workers.dev';
const REQUEST_STATE = {
  type: '', typeLabel: '', name: '', phone: '', location: '', timing: '',
  project: '', consultationDate: '', notes: '', projectFile: null,
  requestCode: '', uploadToken: '', fileUploaded: false
};
let chatStep = 0;
const CHAT_TOTAL_STEPS = 6;
const TYPE_LABELS = {
  complex: 'Комплексний монтаж', local: 'Локальний монтаж',
  consultation: 'Консультація', estimate: 'Прорахунок'
};

function chatScroll() {
  const body = $('chatBody');
  if (body) setTimeout(() => { body.scrollTop = body.scrollHeight; }, 50);
}
function chatMsg(text, who) {
  const body = $('chatBody');
  if (!body) return;
  const row = document.createElement('div');
  const bubble = document.createElement('div');
  row.className = `chat-message ${who}`;
  bubble.className = 'chat-bubble';
  bubble.textContent = text;
  row.appendChild(bubble);
  body.appendChild(row);
  chatScroll();
}
const chatBot = (text) => chatMsg(text, 'bot');
const chatUser = (text) => chatMsg(text, 'user');

function updateProgress() {
  const bar = $('chatProgressBar');
  if (bar) bar.style.width = Math.max(5, Math.min(100, ((chatStep + 1) / CHAT_TOTAL_STEPS) * 100)) + '%';
}

function addOptions(options, onChoose) {
  const body = $('chatBody');
  if (!body) return;
  const wrap = document.createElement('div');
  wrap.className = 'chat-options';
  options.forEach(({ value, label }) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'chat-option';
    button.textContent = label;
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      wrap.remove();
      onChoose(value, label);
    }, { once: true });
    wrap.appendChild(button);
  });
  body.appendChild(wrap);
  chatScroll();
}

function addInput(placeholder, type, onDone, validate) {
  const body = $('chatBody');
  if (!body) return;
  const wrap = document.createElement('div');
  const input = document.createElement('input');
  const send = document.createElement('button');
  wrap.className = 'chat-input-wrap';
  input.className = 'chat-input';
  input.type = type || 'text';
  input.placeholder = placeholder;
  input.autocomplete = type === 'tel' ? 'tel' : 'off';
  input.setAttribute('aria-label', placeholder);
  if (type === 'tel') {
    input.inputMode = 'text';
    input.setAttribute('autocorrect', 'off');
    input.setAttribute('autocapitalize', 'off');
    input.setAttribute('spellcheck', 'false');
    input.addEventListener('blur', () => {
      const normalized = normalizeUAPhone(input.value);
      if (normalized) input.value = normalized;
    });
  }
  send.type = 'button';
  send.className = 'chat-send';
  send.setAttribute('aria-label', 'Надіслати');
  send.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M22 2 11 13"/><path d="m22 2-7 20-4-9-9-4z"/></svg>';
  function submit() {
    let value = input.value.trim();
    if (!value) return input.focus();
    if (type === 'tel') {
      value = normalizeUAPhone(value);
      if (!value) { input.setAttribute('aria-invalid', 'true'); return input.focus(); }
    }
    if (validate && !validate(value)) { input.setAttribute('aria-invalid', 'true'); return input.focus(); }
    wrap.remove();
    chatUser(value);
    onDone(value);
  }
  send.addEventListener('click', submit);
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') { event.preventDefault(); submit(); }
  });
  wrap.append(input, send);
  body.appendChild(wrap);
  setTimeout(() => input.focus(), 50);
  chatScroll();
}

function addFileInput(onDone) {
  const body = $('chatBody');
  if (!body) return;
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
  title.textContent = 'Прикріпіть дизайн-проєкт';
  hint.textContent = 'PDF, фото, Word, Excel або ZIP. Максимальний розмір — 25 МБ.';
  input.type = 'file';
  input.accept = '.pdf,.jpg,.jpeg,.png,.webp,.heic,.doc,.docx,.xls,.xlsx,.zip,.txt';
  pick.type = 'button';
  pick.className = 'chat-file-pick';
  pick.textContent = 'Обрати файл';
  skip.type = 'button';
  skip.className = 'chat-file-skip';
  skip.textContent = 'Надішлю пізніше';
  pick.addEventListener('click', () => input.click());
  input.addEventListener('change', () => {
    const file = input.files && input.files[0];
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) { chatBot('Файл завеликий. Оберіть файл до 25 МБ.'); input.value = ''; return; }
    wrap.remove();
    onDone(file);
  });
  skip.addEventListener('click', () => { wrap.remove(); onDone(null); });
  actions.append(pick, skip);
  wrap.append(title, hint, input, actions);
  body.appendChild(wrap);
  chatScroll();
}

function resetChat() {
  const body = $('chatBody');
  if (body) body.innerHTML = '';
  Object.keys(REQUEST_STATE).forEach((key) => { REQUEST_STATE[key] = key === 'projectFile' ? null : ''; });
  REQUEST_STATE.fileUploaded = false;
  chatStep = 0;
  updateProgress();
}
function openRequest() {
  const modal = $('requestModal');
  if (!modal) return;
  resetChat();
  document.body.classList.add('chat-open');
  modal.classList.add('act');
  modal.setAttribute('aria-hidden', 'false');
  lock();
  chatBot('Вітаю. Поставлю кілька коротких запитань, щоб підготувати заявку.');
  chatBot('Що вас цікавить?');
  addOptions([
    { value: 'complex', label: 'Комплексний монтаж' },
    { value: 'local', label: 'Локальний монтаж' },
    { value: 'consultation', label: 'Консультація' },
    { value: 'estimate', label: 'Прорахунок' }
  ], afterType);
  updateProgress();
}
function closeRequest() {
  const modal = $('requestModal');
  if (modal) { modal.classList.remove('act'); modal.setAttribute('aria-hidden', 'true'); }
  document.body.classList.remove('chat-open');
  unlock();
}

function askName() {
  chatStep = 1; updateProgress();
  chatBot('Як до вас звертатися?');
  addInput("Ваше ім'я", 'text', (value) => { REQUEST_STATE.name = value; askPhone(); });
}
function askPhone() {
  chatStep = 2; updateProgress();
  chatBot('Залиште номер телефону для зв’язку.');
  addInput('Наприклад: 0979111871', 'tel', (value) => {
    REQUEST_STATE.phone = value;
    if (REQUEST_STATE.type === 'estimate') askEstimateConsultation();
    else askLocation();
  }, (value) => {
    const digits = String(value || '').replace(/\D/g, '');
    return digits.length >= 9 && digits.length <= 13;
  });
}
function askLocation() {
  chatStep = 3; updateProgress();
  chatBot('Де знаходиться об’єкт? Вкажіть ЖК, вулицю або адресу.');
  addInput('Наприклад: ЖК Файна Таун, вул. Салютна', 'text', (value) => {
    REQUEST_STATE.location = value;
    if (REQUEST_STATE.type === 'consultation') askConsultationDate();
    else if (REQUEST_STATE.type === 'complex') askComplexProject();
    else askTiming();
  });
}
function askConsultationDate() {
  chatStep = 4; updateProgress();
  chatBot('Коли вам зручно провести консультацію?');
  addInput('Наприклад: 18 вересня після 17:00', 'text', (value) => {
    REQUEST_STATE.consultationDate = value;
    finishChat();
  });
}
function askComplexProject() {
  chatStep = 4; updateProgress();
  chatBot('Чи є у вас дизайн-проєкт?');
  addOptions([
    { value: 'Так, є', label: 'Так, є' },
    { value: 'Є, але зараз не можу надати', label: 'Є, але зараз не можу надати' },
    { value: 'Немає', label: 'Немає' }
  ], (value) => { REQUEST_STATE.project = value; chatUser(value); askTiming(); });
}

/* Окрема коротка послідовність тільки для «Прорахунку». */
function askEstimateConsultation() {
  chatStep = 3; updateProgress();
  chatBot('Чи потрібна консультація перед прорахунком?');
  addOptions([
    { value: 'Потрібна', label: 'Так, потрібна' },
    { value: 'Не потрібна', label: 'Ні, не потрібна' }
  ], (value, label) => {
    REQUEST_STATE.consultationDate = value;
    chatUser(label);
    askEstimateProject();
  });
}
function askEstimateProject() {
  chatStep = 4; updateProgress();
  chatBot('Чи є дизайн-проєкт?');
  addOptions([
    { value: 'yes', label: 'Є проєкт' },
    { value: 'no', label: 'Немає проєкту' }
  ], (value, label) => {
    chatUser(label);
    if (value === 'no') { REQUEST_STATE.project = 'Немає'; askTiming(); return; }
    REQUEST_STATE.project = 'Є, файл додається';
    chatBot('Оберіть файл проєкту. Якщо зараз його немає під рукою — заявку все одно можна надіслати.');
    addFileInput((file) => {
      if (file) {
        REQUEST_STATE.projectFile = file;
        chatUser(`Файл: ${file.name}`);
      } else {
        REQUEST_STATE.project = 'Є, надішле пізніше';
        chatUser('Надішлю пізніше');
      }
      askTiming();
    });
  });
}
function askTiming() {
  chatStep = 5; updateProgress();
  chatBot('Коли орієнтовно плануєте початок робіт?');
  addOptions([
    { value: 'Якнайшвидше', label: 'Якнайшвидше' },
    { value: 'Протягом місяця', label: 'Протягом місяця' },
    { value: 'Через 1–2 місяці', label: 'Через 1–2 місяці' },
    { value: 'Поки визначаюсь', label: 'Поки визначаюсь' }
  ], (value) => { REQUEST_STATE.timing = value; chatUser(value); finishChat(); });
}
function afterType(value) {
  REQUEST_STATE.type = value;
  REQUEST_STATE.typeLabel = TYPE_LABELS[value] || value;
  chatUser(REQUEST_STATE.typeLabel);
  askName();
}

function finishChat() {
  chatStep = 6; updateProgress();
  chatBot('Готово. Перевірте дані заявки перед відправленням.');
  const body = $('chatBody');
  if (!body) return;
  const summary = document.createElement('div');
  summary.className = 'chat-summary';
  const title = document.createElement('div');
  title.className = 'chat-summary-title';
  title.textContent = 'Ваша заявка';
  summary.appendChild(title);
  function row(label, value) {
    const item = document.createElement('div');
    const labelEl = document.createElement('div');
    const valueEl = document.createElement('div');
    item.className = 'chat-summary-row'; labelEl.className = 'chat-summary-label'; valueEl.className = 'chat-summary-value';
    labelEl.textContent = label; valueEl.textContent = value || '—'; item.append(labelEl, valueEl); summary.appendChild(item);
  }
  row('Тип', REQUEST_STATE.typeLabel);
  row("Ім'я", REQUEST_STATE.name);
  row('Телефон', REQUEST_STATE.phone);
  if (REQUEST_STATE.location) row('Об’єкт', REQUEST_STATE.location);
  if (REQUEST_STATE.consultationDate) row('Консультація', REQUEST_STATE.consultationDate);
  if (REQUEST_STATE.project) row('Проєкт', REQUEST_STATE.projectFile ? REQUEST_STATE.projectFile.name : REQUEST_STATE.project);
  if (REQUEST_STATE.timing) row('Початок', REQUEST_STATE.timing);
  if (REQUEST_STATE.type === 'estimate' && REQUEST_STATE.consultationDate === 'Потрібна') {
    const note = document.createElement('div');
    note.className = 'chat-note';
    note.textContent = 'Консультація та детальний прорахунок вартості робіт — 2 000 грн.';
    summary.appendChild(note);
  }
  const notesWrap = document.createElement('div');
  const notesInput = document.createElement('input');
  notesWrap.className = 'chat-notes-wrap'; notesInput.className = 'chat-notes-input';
  notesInput.type = 'text'; notesInput.placeholder = '📝 Примітка (необов’язково)'; notesInput.maxLength = 500;
  notesInput.addEventListener('input', () => { REQUEST_STATE.notes = notesInput.value.trim(); });
  notesWrap.appendChild(notesInput); summary.appendChild(notesWrap);
  const buttons = document.createElement('div');
  const edit = document.createElement('button');
  const submit = document.createElement('button');
  buttons.className = 'chat-final-buttons'; edit.type = 'button'; submit.type = 'button';
  edit.className = 'chat-final-btn edit'; submit.className = 'chat-final-btn submit';
  edit.textContent = 'Змінити'; submit.textContent = 'Надіслати';
  edit.addEventListener('click', openRequest); submit.addEventListener('click', () => sendRequest(submit));
  buttons.append(edit, submit); summary.appendChild(buttons); body.appendChild(summary); chatScroll();
}

async function requestJson(url, options, timeoutMs = 15000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) throw new Error(data.error || 'Помилка сервера');
    return data;
  } finally { clearTimeout(timeout); }
}
async function uploadProject() {
  const data = new FormData();
  data.append('file', REQUEST_STATE.projectFile);
  return requestJson(
    `${WORKER_URL}/request/${encodeURIComponent(REQUEST_STATE.requestCode)}/project?token=${encodeURIComponent(REQUEST_STATE.uploadToken)}`,
    { method: 'POST', body: data },
    45000
  );
}
async function sendRequest(button) {
  if (button.disabled) return;
  button.disabled = true;
  try {
    if (!REQUEST_STATE.requestCode) {
      button.textContent = 'Надсилаємо…';
      const result = await requestJson(`${WORKER_URL}/`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: REQUEST_STATE.name, phone: REQUEST_STATE.phone, type: REQUEST_STATE.type,
          typeLabel: REQUEST_STATE.typeLabel, location: REQUEST_STATE.location,
          timing: REQUEST_STATE.timing, consultationDate: REQUEST_STATE.consultationDate,
          project: REQUEST_STATE.project, notes: REQUEST_STATE.notes, source: 'SA-MASTER.PRO'
        })
      });
      REQUEST_STATE.requestCode = result.request.request_code;
      REQUEST_STATE.uploadToken = result.request.upload_token;
    }
    if (REQUEST_STATE.projectFile && !REQUEST_STATE.fileUploaded) {
      button.textContent = 'Завантажуємо проєкт…';
      await uploadProject();
      REQUEST_STATE.fileUploaded = true;
    }
    button.textContent = '✓ Надіслано';
    chatBot('Заявку отримано. Дякую! Я зв’яжусь з вами після ознайомлення з інформацією.');
    setTimeout(closeRequest, 1800);
  } catch (error) {
    console.error('REQUEST ERROR:', error);
    button.disabled = false;
    button.textContent = REQUEST_STATE.requestCode ? 'Повторити завантаження' : 'Повторити';
    chatBot(REQUEST_STATE.requestCode
      ? 'Заявку вже отримано, але файл не завантажився. Спробуйте ще раз.'
      : 'Не вдалося відправити заявку. Спробуйте ще раз або зателефонуйте за номером +38 (097) 911-18-71.');
  }
}
