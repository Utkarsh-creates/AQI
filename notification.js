    // AQI Notification System
    // This file adds notification functionality to the Air Quality Dashboard

    // Configuration
    const NOTIFICATION_THRESHOLD = 250; // AQI threshold for triggering notifications
    const NOTIFICATION_REPEAT_INTERVAL = 10000; // 10 seconds in milliseconds (changed from 5 minutes)
    const NOTIFICATION_SOUND_URL = 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'; // Default alert sound

    // State management
    let notificationState = {
    lastNotificationTime: 0,
    hasPermission: false,
    enabled: false,
    notifiedESPs: {},
    audioContext: null,
    soundBuffer: null
    };

    // Initialize notification system
    function initNotificationSystem() {
    console.log('Initializing AQI notification system...');
    
    // Check if browser supports notifications
    if (!('Notification' in window)) {
        console.warn('This browser does not support desktop notifications');
        return;
    }
    
    // Load previous notification preference
    const savedPreference = localStorage.getItem('aqi_notifications_enabled');
    notificationState.enabled = savedPreference === 'true';
    
    // Check if permission is already granted
    if (Notification.permission === 'granted') {
        notificationState.hasPermission = true;
        createAudioContext();
        // Permission already granted, no need to ask again
    } else if (Notification.permission !== 'denied' && !localStorage.getItem('notification_permission_asked')) {
        // Ask for permission only once
        requestNotificationPermission();
    }
    
    // Add simplified alert button to page
    addNotificationButton();
    
    // Set up Firebase data listener for real-time updates
    setupRealtimeListener();
    
    // Add styles for notifications if not already present
    addNotificationStyles();
    
    // Register service worker for background notifications if supported
    registerServiceWorker();
    }

    // Request notification permission
    function requestNotificationPermission() {
    Notification.requestPermission().then(permission => {
        // Mark that we've asked permission
        localStorage.setItem('notification_permission_asked', 'true');
        
        if (permission === 'granted') {
        notificationState.hasPermission = true;
        notificationState.enabled = true;
        localStorage.setItem('aqi_notifications_enabled', 'true');
        createAudioContext();
        updateNotificationButton();
        
        // Show confirmation
        showOnScreenAlert('System', 'AQI Alerts enabled');
        }
    });
    }

    // Register service worker for background notifications
    function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('services.js')
        .then(registration => {
            console.log('Service Worker registered with scope:', registration.scope);
        })
        .catch(error => {
            console.error('Service Worker registration failed:', error);
        });
    }
    }

    // Create Web Audio Context and load sound
    function createAudioContext() {
    try {
        // Create audio context
        window.AudioContext = window.AudioContext || window.webkitAudioContext;
        notificationState.audioContext = new AudioContext();
        
        // Load sound file
        fetch(NOTIFICATION_SOUND_URL)
        .then(response => response.arrayBuffer())
        .then(arrayBuffer => notificationState.audioContext.decodeAudioData(arrayBuffer))
        .then(audioBuffer => {
            notificationState.soundBuffer = audioBuffer;
            console.log('Notification sound loaded successfully');
        })
        .catch(error => console.error('Error loading sound:', error));
    } catch (e) {
        console.error('Web Audio API is not supported in this browser', e);
    }
    }

    // Play notification sound
    function playNotificationSound() {
    if (!notificationState.audioContext || !notificationState.soundBuffer) {
        console.warn('Audio not ready');
        return;
    }
    
    try {
        // Resume audio context if suspended (needed for Chrome's autoplay policy)
        if (notificationState.audioContext.state === 'suspended') {
        notificationState.audioContext.resume();
        }
        
        // Create sound source
        const source = notificationState.audioContext.createBufferSource();
        source.buffer = notificationState.soundBuffer;
        source.connect(notificationState.audioContext.destination);
        source.start(0);
    } catch (e) {
        console.error('Error playing notification sound:', e);
    }
    }

    // Check if we should send notification (time-based throttling)
    function shouldNotify() {
    const now = Date.now();
    if (now - notificationState.lastNotificationTime > NOTIFICATION_REPEAT_INTERVAL) {
        notificationState.lastNotificationTime = now;
        return true;
    }
    return false;
    }

    // Get display name based on ESP ID and current mode
    function getDisplayName(espName) {
    const currentMode = document.getElementById('mode-selector')?.value || 'single';
    
    if (currentMode === 'single') {
        switch(espName) {
        case 'ESP1': return 'North Wall';
        case 'ESP2': return 'East Wall';
        case 'ESP3': return 'South Wall';
        default: return espName;
        }
    } else {
        switch(espName) {
        case 'ESP1': return 'Room 1';
        case 'ESP2': return 'Room 2';
        case 'ESP3': return 'Room 3';
        default: return espName;
        }
    }
    }

    // Create and show desktop notification
    function showNotification(espName, aqi) {
    // Check if notification is allowed and enabled
    if (!notificationState.hasPermission || !notificationState.enabled) {
        return;
    }
    
    // Get friendly name based on current mode
    let displayName = getDisplayName(espName);
    
    // Configure notification
    let title = `🚨 ${displayName}: Critical AQI Level!`;
    let message = `Air Quality Index: ${aqi} - Dangerous level detected`;
    let icon = 'https://cdn-icons-png.flaticon.com/512/1682/1682643.png';
    
    // Try to use service worker for notification if available (for background notifications)
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.ready.then(registration => {
        registration.showNotification(title, {
            body: message,
            icon: icon,
            badge: icon,
            vibrate: [100, 50, 100],
            tag: `aqi-alert-${espName}`,
            requireInteraction: true,
            data: {
            espName: espName,
            aqi: aqi,
            timestamp: Date.now()
            }
        });
        });
    } else {
        // Fallback to regular notification
        const notification = new Notification(title, {
        body: message,
        icon: icon,
        badge: icon,
        vibrate: [100, 50, 100],
        tag: `aqi-alert-${espName}`,
        requireInteraction: true
        });
        
        // Handle notification click
        notification.onclick = function() {
        window.focus();
        notification.close();
        };
    }
    
    // Play sound
    playNotificationSound();
    
    // Show on-screen notification
    showOnScreenAlert(displayName, aqi);
    }

    // Create and show on-screen alert
    function showOnScreenAlert(displayName, aqi) {
    const alertDiv = document.createElement('div');
    alertDiv.className = 'aqi-alert';
    
    // If this is a system message (not an actual AQI alert)
    if (displayName === 'System') {
        alertDiv.innerHTML = `
        <div class="aqi-alert-header system-alert">
            <div class="aqi-alert-title">Notification System</div>
            <button class="aqi-alert-close">&times;</button>
        </div>
        <div class="aqi-alert-body">
            <div class="aqi-alert-icon">ℹ️</div>
            <div class="aqi-alert-content">
            <div class="aqi-alert-message">${aqi}</div>
            </div>
        </div>
        `;
    } else {
        // This is an actual AQI alert
        alertDiv.innerHTML = `
        <div class="aqi-alert-header">
            <div class="aqi-alert-title">${displayName}</div>
            <button class="aqi-alert-close">&times;</button>
        </div>
        <div class="aqi-alert-body">
            <div class="aqi-alert-icon">⚠️</div>
            <div class="aqi-alert-content">
            <div class="aqi-alert-message">CRITICAL AIR QUALITY!</div>
            <div class="aqi-alert-details">AQI Level: ${aqi}</div>
            </div>
        </div>
        `;
    }
    
    // Add to DOM
    document.body.appendChild(alertDiv);
    
    // Animation effect
    setTimeout(() => {
        alertDiv.classList.add('active');
    }, 10);
    
    // Setup close button
    const closeBtn = alertDiv.querySelector('.aqi-alert-close');
    closeBtn.addEventListener('click', () => {
        alertDiv.classList.remove('active');
        setTimeout(() => {
        document.body.removeChild(alertDiv);
        }, 500);
    });
    
    // Auto close after 10 seconds
    setTimeout(() => {
        if (document.body.contains(alertDiv)) {
        alertDiv.classList.remove('active');
        setTimeout(() => {
            if (document.body.contains(alertDiv)) {
            document.body.removeChild(alertDiv);
            }
        }, 500);
        }
    }, 10000);
    }

   // Add simplified notification button
function addNotificationButton() {
    const controls = document.querySelector('.controls');
    
    const notifyBtn = document.createElement('button');
    notifyBtn.id = 'notification-btn';
    notifyBtn.className = notificationState.enabled ? 'control-btn active' : 'control-btn';
    
    // Set initial button state
    updateNotificationButton(notifyBtn);
    
    notifyBtn.addEventListener('click', () => {
      if (Notification.permission === 'granted') {
        // Toggle notification state
        notificationState.enabled = !notificationState.enabled;
        localStorage.setItem('aqi_notifications_enabled', notificationState.enabled ? 'true' : 'false');
        updateNotificationButton(notifyBtn);
        
        // Show confirmation
        if (notificationState.enabled) {
          showOnScreenAlert('System', 'AQI Alerts enabled');
        } else {
          showOnScreenAlert('System', 'AQI Alerts disabled');
        }
      } else if (Notification.permission !== 'denied') {
        // Request permission if not denied
        requestNotificationPermission();
      } else {
        // Permission was denied, inform user they need to change browser settings
        showOnScreenAlert('System', 'Notification permission denied. Please enable notifications in your browser settings.');
      }
    });
    
    controls.appendChild(notifyBtn);
  }
  
  // Update notification button state
  function updateNotificationButton(button) {
    if (!button) {
      button = document.getElementById('notification-btn');
      if (!button) return;
    }
    
    if (Notification.permission === 'granted') {
      if (notificationState.enabled) {
        button.textContent = 'Alerts: ON';
        button.classList.add('active');
      } else {
        button.textContent = 'Alerts: OFF';
        button.classList.remove('active');
      }
    } else {
      button.textContent = 'Enable Alerts';
      button.classList.remove('active');
    }
  }
    // Setup Firebase real-time listener
    function setupRealtimeListener() {
    // Check if Firebase is initialized
    if (!firebase || !firebase.database) {
        console.error('Firebase not initialized');
        return;
    }
    
    const db = firebase.database();
    
    // Listen for ESP1
    db.ref('ESP1').on('value', snapshot => {
        checkAQIValue('ESP1', snapshot.val());
    });
    
    // Listen for ESP2
    db.ref('ESP2').on('value', snapshot => {
        checkAQIValue('ESP2', snapshot.val());
    });
    
    // Listen for ESP3
    db.ref('ESP3').on('value', snapshot => {
        checkAQIValue('ESP3', snapshot.val());
    });
    
    console.log('Real-time listeners set up successfully');
    }

    // Check AQI value and trigger notification if needed
    function checkAQIValue(espName, data) {
    if (!data || !data.final_aqi) return;
    
    const aqi = parseInt(data.final_aqi);
    
    // Check if above critical threshold
    if (aqi >= NOTIFICATION_THRESHOLD) {
        // Notify if above threshold (every NOTIFICATION_REPEAT_INTERVAL)
        if (shouldNotify()) {
        showNotification(espName, aqi);
        }
    }
    }

    // Test notification function (for development)
    function testNotification() {
    showNotification('ESP1', 345);
    }

    // Export functions for possible external use
    window.aqiNotifications = {
    test: testNotification,
    toggleEnabled: function() {
        if (notificationState.hasPermission) {
        notificationState.enabled = !notificationState.enabled;
        localStorage.setItem('aqi_notifications_enabled', notificationState.enabled ? 'true' : 'false');
        updateNotificationButton();
        return notificationState.enabled;
        }
        return false;
    },
    getState: function() {
        return {
        enabled: notificationState.enabled,
        hasPermission: notificationState.hasPermission
        };
    }
    };

    // Initialize when the document is ready
    document.addEventListener('DOMContentLoaded', function() {
    // Initialize notification system after main application is loaded
    setTimeout(initNotificationSystem, 1000);
    });