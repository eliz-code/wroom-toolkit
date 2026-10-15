param(
  [string]$Environment = "esp32dev",
  [string]$Version = "v0.1.0"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$env:PLATFORMIO_PROJECT_DIR = $root

pio run -e $Environment
pio pkg install -e $Environment
$build = Join-Path $root ".pio\build\$Environment"
$output = Join-Path $root "webflasher\wroom-toolkit-esp32-wroom32-$Version.bin"
$bootloader = Join-Path $build "bootloader.bin"
$partitions = Join-Path $build "partitions.bin"
$application = Join-Path $build "$Environment.bin"
esptool.py --chip esp32 merge_bin -o $output --flash_mode dio --flash_freq 40m --flash_size 4MB 0x1000 $bootloader 0x8000 $partitions 0x10000 $application
Write-Host "Web installer image: $output"
