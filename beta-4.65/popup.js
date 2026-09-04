let allMessages = [];
let isAllCollapsed = false;
let isTrashMode = false;

document.addEventListener('DOMContentLoaded', () => {
  // איפוס מונה כפי שקיים ב-4.6 (לפי דרישת המשתמש)
  chrome.storage.local.set({ unreadCount: 0 });

  chrome.storage.local.get(['phoneNumber'], (data) => {
    if (data.phoneNumber) {
      document.getElementById('systemPhone').textContent = data.phoneNumber;
    }
  });

  // בדיקת עדכון מתוך ה-Storage המבוקר (למניעת חריגת Rate Limit מול GitHub)
  checkUpdateStateFromStorage();

  // טעינת הודעות עם מנגנון Stale-While-Revalidate (מטמון מקומי מיידי ואז רענון)
  loadCachedMessagesFirst();
  loadMessages();

  document.getElementById('refreshBtn').addEventListener('click', () => {
    const icon = document.getElementById('refreshIcon');
    icon.classList.add('spinning');
    loadMessages().finally(() => {
      setTimeout(() => icon.classList.remove('spinning'), 500);
    });
  });

  document.getElementById('resendBtn').addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'resend-latest-sms' }, (res) => {
      if (res && res.success) {
        console.log("Latest SMS notification resent.");
      }
    });
  });

  document.getElementById('searchInput').addEventListener('input', (e) => {
    filterMessages(e.target.value);
  });

  document.getElementById('toggleAllBtn').addEventListener('click', () => {
    isAllCollapsed = !isAllCollapsed;
    document.querySelectorAll('.msg-body').forEach(body => {
      if (isAllCollapsed) body.classList.add('collapsed');
      else body.classList.remove('collapsed');
    });
  });

  document.getElementById('trashBtn').addEventListener('click', () => {
    isTrashMode = !isTrashMode;
    const trashBtn = document.getElementById('trashBtn');
    const trashAlert = document.getElementById('trashAlert');

    if (isTrashMode) {
      trashBtn.classList.add('active');
      trashAlert.style.display = 'flex';
    } else {
      trashBtn.classList.remove('active');
      trashAlert.style.display = 'none';
    }
    loadMessages();
  });
});

// שיפור 3.3: טעינה מיידית מהמטמון כדי שהפופאפ ייפתח תוך שבריר שנייה ללא השהיה
function loadCachedMessagesFirst() {
  chrome.storage.local.get(['cachedMessages', 'deletedMessages'], (data) => {
    if (data.cachedMessages && Array.isArray(data.cachedMessages) && data.cachedMessages.length > 0 && allMessages.length === 0) {
      const deleted = data.deletedMessages || [];
      if (isTrashMode) {
        allMessages = data.cachedMessages.filter(msg => deleted.includes(getMessageUniqueId(msg)));
      } else {
        allMessages = data.cachedMessages.filter(msg => !deleted.includes(getMessageUniqueId(msg)));
      }
      if (allMessages.length > 0) {
        renderMessages(allMessages);
      }
    }
  });
}

function getMessageUniqueId(msg) {
  return `${msg.receive_date}_${msg.source}_${msg.message.substring(0, 15)}`;
}

async function loadMessages() {
  const listEl = document.getElementById('messagesList');

  // אם עדיין אין שום הודעה במסך, נציג טוען
  if (allMessages.length === 0) {
    listEl.innerHTML = '<div class="loading">טוען הודעות...</div>';
  }

  chrome.storage.local.get(['token', 'deletedMessages', 'smsFilters'], async (data) => {
    if (!data.token) {
      listEl.innerHTML = `
        <div class="empty">
          טרם הוגדר טוקן התחברות.<br><br>
          <a href="options.html" target="_blank" style="color: var(--primary); text-decoration: underline; font-weight: bold;">לחץ כאן להגדרות</a>
        </div>`;
      return;
    }

    try {
      const res = await fetch(`https://www.call2all.co.il/ym/api/GetIncomingSms?token=${encodeURIComponent(data.token)}&limit=50`);
      const result = await res.json();

      if (result && result.responseStatus === 'OK') {
        const deleted = data.deletedMessages || [];
        const rawMessages = result.rows || [];

        // שמירה במטמון מקומי
        chrome.storage.local.set({ cachedMessages: rawMessages });

        if (isTrashMode) {
          allMessages = rawMessages.filter(msg => deleted.includes(getMessageUniqueId(msg)));
        } else {
          allMessages = rawMessages.filter(msg => !deleted.includes(getMessageUniqueId(msg)));
        }

        renderMessages(allMessages);
      } else {
        if (allMessages.length === 0) {
          listEl.innerHTML = '<div class="error">שגיאה בקבלת הודעות מהשרת (בדוק טוקן בהגדרות).</div>';
        }
      }
    } catch (err) {
      console.error(err);
      if (allMessages.length === 0) {
        listEl.innerHTML = '<div class="error">שגיאת תקשורת עם השרת.</div>';
      }
    }
  });
}

function renderMessages(messages) {
  const listEl = document.getElementById('messagesList');
  listEl.innerHTML = '';

  if (!messages || messages.length === 0) {
    listEl.innerHTML = `<div class="empty">${isTrashMode ? 'סל המחזור ריק.' : 'אין הודעות להצגה.'}</div>`;
    return;
  }

  messages.forEach(msg => {
    const card = document.createElement('div');
    card.className = 'msg-card';
    const msgId = getMessageUniqueId(msg);

    const header = document.createElement('div');
    header.className = 'msg-header';

    const sourceWrapper = document.createElement('div');
    sourceWrapper.className = 'msg-source-wrapper';
    const source = document.createElement('span');
    source.className = 'msg-source';
    source.textContent = msg.source || 'מערכת';
    sourceWrapper.appendChild(source);

    const controls = document.createElement('div');
    controls.className = 'msg-controls';

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'ctrl-btn';
    deleteBtn.title = isTrashMode ? 'שחזר הודעה' : 'מחק הודעה';
    deleteBtn.innerHTML = isTrashMode 
      ? '<svg class="svg-icon" viewBox="0 0 24 24"><polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path></svg>'
      : '<svg class="svg-icon" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>';
    
    deleteBtn.addEventListener('click', () => {
      toggleDeleteMessage(msgId);
    });

    const collapseBtn = document.createElement('button');
    collapseBtn.className = 'ctrl-btn';
    collapseBtn.title = 'צמצם/הרחב הודעה';
    collapseBtn.innerHTML = '<svg class="svg-icon" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"></polyline></svg>';

    const filterBtn = document.createElement('button');
    filterBtn.className = 'ctrl-btn';
    filterBtn.title = 'הוסף שולח לרשימת מסננים';
    filterBtn.innerHTML = '<svg class="svg-icon" viewBox="0 0 24 24"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>';
    filterBtn.addEventListener('click', () => {
      addSenderToFilter(msg.source);
    });

    controls.appendChild(deleteBtn);
    controls.appendChild(collapseBtn);
    controls.appendChild(filterBtn);

    const dateWrapper = document.createElement('div');
    dateWrapper.className = 'msg-date-wrapper';
    const date = document.createElement('span');
    date.className = 'msg-date';
    date.textContent = formatDate(msg.receive_date);
    dateWrapper.appendChild(date);

    header.appendChild(sourceWrapper);
    header.appendChild(controls);
    header.appendChild(dateWrapper);

    const body = document.createElement('div');
    body.className = 'msg-body';
    if (isAllCollapsed) {
      body.classList.add('collapsed');
    }
    body.innerHTML = formatMessageText(msg.message);

    collapseBtn.addEventListener('click', () => {
      body.classList.toggle('collapsed');
    });

    const copyBtn = document.createElement('button');
    copyBtn.className = 'btn-copy';
    const codeMatch = msg.message.match(/\b\d{5,8}\b/);

    if (codeMatch) {
      const code = codeMatch[0];
      copyBtn.innerHTML = `<span class="copy-inner"><svg class="svg-icon" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg> העתק קוד אימות: <span class="code-highlight">${code}</span></span>`;
      copyBtn.addEventListener('click', () => {
        copyToClipboard(code, copyBtn, `הקוד ${code} הועתק!`);
      });
    } else {
      copyBtn.innerHTML = '<span class="copy-inner"><svg class="svg-icon" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg> העתק תוכן הודעה</span>';
      copyBtn.addEventListener('click', () => {
        copyToClipboard(msg.message, copyBtn, 'התוכן הועתק!');
      });
    }

    card.appendChild(header);
    card.appendChild(body);
    card.appendChild(copyBtn);
    listEl.appendChild(card);
  });
}

function toggleDeleteMessage(msgId) {
  chrome.storage.local.get(['deletedMessages'], (data) => {
    let deleted = data.deletedMessages || [];
    if (deleted.includes(msgId)) {
      deleted = deleted.filter(id => id !== msgId);
    } else {
      deleted.push(msgId);
    }
    chrome.storage.local.set({ deletedMessages: deleted }, () => {
      loadMessages();
    });
  });
}

function addSenderToFilter(sender) {
  if (!sender) return;
  chrome.storage.local.get(['smsFilters'], (data) => {
    let filters = data.smsFilters || [];
    const exists = filters.some(f => f.type === 'sender' && f.value === sender);
    if (!exists) {
      filters.push({ type: 'sender', value: sender });
      chrome.storage.local.set({ smsFilters: filters }, () => {
        chrome.runtime.openOptionsPage();
      });
    } else {
      chrome.runtime.openOptionsPage();
    }
  });
}

function filterMessages(query) {
  if (!query) {
    renderMessages(allMessages);
    return;
  }
  const q = query.toLowerCase();
  const filtered = allMessages.filter(m => 
    (m.message && m.message.toLowerCase().includes(q)) || 
    (m.source && m.source.toLowerCase().includes(q))
  );
  renderMessages(filtered);
}

// פורמט הודעה כמו 4.6 (לפי דרישת המשתמש להתעלם מסעיף 2.3)
function formatMessageText(text) {
  if (!text) return '';
  const escaped = escapeHtml(text);
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return escaped.replace(urlRegex, (url) => {
    return `<a href="${url}" target="_blank" style="color: var(--primary); text-decoration: underline;">${url}</a>`;
  });
}

function escapeHtml(string) {
  return String(string).replace(/[&<>"']/g, (s) => {
    return {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[s];
  });
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    const parts = dateStr.split(' ');
    if (parts.length === 2) {
      const d = parts[0].split('-');
      const t = parts[1].split(':');
      if (d.length === 3 && t.length >= 2) {
        return `${d[2]}/${d[1]} ${t[0]}:${t[1]}`;
      }
    }
    return dateStr;
  } catch (e) {
    return dateStr;
  }
}

function copyToClipboard(text, btnElement, successText) {
  navigator.clipboard.writeText(text).then(() => {
    const originalHtml = btnElement.innerHTML;
    btnElement.innerHTML = `<span class="copy-inner"><svg class="svg-icon" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg> ${successText}</span>`;
    btnElement.style.background = '#d8b4fe';
    setTimeout(() => {
      btnElement.innerHTML = originalHtml;
      btnElement.style.background = '#f3e8ff';
    }, 1500);
  });
}

// בדיקת עדכון דרך המטמון וה-storage של ה-Service Worker כדי לא לחרוג מ-Rate Limit
function checkUpdateStateFromStorage() {
  chrome.storage.local.get(['updateAvailable'], (data) => {
    const alertBox = document.getElementById('updateAlertBox');
    if (data.updateAvailable) {
      alertBox.style.display = 'block';
      alertBox.addEventListener('click', () => {
        chrome.runtime.openOptionsPage();
      });
    } else {
      alertBox.style.display = 'none';
    }
  });
}
