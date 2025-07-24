// admin.js

async function updateAutoExit() {
  const hour = document.getElementById("autoExitHour").value;
  const minute = document.getElementById("autoExitMinute").value;

  if (hour === "" || minute === "") {
    alert("Please fill both hour and minute.");
    return;
  }

  try {
    const res = await fetch("http://localhost:5000/admin/auto-exit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hour: parseInt(hour), minute: parseInt(minute) })
    });

    const result = await res.json();
    alert(result.message);
  } catch (err) {
    console.error("Auto-exit update failed:", err);
    alert("Failed to update auto-exit time.");
  }
}

async function forceExit() {
  if (!confirm("Are you sure you want to force exit all currently present users?")) return;

  const token = localStorage.getItem("authToken"); // Get it fresh
  if (!token) {
    alert("You are not logged in.");
    return;
  }

  try {
    const res = await fetch("http://localhost:5000/admin/force-exit", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
      }
    });

    const result = await res.json();

    if (res.ok) {
      alert(`✅ ${result.modifiedCount} users were marked exited.`);
    } else {
      alert(`❌ Force exit failed: ${result.message || result.error}`);
    }

  } catch (err) {
    console.error("Force exit failed:", err);
    alert("Force exit failed.");
  }
}


async function exportLogs(type) {
  const endpoint = type === 'today' ? '/live-log' : '/all-logs';
  try {
    const res = await fetch(`http://localhost:5000${endpoint}`);
    const logs = await res.json();
    let csv = "Name,Department,Designation,Entry Time,Exit Time\n";
    logs.forEach(log => {
      csv += `${log.name},${log.department},${log.designation},${new Date(log.entryTime).toLocaleString()},${log.exitTime ? new Date(log.exitTime).toLocaleString() : "-"}\n`;
    });

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `logs_${type}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error("Log export failed:", err);
    alert("Failed to export logs.");
  }
}

// Submit new library notice
async function submitNotice() {
  const noticeText = document.getElementById("noticeText").value.trim();

  if (!noticeText) {
    alert("Please enter a notice.");
    return;
  }

  try {
    const res = await fetch("http://localhost:5000/admin/notices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: noticeText })
    });

    const data = await res.json();
    if (data.success) {
      alert("📢 Notice posted successfully.");
      document.getElementById("noticeText").value = "";
    } else {
      alert("Failed to post notice.");
    }
  } catch (err) {
    console.error("Notice post failed:", err);
    alert("Server error while posting notice.");
  }
}


async function loadAdminNotices() {
  const noticeList = document.getElementById("adminNoticeList");
  noticeList.innerHTML = "<li>Loading notices...</li>";

  try {
    const res = await fetch("http://localhost:5000/notices");
    const notices = await res.json();

    noticeList.innerHTML = "";

    if (notices.length === 0) {
      noticeList.innerHTML = "<li>No notices found.</li>";
    } else {
      notices.forEach(notice => {
        const li = document.createElement("li");
        li.textContent = notice.text;

        const deleteBtn = document.createElement("button");
        deleteBtn.textContent = "🗑️ Delete";
        deleteBtn.style.marginLeft = "10px";
        deleteBtn.onclick = () => deleteNotice(notice._id);

        li.appendChild(deleteBtn);
        noticeList.appendChild(li);
      });
    }
  } catch (err) {
    console.error("Failed to load notices:", err);
    noticeList.innerHTML = "<li>Failed to load notices.</li>";
  }
}

async function deleteNotice(id) {
  if (!confirm("Are you sure you want to delete this notice?")) return;

  try {
    const res = await fetch(`http://localhost:5000/admin/notices/${id}`, {
      method: "DELETE"
    });

    const data = await res.json();
    if (data.success) {
      alert("✅ Notice deleted successfully.");
      loadAdminNotices(); // Refresh list
    } else {
      alert("❌ Failed to delete notice.");
    }
  } catch (err) {
    console.error("Delete notice failed:", err);
    alert("❌ Server error during delete.");
  }
}

// Load notices automatically when Admin Panel opens
document.addEventListener("DOMContentLoaded", () => {
  loadAdminNotices();
});


async function uploadPhoto() {
  const barcode = document.getElementById('photoBarcode').value.trim();
  const fileInput = document.getElementById('photoFile');
  const file = fileInput.files[0];

  if (!barcode || !file) {
    alert('Please enter barcode and select a photo.');
    return;
  }

  const formData = new FormData();
  formData.append('barcode', barcode);
  formData.append('photo', file);

  try {
    const res = await fetch('http://localhost:5000/upload-photo', {
      method: 'POST',
      body: formData
    });

    const data = await res.json();
    if (data.success) {
      alert('✅ Photo uploaded successfully.');
      document.getElementById('photoBarcode').value = '';
      fileInput.value = '';
    } else {
      alert('❌ Upload failed.');
    }
  } catch (err) {
    console.error('Upload photo failed:', err);
    alert('❌ Server error.');
  }
}




async function bulkUploadPhotos() {
  const files = document.getElementById('bulkPhotoFiles').files;

  if (files.length === 0) {
    alert('Please select at least one file.');
    return;
  }

  const formData = new FormData();
  for (const file of files) {
    formData.append('photos', file); // "photos" must match server field
  }

  try {
    const res = await fetch('http://localhost:5000/bulk-upload-photos', {
      method: 'POST',
      body: formData
    });

    const data = await res.json();
    if (data.success) {
      alert(`✅ Successfully uploaded ${data.uploadedCount} photos.`);
      document.getElementById('bulkPhotoFiles').value = ''; // Clear input
    } else {
      alert('❌ Bulk upload failed.');
    }
  } catch (err) {
    console.error('Bulk upload failed:', err);
    alert('❌ Server error.');
  }
}

async function loadMonthlyAwards() {
  const resultBox = document.getElementById("awardResults");
  resultBox.innerHTML = "⏳ Loading...";

  try {
    const res = await fetch("http://localhost:5000/admin/monthly-awards");
    const data = await res.json();

    if (data.error) {
      resultBox.innerHTML = "❌ Failed to load awards.";
      return;
    }

    const student = data.topStudent
      ? `🏅 <b>${data.topStudent.name}</b> (Visits: ${data.topStudent.visits})`
      : "No student data.";

    const department = data.topDepartment
      ? `🏢 <b>${data.topDepartment.name}</b> (Visits: ${data.topDepartment.visits})`
      : "No department data.";

    resultBox.innerHTML = `
      <p><strong>Top Student:</strong> ${student}</p>
      <p><strong>Top Department:</strong> ${department}</p>
    `;
  } catch (err) {
    console.error("Error fetching awards:", err);
    resultBox.innerHTML = "❌ Server error.";
  }
}
