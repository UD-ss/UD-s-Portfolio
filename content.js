document.addEventListener('DOMContentLoaded', function() {
    (async function() {
        var content = null;
        try {
            var res = await fetch('/api/content');
            if (res.ok) content = await res.json();
        } catch (e) {}

        var site = (content && content.site) || null;
        if (!site) {
            try {
                var r = await fetch('/data/site.json');
                if (r.ok) site = await r.json();
            } catch (e) { console.error('Site config load failed:', e); }
        }

        var projects = (content && content.projects) || null;
        if (!projects) {
            try {
                var r = await fetch('/data/projects.json');
                if (r.ok) projects = await r.json();
            } catch (e) { console.error('Projects load failed:', e); }
        }

        if (site) applySiteConfig(site);
        window.renderProjects(projects || {});
    })();

    function applySiteConfig(cfg) {
        if (!cfg) return;
        // 테마 CSS 변수 동적 주입
        if (cfg.theme) {
            var css = '';
            if (cfg.theme.light) {
                css += ':root, [data-theme="light"] {\n';
                Object.keys(cfg.theme.light).forEach(function(k) {
                    var cssVar = k.replace(/([A-Z])/g, '-$1').toLowerCase();
                    css += '  --' + cssVar + ': ' + cfg.theme.light[k] + ';\n';
                });
                css += '}\n';
            }
            if (cfg.theme.dark) {
                css += '[data-theme="dark"] {\n';
                Object.keys(cfg.theme.dark).forEach(function(k) {
                    var cssVar = k.replace(/([A-Z])/g, '-$1').toLowerCase();
                    css += '  --' + cssVar + ': ' + cfg.theme.dark[k] + ';\n';
                });
                css += '}\n';
            }
            var dynStyle = document.getElementById('dynamic-theme');
            if (dynStyle) dynStyle.textContent = css;
        }
        // 히어로 동적 적용
        if (cfg.hero) {
            var heroSubtitle = document.getElementById('hero-subtitle');
            if (heroSubtitle) heroSubtitle.innerHTML = sanitizeRichText(cfg.hero.subtitle, ['BR'], {});
            if (cfg.hero.names && cfg.hero.names.length && window.applyHeroConfig) {
                window.applyHeroConfig(cfg.hero.names, cfg.hero.nameCyclingInterval || 3500);
            }
        }
        // About 동적 적용
        if (cfg.about) {
            var aboutContent = document.getElementById('about-content');
            if (aboutContent) {
                aboutContent.innerHTML = '';
                var quote = document.createElement('blockquote');
                quote.className = 'text-3xl sm:text-4xl md:text-5xl lg:text-[3.5rem] font-sans font-normal leading-[1.38] md:leading-[1.28] tracking-tight text-fg-light';
                quote.innerHTML = sanitizeRichText(cfg.about.html, ABOUT_TAGS, ABOUT_ATTRS);
                aboutContent.append(quote);
            }
            var aboutLabel = document.querySelector('#about h2');
            if (aboutLabel && cfg.about.label) aboutLabel.textContent = cfg.about.label;
        }
        // Skills 라벨 동적 적용
        if (cfg.skills) {
            var skillsLabel = document.querySelector('#skills h2');
            if (skillsLabel && cfg.skills.label) skillsLabel.textContent = cfg.skills.label;
        }
        // Contact 동적 적용
        if (cfg.contact) {
            var contactLabel = document.querySelector('#contact h2');
            if (contactLabel && cfg.contact.label) contactLabel.textContent = cfg.contact.label;
            var emailLink = document.querySelector('#contact a[href^="mailto:"]');
            if (emailLink && cfg.contact.email) {
                emailLink.href = 'mailto:' + encodeURIComponent(cfg.contact.email.replace(/[^\w.+-]/g, ''));
                var inner = emailLink.querySelector('.magnetic-inner');
                if (inner) {
                    inner.textContent = '';
                    var at = cfg.contact.email.indexOf('@');
                    if (at > 0) {
                        var br = document.createElement('br');
                        br.className = 'md:hidden';
                        inner.append(document.createTextNode(cfg.contact.email.slice(0, at)));
                        inner.append(br);
                        inner.append(document.createTextNode(cfg.contact.email.slice(at)));
                    } else {
                        inner.textContent = cfg.contact.email;
                    }
                }
            }
        }
        // 푸터 동적 적용
        if (cfg.footer) {
            var footerP = document.querySelector('#contact .absolute.bottom-8 p:last-child');
            if (footerP && cfg.footer.copyright) footerP.textContent = cfg.footer.copyright;
            var vcWrap = document.getElementById('visitor-counter');
            if (vcWrap && cfg.footer.showVisitorCounter === false) vcWrap.style.display = 'none';
        }
        // 네비게이션 동적 적용
        if (cfg.navigation) {
            var logoEl = document.querySelector('#nav > a[href="#hero"]');
            if (logoEl && cfg.navigation.logo) logoEl.textContent = cfg.navigation.logo;
            var navLinks = document.querySelectorAll('#nav .nav-link');
            var drawerLinks = document.querySelectorAll('#drawer-panel .drawer-link');
            if (cfg.navigation.items) {
                navLinks.forEach(function(link, i) {
                    if (cfg.navigation.items[i]) {
                        link.textContent = cfg.navigation.items[i].label;
                        link.href = safeHref(cfg.navigation.items[i].href);
                    }
                });
                drawerLinks.forEach(function(link, i) {
                    if (i === 0) return; // Home 링크는 유지
                    var item = cfg.navigation.items[i - 1];
                    if (item) { link.textContent = item.label; link.href = safeHref(item.href); }
                });
            }
        }
        // SEO 메타 태그 동적 적용
        if (cfg.seo) {
            if (cfg.seo.title) {
                document.title = cfg.seo.title;
                var ogTitle = document.querySelector('meta[property="og:title"]');
                var twTitle = document.querySelector('meta[name="twitter:title"]');
                if (ogTitle) ogTitle.content = cfg.seo.title;
                if (twTitle) twTitle.content = cfg.seo.title;
            }
            if (cfg.seo.description) {
                var ogDesc = document.querySelector('meta[property="og:description"]');
                var twDesc = document.querySelector('meta[name="twitter:description"]');
                if (ogDesc) ogDesc.content = cfg.seo.description;
                if (twDesc) twDesc.content = cfg.seo.description;
            }
            if (cfg.seo.ogImage) {
                var ogImg = document.querySelector('meta[property="og:image"]');
                var twImg = document.querySelector('meta[name="twitter:image"]');
                if (ogImg) ogImg.content = cfg.seo.ogImage;
                if (twImg) twImg.content = cfg.seo.ogImage;
            }
            if (cfg.seo.siteUrl) {
                var ogUrl = document.querySelector('meta[property="og:url"]');
                if (ogUrl) ogUrl.content = cfg.seo.siteUrl;
            }
            if (cfg.seo.robots) {
                var robotsMeta = document.querySelector('meta[name="robots"]');
                if (robotsMeta) robotsMeta.content = cfg.seo.robots;
            }
        }
    }
});

function renderProjects(data) {
    renderHighlightedPanels((data && data.highlighted) || []);
    renderMoreProjectList((data && data.more) || []);
    if (window.lucide) lucide.createIcons();

    function initAll() {
        if (typeof window.initProjects === 'function') window.initProjects();
        if (typeof window.initSectionLock === 'function') window.initSectionLock();
        if (typeof window.initMoreProjects === 'function') window.initMoreProjects();
    }

    if (typeof window.initProjects === 'function') {
        initAll();
    } else {
        document.addEventListener('DOMContentLoaded', initAll);
    }
}

function renderHighlightedPanels(list) {
    var c = document.getElementById('project-panels');
    if (!c) return;
    list.forEach(function(p, i) {
        var num = String(i + 1).padStart(2, '0');
        if (p.placeholder) {
            c.innerHTML += '<div class="panel w-[85vw] md:w-[min(55vw,80vh)] flex-shrink-0 flex flex-col justify-center relative cursor-hover-target"><span class="text-[8rem] md:text-[12rem] font-display font-bold absolute -top-16 -left-4 opacity-[0.06] select-none pointer-events-none leading-none">' + num + '</span><div class="aspect-[16/10] bg-[#1e1e1e] rounded-xl overflow-hidden mb-5 md:mb-7 relative group flex items-center justify-center"><div class="text-center"><i data-lucide="lock" class="w-12 h-12 text-[#444] mx-auto mb-4"></i><p class="text-[#555] text-sm font-light tracking-wider uppercase">Coming Soon</p></div></div><h3 class="text-4xl md:text-6xl font-display font-bold mb-2 md:mb-3 tracking-tight">' + escHtml(p.title) + '</h3><p class="text-muted-dark font-light text-base md:text-lg mb-4 md:mb-5 leading-relaxed max-w-lg">' + escHtml(p.description) + '</p><div class="flex flex-wrap gap-2">' + (p.tags||[]).map(function(t){return '<span class="tag">'+escHtml(t)+'</span>';}).join('') + '</div></div>';
        } else {
            var imgSrc = imageUrl(p.image);
            var imgTag = imgSrc ? '<img src="' + escAttr(imgSrc) + '" alt="' + escAttr(p.title) + '" class="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-700" loading="lazy">' : '';
            c.innerHTML += '<div class="panel w-[85vw] md:w-[min(55vw,80vh)] flex-shrink-0 flex flex-col justify-center relative cursor-hover-target"><span class="text-[8rem] md:text-[12rem] font-display font-bold absolute -top-16 -left-4 opacity-[0.06] select-none pointer-events-none leading-none">' + num + '</span><div class="aspect-[16/10] bg-[#1e1e1e] rounded-xl overflow-hidden mb-5 md:mb-7 relative group">' + imgTag + '<div class="project-hover-label">View Project</div></div><h3 class="text-4xl md:text-6xl font-display font-bold mb-2 md:mb-3 tracking-tight">' + escHtml(p.title) + '</h3><p class="text-muted-dark font-light text-base md:text-lg mb-4 md:mb-5 leading-relaxed max-w-lg">' + escHtml(p.description) + '</p><div class="flex flex-wrap gap-2">' + (p.tags||[]).map(function(t){return '<span class="tag">'+escHtml(t)+'</span>';}).join('') + '</div></div>';
        }
    });
}

function renderMoreProjectList(list) {
    var c = document.getElementById('more-project-list');
    if (!c) return;
    list.forEach(function(p, i) {
        var isLast = i === list.length - 1;
        c.innerHTML += '<a href="' + escAttr(safeLink(p.link)) + '" class="project-list-item group cursor-hover-target block py-10 border-t ' + (isLast ? 'border-b' : '') + ' border-border-light relative overflow-hidden transition-colors duration-500"><div class="project-list-bg"></div><div class="flex items-center justify-between relative z-10"><div><h3 class="text-2xl md:text-4xl font-display font-semibold mb-2 transition-transform duration-500 group-hover:translate-x-4 tracking-tight">' + escHtml(p.title) + '</h3><p class="text-sm text-muted-light font-light transition-all duration-500 group-hover:translate-x-4">' + escHtml(p.description) + '</p></div><div class="flex gap-2 items-center opacity-0 group-hover:opacity-100 transition-opacity duration-500"><span class="text-xs uppercase tracking-widest text-muted-light hidden md:inline">' + escHtml(p.tech || '') + '</span><i data-lucide="arrow-up-right" class="w-5 h-5"></i></div></div></a>';
    });
}

function escHtml(s) { var d = document.createElement('div'); d.textContent = s == null ? '' : String(s); return d.innerHTML; }
function escAttr(s) { return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

var CONTROL_CHARS = /[\u0000-\u001f\u007f]/g;

function safeHref(url) {
    if (!url) return '#';
    var v = String(url).replace(CONTROL_CHARS, '').trim();
    if (/^https?:\/\//i.test(v)) return v;
    if (/^mailto:/i.test(v)) return v;
    if (/^[#/.]/.test(v)) return v;
    return '#';
}

function safeLink(url) { return safeHref(url); }

function imageUrl(image) {
    if (!image) return '';
    var v = String(image).replace(CONTROL_CHARS, '').trim();
    if (/^https?:\/\//i.test(v)) return v;
    if (/^[a-zA-Z0-9][a-zA-Z0-9._-]*\.(png|jpe?g|webp|gif|avif|svg)$/i.test(v)) {
        return 'https://cdn.jsdelivr.net/gh/UD-ss/UD-s-Portfolio@main/images/' + v;
    }
    return '';
}

var ABOUT_TAGS = ['SPAN','B','I','EM','STRONG','BR','P','A','CODE','MARK','SMALL','SUB','SUP','U','S','DEL','INS','ABBR','Q','CITE','DFN','TIME','DATA','VAR','KBD','SAMP','RUBY','RT','RP','WBR','DIV'];
var ABOUT_ATTRS = {
    A: ['href'],
    SPAN: ['class'],
    DIV: ['class'],
    CODE: ['class'],
    MARK: ['class']
};
var ABOUT_CLASSES = ['highlight-phrase','highlight-text','highlight-line'];

function sanitizeRichText(html, allowedTags, allowedAttrs) {
    if (html == null) return '';
    var doc = new DOMParser().parseFromString('<div id="ud-root"></div>', 'text/html');
    doc.getElementById('ud-root').textContent = '';
    doc.getElementById('ud-root').innerHTML = String(html);
    var root = doc.getElementById('ud-root');
    var walker = doc.createTreeWalker(root, 128);
    var doomed = [];
    while (walker.nextNode()) {
        var node = walker.currentNode;
        if (node.nodeType !== 1) continue;
        var tag = node.tagName;
        if (allowedTags.indexOf(tag) === -1) { doomed.push([node, node.textContent]); continue; }
        var keep = allowedAttrs[tag] || [];
        Array.prototype.slice.call(node.attributes).forEach(function(attr) {
            var ok = keep.indexOf(attr.name) !== -1;
            if (ok && attr.name === 'href') ok = safeHref(attr.value) !== '#';
            if (ok && attr.name === 'class') {
                ok = attr.value.split(/\s+/).filter(Boolean).every(function(c) { return ABOUT_CLASSES.indexOf(c) !== -1; });
            }
            if (!ok) node.removeAttribute(attr.name);
        });
    }
    doomed.reverse().forEach(function(pair) {
        var node = pair[0];
        if (node.parentNode) node.parentNode.replaceChild(doc.createTextNode(pair[1]), node);
    });
    return root.innerHTML;
}
