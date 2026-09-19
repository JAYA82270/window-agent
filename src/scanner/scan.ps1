$ErrorActionPreference = 'SilentlyContinue'
$result = @{}
try { $result.deviceUuid = (Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Cryptography' -Name MachineGuid).MachineGuid } catch { $result.deviceUuid = '' }
$result.computerName = $env:COMPUTERNAME
$result.username = $env:USERNAME
try { $net = Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '127.*' } | Select-Object -First 1; $result.ipAddress = if ($net) { $net.IPAddress } else { '' } } catch { $result.ipAddress = '' }
try { $adapter = Get-NetAdapter | Where-Object Status -eq Up | Select-Object -First 1; $result.macAddress = if ($adapter) { $adapter.MacAddress } else { '' } } catch { $result.macAddress = '' }
try { $os = Get-CimInstance Win32_OperatingSystem; $result.osEdition=$os.Caption; $result.osVersion=$os.Version; $result.buildNumber=$os.BuildNumber; $result.architecture=$os.OSArchitecture; $result.ram="$([math]::Round($os.TotalVisibleMemorySize / 1MB, 1)) GB" } catch {}
try { $result.cpu = (Get-CimInstance Win32_Processor | Select-Object -First 1).Name } catch {}
try { $result.disk = ((Get-CimInstance Win32_DiskDrive | ForEach-Object { "$($_.Model) - $([math]::Round($_.Size / 1GB, 1)) GB" }) -join '; ') } catch {}
try { $vol = Get-BitLockerVolume | Select-Object -First 1; $result.bitlocker = @{ enabled=($vol.ProtectionStatus -eq 'On'); percentage=$vol.EncryptionPercentage; protectionStatus=[string]$vol.ProtectionStatus; method=[string]$vol.EncryptionMethod } } catch { $result.bitlocker=@{enabled=$false;percentage=0;protectionStatus='Unknown';method='Unknown'} }
try { $fw=Get-NetFirewallProfile; $result.firewall=($fw | Where-Object Enabled).Count -gt 0 } catch { $result.firewall=$false }
try { $result.secureBoot = [bool](Confirm-SecureBootUEFI) } catch { $result.secureBoot=$false }
try { $defender=Get-CimInstance -Namespace Root\Microsoft\Windows\Defender -Class MSFT_MpComputerStatus; $result.defenderEnabled=$defender.AntivirusEnabled; $result.defenderRealTime=$defender.RealTimeProtectionEnabled; $result.defenderVersion=$defender.AMProductVersion } catch { $result.defenderEnabled=$false; $result.defenderRealTime=$false }
try { $result.windowsActivated=((Get-CimInstance SoftwareLicensingProduct -Filter "Name like 'Windows%%'" | Where-Object PartialProductKey | Select-Object -First 1).LicenseStatus -eq 1) } catch { $result.windowsActivated=$false }

try {
  $softwareMap = @{}
  $registryPaths = @(
    'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*',
    'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*',
    'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*'
  )

  foreach ($path in $registryPaths) {
    Get-ItemProperty $path -ErrorAction SilentlyContinue | ForEach-Object {
      $name = [string]$_.DisplayName
      if ([string]::IsNullOrWhiteSpace($name)) { return }
      if ($_.SystemComponent -eq 1) { return }
      if (-not [string]::IsNullOrWhiteSpace([string]$_.ParentKeyName)) { return }
      if ($name -match '^(KB[0-9]{6,7}|Update for|Security Update for|Hotfix for)') { return }

      $version = [string]$_.DisplayVersion
      if ([string]::IsNullOrWhiteSpace($version)) { $version = '' }
      $publisher = [string]$_.Publisher
      if ([string]::IsNullOrWhiteSpace($publisher)) { $publisher = '' }

      $key = "$name|$version"
      if (-not $softwareMap.ContainsKey($key)) {
        $softwareMap[$key] = @{
          name = $name.Trim()
          version = $version.Trim()
          publisher = $publisher.Trim()
        }
      }
    }
  }

  $result.installedSoftware = @($softwareMap.Values | Sort-Object { $_.name } | Select-Object -First 500)

  $passwordManagerPattern = '1Password|LastPass|Bitwarden|Dashlane|Keeper|NordPass|RoboForm|Enpass|KeePass|Password Manager'
  $result.passwordManager = $false
  foreach ($app in $result.installedSoftware) {
    if ($app.name -match $passwordManagerPattern) {
      $result.passwordManager = $true
      break
    }
  }
} catch {
  $result.installedSoftware = @()
  $result.passwordManager = $false
}

$result | ConvertTo-Json -Depth 8 -Compress
