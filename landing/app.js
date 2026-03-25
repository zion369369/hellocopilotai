// Landing Page Scripts
document.addEventListener('DOMContentLoaded', () => {
    // Smooth Scrolling for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth'
                });
            }
        });
    });

    // Handle Scroll for Navbar Glassmorphism
    window.addEventListener('scroll', () => {
        const navbar = document.querySelector('.navbar');
        if (window.scrollY > 50) {
            navbar.style.boxShadow = '0 4px 6px rgba(0,0,0,0.01), 0 1px 3px rgba(0,0,0,0.08)';
            navbar.style.borderBottom = '1px solid #e8eaed';
        } else {
            navbar.style.boxShadow = 'none';
            navbar.style.borderBottom = '1px solid #e8eaed';
        }
    });

    // Chrome Install Button Interaction (Mockup)
    const installBtn = document.querySelector('.install-btn');
    if (installBtn) {
        installBtn.addEventListener('click', () => {
            alert('Hello! To install the extension locally:\n1. Open chrome://extensions/\n2. Enable Developer Mode\n3. Click "Load unpacked"\n4. Select the project folder');
        });
    }
});
