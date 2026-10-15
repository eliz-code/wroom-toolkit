import { ESPLoader, Transport } from 'https://unpkg.com/esptool-js@0.5.7/bundle.js';

// Fill in the public GitHub account/repository after the project is published.
const GITHUB_OWNER = 'eliz-code';
const GITHUB_REPOSITORY = 'wroom-toolkit';
const RELEASE = 'https://api.github.com/repos/' + GITHUB_OWNER + '/' + GITHUB_REPOSITORY + '/releases/tags/v0.1.0';
const EXPECTED_ASSET = 'wroom-toolkit-esp32-wroom32-v0.1.0.bin';
const BAUD_RATE = 460800;

const elements = {
  button: document.querySelector('#connect-button'),
  buttonLabel: document.querySelector('#button-label'),
  title: document.querySelector('#status-title'),
  text: document.querySelector('#status-text'),
  progress: document.querySelector('#progress-wrap'),
  progressLabel: document.querySelector('#progress-label'),
  progressValue: document.querySelector('#progress-value'),
  progressBar: document.querySelector('#progress-bar'),
  log: document.querySelector('#log'),
  steps: [...document.querySelectorAll('.step')],
};

let busy = false;

function setStep(active) {
  for (const step of elements.steps) {
    const number = Number(step.dataset.step);
    step.classList.toggle('active', number === active);
    step.classList.toggle('complete', number < active);
  }
}

function setStatus(title, message, label = 'Подключить устройство') {
  elements.title.textContent = title;
  elements.text.textContent = message;
  elements.buttonLabel.textContent = label;
}

function log(message) {
  elements.log.textContent += message + '\n';
}

function setProgress(label, percent) {
  const value = Math.max(0, Math.min(100, Math.round(percent)));
  elements.progress.hidden = false;
  elements.progressLabel.textContent = label;
  elements.progressValue.textContent = value + '%';
  elements.progressBar.style.width = value + '%';
}

function getSerialApi() {
  if (!('serial' in navigator)) {
    throw new Error('Web Serial недоступен. Откройте страницу в актуальном Chrome или Edge по HTTPS или с localhost.');
  }
  return navigator.serial;
}

function releaseAssetUrl(release) {
  const asset = release.assets.find((item) => item.name === EXPECTED_ASSET);
  if (!asset) {
    throw new Error('В релизе нет файла ' + EXPECTED_ASSET + '. Сначала опубликуйте бинарную прошивку в GitHub Releases.');
  }
  return asset.browser_download_url;
}

function binaryString(bytes) {
  const chunkSize = 0x8000;
  let result = '';
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    result += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return result;
}

async function downloadFirmware() {
  const response = await fetch(RELEASE, { headers: { Accept: 'application/vnd.github+json' } });
  if (!response.ok) {
    throw new Error('Не удалось найти опубликованную прошивку (' + response.status + '). Проверьте адрес GitHub Releases.');
  }
  const release = await response.json();
  const responseBin = await fetch(releaseAssetUrl(release));
  if (!responseBin.ok) throw new Error('Не удалось скачать прошивку (' + responseBin.status + ').');
  const binary = await responseBin.arrayBuffer();
  const image = new Uint8Array(binary);
  if (image.byteLength < 8192 || image.byteLength % 4 !== 0 || image[0x1000] !== 0xe9) {
    throw new Error('Файл релиза не похож на полный объединённый образ ESP32.');
  }
  return image;
}

async function connectAndFlash() {
  if (busy) return;
  busy = true;
  elements.button.disabled = true;
  elements.log.textContent = '';
  elements.progress.hidden = true;

  let port;
  let transport;
  try {
    const serial = getSerialApi();
    port = await serial.requestPort({ filters: [{ usbVendorId: 0x1a86 }] });
    setStep(1);
    setStatus('Порт выбран', 'Загружаю образ прошивки. Не отключай плату.', 'Загрузка...');
    log('USB-UART CH340 выбран.');

    const binary = await downloadFirmware();
    const imageHash = await crypto.subtle.digest('SHA-256', binary);
    const hashText = [...new Uint8Array(imageHash)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
    log('Образ загружен: ' + binary.byteLength + ' байт, SHA-256 ' + hashText);

    transport = new Transport(port, true);
    const loader = new ESPLoader({
      transport,
      baudrate: BAUD_RATE,
      terminal: { clean() {}, writeLine(value) { log(value); }, write(value) { log(value); } },
    });

    setStep(2);
    setStatus('Подключаюсь к ESP32', 'Если соединение не началось, зажми BOOT, нажми EN/RESET, затем отпусти BOOT.', 'Подключение...');
    setProgress('Подключение к чипу', 0);
    const chip = await loader.main();
    if (!String(chip).toUpperCase().includes('ESP32')) {
      throw new Error('Обнаружен чип ' + chip + '; эта сборка предназначена для ESP32-WROOM-32.');
    }
    log('Обнаружен чип: ' + chip);

    setStatus('Записываю прошивку', 'Оставь плату подключённой, пока запись не завершится.', 'Прошивка...');
    await loader.writeFlash({
      // GitHub release asset is a merged image containing bootloader, partition table and app.
      fileArray: [{ data: binaryString(binary), address: 0x0 }],
      flashSize: 'keep',
      eraseAll: false,
      compress: true,
      reportProgress(_fileIndex, written, total) {
        setProgress('Запись прошивки', total ? (written / total) * 100 : 0);
      },
    });

    setProgress('Перезапуск платы', 100);
    await transport.setDTR(false);
    await transport.setRTS(true);
    await new Promise((resolve) => setTimeout(resolve, 100));
    await transport.setRTS(false);
    await transport.disconnect();
    transport = undefined;

    setStep(3);
    setStatus('Готово! Прошивка установлена', 'Плата перезапущена. Открой Serial Monitor на 115200 бод, чтобы начать работу.', 'Прошить ещё раз');
    log('Установка завершена.');
  } catch (error) {
    if (transport) {
      try { await transport.disconnect(); } catch { /* порт уже мог закрыться */ }
    }
    setStatus('Не удалось завершить установку', error instanceof Error ? error.message : String(error), 'Повторить');
    elements.progress.hidden = true;
    log('Ошибка: ' + (error instanceof Error ? error.message : String(error)));
  } finally {
    busy = false;
    elements.button.disabled = false;
  }
}

if (!('serial' in navigator)) {
  setStatus('Нужен Chrome или Edge', 'Web Serial API работает в Chromium-браузерах на защищённой странице HTTPS или localhost.');
}

elements.button.addEventListener('click', connectAndFlash);
