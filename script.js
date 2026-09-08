// Тема
const toggleBtn=document.getElementById('themeToggle'),body=document.body,
getInitialTheme=()=>{const s=localStorage.getItem('theme');if(s)return s;return window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'};
if(getInitialTheme()==='dark')body.classList.add('dark-mode');
toggleBtn.addEventListener('click',()=>{body.classList.toggle('dark-mode');localStorage.setItem('theme',body.classList.contains('dark-mode')?'dark':'light')});

// Галерея
const track=document.getElementById('galleryTrack'),dots=[...document.querySelectorAll('.gallery-dot')],counter=document.getElementById('galleryCounter'),totalSlides=8;
let currentIndex=0,autoPlayTimer,isDragging=false,startX=0,currentX=0;
const updateGallery=(animate=true)=>{track.style.transition=animate?'transform .5s cubic-bezier(.22,.61,.36,1)':'none';track.style.transform=`translate3d(-${currentIndex*100}%,0,0)`;const realIndex=currentIndex>=totalSlides?0:currentIndex;counter.textContent=`${realIndex+1} / ${totalSlides}`;dots.forEach((dot,i)=>dot.classList.toggle('active',i===realIndex))};
const nextSlide=()=>{currentIndex++;updateGallery()};
const prevSlide=()=>{if(currentIndex<=0){currentIndex=totalSlides;updateGallery(false);requestAnimationFrame(()=>{currentIndex--;updateGallery()})}else{currentIndex--;updateGallery()}};
const restartAutoPlay=()=>{clearInterval(autoPlayTimer);autoPlayTimer=setInterval(nextSlide,4500)};
const stopAutoPlay=()=>clearInterval(autoPlayTimer);
track.addEventListener('transitionend',()=>{if(currentIndex===totalSlides){currentIndex=0;updateGallery(false)}});
dots.forEach((dot,i)=>{dot.addEventListener('click',()=>{currentIndex=i;updateGallery();restartAutoPlay()})});
const galleryWindow=document.getElementById('galleryWindow');
galleryWindow.addEventListener('mouseenter',stopAutoPlay);
galleryWindow.addEventListener('mouseleave',restartAutoPlay);
galleryWindow.addEventListener('touchstart',(e)=>{startX=e.touches[0].clientX;currentX=startX;isDragging=true;stopAutoPlay()},{passive:true});
galleryWindow.addEventListener('touchmove',(e)=>{if(isDragging)currentX=e.touches[0].clientX},{passive:true});
galleryWindow.addEventListener('touchend',()=>{if(!isDragging)return;isDragging=false;const diff=currentX-startX;if(Math.abs(diff)>=45){diff<0?nextSlide():prevSlide()}restartAutoPlay()});
restartAutoPlay();

// Lightbox
const lightbox=document.getElementById('lightbox'),lightboxImage=document.getElementById('lightboxImage'),lightboxClose=document.getElementById('lightboxClose'),lightboxPrev=document.getElementById('lightboxPrev'),lightboxNext=document.getElementById('lightboxNext'),lightboxCounter=document.getElementById('lightboxCounter'),gallerySlides=[...document.querySelectorAll('.gallery-slide img')];
let lightboxCurrentIndex=0,lightboxTouchStartX=0,lightboxTouchEndX=0;
const updateLightboxImage=()=>{lightboxImage.src=gallerySlides[lightboxCurrentIndex].src;lightboxImage.alt=gallerySlides[lightboxCurrentIndex].alt;lightboxCounter.textContent=`${lightboxCurrentIndex+1} / ${totalSlides}`};
const openLightbox=(i)=>{lightboxCurrentIndex=Math.max(0,Math.min(totalSlides-1,i));updateLightboxImage();lightboxImage.style.transform='scale(.95)';lightbox.classList.add('active');body.style.overflow='hidden';requestAnimationFrame(()=>{requestAnimationFrame(()=>{lightboxImage.style.transform='scale(1)'})})};
const closeLightbox=()=>{lightbox.classList.remove('active');lightboxImage.style.transform='';body.style.overflow=''};
const goToPrevSlide=()=>{lightboxCurrentIndex=(lightboxCurrentIndex-1+totalSlides)%totalSlides;updateLightboxImage()};
const goToNextSlide=()=>{lightboxCurrentIndex=(lightboxCurrentIndex+1)%totalSlides;updateLightboxImage()};
gallerySlides.forEach((slide,i)=>{slide.addEventListener('click',()=>openLightbox(i))});
lightboxClose.addEventListener('click',closeLightbox);
lightboxPrev.addEventListener('click',goToPrevSlide);
lightboxNext.addEventListener('click',goToNextSlide);
lightbox.addEventListener('click',(e)=>{if(e.target===lightbox)closeLightbox()});
lightbox.addEventListener('touchstart',(e)=>{lightboxTouchStartX=e.touches[0].clientX;lightboxTouchEndX=e.touches[0].clientX},{passive:true});
lightbox.addEventListener('touchmove',(e)=>{lightboxTouchEndX=e.touches[0].clientX},{passive:true});
lightbox.addEventListener('touchend',()=>{const d=lightboxTouchEndX-lightboxTouchStartX;if(Math.abs(d)>50){d>0?goToPrevSlide():goToNextSlide()}});
document.addEventListener('keydown',(e)=>{if(!lightbox.classList.contains('active'))return;if(e.key==='Escape')closeLightbox();else if(e.key==='ArrowLeft')goToPrevSlide();else if(e.key==='ArrowRight')goToNextSlide()});

// Модальні вікна
const modalOrder=['modalAbout','modalProcess','modalPrice','modalReviews'];
const updateProgress=(activeId)=>{const idx=modalOrder.indexOf(activeId);document.querySelectorAll('.modal-progress').forEach(p=>{p.querySelectorAll('.dot').forEach((d,i)=>d.classList.toggle('active',i===idx))})};
const openModal=(id)=>{const m=document.getElementById(id);if(!m)return;m.classList.add('active');body.style.overflow='hidden';updateProgress(id)};
const closeModal=(id)=>{const m=document.getElementById(id);if(!m)return;m.classList.remove('active');body.style.overflow=''};
window.openModal=openModal;window.closeModal=closeModal;
document.querySelectorAll('.widget-card').forEach(card=>{
    card.addEventListener('click',()=>{if(typeof gtag==='function'){gtag('event','card_open',{event_category:'cards',event_label:card.dataset.modal})}const id=card.dataset.modal;if(id)openModal(id)});
    card.addEventListener('keydown',(e)=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();const id=card.dataset.modal;if(id)openModal(id)}})
});
document.querySelectorAll('.modal-overlay').forEach(o=>{o.addEventListener('click',(e)=>{if(e.target===o)closeModal(o.id)})});
document.addEventListener('keydown',(e)=>{if(e.key==='Escape'){const open=document.querySelector('.modal-overlay.active');if(open)closeModal(open.id)}});
document.querySelectorAll('.modal-nav-arrow').forEach(arrow=>{
    arrow.addEventListener('click',()=>{
        const overlay=arrow.closest('.modal-overlay'),direction=arrow.dataset.direction,idx=modalOrder.indexOf(overlay.id);
        let targetIdx;if(direction==='next')targetIdx=Math.min(idx+1,modalOrder.length-1);else targetIdx=Math.max(idx-1,0);
        const targetId=modalOrder[targetIdx];if(targetId!==overlay.id){closeModal(overlay.id);setTimeout(()=>openModal(targetId),300)}
    })
});
document.querySelectorAll('.modal-box').forEach(box=>{
    let sx=0,sy=0,isH=false;
    box.addEventListener('touchstart',(e)=>{sx=e.touches[0].clientX;sy=e.touches[0].clientY;isH=false},{passive:true});
    box.addEventListener('touchmove',(e)=>{const dx=Math.abs(e.touches[0].clientX-sx),dy=Math.abs(e.touches[0].clientY-sy);if(dx>30&&dx>dy)isH=true},{passive:true});
    box.addEventListener('touchend',(e)=>{
        if(!isH)return;
        const d=sx-e.changedTouches[0].clientX;
        if(Math.abs(d)>80){
            const overlay=box.closest('.modal-overlay'),idx=modalOrder.indexOf(overlay.id);
            if(idx===-1)return;
            let targetIdx;if(d>0)targetIdx=Math.min(idx+1,modalOrder.length-1);else targetIdx=Math.max(idx-1,0);
            const targetId=modalOrder[targetIdx];if(targetId!==overlay.id){closeModal(overlay.id);setTimeout(()=>openModal(targetId),300)}
        }
    })
});

// Калькулятор
const calcState={bathrooms:1,system:'tee'},calcPrices={'1-tee':160000,'1-radial':240000,'2-tee':340000,'2-radial':420000},calcPriceElement=document.getElementById('calcPrice');
const updateCalc=()=>{const key=`${calcState.bathrooms}-${calcState.system}`,total=calcPrices[key]||160000;calcPriceElement.textContent=`${total.toLocaleString('uk-UA')} грн`};
document.querySelectorAll('.calc-seg-btn').forEach(btn=>{
    btn.addEventListener('click',()=>{
        if(typeof gtag==='function'){gtag('event','calc_button',{event_category:'calculator',event_label:btn.dataset.group+'_'+btn.dataset.value})}
        const group=btn.dataset.group,value=btn.dataset.value;
        if(group==='bathrooms')calcState.bathrooms=parseInt(value);else if(group==='system')calcState.system=value;
        document.querySelectorAll(`.calc-seg-btn[data-group="${group}"]`).forEach(b=>b.classList.remove('active'));
        btn.classList.add('active');updateCalc()
    })
});
if(calcPriceElement)updateCalc();
const calcPayBtn=document.getElementById('calcPayBtn'),calcTelegramBtn=document.getElementById('calcTelegramBtn');
calcPayBtn.addEventListener('click',()=>{if(typeof gtag==='function'){gtag('event','pay_button',{event_category:'calculator',event_label:'pay_consultation'})}openModal('modalPayment')});
const paymentModal=document.getElementById('modalPayment');
paymentModal.addEventListener('click',(e)=>{if(e.target===paymentModal){closeModal('modalPayment');calcTelegramBtn.style.display='flex';calcPayBtn.style.display='none'}});
document.querySelector('#modalPayment .modal-close').addEventListener('click',()=>{closeModal('modalPayment');calcTelegramBtn.style.display='flex';calcPayBtn.style.display='none'});
calcTelegramBtn.addEventListener('click',()=>{if(typeof gtag==='function'){gtag('event','telegram_send',{event_category:'calculator',event_label:'send_project'})}const msg=encodeURIComponent('Добрий день! Я оплатив консультацію та детальний прорахунок вартості робіт. Надсилаю проєкт та чек про оплату.');window.open(`https://t.me/sa_master?text=${msg}`,'_blank')});
document.querySelector('.review-google-btn').addEventListener('click',()=>{if(typeof gtag==='function'){gtag('event','google_review',{event_category:'reviews',event_label:'google_review_button'})}});

// Соціальні кнопки
const socialTrack=document.getElementById('socialTrack'),socialDots=[...document.querySelectorAll('.ios-social-page-dot')],socialViewport=document.getElementById('socialViewport');
let socialPage=0,socialStartX=0,socialCurrentX=0,socialDragging=false;
const updateSocial=(page,animate=true)=>{socialPage=Math.max(0,Math.min(1,page));socialTrack.style.transition=animate?'transform .48s cubic-bezier(.22,.61,.36,1)':'none';socialTrack.style.transform=`translate3d(-${socialPage*50}%,0,0)`;socialDots.forEach((d,i)=>d.classList.toggle('active',i===socialPage))};
socialViewport.addEventListener('touchstart',(e)=>{socialStartX=e.touches[0].clientX;socialCurrentX=socialStartX;socialDragging=true},{passive:true});
socialViewport.addEventListener('touchmove',(e)=>{if(socialDragging)socialCurrentX=e.touches[0].clientX},{passive:true});
socialViewport.addEventListener('touchend',()=>{if(!socialDragging)return;socialDragging=false;const d=socialCurrentX-socialStartX;if(Math.abs(d)<45)return;updateSocial(d<0?socialPage+1:socialPage-1)});
setTimeout(()=>{socialTrack.classList.add('social-hint');setTimeout(()=>socialTrack.classList.remove('social-hint'),1100)},900);
document.addEventListener('DOMContentLoaded',()=>{const y=document.getElementById('currentYear');if(y)y.textContent=new Date().getFullYear()});
