document.addEventListener("DOMContentLoaded", () => {
  const correct = new URLSearchParams(location.search).get("correct") || 0;
  const incorrect = new URLSearchParams(location.search).get("incorrect") || 0;

  document.getElementById("correct").textContent = correct;
  document.getElementById("incorrect").textContent = incorrect;

  const wrongStore = JSON.parse(localStorage.getItem("wrongNotebook") || "{}");
  const box = document.getElementById("wrongList");

  let html = "";
  for (const day in wrongStore) {
    for (const num in wrongStore[day]) {
      const item = wrongStore[day][num];
      html += `
        <div class="wrong-item">
          <b>Day ${day}</b> — ${item.word}<br>
          <small>${item.e_sentence}</small><br>
          <small style="color:red">마지막 오답: ${item.last_wrong?.mine?.join(" / ")}</small>
        </div>
      `;
    }
  }

  box.innerHTML = html || "<p>틀린 문제가 없습니다.</p>";
});
