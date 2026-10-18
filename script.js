
"use strict";

const $ = (selector) => document.querySelector(selector);
const STORAGE = "meetinghub_data_v1";

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const money = (amount) => new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN"
}).format(amount);

function readData() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE) || "{}");
    return {
      members: Array.isArray(data.members) ? data.members : [],
      meetings: Array.isArray(data.meetings) ? data.meetings : [],
      expenses: Array.isArray(data.expenses) ? data.expenses : []
    };
  } catch {
    return { members: [], meetings: [], expenses: [] };
  }
}

let data = readData();

function persist() {
  try {
    localStorage.setItem(STORAGE, JSON.stringify(data));
    return true;
  } catch {
    alert("Could not save data. Check browser storage.");
    return false;
  }
}

function id() {
  return crypto.randomUUID();
}

function safe(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;",
    '"': "&quot;", "'": "&#39;"
  })[char]);
}

// Demo interface permissions. These are NOT security controls.
function role() {
  return $("#roleSelect").value;
}

function canManageMembers() {
  return role() === "chair";
}

function canManageExpenses() {
  return ["chair", "secretary"].includes(role());
}

function canRecordAudio() {
  return ["chair", "secretary"].includes(role());
}

function canManageMeetings() {
  return ["chair", "secretary"].includes(role());
}

function setFormAccess(formSelector, allowed) {
  $(formSelector).querySelectorAll("input, select, textarea, button")
    .forEach((element) => {
      element.disabled = !allowed;
    });
}

function showMessage(selector, text, error = false) {
  const element = $(selector);
  element.textContent = text;
  element.classList.toggle("error", error);
}

// MEMBER MANAGEMENT
function renderMembers() {
  const query = $("#memberSearch").value.trim().toLowerCase();
  const filter = $("#memberFilter").value;

  const filtered = data.members.filter((member) => {
    const status = member.active ? "active" : "left";
    const matchesStatus = filter === "all" || filter === status;
    const matchesSearch =
      member.name.toLowerCase().includes(query) ||
      member.position.toLowerCase().includes(query) ||
      member.phone.toLowerCase().includes(query);

    return matchesStatus && matchesSearch;
  });

  $("#memberEmpty").classList.toggle("hidden", filtered.length > 0);

  $("#memberTable").innerHTML = filtered.map((member) => `
    <tr>
      <td><div class="member-name">
        <span class="avatar">${safe(member.name.trim()[0].toUpperCase())}</span>
        <strong>${safe(member.name)}</strong>
      </div></td>
      <td>${safe(member.phone || "—")}</td>
      <td>${safe(member.position)}</td>
      <td><span class="status ${member.active ? "active" : "left"}">
        ${member.active ? "Active" : "Former member"}
      </span></td>
      <td>
        ${canManageMembers() ? member.active
          ? `<button class="action-btn remove" data-member-action="remove"
               data-id="${safe(member.id)}">Mark left</button>`
          : `<button class="action-btn restore" data-member-action="restore"
               data-id="${safe(member.id)}">Restore</button>`
          : "View only"}
      </td>
    </tr>
  `).join("");

  $("#memberTotal").textContent =
    data.members.filter((m) => m.active).length;
}

$("#memberForm").addEventListener("submit", (event) => {
  event.preventDefault();

  if (!canManageMembers()) {
    return alert("Only the chairperson can manage members in this demo.");
  }

  const name = $("#memberName").value.trim();
  const phone = $("#memberPhone").value.trim();
  const position = $("#memberPosition").value;

  if (name.length < 2) {
    return alert("Enter a valid member name.");
  }

  if (data.members.some((m) =>
    m.active && m.name.toLowerCase() === name.toLowerCase()
  )) {
    return alert("This member is already active.");
  }

  data.members.push({
    id: id(), name, phone, position,
    active: true,
    joinedAt: today(),
    leftAt: null
  });

  if (!persist()) {
    data.members.pop();
    return;
  }

  event.target.reset();
  renderMembers();
});

$("#memberTable").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-member-action]");
  if (!button || !canManageMembers()) return;

  const member = data.members.find((m) => m.id === button.dataset.id);
  if (!member) return;

  if (button.dataset.memberAction === "remove") {
    if (!confirm(`Mark ${member.name} as a former member?`)) return;
    member.active = false;
    member.leftAt = today();
  } else {
    member.active = true;
    member.leftAt = null;
  }

  if (!persist()) {
    member.active = !member.active;
    return;
  }

  renderMembers();
});

$("#memberSearch").addEventListener("input", renderMembers);
$("#memberFilter").addEventListener("change", renderMembers);

// MEETING NOTES
function renderMeetings() {
  $("#meetingTotal").textContent = data.meetings.length;

  $("#meetingList").innerHTML = data.meetings.length
    ? [...data.meetings].reverse().map((meeting) => `
      <article class="record-card">
        <strong>${safe(meeting.title)}</strong>
        <p>${safe(meeting.date)}</p>
        <p>${safe(meeting.notes || "No additional notes.")}</p>
        ${canManageMeetings()
          ? `<button class="action-btn remove"
               data-meeting-delete="${safe(meeting.id)}">Delete note</button>`
          : ""}
      </article>
    `).join("")
    : '<p class="empty">No meetings recorded yet.</p>';
}

$("#meetingDate").value = today();

$("#meetingForm").addEventListener("submit", (event) => {
  event.preventDefault();

  if (!canManageMeetings()) {
    return alert("Meeting note entry is restricted to officers.");
  }

  const title = $("#meetingTitle").value.trim();
  const date = $("#meetingDate").value;
  const notes = $("#meetingNotes").value.trim();

  if (!title || !date) return alert("Enter the meeting title and date.");

  const meeting = {
    id: id(), title, date, notes,
    createdAt: new Date().toISOString()
  };

  data.meetings.push(meeting);

  if (!persist()) {
    data.meetings.pop();
    return;
  }

  event.target.reset();
  $("#meetingDate").value = today();
  renderMeetings();
});

$("#meetingList").addEventListener("click", (event) => {
  const button = event.target.closest("[data-meeting-delete]");
  if (!button || !canManageMeetings()) return;

  if (!confirm("Delete this meeting note?")) return;

  const previous = data.meetings;
  data.meetings = data.meetings.filter(
    (meeting) => meeting.id !== button.dataset.meetingDelete
  );

  if (!persist()) {
    data.meetings = previous;
    return;
  }

  renderMeetings();
});

// EXPENSE MANAGEMENT
function renderExpenses() {
  const total = data.expenses.reduce((sum, expense) =>
    sum + expense.amount, 0);

  $("#expenseTotal").textContent = money(total);
  $("#expenseSummary").textContent = money(total);
  $("#expenseCount").textContent = data.expenses.length;

  $("#expenseTable").innerHTML = [...data.expenses]
    .reverse().map((expense) => `
      <tr>
        <td>${safe(expense.description)}</td>
        <td>${safe(expense.category)}</td>
        <td>${safe(expense.date)}</td>
        <td><strong>${money(expense.amount)}</strong></td>
        <td>${canManageExpenses()
          ? `<button class="action-btn remove"
               data-expense-delete="${safe(expense.id)}">Delete</button>`
          : "View only"}</td>
      </tr>
    `).join("");

  $("#expenseEmpty").classList.toggle(
    "hidden", data.expenses.length > 0
  );
}

$("#expenseDate").value = today();

$("#expenseForm").addEventListener("submit", (event) => {
  event.preventDefault();

  if (!canManageExpenses()) {
    return alert("Only the chairperson or financial secretary can record expenses.");
  }

  const description = $("#expenseDescription").value.trim();
  const amount = Number($("#expenseAmount").value);
  const date = $("#expenseDate").value;
  const category = $("#expenseCategory").value;

  if (!description || !date || !Number.isFinite(amount) ||
      amount <= 0 || amount > 1_000_000_000) {
    return alert("Enter a description, date, and valid positive amount.");
  }

  const expense = {
    id: id(), description, amount, date, category,
    recordedBy: role(),
    createdAt: new Date().toISOString()
  };

  data.expenses.push(expense);

  if (!persist()) {
    data.expenses.pop();
    return;
  }

  event.target.reset();
  $("#expenseDate").value = today();
  renderExpenses();
});

$("#expenseTable").addEventListener("click", (event) => {
  const button = event.target.closest("[data-expense-delete]");
  if (!button || !canManageExpenses()) return;

  if (!confirm("Delete this expense entry?")) return;

  const previous = data.expenses;
  data.expenses = data.expenses.filter(
    (expense) => expense.id !== button.dataset.expenseDelete
  );

  if (!persist()) {
    data.expenses = previous;
    return;
  }

  renderExpenses();
});

function downloadCSV(filename, rows) {
  const cell = (value) => {
    let text = String(value ?? "");
    if (/^[\s]*[=+\-@]/.test(text)) text = "'" + text;
    return '"' + text.replace(/"/g, '""') + '"';
  };

  const csv = "\uFEFF" + rows.map((row) =>
    row.map(cell).join(",")
  ).join("\r\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

$("#exportExpenses").addEventListener("click", () => {
  if (!canManageExpenses()) {
    return alert("Expense export is restricted to officers.");
  }

  downloadCSV("meetinghub-expenses.csv", [
    ["Description", "Category", "Date", "Amount", "Recorded By"],
    ...data.expenses.map((e) => [
      e.description, e.category, e.date, e.amount, e.recordedBy
    ])
  ]);
});

// DEMO ROLE-BASED INTERFACE
function applyRole() {
  setFormAccess("#memberForm", canManageMembers());
  setFormAccess("#meetingForm", canManageMeetings());
  setFormAccess("#expenseForm", canManageExpenses());
  $("#exportExpenses").disabled = !canManageExpenses();

  const allowed = canRecordAudio();
  $("#recorderLock").classList.toggle("hidden", allowed);
  $("#recordingTitle").disabled = !allowed;

  if (!allowed && recorderState !== "idle") {
    stopRecording();
  }

  renderMembers();
  renderMeetings();
  renderExpenses();
  renderRecordings();
}

$("#roleSelect").addEventListener("change", applyRole);

// VOICE RECORDER
// Audio remains in memory until downloaded or the page is closed.
let mediaRecorder = null;
let audioStream = null;
let audioChunks = [];
let recorderState = "idle";
let startedAt = 0;
let elapsedBeforePause = 0;
let clockHandle = null;
let recordings = [];

function formatTime(milliseconds) {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function elapsedTime() {
  return elapsedBeforePause +
    (recorderState === "recording" ? Date.now() - startedAt : 0);
}

function updateClock() {
  $("#recordingTime").textContent = formatTime(elapsedTime());
}

function updateRecorderUI() {
  const isRecording = recorderState === "recording";
  const isPaused = recorderState === "paused";
  const isIdle = recorderState === "idle";

  $("#startRecording").disabled = !canRecordAudio() || !isIdle;
  $("#pauseRecording").disabled = isIdle;
  $("#stopRecording").disabled = isIdle;

  $("#pauseRecording").textContent = isPaused ? "▶ Resume" : "Ⅱ Pause";
  $("#recorderBadge").textContent =
    isRecording ? "Recording" : isPaused ? "Paused" : "Ready";
  $("#recorderBadge").className =
    "badge" + (isRecording ? " recording" : isPaused ? " paused" : "");
  $("#recorderStatus").textContent =
    isRecording ? "Recording microphone audio..." :
    isPaused ? "Recording paused" : "Ready to record";
}

async function startRecording() {
  if (!canRecordAudio() || recorderState !== "idle") return;

  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
    showMessage("#recorderMessage",
      "Recording is unsupported here. Try an updated browser on localhost or HTTPS.",
      true);
    return;
  }

  let stream;

  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    if (!canRecordAudio()) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }

    audioStream = stream;
    audioChunks = [];

    const mimeType = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/mp4"
    ].find((type) => MediaRecorder.isTypeSupported(type));

    mediaRecorder = mimeType
      ? new MediaRecorder(stream, { mimeType })
      : new MediaRecorder(stream);

    mediaRecorder.addEventListener("dataavailable", (event) => {
      if (event.data.size > 0) audioChunks.push(event.data);
    });

    mediaRecorder.addEventListener("stop", () => {
      const blob = new Blob(audioChunks, {
        type: mediaRecorder?.mimeType || "audio/webm"
      });

      if (blob.size > 0) {
        recordings.push({
          id: id(),
          title: $("#recordingTitle").value.trim() ||
            `Meeting recording ${new Date().toLocaleString()}`,
          date: new Date().toLocaleString(),
          blob,
          url: URL.createObjectURL(blob)
        });

        renderRecordings();
        showMessage("#recorderMessage",
          "Recording finished. Play it or download it to keep a copy.");
      } else {
        showMessage("#recorderMessage", "No audio was captured.", true);
      }

      if (audioStream) {
        audioStream.getTracks().forEach((track) => track.stop());
        audioStream = null;
      }

      recorderState = "idle";
      elapsedBeforePause = 0;
      clearInterval(clockHandle);
      clockHandle = null;
      updateClock();
      updateRecorderUI();
    });

    mediaRecorder.start(1000);
    recorderState = "recording";
    startedAt = Date.now();
    elapsedBeforePause = 0;
    clockHandle = setInterval(updateClock, 250);

    updateRecorderUI();
    showMessage("#recorderMessage",
      "Recording started. Ensure participants know recording is active.");
  } catch (error) {
    if (stream) stream.getTracks().forEach((track) => track.stop());

    audioStream = null;
    recorderState = "idle";
    updateRecorderUI();

    showMessage("#recorderMessage",
      error.name === "NotAllowedError"
        ? "Microphone permission was denied. Allow access in browser settings."
        : "Could not start recording. Check your microphone and permissions.",
      true);
  }
}

function pauseOrResume() {
  if (!mediaRecorder || recorderState === "idle") return;

  if (recorderState === "recording" && mediaRecorder.state === "recording") {
    elapsedBeforePause += Date.now() - startedAt;
    mediaRecorder.pause();
    recorderState = "paused";
  } else if (recorderState === "paused" && mediaRecorder.state === "paused") {
    startedAt = Date.now();
    mediaRecorder.resume();
    recorderState = "recording";
  }

  updateClock();
  updateRecorderUI();
}

function stopRecording() {
  if (!mediaRecorder || recorderState === "idle") return;

  if (recorderState === "recording") {
    elapsedBeforePause += Date.now() - startedAt;
  }

  recorderState = "stopping";
  updateRecorderUI();

  if (mediaRecorder.state !== "inactive") {
    mediaRecorder.stop();
  }
}

function renderRecordings() {
  $("#recordingList").innerHTML = recordings.length
    ? [...recordings].reverse().map((recording) => `
      <article class="record-card">
        <strong>${safe(recording.title)}</strong>
        <p>${safe(recording.date)}</p>
        <audio controls preload="metadata" src="${recording.url}"></audio>
        <div class="record-actions">
          <button type="button" class="secondary-btn"
            data-download-recording="${safe(recording.id)}">
            ↓ Download audio
          </button>
          <button type="button" class="action-btn remove"
            data-delete-recording="${safe(recording.id)}">
            Delete
          </button>
        </div>
      </article>
    `).join("")
    : '<p class="empty">No recordings in this session yet.</p>';
}

$("#startRecording").addEventListener("click", startRecording);
$("#pauseRecording").addEventListener("click", pauseOrResume);
$("#stopRecording").addEventListener("click", stopRecording);

$("#recordingList").addEventListener("click", (event) => {
  const downloadButton = event.target.closest("[data-download-recording]");
  const deleteButton = event.target.closest("[data-delete-recording]");

  if (downloadButton) {
    if (!canRecordAudio()) {
      return alert("Recording management is restricted to officers in this demo.");
    }

    const recording = recordings.find(
      (r) => r.id === downloadButton.dataset.downloadRecording
    );

    if (recording) {
      const link = document.createElement("a");
      const extension = recording.blob.type.includes("mp4") ? "m4a" : "webm";
      link.href = recording.url;
      link.download =
        `${recording.title.replace(/[^a-z0-9-_ ]/gi, "_")}.${extension}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
    }
  }

  if (deleteButton) {
    if (!canRecordAudio()) {
      return alert("Recording management is restricted to officers in this demo.");
    }

    const recording = recordings.find(
      (r) => r.id === deleteButton.dataset.deleteRecording
    );

    if (!recording || !confirm("Delete this recording from the session?")) return;

    URL.revokeObjectURL(recording.url);
    recordings = recordings.filter((r) => r.id !== recording.id);
    renderRecordings();
  }
});

window.addEventListener("pagehide", () => {
  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.stop();
  }

  if (audioStream) audioStream.getTracks().forEach((track) => track.stop());
  recordings.forEach((recording) => URL.revokeObjectURL(recording.url));
});

// STARTUP
renderMembers();
renderMeetings();
renderExpenses();
updateClock();
updateRecorderUI();
applyRole();
