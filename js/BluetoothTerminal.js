const BLE_CMD_START_BYTE = 0xC0;

/**
 * Bluetooth Terminal class.
 */
class BluetoothTerminal {
  /**
   * Create preconfigured Bluetooth Terminal instance.
   * @param {!(number|string)} [serviceUuid=0xFFE0] - Service UUID
   * @param {string} [receiveSeparator='\n'] - Receive separator
   * @param {string} [sendSeparator='\n'] - Send separator
   */
  constructor(deviceName, serviceUuid, receiveSeparator = '\n', sendSeparator = '\n') {
    // Used private variables.
    this._deviceName = deviceName;
    this._serviceUuid = serviceUuid;
    this._receiveSeparator = receiveSeparator;
    this._sendSeparator = sendSeparator;

    this._debug = false;
    this._connected = false;
    this._mtuSize = 23; // Max characteristic value length.
    this._receiveTimeout = 500; // Receive timeout
    this._device = null; // Device object cache.
    this._characteristic = null; // Characteristic object cache.
    this._resetReceiveBuffer();

    // Bound functions used to add and remove appropriate event handlers.
    this._boundHandleDisconnection = this._handleDisconnection.bind(this);
    this._boundHandleCharacteristicValueChanged = this._handleCharacteristicValueChanged.bind(this);
  }

  /**
   * Launch Bluetooth device chooser and connect to the selected device.
   * @return {Promise} Promise which will be fulfilled when notifications will
   *                   be started or rejected if something went wrong
   */
  connect() {
    return this._connectToDevice(this._device);
  }

  /**
   * Disconnect from the connected device.
   */
  disconnect() {
    this._disconnectFromDevice(this._device);

    if (this._characteristic) {
      this._characteristic.removeEventListener('characteristicvaluechanged',
        this._boundHandleCharacteristicValueChanged);
      this._characteristic = null;
    }

    this._device = null;
  }

  /**
   * 
   * @returns {boolean} Connection state
   */
  isConnected() {
    return this._connected;
  }

  /**
   * 
   * @returns {size} MTU size
   */
  getMtuSize() {
    return this._mtuSize;
  }

  /**
   * 
   * @param {size} size 
   */
  setMtuSize(size) {
    this._mtuSize = size;
  }
  /**
   * 
   * @param {boolean} connected 
   */
  onConnectionChanged(connected) {
  }

  /**
   * Data receiving handler which called whenever the new data comes from
   * the connected device, override it to handle incoming data.
   * @param {number} command - Command
   * @param {Uint8Array} data - Data
   */
  receive(command, data) {
    // Handle incoming data.
  }

  /**
   * Send data to the connected device.
   * @param {Uint8Array} data - Data
   * @return {Promise} Promise which will be fulfilled when data will be sent or
   *                   rejected if something went wrong
   */
  send(data, onProgress = null) {
    // Return rejected promise immediately if data is empty.
    if (!data) {
      return Promise.reject(new Error('Data must be not empty'));
    }

    // Return rejected promise immediately if there is no connected device.
    if (!this._connected) {
      return Promise.reject(new Error('There is no connected device'));
    }

    const buffer = new Uint8Array(data).buffer;

    const chunkSize = this._mtuSize - 3;
    let chunks = [];
    for (let i = 0; i < buffer.byteLength; i += chunkSize) {
      chunks.push(buffer.slice(i, i + chunkSize));
    }

    const startTime = performance.now();
    let totalChunks = chunks.length;
    let sentChunks = 0;

    let promise = this._writeToCharacteristic(this._characteristic, chunks[0]).
      then(() => {
        sentChunks++;
        const percent = Math.floor((sentChunks / totalChunks) * 100);
        if (onProgress) onProgress(percent);
      });

    // Iterate over chunks if there are more than one of it.
    for (let i = 1; i < chunks.length; i++) {
      // Chain new promise.
      promise = promise.then(() => new Promise((resolve, reject) => {
        // Reject promise if the device has been disconnected.
        if (!this._characteristic) {
          reject(new Error('Device has been disconnected'));
        }

        // Write chunk to the characteristic and resolve the promise.
        this._writeToCharacteristic(this._characteristic, chunks[i])
          .then(() => {
            sentChunks++;
            const percent = Math.floor((sentChunks / totalChunks) * 100);
            if (onProgress) onProgress(percent);
            resolve();
          })
          .catch(reject);
      }));
    }

    return promise.then(() => {
      // const endTime = performance.now();
      // const timeTaken = endTime - startTime;
      // const sizeKB = data.length / 1024;
      // const KBps = sizeKB * 1000 / timeTaken;
      // const formatedSize = sizeKB ? Math.round(sizeKB) + "KB" : data.length + "B";
      // console.log(`Size ${Math.round(data.length)}B, time taken: ${Math.round(timeTaken)}ms (${Math.round(KBps)}KB/s)`);
    }).catch(error => {
      throw error;
    });
  }

  /**
   * Get the connected device name.
   * @return {string} Device name or empty string if not connected
   */
  getDeviceName() {
    if (!this._device) {
      return '';
    }

    return this._device.name;
  }

  _sendCommand(command, data = null, onProgress = null) {
    let dataSize = data != null ? data.length : 0;
    let byteArray = [];
    byteArray.push(BLE_CMD_START_BYTE);
    byteArray.push(command);
    byteArray.push((dataSize >> 24) & 0xFF);
    byteArray.push((dataSize >> 16) & 0xFF);
    byteArray.push((dataSize >> 8) & 0xFF);
    byteArray.push(dataSize & 0xFF);
    for (let i = 0; i < dataSize; i++) {
      byteArray.push(data.charCodeAt(i));
    }

    let crc = 0;
    for (let i = 0; i < byteArray.length; i++) {
      crc ^= byteArray[i];
    }
    byteArray.push(crc);

    return this.send(byteArray, onProgress);
  }

  /**
   * 
   * @param {boolean} connected 
   */
  _setConnected(connected) {
    if (this._connected != connected) {
      this._connected = connected;
      this.onConnectionChanged(connected);
    }
  }

  /**
   * Connect to device.
   * @param {Object} device
   * @return {Promise}
   * @private
   */
  _connectToDevice(device) {
    return (device ? Promise.resolve(device) : this._requestBluetoothDevice()).
      then((device) => this._connectCharacteristics(device)).
      catch((error) => {
        this._log(error, 'error');
        return Promise.reject(error);
      });
  }

  /**
   * Disconnect from device.
   * @param {Object} device
   * @private
   */
  _disconnectFromDevice(device) {
    if (!device) {
      return;
    }

    this._log('Disconnecting from "' + device.name + '" bluetooth device...');

    device.removeEventListener('gattserverdisconnected',
      this._boundHandleDisconnection);

    if (!device.gatt.connected) {
      this._log('"' + device.name +
        '" bluetooth device is already disconnected');
      return;
    }

    device.gatt.disconnect();

    this._log('"' + device.name + '" bluetooth device disconnected');
  }

  /**
   * Request bluetooth device.
   * @return {Promise}
   * @private
   */
  _requestBluetoothDevice() {
    this._log('Requesting bluetooth device...');

    return navigator.bluetooth.requestDevice({
      filters: [{name: this._deviceName}],
      optionalServices: [this._serviceUuid],
    }).
      then((device) => {
        this._log('"' + device.name + '" bluetooth device selected');

        this._device = device; // Remember device.
        this._device.addEventListener('gattserverdisconnected',
          this._boundHandleDisconnection);

        return this._device;
      });
  }

  /**
   * Connect device and cache characteristic.
   * @param {Object} device
   * @return {Promise}
   * @private
   */
  _connectCharacteristics(device) {
    // Check remembered characteristic.
    if (device.gatt.connected && this._characteristic) {
      return Promise.resolve();
    }

    this._log('Connecting to GATT server...')

    return device.gatt.connect().
      then((server) => {
        this._log('GATT server connected')
        return server.getPrimaryService(this._serviceUuid)
      }).
      then((service) => {
        return service.getCharacteristics();
      }).
      then((characteristics) => {
        this._log(`Found ${characteristics.length} characteristics`)
        if (!characteristics.length) {
          reject(new Error('Characteristics size is invalid'));
        }
        this._characteristic = characteristics[0]
        return this._characteristic.startNotifications()
      }).
      then(() => {
        this._log('Notifications started');
        this._characteristic.addEventListener('characteristicvaluechanged',
          this._boundHandleCharacteristicValueChanged);
        this._setConnected(true);
      }
      )
  }

  /**
   * Stop notifications.
   * @param {Object} characteristic
   * @return {Promise}
   * @private
   */
  _stopNotifications(characteristic) {
    this._log('Stopping notifications...');

    return characteristic.stopNotifications().
      then(() => {
        this._log('Notifications stopped');

        characteristic.removeEventListener('characteristicvaluechanged',
          this._boundHandleCharacteristicValueChanged);
      });
  }

  /**
   * Handle disconnection.
   * @param {Object} event
   * @private
   */
  _handleDisconnection(event) {
    const device = event.target;
    this._log('"' + device.name +
      '" bluetooth device disconnected, trying to reconnect...');

    this._setConnected(false);

    this._connectCharacteristics(device).
      catch((error) => this._log(error, 'error'));
  }

  /**
   * Handle characteristic value changed.
   * @param {Object} event
   * @private
   */
  _handleCharacteristicValueChanged(event) {
    const value = event.target.value;
    const byteArray = new Uint8Array(value.buffer);
    const size = byteArray.length;

    if (size == 0) {
      return;
    }

    if ((!this._receiveBuffer.isReceiving || new Date().getTime() - this._receiveBuffer.lastTime > this._receiveTimeout) &&
      byteArray.length > 6 &&
      byteArray[0] == BLE_CMD_START_BYTE) {
      this._receiveBuffer.command = byteArray[1];
      this._receiveBuffer.dataSize = (byteArray[2] << 24) | (byteArray[3] << 16) | (byteArray[4] << 8) | byteArray[5];
      this._receiveBuffer.receivedSize = size;
      this._receiveBuffer.data = new Uint8Array(byteArray.buffer);
      this._receiveBuffer.crc = 0;
      this._receiveBuffer.isReceiving = this._receiveBuffer.receivedSize < this._receiveBuffer.dataSize + 7;
      if (this._receiveBuffer.receivedSize > this._receiveBuffer.dataSize + 7) {
        console.error('Error occured');
        this._resetReceiveBuffer();
        return;
      }
      this._receiveBuffer.lastTime = new Date().getTime();
      if (this._debug) {
        console.log('Starting receive cmd ', this._receiveBuffer.command);
      }
    }
    else if (this._receiveBuffer.isReceiving) {
      this._receiveBuffer.receivedSize += size;
      this._receiveBuffer.data = new Uint8Array([...this._receiveBuffer.data, ...new Uint8Array(byteArray.buffer)]);
      this._receiveBuffer.lastTime = new Date().getTime();
    }
    else {
      console.error('Error occured');
      this._resetReceiveBuffer();
      return;
    }

    for (let i = 0; i < size; i++) {
      this._receiveBuffer.crc ^= byteArray[i];
    }

    if (this._debug) {
      console.log("Receiving cmd " + this._receiveBuffer.command +
        ", receivedSize " + this._receiveBuffer.receivedSize +
        ", dataSize " + this._receiveBuffer.dataSize);
    }

    // Receive done
    if (this._receiveBuffer.receivedSize == this._receiveBuffer.dataSize + 7) {
      if (this._receiveBuffer.crc != 0) {
        console.error('CRC error ' + this._receiveBuffer.crc);
      }
      else {
        this._receiveBuffer.data = this._receiveBuffer.data.slice(6, -1);
        if (this._receiveBuffer.data.length != this._receiveBuffer.dataSize) {
          console.error('Invalid data size ' + this._receiveBuffer.data.length + ', expected ' + this._receiveBuffer.dataSize);
        }
        else {
          if (this._debug) {
            console.log("Received " + this._receiveBuffer.receivedSize + "bytes, cmd " + this._receiveBuffer.command +
              ", dataSize " + this._receiveBuffer.dataSize + ", data.length " + this._receiveBuffer.data.length);
          }
          this.receive(this._receiveBuffer.command, this._receiveBuffer.data);
        }
      }
      this._resetReceiveBuffer();
    }
    else if (this._receiveBuffer.receivedSize > this._receiveBuffer.dataSize + 7) {
      console.error('Error occured');
      this._resetReceiveBuffer();
      return;
    }
  }

  _resetReceiveBuffer() {
    this._receiveBuffer = {
      isReceiving: false,
      command: 0,
      data: null,
      dataSize: 0,
      receivedSize: 0,
      lastTime: new Date().getTime()
    }
  }

  /**
   * Write to characteristic.
   * @param {Object} characteristic
   * @param {string} data
   * @return {Promise}
   * @private
   */
  _writeToCharacteristic(characteristic, data) {
    return characteristic.writeValueWithResponse(data);
    // return characteristic.writeValueWithoutResponse(data);
  }

  /**
   * Log.
   * @param {Array} messages
   * @private
   */
  _log(message, type = 'debug') {
    console.log(message); // eslint-disable-line no-console
  }
}

// Export class as a module to support requiring.
/* istanbul ignore next */
if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
  module.exports = BluetoothTerminal;
}
