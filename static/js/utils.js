// Global error handling for fetch requests
async function fetchWithErrorHandling(url, options = {}) {
    try {
        showLoading();
        const response = await fetch(url, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'An unexpected error occurred');
        }

        return data;
    } catch (error) {
        showNotification('Error', error.message, 'error');
        throw error;
    } finally {
        hideLoading();
    }
}

// Loading overlay management
function showLoading() {
    document.getElementById('loading-overlay').style.display = 'flex';
}

function hideLoading() {
    document.getElementById('loading-overlay').style.display = 'none';
}

// Toast notifications
const toasts = [];
function showNotification(title, message, type = 'info') {
    const toast = document.getElementById('toast-notification');
    const toastTitle = document.getElementById('toast-title');
    const toastMessage = document.getElementById('toast-message');
    const toastIcon = document.getElementById('toast-icon');

    // Set icon and color based on type
    const iconMap = {
        'success': 'fa-check-circle text-success',
        'error': 'fa-exclamation-circle text-danger',
        'warning': 'fa-exclamation-triangle text-warning',
        'info': 'fa-info-circle text-info'
    };

    toastIcon.className = `fas ${iconMap[type] || iconMap.info} me-2`;
    toastTitle.textContent = title;
    toastMessage.textContent = message;

    // Ensure any existing toast is hidden first
    const bsToast = bootstrap.Toast.getInstance(toast);
    if (bsToast) {
        bsToast.hide();
    }

    // Set longer delays for error messages
    const delay = type === 'error' ? 5000 : 3000;  // 5 seconds for errors, 3 for others

    // Create new toast with updated options
    const newToast = new bootstrap.Toast(toast, {
        animation: true,
        autohide: false,  // Don't auto-hide any messages
        delay: delay
    });

    // Remove any existing show class to reset animation
    toast.classList.remove('show');
    // Force browser reflow
    void toast.offsetWidth;
    
    newToast.show();

    // For error messages, don't auto-hide
    if (type !== 'error') {
        setTimeout(() => {
            newToast.hide();
        }, delay);
    }
}

// Add this function to handle error messages specifically
function showErrorMessage(title, message, callback = null, delay = 5000) {
    showNotification(title, message, 'error');
    
    if (callback) {
        setTimeout(() => {
            const toastEl = document.getElementById('toast-notification');
            const toast = bootstrap.Toast.getInstance(toastEl);
            if (toast) {
                toast.hide();
            }
            callback();
        }, delay);
    }
}

// Input validation
function validateNumberInput(input, min, max) {
    const value = parseInt(input.value);
    if (isNaN(value)) {
        showNotification('Invalid Input', 'Please enter a valid number', 'error');
        return false;
    }
    if (value < min || value > max) {
        showNotification('Invalid Input', `Please enter a number between ${min} and ${max}`, 'error');
        return false;
    }
    return true;
}

function validatePlayerName(name) {
    if (!name || name.trim().length === 0) {
        showNotification('Invalid Input', 'Player name cannot be empty', 'error');
        return false;
    }
    if (!/^[a-zA-Z\s]+$/.test(name)) {
        showNotification('Invalid Input', 'Player name should only contain letters', 'error');
        return false;
    }
    return true;
}

// Session management
function checkGameSession() {
    const gameState = sessionStorage.getItem('gameState');
    if (gameState) {
        return JSON.parse(gameState);
    }
    return null;
}

function saveGameSession(state) {
    sessionStorage.setItem('gameState', JSON.stringify(state));
}

function clearGameSession() {
    sessionStorage.removeItem('gameState');
}

// Keyboard event handling
function handleEnterKey(event, callback) {
    if (event.key === 'Enter') {
        event.preventDefault();
        callback();
    }
}

// Score formatting
function formatScore(score) {
    return `${score} attempt${score === 1 ? '' : 's'}`;
}

// Date formatting
function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Confirmation dialog
function confirmAction(message) {
    return new Promise((resolve) => {
        const result = window.confirm(message);
        resolve(result);
    });
}

// Error boundary
window.addEventListener('error', function(event) {
    showNotification('Error', 'An unexpected error occurred. Please try refreshing the page.', 'error');
    console.error('Global error:', event.error);
});

// Network status monitoring
window.addEventListener('online', () => {
    showNotification('Connection Restored', 'You are back online!', 'success');
});

window.addEventListener('offline', () => {
    showNotification('Connection Lost', 'Please check your internet connection', 'warning');
});

// Page visibility handling
let visibilityHandler = null;
function initVisibilityHandler() {
    if (visibilityHandler) {
        document.removeEventListener('visibilitychange', visibilityHandler);
    }
    
    visibilityHandler = () => {
        if (document.hidden) {
            const gameState = checkGameSession();
            if (gameState && gameState.status === 'active') {
                // Handle game pause
            }
        }
    };
    
    document.addEventListener('visibilitychange', visibilityHandler);
} 