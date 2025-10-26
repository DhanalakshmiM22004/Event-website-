// server.js - EventEase Backend WITH PAYMENT INTEGRATION
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const nodemailer = require('nodemailer');
const QRCode = require('qrcode');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// CORS Configuration
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/eventease';
mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => {
  console.log('✅ MongoDB Connected');
}).catch(err => {
  console.log('⚠️ MongoDB not connected (using in-memory storage):', err.message);
});

// MongoDB Schemas
const bookingSchema = new mongoose.Schema({
  bookingId: { type: String, unique: true, required: true },
  eventTitle: { type: String, required: true },
  eventDate: { type: String, required: true },
  eventTime: { type: String, required: true },
  eventLocation: { type: String, required: true },
  ticketQuantity: { type: Number, required: true, min: 1 },
  totalAmount: { type: Number, required: true },
  userName: { type: String, required: true },
  userEmail: { type: String, required: true },
  userPhone: { type: String },
  price: { type: Number, required: true },
  qrCode: { type: String },
  bookingDate: { type: Date, default: Date.now },
  status: { type: String, enum: ['pending', 'confirmed', 'cancelled', 'completed'], default: 'pending' },
  paymentStatus: { type: String, enum: ['pending', 'completed', 'failed', 'refunded'], default: 'pending' },
  paymentMethod: { type: String },
  paymentId: { type: String },
  paymentToken: { type: String },
  paymentDate: { type: Date }
});

const Booking = mongoose.model('Booking', bookingSchema);

// In-memory storage (fallback)
let inMemoryBookings = [];

// Helper Functions
const generateBookingId = () => {
  return 'BK' + Date.now() + Math.random().toString(36).substr(2, 9).toUpperCase();
};

const generateTransactionId = () => {
  return 'TXN' + Date.now() + Math.random().toString(36).substr(2, 9).toUpperCase();
};

// Email Configuration
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'your-email@gmail.com',
    pass: process.env.EMAIL_PASSWORD || 'your-password'
  }
});

transporter.verify(function(error, success) {
  if (error) {
    console.log('⚠️ Email service not configured:', error.message);
  } else {
    console.log('✅ Email service ready');
  }
});

// Send Confirmation Email
const sendConfirmationEmail = async (userEmail, booking) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: userEmail,
    subject: `🎉 Payment Successful - ${booking.eventTitle}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: 'Poppins', Arial, sans-serif; background-color: #0a0a0a; color: #ffffff; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #1a0033 0%, #0a0a0a 100%); border: 2px solid #7c3aed; border-radius: 16px; padding: 40px; }
          .header { text-align: center; margin-bottom: 30px; }
          .logo { font-size: 32px; font-weight: bold; background: linear-gradient(135deg, #a855f7 0%, #7c3aed 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
          .success-icon { font-size: 64px; margin: 20px 0; }
          .ticket { background: rgba(126, 58, 237, 0.1); border: 2px solid #7c3aed; border-radius: 12px; padding: 30px; margin: 20px 0; }
          .event-title { font-size: 24px; font-weight: bold; color: #a855f7; margin-bottom: 20px; }
          .detail-row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid rgba(126, 58, 237, 0.3); }
          .detail-label { color: #9ca3af; }
          .detail-value { color: #ffffff; font-weight: 600; }
          .qr-section { text-align: center; margin: 30px 0; }
          .button { display: inline-block; padding: 16px 32px; background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%); color: white; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 10px; }
          .footer { text-align: center; margin-top: 40px; color: #6b7280; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">🎟️ EventEase</div>
            <div class="success-icon">✅</div>
            <h1 style="color: #a855f7; margin: 10px 0;">Payment Successful!</h1>
            <p style="color: #9ca3af;">Your booking has been confirmed</p>
          </div>
          
          <div class="ticket">
            <div class="event-title">${booking.eventTitle}</div>
            
            <div class="detail-row">
              <span class="detail-label">Booking ID</span>
              <span class="detail-value">${booking.bookingId}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Transaction ID</span>
              <span class="detail-value">${booking.paymentId || 'N/A'}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Date & Time</span>
              <span class="detail-value">${booking.eventDate} at ${booking.eventTime}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Location</span>
              <span class="detail-value">${booking.eventLocation}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Tickets</span>
              <span class="detail-value">${booking.ticketQuantity} x ₹${booking.price}</span>
            </div>
            <div class="detail-row" style="border-bottom: none; padding-top: 20px; margin-top: 10px; border-top: 2px solid #7c3aed;">
              <span class="detail-label" style="font-size: 18px; color: #a855f7;">Total Paid</span>
              <span class="detail-value" style="font-size: 24px; color: #a855f7;">₹${booking.totalAmount}</span>
            </div>
          </div>
          
          <div class="qr-section">
            <h3 style="color: #a855f7; margin-bottom: 15px;">🎫 Your Entry QR Code</h3>
            <img src="${booking.qrCode}" alt="QR Code" style="max-width: 250px; border: 3px solid #7c3aed; border-radius: 12px; padding: 15px; background: white;" />
            <p style="color: #9ca3af; margin-top: 15px; font-size: 14px;">Show this QR code at the event entrance</p>
          </div>
          
          <div style="background: rgba(168, 85, 247, 0.1); border-left: 4px solid #a855f7; padding: 20px; margin: 30px 0; border-radius: 8px;">
            <p style="margin: 0; color: #e5e7eb; font-weight: 600;">📌 Important Information:</p>
            <ul style="color: #9ca3af; margin-top: 10px; padding-left: 20px;">
              <li>Arrive 30 minutes before the event</li>
              <li>Carry a valid photo ID</li>
              <li>This ticket is non-transferable</li>
              <li>Check your spam folder for this email</li>
            </ul>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="#" class="button">View My Bookings</a>
            <a href="#" class="button" style="background: rgba(126, 58, 237, 0.3);">Download Ticket</a>
          </div>
          
          <div class="footer">
            <p style="font-weight: 600; color: #a855f7;">Thank you for choosing EventEase!</p>
            <p style="margin-top: 20px;">Questions? Contact us at support@eventease.com</p>
            <p style="margin-top: 5px;">Call: +91 98765 43210</p>
            <p style="margin-top: 20px; font-size: 12px;">&copy; 2025 EventEase. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('✅ Confirmation email sent to', userEmail);
    return true;
  } catch (error) {
    console.error('❌ Email error:', error.message);
    return false;
  }
};

// ============ BOOKING WITH PAYMENT ROUTE ============

app.post('/api/bookings/with-payment', async (req, res) => {
  try {
    console.log('💳 Booking with payment request received:', req.body);

    const { 
      eventTitle, 
      eventDate, 
      eventTime, 
      eventLocation, 
      ticketQuantity, 
      userName, 
      userEmail, 
      userPhone, 
      price,
      totalAmount,
      paymentMethod,
      paymentToken,
      paymentId
    } = req.body;

    // Validate required fields
    if (!eventTitle || !ticketQuantity || !userName || !userEmail || !totalAmount) {
      console.log('❌ Missing required fields');
      return res.status(400).json({ 
        success: false,
        error: 'Missing required booking information' 
      });
    }

    // Generate IDs
    const bookingId = generateBookingId();
    const transactionId = paymentId || generateTransactionId();

    console.log('🎫 Processing payment and generating booking:', bookingId);

    // Simulate payment verification
    // In production, verify payment with payment gateway
    const paymentVerified = true; // Replace with actual payment verification

    if (!paymentVerified) {
      return res.status(400).json({
        success: false,
        error: 'Payment verification failed'
      });
    }

    // Generate QR Code
    const qrData = JSON.stringify({
      type: 'EventEase_Ticket',
      bookingId,
      eventTitle,
      eventDate,
      eventTime,
      eventLocation,
      userName,
      ticketQuantity,
      totalAmount,
      timestamp: new Date().toISOString(),
      verificationUrl: `https://eventease.com/verify/${bookingId}`
    });
    
    const qrCode = await QRCode.toDataURL(qrData, {
      errorCorrectionLevel: 'H',
      type: 'image/png',
      quality: 0.92,
      margin: 1,
      color: {
        dark: '#7c3aed',
        light: '#ffffff'
      }
    });

    // Create booking with payment info
    const bookingData = {
      bookingId,
      eventTitle,
      eventDate,
      eventTime,
      eventLocation,
      ticketQuantity,
      totalAmount,
      userName,
      userEmail,
      userPhone: userPhone || 'N/A',
      price,
      qrCode,
      bookingDate: new Date(),
      status: 'confirmed',
      paymentStatus: 'completed',
      paymentMethod: paymentMethod || 'unknown',
      paymentId: transactionId,
      paymentToken: paymentToken || 'N/A',
      paymentDate: new Date()
    };

    console.log('💾 Saving booking with payment:', bookingData);

    // Save to database
    try {
      const dbBooking = new Booking(bookingData);
      await dbBooking.save();
      console.log('✅ Booking saved to MongoDB');
    } catch (dbError) {
      console.log('📌 Using in-memory storage:', dbError.message);
      inMemoryBookings.push(bookingData);
    }

    // Send confirmation email
    sendConfirmationEmail(userEmail, bookingData).catch(err => {
      console.log('⚠️ Email failed but booking succeeded:', err.message);
    });

    console.log('✅ Booking with payment completed:', bookingId);

    // Return complete booking data
    res.status(201).json({ 
      success: true,
      message: 'Payment successful! Booking confirmed.', 
      booking: {
        bookingId: bookingData.bookingId,
        eventId: Date.now().toString(),
        eventTitle: bookingData.eventTitle,
        eventDate: bookingData.eventDate,
        eventTime: bookingData.eventTime,
        eventLocation: bookingData.eventLocation,
        quantity: bookingData.ticketQuantity,
        totalAmount: bookingData.totalAmount,
        userName: bookingData.userName,
        userEmail: bookingData.userEmail,
        userPhone: bookingData.userPhone,
        price: bookingData.price,
        qrCode: bookingData.qrCode,
        status: bookingData.status,
        paymentStatus: bookingData.paymentStatus,
        paymentMethod: bookingData.paymentMethod,
        paymentId: bookingData.paymentId,
        bookingDate: bookingData.bookingDate
      }
    });
  } catch (error) {
    console.error('❌ Booking with payment error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error processing booking with payment',
      message: error.message 
    });
  }
});

// ============ VERIFY PAYMENT STATUS ============

app.post('/api/payments/verify', async (req, res) => {
  try {
    const { paymentId, bookingId } = req.body;
    
    console.log('🔍 Verifying payment:', paymentId);
    
    // In production, verify with payment gateway
    // For demo, return success
    const verified = true;
    
    if (verified) {
      // Update booking status
      try {
        await Booking.updateOne(
          { bookingId },
          { 
            $set: { 
              paymentStatus: 'completed',
              status: 'confirmed',
              paymentDate: new Date()
            }
          }
        );
      } catch {
        const booking = inMemoryBookings.find(b => b.bookingId === bookingId);
        if (booking) {
          booking.paymentStatus = 'completed';
          booking.status = 'confirmed';
          booking.paymentDate = new Date();
        }
      }
      
      res.json({
        success: true,
        message: 'Payment verified successfully',
        verified: true
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Payment verification failed',
        verified: false
      });
    }
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: 'Payment verification error' 
    });
  }
});

// ============ GET PAYMENT DETAILS ============

app.get('/api/payments/:bookingId', async (req, res) => {
  try {
    const { bookingId } = req.params;
    
    let booking;
    try {
      booking = await Booking.findOne({ bookingId });
    } catch {
      booking = inMemoryBookings.find(b => b.bookingId === bookingId);
    }

    if (!booking) {
      return res.status(404).json({ 
        success: false,
        error: 'Booking not found' 
      });
    }

    res.json({
      success: true,
      payment: {
        bookingId: booking.bookingId,
        paymentStatus: booking.paymentStatus,
        paymentMethod: booking.paymentMethod,
        paymentId: booking.paymentId,
        amount: booking.totalAmount,
        paymentDate: booking.paymentDate
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: 'Error fetching payment details' 
    });
  }
});

// ============ REFUND PAYMENT ============

app.post('/api/payments/refund', async (req, res) => {
  try {
    const { bookingId, reason } = req.body;
    
    console.log('💰 Processing refund for:', bookingId);
    
    let booking;
    try {
      booking = await Booking.findOne({ bookingId });
    } catch {
      booking = inMemoryBookings.find(b => b.bookingId === bookingId);
    }

    if (!booking) {
      return res.status(404).json({ 
        success: false,
        error: 'Booking not found' 
      });
    }

    if (booking.paymentStatus === 'refunded') {
      return res.status(400).json({ 
        success: false,
        error: 'Payment already refunded' 
      });
    }

    // In production, process refund with payment gateway
    const refundSuccess = true;

    if (refundSuccess) {
      try {
        await Booking.updateOne(
          { bookingId },
          { 
            $set: { 
              paymentStatus: 'refunded',
              status: 'cancelled',
              refundDate: new Date(),
              refundReason: reason
            }
          }
        );
      } catch {
        booking.paymentStatus = 'refunded';
        booking.status = 'cancelled';
        booking.refundDate = new Date();
      }
      
      res.json({
        success: true,
        message: 'Refund processed successfully',
        refundAmount: booking.totalAmount
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Refund processing failed'
      });
    }
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: 'Refund processing error' 
    });
  }
});
// ============ AUTH ROUTES ============

// Sign Up
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    console.log('📝 Signup request:', { name, email });

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const userData = {
      id: Date.now().toString(),
      name,
      email,
      password: hashedPassword,
      phone,
      createdAt: new Date()
    };

    try {
      const dbUser = new User(userData);
      await dbUser.save();
      userData.id = dbUser._id.toString();
    } catch (dbError) {
      console.log('Using in-memory storage');
      inMemoryUsers.push(userData);
    }

    const token = jwt.sign(
      { userId: userData.id, email: userData.email },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    console.log('✅ User created:', email);

    res.status(201).json({
      message: 'User created successfully',
      token,
      user: { id: userData.id, name: userData.name, email: userData.email }
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Server error during signup' });
  }
});

// Sign In
app.post('/api/auth/signin', async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log('🔑 Signin request:', email);

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    let user;
    try {
      user = await User.findOne({ email });
    } catch {
      user = inMemoryUsers.find(u => u.email === email);
    }

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { userId: user.id || user._id, email: user.email },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    console.log('✅ User signed in:', email);

    res.json({
      message: 'Login successful',
      token,
      user: { id: user.id || user._id, name: user.name, email: user.email }
    });
  } catch (error) {
    console.error('Signin error:', error);
    res.status(500).json({ error: 'Server error during signin' });
  }
});
// ============ ORIGINAL BOOKING ROUTE (Keep for backward compatibility) ============

app.post('/api/bookings', async (req, res) => {
  try {
    console.log('📝 Regular booking request received:', req.body);

    const { 
      eventTitle, 
      eventDate, 
      eventTime, 
      eventLocation, 
      ticketQuantity, 
      userName, 
      userEmail, 
      userPhone, 
      price 
    } = req.body;

    if (!eventTitle || !ticketQuantity || !userName || !userEmail) {
      return res.status(400).json({ error: 'Missing required booking information' });
    }

    const totalAmount = (price || 0) * ticketQuantity;
    const bookingId = generateBookingId();

    const qrData = JSON.stringify({
      type: 'EventEase_Ticket',
      bookingId,
      eventTitle,
      userName,
      ticketQuantity,
      eventDate,
      eventLocation,
      timestamp: new Date().toISOString()
    });
    
    const qrCode = await QRCode.toDataURL(qrData, {
      errorCorrectionLevel: 'H',
      type: 'image/png',
      quality: 0.92,
      margin: 1,
      color: {
        dark: '#7c3aed',
        light: '#ffffff'
      }
    });

    const bookingData = {
      bookingId,
      eventTitle,
      eventDate,
      eventTime,
      eventLocation,
      ticketQuantity,
      totalAmount,
      userName,
      userEmail,
      userPhone: userPhone || 'N/A',
      price,
      qrCode,
      bookingDate: new Date(),
      status: 'confirmed',
      paymentStatus: 'completed'
    };

    try {
      const dbBooking = new Booking(bookingData);
      await dbBooking.save();
    } catch (dbError) {
      inMemoryBookings.push(bookingData);
    }

    res.status(201).json({ 
      success: true,
      message: 'Booking confirmed successfully', 
      booking: {
        bookingId: bookingData.bookingId,
        eventId: Date.now().toString(),
        eventTitle: bookingData.eventTitle,
        eventDate: bookingData.eventDate,
        eventTime: bookingData.eventTime,
        eventLocation: bookingData.eventLocation,
        quantity: bookingData.ticketQuantity,
        totalAmount: bookingData.totalAmount,
        userName: bookingData.userName,
        userEmail: bookingData.userEmail,
        userPhone: bookingData.userPhone,
        price: bookingData.price,
        qrCode: bookingData.qrCode,
        status: bookingData.status,
        bookingDate: bookingData.bookingDate
      }
    });
  } catch (error) {
    console.error('❌ Booking error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error creating booking',
      message: error.message 
    });
  }
});

// ============ GET BOOKINGS ============

app.get('/api/bookings/my-bookings', async (req, res) => {
  try {
    let bookings = [];
    try {
      bookings = await Booking.find().sort({ bookingDate: -1 });
    } catch {
      bookings = inMemoryBookings;
    }
    res.json(bookings);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching bookings' });
  }
});

app.get('/api/bookings/:bookingId', async (req, res) => {
  try {
    const { bookingId } = req.params;
    
    let booking;
    try {
      booking = await Booking.findOne({ bookingId });
    } catch {
      booking = inMemoryBookings.find(b => b.bookingId === bookingId);
    }

    if (!booking) {
      return res.status(404).json({ 
        success: false,
        error: 'Booking not found' 
      });
    }

    res.json({
      success: true,
      booking
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: 'Error fetching booking' 
    });
  }
});

// ============ HEALTH CHECK ============

app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'EventEase API with Payment Integration',
    timestamp: new Date().toISOString(),
    bookings: inMemoryBookings.length,
    features: ['booking', 'payment', 'qr-generation', 'email-confirmation']
  });
});

app.get('/', (req, res) => {
  res.json({
    message: 'EventEase API Server with Payment',
    version: '2.0.0',
    endpoints: {
      bookings: '/api/bookings',
      bookingWithPayment: '/api/bookings/with-payment',
      verifyPayment: '/api/payments/verify',
      paymentDetails: '/api/payments/:bookingId',
      refund: '/api/payments/refund',
      health: '/health'
    }
  });
});
// ============ CALENDAR SYNC ENDPOINTS ============

// Google Calendar sync
app.post('/api/calendar/google', async (req, res) => {
  try {
    const { eventTitle, eventDate, eventTime, eventLocation, description } = req.body;

    const startDate = new Date(eventDate).toISOString().replace(/-|:|\.\d\d\d/g, '');
    const endDate = new Date(new Date(eventDate).getTime() + 2 * 60 * 60 * 1000).toISOString().replace(/-|:|\.\d\d\d/g, '');

    const googleCalendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(eventTitle)}&dates=${startDate}/${endDate}&details=${encodeURIComponent(description || 'Event booked via EventEase')}&location=${encodeURIComponent(eventLocation)}`;

    res.json({ success: true, url: googleCalendarUrl });
  } catch (error) {
    res.status(500).json({ error: 'Error generating calendar link' });
  }
});

// Outlook Calendar sync
app.post('/api/calendar/outlook', async (req, res) => {
  try {
    const { eventTitle, eventDate, eventTime, eventLocation, description } = req.body;

    const startDate = new Date(eventDate).toISOString();
    const endDate = new Date(new Date(eventDate).getTime() + 2 * 60 * 60 * 1000).toISOString();

    const outlookUrl = `https://outlook.live.com/calendar/0/deeplink/compose?subject=${encodeURIComponent(eventTitle)}&startdt=${startDate}&enddt=${endDate}&body=${encodeURIComponent(description || 'Event booked via EventEase')}&location=${encodeURIComponent(eventLocation)}`;

    res.json({ success: true, url: outlookUrl });
  } catch (error) {
    res.status(500).json({ error: 'Error generating calendar link' });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'EventEase Node.js API is running',
    timestamp: new Date().toISOString(),
    bookings: inMemoryBookings.length
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'EventEase API Server',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth/signup, /api/auth/signin',
      bookings: '/api/bookings',
      calendar: '/api/calendar/google, /api/calendar/outlook',
      health: '/health'
    }
  });
});
// Error handling
app.use((err, req, res, next) => {
  console.error('❌ Server error:', err);
  res.status(500).json({ 
    success: false,
    error: 'Internal server error',
    message: err.message 
  });
});
// ADD TO YOUR server.js (Node.js Backend)

// ============ CREATE EVENT ENDPOINT ============

app.post('/api/events/create', async (req, res) => {
  try {
    console.log('📝 Creating new event:', req.body.title);
    
    const {
      title,
      category,
      description,
      date,
      time,
      location,
      venue,
      city,
      state,
      address,
      price,
      maxAttendees,
      attendees,
      image,
      highlights,
      whatToExpect,
      contactEmail,
      contactPhone,
      createdBy,
      createdByEmail
    } = req.body;
    
    // Validate required fields
    if (!title || !category || !description || !date || !time || !location || !contactEmail) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }
    
    // Generate event ID
    const eventId = 'EVENT-' + Date.now() + Math.random().toString(36).substr(2, 9).toUpperCase();
    
    // Create event object
    const eventData = {
      eventId: eventId,
      title,
      category,
      description,
      date,
      time,
      location,
      venue,
      city,
      state,
      address: address || '',
      price: parseInt(price) || 0,
      maxAttendees: parseInt(maxAttendees) || 100,
      attendees: attendees || 0,
      image: image || '',
      highlights: highlights || [],
      whatToExpect: whatToExpect || '',
      contactEmail,
      contactPhone: contactPhone || '',
      createdBy: createdBy || 'Anonymous',
      createdByEmail: createdByEmail || '',
      createdAt: new Date(),
      status: 'active',
      bookings: []
    };
    
    // Save to database
    let savedEvent;
    try {
      if (events_collection) {
        const dbEvent = await events_collection.insertOne(eventData);
        savedEvent = { ...eventData, _id: dbEvent.insertedId };
        console.log('✅ Event saved to MongoDB');
      } else {
        throw new Error('Database not connected');
      }
    } catch (dbError) {
      console.log('📌 Using in-memory storage:', dbError.message);
      // In-memory fallback
      if (!global.inMemoryEvents) {
        global.inMemoryEvents = [];
      }
      global.inMemoryEvents.push(eventData);
      savedEvent = eventData;
    }
    
    // Send confirmation email to creator
    try {
      await sendEventCreatedEmail(contactEmail, eventData);
    } catch (emailError) {
      console.log('⚠️ Email notification failed:', emailError.message);
    }
    
    console.log('✅ Event created successfully:', eventId);
    
    res.status(201).json({
      success: true,
      message: 'Event created successfully',
      event: {
        eventId: eventData.eventId,
        title: eventData.title,
        category: eventData.category,
        date: eventData.date,
        time: eventData.time,
        location: eventData.location,
        price: eventData.price,
        status: eventData.status
      }
    });
    
  } catch (error) {
    console.error('❌ Create event error:', error);
    res.status(500).json({
      success: false,
      error: 'Error creating event',
      message: error.message
    });
  }
});

// ============ GET ALL EVENTS ============

app.get('/api/events', async (req, res) => {
  try {
    const { category, search, status = 'active' } = req.query;
    
    let query = { status };
    
    if (category) {
      query.category = category;
    }
    
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { location: { $regex: search, $options: 'i' } }
      ];
    }
    
    let events;
    try {
      if (events_collection) {
        events = await events_collection.find(query).sort({ createdAt: -1 }).toArray();
      } else {
        throw new Error('Database not connected');
      }
    } catch (dbError) {
      events = global.inMemoryEvents || [];
      
      // Apply filters manually
      if (category) {
        events = events.filter(e => e.category === category);
      }
      if (search) {
        const searchLower = search.toLowerCase();
        events = events.filter(e => 
          e.title.toLowerCase().includes(searchLower) ||
          e.description.toLowerCase().includes(searchLower) ||
          e.location.toLowerCase().includes(searchLower)
        );
      }
      events = events.filter(e => e.status === status);
    }
    
    res.json({
      success: true,
      count: events.length,
      events: events
    });
    
  } catch (error) {
    console.error('❌ Get events error:', error);
    res.status(500).json({
      success: false,
      error: 'Error fetching events'
    });
  }
});

// ============ GET SINGLE EVENT ============

app.get('/api/events/:eventId', async (req, res) => {
  try {
    const { eventId } = req.params;
    
    let event;
    try {
      if (events_collection) {
        event = await events_collection.findOne({ eventId });
      } else {
        throw new Error('Database not connected');
      }
    } catch (dbError) {
      const events = global.inMemoryEvents || [];
      event = events.find(e => e.eventId === eventId);
    }
    
    if (!event) {
      return res.status(404).json({
        success: false,
        error: 'Event not found'
      });
    }
    
    res.json({
      success: true,
      event: event
    });
    
  } catch (error) {
    console.error('❌ Get event error:', error);
    res.status(500).json({
      success: false,
      error: 'Error fetching event'
    });
  }
});

// ============ UPDATE EVENT ============

app.put('/api/events/:eventId', async (req, res) => {
  try {
    const { eventId } = req.params;
    const updateData = req.body;
    
    console.log('📝 Updating event:', eventId);
    
    // Remove fields that shouldn't be updated
    delete updateData.eventId;
    delete updateData.createdAt;
    delete updateData.createdBy;
    delete updateData.createdByEmail;
    
    updateData.updatedAt = new Date();
    
    let updatedEvent;
    try {
      if (events_collection) {
        const result = await events_collection.findOneAndUpdate(
          { eventId },
          { $set: updateData },
          { returnDocument: 'after' }
        );
        updatedEvent = result.value;
      } else {
        throw new Error('Database not connected');
      }
    } catch (dbError) {
      const events = global.inMemoryEvents || [];
      const index = events.findIndex(e => e.eventId === eventId);
      if (index !== -1) {
        events[index] = { ...events[index], ...updateData };
        updatedEvent = events[index];
      }
    }
    
    if (!updatedEvent) {
      return res.status(404).json({
        success: false,
        error: 'Event not found'
      });
    }
    
    console.log('✅ Event updated successfully');
    
    res.json({
      success: true,
      message: 'Event updated successfully',
      event: updatedEvent
    });
    
  } catch (error) {
    console.error('❌ Update event error:', error);
    res.status(500).json({
      success: false,
      error: 'Error updating event'
    });
  }
});

// ============ DELETE EVENT ============

app.delete('/api/events/:eventId', async (req, res) => {
  try {
    const { eventId } = req.params;
    
    console.log('🗑️ Deleting event:', eventId);
    
    let deleted = false;
    try {
      if (events_collection) {
        const result = await events_collection.deleteOne({ eventId });
        deleted = result.deletedCount > 0;
      } else {
        throw new Error('Database not connected');
      }
    } catch (dbError) {
      const events = global.inMemoryEvents || [];
      const index = events.findIndex(e => e.eventId === eventId);
      if (index !== -1) {
        events.splice(index, 1);
        deleted = true;
      }
    }
    
    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Event not found'
      });
    }
    
    console.log('✅ Event deleted successfully');
    
    res.json({
      success: true,
      message: 'Event deleted successfully'
    });
    
  } catch (error) {
    console.error('❌ Delete event error:', error);
    res.status(500).json({
      success: false,
      error: 'Error deleting event'
    });
  }
});

// ============ SEND EVENT CREATED EMAIL ============

async function sendEventCreatedEmail(email, eventData) {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: `🎉 Your Event "${eventData.title}" is Now Live!`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: 'Poppins', Arial, sans-serif; background-color: #0a0a0a; color: #ffffff; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #1a0033 0%, #0a0a0a 100%); border: 2px solid #7c3aed; border-radius: 16px; padding: 40px; }
          .header { text-align: center; margin-bottom: 30px; }
          .logo { font-size: 32px; font-weight: bold; background: linear-gradient(135deg, #a855f7 0%, #7c3aed 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
          .success-icon { font-size: 64px; margin: 20px 0; }
          .event-card { background: rgba(126, 58, 237, 0.1); border: 2px solid #7c3aed; border-radius: 12px; padding: 30px; margin: 20px 0; }
          .event-title { font-size: 24px; font-weight: bold; color: #a855f7; margin-bottom: 20px; }
          .detail-row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid rgba(126, 58, 237, 0.3); }
          .detail-label { color: #9ca3af; }
          .detail-value { color: #ffffff; font-weight: 600; }
          .button { display: inline-block; padding: 16px 32px; background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%); color: white; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 10px; }
          .footer { text-align: center; margin-top: 40px; color: #6b7280; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">🎟️ EventEase</div>
            <div class="success-icon">🎉</div>
            <h1 style="color: #a855f7; margin: 10px 0;">Event Published Successfully!</h1>
            <p style="color: #9ca3af;">Your event is now live and ready for bookings</p>
          </div>
          
          <div class="event-card">
            <div class="event-title">${eventData.title}</div>
            
            <div class="detail-row">
              <span class="detail-label">Event ID</span>
              <span class="detail-value">${eventData.eventId}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Category</span>
              <span class="detail-value">${eventData.category}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Date & Time</span>
              <span class="detail-value">${eventData.date} at ${eventData.time}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Location</span>
              <span class="detail-value">${eventData.location}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Price</span>
              <span class="detail-value">${eventData.price === 0 ? 'FREE' : '₹' + eventData.price}</span>
            </div>
            <div class="detail-row" style="border-bottom: none;">
              <span class="detail-label">Max Attendees</span>
              <span class="detail-value">${eventData.maxAttendees}</span>
            </div>
          </div>
          
          <div style="background: rgba(168, 85, 247, 0.1); border-left: 4px solid #a855f7; padding: 20px; margin: 20px 0; border-radius: 8px;">
            <p style="margin: 0; color: #e5e7eb; font-weight: 600;">✨ What's Next:</p>
            <ul style="color: #9ca3af; margin-top: 10px; padding-left: 20px;">
              <li>Your event is now visible to all users</li>
              <li>Users can start booking tickets immediately</li>
              <li>You'll receive email notifications for each booking</li>
              <li>Track your event performance in the dashboard</li>
            </ul>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="https://eventease.com/events/${eventData.eventId}" class="button">View Event</a>
            <a href="https://eventease.com/dashboard" class="button" style="background: rgba(126, 58, 237, 0.3);">Manage Events</a>
          </div>
          
          <div class="footer">
            <p style="font-weight: 600; color: #a855f7;">Thank you for choosing EventEase!</p>
            <p style="margin-top: 20px;">Questions? Contact us at support@eventease.com</p>
            <p style="margin-top: 5px;">Call: +91 98765 43210</p>
            <p style="margin-top: 20px; font-size: 12px;">&copy; 2025 EventEase. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('✅ Event creation confirmation email sent to', email);
    return true;
  } catch (error) {
    console.error('❌ Email error:', error.message);
    return false;
  }
}

console.log('✅ Event creation endpoints loaded');

// ============ GET MY EVENTS (for event creators) ============

app.get('/api/events/my-events/:email', async (req, res) => {
  try {
    const { email } = req.params;
    
    console.log('📋 Fetching events for creator:', email);
    
    let events;
    try {
      if (events_collection) {
        events = await events_collection.find({ 
          createdByEmail: email 
        }).sort({ createdAt: -1 }).toArray();
      } else {
        throw new Error('Database not connected');
      }
    } catch (dbError) {
      const allEvents = global.inMemoryEvents || [];
      events = allEvents.filter(e => e.createdByEmail === email);
    }
    
    res.json({
      success: true,
      count: events.length,
      events: events
    });
    
  } catch (error) {
    console.error('❌ Get my events error:', error);
    res.status(500).json({
      success: false,
      error: 'Error fetching events'
    });
  }
});

// ============ GET EVENT BOOKINGS (for event creators) ============

app.get('/api/events/:eventId/bookings', async (req, res) => {
  try {
    const { eventId } = req.params;
    
    console.log('📊 Fetching bookings for event:', eventId);
    
    let bookings;
    try {
      if (bookings_collection) {
        bookings = await bookings_collection.find({ 
          eventId: eventId 
        }).sort({ bookingDate: -1 }).toArray();
      } else {
        throw new Error('Database not connected');
      }
    } catch (dbError) {
      bookings = inMemoryBookings.filter(b => b.eventId === eventId);
    }
    
    // Calculate statistics
    const totalRevenue = bookings.reduce((sum, b) => sum + (b.totalAmount || 0), 0);
    const totalTickets = bookings.reduce((sum, b) => sum + (b.ticketQuantity || 0), 0);
    const confirmedBookings = bookings.filter(b => b.status === 'confirmed').length;
    
    res.json({
      success: true,
      count: bookings.length,
      statistics: {
        totalBookings: bookings.length,
        confirmedBookings: confirmedBookings,
        totalRevenue: totalRevenue,
        totalTickets: totalTickets
      },
      bookings: bookings
    });
    
  } catch (error) {
    console.error('❌ Get event bookings error:', error);
    res.status(500).json({
      success: false,
      error: 'Error fetching bookings'
    });
  }
});

// ============ SEARCH EVENTS ============

app.get('/api/events/search', async (req, res) => {
  try {
    const { q, category, minPrice, maxPrice, city } = req.query;
    
    let query = { status: 'active' };
    
    // Build search query
    if (q) {
      query.$or = [
        { title: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } },
        { location: { $regex: q, $options: 'i' } }
      ];
    }
    
    if (category) {
      query.category = category;
    }
    
    if (city) {
      query.city = { $regex: city, $options: 'i' };
    }
    
    if (minPrice !== undefined || maxPrice !== undefined) {
      query.price = {};
      if (minPrice !== undefined) query.price.$gte = parseInt(minPrice);
      if (maxPrice !== undefined) query.price.$lte = parseInt(maxPrice);
    }
    
    let events;
    try {
      if (events_collection) {
        events = await events_collection.find(query).sort({ createdAt: -1 }).toArray();
      } else {
        throw new Error('Database not connected');
      }
    } catch (dbError) {
      events = global.inMemoryEvents || [];
      
      // Apply filters manually
      events = events.filter(e => e.status === 'active');
      
      if (q) {
        const searchLower = q.toLowerCase();
        events = events.filter(e => 
          e.title.toLowerCase().includes(searchLower) ||
          e.description.toLowerCase().includes(searchLower) ||
          e.location.toLowerCase().includes(searchLower)
        );
      }
      
      if (category) {
        events = events.filter(e => e.category === category);
      }
      
      if (city) {
        events = events.filter(e => 
          e.city && e.city.toLowerCase().includes(city.toLowerCase())
        );
      }
      
      if (minPrice !== undefined) {
        events = events.filter(e => e.price >= parseInt(minPrice));
      }
      
      if (maxPrice !== undefined) {
        events = events.filter(e => e.price <= parseInt(maxPrice));
      }
    }
    
    res.json({
      success: true,
      count: events.length,
      query: { q, category, minPrice, maxPrice, city },
      events: events
    });
    
  } catch (error) {
    console.error('❌ Search events error:', error);
    res.status(500).json({
      success: false,
      error: 'Error searching events'
    });
  }
});

// ============ UPDATE EVENT STATUS ============

app.patch('/api/events/:eventId/status', async (req, res) => {
  try {
    const { eventId } = req.params;
    const { status } = req.body;
    
    if (!['active', 'cancelled', 'completed', 'draft'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status'
      });
    }
    
    console.log('🔄 Updating event status:', eventId, 'to', status);
    
    let updatedEvent;
    try {
      if (events_collection) {
        const result = await events_collection.findOneAndUpdate(
          { eventId },
          { $set: { status, updatedAt: new Date() } },
          { returnDocument: 'after' }
        );
        updatedEvent = result.value;
      } else {
        throw new Error('Database not connected');
      }
    } catch (dbError) {
      const events = global.inMemoryEvents || [];
      const event = events.find(e => e.eventId === eventId);
      if (event) {
        event.status = status;
        event.updatedAt = new Date();
        updatedEvent = event;
      }
    }
    
    if (!updatedEvent) {
      return res.status(404).json({
        success: false,
        error: 'Event not found'
      });
    }
    
    console.log('✅ Event status updated');
    
    res.json({
      success: true,
      message: 'Event status updated successfully',
      event: updatedEvent
    });
    
  } catch (error) {
    console.error('❌ Update status error:', error);
    res.status(500).json({
      success: false,
      error: 'Error updating event status'
    });
  }
});

// ============ GET EVENT CATEGORIES WITH COUNTS ============

app.get('/api/events/categories/counts', async (req, res) => {
  try {
    let categoryCounts = {};
    
    try {
      if (events_collection) {
        const result = await events_collection.aggregate([
          { $match: { status: 'active' } },
          { $group: { _id: '$category', count: { $sum: 1 } } }
        ]).toArray();
        
        result.forEach(item => {
          categoryCounts[item._id] = item.count;
        });
      } else {
        throw new Error('Database not connected');
      }
    } catch (dbError) {
      const events = global.inMemoryEvents || [];
      const activeEvents = events.filter(e => e.status === 'active');
      
      activeEvents.forEach(event => {
        categoryCounts[event.category] = (categoryCounts[event.category] || 0) + 1;
      });
    }
    
    res.json({
      success: true,
      categories: categoryCounts
    });
    
  } catch (error) {
    console.error('❌ Get categories error:', error);
    res.status(500).json({
      success: false,
      error: 'Error fetching categories'
    });
  }
});

// ============ INCREMENT EVENT ATTENDEES ============

async function incrementEventAttendees(eventId, quantity) {
  try {
    try {
      if (events_collection) {
        await events_collection.updateOne(
          { eventId },
          { $inc: { attendees: quantity } }
        );
      } else {
        throw new Error('Database not connected');
      }
    } catch (dbError) {
      const events = global.inMemoryEvents || [];
      const event = events.find(e => e.eventId === eventId);
      if (event) {
        event.attendees = (event.attendees || 0) + quantity;
      }
    }
    console.log('✅ Event attendees updated');
  } catch (error) {
    console.error('❌ Error updating attendees:', error);
  }
}

// ============ FEATURED EVENTS ============

app.get('/api/events/featured', async (req, res) => {
  try {
    let events;
    try {
      if (events_collection) {
        events = await events_collection
          .find({ status: 'active' })
          .sort({ attendees: -1, createdAt: -1 })
          .limit(6)
          .toArray();
      } else {
        throw new Error('Database not connected');
      }
    } catch (dbError) {
      const allEvents = global.inMemoryEvents || [];
      events = allEvents
        .filter(e => e.status === 'active')
        .sort((a, b) => {
          if (b.attendees !== a.attendees) {
            return b.attendees - a.attendees;
          }
          return new Date(b.createdAt) - new Date(a.createdAt);
        })
        .slice(0, 6);
    }
    
    res.json({
      success: true,
      count: events.length,
      events: events
    });
    
  } catch (error) {
    console.error('❌ Get featured events error:', error);
    res.status(500).json({
      success: false,
      error: 'Error fetching featured events'
    });
  }
});

// ============ UPCOMING EVENTS ============

app.get('/api/events/upcoming', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let events;
    try {
      if (events_collection) {
        events = await events_collection
          .find({ 
            status: 'active'
            // Note: Date comparison would need proper date field
          })
          .sort({ date: 1 })
          .limit(10)
          .toArray();
      } else {
        throw new Error('Database not connected');
      }
    } catch (dbError) {
      const allEvents = global.inMemoryEvents || [];
      events = allEvents
        .filter(e => e.status === 'active')
        .sort((a, b) => new Date(a.date) - new Date(b.date))
        .slice(0, 10);
    }
    
    res.json({
      success: true,
      count: events.length,
      events: events
    });
    
  } catch (error) {
    console.error('❌ Get upcoming events error:', error);
    res.status(500).json({
      success: false,
      error: 'Error fetching upcoming events'
    });
  }
});

// Export function for use in booking
module.exports = {
  incrementEventAttendees
};

console.log('✅ All event management endpoints loaded successfully');
// Start server
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════╗
║   🚀 EventEase Server with Payment         ║
║   📡 Running on port ${PORT}                 ║
║   🌐 http://localhost:${PORT}                ║
║   💳 Payment Integration: Active           ║
║   ✅ Ready to accept requests              ║
╚════════════════════════════════════════════╝
  `);
});
