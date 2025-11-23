document.addEventListener("DOMContentLoaded", () => {
  // ===== Assistant logic =====
  const form = document.querySelector("#assistant-form");
  const input = document.querySelector("#assistant-q");
  const out = document.querySelector("#assistant-out");

  if (form && input && out) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const txt = input.value.trim();
      if (!txt) {
        out.innerHTML = "اكتب سؤالك أو اسم الدرس أولًا 🧠";
        return;
      }
      const safe = txt.replace(/</g, "&lt;").replace(/>/g, "&gt;");
      out.innerHTML =
        "انسخ هذا الكلام وأرسِله لأي مساعد ذكاء اصطناعي:<br><br>" +
        "أريد شرحًا مبسطًا وملخصًا منظمًا لدرس: <strong>" + safe +
        "</strong> مع أسئلة اختيار من متعدد، وجدول مراجعة أسبوعي مناسب لطالب ثانوي عام.";
    });
  }

  // ===== Focus timer (عداد التركيز) =====
  let focusTimerId = null;
  let focusMode = "idle"; // idle | study | break
  let totalStudySeconds = 0;
  let remainingStudySeconds = 0;
  let currentPhaseSeconds = 0;
  let breakSeconds = 0;

  const focusMinutesInput = document.querySelector("#focus-minutes");
  const breakMinutesInput = document.querySelector("#focus-break-minutes");
  const focusStartBtn = document.querySelector("#focus-start");
  const focusPauseBtn = document.querySelector("#focus-pause");
  const focusResetBtn = document.querySelector("#focus-reset");
  const focusDisplay = document.querySelector("#focus-display");
  const focusStatus = document.querySelector("#focus-status");

  function fmtTime(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m.toString().padStart(2, "0") + ":" + s.toString().padStart(2, "0");
  }

  function updateFocusUI() {
    if (!focusDisplay || !focusStatus) return;
    focusDisplay.textContent = fmtTime(currentPhaseSeconds);
    let statusText = "";
    if (focusMode === "idle") statusText = "في انتظار البدء 🎧";
    else if (focusMode === "study") statusText = "وضع مذاكرة - ركز!";
    else if (focusMode === "break") statusText = "وقت راحة - اشرب حاجة وخد نفس ✨";
    focusStatus.textContent = statusText;
  }

  function stopFocusTimer() {
    if (focusTimerId) {
      clearInterval(focusTimerId);
      focusTimerId = null;
    }
  }

  function startPhase(mode) {
    focusMode = mode;
    if (mode === "study") {
      // كل مرحلة مذاكرة 30 دقيقة أو ما تبقى من الوقت
      const segment = Math.min(30 * 60, remainingStudySeconds);
      currentPhaseSeconds = segment;
    } else if (mode === "break") {
      currentPhaseSeconds = breakSeconds;
    } else {
      currentPhaseSeconds = 0;
    }
    updateFocusUI();
  }

  function tickFocus() {
    if (focusMode === "idle") return;
    if (currentPhaseSeconds > 0) {
      currentPhaseSeconds -= 1;
      if (focusMode === "study") {
        remainingStudySeconds = Math.max(0, remainingStudySeconds - 1);
      }
      updateFocusUI();
    } else {
      if (focusMode === "study") {
        if (remainingStudySeconds <= 0) {
          // انتهى الهدف
          stopFocusTimer();
          focusMode = "idle";
          currentPhaseSeconds = 0;
          updateFocusUI();
          if (focusStatus) {
            focusStatus.textContent = "انتهيت من وقت المذاكرة 🎉 أحسنت يا بطل!";
          }
        } else {
          // انتقل لراحة
          startPhase("break");
        }
      } else if (focusMode === "break") {
        // بعد الراحة نرجع مكمّلين
        if (remainingStudySeconds > 0) {
          startPhase("study");
        } else {
          stopFocusTimer();
          focusMode = "idle";
          currentPhaseSeconds = 0;
          updateFocusUI();
        }
      }
    }
  }

  if (focusStartBtn && focusMinutesInput && breakMinutesInput) {
    focusStartBtn.addEventListener("click", () => {
      const mins = parseInt(focusMinutesInput.value || "0", 10);
      const bmins = parseInt(breakMinutesInput.value || "0", 10);
      if (!mins || mins <= 0) {
        alert("اكتب عدد دقائق المذاكرة أولاً (مثال: 180 لـ ٣ ساعات).");
        return;
      }
      totalStudySeconds = mins * 60;
      remainingStudySeconds = totalStudySeconds;
      breakSeconds = Math.max(0, bmins * 60);
      stopFocusTimer();
      startPhase("study");
      focusTimerId = setInterval(tickFocus, 1000);
    });
  }
  if (focusPauseBtn) {
    focusPauseBtn.addEventListener("click", () => {
      if (focusTimerId) {
        stopFocusTimer();
        if (focusStatus) focusStatus.textContent = "موقوف مؤقتًا ⏸";
      }
    });
  }
  if (focusResetBtn && focusMinutesInput) {
    focusResetBtn.addEventListener("click", () => {
      stopFocusTimer();
      focusMode = "idle";
      const mins = parseInt(focusMinutesInput.value || "0", 10);
      remainingStudySeconds = mins > 0 ? mins * 60 : 0;
      currentPhaseSeconds = remainingStudySeconds;
      updateFocusUI();
    });
  }
  updateFocusUI();

  // ===== Schedules (lessons & study) with localStorage =====
  const daysOptions = ["السبت","الأحد","الإثنين","الثلاثاء","الأربعاء","الخميس","الجمعة"];

  const scheduleBody = document.querySelector("#schedule-body");
  const scheduleSaveBtn = document.querySelector("#schedule-save");
  const scheduleAddRowBtn = document.querySelector("#schedule-add-row");
  const scheduleKey = "masar_shams_schedule_v2";

  const studyBody = document.querySelector("#study-body");
  const studySaveBtn = document.querySelector("#study-save");
  const studyAddRowBtn = document.querySelector("#study-add-row");
  const studyKey = "masar_shams_study_v1";

  function loadItems(key, defaultItems) {
    try {
      const raw = localStorage.getItem(key);
      if (raw) return JSON.parse(raw);
    } catch (e) {
      console.error("parse error for", key, e);
    }
    return defaultItems;
  }

  function saveItems(key, items) {
    try {
      localStorage.setItem(key, JSON.stringify(items));
    } catch (e) {
      console.error("save error for", key, e);
    }
  }

  function renderScheduleTable(tbody, key, isStudy) {
    if (!tbody) return;
    const defaultData = isStudy
      ? [
          {day:"السبت", subject:"مراجعة عامّة", type:"حل أسئلة", time:"٦:٠٠ م", note:"اختيار مادة حسب الحاجة"},
          {day:"الأحد", subject:"مذاكرة حرة", type:"حفظ / فهم", time:"٧:٠٠ م", note:"طبق خطة اليوم"},
        ]
      : [
          {day:"السبت", subject:"رياضيات", type:"درس + حل", time:"٥:٠٠ م", note:"حل بوكليت بعد الدرس"},
          {day:"الأحد", subject:"فيزياء", type:"مذاكرة فردية", time:"٧:٠٠ م", note:"مراجعة قوانين ومسائل"},
          {day:"الإثنين", subject:"عربي", type:"قراءة + نحو", time:"٦:٠٠ م", note:"حل ٢٠ سؤال نحو"},
          {day:"الثلاثاء", subject:"إنجليزي", type:"كلمات + جرامر", time:"٥:٣٠ م", note:"مراجعة يونت واحد"},
          {day:"الأربعاء", subject:"كيمياء", type:"درس", time:"٨:٠٠ م", note:"تلخيص الدرس في كشكول"},
          {day:"الخميس", subject:"أحياء / جيولوجيا", type:"حفظ + مراجعة", time:"٧:٣٠ م", note:"رسم الرسوم المهمة"},
          {day:"الجمعة", subject:"مراجعة عامة", type:"حل امتحان كامل", time:"٤:٠٠ م", note:"قياس الوقت مثل الامتحان"}
        ];

    const data = loadItems(key, defaultData);
    tbody.innerHTML = "";
    data.forEach((row, index) => {
      const tr = document.createElement("tr");

      const tdDay = document.createElement("td");
      const sel = document.createElement("select");
      daysOptions.forEach(d => {
        const opt = document.createElement("option");
        opt.value = d;
        opt.textContent = d;
        if (d === row.day) opt.selected = true;
        sel.appendChild(opt);
      });
      tdDay.appendChild(sel);
      tr.appendChild(tdDay);

      const mkInputCell = (val) => {
        const td = document.createElement("td");
        const inp = document.createElement("input");
        inp.type = "text";
        inp.value = val || "";
        td.appendChild(inp);
        return td;
      };

      tr.appendChild(mkInputCell(row.subject));
      tr.appendChild(mkInputCell(row.type));
      tr.appendChild(mkInputCell(row.time));
      tr.appendChild(mkInputCell(row.note));

      // delete button
      const tdDel = document.createElement("td");
      const btnDel = document.createElement("button");
      btnDel.textContent = "حذف";
      btnDel.className = "btn btn-outline";
      btnDel.style.fontSize = "11px";
      btnDel.addEventListener("click", () => {
        tr.remove();
      });
      tdDel.appendChild(btnDel);
      tr.appendChild(tdDel);

      tbody.appendChild(tr);
    });
  }

  function collectScheduleFrom(tbody) {
    if (!tbody) return [];
    const rows = Array.from(tbody.querySelectorAll("tr"));
    return rows.map(tr => {
      const tds = tr.querySelectorAll("td");
      return {
        day: tds[0].querySelector("select").value.trim(),
        subject: tds[1].querySelector("input").value.trim(),
        type: tds[2].querySelector("input").value.trim(),
        time: tds[3].querySelector("input").value.trim(),
        note: tds[4].querySelector("input").value.trim()
      };
    });
  }

  if (scheduleBody) {
    renderScheduleTable(scheduleBody, scheduleKey, false);
    if (scheduleSaveBtn) {
      scheduleSaveBtn.addEventListener("click", () => {
        const data = collectScheduleFrom(scheduleBody);
        saveItems(scheduleKey, data);
        scheduleSaveBtn.textContent = "تم الحفظ ✅";
        setTimeout(() => { scheduleSaveBtn.textContent = "حفظ جدول الدروس"; }, 1500);
      });
    }
    if (scheduleAddRowBtn) {
      scheduleAddRowBtn.addEventListener("click", () => {
        const data = collectScheduleFrom(scheduleBody);
        data.push({day:"السبت", subject:"", type:"", time:"", note:""});
        saveItems(scheduleKey, data);
        renderScheduleTable(scheduleBody, scheduleKey, false);
      });
    }
  }

  if (studyBody) {
    renderScheduleTable(studyBody, studyKey, true);
    if (studySaveBtn) {
      studySaveBtn.addEventListener("click", () => {
        const data = collectScheduleFrom(studyBody);
        saveItems(studyKey, data);
        studySaveBtn.textContent = "تم الحفظ ✅";
        setTimeout(() => { studySaveBtn.textContent = "حفظ جدول المذاكرة"; }, 1500);
      });
    }
    if (studyAddRowBtn) {
      studyAddRowBtn.addEventListener("click", () => {
        const data = collectScheduleFrom(studyBody);
        data.push({day:"السبت", subject:"", type:"", time:"", note:""});
        saveItems(studyKey, data);
        renderScheduleTable(studyBody, studyKey, true);
      });
    }
  }

  // ===== Library logic with localStorage & delete =====
  const libraryForm = document.querySelector("#library-form");
  const libSubject = document.querySelector("#lib-subject");
  const libTitle = document.querySelector("#lib-title");
  const libLink = document.querySelector("#lib-link");
  const libList = document.querySelector("#library-list");
  const libraryKey = "masar_shams_library_v2";

  function loadLibrary() {
    try {
      const raw = localStorage.getItem(libraryKey);
      if (raw) return JSON.parse(raw);
    } catch (e) {
      console.error("lib parse error", e);
    }
    return [];
  }

  function saveLibrary(items) {
    try {
      localStorage.setItem(libraryKey, JSON.stringify(items));
    } catch (e) {
      console.error("lib save error", e);
    }
  }

  function renderLibrary() {
    if (!libList) return;
    const items = loadLibrary();
    if (!items.length) {
      libList.innerHTML = "<p style='font-size:12px;color:#6b7280;'>لم يتم إضافة مذكرات بعد. أضف أول مذكرة من النموذج بالأعلى.</p>";
      return;
    }
    const groups = {};
    items.forEach((it, idx) => {
      const s = it.subject || "أخرى";
      if (!groups[s]) groups[s] = [];
      groups[s].push({...it, idx});
    });
    const subjects = Object.keys(groups);
    let html = "";
    subjects.forEach(sub => {
      html += "<div class='card' style='margin-bottom:8px;'>";
      html += "<h3>" + sub + "</h3>";
      groups[sub].forEach(it => {
        const safeTitle = (it.title || "").replace(/</g,"&lt;").replace(/>/g,"&gt;");
        const safeLink = (it.link || "").trim();
        html += "<div style='display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin-top:6px;font-size:12px;'>";
        if (safeLink) {
          html += "<a class='btn btn-primary' style='font-size:11px;padding:5px 10px;' href='" + safeLink + "' target='_blank' rel='noopener'>ذاكر " + sub + "</a>";
        } else {
          html += "<span class='chip'>ذاكر " + sub + "</span>";
        }
        html += "<span style='flex:1;min-width:140px;'>" + safeTitle + "</span>";
        html += "<button class='btn btn-outline' data-lib-del='" + it.idx + "' style='font-size:11px;padding:5px 9px;'>حذف</button>";
        html += "</div>";
      });
      html += "</div>";
    });
    libList.innerHTML = html;

    // attach delete handlers
    libList.querySelectorAll("[data-lib-del]").forEach(btn => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.getAttribute("data-lib-del") || "-1", 10);
        if (idx >= 0) {
          const arr = loadLibrary();
          arr.splice(idx, 1);
          saveLibrary(arr);
          renderLibrary();
        }
      });
    });
  }

  if (libraryForm && libSubject && libTitle && libList) {
    renderLibrary();
    libraryForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const subject = libSubject.value.trim() || "أخرى";
      const title = libTitle.value.trim();
      const link = libLink.value.trim();
      if (!title) {
        alert("اكتب اسم المذكرة أو الكتاب على الأقل.");
        return;
      }
      const items = loadLibrary();
      items.push({subject, title, link});
      saveLibrary(items);
      libTitle.value = "";
      libLink.value = "";
      renderLibrary();
    });
  }
});
