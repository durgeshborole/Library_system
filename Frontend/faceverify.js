const webcam = document.getElementById("webcam");
const faceStatus = document.getElementById("faceStatus");

let modelsLoaded = false;

// Load face-api.js models from /models directory
Promise.all([
  faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
  faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
  faceapi.nets.faceRecognitionNet.loadFromUri('/models')
]).then(() => {
  faceStatus.innerText = "✅ Models loaded. Starting webcam...";
  startCamera();
  modelsLoaded = true;
}).catch(err => {
  console.error("❌ Model load failed:", err);
  faceStatus.innerText = "❌ Failed to load models.";
});

// Start webcam
async function startCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });

    console.log("✅ Webcam stream received:", stream);
    webcam.srcObject = stream;

    faceStatus.innerText = "🎥 Webcam started. Awaiting scan...";

  } catch (err) {
    console.error("❌ Webcam error:", err);
    faceStatus.innerText = "❌ Webcam access denied or unavailable.";
  }
}


// Verify face after barcode scan
window.verifyAfterScan = async function (storedPhotoUrl) {
  if (!modelsLoaded) {
    faceStatus.innerText = "❌ Models not ready yet.";
    return;
  }

  console.log("🔍 Starting face verification...");
  faceStatus.innerText = "⏳ Verifying face...";

  try {
    // Load stored photo
    const storedImage = await faceapi.fetchImage(storedPhotoUrl);
    const storedDesc = await faceapi
      .detectSingleFace(storedImage, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!storedDesc) {
      faceStatus.innerText = "❌ No face found in stored image.";
      return;
    }

    // Wait a moment for webcam to stabilize
    await new Promise(resolve => setTimeout(resolve, 1000));

    const liveDesc = await faceapi
      .detectSingleFace(webcam, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!liveDesc) {
      faceStatus.innerText = "❌ No face detected from webcam.";
      return;
    }

    const distance = faceapi.euclideanDistance(storedDesc.descriptor, liveDesc.descriptor);
    console.log("🧠 Face distance:", distance.toFixed(4));

    if (distance < 0.6) {
      faceStatus.innerText = "✅ Face matched!";
    } else {
      faceStatus.innerText = "❌ Face mismatch!";
    }

  } catch (error) {
    console.error("⚠️ Verification error:", error);
    faceStatus.innerText = "❌ Verification failed.";
  }
};
