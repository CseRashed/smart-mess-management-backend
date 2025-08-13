// server.js
const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');
const jwt=require('jsonwebtoken')
require('dotenv').config();



const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
// const serviceAccount = JSON.parse(process.env.FIREBASE_CONFIG);
const sendConfirmationEmail = require('./config/emailSender');

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
}));
app.use(express.json());


// Firebase Admin Initialization
// admin.initializeApp({
//   credential: admin.credential.cert(serviceAccount),
// });

// MongoDB Setup
const uri = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}.gfesh.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// Collections
let db;
let messCollection, userCollection, mealCollection, expenseCollection, paymentCollection, settlementCollection;

// Generate Unique ID
const generatedIds = new Set();
function generateUniqueId(length = 6) {
  const chars = `${process.env.UNIQUE_KEYS}`;
  let id;
  do {
    id = Array.from({ length }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
  } while (generatedIds.has(id));
  generatedIds.add(id);
  return id;
}

// Connect and Run Server
async function run() {
  try {
    await client.connect();
    console.log("✅ Connected to MongoDB");
// Collection initialize
    db = client.db('smart-messDB');
    messCollection = db.collection('mess');
    userCollection = db.collection('users');
    mealCollection = db.collection('meals');
    expenseCollection = db.collection('expenses');
    paymentCollection = db.collection('payments');
    settlementCollection = db.collection('settlements');
    noticeCollection = db.collection('notice');

// --------------jwt collection------------------//
app.post('/jwt',async(req,res)=>{
  const user=req.body;
  const token=jwt.sign(user,process.env.JWT_SECRET,{expiresIn:'60d'})
  res.send({token})
})
// ----------------| Verify Token| -----------------//
const verifyToken=(req,res,next)=>{
  if(!req.headers.authorization){
    return res.status(401).send({message:'unauthorized access'})
  }
  const token =req?.headers?.authorization.split(' ')[1];
jwt.verify(token,process.env.JWT_SECRET,(error,decoded)=>{
  if(error){
    return res.status(401).send({message:'unauthorized access'})
  }
  req.decoded=decoded
  next()
})
}

//-------------------| Verify Manager |------------------------//
const verifyManager =async(req,res,next)=>{
const email = req.decoded.email;
const query={email:email}
const user = await userCollection.findOne(query)
const isManager = user?.role==='Manager'
if(!isManager){
  return res.status(403).send({message:'forbidden access'})
}
next()
}


    /** -------------------- Member Routes -------------------- */

   app.get('/members', verifyToken, async (req, res) => {
  const { uniqueId, email } = req.query;

  let query = {};

  if (uniqueId || email) {
    query = {
      $or: [
        uniqueId ? { uniqueId } : null,
        email ? { email } : null
      ].filter(Boolean) // null গুলো বাদ দিবে
    };
  }

  try {
    const members = await userCollection.find(query).toArray();
    res.send(members);
  } catch (error) {
    res.status(500).send({ error: 'Failed to fetch members' });
  }
});
// ----------------| Manager and Member Role Change |-----------------//
  app.patch('/members', verifyToken,verifyManager, async (req, res) => {
      const { memberId, managerId } = req.body;

      if (managerId) {
        await userCollection.updateOne({ _id: new ObjectId(managerId) }, { $set: { role: 'Member' } });
      }

      await userCollection.updateOne({ _id: new ObjectId(memberId) }, { $set: { role: 'Manager' } });

      res.send({ success: true, message: 'Manager updated successfully' });
    });

// --------------------| New Member Add |------------------------//
    app.post('/members',verifyToken, verifyManager, async (req, res) => {
      const { name, email, uniqueId } = req.body;
      if (!name || !email || !uniqueId) return res.status(400).json({ error: 'Name, Email and Unique ID are required' });

      const existingUser = await userCollection.findOne({ email });
      if (existingUser) return res.status(409).json({ error: 'This email is already exists' });
      const result = await userCollection.insertOne({ name, email, uniqueId, role: 'Member' });
      res.status(201).json({ success: true, result });
    });
// -------------------| Delete Specific Member |------------------------//
app.delete('/members/:id', verifyToken, verifyManager, async (req, res) => {
  const userId = req.params.id;

  try {
    const user = await userCollection.findOne({ _id: new ObjectId(userId) });
    if (!user) return res.status(404).json({ error: 'User not found in DB' });

    // Delete from DB only
    const result = await userCollection.deleteOne({ _id: new ObjectId(userId) });

    res.json({ message: 'User deleted from DB' }); // Match frontend expectation
  } catch (err) {
    console.error('❌ Error deleting user:', err);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});



    /** --------------------| Mess Routes |-------------------- */

    app.get('/api/mess',verifyToken, async (req, res) => {
      const { id } = req.query;
      const result = id ? await messCollection.findOne({ uniqueId: id }) : await messCollection.find().toArray();
      res.send(result);
    });
// -----------| Create or Join Mess and Generat UniqueId |----------------//
    app.post('/api/mess', async (req, res) => {
  const { mess, name, email, action, messId } = req.body;

  //just token send : login condition
  if (!action && email) {
    const token = jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: '60d' });
    return res.send({ success: true, token });
  }

  //  Field validation
  if (!name || !email || !action) {
    return res.status(400).json({ error: 'Required fields missing' });
  }

  // 🔨 CREATE new mess and and Member
  if (action === 'create') {
    const exists = await userCollection.findOne({ email });
    if (exists) return res.status(409).json({ error: 'Email already registered' });

    const uniqueId = generateUniqueId();
    const messResult = await messCollection.insertOne({ mess, uniqueId });
    const userResult = await userCollection.insertOne({ name, email, uniqueId, role: 'Manager' });

    const token = jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: '60d' });
    return res.send({ success: true, messResult, userResult, uniqueId, token });
  }

  // ➕ JOIN existing mess and Member
  if (action === 'join') {
    if (!messId) return res.status(400).json({ error: 'Mess ID is required' });

    const messExists = await messCollection.findOne({ uniqueId: messId });
    if (!messExists) return res.status(404).json({ error: 'No mess found' });

    const exists = await userCollection.findOne({ email });
    if (exists) return res.status(409).json({ error: 'Email already registered' });

    const userResult = await userCollection.insertOne({ name, email, uniqueId: messId, role: 'Member' });

    const token = jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: '2d' });
    return res.send({ success: true, userResult, token });
  }

  return res.status(400).json({ error: 'Invalid request' });
});


    // --------------------| Meals |-------------------- //

    app.get('/meals',verifyToken, async (req, res) => {
      const { uniqueId, month } = req.query;
      if (!uniqueId) return res.status(400).json({ error: 'uniqueId is required' });

      const filter = { uniqueId };
      if (month) filter.date = new RegExp(`^${month}`);

      const result = await mealCollection.find(filter).toArray();
      res.send(result);
    });
// ----------------| Meals store in Database only Manager |----------------//
    app.post('/meals',verifyToken, verifyManager, async (req, res) => {
      const meals = req.body;
      if (!Array.isArray(meals)) return res.status(400).json({ error: 'Invalid meals format' });

      const result = await mealCollection.insertMany(meals);
      res.status(201).json({ message: 'Meals inserted', insertedCount: result.insertedCount });
    });

    // --------------------| Expenses |-------------------- //

    app.get('/expenses', verifyToken, async (req, res) => {
      const { uniqueId, month } = req.query;
      if (!uniqueId) return res.status(400).json({ error: 'uniqueId is required' });

      const filter = { uniqueId };
      if (month) filter.date = new RegExp(`^${month}`);

      const result = await expenseCollection.find(filter).toArray();
      res.send(result);
    });
// ----------------| Daily Expense store Database only Manager |----------------//
    app.post('/expenses', verifyToken,verifyManager, async (req, res) => {
      const result = await expenseCollection.insertOne(req.body);
      res.send(result);
    });

    /** -------------------- Payments -------------------- */

    app.get('/payments',verifyToken, async (req, res) => {
      const { uniqueId, month } = req.query;
      if (!uniqueId || !month) return res.status(400).json({ error: 'Required fields missing' });

      const payments = await paymentCollection.find({ uniqueId, month }).toArray();
      res.json(payments);
    });

// ----------------| Indivitual Payment store |------------------//
app.post('/payments',verifyToken,verifyManager,  async (req, res) => {
  const payments = req.body;
  if (!Array.isArray(payments)) {
    return res.status(400).json({ error: 'Invalid format' });
  }

  try {
    // 1. Save all payments
    const bulkOps = payments.map(payment => ({
      updateOne: {
        filter: {
          memberId: payment.memberId,
          month: payment.month,
          uniqueId: payment.uniqueId
        },
        update: { $set: payment },
        upsert: true
      }
    }));
    const result = await paymentCollection.bulkWrite(bulkOps);

    // Email Send for Monthly Payment//
    for (const payment of payments) {
      try {
        await sendConfirmationEmail(payment);
      } catch (emailErr) {
      }
    }

    res.status(200).json({ success: true, result });
  } catch (err) {
    console.error('Payment error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});



    /** -------------------- Settlement -------------------- */

    app.get('/settlement', async (req, res) => {
      const result = await settlementCollection.find().toArray();
      res.send(result);
    });
// if any mebmer paid her all amount and manager settle or paid her list 
    app.post('/settlement',verifyToken,verifyManager, async (req, res) => {
      const result = await settlementCollection.insertOne(req.body);
      res.send(result);
    });

    /** -------------------- Notice -------------------- */
  app.get('/notice', async (req, res) => {
  const { uniqueId } = req.query;  
  if (!uniqueId) {
    return res.status(400).json({ error: 'uniqueId is required' });
  }
  const result = await noticeCollection.findOne({ uniqueId: uniqueId });
  if (!result) {
    return res.status(404).json({ message: 'Notice not found' });
  }
  res.send(result);
});

// -------------| Notice Create by Mess Manager |---------------//
 app.patch('/notice', verifyToken, verifyManager, async (req, res) => {
  const { notice, uniqueId } = req.body;

  if (!notice || typeof notice !== 'string' || notice.trim() === '') {
    return res.status(400).json({ message: 'Notice text is required' });
  }
  if (!uniqueId) {
    return res.status(400).json({ message: 'uniqueId is required' });
  }

  try {
    const filter = { uniqueId };
    const update = {
      $set: { notice }
    };

    const options = { upsert: true };

    const result = await noticeCollection.updateOne(filter, update, options);

    res.status(200).json({ success: true, result });
  } catch (error) {
    res.status(500).json({ message: 'Server error while updating notice' });
  }
});




    // Health Check
    await client.db("admin").command({ ping: 1 });
  } catch (err) {
  }
}

run().catch(console.dir);

// Start server
app.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`);
});

