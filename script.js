/* ============================================
   2026 Portfolio — script.js
   GSAP + Lenis + SplitType + One-Page Section Controller
   ============================================ */

document.addEventListener("DOMContentLoaded", () => {

    // ========================
    // 0. Initialize Lucide Icons
    // ========================
    lucide.createIcons();

    // ========================
    // 1. Lenis Smooth Scroll
    // ========================
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

    // ========================
    // 2. GSAP Setup & Lenis Sync
    // ========================
    gsap.registerPlugin(ScrollTrigger);

    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => { lenis.raf(time * 1000); });
    gsap.ticker.lagSmoothing(0);

    // ========================
    // 3. Preloader
    // ========================
    const preloader = document.getElementById('preloader');
    function finishPreloader() {
        if (!preloader.classList.contains('loaded')) {
            preloader.classList.add('loaded');
            const nav = document.getElementById('nav');
            const sectionNav = document.getElementById('section-nav');
            if (nav) nav.style.opacity = '1';
            if (sectionNav) sectionNav.style.opacity = '1';
            initHeroAnimations();
        }
    }
    window.addEventListener('load', () => setTimeout(finishPreloader, 2000));
    if (document.readyState === 'complete') setTimeout(finishPreloader, 2000);

    // ========================
    // 4. Custom Cursor (Desktop)
    // ========================
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

    // ========================
    // 5. Theme Toggle (Light / Dark)
    // ========================
    const themeToggle = document.getElementById('theme-toggle');
    const savedTheme = localStorage.getItem('ud-theme') || 'light';
    document.body.setAttribute('data-theme', savedTheme);

    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            const current = document.body.getAttribute('data-theme') || 'light';
            const next = current === 'dark' ? 'light' : 'dark';
            document.body.setAttribute('data-theme', next);
            localStorage.setItem('ud-theme', next);

            const nav = document.getElementById('nav');
            if (nav && window.scrollY > 80) {
                nav.style.background = next === 'dark' ? 'rgba(28,30,32,0.85)' : 'rgba(236,231,221,0.85)';
            }
        });
    }

    // ========================
    // 6. Hero Animations
    // ========================
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

    // ========================
    // 7. About Section — Scroll-triggered Reveal & Highlight Line
    // ========================
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

    // ========================
    // 8. Skills Cards — Glow follows mouse position
    // ========================
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

    // ========================
    // 9. Horizontal Scroll — Highlighted Projects
    // ========================
    const horizontalSection = document.querySelector('#projects');
    const scrollContainer = document.querySelector('.horizontal-scroll');

    let horizontalTrigger = null;
    if (horizontalSection && scrollContainer) {
        const calcScrollWidth = () => scrollContainer.scrollWidth - window.innerWidth;

        horizontalTrigger = ScrollTrigger.create({
            id: "horizontal-pin",
            animation: gsap.to(scrollContainer, {
                x: () => -calcScrollWidth(),
                ease: "none"
            }),
            trigger: horizontalSection,
            pin: true,
            scrub: 1,
            start: "top top",
            end: () => "+=" + calcScrollWidth(),
            invalidateOnRefresh: true
        });

        const panels = scrollContainer.querySelectorAll('.panel');
        panels.forEach((panel) => {
            gsap.from(panel, {
                scrollTrigger: {
                    trigger: panel,
                    containerAnimation: gsap.getById && undefined,
                    start: "left right",
                    toggleActions: "play none none reverse"
                },
                opacity: 0.6,
                scale: 0.96,
                duration: 1,
                ease: "power2.out"
            });
        });
    }

    // ========================
    // 10. More Projects — Scroll reveal stagger
    // ========================
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

    // ========================
    // 11. Magnetic Buttons (Contact section)
    // ========================
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

    // ========================
    // 12. Section index parallax (layered depth)
    // ========================
    const sectionIndices = document.querySelectorAll('.section-index, .hero-index');
    sectionIndices.forEach((el) => {
        gsap.to(el, {
            scrollTrigger: {
                trigger: el.parentElement,
                start: "top bottom",
                end: "bottom top",
                scrub: 0.5
            },
            y: -80,
            ease: "none"
        });
    });

    // ========================
    // 13. Nav background on scroll
    // ========================
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

    // ============================================
    // 14. ONE-PAGE SECTION LOCKING CONTROLLER
    // ============================================
    let snapTargets = [];

    function computeSnapTargets() {
        const targets = [];
        
        // 0: Hero
        targets.push(0);

        // 1: About
        const about = document.getElementById('about');
        if (about) targets.push(about.offsetTop);

        // 2: Skills
        const skills = document.getElementById('skills');
        if (skills) targets.push(skills.offsetTop);

        // 3, 4, 5: Highlighted Projects (Horizontal Steps)
        const ht = ScrollTrigger.getById('horizontal-pin');
        if (ht) {
            targets.push(ht.start);
            targets.push(ht.start + (ht.end - ht.start) * 0.5);
            targets.push(ht.end);
        } else {
            const projects = document.getElementById('projects');
            if (projects) targets.push(projects.offsetTop);
        }

        // 6: More Projects
        const more = document.getElementById('more-projects');
        if (more) targets.push(more.offsetTop);

        // 7: Contact
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

        updateDots(stepIndex);
    }

    function updateDots(activeIdx) {
        const dots = document.querySelectorAll('.section-dot');
        dots.forEach((dot, idx) => {
            if (idx === activeIdx) {
                dot.classList.add('active');
            } else {
                dot.classList.remove('active');
            }
        });
    }

    // 1. Wheel Navigation (1 Wheel Flick = Exactly 1 Section Move)
    // Runs in the CAPTURE phase so it executes BEFORE Lenis's own wheel
    // listener. We preventDefault (blocks native scroll) and tag the event
    // with `lenisStopPropagation` so Lenis skips it — otherwise Lenis also
    // smooth-scrolls the same wheel input and the section lock never holds.
    window.addEventListener('wheel', (e) => {
        e.preventDefault();
        e.lenisStopPropagation = true;

        if (isLocked) return;

        if (Math.abs(e.deltaY) > 20) {
            if (e.deltaY > 0) {
                goToStep(currentStep + 1);
            } else {
                goToStep(currentStep - 1);
            }
        }
    }, { passive: false, capture: true });

    // 2. Keyboard Navigation
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

    // 3. Touch Swipe Navigation
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

    // 4. Dot Click Navigation
    document.querySelectorAll('.section-dot').forEach((dot) => {
        dot.addEventListener('click', () => {
            const step = parseInt(dot.getAttribute('data-step'), 10);
            goToStep(step);
        });
    });

    // 5. Header Nav Click Synchronization
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

    // 6. Sync current step dot on scroll (if scrolled or animated)
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
            updateDots(closest);
        }
    });

    // Recalculate snap positions whenever the layout changes (pin spacers,
    // fonts, resize, etc.)
    ScrollTrigger.addEventListener('refresh', () => { snapTargets = []; });
    window.addEventListener('resize', () => { snapTargets = []; });

    // Force a refresh first so pin-spacers exist before measuring offsets
    ScrollTrigger.refresh();
    computeSnapTargets();

});
