/**
 * Offline status detection and handling
 */

document.addEventListener('DOMContentLoaded', () => {
    const connPill = document.getElementById('connPill');

    function updateOnlineStatus() {
        if (!connPill) return;
        if (navigator.onLine) {
            connPill.dataset.state = 'online';
            if (window.showToast) window.showToast('Back online. Data syncing available.');
        } else {
            connPill.dataset.state = 'offline';
            if (window.showToast) window.showToast('You are offline. Basic features will still work.');
            console.log("You are currently offline. Basic features will still work.");
        }
    }

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    // Initial check
    updateOnlineStatus();
});
