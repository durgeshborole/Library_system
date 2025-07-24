document.addEventListener("DOMContentLoaded", () => {
    const barcodeInput = document.getElementById("barcodeInput");
    const visitorDetails = document.getElementById("visitorDetails");
    const logTable = document.getElementById("logTable");
    const statusMsg = document.createElement("p");
    statusMsg.style.marginTop = "10px";
    barcodeInput.insertAdjacentElement("afterend", statusMsg);

    let barcode = "";
    let typingTimer;
    let db;

    // --- IndexedDB Initialization ---
    const request = indexedDB.open("offline_scans", 1);

    request.onerror = (event) => {
        console.error("IndexedDB error:", event.target.error);
    };

    request.onupgradeneeded = (event) => {
        const db = event.target.result;
        db.createObjectStore("scans", { autoIncrement: true });
    };

    request.onsuccess = (event) => {
        db = event.target.result;
        // Attempt to sync any stored offline scans when the page loads and is online
        if (navigator.onLine) {
            syncOfflineScans();
        }
    };

    // --- Online/Offline Event Listeners ---
    window.addEventListener('online', syncOfflineScans);
    window.addEventListener('offline', () => {
        statusMsg.textContent = "🔌 You are currently offline. Scans will be saved locally.";
        statusMsg.style.color = "orange";
    });


    // Barcode scanning functionality
    barcodeInput.addEventListener("input", () => {
        clearTimeout(typingTimer);
        barcode = barcodeInput.value.trim();

        typingTimer = setTimeout(() => {
            if (barcode) {
                if (navigator.onLine) {
                    submitBarcode(barcode);
                } else {
                    saveScanOffline(barcode);
                }
                barcodeInput.value = "";
                barcode = "";
            }
        }, 200);
    });

    // Save scan to IndexedDB when offline
    function saveScanOffline(barcode) {
        if (!db) return;
        const transaction = db.transaction(["scans"], "readwrite");
        const store = transaction.objectStore("scans");
        store.add({ barcode, timestamp: new Date() });

        transaction.oncomplete = () => {
            statusMsg.textContent = "💾 Scan saved locally.";
            statusMsg.style.color = "orange";
        };

        transaction.onerror = (event) => {
            console.error("Error saving scan offline:", event.target.error);
            statusMsg.textContent = "❌ Error saving scan locally.";
            statusMsg.style.color = "red";
        };
    }

    // Sync offline scans with the server
    async function syncOfflineScans() {
        if (!db) return;
        const transaction = db.transaction(["scans"], "readwrite");
        const store = transaction.objectStore("scans");
        const getAll = store.getAll();

        getAll.onsuccess = async (event) => {
            const offlineScans = event.target.result;
            if (offlineScans.length > 0) {
                statusMsg.textContent = `🔄 Syncing ${offlineScans.length} offline scans...`;
                statusMsg.style.color = "blue";

                for (const scan of offlineScans) {
                    await submitBarcode(scan.barcode);
                }

                // Clear the stored scans after successful sync
                const clearTransaction = db.transaction(["scans"], "readwrite");
                const clearStore = clearTransaction.objectStore("scans");
                clearStore.clear();

                statusMsg.textContent = "✅ All offline scans have been synced.";
                statusMsg.style.color = "green";
                fetchLiveLog();
            }
        };

        getAll.onerror = (event) => {
            console.error("Error fetching offline scans:", event.target.error);
        };
    }


    // Sends barcode to backend and updates UI based on response
    async function submitBarcode(barcode) {
        try {
            const response = await fetch("http://localhost:5000/scan", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ barcode }),
            });

            const data = await response.json();

            if (data.error) {
                statusMsg.textContent = data.error;
                statusMsg.style.color = "red";
            } else {
                displayVisitor(data);
                fetchLiveLog();
                statusMsg.textContent = `${data.status === 'entry' ? '✅ Entry' : '🚪 Exit'} recorded for ${data.name}`;
                statusMsg.style.color = "green";
            }
        } catch (err) {
            console.error("Scan error:", err);
            statusMsg.textContent = "Error connecting to server";
            statusMsg.style.color = "red";
            // If the server is unreachable, save the scan for later
            saveScanOffline(barcode);
        }
    }

    // Fetches current day's log from backend
    async function fetchLiveLog() {
        try {
            const response = await fetch("http://localhost:5000/live-log");
            const log = await response.json();
            updateLiveLog(log);
        } catch (err) {
            console.error("Error fetching live log:", err);
            logTable.innerHTML = `<tr><td colspan="7" style="text-align: center; color: red;">Could not load live log.</td></tr>`;
        }
    }

    // Displays visitor details including photo
    function displayVisitor(visitor) {
        const imageUrl = visitor.photoUrl || "/Backend/public/images/default.jpg";
        visitorDetails.innerHTML = `
      <h2>Visitor Details</h2>
      <div class="visitor-card">
        <div class="photo-side"><img src="${imageUrl}" alt="Visitor Photo" class="visitor-photo" /></div>
        <div class="info-side">
          <p><strong>Name:</strong> ${visitor.name}</p>
          <p><strong>Department:</strong> ${visitor.department}</p>
          <p><strong>Year:</strong> ${visitor.year || "-"}</p>
          <p><strong>Designation:</strong> ${visitor.designation}</p>
        </div>
      </div>`;
    }

    // Updates the log table, handling empty logs
    function updateLiveLog(log) {
        logTable.innerHTML = "";
        if (!log || log.length === 0) {
            const row = document.createElement("tr");
            row.innerHTML = `<td colspan="7" style="text-align: center;">No entries recorded for today.</td>`;
            logTable.appendChild(row);
        } else {
            log.forEach((entry) => {
                const row = document.createElement("tr");
                const duration = entry.exitTime ? ((new Date(entry.exitTime) - new Date(entry.entryTime)) / 1000).toFixed(0) : "-";
                row.innerHTML = `
          <td>${entry.name}</td>
          <td>${entry.department}</td>
          <td>${entry.year || "-"}</td>
          <td>${entry.designation}</td>
          <td>${formatDate(entry.entryTime)}</td>
          <td>${entry.exitTime ? formatDate(entry.exitTime) : "-"}</td>
          <td>${duration !== "-" ? duration + " sec" : "-"}</td>`;
                logTable.appendChild(row);
            });
        }
    }

    async function loadLiveLog() {
        try {
            const res = await fetch("http://localhost:5000/live-log");
            const logs = await res.json();
            const logTable = document.getElementById("logTable");
            logTable.innerHTML = "";

            logs.forEach((log) => {
                const row = document.createElement("tr");
                row.innerHTML = `
        <td>${log.name}</td>
        <td>${log.department}</td>
        <td>${log.year}</td>
        <td>${log.designation}</td>
        <td>${new Date(log.entryTime).toLocaleTimeString()}</td>
        <td>${log.exitTime ? new Date(log.exitTime).toLocaleTimeString() : "-"}</td>
        <td>${log.exitTime ? getDuration(log.entryTime, log.exitTime) : "-"}</td>
      `;
                logTable.appendChild(row);
            });
        } catch (err) {
            console.error("Error loading live log:", err);
        }
    }


    function formatDate(dateStr) {
        if (!dateStr) return "-";
        return new Date(dateStr).toLocaleTimeString();
    }

    function getDuration(entry, exit) {
        const diff = new Date(exit) - new Date(entry);
        const mins = Math.floor(diff / 60000);
        return `${mins} min`;
    }

    fetchLiveLog();

    loadLiveLog();
});