const toggle = document.getElementById('menu-toggle');
const navigationLinks = document.querySelectorAll('nav a');

if (toggle) {
    toggle.addEventListener("change", () => {
        document.body.classList.toggle("no-scroll", toggle.checked);
    });
}

navigationLinks.forEach((link) => {
    link.addEventListener("click", () => {
        if (toggle && toggle.checked) {
            toggle.checked = false;
            document.body.classList.remove("no-scroll");
        }
    });
});

const aboutSection = document.querySelector('.about-section');

if (aboutSection) {
    aboutSection.classList.add('animation-ready');

    if ('IntersectionObserver' in window) {
        const aboutObserver = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    aboutSection.classList.add('is-visible');
                } else {
                    aboutSection.classList.remove('is-visible');
                }
            });
        }, { threshold: 0.2 });

        aboutObserver.observe(aboutSection);
    } else {
        aboutSection.classList.add('is-visible');
    }
}

const contactForm = document.querySelector('#contact-form');
const formStatus = document.querySelector('#form-status');

if (contactForm && formStatus) {
    contactForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        formStatus.textContent = 'Sending message...';

        try {
            const response = await fetch('/api/contact-messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: document.querySelector('#contact-name').value.trim(),
                    email: document.querySelector('#contact-email').value.trim(),
                    message: document.querySelector('#contact-message').value.trim()
                })
            });
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message);
            }

            formStatus.textContent = result.message;
            contactForm.reset();
        } catch (error) {
            formStatus.textContent = error.message || 'Message could not be sent. Please try again.';
        }
    });
}

const adminModal = document.querySelector('#admin-modal');
const openAdminButton = document.querySelector('#open-admin');
const closeAdminButton = document.querySelector('#close-admin');
const adminLoginForm = document.querySelector('#admin-login-form');
const adminLoginView = document.querySelector('#admin-login-view');
const adminLoginStatus = document.querySelector('#admin-login-status');
const adminTokenKey = 'uttam-portfolio-admin-token';
const resumeDownloadButton = document.querySelector('#download-resume');
const projectGrid = document.querySelector('#project-grid');
const certificatesGrid = document.querySelector('#certificates-grid');
const momentsCarousel = document.querySelector('#moments-carousel');
const previousMomentButton = document.querySelector('#previous-moment');
const nextMomentButton = document.querySelector('#next-moment');
let savedMoments = [];
let activeMomentIndex = 0;
let activeMomentPhotoIndex = 0;
const momentPhotoIndexes = {};
const certificatePreviewModal = document.querySelector('#certificate-preview-modal');
const visitorCount = document.querySelector('#visitor-count');
const portfolioLastUpdated = document.querySelector('#portfolio-last-updated');

function formatFooterDate(value) {
    return new Intl.DateTimeFormat('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true
    }).format(new Date(value));
}

async function loadFooterStats() {
    if (!visitorCount || !portfolioLastUpdated) return;
    const isNewSessionVisit = !sessionStorage.getItem('portfolio-visit-recorded');
    try {
        const response = await fetch('/api/visitor-count', { method: isNewSessionVisit ? 'POST' : 'GET' });
        const stats = await response.json();
        if (!response.ok) throw new Error();
        visitorCount.textContent = stats.visitorCount;
        portfolioLastUpdated.textContent = formatFooterDate(stats.lastUpdated);
        if (isNewSessionVisit) sessionStorage.setItem('portfolio-visit-recorded', 'true');
    } catch {
        visitorCount.textContent = '—';
        portfolioLastUpdated.textContent = '—';
    }
}

loadFooterStats();
const certificatePreviewImage = document.querySelector('#certificate-preview-image');
const closeCertificatePreviewButton = document.querySelector('#close-certificate-preview');
const adminPasswordInput = document.querySelector('#admin-password');
const toggleAdminPasswordButton = document.querySelector('#toggle-admin-password');

function showAdminLogin() {
    adminLoginView.hidden = false;
}

function openAdminPanel() {
    adminModal.hidden = false;
    document.body.classList.add('no-scroll');
    showAdminLogin();
}

function closeAdminPanel() {
    adminModal.hidden = true;
    document.body.classList.remove('no-scroll');
}

openAdminButton?.addEventListener('click', openAdminPanel);
closeAdminButton?.addEventListener('click', closeAdminPanel);

toggleAdminPasswordButton?.addEventListener('click', () => {
    const isPasswordVisible = adminPasswordInput.type === 'text';

    adminPasswordInput.type = isPasswordVisible ? 'password' : 'text';
    toggleAdminPasswordButton.setAttribute('aria-pressed', String(!isPasswordVisible));
    toggleAdminPasswordButton.setAttribute(
        'aria-label',
        isPasswordVisible ? 'Show password' : 'Hide password'
    );
    toggleAdminPasswordButton.classList.toggle('is-visible', !isPasswordVisible);
});

adminModal?.addEventListener('click', (event) => {
    if (event.target === adminModal) {
        closeAdminPanel();
    }
});

adminLoginForm?.addEventListener('submit', async (event) => {
    event.preventDefault();

    const username = document.querySelector('#admin-username').value.trim();
    const password = document.querySelector('#admin-password').value;

    adminLoginStatus.textContent = 'Logging in...';

    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message);
        }

        sessionStorage.setItem(adminTokenKey, result.token);
        adminLoginForm.reset();
        window.location.href = 'admin.html';
    } catch (error) {
        adminLoginStatus.textContent = error.message || 'Login failed. Start the backend server first.';
    }
});

async function loadLatestResume() {
    if (!resumeDownloadButton) {
        return;
    }

    try {
        const response = await fetch('/api/resume/latest');
        const { resume } = await response.json();

        if (resume) {
            resumeDownloadButton.href = resume.fileUrl;
            resumeDownloadButton.download = resume.originalName;
        }
    } catch {
        // The static fallback link remains available until the backend is started.
    }
}

loadLatestResume();

function createProjectCard(project, index) {
    const card = document.createElement('article');
    const number = document.createElement('span');
    const title = document.createElement('h3');
    const description = document.createElement('p');
    const projectLink = document.createElement('a');

    card.className = 'project-card';
    number.textContent = String(index + 1).padStart(2, '0');
    title.textContent = project.title;
    description.textContent = project.description;
    projectLink.className = project.projectUrl ? 'project-link' : 'project-link project-link-disabled';
    projectLink.textContent = 'Click here to see project';

    if (project.projectUrl) {
        projectLink.href = project.projectUrl;
        projectLink.target = '_blank';
        projectLink.rel = 'noopener noreferrer';
    } else {
        projectLink.setAttribute('aria-disabled', 'true');
    }

    card.append(number, title, description, projectLink);
    return card;
}

async function loadProjects() {
    if (!projectGrid) {
        return;
    }

    try {
        const response = await fetch('/api/projects');
        const { projects } = await response.json();

        if (!response.ok) {
            throw new Error('Projects could not be loaded.');
        }

        projectGrid.replaceChildren();

        if (projects.length === 0) {
            const emptyMessage = document.createElement('p');
            emptyMessage.className = 'projects-empty-message';
            emptyMessage.textContent = 'New projects will appear here soon.';
            projectGrid.append(emptyMessage);
            return;
        }

        projects.forEach((project, index) => {
            projectGrid.append(createProjectCard(project, index));
        });
    } catch {
        // Static project cards remain visible until the backend server is running.
    }
}

loadProjects();

function createCertificateCard(certificate, index) {
    const card = document.createElement('article');
    const image = document.createElement('img');
    const copy = document.createElement('div');
    const number = document.createElement('span');
    const description = document.createElement('h3');
    const likeButton = document.createElement('button');
    const previewButton = document.createElement('button');

    card.className = 'certificate-card certificate-card-uploaded';
    image.className = 'certificate-image';
    image.src = certificate.imageUrl;
    image.alt = certificate.description;
    image.loading = 'lazy';
    image.tabIndex = 0;
    image.setAttribute('role', 'button');
    image.setAttribute('aria-label', `Open ${certificate.description} in full size`);
    image.addEventListener('click', () => {
        openCertificatePreview(certificate.imageUrl, certificate.description);
    });
    image.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            openCertificatePreview(certificate.imageUrl, certificate.description);
        }
    });
    copy.className = 'certificate-copy';
    number.className = 'certificate-ribbon';
    number.textContent = String(index + 1).padStart(2, '0');
    description.textContent = certificate.description;
    previewButton.className = 'certificate-preview-button';
    previewButton.type = 'button';
    previewButton.textContent = 'Click';
    previewButton.addEventListener('click', () => {
        openCertificatePreview(certificate.imageUrl, certificate.description);
    });

    copy.append(number, description);
    card.append(image, copy, previewButton);
    return card;
}

function openCertificatePreview(imageUrl, description) {
    certificatePreviewImage.src = imageUrl;
    certificatePreviewImage.alt = description;
    certificatePreviewModal.hidden = false;
    document.body.classList.add('no-scroll');
}

function closeCertificatePreview() {
    certificatePreviewModal.hidden = true;
    certificatePreviewImage.removeAttribute('src');
    document.body.classList.remove('no-scroll');
}

async function loadCertificates() {
    if (!certificatesGrid) {
        return;
    }

    try {
        const response = await fetch('/api/certificates');
        const { certificates } = await response.json();

        if (!response.ok) {
            throw new Error('Certificates could not be loaded.');
        }

        certificatesGrid.replaceChildren();

        certificates.forEach((certificate, index) => {
            certificatesGrid.append(createCertificateCard(certificate, index));
        });
    } catch {
        // Static certificate cards remain visible until the backend server is running.
    }
}

loadCertificates();

function renderMoment() {
    if (!momentsCarousel) return;
    momentsCarousel.replaceChildren();
    if (!savedMoments.length) return;
    savedMoments.forEach((moment, momentIndex) => {
        const card = document.createElement('article');
        const image = document.createElement('img');
        const copy = document.createElement('div');
        const number = document.createElement('span');
        const description = document.createElement('h3');
        const likeButton = document.createElement('button');
        const previousButton = document.createElement('button');
        const nextButton = document.createElement('button');
        const images = moment.images?.length ? moment.images : [{ imageUrl: moment.imageUrl, likes: 0 }];
        const photoIndex = momentPhotoIndexes[moment._id] || 0;
        const photo = images[photoIndex % images.length];
        card.className = 'moment-card moment-card-uploaded';
        image.src = photo.imageUrl; image.alt = moment.description; image.className = 'moment-image';
        image.addEventListener('click', () => openCertificatePreview(image.src, moment.description));
        number.className = 'moment-number'; number.textContent = String(momentIndex + 1).padStart(2, '0');
        description.textContent = moment.description;
        likeButton.className = 'moment-like-button'; likeButton.type = 'button'; likeButton.textContent = `♥ Like (${photo.likes || 0})`;
        likeButton.addEventListener('click', async () => { if (!photo._id) return; const response = await fetch(`/api/moments/${moment._id}/images/${photo._id}/like`, { method: 'POST' }); if (response.ok) { photo.likes = (await response.json()).likes; renderMoment(); } });
        previousButton.className = 'moment-photo-nav previous-photo'; previousButton.type = 'button'; previousButton.textContent = '‹'; previousButton.disabled = images.length < 2;
        nextButton.className = 'moment-photo-nav next-photo'; nextButton.type = 'button'; nextButton.textContent = '›'; nextButton.disabled = images.length < 2;
        previousButton.addEventListener('click', () => { momentPhotoIndexes[moment._id] = (photoIndex - 1 + images.length) % images.length; renderMoment(); });
        nextButton.addEventListener('click', () => { momentPhotoIndexes[moment._id] = (photoIndex + 1) % images.length; renderMoment(); });
        copy.className = 'moment-copy'; copy.append(number, description, likeButton);
        card.append(image, copy, previousButton, nextButton); momentsCarousel.append(card);
    });
    previousMomentButton.hidden = true;
    nextMomentButton.hidden = true;
}

async function loadMoments() {
    if (!momentsCarousel) return;
    try {
        const response = await fetch('/api/moments');
        const { moments } = await response.json();
        if (!response.ok) throw new Error();
        savedMoments = moments;
        activeMomentIndex = 0; activeMomentPhotoIndex = 0;
        renderMoment();
    } catch {
        momentsCarousel.textContent = '';
    }
}

previousMomentButton?.addEventListener('click', () => { const images = savedMoments[activeMomentIndex].images || []; activeMomentPhotoIndex = (activeMomentPhotoIndex - 1 + images.length) % images.length; renderMoment(); });
nextMomentButton?.addEventListener('click', () => { const images = savedMoments[activeMomentIndex].images || []; activeMomentPhotoIndex = (activeMomentPhotoIndex + 1) % images.length; renderMoment(); });
loadMoments();

closeCertificatePreviewButton?.addEventListener('click', closeCertificatePreview);

certificatePreviewModal?.addEventListener('click', (event) => {
    if (event.target === certificatePreviewModal) {
        closeCertificatePreview();
    }
});

document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && certificatePreviewModal && !certificatePreviewModal.hidden) {
        closeCertificatePreview();
    }
});
