// 加载保存的设置
chrome.storage.sync.get(['deepSeekToken', 'translator'], function(result) {
    const translatorSelect = document.getElementById('translatorSelect');
    const tokenSection = document.getElementById('tokenSection');
    const tokenInput = document.getElementById('tokenInput');
  
    translatorSelect.value = result.translator || 'google';
    tokenInput.value = result.deepSeekToken || '';
  
    // 根据初始选择显示或隐藏Token输入框
    tokenSection.style.display = translatorSelect.value === 'deepseek' ? 'block' : 'none';
  });
  
  // 保存设置函数
  function saveSettings() {
    const token = document.getElementById('tokenInput').value.trim();
    const translator = document.getElementById('translatorSelect').value;
    chrome.storage.sync.set({ 
      deepSeekToken: token,
      translator: translator 
    }, function() {
      const status = document.getElementById('status');
      status.textContent = '设置已保存';
      setTimeout(() => status.textContent = '', 2000);
    });
  }
  
  // 监听翻译接口选择变化并自动保存
  document.getElementById('translatorSelect').addEventListener('change', function() {
    const tokenSection = document.getElementById('tokenSection');
    tokenSection.style.display = this.value === 'deepseek' ? 'block' : 'none';
    saveSettings(); // 切换时自动保存
  });
  
  // 监听Token输入变化并自动保存
  document.getElementById('tokenInput').addEventListener('input', function() {
    saveSettings(); // 输入时自动保存
  });
  
  // 切换Token显示状态
  const tokenInput = document.getElementById('tokenInput');
  const toggleVisibility = document.getElementById('toggleVisibility');
  let isVisible = false;
  
  toggleVisibility.addEventListener('click', function() {
    isVisible = !isVisible;
    tokenInput.type = isVisible ? 'text' : 'password';
    toggleVisibility.classList.toggle('hidden', isVisible);
  });