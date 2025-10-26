// COMPLETE EventEase app.js - ALL FEATURES INCLUDED
// ============================================

// API Configuration
const API_URL = 'http://localhost:5000/api';
const PYTHON_API_URL = 'http://localhost:5001/api';

// Global Variables
let currentBookingEvent = {
  title: '',
  price: 0,
  date: '',
  time: '',
  location: ''
};

let currentBookingResult = null;
let currentPaymentData = null;
let paymentsClient = null;

// ============================================
// PAYMENT INTEGRATION
// ============================================

// Initialize Google Pay
function initializeGooglePay() {
  if (window.google && window.google.payments && window.google.payments.api) {
    try {
      paymentsClient = new google.payments.api.PaymentsClient({
        environment: 'TEST'
      });
      console.log('✅ Google Pay initialized');
    } catch (error) {
      console.log('⚠️ Google Pay initialization failed:', error);
    }
  } else {
    console.log('⚠️ Google Pay API not loaded');
  }
}

// Google Pay Configuration
function getGooglePaymentDataRequest(amount) {
  return {
    apiVersion: 2,
    apiVersionMinor: 0,
    allowedPaymentMethods: [{
      type: 'CARD',
      parameters: {
        allowedAuthMethods: ['PAN_ONLY', 'CRYPTOGRAM_3DS'],
        allowedCardNetworks: ['MASTERCARD', 'VISA', 'AMEX']
      },
      tokenizationSpecification: {
        type: 'PAYMENT_GATEWAY',
        parameters: {
          gateway: 'example',
          gatewayMerchantId: 'exampleMerchantId'
        }
      }
    }],
    transactionInfo: {
      totalPriceStatus: 'FINAL',
      totalPrice: amount.toString(),
      currencyCode: 'INR',
      countryCode: 'IN'
    },
    merchantInfo: {
      merchantName: 'EventEase',
      merchantId: '12345678901234567890'
    }
  };
}

// Show Payment Modal (FIXED - Prevents body scroll)
function showPaymentModal(bookingData) {
  currentPaymentData = bookingData;
  
  document.getElementById('payment-event-name').textContent = bookingData.eventTitle;
  document.getElementById('payment-quantity').textContent = `${bookingData.quantity} tickets`;
  document.getElementById('payment-price').textContent = `₹${bookingData.price}`;
  document.getElementById('payment-total').textContent = `₹${bookingData.totalAmount}`;
  
  // Show modal
  document.getElementById('payment-modal').classList.remove('hidden');
  
  // IMPORTANT: Lock body scroll
  document.body.classList.add('modal-open');
  document.body.style.overflow = 'hidden';
  document.body.style.height = '100vh';
  
  if (!paymentsClient) {
    initializeGooglePay();
  }
}

// Close Payment Modal (FIXED - Restores body scroll)
function closePaymentModal() {
  document.getElementById('payment-modal').classList.add('hidden');
  
  // IMPORTANT: Unlock body scroll
  document.body.classList.remove('modal-open');
  document.body.style.overflow = '';
  document.body.style.height = '';
  
  currentPaymentData = null;
}

// Show Processing Loader (FIXED - Prevents body scroll)
function showProcessingLoader() {
  document.getElementById('payment-processing').classList.remove('hidden');
  
  // IMPORTANT: Lock body scroll
  document.body.classList.add('modal-open');
  document.body.style.overflow = 'hidden';
  document.body.style.height = '100vh';
}

// Hide Processing Loader (FIXED - Restores body scroll)
function hideProcessingLoader() {
  document.getElementById('payment-processing').classList.add('hidden');
  
  // IMPORTANT: Unlock body scroll
  document.body.classList.remove('modal-open');
  document.body.style.overflow = '';
  document.body.style.height = '';
}

// Handle ESC key to close modal
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    const paymentModal = document.getElementById('payment-modal');
    if (paymentModal && !paymentModal.classList.contains('hidden')) {
      closePaymentModal();
    }
  }
});

// Prevent scroll on modal overlay click (optional - keeps modal open)
document.addEventListener('DOMContentLoaded', function() {
  const paymentModal = document.getElementById('payment-modal');
  if (paymentModal) {
    paymentModal.addEventListener('click', function(e) {
      // Close modal only if clicking on overlay, not modal content
      if (e.target === paymentModal) {
        closePaymentModal();
      }
    });
  }
});

// Initiate Google Pay
async function initiateGooglePay() {
  if (!currentPaymentData) {
    showNotification('❌ Payment data not found', 'error');
    return;
  }

  try {
    showNotification('⏳ Launching Google Pay...', 'info');

    const paymentDataRequest = getGooglePaymentDataRequest(currentPaymentData.totalAmount);
    
    if (!paymentsClient) {
      throw new Error('Google Pay not available');
    }

    const paymentData = await paymentsClient.loadPaymentData(paymentDataRequest);
    
    await processPayment({
      ...currentPaymentData,
      paymentMethod: 'google_pay',
      paymentToken: paymentData.paymentMethodData.tokenizationData.token,
      paymentId: 'GP' + Date.now()
    });
    
  } catch (error) {
    console.error('Google Pay error:', error);
    
    if (error.statusCode === 'CANCELED') {
      showNotification('⚠️ Payment cancelled', 'info');
    } else {
      showNotification('⚠️ Google Pay not available. Try another method.', 'info');
    }
  }
}

// Initiate Razorpay
function initiateRazorpay() {
  if (!currentPaymentData) {
    showNotification('❌ Payment data not found', 'error');
    return;
  }

  if (!window.Razorpay) {
    showNotification('⚠️ Razorpay not loaded. Try demo payment.', 'info');
    return;
  }

  const options = {
    key: 'rzp_test_xxxxxxxxxxxxxx',
    amount: currentPaymentData.totalAmount * 100,
    currency: 'INR',
    name: 'EventEase',
    description: currentPaymentData.eventTitle,
    image: '/logo.png',
    handler: function(response) {
      processPayment({
        ...currentPaymentData,
        paymentMethod: 'razorpay',
        paymentId: response.razorpay_payment_id,
        paymentToken: response.razorpay_signature
      });
    },
    prefill: {
      name: currentPaymentData.userName,
      email: currentPaymentData.userEmail,
      contact: currentPaymentData.userPhone
    },
    theme: {
      color: '#7c3aed'
    },
    modal: {
      ondismiss: function() {
        showNotification('⚠️ Payment cancelled', 'info');
      }
    }
  };

  const razorpay = new Razorpay(options);
  razorpay.open();
}

// Demo Payment
function initiateDemoPay() {
  if (!currentPaymentData) {
    showNotification('❌ Payment data not found', 'error');
    return;
  }

  showNotification('🧪 Processing demo payment...', 'info');
  
  setTimeout(() => {
    processPayment({
      ...currentPaymentData,
      paymentMethod: 'demo',
      paymentToken: 'demo_token_' + Date.now(),
      paymentId: 'DEMO' + Date.now()
    });
  }, 2000);
}

// Process Payment
async function processPayment(paymentData) {
  try {
    closePaymentModal();
    showProcessingLoader();
    
    sessionStorage.setItem('currentBookingEvent', JSON.stringify(currentBookingEvent));
    
    const response = await fetch(`${API_URL}/bookings/with-payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token') || 'demo-token'}`
      },
      body: JSON.stringify({
        eventTitle: paymentData.eventTitle,
        eventDate: paymentData.eventDate,
        eventTime: paymentData.eventTime,
        eventLocation: paymentData.eventLocation,
        ticketQuantity: paymentData.quantity,
        userName: paymentData.userName,
        userEmail: paymentData.userEmail,
        userPhone: paymentData.userPhone,
        price: paymentData.price,
        totalAmount: paymentData.totalAmount,
        paymentMethod: paymentData.paymentMethod,
        paymentToken: paymentData.paymentToken,
        paymentId: paymentData.paymentId
      })
    });

    hideProcessingLoader();

    if (!response.ok) {
      throw new Error(`Payment processing failed: ${response.status}`);
    }

    const data = await response.json();

    if (data.success && data.booking) {
      try {
        const qrResponse = await fetch(`${PYTHON_API_URL}/qrcode/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bookingId: data.booking.bookingId,
            eventTitle: paymentData.eventTitle,
            eventDate: paymentData.eventDate,
            eventLocation: paymentData.eventLocation,
            userName: paymentData.userName,
            quantity: paymentData.quantity
          })
        });
        
        if (qrResponse.ok) {
          const qrData = await qrResponse.json();
          if (qrData.success) {
            data.booking.qrCode = qrData.qrCode;
          }
        }
      } catch (qrError) {
        console.log('⚠️ QR generation failed:', qrError.message);
      }
      
      data.booking.eventTitle = data.booking.eventTitle || paymentData.eventTitle;
      data.booking.eventDate = data.booking.eventDate || paymentData.eventDate;
      data.booking.eventTime = data.booking.eventTime || paymentData.eventTime;
      data.booking.eventLocation = data.booking.eventLocation || paymentData.eventLocation;
      data.booking.price = paymentData.price;
      
      currentBookingResult = data.booking;
      sessionStorage.setItem('currentBookingResult', JSON.stringify(data.booking));
      
      const bookings = JSON.parse(localStorage.getItem('myBookings') || '[]');
      bookings.push(data.booking);
      localStorage.setItem('myBookings', JSON.stringify(bookings));
      
      showSuccessModal(data.booking);
      showNotification('✅ Payment successful! Booking confirmed.', 'success');
      
    } else {
      throw new Error('Invalid response from server');
    }
    
  } catch (error) {
    console.error('❌ Payment processing error:', error);
    hideProcessingLoader();
    showNotification('❌ Payment failed: ' + error.message, 'error');
    
    setTimeout(() => {
      if (currentPaymentData) {
        showPaymentModal(currentPaymentData);
      }
    }, 2000);
  }
}

// ============================================
// AUTHENTICATION FUNCTIONS
// ============================================

// Update Navigation
function updateNavigation() {
  const authMenuItem = document.getElementById('auth-menu-item');
  const isLoggedIn = localStorage.getItem('isLoggedIn');
  const userData = localStorage.getItem('userName');
  
  if (isLoggedIn && userData) {
    const firstName = userData.split(' ')[0];
    authMenuItem.innerHTML = `
      <div style="display: flex; align-items: center; gap: 1rem;">
        <span style="color: #a855f7; font-weight: 600;">👤 ${firstName}</span>
        <button class="btn-signin" onclick="signOut()" style="background: #ef4444;">Sign Out</button>
      </div>
    `;
  } else {
    authMenuItem.innerHTML = `
      <button class="btn-signin" onclick="showPage('signin')">Sign In</button>
    `;
  }
}

// Sign Out
function signOut() {
  if (confirm('Are you sure you want to sign out?')) {
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('userName');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('token');
    updateNavigation();
    showPage('home');
    showNotification('✅ Signed out successfully!', 'success');
  }
}

// ============================================
// BOOKING FUNCTIONS
// ============================================

// Book Event
function bookEvent(eventName, price, date, time, location) {
  const isLoggedIn = localStorage.getItem('isLoggedIn');
  
  if (!isLoggedIn) {
    if (confirm('You need to sign in to book tickets. Would you like to sign in now?')) {
      showPage('signin');
    }
    return;
  }

  currentBookingEvent = { title: eventName, price, date, time, location };
  sessionStorage.setItem('currentBookingEvent', JSON.stringify(currentBookingEvent));
  
  document.getElementById('booking-event-title').textContent = eventName;
  document.getElementById('booking-event-date').textContent = date;
  document.getElementById('booking-event-time').textContent = time;
  document.getElementById('booking-event-location').textContent = location;
  document.getElementById('booking-event-price').textContent = `₹${price}`;
  
  const userName = localStorage.getItem('userName');
  const userEmail = localStorage.getItem('userEmail');
  if (userName) document.getElementById('booking-name').value = userName;
  if (userEmail) document.getElementById('booking-email').value = userEmail;
  
  document.getElementById('ticket-quantity').value = 1;
  updateBookingTotal(price, 1);
  
  showPage('booking');
}

// Update Booking Total
function updateBookingTotal(price, quantity) {
  const total = price * quantity;
  document.getElementById('total-amount').textContent = `₹${total}`;
}

// ============================================
// TICKET DOWNLOAD & CALENDAR FUNCTIONS
// ============================================

// Download PDF Ticket
async function downloadPDFTicket(bookingId) {
  try {
    showNotification('⏳ Generating professional PDF ticket...', 'info');
    
    let bookingData = null;
    
    if (currentBookingResult && currentBookingResult.bookingId === bookingId) {
      bookingData = currentBookingResult;
    }
    
    if (!bookingData) {
      const sessionData = sessionStorage.getItem('currentBookingResult');
      if (sessionData) {
        bookingData = JSON.parse(sessionData);
      }
    }
    
    if (!bookingData) {
      const bookings = JSON.parse(localStorage.getItem('myBookings') || '[]');
      bookingData = bookings.find(b => b.bookingId === bookingId);
    }
    
    if (!bookingData) {
      showNotification('❌ Booking data not found', 'error');
      return;
    }
    
    if (!currentBookingEvent.title) {
      const storedEvent = sessionStorage.getItem('currentBookingEvent');
      if (storedEvent) {
        currentBookingEvent = JSON.parse(storedEvent);
      }
    }
    
    const pdfData = {
      bookingId: bookingData.bookingId,
      eventTitle: bookingData.eventTitle || currentBookingEvent.title || 'Event',
      eventDate: bookingData.eventDate || currentBookingEvent.date || 'N/A',
      eventTime: bookingData.eventTime || currentBookingEvent.time || 'N/A',
      eventLocation: bookingData.eventLocation || currentBookingEvent.location || 'N/A',
      userName: bookingData.userName || localStorage.getItem('userName') || 'Guest',
      userEmail: bookingData.userEmail || localStorage.getItem('userEmail') || 'N/A',
      userPhone: bookingData.userPhone || 'N/A',
      quantity: bookingData.quantity || bookingData.ticketQuantity || 1,
      price: bookingData.price || currentBookingEvent.price || 0,
      totalAmount: bookingData.totalAmount || 0,
      eventDescription: `Join us for an amazing experience at ${bookingData.eventTitle || currentBookingEvent.title || 'this event'}.`,
      bookingDate: bookingData.bookingDate || new Date().toISOString()
    };
    
    const response = await fetch(`${PYTHON_API_URL}/tickets/generate-pdf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        bookingId: bookingId,
        bookingData: pdfData
      })
    });

    const data = await response.json();
    
    if (data.success) {
      const link = document.createElement('a');
      link.href = data.pdf;
      link.download = data.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showNotification('✅ Professional PDF ticket downloaded!', 'success');
    } else {
      throw new Error(data.error || 'PDF generation failed');
    }
  } catch (error) {
    console.error('PDF download error:', error);
    showNotification('⚠️ Python backend not running. Using browser print...', 'info');
    setTimeout(() => window.print(), 500);
  }
}

// Sync Google Calendar
async function syncGoogleCalendar(eventId) {
  try {
    const event = currentBookingEvent;
    const eventDate = new Date(event.date);
    const startDate = eventDate.toISOString().replace(/-|:|\.\d\d\d/g, '');
    const endDate = new Date(eventDate.getTime() + 2 * 60 * 60 * 1000).toISOString().replace(/-|:|\.\d\d\d/g, '');
    
    const googleCalendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.title)}&dates=${startDate}/${endDate}&details=${encodeURIComponent('Event booked via EventEase. Booking ID: ' + (currentBookingResult?.bookingId || 'N/A'))}&location=${encodeURIComponent(event.location)}`;
    
    window.open(googleCalendarUrl, '_blank');
    showNotification('✅ Opening Google Calendar...', 'success');
  } catch (error) {
    console.error('Google Calendar error:', error);
    showNotification('❌ Failed to sync with Google Calendar', 'error');
  }
}

// Sync Outlook Calendar
async function syncOutlookCalendar(eventId) {
  try {
    const event = currentBookingEvent;
    const eventDate = new Date(event.date);
    const startDate = eventDate.toISOString();
    const endDate = new Date(eventDate.getTime() + 2 * 60 * 60 * 1000).toISOString();
    
    const outlookUrl = `https://outlook.live.com/calendar/0/deeplink/compose?subject=${encodeURIComponent(event.title)}&startdt=${startDate}&enddt=${endDate}&body=${encodeURIComponent('Event booked via EventEase. Booking ID: ' + (currentBookingResult?.bookingId || 'N/A'))}&location=${encodeURIComponent(event.location)}`;
    
    window.open(outlookUrl, '_blank');
    showNotification('✅ Opening Outlook Calendar...', 'success');
  } catch (error) {
    console.error('Outlook Calendar error:', error);
    showNotification('❌ Failed to sync with Outlook Calendar', 'error');
  }
}

// Download QR Code
async function downloadQRCode(qrCodeDataUrl) {
  try {
    if (qrCodeDataUrl && qrCodeDataUrl.startsWith('data:image/png')) {
      const link = document.createElement('a');
      link.href = qrCodeDataUrl;
      link.download = `EventEase-Ticket-QR-${currentBookingResult?.bookingId || Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showNotification('✅ QR Code downloaded successfully!', 'success');
      return;
    }
    
    if (currentBookingResult) {
      showNotification('⏳ Generating scannable QR code...', 'info');
      
      const response = await fetch(`${PYTHON_API_URL}/qrcode/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: currentBookingResult.bookingId,
          eventTitle: currentBookingResult.eventTitle,
          eventDate: currentBookingResult.eventDate,
          eventLocation: currentBookingResult.eventLocation,
          userName: currentBookingResult.userName,
          quantity: currentBookingResult.quantity
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        const link = document.createElement('a');
        link.href = data.qrCode;
        link.download = `EventEase-Ticket-QR-${currentBookingResult.bookingId}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showNotification('✅ Professional QR Code downloaded!', 'success');
      } else {
        throw new Error('QR generation failed');
      }
    }
  } catch (error) {
    console.error('QR download error:', error);
    showNotification('⚠️ Using basic QR code', 'info');
    const link = document.createElement('a');
    link.href = qrCodeDataUrl;
    link.download = `EventEase-Ticket-QR-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

// Download Payment Receipt
async function downloadPaymentReceipt(bookingId) {
  try {
    showNotification('⏳ Generating payment receipt...', 'info');
    
    let bookingData = currentBookingResult;
    if (!bookingData) {
      const bookings = JSON.parse(localStorage.getItem('myBookings') || '[]');
      bookingData = bookings.find(b => b.bookingId === bookingId);
    }
    
    if (!bookingData) {
      showNotification('❌ Booking not found', 'error');
      return;
    }
    
    const receiptHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; background: #f5f5f5; }
          .receipt { max-width: 600px; margin: 0 auto; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 3px solid #7c3aed; padding-bottom: 20px; }
          .logo { font-size: 32px; color: #7c3aed; font-weight: bold; }
          .receipt-title { font-size: 24px; margin-top: 10px; }
          .section { margin: 20px 0; }
          .row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
          .label { font-weight: bold; color: #666; }
          .value { color: #333; }
          .total { font-size: 24px; color: #7c3aed; font-weight: bold; background: #f3e8ff; padding: 15px; border-radius: 8px; margin-top: 20px; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; border-top: 1px solid #eee; padding-top: 20px; }
        </style>
      </head>
      <body>
        <div class="receipt">
          <div class="header">
            <div class="logo">🎟️ EventEase</div>
            <div class="receipt-title">Payment Receipt</div>
            <div style="color: #10b981; font-weight: bold; margin-top: 10px;">✅ PAID</div>
          </div>
          
          <div class="section">
            <h3>Transaction Details</h3>
            <div class="row">
              <span class="label">Receipt No:</span>
              <span class="value">${bookingData.bookingId}</span>
            </div>
            <div class="row">
              <span class="label">Transaction ID:</span>
              <span class="value">${bookingData.paymentId || 'N/A'}</span>
            </div>
            <div class="row">
              <span class="label">Payment Method:</span>
              <span class="value">${bookingData.paymentMethod || 'N/A'}</span>
            </div>
            <div class="row">
              <span class="label">Date:</span>
              <span class="value">${new Date().toLocaleString()}</span>
            </div>
          </div>
          
          <div class="section">
            <h3>Event Details</h3>
            <div class="row">
              <span class="label">Event:</span>
              <span class="value">${bookingData.eventTitle}</span>
            </div>
            <div class="row">
              <span class="label">Date:</span>
              <span class="value">${bookingData.eventDate}</span>
            </div>
            <div class="row">
              <span class="label">Time:</span>
              <span class="value">${bookingData.eventTime}</span>
            </div>
            <div class="row">
              <span class="label">Location:</span>
              <span class="value">${bookingData.eventLocation}</span>
            </div>
          </div>
          
          <div class="section">
            <h3>Payment Breakdown</h3>
            <div class="row">
              <span class="label">Tickets (${bookingData.quantity})</span>
              <span class="value">₹${bookingData.quantity * bookingData.price}</span>
            </div>
            <div class="row">
              <span class="label">Price per ticket:</span>
              <span class="value">₹${bookingData.price}</span>
            </div>
            <div class="total">
              <div class="row" style="border: none;">
                <span>Total Amount Paid:</span>
                <span>₹${bookingData.totalAmount}</span>
              </div>
            </div>
          </div>
          
          <div class="footer">
            <p><strong>Thank you for choosing EventEase!</strong></p>
            <p>This is a computer-generated receipt.</p>
            <p>&copy; 2025 EventEase. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    const receiptWindow = window.open('', '_blank');
    receiptWindow.document.write(receiptHTML);
    receiptWindow.document.close();
    
    showNotification('✅ Receipt opened in new window', 'success');
    
  } catch (error) {
    console.error('Receipt error:', error);
    showNotification('❌ Failed to generate receipt', 'error');
  }
}

// ============================================
// UI HELPER FUNCTIONS
// ============================================

// Show Notification
function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.innerHTML = `
    <div style="display: flex; align-items: center; gap: 1rem;">
      <span style="font-size: 1.5rem;">${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span>
      <span>${message}</span>
    </div>
  `;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => notification.remove(), 300);
  }, 4000);
}

// Show Success Modal
function showSuccessModal(bookingData) {
  const modal = document.createElement('div');
  modal.id = 'success-modal';
  modal.className = 'success-modal';
  
  const hasPayment = bookingData.paymentStatus === 'completed';
  
  modal.innerHTML = `
    <div class="success-modal-overlay" onclick="closeSuccessModal()"></div>
    <div class="success-modal-content">
      <div class="success-modal-header">
        <div style="text-align: center; width: 100%;">
          <div style="font-size: 4rem; margin-bottom: 1rem;">🎉</div>
          <h2 style="font-size: 2rem; font-weight: 700; background: linear-gradient(135deg, ${hasPayment ? '#10b981' : '#a855f7'}, ${hasPayment ? '#059669' : '#7c3aed'}); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 0.5rem;">
            ${hasPayment ? 'Payment Successful!' : 'Booking Confirmed!'}
          </h2>
          <p style="color: #9ca3af; font-size: 1rem;">Your ${hasPayment ? 'booking has been confirmed' : 'tickets have been successfully booked'}</p>
        </div>
      </div>
      
      <div class="success-modal-body">
        ${hasPayment ? `
        <div class="success-section" style="background: rgba(16, 185, 129, 0.1); border: 2px solid #10b981; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
          <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 15px;">
            <span style="font-size: 48px;">✅</span>
            <div>
              <div style="color: #10b981; font-weight: 700; font-size: 18px;">₹${bookingData.totalAmount} Paid</div>
              <div style="color: #9ca3af; font-size: 14px;">Transaction ID: ${bookingData.paymentId || 'N/A'}</div>
            </div>
          </div>
        </div>
        ` : ''}

        <div class="success-section">
          <h3 class="success-section-title">📋 Booking Details</h3>
          <div class="success-detail-grid">
            <div class="success-detail-item">
              <span class="success-detail-label">Booking ID:</span>
              <span class="success-detail-value">${bookingData.bookingId}</span>
            </div>
            <div class="success-detail-item">
              <span class="success-detail-label">Event:</span>
              <span class="success-detail-value">${bookingData.eventTitle}</span>
            </div>
            <div class="success-detail-item">
              <span class="success-detail-label">Tickets:</span>
              <span class="success-detail-value">${bookingData.quantity}</span>
            </div>
            <div class="success-detail-item">
              <span class="success-detail-label">Total Amount:</span>
              <span class="success-detail-value">₹${bookingData.totalAmount}</span>
            </div>
            <div class="success-detail-item">
              <span class="success-detail-label">Name:</span>
              <span class="success-detail-value">${bookingData.userName}</span>
            </div>
            <div class="success-detail-item">
              <span class="success-detail-label">Email:</span>
              <span class="success-detail-value">${bookingData.userEmail}</span>
            </div>
            ${hasPayment ? `
            <div class="success-detail-item">
              <span class="success-detail-label">Payment Method:</span>
              <span class="success-detail-value">${bookingData.paymentMethod || 'N/A'}</span>
            </div>
            ` : ''}
          </div>
        </div>

        <div class="success-section">
          <h3 class="success-section-title">🎫 Your QR Code Ticket</h3>
          <div style="text-align: center; background: white; padding: 2rem; border-radius: 15px; margin: 1rem 0;">
            <img src="${bookingData.qrCode}" alt="QR Code" style="max-width: 250px; width: 100%;">
          </div>
          <p style="color: #9ca3af; text-align: center; font-size: 0.875rem;">
            Show this QR code at the event entrance
          </p>
        </div>

        <div class="success-section">
          <h3 class="success-section-title">📥 Download & Sync</h3>
          <div class="success-action-buttons">
            <button onclick="downloadPDFTicket('${bookingData.bookingId}')" class="success-btn success-btn-primary">
              <span style="font-size: 1.25rem;">📄</span>
              <span>Download Ticket</span>
            </button>
            ${hasPayment ? `
            <button onclick="downloadPaymentReceipt('${bookingData.bookingId}')" class="success-btn success-btn-secondary">
              <span style="font-size: 1.25rem;">🧾</span>
              <span>Payment Receipt</span>
            </button>
            ` : ''}
            <button onclick="syncGoogleCalendar('${bookingData.eventId}')" class="success-btn success-btn-secondary">
              <span style="font-size: 1.25rem;">📅</span>
              <span>Google Calendar</span>
            </button>
            <button onclick="syncOutlookCalendar('${bookingData.eventId}')" class="success-btn success-btn-secondary">
              <span style="font-size: 1.25rem;">📆</span>
              <span>Outlook Calendar</span>
            </button>
            <button onclick="downloadQRCode('${bookingData.qrCode}')" class="success-btn success-btn-secondary">
              <span style="font-size: 1.25rem;">⬇️</span>
              <span>Save QR Code</span>
            </button>
          </div>
        </div>

        <div class="success-section">
          <div style="background: rgba(168, 85, 247, 0.1); border: 1px solid #a855f7; border-radius: 10px; padding: 1rem;">
            <p style="color: #d1d5db; margin: 0; display: flex; align-items: center; gap: 0.5rem;">
              <span style="font-size: 1.5rem;">📧</span>
              <span>Confirmation email ${hasPayment ? 'with payment receipt ' : ''}sent to <strong>${bookingData.userEmail}</strong></span>
            </p>
          </div>
        </div>
      </div>

      <div class="success-modal-footer">
        <button onclick="closeSuccessModal()" class="success-btn-close">
          Done
        </button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  document.body.style.overflow = 'hidden';
}

// Close Success Modal
function closeSuccessModal() {
  const modal = document.getElementById('success-modal');
  if (modal) {
    modal.remove();
    document.body.style.overflow = 'auto';
    showPage('home');
  }
}
// View Event Details
function viewEventDetails(eventName) {
  showNotification(`📅 ${eventName} - Details coming soon!`, 'info');
}
// ============================================
// PAGE NAVIGATION
// ============================================

function showPage(page) {
  document.getElementById('home-page').classList.add('hidden');
  document.getElementById('signin-page').classList.add('hidden');
  document.getElementById('signup-page').classList.add('hidden');
  document.getElementById('booking-page').classList.add('hidden');
  document.getElementById('category-page').classList.add('hidden');

  if (page === 'home') {
    document.getElementById('home-page').classList.remove('hidden');
  } else if (page === 'signin') {
    document.getElementById('signin-page').classList.remove('hidden');
  } else if (page === 'signup') {
    document.getElementById('signup-page').classList.remove('hidden');
  } else if (page === 'booking') {
    document.getElementById('booking-page').classList.remove('hidden');
  } else if (page === 'category') {
    document.getElementById('category-page').classList.remove('hidden');
  }

  window.scrollTo(0, 0);
}

// ============================================
// CATEGORY DATA
// ============================================
const categoryEvents = {
  'Technology': [
    {
      title: 'Tech Summit 2025',
      description: 'Join industry leaders for cutting-edge insights into AI, blockchain, and the future of technology.',
      date: 'November 15, 2025',
      time: '09:00 AM',
      location: 'Convention Center, Delhi',
      price: 1999,
      image: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800',
      attendees: 450
    },
    {
      title: 'AI & Machine Learning Workshop',
      description: 'Hands-on workshop covering latest ML algorithms and practical AI implementation strategies.',
      date: 'November 18, 2025',
      time: '10:00 AM',
      location: 'Tech Park, Bangalore',
      price: 2499,
      image: 'https://images.unsplash.com/photo-1591453089816-0fbb971b454c?w=800',
      attendees: 120
    },
    {
      title: 'Cybersecurity Conference',
      description: 'Learn about latest security threats and defense mechanisms from industry experts.',
      date: 'November 22, 2025',
      time: '09:30 AM',
      location: 'Cyber Hub, Gurgaon',
      price: 1799,
      image: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=800',
      attendees: 300
    },
    {
      title: 'Blockchain Summit',
      description: 'Explore blockchain technology, cryptocurrencies, and decentralized applications.',
      date: 'November 25, 2025',
      time: '11:00 AM',
      location: 'Innovation Center, Pune',
      price: 2199,
      image: 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=800',
      attendees: 250
    },
    {
      title: 'Cloud Computing Day',
      description: 'Deep dive into cloud architecture, AWS, Azure, and Google Cloud Platform.',
      date: 'December 01, 2025',
      time: '09:00 AM',
      location: 'IT Plaza, Hyderabad',
      price: 1599,
      image: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800',
      attendees: 180
    },
    {
      title: 'DevOps Bootcamp',
      description: 'Intensive bootcamp on CI/CD, Docker, Kubernetes, and modern DevOps practices.',
      date: 'December 05, 2025',
      time: '10:00 AM',
      location: 'Dev Center, Chennai',
      price: 2999,
      image: 'https://images.unsplash.com/photo-1667372393119-3d4c48d07fc9?w=800',
      attendees: 90
    }
  ],
  'Music': [
    {
      title: 'Music Festival Live',
      description: 'Experience an unforgettable night with top artists and live performances under the stars.',
      date: 'November 20, 2025',
      time: '06:00 PM',
      location: 'Open Air Arena, Mumbai',
      price: 2499,
      image: 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=800',
      attendees: 5000
    },
    {
      title: 'Jazz Evening',
      description: 'An intimate evening of smooth jazz with renowned artists and cocktails.',
      date: 'October 22, 2025',
      time: '08:00 PM',
      location: 'Blue Note, Delhi',
      price: 799,
      image: 'https://images.unsplash.com/photo-1415201364774-f6f0bb35f28f?w=800',
      attendees: 100
    },
    {
      title: 'Rock Concert Night',
      description: 'Headbanging night with top rock bands performing your favorite hits.',
      date: 'November 10, 2025',
      time: '07:00 PM',
      location: 'Rock Arena, Bangalore',
      price: 1999,
      image: 'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?w=800',
      attendees: 3000
    },
    {
      title: 'Classical Music Concert',
      description: 'Traditional classical music performance by maestros and talented musicians.',
      date: 'November 28, 2025',
      time: '06:30 PM',
      location: 'Music Hall, Kolkata',
      price: 899,
      image: 'https://images.unsplash.com/photo-1507838153414-b4b713384a76?w=800',
      attendees: 500
    },
    {
      title: 'EDM Festival',
      description: 'Electronic dance music festival featuring international DJs and producers.',
      date: 'December 15, 2025',
      time: '09:00 PM',
      location: 'Beach Arena, Goa',
      price: 3499,
      image: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800',
      attendees: 8000
    },
    {
      title: 'Indie Music Showcase',
      description: 'Discover emerging indie artists and bands in an intimate venue setting.',
      date: 'November 12, 2025',
      time: '07:30 PM',
      location: 'Indie Club, Mumbai',
      price: 599,
      image: 'https://images.unsplash.com/photo-1511735111819-9a3f7709049c?w=800',
      attendees: 200
    }
  ],
  'Food & Drink': [
    {
      title: 'Food & Wine Gala',
      description: 'Savor exquisite cuisines and premium wines curated by Michelin-starred chefs.',
      date: 'November 25, 2025',
      time: '07:00 PM',
      location: 'Grand Hotel, Bangalore',
      price: 3499,
      image: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800',
      attendees: 200
    },
    {
      title: 'Street Food Festival',
      description: 'Explore diverse street food from across India with live cooking demonstrations.',
      date: 'November 08, 2025',
      time: '05:00 PM',
      location: 'City Square, Delhi',
      price: 299,
      image: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800',
      attendees: 2000
    },
    {
      title: 'Craft Beer Tasting',
      description: 'Sample unique craft beers from local breweries with expert guidance.',
      date: 'November 16, 2025',
      time: '06:00 PM',
      location: 'Brew House, Bangalore',
      price: 999,
      image: 'https://images.unsplash.com/photo-1436076863939-06870fe779c2?w=800',
      attendees: 150
    },
    {
      title: 'Baking Masterclass',
      description: 'Learn professional baking techniques from award-winning pastry chefs.',
      date: 'December 02, 2025',
      time: '10:00 AM',
      location: 'Culinary School, Mumbai',
      price: 1799,
      image: 'https://images.unsplash.com/photo-1517433670267-08bbd4be890f?w=800',
      attendees: 50
    },
    {
      title: 'Organic Food Fair',
      description: 'Discover organic produce, healthy food options, and sustainable farming.',
      date: 'November 30, 2025',
      time: '09:00 AM',
      location: 'Green Park, Pune',
      price: 0,
      image: 'https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=800',
      attendees: 1000
    },
    {
      title: 'International Food Expo',
      description: 'Taste cuisines from around the world in one spectacular food exhibition.',
      date: 'December 10, 2025',
      time: '12:00 PM',
      location: 'Expo Center, Hyderabad',
      price: 599,
      image: 'https://images.unsplash.com/photo-1533777857889-4be7c70b33f7?w=800',
      attendees: 3000
    }
  ],
  'Sports': [
    {
      title: 'Marathon 2025',
      description: 'Annual city marathon featuring 5K, 10K, and full marathon categories.',
      date: 'October 25, 2025',
      time: '05:00 AM',
      location: 'City Park, Hyderabad',
      price: 299,
      image: 'https://images.unsplash.com/photo-1452626038306-9aae5e071dd3?w=800',
      attendees: 1000
    },
    {
      title: 'Yoga Retreat',
      description: 'Weekend yoga and meditation retreat in serene natural surroundings.',
      date: 'November 10, 2025',
      time: '06:00 AM',
      location: 'Wellness Resort, Rishikesh',
      price: 4999,
      image: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=800',
      attendees: 50
    },
    {
      title: 'Cricket Championship',
      description: 'Inter-city cricket tournament with teams competing for the championship.',
      date: 'November 18, 2025',
      time: '02:00 PM',
      location: 'Sports Stadium, Mumbai',
      price: 499,
      image: 'https://images.unsplash.com/photo-1531415074968-036ba1b575da?w=800',
      attendees: 5000
    },
    {
      title: 'Cycling Challenge',
      description: 'Mountain cycling challenge through scenic routes with multiple difficulty levels.',
      date: 'November 22, 2025',
      time: '06:30 AM',
      location: 'Hill Station, Shimla',
      price: 799,
      image: 'https://images.unsplash.com/photo-1541625602330-2277a4c46182?w=800',
      attendees: 300
    },
    {
      title: 'Swimming Competition',
      description: 'State-level swimming competition with various age categories and styles.',
      date: 'December 05, 2025',
      time: '08:00 AM',
      location: 'Aquatic Center, Bangalore',
      price: 199,
      image: 'https://images.unsplash.com/photo-1519315901367-f34ff9154487?w=800',
      attendees: 150
    },
    {
      title: 'Adventure Sports Day',
      description: 'Try rock climbing, zip-lining, rappelling and other adventure activities.',
      date: 'December 12, 2025',
      time: '09:00 AM',
      location: 'Adventure Park, Lonavala',
      price: 1499,
      image: 'https://images.unsplash.com/photo-1533130061792-64b345e4a833?w=800',
      attendees: 200
    }
  ],
  'Arts & Culture': [
    {
      title: 'Art Exhibition',
      description: 'Contemporary art exhibition featuring works from emerging and established artists.',
      date: 'October 28, 2025',
      time: '10:00 AM',
      location: 'National Gallery, Kolkata',
      price: 0,
      image: 'https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?w=800',
      attendees: 500
    },
    {
      title: 'Photography Workshop',
      description: 'Learn professional photography techniques from award-winning photographers.',
      date: 'November 01, 2025',
      time: '09:00 AM',
      location: 'Studio One, Chennai',
      price: 1299,
      image: 'https://images.unsplash.com/photo-1452587925148-ce544e77e70d?w=800',
      attendees: 30
    },
    {
      title: 'Stand-Up Comedy Night',
      description: 'Laugh out loud with top comedians performing live in an evening of entertainment.',
      date: 'November 05, 2025',
      time: '08:00 PM',
      location: 'Comedy Club, Mumbai',
      price: 599,
      image: 'https://images.unsplash.com/photo-1585699324551-f6c309eedeca?w=800',
      attendees: 200
    },
    {
      title: 'Theatre Performance',
      description: 'Classic theatrical performance by renowned drama artists and directors.',
      date: 'November 14, 2025',
      time: '07:00 PM',
      location: 'Theatre Hall, Delhi',
      price: 899,
      image: 'https://images.unsplash.com/photo-1503095396549-807759245b35?w=800',
      attendees: 300
    },
    {
      title: 'Cultural Festival',
      description: 'Celebrate diverse cultures with dance, music, food, and traditional performances.',
      date: 'November 26, 2025',
      time: '04:00 PM',
      location: 'Cultural Center, Jaipur',
      price: 199,
      image: 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=800',
      attendees: 2000
    },
    {
      title: 'Poetry Reading Evening',
      description: 'An intimate evening of poetry readings by acclaimed poets and new voices.',
      date: 'December 08, 2025',
      time: '06:30 PM',
      location: 'Literary Cafe, Bangalore',
      price: 299,
      image: 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=800',
      attendees: 80
    }
  ],
  'Business': [
    {
      title: 'Startup Pitch Night',
      description: 'Watch innovative startups pitch their ideas to investors and industry experts.',
      date: 'October 20, 2025',
      time: '06:00 PM',
      location: 'Tech Hub, Pune',
      price: 499,
      image: 'https://images.unsplash.com/photo-1559136555-9303baea8ebd?w=800',
      attendees: 150
    },
    {
      title: 'Entrepreneurship Summit',
      description: 'Learn from successful entrepreneurs about building and scaling businesses.',
      date: 'November 12, 2025',
      time: '09:00 AM',
      location: 'Business Center, Mumbai',
      price: 1999,
      image: 'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=800',
      attendees: 400
    },
    {
      title: 'Digital Marketing Conference',
      description: 'Master digital marketing strategies, SEO, social media, and content marketing.',
      date: 'November 17, 2025',
      time: '10:00 AM',
      location: 'Convention Hall, Bangalore',
      price: 1499,
      image: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=800',
      attendees: 250
    },
    {
      title: 'Leadership Workshop',
      description: 'Develop leadership skills and management techniques for modern workplaces.',
      date: 'November 24, 2025',
      time: '09:30 AM',
      location: 'Corporate Center, Gurgaon',
      price: 2499,
      image: 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=800',
      attendees: 100
    },
    {
      title: 'Networking Mixer',
      description: 'Connect with professionals, entrepreneurs, and business leaders over drinks.',
      date: 'December 03, 2025',
      time: '06:00 PM',
      location: 'Business Lounge, Delhi',
      price: 799,
      image: 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=800',
      attendees: 200
    },
    {
      title: 'Finance & Investment Forum',
      description: 'Insights into investment strategies, market trends, and wealth management.',
      date: 'December 07, 2025',
      time: '10:00 AM',
      location: 'Financial District, Mumbai',
      price: 1799,
      image: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=800',
      attendees: 300
    }
  ]
};

const categoryInfo = {
  'Technology': { icon: '💻', desc: 'Discover amazing technology events' },
  'Music': { icon: '🎵', desc: 'Explore exciting music events and concerts' },
  'Food & Drink': { icon: '🍽️', desc: 'Taste the best food and drink experiences' },
  'Sports': { icon: '⚽', desc: 'Join thrilling sports events and activities' },
  'Arts & Culture': { icon: '🎨', desc: 'Experience art, culture and entertainment' },
  'Business': { icon: '💼', desc: 'Connect with business and networking events' }
};

// Show Category Page
function showCategoryPage(category) {
  const info = categoryInfo[category];
  const events = categoryEvents[category];

  document.getElementById('category-icon').textContent = info.icon;
  document.getElementById('category-title').textContent = category + ' Events';
  document.getElementById('category-description').textContent = info.desc;

  const grid = document.getElementById('category-events-grid');
  grid.innerHTML = '';

  events.forEach(event => {
    const card = document.createElement('div');
    card.className = 'event-card';
    card.innerHTML = `
      <div class="event-image">
        <img src="${event.image}" alt="${event.title}">
        <div class="event-category">${category}</div>
        <div class="event-attendees">
          <span>👥</span>
          <span>${event.attendees} attending</span>
        </div>
      </div>
      <div class="event-content">
        <h3>${event.title}</h3>
        <p class="event-description">${event.description}</p>
        <div class="event-details">
          <div class="event-detail">
            <span class="event-detail-icon">📅</span>
            <span>${event.date}</span>
          </div>
          <div class="event-detail">
            <span class="event-detail-icon">🕐</span>
            <span>${event.time}</span>
          </div>
          <div class="event-detail">
            <span class="event-detail-icon">📍</span>
            <span>${event.location}</span>
          </div>
        </div>
        <div class="event-footer">
          <div class="event-price">${event.price === 0 ? 'FREE' : '₹' + event.price}</div>
          <button class="btn-book" onclick="bookEvent('${event.title}', ${event.price}, '${event.date}', '${event.time}', '${event.location}')">
            <span>🎟️</span>
            <span>Book Now</span>
          </button>
        </div>
      </div>
    `;
    grid.appendChild(card);
  });

  showPage('category');
}

// ============================================
// EVENT LISTENERS & INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', function() {
  
  // Initialize Google Pay on load
  window.addEventListener('load', function() {
    initializeGooglePay();
  });
  
  updateNavigation();
  
  // Booking page quantity input
  const quantityInput = document.getElementById('ticket-quantity');
  if (quantityInput) {
    quantityInput.addEventListener('input', function() {
      if (currentBookingEvent.price) {
        updateBookingTotal(currentBookingEvent.price, parseInt(this.value) || 1);
      }
    });
  }

  // Booking form submission with PAYMENT INTEGRATION
  const bookingForm = document.getElementById('booking-form');
  if (bookingForm) {
    bookingForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      
      // Restore event data if needed
      if (!currentBookingEvent.title) {
        const stored = sessionStorage.getItem('currentBookingEvent');
        if (stored) {
          currentBookingEvent = JSON.parse(stored);
        }
      }
      
      const formData = new FormData(this);
      const quantity = parseInt(formData.get('quantity'));
      const name = formData.get('name');
      const email = formData.get('email');
      const phone = formData.get('phone');
      const total = currentBookingEvent.price * quantity;
      
      const submitBtn = this.querySelector('button[type="submit"]');
      const originalText = submitBtn.innerHTML;
      
      // Validate form
      if (!name || !email || !phone) {
        showNotification('❌ Please fill all required fields', 'error');
        return;
      }
      
      submitBtn.innerHTML = '⏳ Processing...';
      submitBtn.disabled = true;
      
      try {
        // Store event in sessionStorage
        sessionStorage.setItem('currentBookingEvent', JSON.stringify(currentBookingEvent));
        
        // Prepare booking data
        const bookingData = {
          eventTitle: currentBookingEvent.title,
          eventDate: currentBookingEvent.date,
          eventTime: currentBookingEvent.time,
          eventLocation: currentBookingEvent.location,
          quantity: quantity,
          userName: name,
          userEmail: email,
          userPhone: phone,
          price: currentBookingEvent.price,
          totalAmount: total
        };
        
        // Reset button
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
        
        // Show payment modal instead of processing directly
        showPaymentModal(bookingData);
        
      } catch (error) {
        console.error('❌ Error:', error);
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
        showNotification('❌ Error: ' + error.message, 'error');
      }
    });
  }

  // Newsletter forms
  document.querySelectorAll('.newsletter-form').forEach(form => {
    form.addEventListener('submit', function(e) {
      e.preventDefault();
      showNotification('✅ Thank you for subscribing!', 'success');
      this.reset();
    });
  });

  // Sign In form
  const signinForm = document.getElementById('signin-form');
  if (signinForm) {
    signinForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      
      const email = this.querySelector('[name="email"]').value;
      const password = this.querySelector('[name="password"]').value;
      
      const submitBtn = this.querySelector('button[type="submit"]');
      const originalText = submitBtn.innerHTML;
      submitBtn.innerHTML = '⏳ Signing in...';
      submitBtn.disabled = true;
      
      try {
        // Call backend API
        const response = await fetch(`${API_URL}/auth/signin`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });

        if (response.ok) {
          const data = await response.json();
          
          localStorage.setItem('isLoggedIn', 'true');
          localStorage.setItem('userName', data.user.name);
          localStorage.setItem('userEmail', data.user.email);
          localStorage.setItem('token', data.token);
          
          updateNavigation();
          showNotification(`✅ Welcome back, ${data.user.name.split(' ')[0]}!`, 'success');
          showPage('home');
        } else {
          // Fallback for demo
          const userName = email.split('@')[0].replace(/[._-]/g, ' ').split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
          
          localStorage.setItem('isLoggedIn', 'true');
          localStorage.setItem('userName', userName);
          localStorage.setItem('userEmail', email);
          localStorage.setItem('token', 'demo-token-' + Date.now());
          
          updateNavigation();
          showNotification(`✅ Welcome back, ${userName}!`, 'success');
          showPage('home');
        }
      } catch (error) {
        console.error('Sign in error:', error);
        showNotification('❌ Sign in failed. Please try again.', 'error');
      } finally {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
      }
    });
  }

  // Sign Up form
  const signupForm = document.getElementById('signup-form');
  if (signupForm) {
    signupForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      
      const name = this.querySelector('[name="name"]').value;
      const email = this.querySelector('[name="email"]').value;
      const password = this.querySelector('[name="password"]').value;
      const phone = this.querySelector('[name="phone"]')?.value;
      
      const submitBtn = this.querySelector('button[type="submit"]');
      const originalText = submitBtn.innerHTML;
      submitBtn.innerHTML = '⏳ Creating account...';
      submitBtn.disabled = true;
      
      try {
        // Call backend API
        const response = await fetch(`${API_URL}/auth/signup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, password, phone })
        });

        if (response.ok) {
          const data = await response.json();
          
          localStorage.setItem('isLoggedIn', 'true');
          localStorage.setItem('userName', data.user.name);
          localStorage.setItem('userEmail', data.user.email);
          localStorage.setItem('token', data.token);
          
          updateNavigation();
          showNotification(`✅ Welcome to EventEase, ${name.split(' ')[0]}!`, 'success');
          showPage('home');
        } else {
          // Fallback for demo
          localStorage.setItem('isLoggedIn', 'true');
          localStorage.setItem('userName', name);
          localStorage.setItem('userEmail', email);
          localStorage.setItem('token', 'demo-token-' + Date.now());
          
          updateNavigation();
          showNotification(`✅ Welcome to EventEase, ${name.split(' ')[0]}!`, 'success');
          showPage('home');
        }
      } catch (error) {
        console.error('Sign up error:', error);
        showNotification('❌ Sign up failed. Please try again.', 'error');
      } finally {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
      }
    });
  }

  // Smooth scroll
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const href = this.getAttribute('href');
      if (href !== '#' && document.querySelector(href)) {
        e.preventDefault();
        document.querySelector(href).scrollIntoView({ behavior: 'smooth' });
      }
    });
  });
});
// CREATE EVENT SYSTEM - Add to your app.js

// Store created events
let createdEvents = JSON.parse(localStorage.getItem('createdEvents') || '[]');
let currentCreatedEvent = null;
let uploadedEventImage = null;

// Open Create Event Page
function openCreateEventPage() {
  const isLoggedIn = localStorage.getItem('isLoggedIn');
  
  if (!isLoggedIn) {
    if (confirm('You need to sign in to create events. Would you like to sign in now?')) {
      showPage('signin');
    }
    return;
  }
  
  showPage('create-event');
  
  // Set minimum date to today
  const dateInput = document.querySelector('input[name="date"]');
  if (dateInput) {
    const today = new Date().toISOString().split('T')[0];
    dateInput.setAttribute('min', today);
  }
}

// Handle Event Image Upload
document.addEventListener('DOMContentLoaded', function() {
  const imageInput = document.getElementById('event-image-input');
  if (imageInput) {
    imageInput.addEventListener('change', function(e) {
      const file = e.target.files[0];
      
      if (!file) return;
      
      // Validate file size (5MB max)
      if (file.size > 5 * 1024 * 1024) {
        showNotification('❌ Image size must be less than 5MB', 'error');
        return;
      }
      
      // Validate file type
      if (!file.type.startsWith('image/')) {
        showNotification('❌ Please upload a valid image file', 'error');
        return;
      }
      
      // Read and preview image
      const reader = new FileReader();
      reader.onload = function(e) {
        uploadedEventImage = e.target.result;
        
        document.getElementById('preview-img').src = uploadedEventImage;
        document.querySelector('.image-upload-content').style.display = 'none';
        document.getElementById('image-preview').classList.remove('hidden');
      };
      reader.readAsDataURL(file);
    });
  }
});

// Remove Event Image
function removeEventImage() {
  uploadedEventImage = null;
  document.getElementById('event-image-input').value = '';
  document.getElementById('preview-img').src = '';
  document.querySelector('.image-upload-content').style.display = 'flex';
  document.getElementById('image-preview').classList.add('hidden');
}

// Handle Create Event Form Submission
document.addEventListener('DOMContentLoaded', function() {
  const createEventForm = document.getElementById('create-event-form');
  
  if (createEventForm) {
    createEventForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      
      const submitBtn = this.querySelector('.btn-create-event');
      const originalText = submitBtn.innerHTML;
      submitBtn.innerHTML = '<span>⏳</span><span>Creating Event...</span>';
      submitBtn.disabled = true;
      
      try {
        // Get form data
        const formData = new FormData(this);
        
        // Validate image
        if (!uploadedEventImage) {
          showNotification('⚠️ Please upload an event image', 'error');
          submitBtn.innerHTML = originalText;
          submitBtn.disabled = false;
          return;
        }
        
        // Format date
        const dateInput = formData.get('date');
        const dateObj = new Date(dateInput);
        const formattedDate = dateObj.toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        });
        
        // Format time
        const timeInput = formData.get('time');
        const [hours, minutes] = timeInput.split(':');
        const timeObj = new Date();
        timeObj.setHours(parseInt(hours), parseInt(minutes));
        const formattedTime = timeObj.toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit' 
        });
        
        // Format location
        const venue = formData.get('venue');
        const city = formData.get('city');
        const state = formData.get('state');
        const fullLocation = `${venue}, ${city}`;
        
        // Process highlights
        const highlightsText = formData.get('highlights');
        const highlights = highlightsText
          ? highlightsText.split('\n').filter(h => h.trim() !== '')
          : [];
        
        // Create event object
        const newEvent = {
          id: 'EVENT-' + Date.now(),
          title: formData.get('title'),
          category: formData.get('category'),
          description: formData.get('description'),
          date: formattedDate,
          time: formattedTime,
          location: fullLocation,
          venue: venue,
          city: city,
          state: state,
          address: formData.get('address') || '',
          price: parseInt(formData.get('price')),
          maxAttendees: parseInt(formData.get('maxAttendees') || 100),
          attendees: 0,
          image: uploadedEventImage,
          highlights: highlights,
          whatToExpect: formData.get('whatToExpect') || '',
          contactEmail: formData.get('contactEmail'),
          contactPhone: formData.get('contactPhone') || '',
          createdBy: localStorage.getItem('userName') || 'Anonymous',
          createdByEmail: localStorage.getItem('userEmail'),
          createdAt: new Date().toISOString(),
          status: 'active'
        };
        
        // In production, send to backend API
        try {
          const response = await fetch(`${API_URL}/events/create`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('token') || 'demo-token'}`
            },
            body: JSON.stringify(newEvent)
          });
          
          if (response.ok) {
            const data = await response.json();
            console.log('✅ Event created on backend:', data);
          }
        } catch (error) {
          console.log('⚠️ Backend unavailable, saving locally:', error.message);
        }
        
        // Store event locally
        createdEvents.push(newEvent);
        localStorage.setItem('createdEvents', JSON.stringify(createdEvents));
        
        // Add to complete events database for viewing
        completeEventsDatabase[newEvent.title] = newEvent;
        
        // Add to category events
        if (!categoryEvents[newEvent.category]) {
          categoryEvents[newEvent.category] = [];
        }
        categoryEvents[newEvent.category].push({
          title: newEvent.title,
          description: newEvent.description,
          date: newEvent.date,
          time: newEvent.time,
          location: newEvent.location,
          price: newEvent.price,
          image: newEvent.image,
          attendees: newEvent.attendees
        });
        
        currentCreatedEvent = newEvent;
        
        // Reset form
        this.reset();
        removeEventImage();
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
        
        // Show success modal
        showEventCreatedSuccess(newEvent);
        
        showNotification('✅ Event created successfully!', 'success');
        
      } catch (error) {
        console.error('❌ Error creating event:', error);
        showNotification('❌ Failed to create event: ' + error.message, 'error');
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
      }
    });
  }
});

// Show Event Created Success Modal
function showEventCreatedSuccess(event) {
  const preview = document.getElementById('created-event-preview');
  
  preview.innerHTML = `
    <div style="display: flex; gap: 20px; align-items: flex-start;">
      <img src="${event.image}" alt="${event.title}" style="width: 120px; height: 120px; object-fit: cover; border-radius: 12px; border: 2px solid #7c3aed;">
      <div style="flex: 1;">
        <h3 style="color: #fff; font-size: 20px; margin: 0 0 10px 0;">${event.title}</h3>
        <div style="display: flex; flex-direction: column; gap: 8px;">
          <div style="color: #9ca3af; font-size: 14px;">
            <span style="color: #a855f7;">📅</span> ${event.date} at ${event.time}
          </div>
          <div style="color: #9ca3af; font-size: 14px;">
            <span style="color: #a855f7;">📍</span> ${event.location}
          </div>
          <div style="color: #9ca3af; font-size: 14px;">
            <span style="color: #a855f7;">💰</span> ${event.price === 0 ? 'FREE' : '₹' + event.price}
          </div>
        </div>
      </div>
    </div>
  `;
  
  document.getElementById('event-created-modal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  document.body.style.height = '100vh';
}

// View Created Event
function viewMyCreatedEvent() {
  if (currentCreatedEvent) {
    document.getElementById('event-created-modal').classList.add('hidden');
    document.body.style.overflow = '';
    document.body.style.height = '';
    
    // Show event details
    viewEventDetails(currentCreatedEvent.title);
  }
}

// Create Another Event
function createAnotherEvent() {
  document.getElementById('event-created-modal').classList.add('hidden');
  document.body.style.overflow = '';
  document.body.style.height = '';
  
  currentCreatedEvent = null;
  openCreateEventPage();
}

// Back to Home from Success
function backToHomeFromSuccess() {
  document.getElementById('event-created-modal').classList.add('hidden');
  document.body.style.overflow = '';
  document.body.style.height = '';
  
  currentCreatedEvent = null;
  showPage('home');
}

// Cancel Event Creation
function cancelEventCreation() {
  if (confirm('Are you sure you want to cancel? All your changes will be lost.')) {
    document.getElementById('create-event-form').reset();
    removeEventImage();
    showPage('home');
  }
}

// Get My Created Events
function getMyCreatedEvents() {
  const userEmail = localStorage.getItem('userEmail');
  if (!userEmail) return [];
  
  return createdEvents.filter(event => event.createdByEmail === userEmail);
}

// Update the "Create Event" button in hero section
document.addEventListener('DOMContentLoaded', function() {
  // Find and update all "Create Event" buttons
  const createEventButtons = document.querySelectorAll('.btn-secondary');
  createEventButtons.forEach(btn => {
    if (btn.textContent.includes('Create Event')) {
      btn.onclick = openCreateEventPage;
    }
  });
});

// Add to showPage function to handle create-event page
const originalShowPage = window.showPage;
window.showPage = function(page) {
  // Hide all pages
  document.getElementById('home-page').classList.add('hidden');
  document.getElementById('signin-page').classList.add('hidden');
  document.getElementById('signup-page').classList.add('hidden');
  document.getElementById('booking-page').classList.add('hidden');
  document.getElementById('category-page').classList.add('hidden');
  
  // Also hide create-event-page if it exists
  const createEventPage = document.getElementById('create-event-page');
  if (createEventPage) {
    createEventPage.classList.add('hidden');
  }

  // Show requested page
  if (page === 'home') {
    document.getElementById('home-page').classList.remove('hidden');
  } else if (page === 'signin') {
    document.getElementById('signin-page').classList.remove('hidden');
  } else if (page === 'signup') {
    document.getElementById('signup-page').classList.remove('hidden');
  } else if (page === 'booking') {
    document.getElementById('booking-page').classList.remove('hidden');
  } else if (page === 'category') {
    document.getElementById('category-page').classList.remove('hidden');
  } else if (page === 'create-event') {
    if (createEventPage) {
      createEventPage.classList.remove('hidden');
    }
  }

  window.scrollTo(0, 0);
};

// Display Created Events on Home Page (Optional Feature)
function displayCreatedEventsOnHome() {
  const myEvents = getMyCreatedEvents();
  
  if (myEvents.length === 0) return;
  
  // Find trending section or create a new section for user's events
  const trendingSection = document.querySelector('.trending-section');
  
  if (trendingSection && myEvents.length > 0) {
    // Create "My Events" section
    const myEventsSection = document.createElement('section');
    myEventsSection.className = 'trending-section';
    myEventsSection.style.background = 'linear-gradient(135deg, rgba(26, 0, 51, 0.4) 0%, rgba(10, 10, 10, 0.4) 100%)';
    
    myEventsSection.innerHTML = `
      <div class="container">
        <div class="section-header">
          <div class="section-title">
            <h2>My Created Events</h2>
            <p>Events you've created and published</p>
          </div>
          <div class="section-icon">✨</div>
        </div>
        <div class="events-grid" id="my-events-grid">
          <!-- My events will be loaded here -->
        </div>
      </div>
    `;
    
    // Insert after trending section
    trendingSection.parentNode.insertBefore(myEventsSection, trendingSection.nextSibling);
    
    // Populate with events
    const myEventsGrid = document.getElementById('my-events-grid');
    myEvents.forEach(event => {
      const eventCard = createEventCard(event);
      myEventsGrid.appendChild(eventCard);
    });
  }
}

// Create Event Card Element
function createEventCard(event) {
  const card = document.createElement('div');
  card.className = 'event-card';
  card.innerHTML = `
    <div class="event-image">
      <img src="${event.image}" alt="${event.title}">
      <div class="event-category">${event.category}</div>
      <div class="event-attendees">
        <span>👥</span>
        <span>${event.attendees} attending</span>
      </div>
    </div>
    <div class="event-content">
      <h3>${event.title}</h3>
      <p class="event-description">${event.description}</p>
      <div class="event-details">
        <div class="event-detail">
          <span class="event-detail-icon">📅</span>
          <span>${event.date}</span>
        </div>
        <div class="event-detail">
          <span class="event-detail-icon">🕐</span>
          <span>${event.time}</span>
        </div>
        <div class="event-detail">
          <span class="event-detail-icon">📍</span>
          <span>${event.location}</span>
        </div>
      </div>
      <div class="event-footer">
        <div class="event-price">${event.price === 0 ? 'FREE' : '₹' + event.price}</div>
        <button class="btn-book" onclick="bookEvent('${event.title}', ${event.price}, '${event.date}', '${event.time}', '${event.location}')">
          <span>🎟️</span>
          <span>Book Now</span>
        </button>
      </div>
    </div>
  `;
  return card;
}

// Load created events on page load
document.addEventListener('DOMContentLoaded', function() {
  // Load created events from localStorage
  createdEvents = JSON.parse(localStorage.getItem('createdEvents') || '[]');
  
  // Add to complete events database
  createdEvents.forEach(event => {
    completeEventsDatabase[event.title] = event;
    
    // Add to category events if not already there
    if (categoryEvents[event.category]) {
      const exists = categoryEvents[event.category].some(e => e.title === event.title);
      if (!exists) {
        categoryEvents[event.category].push({
          title: event.title,
          description: event.description,
          date: event.date,
          time: event.time,
          location: event.location,
          price: event.price,
          image: event.image,
          attendees: event.attendees
        });
      }
    }
  });
  
  console.log('✅ Loaded', createdEvents.length, 'created events');
});

// Admin Functions (Optional - for managing events)
function deleteMyEvent(eventId) {
  if (!confirm('Are you sure you want to delete this event?')) return;
  
  createdEvents = createdEvents.filter(e => e.id !== eventId);
  localStorage.setItem('createdEvents', JSON.stringify(createdEvents));
  
  showNotification('✅ Event deleted successfully', 'success');
  location.reload(); // Refresh page
}

function editMyEvent(eventId) {
  const event = createdEvents.find(e => e.id === eventId);
  if (!event) {
    showNotification('❌ Event not found', 'error');
    return;
  }
  
  // Open create event page with pre-filled data
  openCreateEventPage();
  
  // Wait for page to load then fill form
  setTimeout(() => {
    const form = document.getElementById('create-event-form');
    if (form) {
      form.querySelector('[name="title"]').value = event.title;
      form.querySelector('[name="category"]').value = event.category;
      form.querySelector('[name="description"]').value = event.description;
      form.querySelector('[name="price"]').value = event.price;
      form.querySelector('[name="venue"]').value = event.venue;
      form.querySelector('[name="city"]').value = event.city;
      form.querySelector('[name="state"]').value = event.state;
      form.querySelector('[name="address"]').value = event.address;
      form.querySelector('[name="highlights"]').value = event.highlights.join('\n');
      form.querySelector('[name="whatToExpect"]').value = event.whatToExpect;
      form.querySelector('[name="maxAttendees"]').value = event.maxAttendees;
      form.querySelector('[name="contactEmail"]').value = event.contactEmail;
      form.querySelector('[name="contactPhone"]').value = event.contactPhone;
      
      // Set image
      if (event.image) {
        uploadedEventImage = event.image;
        document.getElementById('preview-img').src = event.image;
        document.querySelector('.image-upload-content').style.display = 'none';
        document.getElementById('image-preview').classList.remove('hidden');
      }
      
      showNotification('ℹ️ Edit your event and submit', 'info');
    }
  }, 500);
}

// Export functions for global access
window.openCreateEventPage = openCreateEventPage;
window.removeEventImage = removeEventImage;
window.cancelEventCreation = cancelEventCreation;
window.viewMyCreatedEvent = viewMyCreatedEvent;
window.createAnotherEvent = createAnotherEvent;
window.backToHomeFromSuccess = backToHomeFromSuccess;
window.getMyCreatedEvents = getMyCreatedEvents;
window.deleteMyEvent = deleteMyEvent;
window.editMyEvent = editMyEvent;

console.log('✅ Create Event System loaded successfully')
console.log('✅ EventEase App.js loaded successfully with all features');
// DYNAMIC EVENT DISPLAY SYSTEM - Add to your app.js
// This makes newly created events appear on the website immediately

// ============================================
// LOAD AND DISPLAY ALL EVENTS
// ============================================

// Function to load all events from storage and backend
async function loadAllEvents() {
  console.log('📥 Loading all events...');
  
  let allEvents = [];
  
  // 1. Load from backend API
  try {
    const response = await fetch(`${API_URL}/events?status=active`);
    if (response.ok) {
      const data = await response.json();
      if (data.success && data.events) {
        allEvents = data.events;
        console.log('✅ Loaded', data.events.length, 'events from backend');
      }
    }
  } catch (error) {
    console.log('⚠️ Backend unavailable, loading from localStorage');
  }
  
  // 2. Load from localStorage (created events)
  const localEvents = JSON.parse(localStorage.getItem('createdEvents') || '[]');
  
  // Merge events (avoid duplicates)
  localEvents.forEach(localEvent => {
    const exists = allEvents.some(e => e.eventId === localEvent.id || e.id === localEvent.id);
    if (!exists) {
      allEvents.push(localEvent);
    }
  });
  
  console.log('✅ Total events loaded:', allEvents.length);
  return allEvents;
}

// ============================================
// DISPLAY EVENTS ON HOME PAGE
// ============================================

async function displayEventsOnHomePage() {
  const allEvents = await loadAllEvents();
  
  if (allEvents.length === 0) return;
  
  // 1. Update Trending Section
  updateTrendingEvents(allEvents);
  
  // 2. Update Upcoming Section
  updateUpcomingEvents(allEvents);
  
  // 3. Show "My Events" section if user has created events
  const userEmail = localStorage.getItem('userEmail');
  if (userEmail) {
    const myEvents = allEvents.filter(e => 
      e.createdByEmail === userEmail || e.createdBy === localStorage.getItem('userName')
    );
    if (myEvents.length > 0) {
      displayMyCreatedEvents(myEvents);
    }
  }
}

// Update Trending Events Section
function updateTrendingEvents(events) {
  const trendingGrid = document.querySelector('.trending-section .events-grid');
  if (!trendingGrid) return;
  
  // Sort by attendees (most popular first)
  const trendingEvents = [...events]
    .sort((a, b) => (b.attendees || 0) - (a.attendees || 0))
    .slice(0, 6); // Show top 6
  
  // Keep existing events and add new ones
  const existingCards = trendingGrid.querySelectorAll('.event-card');
  const existingTitles = Array.from(existingCards).map(card => 
    card.querySelector('h3')?.textContent
  );
  
  trendingEvents.forEach(event => {
    // Skip if already displayed
    if (existingTitles.includes(event.title)) return;
    
    const card = createEventCard(event);
    trendingGrid.appendChild(card);
  });
  
  console.log('✅ Updated trending events');
}

// Update Upcoming Events List
function updateUpcomingEvents(events) {
  const upcomingList = document.querySelector('.upcoming-section .upcoming-list');
  if (!upcomingList) return;
  
  // Sort by date (nearest first)
  const upcomingEvents = [...events]
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, 10); // Show top 10
  
  // Keep existing events and add new ones
  const existingEvents = upcomingList.querySelectorAll('.upcoming-event');
  const existingTitles = Array.from(existingEvents).map(event => 
    event.querySelector('h3')?.textContent
  );
  
  upcomingEvents.forEach(event => {
    // Skip if already displayed
    if (existingTitles.includes(event.title)) return;
    
    const upcomingCard = createUpcomingEventCard(event);
    upcomingList.appendChild(upcomingCard);
  });
  
  console.log('✅ Updated upcoming events');
}

// Display "My Created Events" Section
function displayMyCreatedEvents(myEvents) {
  // Check if section already exists
  let myEventsSection = document.getElementById('my-events-section');
  
  if (!myEventsSection) {
    // Create new section
    const trendingSection = document.querySelector('.trending-section');
    if (!trendingSection) return;
    
    myEventsSection = document.createElement('section');
    myEventsSection.id = 'my-events-section';
    myEventsSection.className = 'trending-section';
    myEventsSection.style.background = 'linear-gradient(135deg, rgba(26, 0, 51, 0.6) 0%, rgba(10, 10, 10, 0.6) 100%)';
    
    myEventsSection.innerHTML = `
      <div class="container">
        <div class="section-header">
          <div class="section-title">
            <h2>My Created Events</h2>
            <p>Events you've published on EventEase</p>
          </div>
          <div class="section-icon">✨</div>
        </div>
        <div class="events-grid" id="my-events-grid">
          <!-- My events will be loaded here -->
        </div>
      </div>
    `;
    
    // Insert after trending section
    trendingSection.parentNode.insertBefore(myEventsSection, trendingSection.nextSibling);
  }
  
  // Populate with events
  const myEventsGrid = document.getElementById('my-events-grid');
  if (!myEventsGrid) return;
  
  myEventsGrid.innerHTML = ''; // Clear existing
  
  myEvents.forEach(event => {
    const card = createEventCardWithManage(event);
    myEventsGrid.appendChild(card);
  });
  
  console.log('✅ Displayed', myEvents.length, 'created events');
}

// Create Event Card with Management Options
function createEventCardWithManage(event) {
  const card = document.createElement('div');
  card.className = 'event-card';
  card.style.position = 'relative';
  
  card.innerHTML = `
    <div class="event-image">
      <img src="${event.image}" alt="${event.title}">
      <div class="event-category">${event.category}</div>
      <div class="event-attendees">
        <span>👥</span>
        <span>${event.attendees || 0} attending</span>
      </div>
      <div style="position: absolute; top: 10px; right: 10px; display: flex; gap: 8px;">
        <button onclick="editMyEvent('${event.id || event.eventId}')" 
                style="background: rgba(59, 130, 246, 0.9); color: white; border: none; padding: 8px 12px; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 600;">
          ✏️ Edit
        </button>
        <button onclick="deleteMyEvent('${event.id || event.eventId}')" 
                style="background: rgba(239, 68, 68, 0.9); color: white; border: none; padding: 8px 12px; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 600;">
          🗑️ Delete
        </button>
      </div>
    </div>
    <div class="event-content">
      <h3>${event.title}</h3>
      <p class="event-description">${event.description}</p>
      <div class="event-details">
        <div class="event-detail">
          <span class="event-detail-icon">📅</span>
          <span>${event.date}</span>
        </div>
        <div class="event-detail">
          <span class="event-detail-icon">🕐</span>
          <span>${event.time}</span>
        </div>
        <div class="event-detail">
          <span class="event-detail-icon">📍</span>
          <span>${event.location}</span>
        </div>
      </div>
      <div class="event-footer">
        <div class="event-price">${event.price === 0 ? 'FREE' : '₹' + event.price}</div>
        <button class="btn-book" onclick="viewEventDetails('${event.title}')">
          <span>👁️</span>
          <span>View Details</span>
        </button>
      </div>
    </div>
  `;
  return card;
}

// Create Event Card (Standard)
function createEventCard(event) {
  const card = document.createElement('div');
  card.className = 'event-card';
  card.innerHTML = `
    <div class="event-image">
      <img src="${event.image}" alt="${event.title}">
      <div class="event-category">${event.category}</div>
      <div class="event-attendees">
        <span>👥</span>
        <span>${event.attendees || 0} attending</span>
      </div>
    </div>
    <div class="event-content">
      <h3>${event.title}</h3>
      <p class="event-description">${event.description}</p>
      <div class="event-details">
        <div class="event-detail">
          <span class="event-detail-icon">📅</span>
          <span>${event.date}</span>
        </div>
        <div class="event-detail">
          <span class="event-detail-icon">🕐</span>
          <span>${event.time}</span>
        </div>
        <div class="event-detail">
          <span class="event-detail-icon">📍</span>
          <span>${event.location}</span>
        </div>
      </div>
      <div class="event-footer">
        <div class="event-price">${event.price === 0 ? 'FREE' : '₹' + event.price}</div>
        <button class="btn-book" onclick="bookEvent('${event.title}', ${event.price}, '${event.date}', '${event.time}', '${event.location}')">
          <span>🎟️</span>
          <span>Book Now</span>
        </button>
      </div>
    </div>
  `;
  return card;
}

// Create Upcoming Event Card
function createUpcomingEventCard(event) {
  const dateObj = new Date(event.date);
  const day = dateObj.getDate();
  const month = dateObj.toLocaleString('en-US', { month: 'short' });
  
  const upcomingEvent = document.createElement('div');
  upcomingEvent.className = 'upcoming-event';
  upcomingEvent.innerHTML = `
    <div class="upcoming-event-content">
      <div class="upcoming-event-left">
        <div class="event-date-box">
          <div class="event-date-day">${day}</div>
          <div class="event-date-month">${month}</div>
        </div>
        <div class="upcoming-event-info">
          <h3>${event.title}</h3>
          <div class="upcoming-event-location">
            <span>📍</span>
            <span>${event.location}</span>
          </div>
        </div>
      </div>
      <div class="upcoming-event-right">
        <div class="upcoming-event-price">
          <div class="upcoming-price">${event.price === 0 ? 'FREE' : '₹' + event.price}</div>
        </div>
        <button class="btn-view-details" onclick="viewEventDetails('${event.title}')">View Details</button>
      </div>
    </div>
  `;
  return upcomingEvent;
}

// ============================================
// UPDATE CATEGORY PAGES
// ============================================

async function updateCategoryEvents(category) {
  const allEvents = await loadAllEvents();
  
  // Filter events by category
  const categoryEventsData = allEvents.filter(e => e.category === category);
  
  if (categoryEventsData.length === 0) return;
  
  // Update category events data
  if (!categoryEvents[category]) {
    categoryEvents[category] = [];
  }
  
  // Merge new events
  categoryEventsData.forEach(event => {
    const exists = categoryEvents[category].some(e => e.title === event.title);
    if (!exists) {
      categoryEvents[category].push({
        title: event.title,
        description: event.description,
        date: event.date,
        time: event.time,
        location: event.location,
        price: event.price,
        image: event.image,
        attendees: event.attendees || 0
      });
    }
  });
  
  console.log('✅ Updated category:', category, 'with', categoryEvents[category].length, 'events');
}

// ============================================
// REFRESH EVENTS AFTER CREATION
// ============================================

async function refreshEventsAfterCreation(newEvent) {
  console.log('🔄 Refreshing events after creation...');
  
  // 1. Add to completeEventsDatabase
  completeEventsDatabase[newEvent.title] = newEvent;
  
  // 2. Add to category events
  if (!categoryEvents[newEvent.category]) {
    categoryEvents[newEvent.category] = [];
  }
  
  const exists = categoryEvents[newEvent.category].some(e => e.title === newEvent.title);
  if (!exists) {
    categoryEvents[newEvent.category].push({
      title: newEvent.title,
      description: newEvent.description,
      date: newEvent.date,
      time: newEvent.time,
      location: newEvent.location,
      price: newEvent.price,
      image: newEvent.image,
      attendees: newEvent.attendees || 0
    });
  }
  
  // 3. Reload and display all events
  await displayEventsOnHomePage();
  
  console.log('✅ Events refreshed successfully');
}

// ============================================
// AUTO-LOAD EVENTS ON PAGE LOAD
// ============================================

document.addEventListener('DOMContentLoaded', function() {
  // Load events when page loads
  displayEventsOnHomePage();
  
  // Reload events when returning to home page
  const originalShowPage = window.showPage;
  if (originalShowPage) {
    window.showPage = function(page) {
      originalShowPage(page);
      
      // Refresh events when showing home page
      if (page === 'home') {
        setTimeout(() => {
          displayEventsOnHomePage();
        }, 100);
      }
    };
  }
  
  console.log('✅ Dynamic event display system initialized');
});

// ============================================
// UPDATE CREATE EVENT SUCCESS HANDLER
// ============================================

// Update the existing showEventCreatedSuccess function
const originalShowEventCreatedSuccess = window.showEventCreatedSuccess;
window.showEventCreatedSuccess = async function(event) {
  // Call original function
  if (originalShowEventCreatedSuccess) {
    originalShowEventCreatedSuccess(event);
  }
  
  // Refresh events to show new event
  await refreshEventsAfterCreation(event);
};

// ============================================
// UPDATE BACK TO HOME FROM SUCCESS
// ============================================

const originalBackToHomeFromSuccess = window.backToHomeFromSuccess;
window.backToHomeFromSuccess = async function() {
  document.getElementById('event-created-modal').classList.add('hidden');
  document.body.style.overflow = '';
  document.body.style.height = '';
  
  currentCreatedEvent = null;
  showPage('home');
  
  // Refresh events display
  await displayEventsOnHomePage();
};

// ============================================
// SEARCH AND FILTER EVENTS
// ============================================

async function searchEvents(query) {
  const allEvents = await loadAllEvents();
  
  const searchLower = query.toLowerCase();
  const results = allEvents.filter(event => 
    event.title.toLowerCase().includes(searchLower) ||
    event.description.toLowerCase().includes(searchLower) ||
    event.location.toLowerCase().includes(searchLower) ||
    event.category.toLowerCase().includes(searchLower)
  );
  
  return results;
}

async function filterEventsByCategory(category) {
  const allEvents = await loadAllEvents();
  return allEvents.filter(event => event.category === category);
}

async function filterEventsByPrice(minPrice, maxPrice) {
  const allEvents = await loadAllEvents();
  return allEvents.filter(event => 
    event.price >= minPrice && event.price <= maxPrice
  );
}

// ============================================
// EXPORT FUNCTIONS
// ============================================

window.loadAllEvents = loadAllEvents;
window.displayEventsOnHomePage = displayEventsOnHomePage;
window.refreshEventsAfterCreation = refreshEventsAfterCreation;
window.searchEvents = searchEvents;
window.filterEventsByCategory = filterEventsByCategory;
window.filterEventsByPrice = filterEventsByPrice;
window.updateCategoryEvents = updateCategoryEvents;

console.log('✅ Dynamic Event Display System loaded successfully');// UPDATED CREATE EVENT FORM HANDLER
// Replace the existing form submission handler in your app.js

document.addEventListener('DOMContentLoaded', function() {
  const createEventForm = document.getElementById('create-event-form');
  
  if (createEventForm) {
    createEventForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      
      const submitBtn = this.querySelector('.btn-create-event');
      const originalText = submitBtn.innerHTML;
      submitBtn.innerHTML = '<span>⏳</span><span>Creating Event...</span>';
      submitBtn.disabled = true;
      
      try {
        const formData = new FormData(this);
        
        if (!uploadedEventImage) {
          showNotification('⚠️ Please upload an event image', 'error');
          submitBtn.innerHTML = originalText;
          submitBtn.disabled = false;
          return;
        }
        
        // Format date
        const dateInput = formData.get('date');
        const dateObj = new Date(dateInput);
        const formattedDate = dateObj.toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        });
        
        // Format time
        const timeInput = formData.get('time');
        const [hours, minutes] = timeInput.split(':');
        const timeObj = new Date();
        timeObj.setHours(parseInt(hours), parseInt(minutes));
        const formattedTime = timeObj.toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit' 
        });
        
        const venue = formData.get('venue');
        const city = formData.get('city');
        const fullLocation = `${venue}, ${city}`;
        
        const highlightsText = formData.get('highlights');
        const highlights = highlightsText
          ? highlightsText.split('\n').filter(h => h.trim() !== '')
          : [];
        
        // Create event object
        const newEvent = {
          id: 'EVENT-' + Date.now(),
          eventId: 'EVENT-' + Date.now(),
          title: formData.get('title'),
          category: formData.get('category'),
          description: formData.get('description'),
          date: formattedDate,
          time: formattedTime,
          location: fullLocation,
          venue: venue,
          city: city,
          state: formData.get('state'),
          address: formData.get('address') || '',
          price: parseInt(formData.get('price')),
          maxAttendees: parseInt(formData.get('maxAttendees') || 100),
          attendees: 0,
          image: uploadedEventImage,
          highlights: highlights,
          whatToExpect: formData.get('whatToExpect') || '',
          contactEmail: formData.get('contactEmail'),
          contactPhone: formData.get('contactPhone') || '',
          createdBy: localStorage.getItem('userName') || 'Anonymous',
          createdByEmail: localStorage.getItem('userEmail'),
          createdAt: new Date().toISOString(),
          status: 'active'
        };
        
        // Try to send to backend
        try {
          const response = await fetch(`${API_URL}/events/create`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('token') || 'demo-token'}`
            },
            body: JSON.stringify(newEvent)
          });
          
          if (response.ok) {
            const data = await response.json();
            console.log('✅ Event created on backend:', data);
          }
        } catch (error) {
          console.log('⚠️ Backend unavailable, saving locally:', error.message);
        }
        
        // Store event locally
        createdEvents.push(newEvent);
        localStorage.setItem('createdEvents', JSON.stringify(createdEvents));
        
        // ⭐ ADD TO COMPLETE EVENTS DATABASE
        completeEventsDatabase[newEvent.title] = newEvent;
        
        // ⭐ ADD TO CATEGORY EVENTS
        if (!categoryEvents[newEvent.category]) {
          categoryEvents[newEvent.category] = [];
        }
        categoryEvents[newEvent.category].push({
          title: newEvent.title,
          description: newEvent.description,
          date: newEvent.date,
          time: newEvent.time,
          location: newEvent.location,
          price: newEvent.price,
          image: newEvent.image,
          attendees: newEvent.attendees
        });
        
        currentCreatedEvent = newEvent;
        
        // Reset form
        this.reset();
        removeEventImage();
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
        
        // ⭐ REFRESH EVENTS DISPLAY
        await refreshEventsAfterCreation(newEvent);
        
        // Show success modal
        showEventCreatedSuccess(newEvent);
        
        showNotification('✅ Event created and published successfully!', 'success');
        
      } catch (error) {
        console.error('❌ Error creating event:', error);
        showNotification('❌ Failed to create event: ' + error.message, 'error');
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
      }
    });
  }
});

// ============================================
// ENHANCED SUCCESS MODAL FUNCTIONS
// ============================================

// View Created Event (Updated)
function viewMyCreatedEvent() {
  if (currentCreatedEvent) {
    document.getElementById('event-created-modal').classList.add('hidden');
    document.body.style.overflow = '';
    document.body.style.height = '';
    
    // Make sure event is in the database
    completeEventsDatabase[currentCreatedEvent.title] = currentCreatedEvent;
    
    // Show event details
    viewEventDetails(currentCreatedEvent.title);
  }
}

// Back to Home from Success (Updated)
async function backToHomeFromSuccess() {
  document.getElementById('event-created-modal').classList.add('hidden');
  document.body.style.overflow = '';
  document.body.style.height = '';
  
  currentCreatedEvent = null;
  showPage('home');
  
  // ⭐ REFRESH EVENTS DISPLAY
  await displayEventsOnHomePage();
  
  // Scroll to "My Events" section if it exists
  setTimeout(() => {
    const myEventsSection = document.getElementById('my-events-section');
    if (myEventsSection) {
      myEventsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, 500);
}

// Create Another Event (Updated)
function createAnotherEvent() {
  document.getElementById('event-created-modal').classList.add('hidden');
  document.body.style.overflow = '';
  document.body.style.height = '';
  
  currentCreatedEvent = null;
  
  // Refresh display first
  displayEventsOnHomePage().then(() => {
    // Then open create event page
    openCreateEventPage();
  });
}

console.log('✅ Updated Create Event Handler with auto-display loaded');
document.addEventListener("DOMContentLoaded", () => {
  // Smooth scroll for all internal links
  document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener("click", e => {
      e.preventDefault();
      const target = document.querySelector(link.getAttribute("href"));
      if (target) {
        target.scrollIntoView({ behavior: "smooth" });
      }
    });
  });

  // Navbar scroll effect
  const header = document.querySelector("header");
  window.addEventListener("scroll", () => {
    header.classList.toggle("scrolled", window.scrollY > 50);
  });
  });
