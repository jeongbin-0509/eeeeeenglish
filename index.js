document.addEventListener("DOMContentLoaded", () => {
  const panel = document.getElementById("selected-days-panel");
  const listEl = document.getElementById("selected-days");
  const dayInputs = [...document.querySelectorAll('.itam')];

  const startContainer = document.getElementById("start-container");
  const startBtn = document.getElementById("startBtn");

  function getSelected() {
    return dayInputs.filter(cb => cb.checked).map(cb => Number(cb.value));
  }

  function updateChips() {
    const selected = getSelected();

    if (!selected.length) {
      panel.classList.add("hidden");
      listEl.innerHTML = "";
      startContainer.classList.add("hidden");
      return;
    }

    panel.classList.remove("hidden");
    startContainer.classList.remove("hidden");

    listEl.innerHTML = "";
    selected.sort((a,b)=>a-b).forEach(d => {
      const chip = document.createElement("button");
      chip.className = "chip";
      chip.innerHTML = `${d} <span class="x">×</span>`;
      chip.onclick = () => {
        document.querySelector(`#day${d}`).checked = false;
        updateChips();
      };
      listEl.appendChild(chip);
    });
  }

  dayInputs.forEach(cb => cb.addEventListener("change", updateChips));

  startBtn.onclick = () => {
    const selected = getSelected();
    if (!selected.length) return alert("Day를 선택해주세요.");

    sessionStorage.setItem("days", JSON.stringify(selected));
    location.href = "example.html";
  };

  updateChips();
});
