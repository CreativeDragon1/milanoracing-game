param([Parameter(Mandatory=$true)][string]$JobPath,[switch]$TestMode)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Net.Http
Add-Type -AssemblyName System.IO.Compression.FileSystem
$job=Get-Content -LiteralPath $JobPath -Raw | ConvertFrom-Json
$install=[IO.Path]::GetFullPath([string]$job.install).TrimEnd('\')
$cache=[IO.Path]::GetFullPath((Join-Path $install '.milano-update'))
if ([IO.Path]::GetDirectoryName([IO.Path]::GetFullPath($JobPath)) -ne $cache) { throw 'Invalid update job location' }
if (-not (Test-Path -LiteralPath (Join-Path $install 'Milano Apex.exe'))) { throw 'Game executable missing' }
$feed=[Uri]$job.feed
if ($feed.AbsoluteUri -ne 'https://game.milanoracing.team/updates/windows.json' -and -not ($TestMode -and $feed.IsLoopback -and $feed.Scheme -eq 'http')) { throw 'Untrusted update host' }
$mutexId=[BitConverter]::ToString([Security.Cryptography.SHA256]::Create().ComputeHash([Text.Encoding]::UTF8.GetBytes($install.ToLowerInvariant()))).Replace('-','')
$mutex=New-Object Threading.Mutex($false,('Local\MilanoUpdate-'+$mutexId))
if (-not $mutex.WaitOne(0)) { $mutex.Dispose(); exit 0 }
$client=$null;$parent=$null
function Status([string]$state,[string]$detail='') {
 $temp=Join-Path $cache 'status.tmp';@{state=$state;detail=$detail} | ConvertTo-Json -Compress | Set-Content -LiteralPath $temp -Encoding UTF8
 Move-Item -LiteralPath $temp -Destination (Join-Path $cache 'status.json') -Force
}
function Wait-Permit {
 while ($null -ne $parent -and -not $parent.HasExited -and (Test-Path -LiteralPath (Join-Path $cache 'busy'))) { Start-Sleep -Milliseconds 250; $parent.Refresh() }
}
function Hash-File([string]$path) {
 $hasher=[Security.Cryptography.SHA256]::Create();$inputStream=[IO.File]::OpenRead($path);$buffer=New-Object byte[] (1024*1024)
 try { while (($count=$inputStream.Read($buffer,0,$buffer.Length)) -gt 0) { Wait-Permit;[void]$hasher.TransformBlock($buffer,0,$count,$buffer,0) };[void]$hasher.TransformFinalBlock(@(),0,0);return [BitConverter]::ToString($hasher.Hash).Replace('-','').ToLowerInvariant() }
 finally { $inputStream.Dispose();$hasher.Dispose() }
}
function Download([Uri]$url,[string]$path,[long]$limit) {
 Wait-Permit
 $requestTask=$client.GetAsync($url,[Net.Http.HttpCompletionOption]::ResponseHeadersRead)
 if (-not $requestTask.Wait(15000)) { $client.CancelPendingRequests();throw 'Update connection timed out' }
 $response=$requestTask.GetAwaiter().GetResult()
 try {
  if ([int]$response.StatusCode -in @(401,403)) { throw 'PRIVATE_ACCESS' }
  if ([int]$response.StatusCode -ne 200) { throw 'Update unavailable' }
  if ($response.Content.Headers.ContentLength -gt $limit) { throw 'Unexpected download size' }
  $inputStream=$response.Content.ReadAsStreamAsync().GetAwaiter().GetResult();$outputStream=[IO.File]::Create($path);$buffer=New-Object byte[] 65536;$total=0L
  try { while ($true) { Wait-Permit;$readTask=$inputStream.ReadAsync($buffer,0,$buffer.Length);if (-not $readTask.Wait(30000)) { throw 'Download timed out' };$count=$readTask.GetAwaiter().GetResult();if ($count -eq 0) { break };$total+=$count;if ($total -gt $limit) { throw 'Download size limit exceeded' };$outputStream.Write($buffer,0,$count) } }
  finally { $inputStream.Dispose();$outputStream.Dispose() }
 } finally { $response.Dispose() }
}
try {
 if ([int]$job.parent -gt 0) {
  $parent=Get-Process -Id ([int]$job.parent) -ErrorAction SilentlyContinue
  if ($parent -and -not $TestMode -and [IO.Path]::GetFullPath($parent.Path) -ne (Join-Path $install 'Milano Apex.exe')) { throw 'Game process mismatch' }
 }
 $handler=New-Object Net.Http.HttpClientHandler;$handler.AllowAutoRedirect=$false
 $client=New-Object Net.Http.HttpClient($handler);$client.Timeout=[TimeSpan]::FromHours(2)
 if ($job.cookie) { [void]$client.DefaultRequestHeaders.TryAddWithoutValidation('Cookie',[string]$job.cookie) }
 Status 'checking'
 $manifestPath=Join-Path $cache 'manifest.json';Download $feed $manifestPath 65536
 $envelope=Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
 $payload=[Convert]::FromBase64String($envelope.payload);$signature=[Convert]::FromBase64String($envelope.signature)
 $rsa=New-Object Security.Cryptography.RSACryptoServiceProvider;$rsa.FromXmlString('<RSAKeyValue><Modulus>nFsVgqTgG20mRwkKdtHTBYoA+jpWj7q46JuSds+xurY0MhC0NndG76DKWZFUw/gk4YG7GcmRoZ4X2T22d5UMaX/9rS6mF1wEeGTebbuBy0nEaOtMqrrL0g65CC2TUb6HA6nnfUPrQZdk6VD2vdcWPYYbDlkvRITlHYiVzahr3FQvA3ksw4M7Sija9UhoSA5nu12CBPLMQSQE/AFIBSb/Nzy7A3iXcwQkY6g5tVbhZfIZ8cqs9y1eVNE113eiW+GdeYRwEmZoYlTWq12lGnv2t86O9hL1LIt4hEhY7/2tWCANt4X2nHk97zfuSrdCEWDKSEPr51QbCrZvf4mebS3BRiZk2AdNZ8w+T6kr9JxE57nWDTSN2CEoI2x5gV8yYNayt7uO3Ua7NvChy34e058QWu/xL3tDt0x/BVmdZXG5+GwyaqbPkdqueYU4NZ3zMsT2553KoPEt6yu7T7Idz1M/h6BSqsGL4QmiztW8HZURKqYYw3nR8Q41rM1LD78B8rzR</Modulus><Exponent>AQAB</Exponent></RSAKeyValue>')
 try { if (-not $rsa.VerifyData($payload,'SHA256',$signature)) { throw 'Invalid release signature' } } finally { $rsa.Dispose() }
 $release=[Text.Encoding]::UTF8.GetString($payload) | ConvertFrom-Json
 if ($release.platform -ne 'windows-x64' -or [long]$release.sequence -le 0) { throw 'Invalid release platform' }
 if ([long]$release.sequence -le [long]$job.sequence) { Status 'current';exit 0 }
 if ([string]$release.archive -notmatch '^/updates/windows-[0-9]+\.zip$' -or [string]$release.sha256 -notmatch '^[a-f0-9]{64}$' -or [long]$release.bytes -le 0 -or [long]$release.bytes -gt 1500000000) { throw 'Invalid release metadata' }
 $names=@('Milano Apex.exe','Milano Apex.pck')
 if (@($release.files.PSObject.Properties).Count -ne 2) { throw 'Unexpected release files' }
 foreach ($name in $names) { $spec=$release.files.$name;if (-not $spec -or [string]$spec.sha256 -notmatch '^[a-f0-9]{64}$' -or [long]$spec.bytes -le 0 -or [long]$spec.bytes -gt 2000000000) { throw 'Invalid file metadata' } }
 Status 'downloading' ([string]$release.version)
 $archive=Join-Path $cache 'release.zip';Download ([Uri]::new($feed,[string]$release.archive)) $archive ([long]$release.bytes)
 if ((Get-Item -LiteralPath $archive).Length -ne [long]$release.bytes -or (Hash-File $archive) -ne $release.sha256) { throw 'Download integrity check failed' }
 $stage=Join-Path $cache ('stage-'+[string]$release.sequence);[void][IO.Directory]::CreateDirectory($stage)
 $zip=[IO.Compression.ZipFile]::OpenRead($archive)
 try {
  if ($zip.Entries.Count -ne 2 -or @($zip.Entries | Where-Object {$_.FullName -cnotin $names}).Count) { throw 'Unsafe archive contents' }
  foreach ($name in $names) {
   $entries=@($zip.Entries | Where-Object {$_.FullName -ceq $name});$spec=$release.files.$name
   if ($entries.Count -ne 1 -or $entries[0].Length -ne [long]$spec.bytes) { throw 'Archive file size mismatch' }
   Wait-Permit
   $outputPath=Join-Path $stage $name;$inputStream=$entries[0].Open();$outputStream=[IO.File]::Create($outputPath);$buffer=New-Object byte[] (1024*1024)
   try { while (($count=$inputStream.Read($buffer,0,$buffer.Length)) -gt 0) { Wait-Permit;$outputStream.Write($buffer,0,$count) } }
   finally { $inputStream.Dispose();$outputStream.Dispose() }
   if ((Hash-File $outputPath) -ne $spec.sha256) { throw 'Staged file integrity check failed' }
  }
 } finally { $zip.Dispose() }
 Status 'ready' ([string]$release.version)
 if ($parent -and -not $parent.HasExited) { $parent.WaitForExit() }
 $backup=Join-Path $cache ('backup-'+[string]$job.sequence+'-'+[Guid]::NewGuid().ToString('N'));[void][IO.Directory]::CreateDirectory($backup)
 $replaced=New-Object 'System.Collections.Generic.List[string]'
 try {
  foreach ($name in $names) {
   # Only these two exact files in the original installation are replaced.
   [IO.File]::Replace((Join-Path $stage $name),(Join-Path $install $name),(Join-Path $backup $name))
   $replaced.Add($name)
  }
 } catch {
  foreach ($name in $replaced) { [IO.File]::Copy((Join-Path $backup $name),(Join-Path $install $name),$true) }
  throw
 }
 Status 'updated' ([string]$release.version)
 $restart=Join-Path $cache 'restart'
 if ((Test-Path -LiteralPath $restart) -and -not $TestMode) { [IO.File]::Delete($restart);Start-Process -FilePath (Join-Path $install 'Milano Apex.exe') -WorkingDirectory $install -WindowStyle Normal }
} catch {
 if ($_.Exception.Message -eq 'PRIVATE_ACCESS') { Status 'private_access' } else { Status 'failed' $_.Exception.Message }
 exit 1
} finally {
 if ($client) { $client.Dispose() }
 # The session cookie is short-lived and is never bundled or left in the job file.
 $job.cookie='';$job | ConvertTo-Json -Compress | Set-Content -LiteralPath $JobPath -Encoding UTF8
 $mutex.ReleaseMutex();$mutex.Dispose()
}
