// document.addEventListener("DOMContentLoaded", () => {
//   const barcodeInput = document.getElementById("barcodeInput");
//   const visitorDetails = document.getElementById("visitorDetails");
//   const logTable = document.getElementById("logTable");
//   const statusMsg = document.createElement("p");
//   const webcam = document.getElementById("webcam");
//   const faceStatus = document.getElementById("faceStatus");
//   statusMsg.style.marginTop = "10px";
//   barcodeInput.insertAdjacentElement("afterend", statusMsg);


//   let modelsLoaded = false;
//   let knownDescriptors = [];

//   let barcode = "";
//   let typingTimer;








// // Triggers on input and simulates a scanner with a delay
// barcodeInput.addEventListener("input", () => {
//   clearTimeout(typingTimer);
//   barcode = barcodeInput.value.trim();

//   typingTimer = setTimeout(() => {
//     if (barcode) {
//       submitBarcode(barcode);
//       barcodeInput.value = "";
//       barcode = "";
//     }
//   }, 200);
// });

// // Sends barcode to backend and updates UI based on response
// async function submitBarcode(barcode) {
//   try {
//     const response = await fetch("http://localhost:5000/scan", {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify({ barcode }),
//     });

//     const data = await response.json();

//     if (data.error) {
//       statusMsg.textContent = data.error;
//       statusMsg.style.color = "red";
//     } else {
//       displayVisitor(data);
//       fetchLiveLog();
//       statusMsg.textContent = `${data.status === 'entry' ? '✅ Entry' : '🚪 Exit'} recorded for ${data.name}`;
//       statusMsg.style.color = "green";
//     }
//   } catch (err) {
//     console.error("Scan error:", err);
//     statusMsg.textContent = "Error connecting to server";
//     statusMsg.style.color = "red";
//   }
// }

// // Fetches current day's log from backend
// async function fetchLiveLog() {
//   try {
//     const response = await fetch("http://localhost:5000/live-log");
//     const log = await response.json();
//     updateLiveLog(log);
//   } catch (err) {
//     console.error("Error fetching live log:", err);
//   }
// }

// // Displays visitor details including photo
// // function displayVisitor(visitor) {
// //   visitorDetails.innerHTML = `
// //     <h2>Visitor Details</h2>
// //     ${visitor.photoUrl ? `<img src="${visitor.photoUrl}" alt="Visitor Photo" class="visitor-photo" />` : ""}
// //     <p><strong>Name:</strong> ${visitor.name}</p>
// //     <p><strong>Department:</strong> ${visitor.department}</p>
// //     <p><strong>Year:</strong> ${visitor.year || "-"}</p>
// //     <p><strong>Designation:</strong> ${visitor.designation}</p>
// //   `;
// // }

// function displayVisitor(visitor) {
//   const imageUrl = visitor.photoUrl || "/images/default.jpg"; // 👈 fallback image

//   visitorDetails.innerHTML = `
//     <h2>Visitor Details</h2>
//     <div class="visitor-card">
//       <div class="photo-side">
//         <img src="${imageUrl}" alt="Visitor Photo" class="visitor-photo" />
//       </div>
//       <div class="info-side">
//         <p><strong>Name:</strong> ${visitor.name}</p>
//         <p><strong>Department:</strong> ${visitor.department}</p>
//         <p><strong>Year:</strong> ${visitor.year || "-"}</p>
//         <p><strong>Designation:</strong> ${visitor.designation}</p>
//       </div>
//     </div>
//   `;



// }




// // Updates the log table in the UI
// function updateLiveLog(log) {
//   logTable.innerHTML = "";
//   log.forEach((entry) => {
//     const row = document.createElement("tr");
//     const duration = entry.exitTime ? ((new Date(entry.exitTime) - new Date(entry.entryTime)) / 1000).toFixed(0) : "-";
//     row.innerHTML = `
//       <td>${entry.name}</td>
//       <td>${entry.department}</td>
//       <td>${entry.year || "-"}</td>
//       <td>${entry.designation}</td>
//       <td>${formatDate(entry.entryTime)}</td>
//       <td>${entry.exitTime ? formatDate(entry.exitTime) : "-"}</td>
//       <td>${duration !== "-" ? duration + " sec" : "-"}</td>
//     `;
//     logTable.appendChild(row);
//   });



// }

// // Formats timestamps to local time
// function formatDate(dateStr) {
//   const date = new Date(dateStr);
//   return date.toLocaleTimeString();
// }


//   // Initial fetch when page loads
//   fetchLiveLog();
// });

document.addEventListener("DOMContentLoaded", () => {
  const barcodeInput = document.getElementById("barcodeInput");
  const visitorDetails = document.getElementById("visitorDetails");
  const logTable = document.getElementById("logTable");
  const webcam = document.getElementById("webcam");
  const faceStatus = document.getElementById("faceStatus");
  const statusMsg = document.createElement("p");
  statusMsg.style.marginTop = "10px";
  barcodeInput.insertAdjacentElement("afterend", statusMsg);

  let barcode = "";
  let typingTimer;
  let isProcessingFace = false;

  // Barcode scanning functionality
  barcodeInput.addEventListener("input", () => {
    clearTimeout(typingTimer);
    barcode = barcodeInput.value.trim();

    typingTimer = setTimeout(() => {
      if (barcode) {
        submitBarcode(barcode);
        barcodeInput.value = "";
        barcode = "";
      }
    }, 200);
  });

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
    }
  }

  // Displays visitor details including photo
  function displayVisitor(visitor) {
    const imageUrl = visitor.photoUrl || "/images/default.jpg";

    visitorDetails.innerHTML = `
      <h2>Visitor Details</h2>
      <div class="visitor-card">
        <div class="photo-side">
          <img src="${imageUrl}" alt="Visitor Photo" class="visitor-photo" />
        </div>
        <div class="info-side">
          <p><strong>Name:</strong> ${visitor.name}</p>
          <p><strong>Department:</strong> ${visitor.department}</p>
          <p><strong>Year:</strong> ${visitor.year || "-"}</p>
          <p><strong>Designation:</strong> ${visitor.designation}</p>
        </div>
      </div>
    `;
  }

  // Updates the log table in the UI
  function updateLiveLog(log) {
    logTable.innerHTML = "";
    log.forEach((entry) => {
      const row = document.createElement("tr");
      const duration = entry.exitTime ?
        ((new Date(entry.exitTime) - new Date(entry.entryTime)) / 1000).toFixed(0) : "-";

      row.innerHTML = `
        <td>${entry.name}</td>
        <td>${entry.department}</td>
        <td>${entry.year || "-"}</td>
        <td>${entry.designation}</td>
        <td>${formatDate(entry.entryTime)}</td>
        <td>${entry.exitTime ? formatDate(entry.exitTime) : "-"}</td>
        <td>${duration !== "-" ? duration + " sec" : "-"}</td>
      `;
      logTable.appendChild(row);
    });
  }

  // Formats timestamps to local time
  function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleTimeString();
  }

  // Initialize webcam
  async function initializeWebcam() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: 640,
          height: 480,
          facingMode: 'user'
        }
      });

      webcam.srcObject = stream;
      webcam.onloadedmetadata = () => {
        webcam.play();
        faceStatus.textContent = "✅ Webcam loaded. Face recognition active...";
        faceStatus.style.color = "green";

        // Start face recognition after webcam is ready
        setTimeout(() => {
          startFaceRecognition();
        }, 2000);
      };
    } catch (err) {
      console.error("Webcam error:", err);
      faceStatus.textContent = "❌ Webcam access failed";
      faceStatus.style.color = "red";
    }
  }

  // Start continuous face recognition
  function startFaceRecognition() {
    // Process face every 3 seconds
    setInterval(() => {
      if (!isProcessingFace && webcam.readyState === webcam.HAVE_ENOUGH_DATA) {
        captureAndVerify();
      }
    }, 3000);
  }

  // Capture image from webcam and verify face
  async function captureAndVerify() {
    if (isProcessingFace) return;

    isProcessingFace = true;
    faceStatus.textContent = "🔍 Analyzing face...";
    faceStatus.style.color = "orange";

    try {
      // Create canvas to capture webcam frame
      const canvas = document.createElement("canvas");
      canvas.width = webcam.videoWidth || 640;
      canvas.height = webcam.videoHeight || 480;
      const ctx = canvas.getContext("2d");

      // Draw current webcam frame to canvas
      ctx.drawImage(webcam, 0, 0, canvas.width, canvas.height);

      // Convert to base64
      const imageData = canvas.toDataURL("image/jpeg", 0.8);

      // Send to backend for face recognition
      const response = await fetch("http://localhost:5000/face-entry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: imageData })
      });

      const data = await response.json();
      console.log("Face recognition response:", data);

      // Update UI based on response
      if (data.status === "matched") {
        faceStatus.textContent = `✅ Recognized: ${data.name} (${data.action})`;
        faceStatus.style.color = "green";

        // Show success message
        statusMsg.textContent = `Face Recognition: ${data.message}`;
        statusMsg.style.color = "green";

        // Refresh log to show new entry
        fetchLiveLog();

      } else if (data.status === "unrecognized") {
        faceStatus.textContent = "❌ Unknown face detected and logged";
        faceStatus.style.color = "red";

        statusMsg.textContent = "Unknown face detected - entry logged";
        statusMsg.style.color = "orange";

        // Refresh log to show unknown entry
        fetchLiveLog();

      } else if (data.status === "error") {
        faceStatus.textContent = `⚠️ Error: ${data.message}`;
        faceStatus.style.color = "red";

      } else {
        faceStatus.textContent = "🔍 No face detected";
        faceStatus.style.color = "gray";
      }

    } catch (err) {
      console.error("Face recognition error:", err);
      faceStatus.textContent = "❌ Face recognition failed";
      faceStatus.style.color = "red";
    } finally {
      isProcessingFace = false;

      // Clear status message after 5 seconds
      setTimeout(() => {
        if (statusMsg.textContent.includes("Face Recognition") ||
          statusMsg.textContent.includes("Unknown face")) {
          statusMsg.textContent = "";
        }
      }, 5000);
    }
  }

  // ✅ Load IndexedDB via idb library (you must include idb in log.html)
  const dbPromise = idb.openDB('attendance-db', 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('pending-scans')) {
        db.createObjectStore('pending-scans', { keyPath: 'id', autoIncrement: true });
      }
    }
  });

  // ✅ Update online/offline status
  function updateStatus() {
    const el = document.getElementById("net-status");
    if (el) {
      el.innerText = navigator.onLine ? "✅ Online" : "⛔ Offline";
      el.style.background = navigator.onLine ? "green" : "red";
    }
  }
  window.addEventListener('online', updateStatus);
  window.addEventListener('offline', updateStatus);
  updateStatus(); // initial check

  // ✅ Face scan trigger
  async function handleFaceVerification(imageBase64, barcode) {
    if (!barcode || !imageBase64) {
      alert("Missing image or barcode.");
      return;
    }

    // ✅ OFFLINE: Save to IndexedDB
    if (!navigator.onLine) {
      const db = await dbPromise;
      await db.add('pending-scans', {
        timestamp: new Date().toISOString(),
        barcode,
        image: imageBase64
      });
      alert("✅ Offline: Scan saved locally. Will sync automatically when online.");
      return;
    }

    // ✅ ONLINE: Send to backend
    try {
      const response = await fetch("/face-entry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ barcode, image: imageBase64 })
      });

      const result = await response.json();
      if (result.success) {
        alert("✅ Entry marked successfully.");
      } else {
        alert("❌ Server error: " + result.message);
      }
    } catch (err) {
      alert("❌ Network error while submitting. Try again.");
      console.error(err);
    }
  }

  // ✅ Auto-sync pending scans when internet returns
  window.addEventListener('online', async () => {
    const db = await dbPromise;
    const allScans = await db.getAll('pending-scans');

    for (const scan of allScans) {
      try {
        const res = await fetch("/face-entry", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            barcode: scan.barcode,
            image: scan.image
          })
        });

        if (res.ok) {
          await db.delete('pending-scans', scan.id);
          console.log(`✅ Synced offline scan for ${scan.barcode}`);
        }
      } catch (err) {
        console.warn("❌ Sync failed:", err);
        break; // stop sync attempts until connection is reliable again
      }
    }
  });



  // Initialize everything when page loads
  initializeWebcam();
  fetchLiveLog();
});