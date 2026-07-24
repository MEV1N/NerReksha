/**
 * Offline status detection and handling
 */

document.addEventListener('DOMContentLoaded', () => {
    const statusIndicator = document.getElementById('status-indicator');

    function updateOnlineStatus() {
        if (navigator.onLine) {
            statusIndicator.textContent = 'Online';
            statusIndicator.className = 'status online';
        } else {
            statusIndicator.textContent = 'Offline';
            statusIndicator.className = 'status offline';
            console.log("You are currently offline. Basic features will still work.");
        }
    }

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    // Initial check
    updateOnlineStatus();
});
