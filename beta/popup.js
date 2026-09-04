let currentSearchQuery = "";
let currentFilters = [];
let deletedMessages = [];
let manualUnreadItems = [];
let snoozedItems = {};
let isTrashView = false;
let currentViewMode = "all"; // "all" | "unread" | "snoozed"
let allMessages = []; 
let isAllCollapsed = false;

document.addEventListener('DOMContentLoaded', () => {
  // קריאת נתונים ראשונית מהאחסון
  chrome.storage.local.get([
    'token', 
    'phoneNumber', 
    'smsFilters', 
    'deletedMessages', 
    'manualUnreadItems', 
    'snoozedItems', 
    'updateAvailable'
  ], (data) => {
    currentFilters = data.smsFilters || [];
    deletedMessages = data.deletedMessages || [];
    manualUnreadItems = data.manualUnreadItems || [];
    snoozedItems = data.snoozedItems || {};

    // עדכון מונה ה-Badge לפי כמות ההודעות שלא נקראו ידנית
    chrome.storage.local.set({ unreadCount: manualUnreadItems.length });

    if (data.phoneNumber && data.phoneNumber !== "לא אותר מספר אוטומטית" && data.phoneNumber !== "שגיאה בשליפת המספר") {
      document.getElementById('systemPhone').textContent = data.phoneNumber;
    }

    // טיפול בבאנר עדכון
    if (data.updateAvailable) {
      initUpdateBanner();
    }

    loadMessages();
  });

  // רענון הודעות
  document.getElementById('refreshBtn').addEventListener('click', () => {
    const icon = document.getElementById('refreshIcon');
    icon.classList.add('spinning');
    loadMessages().finally(() => setTimeout(() => icon.classList.remove('spinning'), 500));
  });

  // שליחת התראת דחיפה (פוש) להודעה האחרונה
  document.getElementById('resendBtn').addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'resend-latest-sms' });
  });

  // פתיחה/סגירה של חלונית שליחת SMS
  const toggleSmsBtn = document.getElementById('toggleSmsBtn');
  const sendSmsPanel = document.getElementById('sendSmsPanel');
  const closeSmsPanelBtn = document.getElementById('closeSmsPanelBtn');

  toggleSmsBtn.addEventListener('click', () => {
    const isOpen = sendSmsPanel.style.display === 'flex';
    sendSmsPanel.style.display = isOpen ? 'none' : 'flex';
    toggleSmsBtn.classList.toggle('active', !isOpen);
    if (!isOpen) {
      document.getElementById('smsDestination').focus();
    }
  });

  closeSmsPanelBtn.addEventListener('click', () => {
    sendSmsPanel.style.display = 'none';
    toggleSmsBtn.classList.remove('active');
  });

  // ספירת תווים להודעת SMS
  const smsMessageInput = document.getElementById('smsMessage');
  const smsCharCounter = document.getElementById('smsCharCounter');
  smsMessageInput.addEventListener('input', () => {
    const len = smsMessageInput.value.length;
    smsCharCounter.textContent = `${len} תווים`;
  });

  // שליחת הודעת SMS בפועל
  document.getElementById('sendSmsSubmitBtn').addEventListener('click', handleSendSms);

  // סינון להודעות שלא נקראו
  const unreadFilterBtn = document.getElementById('unreadFilterBtn');
  unreadFilterBtn.addEventListener('click', () => {
    isTrashView = false;
    currentViewMode = currentViewMode === 'unread' ? 'all' : 'unread';
    updateViewFilterButtons();
    renderMessages();
  });

  // סינון להודעות לטיפול בהמשך (Snooze)
  const snoozeFilterBtn = document.getElementById('snoozeFilterBtn');
  snoozeFilterBtn.addEventListener('click', () => {
    isTrashView = false;
    currentViewMode = currentViewMode === 'snoozed' ? 'all' : 'snoozed';
    updateViewFilterButtons();
    renderMessages();
  });

  // סל מחזור
  const trashBtn = document.getElementById('trashBtn');
  trashBtn.addEventListener('click', () => {
    isTrashView = !isTrashView;
    currentViewMode = 'all';
    updateViewFilterButtons();
    renderMessages();
  });

  // הרחבה / צמצום של כל ההודעות
  document.getElementById('toggleAllBtn').addEventListener('click', () => {
    isAllCollapsed = !isAllCollapsed;
    const bodies = document.querySelectorAll('.msg-body');
    const svgs = document.querySelectorAll('.collapse-btn svg');
    
    bodies.forEach(body => {
      if (isAllCollapsed) {
        body.classList.add('collapsed');
      } else {
        body.classList.remove('collapsed');
      }
    });
    
    svgs.forEach(svg => {
      svg.style.transform = isAllCollapsed ? 'rotate(180deg)' : 'rotate(0deg)';
    });
  });

  // חיפוש חופשי
  document.getElementById('searchInput').addEventListener('input', (e) => {
    currentSearchQuery = e.target.value.toLowerCase();
    renderMessages();
  });

  // סגירת פופאובר בחירת זמן בעת לחיצה בחוץ
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.snooze-wrapper')) {
      document.querySelectorAll('.snooze-popover').forEach(el => el.style.display = 'none');
    }
  });
});

function updateViewFilterButtons() {
  const unreadBtn = document.getElementById('unreadFilterBtn');
  const snoozeBtn = document.getElementById('snoozeFilterBtn');
  const trashBtn = document.getElementById('trashBtn');
  const statusBanner = document.getElementById('statusBanner');
  const statusBannerText = document.getElementById('statusBannerText');

  unreadBtn.classList.toggle('active', currentViewMode === 'unread');
  snoozeBtn.classList.toggle('active', currentViewMode === 'snoozed');

  if (isTrashView) {
    trashBtn.classList.add('active');
    statusBanner.style.display = 'flex';
    statusBannerText.textContent = 'סל מחזור פעיל (הודעות שנמחקו)';
  } else if (currentViewMode === 'unread') {
    trashBtn.classList.remove('active');
    statusBanner.style.display = 'flex';
    statusBannerText.textContent = 'מציג: הודעות שלא נקראו';
  } else if (currentViewMode === 'snoozed') {
    trashBtn.classList.remove('active');
    statusBanner.style.display = 'flex';
    statusBannerText.textContent = 'מציג: הודעות לטיפול בהמשך';
  } else {
    trashBtn.classList.remove('active');
    statusBanner.style.display = 'none';
  }
}

function initUpdateBanner() {
  const alertBox = document.getElementById('updateAlertBox');
  alertBox.style.display = 'block';
  const currentVersion = chrome.runtime.getManifest().version;
  
  fetch('https://api.github.com/repos/Tzadikvtovlo/PushBox/releases/latest')
    .then(res => res.json())
    .then(releaseData => {
       const latestVersion = releaseData.tag_name ? releaseData.tag_name.replace(/^v/i, '').trim() : currentVersion;
       alertBox.textContent = `יש עדכון! מותקן: v${currentVersion} | זמין: v${latestVersion}`;
       alertBox.title = "לחץ כאן להורדה";
    }).catch(() => {
       alertBox.textContent = "עדכון גרסה זמין! לחץ כאן להורדה";
    });

  alertBox.addEventListener('click', () => {
    window.open('https://github.com/Tzadikvtovlo/PushBox/releases', '_blank');
  });
}

async function handleSendSms() {
  const destInput = document.getElementById('smsDestination');
  const msgInput = document.getElementById('smsMessage');
  const statusMsg = document.getElementById('smsStatusMsg');
  const submitBtn = document.getElementById('sendSmsSubmitBtn');

  const destination = destInput.value.trim().replace(/[- ]/g, '');
  const message = msgInput.value.trim();

  if (!destination) {
    showSmsStatus('נא להזין מספר טלפון יעד תקין', 'error');
    return;
  }
  if (!message) {
    showSmsStatus('נא להזין את תוכן ההודעה', 'error');
    return;
  }

  showSmsStatus('שולח הודעה...', '');
  submitBtn.disabled = true;

  chrome.storage.local.get(['token'], async (data) => {
    if (!data.token) {
      showSmsStatus('שגיאה: לא הוגדר טוקן במערכת', 'error');
      submitBtn.disabled = false;
      return;
    }

    try {
      const url = `https://www.call2all.co.il/ym/api/SendSms?token=${encodeURIComponent(data.token)}&destination=${encodeURIComponent(destination)}&message=${encodeURIComponent(message)}`;
      const res = await fetch(url);
      const json = await res.json();

      if (json && (json.responseStatus === 'OK' || json.status === 'OK' || json.success === true)) {
        showSmsStatus('הודעת ה-SMS נשלחה בהצלחה!', 'success');
        msgInput.value = '';
        document.getElementById('smsCharCounter').textContent = '0 תווים';
        setTimeout(() => {
          document.getElementById('sendSmsPanel').style.display = 'none';
          document.getElementById('toggleSmsBtn').classList.remove('active');
          statusMsg.style.display = 'none';
        }, 2000);
      } else {
        const errText = json.message || json.responseStatus || 'שגיאה בשליחה';
        showSmsStatus(`שגיאה מהשרת: ${errText}`, 'error');
      }
    } catch (e) {
      showSmsStatus('שגיאת תקשורת מול השרת בשליחת SMS', 'error');
    } finally {
      submitBtn.disabled = false;
    }
  });
}

function showSmsStatus(text, type) {
  const statusMsg = document.getElementById('smsStatusMsg');
  statusMsg.style.display = 'block';
  statusMsg.className = `sms-status-msg ${type}`;
  statusMsg.textContent = text;
}

async function loadMessages() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['token', 'manualUnreadItems', 'snoozedItems', 'deletedMessages'], async (data) => {
      manualUnreadItems = data.manualUnreadItems || [];
      snoozedItems = data.snoozedItems || {};
      deletedMessages = data.deletedMessages || [];

      if (!data.token) {
         document.getElementById('messagesList').innerHTML = '<div class="error">לא הוגדר טוקן במערכת. לחץ על הגדרות.</div>';
         resolve();
         return;
      }
      try {
        const url = `https://www.call2all.co.il/ym/api/GetIncomingSms?token=${encodeURIComponent(data.token)}&limit=50`;
        const res = await fetch(url);
        const result = await res.json();
        
        if (result && result.responseStatus === 'OK') {
           allMessages = result.rows || [];
           renderMessages();
        } else {
           document.getElementById('messagesList').innerHTML = '<div class="error">שגיאה במשיכת נתונים או טוקן שגוי.</div>';
        }
      } catch (e) {
        document.getElementById('messagesList').innerHTML = '<div class="error">שגיאת תקשורת מול השרת.</div>';
      }
      resolve();
    });
  });
}

function renderMessages() {
  const container = document.getElementById('messagesList');
  container.innerHTML = '';

  const now = Date.now();

  let filteredMessages = allMessages.filter(msg => {
    const msgId = `${msg.receive_date}_${msg.source}`;
    const isDeleted = deletedMessages.includes(msgId);
    const isUnread = manualUnreadItems.includes(msgId);
    const snoozeData = snoozedItems[msgId];
    const isSnoozed = snoozeData && snoozeData.until > now;

    // סינון לפי תצוגת סל מחזור
    if (isTrashView) {
      return isDeleted;
    }
    if (isDeleted) return false;

    // סינון לפי תצוגת "לא נקרא"
    if (currentViewMode === 'unread') {
      if (!isUnread) return false;
    }

    // סינון לפי תצוגת "לטיפול בהמשך"
    if (currentViewMode === 'snoozed') {
      if (!isSnoozed) return false;
    }

    // סינון לפי חוקי המסננים שהוגדרו בהגדרות
    for (let f of currentFilters) {
      if (f.type === 'sender' && msg.source === f.value) return false;
      if (f.type === 'contains' && msg.message.includes(f.value)) return false;
      if (f.type === 'not_contains' && !msg.message.includes(f.value)) return false;
    }

    return true;
  });

  // סינון לפי חיפוש מלל חופשי
  if (currentSearchQuery) {
    filteredMessages = filteredMessages.filter(msg => 
      msg.message.toLowerCase().includes(currentSearchQuery) || 
      msg.source.toLowerCase().includes(currentSearchQuery)
    );
  }

  if (filteredMessages.length === 0) {
    if (isTrashView) {
      container.innerHTML = '<div class="empty">סל המחזור ריק.</div>';
    } else if (currentViewMode === 'unread') {
      container.innerHTML = '<div class="empty">אין הודעות המסומנות כלא נקראו.</div>';
    } else if (currentViewMode === 'snoozed') {
      container.innerHTML = '<div class="empty">אין הודעות הממתינות לטיפול בהמשך.</div>';
    } else {
      container.innerHTML = '<div class="empty">אין הודעות המותאמות לסינון/לחיפוש.</div>';
    }
    return;
  }

  filteredMessages.slice(0, 30).forEach(msg => {
    const card = document.createElement('div');
    const msgId = `${msg.receive_date}_${msg.source}`;
    const isUnread = manualUnreadItems.includes(msgId);
    const snoozeData = snoozedItems[msgId];
    const isSnoozed = snoozeData && snoozeData.until > now;

    card.className = `msg-card ${isUnread ? 'is-unread' : ''}`;
    
    // זיהוי קוד אימות בסגנון המקורי
    const codeMatch = msg.message.match(/\b\d{5,8}\b/);
    
    let copyBtnHtml = '';
    if (codeMatch) {
       copyBtnHtml = `
       <button class="btn-copy">
         <span class="copy-inner">
           <svg class="svg-icon" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
           העתק קוד: <span class="code-highlight">${codeMatch[0]}</span>
         </span>
       </button>`;
    } else {
       copyBtnHtml = `
       <button class="btn-copy">
         <span class="copy-inner">
           <svg class="svg-icon" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
           העתק הודעה מלאה
         </span>
       </button>`;
    }

    let text = escapeHtml(msg.message || '');
    text = text.replace(/[\r\n]+/g, '\n').trim();

    const urlRegex = /(?:https?:\/\/)?(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{2,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&\/=]*)/gi;
    const links = [];
    text = text.replace(urlRegex, (url) => {
      links.push(url);
      return `__URL_${links.length - 1}__`;
    });

    text = text.replace(/__URL_(\d+)__/g, (match, index) => {
      const url = links[index];
      let cleanUrl = url.replace(/&amp;/g, '&');
      let href = cleanUrl;
      if (!href.match(/^https?:\/\//i)) {
        href = 'https://' + href;
      }
      return `<a href="${href}" target="_blank" rel="noopener noreferrer" style="color: var(--primary); text-decoration: underline; font-weight: bold; direction: ltr; display: inline-block;">${url}</a>`;
    });

    const displayMsg = text.replace(/\n/g, '<br>');

    // אייקון מחיקה / שחזור
    const deleteRestoreIcon = isTrashView ? 
      `<svg class="svg-icon" viewBox="0 0 24 24" title="שחזר הודעה"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><polyline points="3 3 3 8 8 8"></polyline></svg>` : 
      `<svg class="svg-icon" viewBox="0 0 24 24" title="מחק הודעה"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`;

    // תגית Snooze אם פעילה
    let snoozeTagHtml = '';
    if (isSnoozed) {
      const minutesLeft = Math.max(1, Math.round((snoozeData.until - now) / 60000));
      snoozeTagHtml = `<span class="msg-snooze-tag" title="תזכורת פעילה"><svg class="svg-icon" style="width:10px;height:10px;" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>בעוד ${minutesLeft} דק'</span>`;
    }

    const bodyClass = isAllCollapsed ? "msg-body collapsed" : "msg-body";
    const rotateStyle = isAllCollapsed ? "transform: rotate(180deg);" : "";

    card.innerHTML = `
      <div class="msg-header">
        <div class="msg-source-wrapper">
          <span class="msg-source">${msg.source}</span>
          ${snoozeTagHtml}
        </div>
        <div class="msg-controls">
          <button class="ctrl-btn reply-btn" title="השב ב-SMS לשולח זה">
            <svg class="svg-icon" viewBox="0 0 24 24"><polyline points="9 17 4 12 9 7"></polyline><path d="M20 18v-2a4 4 0 0 0-4-4H4"></path></svg>
          </button>
          <button class="ctrl-btn mark-unread-btn ${isUnread ? 'active' : ''}" title="${isUnread ? 'סמן כנקרא' : 'סמן כלא נקרא'}">
            <svg class="svg-icon" viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
          </button>
          <div class="snooze-wrapper" style="position: relative; display: inline-block;">
            <button class="ctrl-btn snooze-btn ${isSnoozed ? 'active' : ''}" title="לטיפול בהמשך (Snooze)">
              <svg class="svg-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
            </button>
            <div class="snooze-popover">
              <button class="snooze-opt-btn" data-time="15">בעוד 15 דקות</button>
              <button class="snooze-opt-btn" data-time="60">בעוד שעה</button>
              <button class="snooze-opt-btn" data-time="180">בעוד 3 שעות</button>
              <button class="snooze-opt-btn" data-time="morning">מחר בבוקר</button>
              ${isSnoozed ? '<button class="snooze-opt-btn" data-time="cancel" style="color:#dc2626;">בטל תזכורת</button>' : ''}
            </div>
          </div>
          <button class="ctrl-btn filter-sender-btn" title="סנן שולח זה">
            <svg class="svg-icon" viewBox="0 0 24 24"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>
          </button>
          <button class="ctrl-btn collapse-btn" title="צמצם/הרחב">
            <svg class="svg-icon" viewBox="0 0 24 24" style="${rotateStyle}"><polyline points="6 9 12 15 18 9"></polyline></svg>
          </button>
          <button class="ctrl-btn delete-btn">
            ${deleteRestoreIcon}
          </button>
        </div>
        <div class="msg-date-wrapper"><span class="msg-date">${msg.receive_date}</span></div>
      </div>
      <div class="${bodyClass}">${displayMsg}</div>
      ${copyBtnHtml}
    `;

    // 1. מענה ב-SMS ישיר
    card.querySelector('.reply-btn').addEventListener('click', () => {
      const sendPanel = document.getElementById('sendSmsPanel');
      sendPanel.style.display = 'flex';
      document.getElementById('toggleSmsBtn').classList.add('active');
      const destInput = document.getElementById('smsDestination');
      destInput.value = msg.source || '';
      document.getElementById('smsMessage').focus();
    });

    // 2. סימון כלא-נקרא / נקרא
    card.querySelector('.mark-unread-btn').addEventListener('click', () => {
      if (manualUnreadItems.includes(msgId)) {
        manualUnreadItems = manualUnreadItems.filter(id => id !== msgId);
      } else {
        manualUnreadItems.push(msgId);
      }
      chrome.storage.local.set({ 
        manualUnreadItems: manualUnreadItems,
        unreadCount: manualUnreadItems.length
      }, () => {
        renderMessages();
      });
    });

    // 3. תפריט לטיפול בהמשך (Snooze)
    const snoozeBtn = card.querySelector('.snooze-btn');
    const snoozePopover = card.querySelector('.snooze-popover');
    snoozeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isVisible = snoozePopover.style.display === 'flex';
      document.querySelectorAll('.snooze-popover').forEach(el => el.style.display = 'none');
      snoozePopover.style.display = isVisible ? 'none' : 'flex';
    });

    snoozePopover.querySelectorAll('.snooze-opt-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const timeVal = btn.dataset.time;
        snoozePopover.style.display = 'none';

        if (timeVal === 'cancel') {
          delete snoozedItems[msgId];
          chrome.storage.local.set({ snoozedItems: snoozedItems }, () => {
            chrome.alarms.clear(`snooze_${msgId}`);
            renderMessages();
          });
          return;
        }

        let targetTime = Date.now();
        if (timeVal === 'morning') {
          const d = new Date();
          d.setDate(d.getDate() + 1);
          d.setHours(9, 0, 0, 0);
          targetTime = d.getTime();
        } else {
          const minutes = parseInt(timeVal, 10) || 15;
          targetTime = Date.now() + minutes * 60000;
        }

        snoozedItems[msgId] = {
          until: targetTime,
          source: msg.source,
          message: msg.message
        };

        chrome.storage.local.set({ snoozedItems: snoozedItems }, () => {
          chrome.alarms.create(`snooze_${msgId}`, { when: targetTime });
          renderMessages();
        });
      });
    });

    // 4. סינון שולח בדף המסננים
    card.querySelector('.filter-sender-btn').addEventListener('click', () => {
      chrome.tabs.create({ url: `filters.html?sender=${encodeURIComponent(msg.source)}` });
    });

    // 5. צמצום/הרחבה
    card.querySelector('.collapse-btn').addEventListener('click', () => {
      const body = card.querySelector('.msg-body');
      const svg = card.querySelector('.collapse-btn svg');
      const isCollapsed = body.classList.toggle('collapsed');
      svg.style.transform = isCollapsed ? 'rotate(180deg)' : 'rotate(0deg)';
    });

    // 6. מחיקה / שחזור מסל מחזור
    card.querySelector('.delete-btn').addEventListener('click', () => {
      if (isTrashView) {
        deletedMessages = deletedMessages.filter(id => id !== msgId);
      } else {
        if (!deletedMessages.includes(msgId)) {
          deletedMessages.push(msgId);
        }
      }
      chrome.storage.local.set({ deletedMessages: deletedMessages }, () => {
        renderMessages();
      });
    });

    // 7. העתקה מדויקת כמו ב-4.6 המקורי
    card.querySelector('.btn-copy').addEventListener('click', (e) => {
       const textToCopy = codeMatch ? codeMatch[0] : msg.message;
       navigator.clipboard.writeText(textToCopy);
       const copyInner = e.currentTarget.querySelector('.copy-inner');
       const originalHtml = copyInner.innerHTML;
       copyInner.innerHTML = 'הועתק בהצלחה!';
       setTimeout(() => copyInner.innerHTML = originalHtml, 1500);
    });
    
    container.appendChild(card);
  });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
