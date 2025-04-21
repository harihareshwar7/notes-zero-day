const PDFDocument = require('pdfkit');
const { Storage } = require('@google-cloud/storage');
const { initializeApp } = require('firebase/app');
const { getFirestore, doc, getDoc, setDoc, updateDoc, arrayUnion } = require('firebase/firestore');
require('dotenv').config();

// Input validation
function validateNoteInput(noteData) {
  if (!noteData.uid || !noteData.email || !noteData.username || !noteData.subject || !noteData.topic || !noteData.noteContent) {
    return { error: { details: [{ message: 'All fields (uid, email, username, subject, topic, noteContent) are required.' }] } };
  }
  return {};
}

// PDF generation
function generatePDF(noteData) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument();
      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(buffers);
        resolve(pdfBuffer);
      });
      doc.fontSize(16).text(`Subject: ${noteData.subject}`);
      doc.moveDown();
      doc.fontSize(14).text(`Topic: ${noteData.topic}`);
      doc.moveDown();
      doc.fontSize(12).text(noteData.noteContent);
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

// FirebaseService for GCS and Firestore
const firebaseConfig = {
    apiKey: process.env.FIREBASE_API_KEY || "AIzaSyCDWxyhg1BNsF-_VPLNuBolq0-qQaqWvkQ",
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || "evalio-lms.firebaseapp.com",
    projectId: process.env.FIREBASE_PROJECT_ID || "evalio-lms",
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "evalio-lms.firebasestorage.app",
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "906474100955",
    appId: process.env.FIREBASE_APP_ID || "1:906474100955:web:b35fd7bd53152d065bd4fe",
    measurementId: process.env.FIREBASE_MEASUREMENT_ID || "G-6HGG06T6D8"
};

const gcsCredentials = JSON.parse(process.env.GCS_SERVICE_JSON);
const bucketName = process.env.GCS_BUCKET_NAME;
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = new Storage({ credentials: gcsCredentials });

async function saveNoteWithPDF(noteData, pdfBuffer) {
  const filename = `${noteData.uid}_${Date.now()}.pdf`;
  const bucket = storage.bucket(bucketName);
  const file = bucket.file(`notes/${filename}`);
  await file.save(pdfBuffer, { contentType: 'application/pdf', public:true });
  const url = `https://storage.googleapis.com/${bucketName}/notes/${filename}`;
  const noteMeta = {
    pdfUrl: url,
    subject: noteData.subject,
    topic: noteData.topic,
    timestamp: Date.now(), // Use a plain timestamp instead of serverTimestamp()
  };

  const userDocRef = doc(db, 'saved-notes', noteData.uid);
  const userDocSnap = await getDoc(userDocRef);
  if (userDocSnap.exists()) {
    await updateDoc(userDocRef, {
      notes: arrayUnion(noteMeta)
    });
  } else {
    await setDoc(userDocRef, {
      uid: noteData.uid,
      email: noteData.email,
      username: noteData.username,
      notes: [noteMeta]
    });
  }
  return { message: 'Note saved and PDF uploaded', pdfUrl: url };
}

exports.saveNote = async (req, res) => {
  try {
    const { error } = validateNoteInput(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });
    const pdfBuffer = await generatePDF(req.body);
    const result = await saveNoteWithPDF(req.body, pdfBuffer);
    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
