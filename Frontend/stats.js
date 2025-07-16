document.addEventListener("DOMContentLoaded", async () => {
  const totalVisitorsEl = document.querySelector(".card:nth-child(1) p");
  const currentlyInsideEl = document.querySelector(".card:nth-child(2) p");
  const mostFrequentDeptEl = document.querySelector(".card:nth-child(3) p");
  const lastEntryEl = document.querySelector(".card:nth-child(4) p");

  try {
    const res = await fetch("http://localhost:5000/stats");
    const stats = await res.json();

    totalVisitorsEl.textContent = stats.totalVisitorsToday;
    currentlyInsideEl.textContent = stats.currentlyInside;
    mostFrequentDeptEl.textContent = stats.mostFrequentDept || "-";
    lastEntryEl.textContent = stats.lastEntry || "-";
  } catch (error) {
    console.error("Failed to load stats:", error);
  }
});

document.addEventListener("DOMContentLoaded", async () => {
  const totalVisitorsEl = document.querySelector(".card:nth-child(1) p");
  const currentlyInsideEl = document.querySelector(".card:nth-child(2) p");
  const mostFrequentDeptEl = document.querySelector(".card:nth-child(3) p");
  const lastEntryEl = document.querySelector(".card:nth-child(4) p");

  try {
    const res = await fetch("http://localhost:5000/stats");
    const stats = await res.json();

    totalVisitorsEl.textContent = stats.totalVisitorsToday;
    currentlyInsideEl.textContent = stats.currentlyInside;
    mostFrequentDeptEl.textContent = stats.mostFrequentDept || "-";
    lastEntryEl.textContent = stats.lastEntry || "-";
  } catch (error) {
    console.error("Failed to load stats:", error);
  }

  // 🚀 Load notices also
  try {
    const res = await fetch("http://localhost:5000/notices");
    const notices = await res.json();

    const noticeList = document.getElementById("noticeList");
    noticeList.innerHTML = ""; // Clear old "Loading..."

    if (notices.length === 0) {
      noticeList.innerHTML = "<li>No notices available.</li>";
    } else {
      notices.forEach(notice => {
        const li = document.createElement("li");
        li.textContent = notice.text;
        noticeList.appendChild(li);
      });
    }
  } catch (error) {
    console.error("Failed to load notices:", error);
  }
});
