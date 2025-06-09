const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize Firebase Admin SDK
const serviceAccount = {
  type: "service_account",
  project_id: process.env.FIREBASE_PROJECT_ID,
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
  private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  client_id: process.env.FIREBASE_CLIENT_ID,
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: `https://${process.env.FIREBASE_PROJECT_ID}-default-rtdb.firebaseio.com`
});

const db = admin.firestore();

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'Blocks Game API is running!', 
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// Get Leaderboard (replaces your LeaderboardQuery)
app.post('/api/getLeaderboard', async (req, res) => {
  try {
    const { limit = 15 } = req.body;

    console.log(`Getting leaderboard with limit: ${limit}`);

    const snapshot = await db.collection('SavedData')
      .orderBy('BlocksHighScore', 'desc')
      .limit(parseInt(limit))
      .get();

    const leaderboard = [];
    snapshot.forEach(doc => {
      leaderboard.push({
        id: doc.id,
        ...doc.data()
      });
    });

    console.log(`Found ${leaderboard.length} leaderboard entries`);

    res.json({ 
      success: true, 
      data: leaderboard,
      count: leaderboard.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Leaderboard error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get leaderboard',
      message: error.message
    });
  }
});

// Save High Score
app.post('/api/saveScore', async (req, res) => {
  try {
    const { score, playerName, userId } = req.body;

    // Validate input
    if (typeof score !== 'number' || score < 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid score'
      });
    }

    if (!playerName || playerName.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Player name is required'
      });
    }

    const playerData = {
      BlocksHighScore: score,
      PlayerName: playerName.trim(),
      LastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      UserId: userId || 'anonymous'
    };

    // Use userId as document ID, or generate one
    const docId = userId || `player_${Date.now()}`;
    
    await db.collection('SavedData').doc(docId).set(playerData);

    console.log(`Score saved: ${playerName} - ${score}`);

    res.json({ 
      success: true, 
      message: 'Score saved successfully',
      data: { score, playerName, userId: docId }
    });

  } catch (error) {
    console.error('Save score error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to save score',
      message: error.message
    });
  }
});

// Load Game Data
app.post('/api/loadGameData', async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }

    const doc = await db.collection('SavedData').doc(userId).get();

    if (!doc.exists) {
      return res.json({
        success: false,
        message: 'No saved data found',
        data: null
      });
    }

    const data = doc.data();
    console.log(`Game data loaded for user: ${userId}`);

    res.json({
      success: true,
      data: data,
      message: 'Game data loaded successfully'
    });

  } catch (error) {
    console.error('Load game data error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load game data',
      message: error.message
    });
  }
});

// Test Firebase Connection
app.get('/api/test', async (req, res) => {
  try {
    // Test Firestore connection
    const testDoc = await db.collection('test').doc('connection').get();
    
    res.json({
      success: true,
      message: 'Firebase connection successful',
      firestore: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Firebase connection failed',
      message: error.message
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: err.message
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    available_endpoints: [
      'GET /',
      'POST /api/getLeaderboard',
      'POST /api/saveScore',
      'POST /api/loadGameData',
      'GET /api/test'
    ]
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Blocks Game API running on port ${PORT}`);
  console.log(`📊 Available endpoints:`);
  console.log(`   GET  /`);
  console.log(`   POST /api/getLeaderboard`);
  console.log(`   POST /api/saveScore`);
  console.log(`   POST /api/loadGameData`);
  console.log(`   GET  /api/test`);
});