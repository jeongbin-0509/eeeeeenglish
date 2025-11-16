/***************************************************
 *  example.js — 정적 페이지용 최종 완전체
 ***************************************************/

/* ===== 단축 접근기 ===== */
const $ = (s) => document.querySelector(s);
const byId = (id) => document.getElementById(id);

/* ===== 상태 관리 ===== */
let words = [];          // 전체 단어 데이터
let examples = [];       // Day 필터 후 예문 목록
let pos = 0;             // 현재 문제 인덱스
let correct = 0;
let wrong = 0;
let finished = false;
let mode = "question";   // question | feedback
let wrongsThisRun = [];  // 이번 세션 오답
let favSet = new Set(JSON.parse(localStorage.getItem("favorites") || "[]"));

/***************************************************
 * 1. 데이터 로드
 ***************************************************/
async function loadWords() {
  const url = window.WORDS_URL || "words.json";
  const res = await fetch(url);
  if (!res.ok) throw new Error("단어 데이터 로드 실패");
  return await res.json();
}

function loadDays() {
  try {
    return (JSON.parse(sessionStorage.getItem("days")) || []).map(Number);
  } catch {
    return [];
  }
}

function filterByDays(all, days) {
  if (!days?.length) return all;
  const set = new Set(days);
  return all.filter((w) => set.has(Number(w.day)));
}

function flattenExamples(list) {
  const out = [];
  list.forEach((w) => {
    if (!Array.isArray(w.examples)) return;
    w.examples.forEach((ex, i) => {
      const exID = ex.exID || `${w.wordnum}-${i}`;
      out.push({
        day: +w.day,
        wordnum: String(w.wordnum),
        word: w.word,
        exID,
        ex,
      });
    });
  });
  return out;
}

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/***************************************************
 * 2. 입력칸 + 유령 글자 렌더링
 ***************************************************/
function makeInput(exID, idx, ghostChar = "") {
  const g = String(ghostChar || "");

  return `
    <span class="ghost-input">
      <span class="ghost">${escapeHtml(g)}</span>
      <input
        id="in-${exID}-${idx}"
        class="textbox"
        type="text"
        autocomplete="off"
        inputmode="latin"
        spellcheck="false"
        style="color:#e8eef5;background:transparent;position:relative;z-index:1;"
      />
    </span>
  `;
}

function alignGhosts() {
  document.querySelectorAll(".ghost-input").forEach((wrap) => {
    const input = wrap.querySelector(".textbox");
    const ghost = wrap.querySelector(".ghost");
    if (!input || !ghost) return;

    const cs = getComputedStyle(input);
    const left =
      parseFloat(cs.borderLeftWidth || 0) +
      parseFloat(cs.paddingLeft || 0);

    ghost.style.left = left + "px";
    ghost.style.font = cs.font;
    ghost.style.letterSpacing = cs.letterSpacing;
    ghost.style.fontWeight = cs.fontWeight;
    ghost.style.lineHeight = cs.lineHeight;
  });
}

window.addEventListener("resize", alignGhosts);

/***************************************************
 * 3. 문제 렌더링
 ***************************************************/
function renderCurrent() {
  const cur = examples[pos];
  if (!cur) return;

  byId("counter").textContent = `${pos + 1} / ${examples.length}`;
  byId("favBtn").classList.toggle("is-active", favSet.has(cur.exID));

  let html = cur.ex.e_sentence;
  const count = Number(cur.ex.blank_count || 0);
  const blanks = Array.isArray(cur.ex.blanks) ? cur.ex.blanks : [];

  for (let i = 1; i <= count; i++) {
    const answer = String(blanks[i - 1] || "");
    const ghostChar = answer.charAt(0);
    html = html.replace(`_${i}_`, makeInput(cur.exID, i, ghostChar));
  }

  byId("en").innerHTML = html;
  byId("ko").textContent = cur.ex.k_sentence || "";

  hideFeedback();
  hideFinalPanel();

  const first = byId(`in-${cur.exID}-1`);
  first?.focus();

  const p = Math.round((pos / examples.length) * 100);
  byId("progressBar").style.width = p + "%";

  byId("goodCnt").textContent = `${correct} 정답`;
  byId("badCnt").textContent = `${wrong} 오답`;

  mode = "question";
  byId("submitBtn").textContent = "확인";
  byId("submitBtn").disabled = false;

  alignGhosts();
}

/***************************************************
 * 4. 채점
 ***************************************************/
function collectUserAnswers(cur) {
  const arr = [];
  const n = Number(cur.ex.blank_count || 0);

  for (let i = 1; i <= n; i++) {
    arr.push((byId(`in-${cur.exID}-${i}`)?.value || "").trim());
  }
  return arr;
}

function evaluate() {
  if (finished) return;

  if (mode === "feedback") {
    goNext();
    return;
  }

  const cur = examples[pos];
  const key = Array.isArray(cur.ex.blanks) ? cur.ex.blanks : [];
  const mine = collectUserAnswers(cur);

  let ok = true;

  key.forEach((ans, i) => {
    const expect = String(ans).trim().toLowerCase();
    const got = String(mine[i] || "").trim().toLowerCase();
    const el = byId(`in-${cur.exID}-${i + 1}`);

    if (!got || expect !== got) {
      ok = false;
      el?.classList.add("wrong");
    } else {
      el?.classList.remove("wrong");
      el?.classList.add("correct");
    }
  });

  if (ok) {
    correct++;
    goNext();
  } else {
    wrong++;
    wrongsThisRun.push({
      exID: cur.exID,
      word: cur.word,
      expect: key,
      mine,
      ts: Date.now(),
    });

    showFeedback(mine, key);
    addToWrongNotebook(cur, mine, key);

    mode = "feedback";
    byId("submitBtn").textContent = "다음";
  }

  byId("goodCnt").textContent = `${correct} 정답`;
  byId("badCnt").textContent = `${wrong} 오답`;
}

/***************************************************
 * 5. 다음 문제
 ***************************************************/
function goNext() {
  pos++;
  if (pos >= examples.length) {
    renderFinal();
    return;
  }
  renderCurrent();
}

/***************************************************
 * 6. 피드백 UI
 ***************************************************/
function showFeedback(mine, key) {
  byId("myAnswer").textContent = mine.join(" / ") || "(빈칸)";
  byId("rightAnswer").textContent = key.join(" / ");
  byId("feedback").hidden = false;
}

function hideFeedback() {
  byId("feedback").hidden = true;
  byId("myAnswer").textContent = "-";
  byId("rightAnswer").textContent = "-";
}

/***************************************************
 * 7. 즐겨찾기
 ***************************************************/
function toggleFavorite() {
  const cur = examples[pos];
  if (!cur) return;

  if (favSet.has(cur.exID)) {
    favSet.delete(cur.exID);
    removeFromFavoriteNotebook(cur);
  } else {
    favSet.add(cur.exID);
    addToFavoriteNotebook(cur);
  }

  localStorage.setItem("favorites", JSON.stringify([...favSet]));
  byId("favBtn").classList.toggle("is-active", favSet.has(cur.exID));
}

/***************************************************
 * 8. 마지막 화면 렌더링
 ***************************************************/
function renderFinal() {
  finished = true;

  byId("counter").textContent = "완료!";
  byId("en").innerHTML = "수고했어!";
  byId("ko").textContent = `정답 ${correct} / 오답 ${wrong}`;
  byId("progressBar").style.width = "100%";
  hideFeedback();

  byId("submitBtn").remove();
  byId("actions")?.setAttribute("hidden", "true");

  buildAndShowFinalPanel();
}

function buildAndShowFinalPanel() {
  const panel = byId("finalPanel");
  panel.hidden = false;

  byId("btnShowWrong").onclick = showWrongList;
  byId("btnRestart").onclick = () => {
    location.href = "index.html";
  };
}

function showWrongList() {
  const listEl = byId("wrongList");
  const data = wrongsThisRun;

  if (!data.length) {
    listEl.innerHTML = `<p class="empty">이번 테스트에서 틀린 단어가 없어요 👍</p>`;
    byId("wrongSection").hidden = false;
    return;
  }

  listEl.innerHTML = data
    .map((w, i) => {
      const mine = w.mine.join(" / ");
      const expect = w.expect.join(" / ");

      return `
        <div class="wrong-item">
          <div class="idx">${i + 1}.</div>
          <div class="body">
            <div class="word">단어: <b>${escapeHtml(w.word)}</b></div>
            <div>내 답: <b>${escapeHtml(mine)}</b></div>
            <div>정답: <b class="ok">${escapeHtml(expect)}</b></div>
          </div>
        </div>
      `;
    })
    .join("");

  byId("wrongSection").hidden = false;
}

/***************************************************
 * 9. 오답노트 localStorage 저장
 ***************************************************/
function addToWrongNotebook(cur, mine, key) {
  try {
    const store = JSON.parse(localStorage.getItem("wrongNotebook") || "{}");

    const dayKey = String(cur.day);
    const itemKey = String(cur.wordnum);

    if (!store[dayKey]) store[dayKey] = {};

    const entry = {
      mine: mine,
      expect: key,
      ts: Date.now(),
    };

    store[dayKey][itemKey] = {
      day: cur.day,
      wordnum: cur.wordnum,
      word: cur.word,
      e_sentence: cur.ex.e_sentence,
      k_sentence: cur.ex.k_sentence,
      last_wrong: entry,
    };

    localStorage.setItem("wrongNotebook", JSON.stringify(store));
  } catch (e) {
    console.warn("오답 저장 오류:", e);
  }
}

/***************************************************
 * 10. 즐겨찾기 localStorage 관리
 ***************************************************/
function addToFavoriteNotebook(cur) {
  const store = JSON.parse(localStorage.getItem("favoriteNotebook") || "{}");
  const dayKey = String(cur.day);
  const itemKey = String(cur.wordnum);

  if (!store[dayKey]) store[dayKey] = {};

  store[dayKey][itemKey] = {
    day: cur.day,
    wordnum: cur.wordnum,
    word: cur.word,
    e_sentence: cur.ex.e_sentence,
    k_sentence: cur.ex.k_sentence,
    ts: Date.now(),
  };

  localStorage.setItem("favoriteNotebook", JSON.stringify(store));
}

function removeFromFavoriteNotebook(cur) {
  const store = JSON.parse(localStorage.getItem("favoriteNotebook") || "{}");
  const dayKey = String(cur.day);
  const itemKey = String(cur.wordnum);

  if (store[dayKey] && store[dayKey][itemKey]) {
    delete store[dayKey][itemKey];
    if (Object.keys(store[dayKey]).length === 0) delete store[dayKey];
    localStorage.setItem("favoriteNotebook", JSON.stringify(store));
  }
}

/***************************************************
 * 11. 유틸
 ***************************************************/
function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function hideFinalPanel() {
  byId("finalPanel").hidden = true;
  byId("wrongSection").hidden = true;
}

/***************************************************
 * 12. 시작
 ***************************************************/
async function boot() {
  try {
    words = await loadWords();
  } catch {
    alert("words.json 파일을 찾을 수 없습니다!");
    return;
  }

  const days = loadDays();
  const filtered = filterByDays(words, days);
  examples = shuffle(flattenExamples(filtered.length ? filtered : words));

  renderCurrent();

  byId("submitBtn").onclick = evaluate;
  byId("favBtn").onclick = toggleFavorite;

  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !finished) {
      e.preventDefault();
      evaluate();
    }
  });
}

document.addEventListener("DOMContentLoaded", boot);
