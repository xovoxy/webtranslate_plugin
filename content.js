(function () {
  let translationEnabled = false;
  // 使用数组保存所有已插入的翻译文本
  let currentTranslations = [];
  // 记录鼠标按下时的位置
  let mouseDownPos = { x: 0, y: 0 };
  // 标志：判断鼠标操作是否为拖拽选择文本（拖拽距离超过阈值时认为是选择）
  let isDragSelection = false;
  let deepSeekToken = '';
  let translator = 'google'; // 默认使用Google翻译

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

  // 监听鼠标按下，记录起始坐标
  document.addEventListener('mousedown', function (e) {
    mouseDownPos = { x: e.clientX, y: e.clientY };
  });

  chrome.storage.sync.get(['translationEnabled', 'deepSeekToken', 'translator'], function (result) {
    translationEnabled = result.translationEnabled || false;
    deepSeekToken = result.deepSeekToken || '';
    translator = result.translator || 'google';
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
      // 当关闭自动翻译时，也清除所有翻译
      removeAllTranslations();
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
    document.addEventListener('keydown', handleAltTShortcut);
  }

  function removeEventListeners() {
    document.removeEventListener('mouseup', handleTextSelection);
    document.removeEventListener('click', handleDocumentClick);
    document.removeEventListener('keydown', handleAltTShortcut);
  }

  function handleTextSelection(e) {
    if (e.target.closest('input, textarea, [contenteditable="true"]')) return;
    if (e.target.closest('#translate-toggle')) return;

    // 计算鼠标拖拽距离，判断是否为选择操作
    const mouseUpPos = { x: e.clientX, y: e.clientY };
    const dx = mouseUpPos.x - mouseDownPos.x;
    const dy = mouseUpPos.y - mouseDownPos.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    // 如果拖拽距离大于5像素，则认为是文本选择操作
    isDragSelection = distance > 5;

    const selectionText = window.getSelection().toString().trim();
    if (selectionText) {
      fetchTranslation(selectionText)
        .then(data => insertTranslation(selectionText, data.translation))
        .catch(error => {
          console.error("翻译失败:", error);
          showNotification(error.message);
          insertTranslation(selectionText, "翻译失败");
        });
    }
  }

  // 点击页面其他区域时，移除所有翻译文本
  function handleDocumentClick(e) {
    // 如果上一次操作是拖拽选择，则忽略这次点击（只重置标志）
    if (isDragSelection) {
      isDragSelection = false;
      return;
    }
    if (!e.target.closest('#translate-toggle') && !e.target.closest('.translation-container')) {
      removeAllTranslations();
    }
  }

  // 移除所有插入的翻译文本
  function removeAllTranslations() {
    currentTranslations.forEach(translation => translation.remove());
    currentTranslations = [];
  }

  // 在选中文本后插入翻译结果（使用容器包装）
  function insertTranslation(originalText, translatedText) {
    if (currentTranslations.some(container => container.dataset.originalText === originalText)) return;

    const selection = window.getSelection();
    if (!selection.rangeCount) return;
    const range = selection.getRangeAt(0);
    // 将光标定位到选区末尾，保证插入内容出现在原文本之后
    range.collapse(false);

    // 创建容器包装中文翻译
    const container = document.createElement('div');
    container.className = 'translation-container';
    container.dataset.originalText = originalText;

    // 创建显示中文翻译的元素
    const translationSpan = document.createElement('span');
    translationSpan.className = 'translation-text';
    translationSpan.textContent = translatedText;
    container.appendChild(translationSpan);

    // 在原文本后的光标位置插入翻译容器
    range.insertNode(container);
    currentTranslations.push(container);
  }

  async function fetchTranslation(text, targetLang = 'zh-CN') {
    if (translator === 'deepseek') {
      return fetchDeepSeekTranslation(text, targetLang);
    } else {
      return fetchGoogleTranslation(text, targetLang);
    }
  }

  // DeepSeek翻译函数
  async function fetchDeepSeekTranslation(text, targetLang) {
    if (!deepSeekToken) {
      throw new Error("请先在扩展设置中配置DeepSeek API Token");
    }

    const langMap = {
      'zh-CN': 'Chinese',
      'en': 'English'
    };
    const targetLanguage = langMap[targetLang] || 'Chinese';

    try {
      const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${deepSeekToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: `You are a translator. Translate the following text to ${targetLanguage} accurately and naturally.` },
            { role: 'user', content: text }
          ],
          temperature: 1.3,
          max_tokens: 1000
        })
      });

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      const data = await response.json();
      if (data.choices && data.choices.length > 0) {
        return { translation: data.choices[0].message.content.trim() };
      } else {
        throw new Error("DeepSeek API 返回数据格式错误");
      }
    } catch (error) {
      throw new Error(`DeepSeek翻译失败: ${error.message}`);
    }
  }

  // Google翻译函数
  async function fetchGoogleTranslation(text, targetLang = 'zh-CN') {
    const encodedText = encodeURIComponent(text);
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodedText}`;
    try {
      const response = await fetch(url);
      const data = await response.json();
      if (data && Array.isArray(data[0])) {
        let translation = "";
        for (let i = 0; i < data[0].length; i++) {
          translation += data[0][i][0];
        }
        return { translation: translation };
      } else {
        throw new Error("Google翻译接口返回数据格式错误");
      }
    } catch (error) {
      throw new Error(`Google翻译失败: ${error.message}`);
    }
  }

  // 处理输入框/可编辑区域失焦时的翻译
  function simulateUserInput(target, newText) {
    target.focus();
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
      let currentIndex = 0;
      function inputNextCharacter() {
        if (currentIndex < newText.length) {
          const newChar = newText.slice(0, currentIndex + 1);
          target.setRangeText(newChar, 0, target.value.length, 'end');
          // 分发 InputEvent 和 Change 事件
          target.dispatchEvent(new InputEvent('input', { bubbles: true }));
          target.dispatchEvent(new Event('change', { bubbles: true }));
          currentIndex++;
          setTimeout(inputNextCharacter, 100);
        }
      }
      inputNextCharacter();
    } else if (target.isContentEditable) {
      let currentIndex = 0;
      // 每次插入一个字符
      function inputNextCharacter() {
        if (currentIndex < newText.length) {
          const newChar = newText.slice(0, currentIndex + 1);
          document.execCommand('selectAll', false, null);
          const selection = window.getSelection();
          const range = selection.getRangeAt(0);
          range.deleteContents();
          const textNode = document.createTextNode(newChar);
          range.insertNode(textNode);
          target.dispatchEvent(new InputEvent('input', { bubbles: true }));
          target.dispatchEvent(new Event('change', { bubbles: true }));
          currentIndex++;
          setTimeout(inputNextCharacter, 100);
        }
      }
      inputNextCharacter();
    }
  }

  function handleAltTShortcut(e) {
    if (e.altKey && e.keyCode === 84) {
      e.preventDefault();
      const target = e.target;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        let text = '';
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') text = target.value.trim();
        else if (target.isContentEditable) text = target.textContent.trim();
        if (text && /[\u4e00-\u9fa5]/.test(text)) {
          fetchTranslation(text, 'en')
            .then(data => setTimeout(() => simulateUserInput(target, data.translation), 0))
            .catch(error => {
              console.error("输入区域翻译失败:", error);
              showNotification(error.message);
            });
        }
      }
    }
  }

  // 优化后的显示通知信息（Toast 弹窗）
  function showNotification(message) {
    let container = document.getElementById('notification-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'notification-container';
      document.body.appendChild(container);
    }
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    container.appendChild(notification);

    setTimeout(() => {
      notification.classList.add('fade-out');
      notification.addEventListener('animationend', () => {
        notification.remove();
        if (container.childElementCount === 0) container.remove();
      });
    }, 2000);
  }

  // 监听 storage 变化，实现多页面状态同步
  chrome.storage.onChanged.addListener(function (changes, area) {
    if (area === 'sync') {
      if (changes.translationEnabled) {
        translationEnabled = changes.translationEnabled.newValue;
        updateButtonState();
        if (translationEnabled) addEventListeners();
        else {
          removeEventListeners();
          removeAllTranslations();
        }
      }
      if (changes.deepSeekToken) deepSeekToken = changes.deepSeekToken.newValue;
      if (changes.translator) translator = changes.translator.newValue;
    }
  });
})();