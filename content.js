(function () {
  let translationEnabled = false;
  let currentTranslation = null;

  // 移除了内嵌的 CSS 样式，请确保 manifest.json 已经引入了 style.css

  // 创建图标按钮，内嵌 SVG 图标
  const button = document.createElement('button');
  button.id = 'translate-toggle';
  button.title = '启用翻译';
  button.innerHTML = `
<svg width="48" height="48" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="rectGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#6A82FB"/>
      <stop offset="100%" stop-color="#2575FC"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000" flood-opacity="0.2"/>
    </filter>
  </defs>
  <rect class="bg-circle" x="4" y="4" width="40" height="40" rx="8" ry="8" fill="url(#rectGrad)" filter="url(#shadow)"/>
  <text x="16" y="26" text-anchor="middle" dominant-baseline="middle"
        font-family="Helvetica, Arial, sans-serif" font-size="14" fill="#FFFFFF" font-weight="bold">
    A
  </text>
  <text x="32" y="26" text-anchor="middle" dominant-baseline="middle"
        font-family="Helvetica, Arial, sans-serif" font-size="14" fill="#FFFFFF" font-weight="bold">
    中
  </text>
</svg>
  `;
  document.body.appendChild(button);

  // 从 storage 中读取自动翻译状态
  chrome.storage.sync.get(['translationEnabled'], function (result) {
    translationEnabled = result.translationEnabled || false;
    updateButtonState();
    if (translationEnabled) {
      addEventListeners();
    }
  });

  // 按钮点击事件：切换自动翻译状态，并显示通知
  button.addEventListener('click', function () {
    translationEnabled = !translationEnabled;
    chrome.storage.sync.set({ translationEnabled: translationEnabled });
    updateButtonState();
    showNotification(translationEnabled ? '自动翻译已开启' : '自动翻译已关闭');
    if (translationEnabled) {
      addEventListeners();
    } else {
      removeEventListeners();
      removeTranslation();
    }
  });

  // 更新按钮的 tooltip 及 active 样式
  function updateButtonState() {
    button.title = translationEnabled ? '翻译中' : '启用翻译';
    if (translationEnabled) {
      button.classList.add("active");
    } else {
      button.classList.remove("active");
    }
  }

  // 添加监听：文本选中与点击页面其他区域
  function addEventListeners() {
    document.addEventListener('mouseup', handleTextSelection);
    document.addEventListener('click', handleDocumentClick);
  }
  function removeEventListeners() {
    document.removeEventListener('mouseup', handleTextSelection);
    document.removeEventListener('click', handleDocumentClick);
  }

  // 处理文本选中事件
  function handleTextSelection(e) {
    if (e.target.closest('#translate-toggle')) return;
    const selectionText = window.getSelection().toString().trim();
    if (selectionText) {
      removeTranslation();
      fetchTranslation(selectionText)
        .then(data => {
          insertTranslation(selectionText, data.translation);
        })
        .catch(error => {
          console.error("翻译失败:", error);
          insertTranslation(selectionText, "翻译失败");
        });
    }
  }

  // 点击页面其他区域时，移除翻译结果（不包括按钮区域）
  function handleDocumentClick(e) {
    if (!e.target.closest('#translate-toggle')) {
      removeTranslation();
    }
  }

  // 移除当前插入的翻译结果
  function removeTranslation() {
    if (currentTranslation) {
      currentTranslation.remove();
      currentTranslation = null;
    }
  }

  // 在选中文本后插入翻译结果（仅插入中文翻译，不添加背景框）
  function insertTranslation(originalText, translatedText) {
    const selection = window.getSelection();
    if (!selection.rangeCount) return;
    const range = selection.getRangeAt(0);
    range.collapse(false);
    const fragment = document.createDocumentFragment();
    fragment.appendChild(document.createElement('br'));
    const translationSpan = document.createElement('span');
    translationSpan.className = 'translation-text';
    translationSpan.textContent = translatedText;
    fragment.appendChild(translationSpan);
    range.insertNode(fragment);
    currentTranslation = translationSpan;
  }

  // 调用免费的 Google 翻译接口进行翻译
  async function fetchTranslation(text) {
    const encodedText = encodeURIComponent(text);
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=zh-CN&dt=t&q=${encodedText}`;
    const response = await fetch(url);
    const data = await response.json();
    if (data && Array.isArray(data[0])) {
      let translation = "";
      for (let i = 0; i < data[0].length; i++) {
        translation += data[0][i][0];
      }
      return { translation: translation };
    } else {
      throw new Error("翻译接口返回数据格式错误");
    }
  }

  // 优化后的显示通知信息（Toast 弹窗）
  function showNotification(message) {
    // 查找或创建通知容器
    let container = document.getElementById('notification-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'notification-container';
      document.body.appendChild(container);
    }
    // 创建通知元素
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    container.appendChild(notification);
    
    // 经过一定时间后触发淡出动画，并在动画结束后移除该通知
    setTimeout(() => {
      notification.classList.add('fade-out');
      notification.addEventListener('animationend', () => {
        notification.remove();
        if (container.childElementCount === 0) {
          container.remove();
        }
      });
    }, 2000);
  }

  // 监听 storage 变化，实现多页面状态同步
  chrome.storage.onChanged.addListener(function (changes, area) {
    if (area === 'sync' && changes.translationEnabled) {
      translationEnabled = changes.translationEnabled.newValue;
      updateButtonState();
      if (translationEnabled) {
        addEventListeners();
      } else {
        removeEventListeners();
        removeTranslation();
      }
    }
  });
})();