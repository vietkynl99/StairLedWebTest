function openTab(evt, tabName) {
    var i, tabcontent, tablinks;
    tabcontent = document.getElementsByClassName("tab-content");
    for (i = 0; i < tabcontent.length; i++) {
        tabcontent[i].style.display = "none";
    }
    tablinks = document.getElementsByClassName("tablinks");
    for (i = 0; i < tablinks.length; i++) {
        tablinks[i].className = tablinks[i].className.replace(" active", "");
    }
    document.getElementById(tabName).style.display = "block";
    evt.currentTarget.className += " active";
}

function setBluetoothIcon(connected) {
    const iconElement = document.getElementById('bluetooth-icon');
    iconElement.textContent = connected ? 'bluetooth' : 'bluetooth_disabled';
}

function addToChat(message, color = 'black') {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const secs = now.getSeconds().toString().padStart(2, '0');
    const formattedTime = `[${hours}:${minutes}:${secs}]`;

    const chatMessages = document.getElementById('chatMessages');
    const messageElem = document.createElement('div');
    messageElem.textContent = formattedTime + ' ' + message;
    messageElem.style.color = color;
    chatMessages.appendChild(messageElem);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function updateSlider(id) {
    document.getElementById(id + 'Value').innerText = document.getElementById(id).value;
}

function setEnable(enable) {
    const inputs = document.querySelectorAll('input, select, button');
    inputs.forEach(input => {
        input.disabled = !enable;
    });
    if (enable) {
        document.getElementById('uploadBtn').innerText = 'Update'
    }
}

const enableTimerCb = document.getElementById('enableTimer');
enableTimerCb.addEventListener('change', function () {
  document.getElementById('timerOnTime').style.display = enableTimerCb.checked ? 'inline' : 'none';
  document.getElementById('timerOffTime').style.display = enableTimerCb.checked ? 'inline' : 'none';
  document.getElementById('timeHyphen').style.display = enableTimerCb.checked ? 'inline' : 'none';
})

function showNotification(message, type) {
    const notification = document.getElementById('notification');
    notification.innerText = message;
    notification.className = `notification ${type}`;
    notification.style.display = 'block';
    setTimeout(() => {
        notification.style.display = 'none';
    }, 3000);
}

function loadSettingsToUI(data) {
    if (data.version) {
      document.getElementById('version').innerText = "V" + data.version;
    }
    if (data.stairMode) {
      document.getElementById('stairMode').value = data.stairMode;
    }
    if (data.brightness) {
      document.getElementById('brightness').value = data.brightness;
      document.getElementById('brightnessValue').innerText = data.brightness;
    }
    if (data.fadeTime) {
      document.getElementById('fadeTime').value = data.fadeTime;
      document.getElementById('fadeTimeValue').innerText = data.fadeTime;
    }
    if (data.intervalTime) {
      document.getElementById('intervalTime').value = data.intervalTime;
      document.getElementById('intervalTimeValue').innerText = data.intervalTime;
    }
    if (data.manualWaitTime) {
      document.getElementById('manualWaitTime').value = data.manualWaitTime;
      document.getElementById('manualWaitTimeValue').innerText = data.manualWaitTime;
    }
    if (data.autoWaitTime) {
      document.getElementById('autoWaitTime').value = data.autoWaitTime;
      document.getElementById('autoWaitTimeValue').innerText = data.autoWaitTime;
    }
    if (data.enableTimer) {
      document.getElementById('enableTimer').checked = data.enableTimer;
      document.getElementById('enableTimer').dispatchEvent(new Event('change'));
    }
    if (data.timerOnTime) {
      document.getElementById('timerOnTime').value = data.timerOnTime;
    }
    if (data.timerOffTime) {
      document.getElementById('timerOffTime').value = data.timerOffTime;
    }
    if (data.threshold1) {
      document.getElementById('threshold1').innerText = data.threshold1;
    }
    if (data.threshold2) {
      document.getElementById('threshold2').innerText = data.threshold2;
    }
    if (data.sens1) {
      document.getElementById('sensorSens1').value = data.sens1;
      document.getElementById('sensorSens1Value').innerText = data.sens1;
    }
    if (data.sens2) {
      document.getElementById('sensorSens2').value = data.sens2;
      document.getElementById('sensorSens2Value').innerText = data.sens2;
    }
    showNotification('Cài đặt đã được cập nhật', 'success');
  }