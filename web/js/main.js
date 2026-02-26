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

    // 4. Hero Carousel Logic
    const trk = document.querySelector('.carousel-track');
    if (trk) {
        const prevBtn = document.querySelector('.prev-btn');
        const nextBtn = document.querySelector('.next-btn');
        const dots = document.querySelectorAll('.carousel-indicators .indicator');
        const slides = document.querySelectorAll('.carousel-slide');

        // Navigate using buttons
        const scrollSlide = (direction) => {
            const slideWidth = trk.clientWidth;
            trk.scrollBy({
                left: direction * slideWidth,
                behavior: 'smooth'
            });
        };

        if (prevBtn) prevBtn.addEventListener('click', () => scrollSlide(-1));
        if (nextBtn) nextBtn.addEventListener('click', () => scrollSlide(1));

        // Navigate using dots
        dots.forEach((dot, index) => {
            dot.addEventListener('click', () => {
                const slideWidth = trk.clientWidth;
                trk.scrollTo({
                    left: index * slideWidth,
                    behavior: 'smooth'
                });
            });
        });

        // Update dots on scroll using IntersectionObserver
        const observerOpts = {
            root: trk,
            threshold: 0.5 // Trigger when a slide is at least 50% visible
        };

        const slideObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    // Find the index of the intersecting slide
                    const index = Array.from(slides).indexOf(entry.target);
                    // Update active dot
                    dots.forEach(d => d.classList.remove('active'));
                    if (dots[index]) dots[index].classList.add('active');
                }
            });
        }, observerOpts);

        slides.forEach(slide => slideObserver.observe(slide));
    }
});
