// permission.js - Triggering Chrome's microphone permission prompt
document.getElementById('grant-btn').onclick = async () => {
    const statusDiv = document.getElementById('status');
    statusDiv.textContent = "Requesting permission...";

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

        // Success!
        statusDiv.style.color = "#1e8e3e";
        statusDiv.textContent = "✅ Permission granted! Closing in 2 seconds...";

        // Stop all tracks to release the mic
        stream.getTracks().forEach(track => track.stop());

        // Close the tab (optional, but cleaner)
        setTimeout(() => {
            window.close();
        }, 2000);

    } catch (err) {
        statusDiv.style.color = "#d93025";
        statusDiv.textContent = "❌ Permission denied: " + err.message;
        console.error("Microphone permission failed:", err);
    }
};

// Auto-request for faster flow
window.addEventListener('load', async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
        document.getElementById('status').style.color = "#1e8e3e";
        document.getElementById('status').textContent = "✅ Permission already granted!";
        setTimeout(() => window.close(), 1000);
    } catch (e) {
        // Just wait for user click if auto fails
    }
});
