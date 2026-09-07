// ============ ТЕМА ============
const toggleBtn = document.getElementById('themeToggle');
const body = document.body;

const getInitialTheme = () => {
    const saved = localStorage.getItem('theme');
    if (saved) return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

if (getInitialTheme() === 'dark') body.classList.add('dark-mode');

toggleBtn.addEventListener('click', () => {
    body.classList.toggle('dark-mode');
    localStorage.setItem('theme', body.classList.contains('dark-mode') ? 'dark' : 'light');
});

// ============ ГАЛЕРЕЯ ============
const track = document.getElementById('galleryTrack');
const dots = [...document.querySelectorAll('.gallery-dot')];
const counter = document.getElementById('galleryCounter');
const totalSlides = 8;
let currentIndex = 0;
let autoPlayTimer;
let isDragging = false;
let startX = 0;
let currentX = 0;
let dragOffset = 0;

const updateGallery = (animate = true) => {
    track.style.transition = animate ? 'transform 0.5s cubic-bezier(0.22, 0.61, 0.36, 1)' : 'none';
    track.style.transform = `translate3d(-${currentIndex * 100}%, 0, 0)`;
    const realIndex = currentIndex >= totalSlides ? 0 : currentIndex;
    counter.textContent = `${realIndex + 1} / ${totalSlides}`;
    dots.forEach((dot, i) => dot.classList.toggle('active', i === realIndex));
};

const nextSlide = () => { 
    currentIndex++; 
    updateGallery(); 
};

const prevSlide = () => {
    if (currentIndex <= 0) {
        currentIndex = totalSlides;
        updateGallery(false);
        requestAnimationFrame(() => { 
            currentIndex--; 
            updateGallery(); 
        });
    } else { 
        currentIndex--; 
        updateGallery(); 
    }
};

const restartAutoPlay = () => { 
    clearInterval(autoPlayTimer); 
    autoPlayTimer = setInterval(nextSlide, 4500); 
};

const stopAutoPlay = () => clearInterval(autoPlayTimer);

track.addEventListener('transitionend', () => {
    if (currentIndex === totalSlides) { 
        currentIndex = 0; 
        updateGallery(false); 
    }
});

dots.forEach((dot, i) => {
    dot.addEventListener('click', () => { 
        currentIndex = i; 
        updateGallery(); 
        restartAutoPlay(); 
    });
});

const galleryWindow = document.getElementById('galleryWindow');

galleryWindow.addEventListener('mouseenter', stopAutoPlay);
galleryWindow.addEventListener('mouseleave', restartAutoPlay);

// Touch events для галереї
galleryWindow.addEventListener('touchstart', (e) => {
    startX = e.touches[0].clientX; 
    currentX = startX; 
    isDragging = true; 
    dragOffset = 0;
    stopAutoPlay();
}, { passive: true });

galleryWindow.addEventListener('touchmove', (e) => {
    if (isDragging) {
        currentX = e.touches[0].clientX;
        dragOffset = currentX - startX;
        
        // Візуальний зворотний зв'язок при перетягуванні
        if (Math.abs(dragOffset) > 10) {
            const percentage = -(currentIndex * 100) + (dragOffset / galleryWindow.offsetWidth * 100);
            track.style.transition = 'none';
            track.style.transform = `translate3d(${percentage}%, 0, 0)`;
        }
    }
}, { passive: true });

galleryWindow.addEventListener('touchend', () => {
    if (!isDragging) return;
    isDragging = false;
    
    const diff = currentX - startX;
    if (Math.abs(diff) >= 45) { 
        if (diff < 0) {
            nextSlide();
        } else {
            prevSlide();
        }
    } else {
        // Повертаємось до поточного слайду
        updateGallery();
    }
    restartAutoPlay();
});

// Mouse events для галереї (desktop)
galleryWindow.addEventListener('mousedown', (e) => {
    startX = e.clientX;
    isDragging = true;
    stopAutoPlay();
});

document.addEventListener('mousemove', (e) => {
    if (isDragging && galleryWindow) {
        currentX = e.clientX;
        dragOffset = currentX - startX;
        
        if (Math.abs(dragOffset) > 10) {
            const percentage = -(currentIndex * 100) + (dragOffset / galleryWindow.offsetWidth * 100);
            track.style.transition = 'none';
            track.style.transform = `translate3d(${percentage}%, 0, 0)`;
        }
    }
});

document.addEventListener('mouseup', () => {
    if (isDragging) {
        const diff = currentX - startX;
        if (Math.abs(diff) >= 45) {
            if (diff < 0) {
                nextSlide();
            } else {
                prevSlide();
            }
        } else {
            updateGallery();
        }
        isDragging = false;
        restartAutoPlay();
    }
});

restartAutoPlay();

// ============ LIGHTBOX ============
const lightbox = document.getElementById('lightbox');
const lightboxImage = document.getElementById('lightboxImage');
const lightboxClose = document.getElementById('lightboxClose');
const lightboxPrev = document.getElementById('lightboxPrev');
const lightboxNext = document.getElementById('lightboxNext');
const lightboxCounter = document.getElementById('lightboxCounter');
const gallerySlides = [...document.querySelectorAll('.gallery-slide img')];

let lightboxIndex = 0;
let lightboxStartX = 0;
let lightboxCurrentX = 0;
let lightboxDragging = false;

const updateLightbox = () => {
    const realIndex = lightboxIndex % totalSlides;
    lightboxImage.src = gallerySlides[realIndex].src;
    lightboxImage.alt = gallerySlides[realIndex].alt;
    lightboxCounter.textContent = `${realIndex + 1} / ${totalSlides}`;
    
    // Анімація
    lightboxImage.style.transform = 'scale(0.95)';
    lightboxImage.style.opacity = '0.5';
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            lightboxImage.style.transform = 'scale(1)';
            lightboxImage.style.opacity = '1';
        });
    });
};

const openLightbox = (i) => {
    lightboxIndex = i;
    updateLightbox();
    lightbox.classList.add('active');
    body.style.overflow = 'hidden';
};

const closeLightbox = () => {
    lightbox.classList.remove('active');
    lightboxImage.style.transform = '';
    body.style.overflow = '';
};

const lightboxNextSlide = () => {
    lightboxIndex = (lightboxIndex + 1) % totalSlides;
    updateLightbox();
};

const lightboxPrevSlide = () => {
    lightboxIndex = (lightboxIndex - 1 + totalSlides) % totalSlides;
    updateLightbox();
};

gallerySlides.forEach((slide, i) => { 
    slide.addEventListener('click', () => openLightbox(i)); 
});

lightboxClose.addEventListener('click', closeLightbox);
lightboxNext.addEventListener('click', lightboxNextSlide);
lightboxPrev.addEventListener('click', lightboxPrevSlide);

lightbox.addEventListener('click', (e) => { 
    if (e.target === lightbox) closeLightbox(); 
});

// Touch events для lightbox (iOS стиль гортання)
lightbox.addEventListener('touchstart', (e) => {
    lightboxStartX = e.touches[0].clientX;
    lightboxCurrentX = lightboxStartX;
    lightboxDragging = true;
}, { passive: true });

lightbox.addEventListener('touchmove', (e) => {
    if (lightboxDragging) {
        lightboxCurrentX = e.touches[0].clientX;
        
        // Візуальний зворотний зв'язок
        const diff = lightboxCurrentX - lightboxStartX;
        if (Math.abs(diff) > 10) {
            lightboxImage.style.transform = `translateX(${diff * 0.3}px) scale(0.95)`;
            lightboxImage.style.opacity = '0.7';
        }
    }
}, { passive: true });

lightbox.addEventListener('touchend', () => {
    if (!lightboxDragging) return;
    lightboxDragging = false;
    
    const diff = lightboxCurrentX - lightboxStartX;
    
    // Скидаємо трансформацію
    lightboxImage.style.transform = '';
    lightboxImage.style.opacity = '';
    
    if (Math.abs(diff) >= 50) {
        if (diff < 0) {
            lightboxNextSlide();
        } else {
            lightboxPrevSlide();
        }
    } else {
        // Повертаємось до поточного зображення
        updateLightbox();
    }
});

// Keyboard events для lightbox
document.addEventListener('keydown', (e) => {
    if (lightbox.classList.contains('active')) {
        if (e.key === 'Escape') {
            closeLightbox();
        } else if (e.key === 'ArrowLeft') {
            lightboxPrevSlide();
        } else if (e.key === 'ArrowRight') {
            lightboxNextSlide();
        }
    }
});

// ============ МОДАЛЬНІ ВІКНА ============
const modalOrder = ['modalAbout', 'modalProcess', 'modalPrice', 'modalReviews'];

const updateProgress = (activeId) => {
    const activeIndex = modalOrder.indexOf(activeId);
    document.querySelectorAll('.modal-progress').forEach((progress) => {
        progress.querySelectorAll('.dot').forEach((dot, i) => {
            dot.classList.toggle('active', i === activeIndex);
        });
    });
};

const openModal = (id) => {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.classList.add('active');
    body.style.overflow = 'hidden';
    updateProgress(id);
};

const closeModal = (id) => {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.classList.remove('active');
    body.style.overflow = '';
};

// Глобальні функції для onclick в HTML
window.openModal = openModal;
window.closeModal = closeModal;

document.querySelectorAll('.widget-card').forEach((card) => {
    card.addEventListener('click', () => {
        if (typeof gtag === 'function') {
            gtag('event', 'card_open', {
                'event_category': 'cards',
                'event_label': card.dataset.modal
            });
        }
        const modalId = card.dataset.modal;
        if (modalId) openModal(modalId);
    });
    
    card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            const modalId = card.dataset.modal;
            if (modalId) openModal(modalId);
        }
    });
});

document.querySelectorAll('.modal-overlay').forEach((overlay) => {
    overlay.addEventListener('click', (e) => { 
        if (e.target === overlay) closeModal(overlay.id); 
    });
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const open = document.querySelector('.modal-overlay.active');
        if (open) closeModal(open.id);
    }
});

document.querySelectorAll('.modal-nav-arrow').forEach((arrow) => {
    arrow.addEventListener('click', () => {
        const overlay = arrow.closest('.modal-overlay');
        const direction = arrow.dataset.direction;
        const currentIndex = modalOrder.indexOf(overlay.id);
        
        let targetIndex;
        if (direction === 'next') {
            targetIndex = Math.min(currentIndex + 1, modalOrder.length - 1);
        } else {
            targetIndex = Math.max(currentIndex - 1, 0);
        }
        
        const targetId = modalOrder[targetIndex];
        if (targetId !== overlay.id) {
            closeModal(overlay.id);
            setTimeout(() => openModal(targetId), 300);
        }
    });
});

// Touch events для модальних вікон
document.querySelectorAll('.modal-box').forEach((box) => {
    let startX = 0;
    let startY = 0;
    let isHorizontal = false;
    
    box.addEventListener('touchstart', (e) => {
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        isHorizontal = false;
    }, { passive: true });
    
    box.addEventListener('touchmove', (e) => {
        const diffX = Math.abs(e.touches[0].clientX - startX);
        const diffY = Math.abs(e.touches[0].clientY - startY);
        if (diffX > 30 && diffX > diffY) isHorizontal = true;
    }, { passive: true });
    
    box.addEventListener('touchend', (e) => {
        if (!isHorizontal) {
            const diffY = e.changedTouches[0].clientY - startY;
            if (diffY > 100 && box.scrollTop === 0) {
                const overlay = box.closest('.modal-overlay');
                closeModal(overlay.id);
            }
            return;
        }
        
        const diff = startX - e.changedTouches[0].clientX;
        if (Math.abs(diff) > 80) {
            const overlay = box.closest('.modal-overlay');
            const currentIndex = modalOrder.indexOf(overlay.id);
            
            let targetIndex;
            if (diff > 0) {
                targetIndex = Math.min(currentIndex + 1, modalOrder.length - 1);
            } else {
                targetIndex = Math.max(currentIndex - 1, 0);
            }
            
            const targetId = modalOrder[targetIndex];
            if (targetId !== overlay.id) {
                closeModal(overlay.id);
                setTimeout(() => openModal(targetId), 300);
            }
        }
    });
});

// ============ КАЛЬКУЛЯТОР ============
const calcState = { bathrooms: 1, system: 'tee' };
const calcPrices = { '1-tee': 160000, '1-radial': 240000, '2-tee': 340000, '2-radial': 420000 };
const calcPriceElement = document.getElementById('calcPrice');

const updateCalc = () => {
    const key = `${calcState.bathrooms}-${calcState.system}`;
    const total = calcPrices[key] || 160000;
    calcPriceElement.textContent = `${total.toLocaleString('uk-UA')} грн`;
};

document.querySelectorAll('.calc-seg-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
        if (typeof gtag === 'function') {
            gtag('event', 'calc_button', {
                'event_category': 'calculator',
                'event_label': btn.dataset.group + '_' + btn.dataset.value
            });
        }
        const group = btn.dataset.group;
        const value = btn.dataset.value;
        if (group === 'bathrooms') calcState.bathrooms = parseInt(value);
        else if (group === 'system') calcState.system = value;
        
        document.querySelectorAll(`.calc-seg-btn[data-group="${group}"]`).forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        updateCalc();
    });
});

if (calcPriceElement) updateCalc();

const calcPayBtn = document.getElementById('calcPayBtn');
const calcTelegramBtn = document.getElementById('calcTelegramBtn');

calcPayBtn.addEventListener('click', () => {
    if (typeof gtag === 'function') {
        gtag('event', 'pay_button', {
            'event_category': 'calculator',
            'event_label': 'pay_consultation'
        });
    }
    openModal('modalPayment');
});

const paymentModal = document.getElementById('modalPayment');

paymentModal.addEventListener('click', (e) => {
    if (e.target === paymentModal) {
        closeModal('modalPayment');
        calcTelegramBtn.style.display = 'flex';
        calcPayBtn.style.display = 'none';
    }
});

document.querySelector('#modalPayment .modal-close').addEventListener('click', () => {
    closeModal('modalPayment');
    calcTelegramBtn.style.display = 'flex';
    calcPayBtn.style.display = 'none';
});

calcTelegramBtn.addEventListener('click', () => {
    if (typeof gtag === 'function') {
        gtag('event', 'telegram_send', {
            'event_category': 'calculator',
            'event_label': 'send_project'
        });
    }
    const message = encodeURIComponent('Добрий день! Я оплатив консультацію та детальний прорахунок вартості робіт. Надсилаю проєкт та чек про оплату.');
    window.open(`https://t.me/sa_master?text=${message}`, '_blank');
});

// ============ ВІДГУКИ ============
document.querySelector('.review-google-btn').addEventListener('click', () => {
    if (typeof gtag === 'function') {
        gtag('event', 'google_review', {
            'event_category': 'reviews',
            'event_label': 'google_review_button'
        });
    }
});

// ============ СОЦІАЛЬНИЙ ДОК ============
const socialTrack = document.getElementById('socialTrack');
const socialDots = [...document.querySelectorAll('.ios-social-page-dot')];
const socialViewport = document.getElementById('socialViewport');
let socialPage = 0;
let socialStartX = 0;
let socialCurrentX = 0;
let socialDragging = false;

const updateSocial = (page, animate = true) => {
    socialPage = Math.max(0, Math.min(1, page));
    socialTrack.style.transition = animate ? 'transform 0.48s cubic-bezier(0.22, 0.61, 0.36, 1)' : 'none';
    socialTrack.style.transform = `translate3d(-${socialPage * 50}%, 0, 0)`;
    socialDots.forEach((dot, i) => dot.classList.toggle('active', i === socialPage));
};

socialViewport.addEventListener('touchstart', (e) => {
    socialStartX = e.touches[0].clientX; 
    socialCurrentX = socialStartX; 
    socialDragging = true;
}, { passive: true });

socialViewport.addEventListener('touchmove', (e) => {
    if (socialDragging) socialCurrentX = e.touches[0].clientX;
}, { passive: true });

socialViewport.addEventListener('touchend', () => {
    if (!socialDragging) return;
    socialDragging = false;
    const diff = socialCurrentX - socialStartX;
    if (Math.abs(diff) < 45) return;
    updateSocial(diff < 0 ? socialPage + 1 : socialPage - 1);
});

// ============ ІНІЦІАЛІЗАЦІЯ ============
document.addEventListener('DOMContentLoaded', () => {
    const yearSpan = document.getElementById('currentYear');
    if (yearSpan) yearSpan.textContent = new Date().getFullYear();
});
