const express = require('express');
const router = express.Router();
const { saveNote } = require('../controllers/notesController');

router.post('/save', saveNote);

module.exports = router;
