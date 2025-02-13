(function () {
    let translationEnabled = false;
    let currentTranslation = null;
  
    // 创建图标按钮，内嵌 SVG 图标
    const button = document.createElement('button');
    button.id = 'translate-toggle';
    button.title = '启用翻译'; // 初始 tooltip 提示
    button.innerHTML = `
      <svg width="48" height="48" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
        <circle class="bg-circle" cx="24" cy="24" r="22" fill="#2575FC"/>
        <text x="24" y="21" text-anchor="middle" dominant-baseline="middle" font-family="Arial" font-size="14" fill="white">A</text>
        <text x="24" y="33" text-anchor="middle" dominant-baseline="middle" font-family="Arial" font-size="14" fill="white">中</text>
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
  
    // 直接在选中文本后插入换行和翻译文本（仅插入中文翻译，不添加背景框）
    function insertTranslation(originalText, translatedText) {
      const selection = window.getSelection();
      if (!selection.rangeCount) return;
      const range = selection.getRangeAt(0);
      range.collapse(false);
      // 创建文档片段，包含换行和翻译文本
      const fragment = document.createDocumentFragment();
      fragment.appendChild(document.createElement('br'));
      const translationSpan = document.createElement('span');
      translationSpan.className = 'translation-text';
      // 直接设置文本内容，采用 inherit 使其与原文样式一致
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
  
    // 显示通知信息（Toast 弹窗）
    function showNotification(message) {
      const notification = document.createElement('div');
      notification.className = 'notification';
      notification.textContent = message;
      document.body.appendChild(notification);
      setTimeout(() => {
        notification.classList.add('fade-out');
        setTimeout(() => {
          notification.remove();
        }, 500);
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