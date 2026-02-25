document.addEventListener('DOMContentLoaded', () => {
    // 1. Scroll Reveal Animations
    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.1
    };

    const revealElements = document.querySelectorAll('.bento-card, .privacy-box, .hero-visual, .feature-item, .step-card, .setup-requirements, .setup-note');

    // Add base class for animation
    revealElements.forEach(el => {
        el.classList.add('scroll-reveal');
    });

    const revealObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
                observer.unobserve(entry.target); // Reveal only once
            }
        });
    }, observerOptions);

    revealElements.forEach(el => {
        revealObserver.observe(el);
    });

    // 2. Language Switcher Dropdown Toggle
    const langBtn = document.querySelector('.lang-switcher-btn');
    const langMenu = document.querySelector('.lang-switcher-dropdown');

    if (langBtn && langMenu) {
        langBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isExpanded = langBtn.getAttribute('aria-expanded') === 'true';
            langBtn.setAttribute('aria-expanded', !isExpanded);
            langMenu.classList.toggle('show');
        });

        // Close when clicking outside
        document.addEventListener('click', (e) => {
            if (!langMenu.contains(e.target) && !langBtn.contains(e.target)) {
                langBtn.setAttribute('aria-expanded', 'false');
                langMenu.classList.remove('show');
            }
        });
    }

    // 3. Smooth scrolling for anchor links
    document.querySelectorAll('.nav-links a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            if (targetId === '#') return;
            const target = document.querySelector(targetId);
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
});
