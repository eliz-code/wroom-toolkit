# WROOM Toolkit

Прошивка и веб-установщик для ESP32-WROOM-32 с USB-UART CH340C.

## Web Flasher

Откройте каталог webflasher через localhost или HTTPS в Chrome/Edge. Установщик использует Web Serial, выбирает CH340C и записывает полный объединённый образ ESP32. Перед прошивкой закройте Serial Monitor.

## Прошивка

Соберите проект PlatformIO в среде esp32dev. Для веб-релиза объедините bootloader, partitions и приложение с помощью tools/build-web-release.ps1. Бинарник релиза должен называться wroom-toolkit-esp32-wroom32-v0.1.0.bin.

## Команды Serial Monitor

- i — информация о чипе
- w — пассивное сканирование Wi-Fi
- m — меню
