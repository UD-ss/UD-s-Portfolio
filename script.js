document.addEventListener("DOMContentLoaded", () => {


    lucide.createIcons();


    const lenis = new Lenis({
        duration: 1.2,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        orientation: 'vertical',
        gestureOrientation: 'vertical',
        smoothWheel: true,
        wheelMultiplier: 1,
        smoothTouch: false,
        touchMultiplier: 2,
    });

    function raf(time) {
        lenis.raf(time);
        requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);


    gsap.registerPlugin(ScrollTrigger);

    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => { lenis.raf(time * 1000); });
    gsap.ticker.lagSmoothing(0);


    const preloader = document.getElementById('preloader');
    function finishPreloader() {
        if (!preloader.classList.contains('loaded')) {
            preloader.classList.add('loaded');
            const nav = document.getElementById('nav');
            if (nav) nav.style.opacity = '1';
            initHeroAnimations();
        }
    }
    window.addEventListener('load', () => setTimeout(finishPreloader, 2000));
    if (document.readyState === 'complete') setTimeout(finishPreloader, 2000);


    const cursor = document.getElementById('cursor');
    const cursorDot = document.getElementById('cursor-dot');
    const cursorRing = document.getElementById('cursor-ring');

    if (window.matchMedia('(hover: hover)').matches && cursor) {
        let mouseX = 0, mouseY = 0;
        let dotX = 0, dotY = 0;
        let ringX = 0, ringY = 0;

        document.addEventListener('mousemove', (e) => {
            mouseX = e.clientX;
            mouseY = e.clientY;
        });

        function updateCursor() {
            dotX += (mouseX - dotX) * 0.2;
            dotY += (mouseY - dotY) * 0.2;
            cursorDot.style.transform = `translate(${dotX - 4}px, ${dotY - 4}px)`;

            ringX += (mouseX - ringX) * 0.08;
            ringY += (mouseY - ringY) * 0.08;
            cursorRing.style.transform = `translate(${ringX - 20}px, ${ringY - 20}px)`;

            requestAnimationFrame(updateCursor);
        }
        updateCursor();

        const hoverTargets = document.querySelectorAll('.cursor-hover-target, a, button');
        hoverTargets.forEach((el) => {
            el.addEventListener('mouseenter', () => cursor.classList.add('hovering'));
            el.addEventListener('mouseleave', () => cursor.classList.remove('hovering'));
        });
    }


    const themeToggle = document.getElementById('theme-toggle');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const savedTheme = localStorage.getItem('ud-theme') || (prefersDark ? 'dark' : 'light');
    document.body.setAttribute('data-theme', savedTheme);


    const API_LOG = "/api/log";

    function sendLog(type, data) {
        try {
            const payload = JSON.stringify({ type: type, data: data, page: location.pathname, ts: Date.now() });
            if (navigator.sendBeacon) {
                navigator.sendBeacon(API_LOG, new Blob([payload], { type: 'application/json' }));
            } else {
                fetch(API_LOG, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload, keepalive: true }).catch(() => {});
            }
        } catch (e) {}
    }

    if (!sessionStorage.getItem('ud-logged')) {
        sessionStorage.setItem('ud-logged', '1');
        sendLog('visit', {
            theme: document.body.getAttribute('data-theme'),
            referrer: document.referrer,
            screen: window.screen.width + 'x' + window.screen.height
        });
    }

    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            const current = document.body.getAttribute('data-theme') || 'light';
            const next = current === 'dark' ? 'light' : 'dark';
            document.body.setAttribute('data-theme', next);
            localStorage.setItem('ud-theme', next);
            sendLog('theme', { from: current, to: next });
        });
    }


    function initHeroAnimations() {
        const names = ["UD", "ユーディー", "유디"];
        let nameIndex = 0;
        const heroName = document.getElementById('hero-name');

        if (heroName) {
            gsap.fromTo(heroName, { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 1.2, ease: "power3.out" });

            setInterval(() => {
                gsap.to(heroName, {
                    y: -15,
                    opacity: 0,
                    duration: 0.5,
                    ease: "power2.in",
                    onComplete: () => {
                        nameIndex = (nameIndex + 1) % names.length;
                        heroName.innerText = names[nameIndex];
                        gsap.fromTo(heroName,
                            { y: 15, opacity: 0 },
                            { y: 0, opacity: 1, duration: 0.6, ease: "power2.out" }
                        );
                    }
                });
            }, 3500);
        }

        const heroSubtitle = document.getElementById('hero-subtitle');
        if (heroSubtitle) {
            const split = new SplitType(heroSubtitle, { types: 'words' });
            gsap.from(split.words, {
                y: 15,
                opacity: 0,
                duration: 0.8,
                stagger: 0.04,
                ease: "power3.out",
                delay: 0.4
            });
        }
    }


    const aboutContent = document.getElementById('about-content');
    const highlightLine = document.querySelector('.highlight-line');

    if (aboutContent) {
        gsap.from(aboutContent, {
            scrollTrigger: {
                trigger: aboutContent,
                start: "top 80%",
                toggleActions: "play none none reverse",
                onEnter: () => {
                    if (highlightLine) highlightLine.classList.add('active');
                },
                onLeaveBack: () => {
                    if (highlightLine) highlightLine.classList.remove('active');
                }
            },
            y: 35,
            opacity: 0,
            duration: 0.9,
            ease: "power3.out"
        });
    }


    const skillCards = document.querySelectorAll('.skill-card');
    skillCards.forEach((card) => {
        const inner = card.querySelector('.skill-card-inner');
        const glow = card.querySelector('.skill-card-glow');
        const color = card.dataset.color || '#0055ff';

        if (glow) {
            glow.style.setProperty('--glow-color', color + '15');
            glow.style.background = `radial-gradient(circle, ${color}15, transparent 70%)`;
        }

        card.addEventListener('mousemove', (e) => {
            const rect = inner.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            if (glow) {
                glow.style.left = x + 'px';
                glow.style.top = y + 'px';
            }
        });

        gsap.from(card, {
            scrollTrigger: {
                trigger: card,
                start: "top 85%",
                toggleActions: "play none none reverse"
            },
            y: 40,
            opacity: 0,
            duration: 0.8,
            ease: "power2.out"
        });
    });


    const projectsSection = document.getElementById('projects');
    const horizonTrack = document.querySelector('.horizontal-scroll');
    let projectStepHandler = null;

    if (projectsSection && horizonTrack) {
        const panelStepX = () => {
            const margin = window.innerWidth >= 768 ? 100 : 24;
            const panels = Array.from(horizonTrack.querySelectorAll('.panel'));
            return panels.map((p) => margin - p.offsetLeft);
        };
        const minX = () => Math.min(0, ...panelStepX());

        let playing = false;

        ScrollTrigger.create({
            trigger: projectsSection,
            start: "top 55%",
            once: true,
            onEnter: () => {
                const steps = panelStepX();
                if (steps.length < 3) return;
                playing = true;
                gsap.timeline({ onComplete: () => { playing = false; } })
                    .to(horizonTrack, { x: steps[1], duration: 1.1, ease: "power3.inOut" })
                    .to(horizonTrack, { x: steps[2], duration: 1.1, ease: "power3.inOut" })
                    .to(horizonTrack, { x: steps[0], duration: 1.2, ease: "power3.inOut" });
            }
        });

        let isDragging = false;
        let dragStartClientX = 0;
        let dragBaseX = 0;

        horizonTrack.addEventListener('pointerdown', (e) => {
            if (playing) return;
            isDragging = true;
            dragStartClientX = e.clientX;
            dragBaseX = gsap.getProperty(horizonTrack, 'x');
            horizonTrack.setPointerCapture(e.pointerId);
            horizonTrack.classList.add('is-dragging');
            gsap.killTweensOf(horizonTrack);
        });

        horizonTrack.addEventListener('pointermove', (e) => {
            if (!isDragging) return;
            const next = Math.max(Math.min(dragBaseX + e.clientX - dragStartClientX, 0), minX());
            gsap.set(horizonTrack, { x: next });
        });

        const endDrag = () => {
            if (!isDragging) return;
            isDragging = false;
            horizonTrack.classList.remove('is-dragging');
            const x = gsap.getProperty(horizonTrack, 'x');
            let nearest = 0;
            let minD = Infinity;
            panelStepX().forEach((s) => {
                const d = Math.abs(x - s);
                if (d < minD) { minD = d; nearest = s; }
            });
            gsap.to(horizonTrack, { x: nearest, duration: 0.7, ease: "power3.out" });
        };

        horizonTrack.addEventListener('pointerup', endDrag);
        horizonTrack.addEventListener('pointercancel', endDrag);

        const stepProject = (dir) => {
            if (playing) return;
            const steps = panelStepX();
            if (steps.length < 2) return;
            const baseX = gsap.getProperty(horizonTrack, 'x');
            let idx = 0;
            let minD = Infinity;
            steps.forEach((s, i) => {
                const d = Math.abs(baseX - s);
                if (d < minD) { minD = d; idx = i; }
            });
            const next = Math.min(steps.length - 1, Math.max(0, idx + dir));
            if (next === idx) return;
            gsap.to(horizonTrack, { x: steps[next], duration: 0.7, ease: "power3.out" });
        };
        projectStepHandler = stepProject;
    }


    const projectItems = document.querySelectorAll('.project-list-item');
    projectItems.forEach((item, i) => {
        gsap.from(item, {
            scrollTrigger: {
                trigger: item,
                start: "top 90%",
                toggleActions: "play none none reverse"
            },
            y: 30,
            opacity: 0,
            duration: 0.7,
            delay: i * 0.05,
            ease: "power2.out"
        });
    });


    const magneticItems = document.querySelectorAll('.magnetic-wrap');
    magneticItems.forEach((wrap) => {
        const inner = wrap.querySelector('.magnetic-inner');
        if (!inner) return;

        wrap.addEventListener('mousemove', (e) => {
            const rect = wrap.getBoundingClientRect();
            const x = (e.clientX - rect.left - rect.width / 2) * 0.35;
            const y = (e.clientY - rect.top - rect.height / 2) * 0.35;

            gsap.to(inner, {
                x: x,
                y: y,
                duration: 0.4,
                ease: "power2.out"
            });
        });

        wrap.addEventListener('mouseleave', () => {
            gsap.to(inner, {
                x: 0,
                y: 0,
                duration: 0.8,
                ease: "elastic.out(1, 0.3)"
            });
        });
    });


    const progressFill = document.getElementById('progress-fill');
    const progressDot = document.getElementById('progress-dot');
    function updateProgress(step) {
        const total = snapTargets.length - 1;
        if (total > 0) {
            const pct = (step / total) * 100;
            if (progressFill) progressFill.style.height = pct + '%';
            if (progressDot) progressDot.style.top = pct + '%';
        }
    }


    let snapTargets = [];

    function computeSnapTargets() {
        const targets = [];


        targets.push(0);


        const about = document.getElementById('about');
        if (about) targets.push(about.offsetTop);


        const skills = document.getElementById('skills');
        if (skills) targets.push(skills.offsetTop);


        const ht = ScrollTrigger.getById('horizontal-pin');
        if (ht) {
            targets.push(ht.start);
            targets.push(ht.start + (ht.end - ht.start) * 0.5);
            targets.push(ht.end);
        } else {
            const projects = document.getElementById('projects');
            if (projects) targets.push(projects.offsetTop);
        }


        const more = document.getElementById('more-projects');
        if (more) targets.push(more.offsetTop);


        const contact = document.getElementById('contact');
        if (contact) targets.push(contact.offsetTop);

        snapTargets = [...new Set(targets)].sort((a, b) => a - b);
    }

    function getSnapTargets() {
        if (!snapTargets.length) computeSnapTargets();
        return snapTargets;
    }

    let currentStep = 0;
    let isLocked = false;
    let lockTimer = null;

    const WHEEL_STEP_THRESHOLD = 170;
    const WHEEL_NOTCH_DELTA = 75;
    const BUFFER_DECAY_MS = 260;
    let wheelBuffer = 0;
    let lastWheelAt = 0;

    function goToStep(stepIndex) {
        const targets = getSnapTargets();
        if (stepIndex < 0) stepIndex = 0;
        if (stepIndex >= targets.length) stepIndex = targets.length - 1;

        currentStep = stepIndex;
        updateProgress(stepIndex);
        isLocked = true;
        clearTimeout(lockTimer);

        lenis.scrollTo(targets[stepIndex], {
            duration: 1.1,
            easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
            force: true,
            onComplete: () => {
                clearTimeout(lockTimer);
                lockTimer = setTimeout(() => { isLocked = false; }, 120);
            }
        });
    }


    window.addEventListener('wheel', (e) => {
        e.preventDefault();
        e.lenisStopPropagation = true;

        if (projectStepHandler && e.target.closest && e.target.closest('.horizontal-pin-wrap') && Math.abs(e.deltaX) > Math.abs(e.deltaY) && Math.abs(e.deltaX) > 20) {
            projectStepHandler(e.deltaX > 0 ? 1 : -1);
            return;
        }

        if (skillPopupOpen) { wheelBuffer = 0; return; }

        const now = performance.now();
        const dt = Math.max(now - lastWheelAt, 0);
        lastWheelAt = now;

        if (Math.abs(e.deltaY) < 4) return;

        const threshold = isLocked ? WHEEL_STEP_THRESHOLD * 0.55 : WHEEL_STEP_THRESHOLD;

        if (Math.abs(e.deltaY) >= WHEEL_NOTCH_DELTA) {
            wheelBuffer = 0;
            goToStep(e.deltaY > 0 ? currentStep + 1 : currentStep - 1);
            return;
        }

        wheelBuffer = wheelBuffer * Math.exp(-dt / BUFFER_DECAY_MS) + e.deltaY;
        wheelBuffer = Math.max(-900, Math.min(900, wheelBuffer));

        if (Math.abs(wheelBuffer) >= threshold) {
            const dir = wheelBuffer > 0 ? 1 : -1;
            wheelBuffer = 0;
            goToStep(currentStep + dir);
        }
    }, { passive: false, capture: true });


    window.addEventListener('keydown', (e) => {
        if (skillPopupOpen) return;
        if (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ') {
            e.preventDefault();
            if (e.repeat) return;
            goToStep(currentStep + 1);
        } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
            e.preventDefault();
            if (e.repeat) return;
            goToStep(currentStep - 1);
        }
    });


    let touchY = 0;
    window.addEventListener('touchstart', (e) => {
        touchY = e.touches[0].clientY;
    }, { passive: true });

    window.addEventListener('touchend', (e) => {
        if (skillPopupOpen) return;
        const diff = touchY - e.changedTouches[0].clientY;
        if (Math.abs(diff) > 40) {
            if (diff > 0) {
                goToStep(currentStep + 1);
            } else {
                goToStep(currentStep - 1);
            }
        }
    }, { passive: true });


    const navStepMap = {
        '#hero': 0,
        '#about': 1,
        '#skills': 2,
        '#projects': 3,
        '#more-projects': 6,
        '#contact': 7
    };
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', (e) => {
            e.preventDefault();
            const href = anchor.getAttribute('href');
            if (navStepMap.hasOwnProperty(href)) {
                goToStep(navStepMap[href]);
            } else {
                const target = document.querySelector(href);
                if (target) lenis.scrollTo(target, { duration: 1.0 });
            }
        });
    });


    lenis.on('scroll', ({ scroll }) => {
        if (!isLocked) {
            const targets = getSnapTargets();
            let closest = 0;
            let minD = Math.abs(scroll - targets[0]);
            for (let i = 1; i < targets.length; i++) {
                const d = Math.abs(scroll - targets[i]);
                if (d < minD) {
                    minD = d;
                    closest = i;
                }
            }
            currentStep = closest;
            updateProgress(closest);
        }
    });


    ScrollTrigger.addEventListener('refresh', () => { snapTargets = []; });
    window.addEventListener('resize', () => { snapTargets = []; });

    let skillPopupSourceRect = null;
    let skillPopupCardPositions = [];
    let skillPopupItemRestore = [];
    let skillPopupTl = null;
    let skillPopupOpen = false;

    function addMorphMask(tl, el, at, turnOn) {
        const kids = Array.from(el.children);
        tl.to(kids, { opacity: 0, duration: 0.08, ease: 'power1.in' }, at);
        tl.add(() => el.classList.toggle('popup-tile-mode', turnOn), at + 0.09);
        tl.to(kids, { opacity: 1, duration: 0.22, ease: 'power1.out' }, at + 0.11);
    }

    document.querySelectorAll('.skill-card').forEach(card => {
        card.addEventListener('click', (e) => {
            if (e.target.closest('#skillClose')) return;
            if (skillPopupOpen) return;
            const overlay = document.getElementById('skillOverlay');
            const popup = document.getElementById('skillPopup');
            const popupContent = document.getElementById('skillPopupContent');
            const items = card.querySelectorAll('.skill-item');

            const cardRect = card.getBoundingClientRect();
            skillPopupSourceRect = { x: cardRect.left, y: cardRect.top, width: cardRect.width, height: cardRect.height };

            const cardItems = Array.from(items);
            cardItems.forEach(el => {
                if (el.querySelector('.skill-label')) return;
                const labelSpan = document.createElement('span');
                labelSpan.className = 'skill-label';
                let anchor = null;
                for (const n of Array.from(el.childNodes)) {
                    if (n.nodeType === Node.ELEMENT_NODE) { anchor = n; break; }
                }
                if (anchor) {
                    let sib = anchor.nextSibling;
                    while (sib) {
                        const next = sib.nextSibling;
                        labelSpan.appendChild(sib);
                        sib = next;
                    }
                    el.appendChild(labelSpan);
                }
            });
            skillPopupCardPositions = cardItems.map(it => {
                const r = it.getBoundingClientRect();
                return { x: r.left - cardRect.left, y: r.top - cardRect.top, w: r.width, h: r.height };
            });
            skillPopupItemRestore = cardItems.map(it => ({ parent: it.parentNode, next: it.nextSibling }));

            let slotsHTML = '<div class="popup-grid">';
            cardItems.forEach(() => { slotsHTML += '<div class="popup-slot"></div>'; });
            slotsHTML += '</div>';

            popupContent.innerHTML = `
                <div class="flex items-center justify-between mb-6 pr-10">
                    <h3 class="text-sm font-display font-semibold uppercase tracking-wider">${card.querySelector('h3').textContent}</h3>
                    <span class="text-xs text-muted-light font-light">${card.querySelector('.text-xs').textContent}</span>
                </div>
                ${slotsHTML}
            `;

            const finalW = Math.min(window.innerWidth * 0.45, window.innerHeight * 0.75, 960);
            gsap.set(popup, {
                visibility: 'visible',
                left: 0,
                top: 0,
                xPercent: 0,
                yPercent: 0,
                x: cardRect.left,
                y: cardRect.top,
                width: finalW,
                height: 'auto',
                opacity: 1
            });
            popup.classList.add('is-active');
            skillPopupOpen = true;
            lenis.stop();

            const finalH = Math.min(popup.offsetHeight, window.innerHeight * 0.8);
            const slots = Array.from(popupContent.querySelectorAll('.popup-slot'));
            const gridPositions = slots.map(el => ({
                x: el.offsetLeft,
                y: el.offsetTop,
                w: el.offsetWidth,
                h: el.offsetHeight
            }));

            gsap.set(popup, { width: cardRect.width, height: cardRect.height });
            const finalX = (window.innerWidth - finalW) / 2;
            const finalY = (window.innerHeight - finalH) / 2;

            cardItems.forEach((el, i) => {
                el.classList.remove('popup-tile-mode');
                el.dataset.skillIdx = i;
                void el.offsetWidth;
                popupContent.appendChild(el);
                el.style.position = 'absolute';
                el.style.zIndex = '1';
                const cp = skillPopupCardPositions[i] || { x: 0, y: 0, w: 60, h: 30 };
                gsap.set(el, { left: cp.x, top: cp.y, width: cp.w, height: cp.h });
            });

            gsap.set(overlay, { opacity: 0 });
            overlay.classList.add('is-active');
            gsap.to(overlay, { opacity: 1, duration: 0.5, ease: 'power2.out' });

            if (skillPopupTl) skillPopupTl.kill();
            skillPopupTl = gsap.timeline();

            skillPopupTl.to(popup, {
                x: finalX,
                y: finalY,
                width: finalW,
                height: finalH,
                duration: 0.65,
                ease: 'power3.inOut',
                onComplete: () => { popup.style.overflowY = 'auto'; }
            }, 0);

            skillPopupTl.fromTo(popupContent.querySelector('div'),
                { opacity: 0 },
                { opacity: 1, duration: 0.4, delay: 0.3, ease: 'power2.out' }, 0);

            cardItems.forEach((el, i) => {
                const gp = gridPositions[i] || { x: 0, y: 0, w: 120, h: 120 };
                addMorphMask(skillPopupTl, el, i * 0.03, true);
                skillPopupTl.to(el, {
                    left: gp.x,
                    top: gp.y,
                    width: gp.w,
                    height: gp.h,
                    duration: 0.65,
                    ease: 'power3.inOut',
                    delay: i * 0.03,
                    onComplete: () => {
                        el.style.position = '';
                        el.style.zIndex = '';
                        gsap.set(el, { clearProps: 'all' });
                        slots[i].appendChild(el);
                    }
                }, i * 0.03);
            });
        });
    });

    function closeSkillPopup() {
        const overlay = document.getElementById('skillOverlay');
        const popup = document.getElementById('skillPopup');
        const popupContent = document.getElementById('skillPopupContent');
        const src = skillPopupSourceRect;

        if (!popup.classList.contains('is-active')) return;
        if (skillPopupTl) skillPopupTl.kill();

        const T = 0.6;
        const STAG = 0.03;

        if (src) {
            popup.style.overflowY = 'hidden';
            const cardItems = Array.from(popupContent.querySelectorAll('.skill-item'))
                .sort((a, b) => (+a.dataset.skillIdx) - (+b.dataset.skillIdx));
            const N = cardItems.length;
            const popupRect = popup.getBoundingClientRect();

            const gridPositions = cardItems.map(el => {
                const r = el.getBoundingClientRect();
                return {
                    x: r.left - popupRect.left,
                    y: r.top - popupRect.top,
                    w: r.width,
                    h: r.height
                };
            });

            cardItems.forEach((el, i) => {
                popupContent.appendChild(el);
                el.style.position = 'absolute';
                el.style.zIndex = '1';
                const gp = gridPositions[i];
                gsap.set(el, { left: gp.x, top: gp.y, width: gp.w, height: gp.h });
            });

            skillPopupTl = gsap.timeline({
                onComplete: () => {
                    popup.classList.remove('is-active');
                    gsap.set(popup, { visibility: 'hidden' });
                    cardItems.forEach((el, i) => {
                        el.classList.remove('popup-tile-mode');
                        el.style.position = '';
                        el.style.zIndex = '';
                        el.style.left = '';
                        el.style.top = '';
                        el.style.width = '';
                        el.style.height = '';
                        el.querySelectorAll(':scope > *').forEach(c => { c.style.opacity = ''; });
                        delete el.dataset.skillIdx;
                        const restore = skillPopupItemRestore[i];
                        if (restore && restore.parent) {
                            restore.parent.insertBefore(el, restore.next);
                        }
                    });
                    popupContent.innerHTML = '';
                    skillPopupOpen = false;
                    skillPopupTl = null;
                    lenis.start();
                }
            });

            skillPopupTl.to(popup, {
                x: src.x,
                y: src.y,
                width: src.width,
                height: src.height,
                duration: T,
                ease: 'power3.inOut'
            }, 0);

            cardItems.forEach((el, i) => {
                const cp = skillPopupCardPositions[i] || { x: 0, y: 0, w: 60, h: 30 };
                const d = (N - 1 - i) * STAG;
                addMorphMask(skillPopupTl, el, d, false);
                skillPopupTl.to(el, {
                    left: cp.x,
                    top: cp.y,
                    width: cp.w,
                    height: cp.h,
                    duration: T - d,
                    ease: 'power3.inOut'
                }, d);
            });

            skillPopupTl.to(overlay, {
                opacity: 0,
                duration: 0.4,
                ease: 'power2.in',
                onComplete: () => overlay.classList.remove('is-active')
            }, T - 0.4);
        } else {
            skillPopupTl = gsap.timeline({
                onComplete: () => {
                    popup.classList.remove('is-active');
                    gsap.set(popup, { visibility: 'hidden' });
                    skillPopupOpen = false;
                    skillPopupTl = null;
                    lenis.start();
                }
            });
            skillPopupTl.to(overlay, {
                opacity: 0,
                duration: 0.3,
                ease: 'power2.in',
                onComplete: () => overlay.classList.remove('is-active')
            }, 0);
            skillPopupTl.to(popup, {
                opacity: 0,
                duration: 0.3,
                ease: 'power2.in'
            }, 0);
        }
    }

    document.getElementById('skillOverlay').addEventListener('click', closeSkillPopup);
    document.getElementById('skillClose').addEventListener('click', closeSkillPopup);

    ScrollTrigger.refresh();
    computeSnapTargets();
    updateProgress(0);

});
