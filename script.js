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

            const nav = document.getElementById('nav');
            if (nav && window.scrollY > 80) {
                nav.style.background = next === 'dark' ? 'rgba(28,30,32,0.85)' : 'rgba(236,231,221,0.85)';
            }
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


    const nav = document.getElementById('nav');
    if (nav) {
        ScrollTrigger.create({
            start: "top -80",
            onUpdate: (self) => {
                if (self.direction === 1 && self.progress > 0) {
                    nav.style.backdropFilter = 'blur(12px)';
                    nav.style.webkitBackdropFilter = 'blur(12px)';
                    nav.style.background = document.body.getAttribute('data-theme') === 'dark'
                        ? 'rgba(28,30,32,0.85)' : 'rgba(236,231,221,0.85)';
                } else if (self.scroll() < 100) {
                    nav.style.backdropFilter = 'none';
                    nav.style.webkitBackdropFilter = 'none';
                    nav.style.background = 'transparent';
                }
            }
        });
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
            lock: true,
            onComplete: () => {
                lockTimer = setTimeout(() => { isLocked = false; }, 250);
            }
        });
    }


    window.addEventListener('wheel', (e) => {
        e.preventDefault();
        e.lenisStopPropagation = true;

        if (isLocked) return;

        if (projectStepHandler && e.target.closest && e.target.closest('.horizontal-pin-wrap') && Math.abs(e.deltaX) > Math.abs(e.deltaY) && Math.abs(e.deltaX) > 20) {
            projectStepHandler(e.deltaX > 0 ? 1 : -1);
            return;
        }

        if (Math.abs(e.deltaY) > 20) {
            if (e.deltaY > 0) {
                goToStep(currentStep + 1);
            } else {
                goToStep(currentStep - 1);
            }
        }
    }, { passive: false, capture: true });


    window.addEventListener('keydown', (e) => {
        if (isLocked) return;
        if (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ') {
            e.preventDefault();
            goToStep(currentStep + 1);
        } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
            e.preventDefault();
            goToStep(currentStep - 1);
        }
    });


    let touchY = 0;
    window.addEventListener('touchstart', (e) => {
        touchY = e.touches[0].clientY;
    }, { passive: true });

    window.addEventListener('touchend', (e) => {
        if (isLocked) return;
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


    ScrollTrigger.refresh();
    computeSnapTargets();
    updateProgress(0);

});
