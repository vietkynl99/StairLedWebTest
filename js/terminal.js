// Client -> Server
const BLE_CMD_SEND_CMD = 100;
const BLE_CMD_LOAD_SETTING = 101;
const BLE_CMD_RESTORE_SETTING = 102;

// Server -> Client
const BLE_CMD_RESP_CMD = 150;
const BLE_CMD_LOG = 151;
const BLE_CMD_RESP_SETTING = 152;

let mtuSize = 23;

const toggleConnectionBtn = document.getElementById('toggleConnectionBtn')
const chatInput = document.getElementById('chatInput')

const terminal = new BluetoothTerminal('Stair Led', '013052ff-8771-46a9-89f8-eedbedd76935')

terminal.setMtuSize(mtuSize);

function log(message, type = 'debug') {
    console.log(message)
    addToChat(message, type === 'error' ? 'red' : 'black')
}

function sendCommand(command, data = null, onProgress = null) {
    console.log('send command:', command)
    terminal._sendCommand(command, data, onProgress).
        catch((error) => log(error, 'error'))
}

function loadSettings() {
    if (!terminal.isConnected()) {
        showNotification('Thiết bị chưa được kết nối', 'error');
        return;
    }
    sendCommand(BLE_CMD_LOAD_SETTING);
}

function resetToDefault() {
    if (!terminal.isConnected()) {
        showNotification('Thiết bị chưa được kết nối', 'error');
        return;
    }
    sendCommand(BLE_CMD_RESTORE_SETTING);
    setTimeout(() => {
        sendCommand(BLE_CMD_LOAD_SETTING);
    }, 500);
}

terminal.receive = (command, data) => {
    // console.log('Received command:', command);
    switch (command) {
        case BLE_CMD_RESP_CMD:
        case BLE_CMD_LOG:
            {
                const message = new TextDecoder().decode(data).trim();
                addToChat(message, 'green');
                break;
            }
        case BLE_CMD_RESP_SETTING:
            {
                const message = new TextDecoder().decode(data).trim();
                try {
                    const settings = JSON.parse(message);
                    console.log('settings: ', settings);
                    loadSettingsToUI(settings);
                } catch (error) {
                    console.error(message, ' -> ', error);
                }
                break;
            }
        default:
            console.warn('Unhandled command: ' + command);
            break;
    }
}

terminal._log = log

terminal.onConnectionChanged = function (connected) {
    log('Connection changed to ' + connected)
    setBluetoothIcon(terminal.isConnected())
    if (connected) {
        loadSettings();
    }
}

toggleConnectionBtn.addEventListener('click', () => {
    terminal.connect().
        catch((error) => log(error, 'error'))
})

chatInput.addEventListener('keypress', function (event) {
    if (event.key === 'Enter') {
        const message = chatInput.value.trim()
        if (message) {
            addToChat(message, 'blue');
            sendCommand(BLE_CMD_SEND_CMD, message);

            chatInput.value = ''
        }
    }
})

function updateSetting(commandName, value) {
    if (!terminal.isConnected()) {
        showNotification('Thiết bị chưa được kết nối', 'error');
        return;
    }
    const message = commandName + ' ' + value
    addToChat(message, 'blue');
    sendCommand(BLE_CMD_SEND_CMD, message);
};

const idList = ['brightness', 'fadeTime', 'intervalTime', 'manualWaitTime', 'autoWaitTime', 'timerOnTime', 'timerOffTime'];
const cmdNameList = ['set-brightness-percent', 'set-fade-time', 'set-interval-time', 'set-manual-wait-time', 'set-auto-wait-time', 'set-timer-on-time', 'set-timer-off-time'];
for (let i = 0; i < idList.length; i++) {
    document.getElementById(idList[i]).addEventListener('change', function (event) {
        updateSetting(cmdNameList[i], event.target.value);
    });
}

document.getElementById('stairMode').addEventListener('change', function (event) {
    updateSetting('set-mode', event.target.value == 'auto' ? 2 : 1);
});

document.getElementById('enableTimer').addEventListener('change', function (event) {
    updateSetting('set-enable-timer', event.target.checked ? 1 : 0);
});