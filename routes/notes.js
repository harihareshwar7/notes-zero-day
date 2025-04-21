const express = require('express');
const router = express.Router();
const { saveNote,getUserNotes } = require('../controllers/notesController');

router.post('/save', saveNote);

router.get('/user/:uid',getUserNotes
);

module.exports = router;
