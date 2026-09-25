// Vercel serves this catch-all function for every /api/* request.
// The Express application keeps the same routes locally and in production.
module.exports = require('../node-backend');
