require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;
const uploadsDirectory = path.join(__dirname, 'uploads');
const requiredEnvironmentVariables = [
  'MONGODB_URI',
  'ADMIN_USERNAME',
  'ADMIN_PASSWORD_HASH',
  'JWT_SECRET'
];

const missingConfiguration = requiredEnvironmentVariables.filter(
  (name) => !process.env[name]
);

if (missingConfiguration.length > 0) {
  throw new Error(`Missing required environment variables: ${missingConfiguration.join(', ')}`);
}

fs.mkdirSync(uploadsDirectory, { recursive: true });

const resumeSchema = new mongoose.Schema(
  {
    originalName: { type: String, required: true },
    fileName: { type: String, required: true },
    fileUrl: { type: String, required: true }
  },
  { timestamps: true }
);

const Resume = mongoose.model('Resume', resumeSchema);

const projectSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, required: true, trim: true, maxlength: 500 },
    projectUrl: { type: String, trim: true, maxlength: 2048, default: '' },
    order: { type: Number, required: true }
  },
  { timestamps: true }
);

const Project = mongoose.model('Project', projectSchema);

const certificateSchema = new mongoose.Schema(
  {
    description: { type: String, required: true, trim: true, maxlength: 500 },
    originalName: { type: String, required: true },
    fileName: { type: String, required: true },
    imageUrl: { type: String, required: true },
    order: { type: Number, required: true }
  },
  { timestamps: true }
);

const Certificate = mongoose.model('Certificate', certificateSchema);

const contactMessageSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
    message: { type: String, required: true, trim: true, maxlength: 2000 }
  },
  { timestamps: true }
);

const ContactMessage = mongoose.model('ContactMessage', contactMessageSchema);

const momentSchema = new mongoose.Schema({ description: { type: String, required: true, trim: true, maxlength: 500 }, originalName: String, fileName: String, imageUrl: String, images: [{ originalName: String, fileName: String, imageUrl: String, likes: { type: Number, default: 0 } }], order: Number }, { timestamps: true });
const Moment = mongoose.model('Moment', momentSchema);

const portfolioStateSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  value: { type: Number, default: 0 }
}, { timestamps: true });

const PortfolioState = mongoose.model('PortfolioState', portfolioStateSchema);

let databaseConnection;

function connectDatabase() {
  if (mongoose.connection.readyState === 1) {
    return Promise.resolve(mongoose.connection);
  }

  if (!databaseConnection) {
    databaseConnection = mongoose.connect(process.env.MONGODB_URI);
  }

  return databaseConnection;
}

async function touchPortfolioUpdated() {
  await PortfolioState.findOneAndUpdate(
    { key: 'portfolio-last-updated' },
    { $set: { value: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
}

const defaultProjects = [
  {
    title: 'Personal Portfolio',
    description: 'A responsive website to show my profile, skills and contact details.',
    order: 1
  },
  {
    title: 'Web Development Practice',
    description: 'Frontend projects made while learning HTML, CSS and JavaScript.',
    order: 2
  },
  {
    title: 'Future Project',
    description: 'A space for my next idea, product or freelance project.',
    order: 3
  },
  {
    title: 'Java Full Stack Project',
    description: 'A future Java-based web application using frontend, backend and database skills.',
    order: 4
  }
];

const storage = multer.diskStorage({
  destination: uploadsDirectory,
  filename: (request, file, callback) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '-');
    callback(null, `${Date.now()}-${safeName}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (request, file, callback) => {
    const isPdf = file.mimetype === 'application/pdf' && file.originalname.toLowerCase().endsWith('.pdf');

    if (!isPdf) {
      callback(new Error('Only PDF resume files are allowed.'));
      return;
    }

    callback(null, true);
  }
});

const certificateUpload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (request, file, callback) => {
    const allowedImageTypes = ['image/jpeg', 'image/png', 'image/webp'];

    if (!allowedImageTypes.includes(file.mimetype)) {
      callback(new Error('Only JPG, PNG or WEBP certificate images are allowed.'));
      return;
    }

    callback(null, true);
  }
});

const momentUpload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024, files: 10 },
  fileFilter: (request, file, callback) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      callback(new Error('Only JPG, PNG or WEBP moment images are allowed.'));
      return;
    }

    callback(null, true);
  }
});

app.use(express.json());
app.use('/uploads', express.static(uploadsDirectory));
app.use(express.static(__dirname));
app.use('/api', async (request, response, next) => {
  try {
    await connectDatabase();
    next();
  } catch (error) {
    console.error('Database connection failed:', error.message);
    response.status(503).json({ message: 'Database connection is unavailable. Please try again shortly.' });
  }
});

function requireAdmin(request, response, next) {
  const authorization = request.headers.authorization || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : null;

  if (!token) {
    response.status(401).json({ message: 'Admin login is required.' });
    return;
  }

  try {
    request.admin = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    response.status(401).json({ message: 'Your admin session has expired. Please log in again.' });
  }
}

function getValidProjectUrl(value) {
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }

  try {
    const projectUrl = new URL(value.trim());

    if (projectUrl.protocol !== 'http:' && projectUrl.protocol !== 'https:') {
      return null;
    }

    return projectUrl.toString();
  } catch {
    return null;
  }
}

app.post('/api/auth/login', async (request, response) => {
  const { username, password } = request.body;

  if (username !== process.env.ADMIN_USERNAME || typeof password !== 'string') {
    response.status(401).json({ message: 'Incorrect username or password.' });
    return;
  }

  const passwordMatches = await bcrypt.compare(password, process.env.ADMIN_PASSWORD_HASH);

  if (!passwordMatches) {
    response.status(401).json({ message: 'Incorrect username or password.' });
    return;
  }

  const token = jwt.sign({ username, role: 'admin' }, process.env.JWT_SECRET, {
    expiresIn: '8h'
  });

  response.json({ token });
});

app.get('/api/resume/latest', async (request, response) => {
  const resume = await Resume.findOne().sort({ createdAt: -1 });
  response.json({ resume });
});

async function sendVisitorStats(response, shouldCountVisit) {
  const visitorState = shouldCountVisit
    ? await PortfolioState.findOneAndUpdate(
      { key: 'visitor-count' },
      { $inc: { value: 1 } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    )
    : await PortfolioState.findOne({ key: 'visitor-count' });
  const lastUpdatedState = await PortfolioState.findOne({ key: 'portfolio-last-updated' });
  response.json({
    visitorCount: visitorState?.value || 0,
    lastUpdated: lastUpdatedState?.updatedAt || new Date()
  });
}

app.get('/api/visitor-count', async (request, response) => sendVisitorStats(response, false));
app.post('/api/visitor-count', async (request, response) => sendVisitorStats(response, true));

app.post('/api/contact-messages', async (request, response) => {
  const { name, email, message } = request.body;
  const isValidEmail = typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  if (
    typeof name !== 'string' ||
    typeof message !== 'string' ||
    !name.trim() ||
    !message.trim() ||
    !isValidEmail
  ) {
    response.status(400).json({ message: 'Enter a valid name, email and message.' });
    return;
  }

  await ContactMessage.create({
    name: name.trim(),
    email: email.trim(),
    message: message.trim()
  });

  response.status(201).json({ message: 'Your message has been sent successfully.' });
});

app.get('/api/contact-messages', requireAdmin, async (request, response) => {
  const messages = await ContactMessage.find().sort({ createdAt: -1 });
  response.json({ messages });
});

app.delete('/api/contact-messages/:messageId', requireAdmin, async (request, response) => {
  const message = await ContactMessage.findByIdAndDelete(request.params.messageId);

  if (!message) {
    response.status(404).json({ message: 'Message not found.' });
    return;
  }

  response.json({ message: 'Message deleted successfully.' });
});

app.get('/api/projects', async (request, response) => {
  const projects = await Project.find().sort({ order: 1, createdAt: 1 });
  response.json({ projects });
});

app.get('/api/certificates', async (request, response) => {
  const certificates = await Certificate.find().sort({ order: 1, createdAt: 1 });
  response.json({ certificates });
});

app.get('/api/moments', async (request, response) => {
  response.json({ moments: await Moment.find().sort({ order: 1, createdAt: 1 }) });
});

app.post('/api/moments', requireAdmin, (request, response) => {
  momentUpload.array('momentImage', 10)(request, response, async (uploadError) => {
    if (uploadError) return response.status(400).json({ message: uploadError.message });
    const description = request.body.description?.trim();
    if (!description || !request.files?.length) return response.status(400).json({ message: 'Choose moment photos and enter their description.' });
    const moment = await Moment.create({ description, images: request.files.map((file) => ({ originalName: file.originalname, fileName: file.filename, imageUrl: `/uploads/${file.filename}` })), order: (await Moment.countDocuments()) + 1 });
    await touchPortfolioUpdated();
    response.status(201).json({ message: `${moment.images.length} moment photo(s) uploaded successfully.`, moment });
  });
});

app.delete('/api/moments/:momentId', requireAdmin, async (request, response) => {
  const moment = await Moment.findByIdAndDelete(request.params.momentId);
  if (!moment) return response.status(404).json({ message: 'Moment not found.' });
  const moments = await Moment.find().sort({ order: 1, createdAt: 1 });
  await Promise.all(moments.map((item, index) => { item.order = index + 1; return item.save(); }));
  moment.images.forEach((image) => fs.unlink(path.join(uploadsDirectory, image.fileName), () => {}));
  await touchPortfolioUpdated();
  response.json({ message: 'Moment deleted successfully.' });
});

app.post('/api/moments/:momentId/images/:imageId/like', async (request, response) => {
  const moment = await Moment.findById(request.params.momentId);
  const image = moment?.images.id(request.params.imageId);
  if (!image) return response.status(404).json({ message: 'Moment photo not found.' });
  image.likes = (image.likes || 0) + 1;
  await moment.save();
  response.json({ likes: image.likes });
});

app.post('/api/certificates', requireAdmin, (request, response) => {
  certificateUpload.single('certificateImage')(request, response, async (uploadError) => {
    if (uploadError) {
      response.status(400).json({ message: uploadError.message });
      return;
    }

    const description = request.body.description?.trim();

    if (!description || !request.file) {
      response.status(400).json({ message: 'Choose a certificate image and enter its description.' });
      return;
    }

    const certificateCount = await Certificate.countDocuments();
    const certificate = await Certificate.create({
      description,
      originalName: request.file.originalname,
      fileName: request.file.filename,
      imageUrl: `/uploads/${request.file.filename}`,
      order: certificateCount + 1
    });

    await touchPortfolioUpdated();

    response.status(201).json({ message: 'Certificate uploaded successfully.', certificate });
  });
});

app.delete('/api/certificates/:certificateId', requireAdmin, async (request, response) => {
  const certificate = await Certificate.findByIdAndDelete(request.params.certificateId);

  if (!certificate) {
    response.status(404).json({ message: 'Certificate not found.' });
    return;
  }

  const remainingCertificates = await Certificate.find().sort({ order: 1, createdAt: 1 });

  await Promise.all(
    remainingCertificates.map((remainingCertificate, index) => {
      remainingCertificate.order = index + 1;
      return remainingCertificate.save();
    })
  );

  const imagePath = path.join(uploadsDirectory, certificate.fileName);
  fs.unlink(imagePath, () => {});
  await touchPortfolioUpdated();
  response.json({ message: 'Certificate deleted successfully.' });
});

app.post('/api/projects', requireAdmin, async (request, response) => {
  const { title, description, projectUrl: rawProjectUrl } = request.body;
  const projectUrl = getValidProjectUrl(rawProjectUrl);

  if (typeof title !== 'string' || typeof description !== 'string' || !title.trim() || !description.trim() || !projectUrl) {
    response.status(400).json({ message: 'Enter a project title, description and valid http(s) link.' });
    return;
  }

  const projectCount = await Project.countDocuments();
  const project = await Project.create({
    title: title.trim(),
    description: description.trim(),
    projectUrl,
    order: projectCount + 1
  });

  await touchPortfolioUpdated();

  response.status(201).json({ message: 'Project created successfully.', project });
});

app.patch('/api/projects/:projectId', requireAdmin, async (request, response) => {
  const { title, description, projectUrl: rawProjectUrl } = request.body;
  const projectUrl = getValidProjectUrl(rawProjectUrl);

  if (typeof title !== 'string' || typeof description !== 'string' || !title.trim() || !description.trim() || !projectUrl) {
    response.status(400).json({ message: 'Enter a project title, description and valid http(s) link.' });
    return;
  }

  const project = await Project.findByIdAndUpdate(
    request.params.projectId,
    {
      title: title.trim(),
      description: description.trim(),
      projectUrl
    },
    { new: true, runValidators: true }
  );

  if (!project) {
    response.status(404).json({ message: 'Project not found.' });
    return;
  }

  await touchPortfolioUpdated();

  response.json({ message: 'Project updated successfully.', project });
});

app.patch('/api/projects/:projectId/link', requireAdmin, async (request, response) => {
  const projectUrl = getValidProjectUrl(request.body.projectUrl);

  if (!projectUrl) {
    response.status(400).json({ message: 'Enter a valid project link beginning with http:// or https://.' });
    return;
  }

  const project = await Project.findByIdAndUpdate(
    request.params.projectId,
    { projectUrl },
    { new: true, runValidators: true }
  );

  if (!project) {
    response.status(404).json({ message: 'Project not found.' });
    return;
  }

  await touchPortfolioUpdated();

  response.json({ message: 'Project link saved successfully.', project });
});

app.delete('/api/projects/:projectId', requireAdmin, async (request, response) => {
  const project = await Project.findByIdAndDelete(request.params.projectId);

  if (!project) {
    response.status(404).json({ message: 'Project not found.' });
    return;
  }

  const remainingProjects = await Project.find().sort({ order: 1, createdAt: 1 });

  await Promise.all(
    remainingProjects.map((remainingProject, index) => {
      remainingProject.order = index + 1;
      return remainingProject.save();
    })
  );

  await touchPortfolioUpdated();

  response.json({ message: 'Project deleted successfully.' });
});

app.post('/api/resume', requireAdmin, (request, response) => {
  upload.single('resume')(request, response, async (uploadError) => {
    if (uploadError) {
      response.status(400).json({ message: uploadError.message });
      return;
    }

    if (!request.file) {
      response.status(400).json({ message: 'Please choose a PDF resume file.' });
      return;
    }

    const resume = await Resume.create({
      originalName: request.file.originalname,
      fileName: request.file.filename,
      fileUrl: `/uploads/${request.file.filename}`
    });

    await touchPortfolioUpdated();

    response.status(201).json({ message: 'Resume uploaded successfully.', resume });
  });
});

app.use((error, request, response, next) => {
  console.error(error);
  response.status(500).json({ message: 'Something went wrong. Please try again.' });
});

async function startServer() {
  await connectDatabase();
  console.log('MongoDB connected.');

  const projectState = await PortfolioState.findOne({ key: 'projects-initialized' });

  if (!projectState) {
    const projectCount = await Project.countDocuments();

    if (projectCount === 0) {
      await Project.insertMany(defaultProjects);
      console.log('Default projects added.');
    }

    await PortfolioState.create({ key: 'projects-initialized' });
  }

  app.listen(port, () => {
    console.log(`Portfolio server running at http://localhost:${port}`);
  });
}

if (require.main === module) {
  startServer().catch((error) => {
    console.error('Server startup failed:', error.message);
    process.exit(1);
  });
}

module.exports = app;
