const adminToken = sessionStorage.getItem('uttam-portfolio-admin-token');
const uploadForm = document.querySelector('#resume-upload-form');
const uploadStatus = document.querySelector('#upload-status');
const currentResume = document.querySelector('#current-resume');
const logoutButton = document.querySelector('#logout-button');
const projectForm = document.querySelector('#project-form');
const projectTitle = document.querySelector('#project-title');
const projectDescription = document.querySelector('#project-description');
const projectUrl = document.querySelector('#project-url');
const projectStatus = document.querySelector('#project-status');
const projectSelector = document.querySelector('#project-selector');
const projectEditorForm = document.querySelector('#project-editor-form');
const editProjectTitle = document.querySelector('#edit-project-title');
const editProjectDescription = document.querySelector('#edit-project-description');
const editProjectUrl = document.querySelector('#edit-project-url');
const saveProjectChangesButton = document.querySelector('#save-project-changes');
const deleteSelectedProjectButton = document.querySelector('#delete-selected-project');
const certificateUploadForm = document.querySelector('#certificate-upload-form');
const certificateStatus = document.querySelector('#certificate-status');
const certificateSelector = document.querySelector('#certificate-selector');
const deleteSelectedCertificateButton = document.querySelector('#delete-selected-certificate');
const contactMessagesList = document.querySelector('#contact-messages-list');
const momentUploadForm = document.querySelector('#moment-upload-form');
const momentImageInput = document.querySelector('#moment-image');
const addMomentPhotoButton = document.querySelector('#add-moment-photo');
const momentPhotoCount = document.querySelector('#moment-photo-count');
const momentStatus = document.querySelector('#moment-status');
const momentSelector = document.querySelector('#moment-selector');
const deleteSelectedMomentButton = document.querySelector('#delete-selected-moment');
const adminToast = document.querySelector('#admin-toast');
let adminToastTimer;
let savedProjects = [];
let savedCertificates = [];
let adminMoments = [];
let pendingMomentFiles = [];

if (!adminToken) {
  window.location.replace('index.html');
}

async function loadCurrentResume() {
  try {
    const response = await fetch('/api/resume/latest');
    const { resume } = await response.json();

    currentResume.innerHTML = resume
      ? `Current file: <a href="${resume.fileUrl}" target="_blank" rel="noopener noreferrer">${resume.originalName}</a>`
      : 'No resume has been uploaded yet.';
  } catch {
    currentResume.textContent = 'Could not load the current resume.';
  }
}

function getAdminHeaders() {
  return { Authorization: `Bearer ${adminToken}` };
}

function showAdminToast(message) {
  clearTimeout(adminToastTimer);
  adminToast.textContent = message;
  adminToast.classList.add('is-visible');

  adminToastTimer = window.setTimeout(() => {
    adminToast.classList.remove('is-visible');
  }, 3200);
}

function setProjectEditor(projectId) {
  const project = savedProjects.find((item) => item._id === projectId);
  const hasProject = Boolean(project);

  editProjectTitle.disabled = !hasProject;
  editProjectDescription.disabled = !hasProject;
  editProjectUrl.disabled = !hasProject;
  saveProjectChangesButton.disabled = !hasProject;
  deleteSelectedProjectButton.disabled = !hasProject;

  if (!project) {
    editProjectTitle.value = '';
    editProjectDescription.value = '';
    editProjectUrl.value = '';
    return;
  }

  editProjectTitle.value = project.title;
  editProjectDescription.value = project.description;
  editProjectUrl.value = project.projectUrl || '';
}

async function saveProjectChanges() {
  const projectId = projectSelector.value;

  if (!projectId) {
    return;
  }

  projectStatus.textContent = 'Saving project changes...';

  try {
    const response = await fetch(`/api/projects/${projectId}`, {
      method: 'PATCH',
      headers: {
        ...getAdminHeaders(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title: editProjectTitle.value.trim(),
        description: editProjectDescription.value.trim(),
        projectUrl: editProjectUrl.value.trim()
      })
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message);
    }

    projectStatus.textContent = result.message;
    showAdminToast('Changes saved successfully.');
    loadAdminProjects(projectId);
  } catch (error) {
    projectStatus.textContent = error.message || 'Project changes could not be saved.';
  }
}

async function loadAdminProjects(selectedProjectId) {
  try {
    const response = await fetch('/api/projects');
    const { projects } = await response.json();

    if (!response.ok) {
      throw new Error('Could not load projects.');
    }

    savedProjects = projects;
    projectSelector.replaceChildren();

    if (projects.length === 0) {
      const emptyOption = new Option('No projects available', '');
      projectSelector.append(emptyOption);
      projectSelector.disabled = true;
      setProjectEditor('');
      return;
    }

    projects.forEach((project) => {
      projectSelector.append(new Option(project.title, project._id));
    });

    projectSelector.disabled = false;
    projectSelector.value = projects.some((project) => project._id === selectedProjectId)
      ? selectedProjectId
      : projects[0]._id;
    setProjectEditor(projectSelector.value);
  } catch {
    projectSelector.replaceChildren(new Option('Could not load projects', ''));
    projectSelector.disabled = true;
    setProjectEditor('');
  }
}

async function deleteProject(projectId, projectName) {
  const shouldDelete = window.confirm(`Delete the project “${projectName}”?`);

  if (!shouldDelete) {
    return;
  }

  projectStatus.textContent = 'Deleting project...';

  try {
    const response = await fetch(`/api/projects/${projectId}`, {
      method: 'DELETE',
      headers: getAdminHeaders()
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message);
    }

    projectStatus.textContent = result.message;
    loadAdminProjects();
  } catch (error) {
    projectStatus.textContent = error.message || 'Project could not be deleted.';
  }
}

async function loadAdminCertificates(selectedCertificateId) {
  try {
    const response = await fetch('/api/certificates');
    const { certificates } = await response.json();

    if (!response.ok) {
      throw new Error('Could not load certificates.');
    }

    savedCertificates = certificates;
    certificateSelector.replaceChildren();

    if (certificates.length === 0) {
      certificateSelector.append(new Option('No certificates available', ''));
      certificateSelector.disabled = true;
      deleteSelectedCertificateButton.disabled = true;
      return;
    }

    certificates.forEach((certificate, index) => {
      const label = `${index + 1}. ${certificate.description}`;
      certificateSelector.append(new Option(label, certificate._id));
    });

    certificateSelector.disabled = false;
    certificateSelector.value = certificates.some((certificate) => certificate._id === selectedCertificateId)
      ? selectedCertificateId
      : certificates[0]._id;
    deleteSelectedCertificateButton.disabled = false;
  } catch {
    certificateSelector.replaceChildren(new Option('Could not load certificates', ''));
    certificateSelector.disabled = true;
    deleteSelectedCertificateButton.disabled = true;
  }
}

async function deleteSelectedCertificate() {
  const certificate = savedCertificates.find((item) => item._id === certificateSelector.value);

  if (!certificate) {
    return;
  }

  const shouldDelete = window.confirm(`Delete this certificate: “${certificate.description}”?`);

  if (!shouldDelete) {
    return;
  }

  certificateStatus.textContent = 'Deleting certificate...';

  try {
    const response = await fetch(`/api/certificates/${certificate._id}`, {
      method: 'DELETE',
      headers: getAdminHeaders()
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message);
    }

    certificateStatus.textContent = result.message;
    showAdminToast('Certificate deleted successfully.');
    loadAdminCertificates();
  } catch (error) {
    certificateStatus.textContent = error.message || 'Certificate could not be deleted.';
  }
}

async function loadAdminMoments(selectedId) {
  try { const response = await fetch('/api/moments'); const { moments } = await response.json(); if (!response.ok) throw new Error(); adminMoments = moments; momentSelector.replaceChildren(); if (!moments.length) { momentSelector.append(new Option('No moments available', '')); momentSelector.disabled = true; deleteSelectedMomentButton.disabled = true; return; } moments.forEach((moment, index) => { const likes = moment.images.reduce((total, image) => total + (image.likes || 0), 0); momentSelector.append(new Option(`${index + 1}. ${moment.description} — ${likes} likes`, moment._id)); }); momentSelector.value = moments.some((moment) => moment._id === selectedId) ? selectedId : moments[0]._id; momentSelector.disabled = false; deleteSelectedMomentButton.disabled = false; } catch { momentSelector.replaceChildren(new Option('Could not load moments', '')); momentSelector.disabled = true; deleteSelectedMomentButton.disabled = true; }
}

addMomentPhotoButton.addEventListener('click', () => { const file = momentImageInput.files[0]; if (!file) return; if (pendingMomentFiles.length >= 10) { momentStatus.textContent = 'Maximum 10 photos allowed.'; return; } if (file.size > 15 * 1024 * 1024) { momentStatus.textContent = `${file.name} is larger than the 15 MB limit.`; return; } pendingMomentFiles.push(file); momentImageInput.value = ''; momentPhotoCount.textContent = `${pendingMomentFiles.length} of 10 photos added.`; });
momentUploadForm.addEventListener('submit', async (event) => { event.preventDefault(); if (!pendingMomentFiles.length) { momentStatus.textContent = 'Add at least one photo first.'; return; } momentStatus.textContent = 'Connecting to photo storage...'; try { const configResponse = await fetch('/api/cloudinary-config', { headers: getAdminHeaders() }); const config = await configResponse.json(); if (!configResponse.ok) throw new Error(config.message || 'Cloudinary upload is not configured.'); const uploadedPhotos = []; for (let index = 0; index < pendingMomentFiles.length; index += 1) { const file = pendingMomentFiles[index]; momentStatus.textContent = `Uploading photo ${index + 1} of ${pendingMomentFiles.length}...`; const uploadData = new FormData(); uploadData.append('file', file); uploadData.append('upload_preset', config.uploadPreset); uploadData.append('folder', 'pradeep-portfolio/moments'); const cloudResponse = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(config.cloudName)}/image/upload`, { method: 'POST', body: uploadData }); const cloudResult = await cloudResponse.json(); if (!cloudResponse.ok) throw new Error(cloudResult.error?.message || `Photo ${index + 1} could not be uploaded.`); uploadedPhotos.push({ originalName: file.name, imageUrl: cloudResult.secure_url, cloudinaryId: cloudResult.public_id }); } momentStatus.textContent = 'Saving moment...'; const response = await fetch('/api/moments', { method: 'POST', headers: { ...getAdminHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify({ description: document.querySelector('#moment-description').value.trim(), images: uploadedPhotos }) }); const result = await response.json(); if (!response.ok) throw new Error(result.message || 'Moment information could not be saved.'); momentStatus.textContent = result.message; momentUploadForm.reset(); pendingMomentFiles = []; momentPhotoCount.textContent = '0 of 10 photos added.'; showAdminToast('Moment photos uploaded successfully.'); loadAdminMoments(result.moment._id); } catch (error) { momentStatus.textContent = error.message || 'Moment upload failed.'; } });

deleteSelectedMomentButton.addEventListener('click', async () => { const moment = adminMoments.find((item) => item._id === momentSelector.value); if (!moment || !window.confirm(`Delete this moment: “${moment.description}”?`)) return; try { const response = await fetch(`/api/moments/${moment._id}`, { method: 'DELETE', headers: getAdminHeaders() }); const result = await response.json(); if (!response.ok) throw new Error(result.message); showAdminToast('Moment deleted successfully.'); loadAdminMoments(); } catch { showAdminToast('Moment could not be deleted.'); } });

function formatMessageDate(dateValue) {
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(dateValue));
}

function createContactMessageItem(contactMessage) {
  const item = document.createElement('article');
  const meta = document.createElement('div');
  const sender = document.createElement('div');
  const name = document.createElement('h3');
  const email = document.createElement('a');
  const date = document.createElement('span');
  const message = document.createElement('p');
  const deleteButton = document.createElement('button');

  item.className = 'contact-message-item';
  meta.className = 'contact-message-meta';
  email.className = 'contact-message-email';
  date.className = 'contact-message-date';
  message.className = 'contact-message-body';
  deleteButton.className = 'delete-message-button';
  deleteButton.type = 'button';
  deleteButton.textContent = 'Delete';

  name.textContent = contactMessage.name;
  email.href = `mailto:${contactMessage.email}`;
  email.textContent = contactMessage.email;
  date.textContent = formatMessageDate(contactMessage.createdAt);
  message.textContent = contactMessage.message;
  deleteButton.addEventListener('click', () => deleteContactMessage(contactMessage._id, contactMessage.name));

  sender.append(name, email, date);
  meta.append(sender, deleteButton);
  item.append(meta, message);
  return item;
}

async function loadContactMessages() {
  try {
    const response = await fetch('/api/contact-messages', {
      headers: getAdminHeaders()
    });
    const { messages } = await response.json();

    if (!response.ok) {
      throw new Error('Could not load contact messages.');
    }

    contactMessagesList.replaceChildren();

    if (messages.length === 0) {
      contactMessagesList.textContent = 'No messages have been received yet.';
      return;
    }

    messages.forEach((contactMessage) => {
      contactMessagesList.append(createContactMessageItem(contactMessage));
    });
  } catch {
    contactMessagesList.textContent = 'Could not load messages. Start the backend server first.';
  }
}

async function deleteContactMessage(messageId, senderName) {
  const shouldDelete = window.confirm(`Delete the message from “${senderName}”?`);

  if (!shouldDelete) {
    return;
  }

  try {
    const response = await fetch(`/api/contact-messages/${messageId}`, {
      method: 'DELETE',
      headers: getAdminHeaders()
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message);
    }

    showAdminToast('Message deleted successfully.');
    loadContactMessages();
  } catch {
    showAdminToast('Message could not be deleted.');
  }
}

uploadForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  uploadStatus.textContent = 'Uploading resume...';

  try {
    const response = await fetch('/api/resume', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: new FormData(uploadForm)
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message);
    }

    uploadStatus.textContent = result.message;
    uploadForm.reset();
    loadCurrentResume();
  } catch (error) {
    uploadStatus.textContent = error.message || 'Resume upload failed.';
  }
});

logoutButton.addEventListener('click', () => {
  sessionStorage.removeItem('uttam-portfolio-admin-token');
  window.location.replace('index.html');
});

projectForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  projectStatus.textContent = 'Creating project...';

  try {
    const response = await fetch('/api/projects', {
      method: 'POST',
      headers: {
        ...getAdminHeaders(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title: projectTitle.value.trim(),
        description: projectDescription.value.trim(),
        projectUrl: projectUrl.value.trim()
      })
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message);
    }

    projectStatus.textContent = result.message;
    projectForm.reset();
    loadAdminProjects(result.project._id);
  } catch (error) {
    projectStatus.textContent = error.message || 'Project could not be created.';
  }
});

projectSelector.addEventListener('change', () => {
  setProjectEditor(projectSelector.value);
});

projectEditorForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  saveProjectChanges();
});

deleteSelectedProjectButton.addEventListener('click', () => {
  const selectedProject = savedProjects.find((project) => project._id === projectSelector.value);

  if (selectedProject) {
    deleteProject(selectedProject._id, selectedProject.title);
  }
});

certificateUploadForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  certificateStatus.textContent = 'Uploading certificate...';

  try {
    const response = await fetch('/api/certificates', {
      method: 'POST',
      headers: getAdminHeaders(),
      body: new FormData(certificateUploadForm)
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message);
    }

    certificateStatus.textContent = result.message;
    showAdminToast('Certificate uploaded successfully.');
    certificateUploadForm.reset();
    loadAdminCertificates(result.certificate._id);
  } catch (error) {
    certificateStatus.textContent = error.message || 'Certificate upload failed.';
  }
});

deleteSelectedCertificateButton.addEventListener('click', deleteSelectedCertificate);

loadCurrentResume();
loadAdminProjects();
loadAdminCertificates();
loadAdminMoments();
loadContactMessages();
