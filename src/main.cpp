#include <Arduino.h>
#include <WiFi.h>
#include <esp_system.h>

namespace {
constexpr uint32_t kSerialBaud = 115200;

void printMenu() {
  Serial.println();
  Serial.println(F("=== WROOM Toolkit ==="));
  Serial.println(F("i - сведения об устройстве"));
  Serial.println(F("w - сканировать Wi-Fi сети рядом"));
  Serial.println(F("m - показать это меню"));
}

void printDeviceInfo() {
  Serial.println();
  Serial.println(F("--- Устройство ---"));
  Serial.printf("Чип: %s, ревизия %u\n", ESP.getChipModel(), ESP.getChipRevision());
  Serial.printf("Ядра: %u\n", ESP.getChipCores());
  Serial.printf("Частота CPU: %u МГц\n", ESP.getCpuFreqMHz());
  Serial.printf("Flash: %u байт\n", ESP.getFlashChipSize());
  Serial.printf("Свободная heap: %u байт\n", ESP.getFreeHeap());
  Serial.printf("Время работы: %lu с\n", static_cast<unsigned long>(millis() / 1000));
  Serial.printf("Причина перезапуска: %d\n", static_cast<int>(esp_reset_reason()));
}

const char *encryptionName(wifi_auth_mode_t mode) {
  switch (mode) {
    case WIFI_AUTH_OPEN: return "открытая";
    case WIFI_AUTH_WEP: return "WEP";
    case WIFI_AUTH_WPA_PSK: return "WPA";
    case WIFI_AUTH_WPA2_PSK: return "WPA2";
    case WIFI_AUTH_WPA_WPA2_PSK: return "WPA/WPA2";
    case WIFI_AUTH_WPA2_ENTERPRISE: return "WPA2 Enterprise";
    case WIFI_AUTH_WPA3_PSK: return "WPA3";
    case WIFI_AUTH_WPA2_WPA3_PSK: return "WPA2/WPA3";
    case WIFI_AUTH_WAPI_PSK: return "WAPI";
    default: return "неизвестно";
  }
}

void scanWifi() {
  Serial.println(F("Сканирую Wi-Fi сети. Только приём, передача пакетов не выполняется."));
  WiFi.mode(WIFI_STA);
  WiFi.disconnect();
  const int count = WiFi.scanNetworks(false, true);
  if (count < 0) {
    Serial.println(F("Не удалось выполнить сканирование."));
    WiFi.scanDelete();
    return;
  }
  if (count == 0) Serial.println(F("Сети не найдены."));
  for (int i = 0; i < count; ++i) {
    Serial.printf("%2d. ", i + 1);
    const String ssid = WiFi.SSID(i);
    for (size_t j = 0; j < ssid.length(); ++j) {
      const char c = ssid[j];
      Serial.write(c >= 0x20 && c != 0x7f ? c : '?');
    }
    Serial.printf(" | RSSI %d dBm | канал %d | %s\n", WiFi.RSSI(i), WiFi.channel(i), encryptionName(WiFi.encryptionType(i)));
  }
  WiFi.scanDelete();
}
}  // namespace

void setup() {
  Serial.begin(kSerialBaud);
  delay(300);
  Serial.println(F("WROOM Toolkit запускается. Serial Monitor: 115200 бод."));
  printMenu();
}

void loop() {
  if (!Serial.available()) { delay(10); return; }
  const char command = static_cast<char>(Serial.read());
  switch (command) {
    case 'i': case 'I': printDeviceInfo(); break;
    case 'w': case 'W': scanWifi(); break;
    case 'm': case 'M': case '?': printMenu(); break;
    case '\r': case '\n': break;
    default: Serial.println(F("Неизвестная команда. Нажмите m для меню.")); break;
  }
}
